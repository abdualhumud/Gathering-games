// Generates client/src/data/questions.json from the normalised server bank.
// Run after editing any server/questions_*.js file:  npm run build:questions
const fs = require('fs');
const path = require('path');
const { questions } = require('../server/questions');

const out = path.join(__dirname, '..', 'client', 'src', 'data', 'questions.json');
fs.writeFileSync(out, JSON.stringify(questions) + '\n');

const cats = {};
for (const q of questions) cats[q.category] = (cats[q.category] || 0) + 1;
console.log(`✔ ${questions.length} questions → ${path.relative(process.cwd(), out)}`);
console.table(cats);
