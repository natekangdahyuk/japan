/**
 * dev_to_fb — 주체: 내 PC(로컬) → Firebase(클라우드)
 *
 *   data/seasons/sXX/NNN.json  →  RTDB seasons/sXX/NNN
 *
 * 실행:
 *   npm run dev-to-fb
 *   npm run dev-to-fb -- --dry-run
 *   npm run dev-to-fb -- --force              (전체: 서버와 같아도 무조건 set)
 *   npm run dev-to-fb -- --only s04/031       (해당 파일만 업로드)
 *   npm run dev-to-fb -- --only s04/031 --force   (그 파일만 무조건 set)
 *
 * --only 값: 시즌폴더/세트번호  예) s03/022, s04/031.json
 *
 * 기본: 서버 값과 비교해 다를 때만 set. 로컬에 없는 세트는 FB에서 삭제하지 않음.
 *
 * 공통: rtdb-sync-shared.mjs
 */

import admin from 'firebase-admin';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, relative } from 'path';
import {
  REPO_ROOT,
  DATABASE_URL,
  resolveServiceAccountPath,
  normalizeSeasonKey,
  sortKeysDeep,
  stableJsonSignature,
  deleteFirebaseAdminApp,
} from './rtdb-sync-shared.mjs';

function parseOnlyArg(argv) {
  const eq = argv.find((a) => a.startsWith('--only='));
  if (eq) return eq.slice('--only='.length).trim() || null;
  const i = argv.indexOf('--only');
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1].trim();
  return null;
}

/** @returns {{ folder: string, fullPath: string, setId: string } | null} */
function resolveOnlyToPath(onlyRaw, seasonsRoot) {
  let s = String(onlyRaw).trim().replace(/\\/g, '/');
  if (!s) return null;
  s = s.replace(/^\/+/, '');
  if (s.toLowerCase().startsWith('data/seasons/')) {
    s = s.slice('data/seasons/'.length);
  }
  const parts = s.split('/').filter(Boolean);
  if (parts.length !== 2) return null;
  const folder = parts[0];
  let file = parts[1];
  if (!file.toLowerCase().endsWith('.json')) file += '.json';
  const fullPath = join(seasonsRoot, folder, file);
  const setId = file.replace(/\.json$/i, '');
  return { folder, fullPath, setId };
}

/** 표시용: s04/031.json → s04/031 */
function formatOnlyLabel(raw) {
  let s = String(raw).trim().replace(/\\/g, '/');
  if (s.toLowerCase().startsWith('data/seasons/')) s = s.slice('data/seasons/'.length);
  return s.replace(/\.json$/i, '');
}

/**
 * @returns {Promise<'set'|'skip'|'error_json'|'error_not_array'>}
 */
async function uploadOneSet(db, fullPath, sKey, setId, force, dryRun) {
  let arr;
  try {
    arr = JSON.parse(readFileSync(fullPath, 'utf8'));
  } catch (e) {
    console.error('JSON 파싱 실패:', fullPath, e.message);
    return 'error_json';
  }

  if (!Array.isArray(arr)) {
    console.warn('배열이 아니어서 건너뜀:', fullPath);
    return 'error_not_array';
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
    console.log('건너뜀 · 서버와 동일:', rtdbPath);
    return 'skip';
  }

  const payload = sortKeysDeep(arr);
  const n = arr.length;
  if (dryRun) {
    console.log(
      '[시뮬] 업로드 예정 · ' + rtdbPath + ' (단어 ' + n + '개) ← ' + relative(REPO_ROOT, fullPath)
    );
  } else {
    await db.ref(rtdbPath).set(payload);
    console.log('반영 완료 · ' + rtdbPath + ' (단어 ' + n + '개)');
  }
  return 'set';
}

async function main() {
  const onlyRaw = parseOnlyArg(process.argv);
  const onlyMode = Boolean(onlyRaw);

  console.log(
    onlyMode
      ? 'dev_to_fb — 단일 세트 · ' + formatOnlyLabel(onlyRaw)
      : 'dev_to_fb — 전체 동기화 · data/seasons → Firebase'
  );

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

    if (onlyMode) {
      const resolved = resolveOnlyToPath(onlyRaw, seasonsRoot);
      if (!resolved) {
        console.error(
          '잘못된 --only 형식입니다. 예: --only s04/031 또는 --only=s04/031.json'
        );
        exitCode = 1;
        return exitCode;
      }
      if (!existsSync(resolved.fullPath)) {
        console.error('파일이 없습니다:', resolved.fullPath);
        exitCode = 1;
        return exitCode;
      }
      const sKey = normalizeSeasonKey(resolved.folder);
      if (!sKey) {
        console.error('시즌 폴더 이름이 s01 형식이 아닙니다:', resolved.folder);
        exitCode = 1;
        return exitCode;
      }
      console.log(
        '  로컬 ' +
          relative(REPO_ROOT, resolved.fullPath).replace(/\\/g, '/') +
          '  →  RTDB seasons/' +
          sKey +
          '/' +
          resolved.setId
      );
      const result = await uploadOneSet(
        db,
        resolved.fullPath,
        sKey,
        resolved.setId,
        force,
        dryRun
      );
      if (result === 'set') toUpload++;
      else if (result === 'skip') sameSkipped++;
      else errorSkipped++;
    } else {
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

          const result = await uploadOneSet(db, fullPath, sKey, setId, force, dryRun);
          if (result === 'set') toUpload++;
          else if (result === 'skip') sameSkipped++;
          else errorSkipped++;
        }
      }
    }

    if (onlyMode) {
      if (errorSkipped > 0) {
        console.log('끝 · 위 메시지를 확인하세요.');
      } else if (dryRun) {
        if (toUpload > 0) {
          console.log('끝 · 시뮬레이션만 했습니다. 실제 업로드는 하지 않았습니다.');
        } else {
          console.log('끝 · 시뮬레이션 · 서버와 같아 업로드할 내용이 없습니다.');
        }
      } else if (toUpload > 0) {
        console.log('끝 · Firebase에 반영했습니다.');
      } else {
        console.log('끝 · 서버 내용과 같아 업로드하지 않았습니다.');
      }
      if (force && toUpload > 0 && !dryRun) {
        console.log('    (강제 덮어쓰기 모드)');
      }
    } else {
      const tail = dryRun ? 'dry-run 끝' : '완료';
      const forceNote = force ? ' · 강제 덮어쓰기' : '';
      console.log(
        tail +
          ' [dev_to_fb] 업로드 ' +
          toUpload +
          '건 · 동일·건너뜀 ' +
          sameSkipped +
          '건 · 오류·무시 ' +
          errorSkipped +
          '건' +
          forceNote
      );
    }
    return exitCode;
  } catch (err) {
    console.error(err);
    return 1;
  } finally {
    await deleteFirebaseAdminApp(admin);
  }
}

main()
  .then((code) => process.exit(typeof code === 'number' ? code : 0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
