/**
 * 가져오기: Firebase Realtime DB → 로컬
 *
 *   RTDB seasons/sXX/NNN  →  data/seasons/sXX/NNN.json
 *
 * npm run export-data
 *
 * - 키 정렬 후 저장, 내용 동일 시 덮어쓰기 생략 (Git diff 최소화)
 * - 시즌 키는 s01 형태로 정규화 (import·git 페이지와 동일)
 *
 * 인증: rtdb-sync-shared.mjs 참고
 */

import admin from 'firebase-admin';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import {
  REPO_ROOT,
  DATABASE_URL,
  resolveServiceAccountPath,
  normalizeSeasonKey,
} from './rtdb-sync-shared.mjs';

function sortKeysDeep(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  const out = {};
  for (const k of Object.keys(v).sort()) {
    out[k] = sortKeysDeep(v[k]);
  }
  return out;
}

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
        '완료: 갱신 ' +
          updated +
          '개, 동일 건너뜀 ' +
          skipped +
          '개' +
          (ignoredSeason ? ', 무시된 시즌키 ' + ignoredSeason + '개' : '')
      );
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

main();
