# study — 일본어 학습 / Firebase RTDB 동기화

로컬 `data/seasons/` JSON과 Firebase Realtime Database의 `seasons` 노드를 맞출 때 쓰는 명령을 정리했습니다.

## 사전 준비

- **Node.js** (npm 포함)
- **Firebase 서비스 계정 JSON**
  - `secrets/japanese-fd10c-firebase-adminsdk-fbsvc-7f66eca500.json`

  - 또는 환경 변수 `GOOGLE_APPLICATION_CREDENTIALS`에 키 파일 경로

데이터베이스 URL 등은 `scripts/rtdb-sync-shared.mjs`에서 사용합니다.

---

## npm 스크립트

| 명령 | 설명 |
|------|------|
| `npm run fb-to-dev` | **Firebase → 로컬** · RTDB `seasons/` → `data/seasons/sXX/NNN.json` |
| `npm run dev-to-fb` | **로컬 → Firebase** · `data/seasons/` 아래 모든 세트 업로드(내용이 다를 때만) |
| `npm run export-data` | `fb-to-dev`와 동일 |
| `npm run import-data` | `dev-to-fb`와 동일 |

저장소 **루트**에서 실행합니다.

```bash
cd d:\@Dev\study
npm run fb-to-dev
npm run dev-to-fb
```

---

## `dev-to-fb` 옵션 (로컬 → Firebase)

`npm run dev-to-fb --` 뒤에 붙입니다.

| 옵션 | 설명 |
|------|------|
| *(없음)* | `data/seasons` 전체 스캔 · 서버와 다를 때만 `set` |
| `--dry-run` | 실제 업로드 없이, 올릴 항목만 출력 |
| `--force` | 서버와 같아도 **전체** 세트를 다시 `set` |
| `--only s04/031` | **해당 세트만** 업로드 (`031.json` → `seasons/s04/031`) |
| `--only=s04/031.json` | 위와 동일 (`.json` 생략 가능) |
| `--only s04/031 --force` | 그 세트만 **무조건** 덮어쓰기 |

예시:

```bash
npm run dev-to-fb -- --dry-run
npm run dev-to-fb -- --only s04/031
npm run dev-to-fb -- --only s03/022 --force
```

- 각 JSON 파일은 **배열** 형식이어야 합니다 (`[ {...}, ... ]`).
- `data/CC4J4/` 등은 이 스크립트 대상이 **아닙니다** (시즌 단어만).

---

## `fb-to-dev` (Firebase → 로컬)

별도 플래그 없이 한 번에 `seasons` 전체를 받습니다.

```bash
npm run fb-to-dev
```

---

## Windows 작업 스케줄러용 배치

`fb_to_dev_daily.cmd` — 매일 등 **Firebase → 로컬**만 실행하고 `logs\fb_to_dev.log`에 남깁니다.

- 작업 스케줄러 예: 프로그램 `cmd.exe`, 인수 `/c "D:\@Dev\study\fb_to_dev_daily.cmd"`
- **시작 위치**를 저장소 루트로 두거나, 배치가 자체적으로 루트로 `cd` 합니다.

---

## 정적 페이지 로컬 확인

`kanjiReadingMcq.html` 등이 `fetch('data/...')`를 쓰므로 **루트에서** HTTP로 여는 것이 좋습니다.

```bash
cd d:\@Dev\study
python -m http.server 8080
```

브라우저: `http://localhost:8080/kanjiReadingMcq.html`

---

## 데이터 위치 요약

| 경로 | 용도 |
|------|------|
| `data/seasons/sXX/NNN.json` | 단어 카드 배열 · Firebase `seasons`와 동기화 |
| `data/CC4J4/` | 한자 음독 객관식 JSON · 현재는 **로컬/HTML 전용** (동기화 스크립트 미포함) |
