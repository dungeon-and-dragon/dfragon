# @dfragon/models

앱 빌드에 넣는 학습 모델 파일과 점수 엔진 바이너리를 모아 둔 workspace 패키지입니다. 원본은 별도 저장소에 두고, OCR 모델은 submodule로, 점수 엔진은 lock 파일로 특정 커밋을 고정합니다. 코드와 build 명령은 없습니다.

| 경로 | 내용 | 원본 | 소비 |
| --- | --- | --- | --- |
| `ocr-finetuned/` | OCR 파인튜닝 모델 `model.onnx`, 사전 `characters.txt`와 출처, 변경 고지 `NOTICE` | [dfragon-ocr-models](https://github.com/dungeon-and-dragon/dfragon-ocr-models), Apache-2.0 | Web `apps/web/ocr-model.config.mjs`, Web `prepare:ocr-assets` |
| `score-engine.lock.json` | API 이미지에 넣을 장비 점수, 버프 점수 엔진의 소스 commit, `VERSION`, `BUNDLE` | 비공개 엔진 저장소 `dnf-reverse-engineering` | node1의 API 이미지 빌드 |
| `score-engine/` | lock의 엔진으로 빌드한 `libdnfscore.so`(Linux x64)나 로컬용 `libdnfscore.dylib`(macOS arm64), `dnfscore.dll`(Windows x64). Git이 추적하지 않습니다 | 위 lock의 엔진 commit | API 이미지(`apps/api/Dockerfile`), API 테스트 |

## 받기

처음 checkout할 때 한 번 실행합니다. OCR 모델 저장소는 비공개라 읽기 권한이 있는 GitHub 계정으로 받습니다. node1의 웹 이미지 빌드는 고정된 `ocr-finetuned` 커밋을 읽기 전용 deploy key로 받습니다.

```sh
git submodule update --init --recursive
```

### 점수 엔진

점수 엔진 라이브러리는 이 저장소에 없습니다. node1은 API 이미지를 빌드할 때 `score-engine.lock.json`의 엔진 commit을 받아 빌드, 테스트하고 `score-engine/libdnfscore.so`에 둡니다(dfragon-infra 결정 기록 0014).
로컬에서 실제 엔진이 필요하면 엔진 저장소의 그 commit에서 라이브러리를 빌드해 `score-engine/`에 둡니다. 빌드 명령은 엔진 저장소 Rust 패키지(`dnfscore-rust`) README의 빌드 절에 있습니다.
라이브러리가 없으면 API 테스트 가운데 실제 엔진 계산과 점수 worker를 띄운 종료 확인만 건너뜁니다. Web은 점수 엔진을 쓰지 않습니다.
엔진 submodule을 받았던 checkout은 이 변경 뒤에도 `score-engine/`에 예전 엔진 바이너리가 남습니다. 이 폴더는 Git이 추적하지 않아 `git status`에 보이지 않고, 로컬 API 테스트와 로컬 이미지 빌드가 lock과 다른 예전 엔진을 그대로 씁니다. 한 번 지웁니다.

```sh
rm -rf packages/models/score-engine .git/modules/packages/models/score-engine
git config --remove-section submodule.packages/models/score-engine
```

`git config`가 섹션이 없다고 실패하면 이미 지워진 것입니다.

## 쓰기

소비 앱의 `devDependencies`에 `"@dfragon/models": "workspace:*"`를 두고 패키지 이름으로 파일 경로를 찾습니다.

```js
import { fileURLToPath } from 'node:url'

const modelPath = fileURLToPath(import.meta.resolve('@dfragon/models/ocr-finetuned/model.onnx'))
```

`exports`에 적은 파일만 가져올 수 있습니다. 새 모델 파일을 제공하려면 `package.json`의 `exports`에 경로를 추가합니다.

## 갱신

모델, 엔진 저장소에 파일을 올리는 것만으로 빌드의 파일이 바뀌지는 않습니다. 작업 브랜치에서 submodule을 원하는 커밋으로 옮기고 그 변경을 PR에 넣습니다. OCR 모델은 학습에 쓴 사전 순서를 유지하고 출력 클래스 수가 사전 문자 수 + 2여야 합니다. `modelScore`는 문자열 확률의 100배이며 실제 정답률이 아닙니다.

```sh
git -C packages/models/ocr-finetuned fetch origin
git -C packages/models/ocr-finetuned checkout <모델을-포함한-커밋-SHA>
git add packages/models/ocr-finetuned
```

점수 엔진은 `score-engine.lock.json`의 `commit`을 엔진 저장소 main의 새 커밋으로 바꾸고, `version`과 `bundle`을 그 커밋의 `dnfscore-native` 패키지에 있는 `VERSION`, `BUNDLE` 파일과 같게 맞춥니다. 셋이 맞지 않거나 커밋이 엔진 main에 없으면 node1의 API 빌드가 멈춥니다. 엔진을 바꾸면 점수가 달라지므로, 운영에 올리기 전에 같은 캐릭터들의 점수를 이전 엔진과 비교합니다. 엔진의 제3자 고지는 [`@dfragon/licenses`의 `notices/score-engine`](../licenses/README.md#원본과-수집-범위)이 보관하므로, 엔진의 `NOTICE`, `Cargo.lock`, Rust 버전이 바뀌었으면 같은 PR에서 함께 갱신합니다.
