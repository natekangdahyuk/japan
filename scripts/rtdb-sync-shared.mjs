/**
 * export / import RTDB 동기화 스크립트 공통 설정
 *
 * 로컬: data/seasons/sXX/NNN.json
 * RTDB: seasons/sXX/NNN  (배열)
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = join(__dirname, '..');

export const DATABASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  'https://japanese-fd10c-default-rtdb.asia-southeast1.firebasedatabase.app';

/** 로컬 폴더명·RTDB 시즌 키를 항상 s01, s02 … 로 통일 */
export function normalizeSeasonKey(key) {
  const m = /^s(\d+)$/i.exec(String(key).trim());
  if (!m) return null;
  return 's' + m[1].padStart(2, '0');
}

export function resolveServiceAccountPath() {
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
      '  secrets 폴더에 *-firebase-adminsdk-*.json 또는 firebase-service-account.json\n' +
      '  또는 환경 변수 GOOGLE_APPLICATION_CREDENTIALS'
  );
  process.exit(1);
}
