# @dfragon/models

앱 빌드에 넣는 학습 모델 파일과 점수 엔진 바이너리를 모아 둔 workspace 패키지입니다. 원본은 별도 저장소에 두고 이 패키지가 submodule로 특정 커밋을 고정합니다. 코드와 build 명령은 없습니다.

| 경로 | 내용 | 원본 | 소비 |
| --- | --- | --- | --- |
| `ocr-finetuned/` | Desktop OCR 파인튜닝 모델 `model.onnx`, 사전 `characters.txt`와 출처, 변경 고지 `NOTICE` | [dfragon-ocr-models](https://github.com/dungeon-and-dragon/dfragon-ocr-models), Apache-2.0 | Desktop `ocr-model.config.mjs`, Web `prepare:ocr-assets` |
| `score-engine/` | 장비 점수, 버프 점수 엔진 `libdnfscore.so`(Linux x64), API 로컬 실행과 테스트용 `libdnfscore.dylib`(macOS arm64), `dnfscore.dll`(Windows x64) | [dfragon-score-engine](https://github.com/dungeon-and-dragon/dfragon-score-engine) | API 이미지(`apps/api/Dockerfile`), API 테스트 |

## 받기

처음 checkout할 때 한 번 실행합니다. Windows Test Build, Windows Portable workflow와 웹 사이트 빌드 action(`web-site-build`, 운영, dev 모두)은 고정된 `ocr-finetuned` 커밋만, Product Images는 `score-engine`만 가져옵니다. 엔진 저장소가 비공개이던 때 `git submodule init`을 실행한 checkout은 `.git/config`에 `update = none`이 남아 엔진을 건너뛰므로, 아래 명령 전에 `git config --unset submodule.packages/models/score-engine.update`를 한 번 실행합니다.

```sh
git submodule update --init --recursive
```

OCR 모델만 필요하면 경로를 붙여 `ocr-finetuned`만 받습니다. Desktop과 Web은 `score-engine`을 쓰지 않으며, 받지 않으면 API 테스트 가운데 실제 엔진 계산과 점수 worker를 띄운 종료 확인만 건너뜁니다.

```sh
git submodule update --init --recursive packages/models/ocr-finetuned
```

## 쓰기

소비 앱의 `devDependencies`에 `"@dfragon/models": "workspace:*"`를 두고 패키지 이름으로 파일 경로를 찾습니다.

```js
import { fileURLToPath } from 'node:url'

const modelPath = fileURLToPath(import.meta.resolve('@dfragon/models/ocr-finetuned/model.onnx'))
```

`exports`에 적은 파일만 가져올 수 있습니다. 새 모델 파일을 제공하려면 `package.json`의 `exports`에 경로를 추가합니다.

## 갱신

모델, 엔진 저장소에 파일을 올리는 것만으로 빌드의 파일이 바뀌지는 않습니다. 작업 브랜치에서 submodule을 원하는 커밋으로 옮기고 그 변경을 PR에 넣습니다. Desktop의 모델 선택과 호환성 조건은 [파인튜닝 OCR 모델로 빌드하기](../../apps/desktop/README.md#파인튜닝-ocr-모델로-빌드하기)를 따릅니다.

```sh
git -C packages/models/ocr-finetuned fetch origin
git -C packages/models/ocr-finetuned checkout <모델을-포함한-커밋-SHA>
git add packages/models/ocr-finetuned
```

점수 엔진도 같은 방법으로 `packages/models/score-engine`을 새 엔진 커밋으로 옮깁니다. 엔진 저장소의 README가 각 커밋의 엔진 버전과 SHA256을 적습니다. 엔진의 제3자 고지는 이 submodule에 없고 [`@dfragon/licenses`의 `notices/score-engine`](../licenses/README.md#원본과-수집-범위)이 보관하므로, 엔진의 `NOTICE`, `Cargo.lock`, Rust 버전이 바뀌었으면 같은 PR에서 함께 갱신합니다.
