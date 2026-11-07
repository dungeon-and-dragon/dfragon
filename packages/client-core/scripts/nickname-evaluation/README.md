# 닉네임 OCR 오프라인 평가

게임 client 영역 PNG에서 파티 프레임이나 공대 상세 창을 검출하고 자리별 닉네임 OCR이 정답과 얼마나 맞는지 측정합니다.
검출 배율 s(1067×600 client가 1.0)별로 실패가 어디서 나는지 보고, 학습 입력을 이진화할지 정하는 도구입니다.
제품 함수를 그대로 import하고 네트워크는 쓰지 않습니다.

| 화면 | 검출과 crop | `nickname` 전처리 |
| --- | --- | --- |
| `party` | `@dfragon/lib`의 `detectPartyFrameGeometry`가 준 자리별 이름 영역을 그대로 자릅니다. | 웹 앱 파티 OCR과 같은 `binarizeNicknamePixels`(BT.601 회색의 Otsu 반전 이진화) |
| `raid` | `@dfragon/lib`의 `cropDNFRaidParticipantNicknames`가 공대 창 제목 기준 이미지(`src/shared/raid/raid-heading.png`)로 창을 찾고 12행 이름 칸을 자릅니다. 빈 행은 자르지 않습니다. | 웹 앱 공대 OCR과 같은 `binarizeRaidNicknamePixels`(가장 어두운 채널의 Otsu 이진화, 선택 행 테두리와 떨어진 픽셀 제거) |

- `nickname` 전처리는 두 화면 모두 이진화 뒤 `normalizedNicknameBgr`(`nicknameCenterOffset`으로 가운데 정렬)로 모델 입력을 만듭니다.
- `raw` 전처리는 이진화하지 않은 원본 색을 `normalizedBgr`로 왼쪽에 붙여 넣습니다. 공대 행 평가의 `raw`와 같습니다.
- 추론과 디코딩은 웹 앱 OCR worker와 같은 WASM 엔진, 사전, `decodeCtcCandidates`의 1순위 후보입니다.

모델 입력 높이로 줄이는 단계는 canvas 대신 쌍선형 보간으로 근사하므로 브라우저와 픽셀 단위로 같지는 않습니다.
OCR 엔진 로드, 리사이즈, crop은 [공대 행 평가](../raid-row-evaluation/README.md)와 `../shared/onnx-ocr.ts`를 함께 씁니다.

## 실행

Repository root에서 실행합니다.
표본 폴더와 결과는 저장소 밖에 둡니다.

```bash
DFRAGON_NICKNAME_MANIFEST=/path/to/samples/manifest.json \
DFRAGON_NICKNAME_REPORT=/path/to/report.json \
DFRAGON_NICKNAME_CROPS=/path/to/crops \
pnpm --filter @dfragon/client-core run test:nickname-evaluation
```

`test:nickname-evaluation`은 전용 `tsc`로 이 폴더를 검사한 뒤 `vitest.config.ts`로 `*.evaluation.ts`만 실행합니다.
`@dfragon/client-core`의 기본 `test`에는 포함되지 않습니다.
`DFRAGON_NICKNAME_MANIFEST`가 없으면 평가는 건너뜁니다.
같은 폴더의 `*.test.ts`는 표본 없이 도는 합성 데이터 테스트이며 기본 `test`가 실행합니다.

