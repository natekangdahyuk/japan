/**
 * 보내기: 로컬 → Firebase Realtime DB
 *
 *   data/seasons/sXX/NNN.json  →  RTDB seasons/sXX/NNN
 *
 * npm run import-data
 * npm run import-data -- --dry-run
 *
 * 각 파일이 해당 RTDB 경로를 통째로 set 합니다.
 * 로컬에 없는 세트는 FB에서 삭제하지 않습니다.
 *
 * 인증: rtdb-sync-shared.mjs 참고
 */

import admin from 'firebase-admin';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import {
  REPO_ROOT,
  DATABASE_URL,
  resolveServiceAccountPath,
  normalizeSeasonKey,
} from './rtdb-sync-shared.mjs';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const credPath = resolveServiceAccountPath();
  const serviceAccount = JSON.parse(readFileSync(credPath, 'utf8'));

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: DATABASE_URL,
    });
  }

  const seasonsRoot = join(REPO_ROOT, 'data', 'seasons');
  if (!existsSync(seasonsRoot)) {
    console.error('data/seasons 폴더가 없습니다:', seasonsRoot);
    process.exit(1);
  }

  const db = admin.database();
  let uploaded = 0;
  let skipped = 0;

  for (const folder of readdirSync(seasonsRoot)) {
    const seasonPath = join(seasonsRoot, folder);
    if (!statSync(seasonPath).isDirectory()) continue;

    const sKey = normalizeSeasonKey(folder);
    if (!sKey) {
      console.warn('시즌 폴더 무시 (이름을 s01 형식으로 해 주세요):', folder);
      continue;
    }

    for (const file of readdirSync(seasonPath)) {
      if (!file.toLowerCase().endsWith('.json')) continue;
      const setId = file.replace(/\.json$/i, '');
      const fullPath = join(seasonPath, file);

      let arr;
      try {
        arr = JSON.parse(readFileSync(fullPath, 'utf8'));
      } catch (e) {
        console.error('JSON 파싱 실패:', fullPath, e.message);
        skipped++;
        continue;
      }

      if (!Array.isArray(arr)) {
        console.warn('배열이 아니어서 건너뜀:', fullPath);
        skipped++;
        continue;
      }

      const rtdbPath = 'seasons/' + sKey + '/' + setId;
      if (dryRun) {
        console.log('[dry-run]', rtdbPath, '←', fullPath, '(' + arr.length + '개 항목)');
      } else {
        await db.ref(rtdbPath).set(arr);
        console.log('set', rtdbPath, '(' + arr.length + '개 항목)');
      }
      uploaded++;
    }
  }

  console.log(
    dryRun
      ? 'dry-run 끝: 업로드 대상 ' + uploaded + '개 파일, 건너뜀 ' + skipped + '개'
      : '완료: 업로드 ' + uploaded + '개, 건너뜀 ' + skipped + '개'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
