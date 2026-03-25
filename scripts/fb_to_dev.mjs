/**
 * fb_to_dev — 주체: Firebase(클라우드) → 내 PC(로컬)
 *
 *   RTDB seasons/sXX/NNN  →  data/seasons/sXX/NNN.json
 *
 * 실행: npm run fb-to-dev
 *
 * - 키 정렬 후 저장, 내용 동일 시 파일 덮어쓰기 생략
 * - 시즌 키는 s01 형태로 정규화
 *
 * 공통: rtdb-sync-shared.mjs
 */

import admin from 'firebase-admin';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import {
  REPO_ROOT,
  DATABASE_URL,
  resolveServiceAccountPath,
  normalizeSeasonKey,
  sortKeysDeep,
} from './rtdb-sync-shared.mjs';

function formatJsonStable(data) {
  return JSON.stringify(sortKeysDeep(data), null, 2) + '\n';
}

function normalizeEol(s) {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function writeIfChanged(filePath, newContent) {
  if (existsSync(filePath)) {
    const prev = normalizeEol(readFileSync(filePath, 'utf8'));
    if (prev === newContent) return false;
  }
  writeFileSync(filePath, newContent, 'utf8');
  return true;
}

function main() {
  console.log('fb_to_dev — Firebase → 이 PC (data/seasons/...)');

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

      let updated = 0;
      let skipped = 0;
      let ignoredSeason = 0;

      for (const seasonKey of Object.keys(seasons)) {
        const sKey = normalizeSeasonKey(seasonKey);
        if (!sKey) {
          console.warn('시즌 키 무시 (sNN 형식 아님):', seasonKey);
          ignoredSeason++;
          continue;
        }

        const seasonVal = seasons[seasonKey];
        if (!seasonVal || typeof seasonVal !== 'object') continue;

        const outDir = join(dataRoot, 'seasons', sKey);
        mkdirSync(outDir, { recursive: true });

        for (const setKey of Object.keys(seasonVal)) {
          const setData = seasonVal[setKey];
          if (!Array.isArray(setData)) continue;

          const filePath = join(outDir, `${setKey}.json`);
          const payload = formatJsonStable(setData);
          if (writeIfChanged(filePath, payload)) {
            updated++;
            console.log('wrote', filePath);
          } else {
            skipped++;
            console.log('skip (unchanged)', filePath);
          }
        }
      }

      console.log(
        '완료 [fb_to_dev]: 갱신 ' +
          updated +
          '개, 동일 건너뜀 ' +
          skipped +
          '개' +
          (ignoredSeason ? ', 무시된 시즌키 ' + ignoredSeason + '개' : '')
      );
    })
    .then(async () => {
      if (admin.apps.length) await admin.app().delete().catch(() => {});
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      if (admin.apps.length) await admin.app().delete().catch(() => {});
      process.exit(1);
    });
}

main();
