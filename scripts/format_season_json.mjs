import { readFileSync, writeFileSync } from 'fs';

const path = process.argv[2];
const KEY_ORDER = ['e', 'k', 'm', 'num', 'q', 'r', 'tag', 'tip', 'u'];

function fixUnescapedQuotes(text) {
  let s = text;
  let n = 0;
  while (n < 200) {
    try {
      JSON.parse(s);
      return { s, fixes: n };
    } catch (e) {
      const m = e.message.match(/position (\d+)/);
      if (!m) throw e;
      let pos = +m[1];
      while (pos > 0 && s[pos] !== '"') pos--;
      const end = s.indexOf('"', pos + 1);
      if (end < 0) throw e;
      s = s.slice(0, pos) + "'" + s.slice(pos + 1, end) + "'" + s.slice(end + 1);
      n++;
    }
  }
  throw new Error('too many quote fixes');
}

function orderEntry(entry) {
  const out = {};
  for (const key of KEY_ORDER) {
    if (key in entry) out[key] = entry[key];
  }
  for (const key of Object.keys(entry)) {
    if (!(key in out)) out[key] = entry[key];
  }
  return out;
}

const { s: fixed, fixes } = fixUnescapedQuotes(readFileSync(path, 'utf8'));
const arr = JSON.parse(fixed);
arr.sort((a, b) => (a.num ?? 0) - (b.num ?? 0));
for (let i = 0; i < arr.length; i++) arr[i].num = i + 1;
writeFileSync(path, JSON.stringify(arr.map(orderEntry), null, 2) + '\n', 'utf8');
console.log(`OK · ${fixes} quote fix(es), ${arr.length} entries`);
