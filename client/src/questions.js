// Client-side question bank.
// The data is GENERATED from server/questions*.js — do not edit questions.json by hand.
// After changing server question files run:  npm run build:questions
import questions from './data/questions.json';

// Hamza forms are unified as "أ" (matches server/questions.js)
const arabicLetters = [
  'أ','ب','ت','ث','ج','ح','خ','د','ذ','ر',
  'ز','س','ش','ص','ض','ط','ظ','ع','غ','ف',
  'ق','ك','ل','م','ن','ه','و','ي',
];

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Copy of the question with options in random order. */
export function withShuffledOptions(q) {
  return q ? { ...q, options: shuffle(q.options) } : q;
}

// ── "Recently seen" memory (per device) ─────────────────────────────────────
// Keeps the last N question ids so a new game avoids questions the group
// has just played. Falls back silently when localStorage is unavailable.
const SEEN_KEY = 'gg-seen-questions';
const SEEN_MAX = 900;

function readSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); }
  catch { return new Set(); }
}

export function markSeen(ids) {
  try {
    const list = [...readSeen(), ...ids].slice(-SEEN_MAX);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set(list)]));
  } catch { /* ignore */ }
}

/**
 * Pick `count` random questions from `pool`, preferring ones not seen recently
 * and never returning ids in `exclude`. Options are shuffled.
 */
export function pickFresh(pool, count = 1, exclude = new Set()) {
  const seen = readSeen();
  const avail = pool.filter(q => !exclude.has(q.id));
  const fresh = shuffle(avail.filter(q => !seen.has(q.id)));
  const stale = shuffle(avail.filter(q => seen.has(q.id)));
  return [...fresh, ...stale].slice(0, count).map(withShuffledOptions);
}

export function getRandomQuestions(count = 10) {
  const picked = pickFresh(questions, count);
  markSeen(picked.map(q => q.id));
  return picked;
}

export function getQuestionsByLetter(letter) {
  return questions.filter(q => q.letter === letter);
}

export function getQuestionsByCategory(category) {
  return questions.filter(q => q.category === category);
}

export function getRandomQuestion() {
  return withShuffledOptions(questions[Math.floor(Math.random() * questions.length)]);
}

export function getRandomLetters(count) {
  return shuffle(arabicLetters).slice(0, count);
}

/** All categories with their question counts, largest first. */
export const categoryCounts = Object.entries(
  questions.reduce((acc, q) => { acc[q.category] = (acc[q.category] || 0) + 1; return acc; }, {})
).sort((a, b) => b[1] - a[1]);

export { questions, arabicLetters };
