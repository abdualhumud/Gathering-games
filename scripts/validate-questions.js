// Quality checks for the whole question bank. Exits with code 1 on errors.
//   npm run validate:questions
const { questions } = require('../server/questions');

const errors = [];
const warnings = [];
const norm = s => String(s).replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();

for (const q of questions) {
  const where = `#${q.id} [${q.category}] ${q.text}`;
  if (q.options.length !== 4) errors.push(`${where} → ${q.options.length} options`);
  if (!q.options.includes(q.answer)) errors.push(`${where} → answer not in options`);
  const normOpts = q.options.map(norm);
  if (new Set(normOpts).size !== normOpts.length) errors.push(`${where} → duplicate options`);
  if (q.options.some(o => !o || o.length > 70)) warnings.push(`${where} → empty or very long option`);
  if (q.answer.length >= 4 && norm(q.text).includes(norm(q.answer))) warnings.push(`${where} → answer appears in the question`);
}

// near-duplicate questions (same normalised text)
const seen = new Map();
for (const q of questions) {
  const k = norm(q.text).replace(/[^ء-يa-z0-9]/gi, '');
  if (seen.has(k)) warnings.push(`#${q.id} duplicates #${seen.get(k)}: ${q.text}`);
  else seen.set(k, q.id);
}

const cats = {};
for (const q of questions) cats[q.category] = (cats[q.category] || 0) + 1;
const thin = Object.entries(cats).filter(([, n]) => n < 30);

console.log(`${questions.length} questions · ${Object.keys(cats).length} categories`);
if (thin.length) warnings.push(`thin categories: ${thin.map(([c, n]) => `${c} (${n})`).join(', ')}`);
warnings.forEach(w => console.log('⚠', w));
errors.forEach(e => console.log('✖', e));
console.log(`${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