| 환경 변수 | 설명 |
| --- | --- |
| `DFRAGON_NICKNAME_MANIFEST` | manifest 파일 경로. 없으면 건너뜁니다. |
| `DFRAGON_NICKNAME_REPORT` | 지정하면 자리별 판독값과 요약을 이 경로에 JSON으로 저장합니다. |
| `DFRAGON_NICKNAME_CROPS` | 지정하면 검출한 자리별 crop을 이 폴더에 저장합니다. 아래 [crop 저장](#crop-저장)을 봅니다. |
| `DFRAGON_NICKNAME_OCR_MODEL` | OCR 모델 경로. 기본은 운영 모델 `packages/models/ocr-finetuned/model.onnx`입니다. |
| `DFRAGON_NICKNAME_OCR_DICTIONARY` | OCR 사전 경로. 기본은 `packages/models/ocr-finetuned/characters.txt`입니다. |

운영 모델은 `git submodule update --init packages/models/ocr-finetuned`로 받습니다.
새 모델은 ONNX로 내보내 `scripts/validate-ocr-model.mjs`로 검증한 뒤 `DFRAGON_NICKNAME_OCR_MODEL`로 같은 표본에 돌려 비교합니다.

## manifest 형식

이미지 경로는 manifest가 있는 폴더 기준 상대 경로이며 폴더 밖을 가리킬 수 없습니다.
이미지는 게임 client 영역 전체를 찍은 PNG만 받습니다.
게임이 저장한 JPEG는 PNG로 바꾼 사본을 `ingame-jpg`로 넣어 손실 압축 표본임을 표시합니다.

```json
{
  "cases": [
    {
      "id": "1920x1080_ui100_prtsc_01",
      "image": "originals/1920x1080_ui100_prtsc_01.png",
      "screen": "raid",
      "client": { "width": 1920, "height": 1080 },
      "uiPercent": 100,
      "capture": "prtsc",
      "slots": [
        { "slot": 1, "text": "가나다라" },
        { "slot": 12, "text": "Abc12", "uncertain": true }
      ]
    }
  ]
}
```

- `screen`은 `party`(파티 프레임)나 `raid`(공대 상세 창)입니다. 기본값이 없어 케이스마다 적어야 합니다.
- `client`는 게임 client 크기입니다. 화면 공유 프레임처럼 이미지 크기가 조금 달라도 집계는 이 값으로 묶습니다.
- `uiPercent`는 게임 설정의 UI 크기(0~100)이며 모르면 `null`입니다.
- `capture`는 `prtsc`(Alt+PrtSc), `share`(화면 공유 프레임), `snip`(Win+Shift+S), `ingame-jpg`(게임 내장 스크린샷의 PNG 사본) 중 하나입니다.
- `slots`의 `slot`은 `party`에서 화면의 자리 번호(1~4), `raid`에서 공대 창의 행 번호(1~12)입니다.
  `text`는 보이는 닉네임 그대로입니다.
  빈 배열이면 검출과 crop 저장만 합니다.
- `uncertain: true`인 정답은 채점에서 빼고 개수만 셉니다.
- 그 밖의 필드는 읽지 않습니다. 메모나 이전 판독값을 같은 파일에 둘 수 있습니다.

## 지표

케이스마다 검출 배율 s나 검출 실패 이유를 기록하고, 검출한 자리를 두 전처리로 읽습니다.
s는 `party`에서 파티 프레임 검출 결과의 `scale`, `raid`에서 공대 창 검출 결과의 `scale`입니다.
요약은 전체, `screen`, `client`와 `uiPercent`, s 구간(0.1 간격, 1.28은 `1.2` 구간), `capture`별로 아래 표를 출력합니다.
검출에 실패한 케이스는 `undetected` 구간에 모입니다.

| 열 | 정의 |
| --- | --- |
| 케이스, 검출 | 케이스 수와 파티 프레임이나 공대 창을 검출한 케이스 수 |
| 채점 자리 | 정답이 확실하고 crop을 읽은 자리 수. 일치와 CER의 분모입니다. |
| 불확실 | `uncertain: true`라 채점에서 뺀 자리 수 |
| 자리 미검출 | 정답은 있지만 검출기가 그 자리를 찾지 못한 자리 수. `raid`에서는 검출기가 빈 행으로 본 행도 여기에 듭니다. |
| 일치 | OCR 1순위 문자열이 정답과 그대로 같은 자리 수 |
| CER | 편집 거리 합을 정답 글자 수 합으로 나눈 값 |

편집 거리는 정규화 없이 Unicode code point 단위로 세는 Levenshtein 거리이며 OCR 학습 평가 도구와 같은 정의입니다.
CER은 자리별 비율의 평균이 아니라 묶음 전체의 합으로 나눕니다.

## crop 저장

`DFRAGON_NICKNAME_CROPS`를 주면 검출한 자리마다 이진화 전 원본 색 crop을 `{caseId}_slot{n}.png`로 저장합니다.
`raid`의 `n`은 행 번호입니다.
crop은 제품과 같은 geometry이므로 합성 데이터의 크기와 배경을 맞출 때 그대로 씁니다.

같은 폴더의 `index.json`은 `{ "crops": [...] }` 형태이며 crop마다 아래 필드를 씁니다.
다른 저장소의 합성 데이터 보정 도구가 이 형식을 읽으므로 필드 이름과 의미를 바꿀 때는 그쪽도 함께 고칩니다.

| 필드 | 형식 | 설명 |
| --- | --- | --- |
| `caseId` | 문자열 | manifest 케이스 `id` |
| `screen` | `"party"` 또는 `"raid"` | manifest 케이스 `screen` |
| `slot` | 정수 | `party`는 자리 번호 1~4, `raid`는 행 번호 1~12 |
| `file` | 문자열 | 같은 폴더의 crop PNG 파일 이름 |
| `scale` | 수 | 검출 배율 s. `party`는 파티 프레임, `raid`는 공대 창 검출 결과의 `scale` |
| `crop` | `{ x, y, width, height }` | 이미지 안 crop 좌표와 크기(px) |
| `client` | `{ width, height }` | manifest 케이스의 게임 client 크기 |
| `image` | `{ width, height }` | 읽은 PNG 크기 |
| `uiPercent` | 정수 또는 `null` | manifest 케이스 `uiPercent` |
| `capture` | 문자열 | manifest 케이스 `capture` |

## 저장소에 넣지 않는 것

표본 PNG, manifest, crop, 결과 JSON과 캐릭터 닉네임은 저장소, CI, PR 본문에 넣지 않습니다.
결과를 공유할 때는 요약 수치만 적습니다.
