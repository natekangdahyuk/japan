/**
 * dev_to_fb — 주체: 내 PC(로컬) → Firebase(클라우드)
 *
 *   data/seasons/sXX/NNN.json  →  RTDB seasons/sXX/NNN
 *
 * 실행:
 *   npm run dev-to-fb
 *   npm run dev-to-fb -- --dry-run
 *   npm run dev-to-fb -- --force   (서버와 같아도 무조건 set)
 *
 * 기본: 서버 값과 비교해 다를 때만 set. 로컬에 없는 세트는 FB에서 삭제하지 않음.
 *
 * 공통: rtdb-sync-shared.mjs
 */

import admin from 'firebase-admin';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import {
  REPO_ROOT,
  DATABASE_URL,
  resolveServiceAccountPath,
  normalizeSeasonKey,
  sortKeysDeep,
  stableJsonSignature,
} from './rtdb-sync-shared.mjs';

async function shutdownAdmin() {
  if (admin.apps && admin.apps.length) {
    await admin.app().delete().catch(() => {});
  }
}

async function main() {
  console.log('dev_to_fb — 이 PC (data/seasons/...) → Firebase');

  let exitCode = 0;
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');

  try {
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
      exitCode = 1;
      return exitCode;
    }

    const db = admin.database();
    let toUpload = 0;
    let sameSkipped = 0;
    let errorSkipped = 0;

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
          errorSkipped++;
          continue;
        }

        if (!Array.isArray(arr)) {
          console.warn('배열이 아니어서 건너뜀:', fullPath);
          errorSkipped++;
          continue;
        }

        const rtdbPath = 'seasons/' + sKey + '/' + setId;
        const localSig = stableJsonSignature(arr);

        let needWrite = force;
        if (!force) {
          const snap = await db.ref(rtdbPath).once('value');
          const remote = snap.val();
          if (remote === null || remote === undefined) {
            needWrite = true;
          } else {
            needWrite = stableJsonSignature(remote) !== localSig;
          }
        }

        if (!needWrite) {
          sameSkipped++;
          console.log('skip (server same)', rtdbPath);
          continue;
        }

        const payload = sortKeysDeep(arr);
        if (dryRun) {
          console.log('[dry-run] would set', rtdbPath, '←', fullPath, '(' + arr.length + '개 항목)');
        } else {
          await db.ref(rtdbPath).set(payload);
          console.log('set', rtdbPath, '(' + arr.length + '개 항목)');
        }
        toUpload++;
      }
    }

    const tail = dryRun ? 'dry-run 끝' : '완료';
    console.log(
      tail +
        ' [dev_to_fb]: 올릴 것 ' +
        toUpload +
        '개, 서버와 동일해 건너뜀 ' +
        sameSkipped +
        '개, 오류·무시 ' +
        errorSkipped +
        '개' +
        (force ? ' (--force)' : '')
    );
    return exitCode;
  } catch (err) {
    console.error(err);
    return 1;
  } finally {
    await shutdownAdmin();
  }
}

main()
  .then((code) => process.exit(typeof code === 'number' ? code : 0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
