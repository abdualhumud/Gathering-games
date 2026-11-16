// Loads the compact question bank files (server/bank/*.txt).
//
// File format — one question per line:
//   # الفئة: اسم الفئة            ← sets the category for the lines below
//   د|نص السؤال|الإجابة الصحيحة|خطأ ١|خطأ ٢|خطأ ٣
// د = difficulty: 1 سهل، 2 متوسط، 3 صعب (used by MoneyBoard rows 200/400/600).
// Empty lines and lines starting with "//" are ignored.
const fs = require('fs');
const path = require('path');

function parseFile(file, startId) {
  const lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/);
  const out = [];
  let category = null;
  let id = startId;
  lines.forEach((line, n) => {
    const t = line.trim();
    if (!t || t.startsWith('//')) return;
    const m = t.match(/^#\s*الفئة\s*:\s*(.+)$/);
    if (m) { category = m[1].trim(); return; }
    const parts = t.split('|').map(s => s.trim());
    if (parts.length !== 6 || !category) {
      throw new Error(`${path.basename(file)}:${n + 1} — expected "د|سؤال|إجابة|خطأ|خطأ|خطأ"`);
    }
    const [d, text, answer, ...wrong] = parts;
    out.push({ id: id++, text, answer, options: [answer, ...wrong], category, difficulty: Number(d) });
  });
  return out;
}

function loadBank() {
  const dir = __dirname;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort();
  let all = [];
  files.forEach((f, i) => { all = all.concat(parseFile(path.join(dir, f), 200000 + i * 1000)); });
  return all;
}

module.exports = { loadBank };
