# 던삐삐 운영 app

`apps/ops`는 운영 화면(`apps/internal`)이 부르는 job, 타임라인 queue 현황, 수집 대기열, batch Neople key 경로(`/api/*`)를 내는 Hono app입니다.
로그인이 없으므로 공개 인터넷에 열지 않습니다.

## 입력

| 입력 | 필수 | 내용 |
| --- | --- | --- |
| `PORT` | 필수 | ASCII 십진 정수 1~65535 |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` 또는 `DB_PASSWORD_FILE` | 필수 | [API의 DB 입력](../api/README.md#db와-migration)과 같습니다 |

## 로컬 개발 명령

```bash
pnpm --filter @dfragon/ops dev
```

`.env.example`을 앱의 `.env`로 복사해 채웁니다. `dev`는 build 뒤 `.env`를 읽어 `dist/main.js`를 실행합니다.
운영 화면 dev 서버는 `http://localhost:3444`로 요청을 넘기므로([운영 화면 안내](../internal/README.md)), 로컬에서는 `PORT=3444`로 띄웁니다.

## 검증

```bash
pnpm --filter @dfragon/ops run --sequential '/^(lint|test)$/'
```

`test`는 `build`로 `dist`를 새로 만든 뒤 test를 compile, 실행합니다.

## 서버 이미지

운영 app 이미지는 node1이 운영자가 고른 main commit을 빌드해 배포합니다.
빌드, 배포 절차는 [인프라 운영 안내](https://github.com/dungeon-and-dragon/dfragon-infra/blob/main/deploy/linux/README.md)를 따릅니다.

```sh
docker build --platform linux/amd64 --build-arg SOURCE_COMMIT="$(git rev-parse HEAD)" -f apps/ops/Dockerfile -t dfragon-ops:local .
```

이미지는 UID/GID `1000:1000`으로 실행합니다.
`DB_HOST`를 지정하고 비밀번호 입력을 둘 다 생략하면 `/run/secrets/db_password`를 읽습니다.
실제 PostgreSQL을 붙인 검사는 [API 컨테이너 검사](../api/README.md#컨테이너-검사)가 API 이미지와 함께 실행합니다.
