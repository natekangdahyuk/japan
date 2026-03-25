/**
 * Firebase Realtime DB → 로컬 data/seasonXX/NNN.json 백업
 *
 * 사전 준비:
 * 1) Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → "새 비공개 키 생성"
 *    → JSON 파일을 저장 (Git에 넣지 말 것)
 * 2) 인증 (우선순위)
 *    - 환경 변수 GOOGLE_APPLICATION_CREDENTIALS = JSON 전체 경로
 *    - 또는 secrets\firebase-service-account.json
 *    - 또는 secrets\ 안의 *-firebase-adminsdk-*.json (콘솔에서 받은 기본 이름 그대로 가능)
 * 3) 프로젝트 루트에서: npm install
 * 4) 수동 실행: npm run export-data
 * 5) 작업 스케줄러: 프로그램 "cmd.exe", 인수 /c "cd /d d:\@Dev\study && npm run export-data"
 *    시작 위치: d:\@Dev\study
 *    (또는 GOOGLE_APPLICATION_CREDENTIALS 를 시스템 환경 변수로 등록)
 */

import admin from 'firebase-admin';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const DATABASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  'https://japanese-fd10c-default-rtdb.asia-southeast1.firebasedatabase.app';

function resolveServiceAccountPath() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
  const secretsDir = join(REPO_ROOT, 'secrets');
  const fixedName = join(secretsDir, 'firebase-service-account.json');
  if (existsSync(fixedName)) return fixedName;
  if (existsSync(secretsDir)) {
    const adminsdk = readdirSync(secretsDir).filter((name) =>
      /firebase-adminsdk.*\.json$/i.test(name)
    );
    if (adminsdk.length > 0) {
      adminsdk.sort();
      return join(secretsDir, adminsdk[0]);
    }
  }
  console.error(
    '서비스 계정 JSON 경로를 찾을 수 없습니다.\n' +
      '  secrets 폴더에 *-firebase-adminsdk-*.json 을 두거나\n' +
      '  secrets\\firebase-service-account.json 을 두거나\n' +
      '  GOOGLE_APPLICATION_CREDENTIALS 환경 변수를 설정하세요.'
  );
  process.exit(1);
}

function seasonKeyToFolder(seasonKey) {
  const num = String(seasonKey).replace(/^s/i, '').padStart(2, '0');
  return 'season' + num;
}

function main() {
  const credPath = resolveServiceAccountPath();
  const serviceAccount = JSON.parse(readFileSync(credPath, 'utf8'));

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: DATABASE_URL,
    });
  }

  const dataRoot = join(REPO_ROOT, 'data');

  return admin
    .database()
    .ref('seasons')
    .once('value')
    .then((snap) => {
      const seasons = snap.val();
      if (!seasons || typeof seasons !== 'object') {
        console.warn('seasons 노드가 비어 있거나 없습니다.');
        return;
      }

      let fileCount = 0;
      for (const seasonKey of Object.keys(seasons)) {
        const seasonVal = seasons[seasonKey];
        if (!seasonVal || typeof seasonVal !== 'object') continue;

        const folderName = seasonKeyToFolder(seasonKey);
        const outDir = join(dataRoot, folderName);
        mkdirSync(outDir, { recursive: true });

        for (const setKey of Object.keys(seasonVal)) {
          const setData = seasonVal[setKey];
          if (!Array.isArray(setData)) continue;

          const filePath = join(outDir, `${setKey}.json`);
          writeFileSync(filePath, JSON.stringify(setData, null, 2) + '\n', 'utf8');
          fileCount++;
          console.log('wrote', filePath);
        }
      }

      console.log('완료: ' + fileCount + '개 JSON 파일');
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

main();
