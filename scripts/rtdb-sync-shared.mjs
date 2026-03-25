/**
 * RTDB 동기화 공통 설정
 *
 * - fb_to_dev.mjs  Firebase → 이 PC
 * - dev_to_fb.mjs  이 PC → Firebase
 *
 * 로컬: data/seasons/sXX/NNN.json
 * RTDB: seasons/sXX/NNN (배열)
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

/** export/import 에서 동일 데이터인지 비교할 때 사용 (키 순서 무시) */
export function sortKeysDeep(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  const out = {};
  for (const k of Object.keys(v).sort()) {
    out[k] = sortKeysDeep(v[k]);
  }
  return out;
}

/**
 * RTDB는 배열을 연속 숫자 키 객체로 돌려주는 경우가 있어, 비교 전에 배열로 통일
 */
export function normalizeArrayLike(val) {
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(normalizeArrayLike);
  const keys = Object.keys(val);
  const nums = keys.filter((k) => /^\d+$/.test(k));
  if (nums.length === keys.length && keys.length > 0) {
    const indices = nums.map(Number).sort((a, b) => a - b);
    const last = indices[indices.length - 1];
    if (indices[0] === 0 && last === indices.length - 1) {
      return indices.map((i) => normalizeArrayLike(val[String(i)]));
    }
  }
  const out = {};
  for (const k of keys) {
    out[k] = normalizeArrayLike(val[k]);
  }
  return out;
}

/** import 시 서버·로컬 동일 여부 비교용 */
export function stableJsonSignature(value) {
  return JSON.stringify(sortKeysDeep(normalizeArrayLike(value)));
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
