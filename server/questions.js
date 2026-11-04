// Arabic trivia question bank
// Each question has: text, answer, letter (first letter of answer), category, options

const islamQuestions = require('./questions_islam');
const scienceQuestions = require('./questions_science');
const sportsQuestions = require('./questions_sports');
const geographyQuestions = require('./questions_geography');
const arabGeographyQuestions = require('./questions_arab_geography');
const animalsQuestions = require('./questions_animals');
const cultureQuestions = require('./questions_culture');
const historyQuestions = require('./questions_history');
const sportsOlympicsQuestions = require('./questions_sports_olympics');
const arabicLiteratureQuestions = require('./questions_arabic_literature');
const worldGeoQuestions = require('./questions_world_geo');
const technologyQuestions = require('./questions_technology');
const islamicHistoryQuestions = require('./questions_islamic_history');
const physicsQuestions = require('./questions_physics');
const foodQuestions = require('./questions_food');
const quranQuestions = require('./questions_quran');
const astronomyQuestions = require('./questions_astronomy');
const generalQuestions = require('./questions_general');
const biologyQuestions = require('./questions_biology');
const mathematicsQuestions = require('./questions_mathematics');
// New categories
const moviesQuestions = require('./questions_movies');
const musicQuestions = require('./questions_music');
const arabicLangQuestions = require('./questions_arabic_lang');
const environmentQuestions = require('./questions_environment');
const travelQuestions = require('./questions_travel');
const economyQuestions = require('./questions_economy');
const healthQuestions = require('./questions_health');
const entertainmentQuestions = require('./questions_entertainment');
const huroofLetterQuestions = require('./questions_huroof_letters');

// Legacy inline questions kept for backwards compatibility
const legacyQuestions = [
  {
    id: 1,
    text: "ما هي عاصمة المملكة العربية السعودية؟",
    answer: "الرياض",
    letter: "ر",
    category: "جغرافيا",
    options: ["الرياض", "جدة", "مكة", "المدينة"]
  },
  {
    id: 2,
    text: "ما هو أطول نهر في العالم؟",
    answer: "النيل",
    letter: "ن",
    category: "جغرافيا",
    options: ["النيل", "الأمازون", "المسيسيبي", "الفولغا"]
  },
  {
    id: 3,
    text: "ما هو اسم أول إنسان في الإسلام؟",
    answer: "آدم",
    letter: "آ",
    category: "دين",
    options: ["آدم", "إبراهيم", "نوح", "موسى"]
  },
  {
    id: 4,
    text: "ما هي أكبر قارة في العالم؟",
    answer: "آسيا",
    letter: "آ",
    category: "جغرافيا",
    options: ["آسيا", "أفريقيا", "أمريكا", "أوروبا"]
  },
  {
    id: 5,
    text: "كم عدد أيام رمضان في السنة الهجرية؟",
    answer: "ثلاثون",
    letter: "ث",
    category: "دين",
    options: ["ثلاثون", "تسعة وعشرون", "ثمانية وعشرون", "أحد وثلاثون"]
  },
  {
    id: 6,
    text: "ما هو الكوكب الأكبر في المجموعة الشمسية؟",
    answer: "المشتري",
    letter: "م",
    category: "علوم",
    options: ["المشتري", "زحل", "أورانوس", "نبتون"]
  },
  {
    id: 7,
    text: "ما هو أكبر محيط في العالم؟",
    answer: "الهادئ",
    letter: "ه",
    category: "جغرافيا",
    options: ["الهادئ", "الأطلسي", "الهندي", "المتجمد"]
  },
  {
    id: 8,
    text: "من هو مؤسس علم الجبر؟",
    answer: "الخوارزمي",
    letter: "خ",
    category: "تاريخ",
    options: ["الخوارزمي", "ابن سينا", "الرازي", "الفارابي"]
  },
  {
    id: 9,
    text: "ما هي عاصمة مصر؟",
    answer: "القاهرة",
    letter: "ق",
    category: "جغرافيا",
    options: ["القاهرة", "الإسكندرية", "الأقصر", "أسوان"]
  },
  {
    id: 10,
    text: "ما هو الجبل الأعلى في العالم؟",
    answer: "إيفرست",
    letter: "إ",
    category: "جغرافيا",
    options: ["إيفرست", "كيليمنجارو", "ماكنلي", "كاراكورام"]
  },
  {
    id: 11,
    text: "ما هو أقرب نجم إلى الأرض بعد الشمس؟",
    answer: "بروكسيما",
    letter: "ب",
    category: "علوم",
    options: ["بروكسيما", "سيريوس", "ألفا", "بيتا"]
  },
  {
    id: 12,
    text: "في أي عام بدأ تأسيس المملكة العربية السعودية الحديثة؟",
    answer: "ألف وتسعمائة وثلاثة وثلاثون",
    letter: "أ",
    category: "تاريخ",
    options: ["1932م", "1902م", "1945م", "1960م"]
  },
  {
    id: 13,
    text: "ما هو عدد ركعات صلاة الفجر؟",
    answer: "ركعتان",
    letter: "ر",
    category: "دين",
    options: ["ركعتان", "ثلاث ركعات", "أربع ركعات", "ركعة"]
  },
  {
    id: 14,
    text: "ما هو اسم الصحراء الأكبر في العالم؟",
    answer: "الصحراء الكبرى",
    letter: "ص",
    category: "جغرافيا",
    options: ["الصحراء الكبرى", "صحراء جوبي", "صحراء أنتاركتيكا", "صحراء النفود"]
  },
  {
    id: 15,
    text: "من كتب كتاب ألف ليلة وليلة؟",
    answer: "مجهول",
    letter: "م",
    category: "أدب",
    options: ["مجهول المؤلف", "الجاحظ", "ابن خلدون", "المتنبي"]
  },
  {
    id: 16,
    text: "ما هي اللغة الأكثر انتشاراً في العالم؟",
    answer: "الإنجليزية",
    letter: "إ",
    category: "ثقافة عامة",
    options: ["الإنجليزية", "الصينية", "الإسبانية", "العربية"]
  },
  {
    id: 17,
    text: "كم يبلغ عدد سور القرآن الكريم؟",
    answer: "مئة وأربع عشرة",
    letter: "م",
    category: "دين",
    options: ["114", "120", "110", "100"]
  },
  {
    id: 18,
    text: "ما هو أصغر دولة في العالم؟",
    answer: "الفاتيكان",
    letter: "ف",
    category: "جغرافيا",
    options: ["الفاتيكان", "موناكو", "سان مارينو", "ليشتنشتاين"]
  },
  {
    id: 19,
    text: "ما هو اسم المسجد الذي بني على صخرة القدس؟",
    answer: "قبة الصخرة",
    letter: "ق",
    category: "دين",
    options: ["قبة الصخرة", "المسجد الأقصى", "المسجد الإبراهيمي", "المسجد الحرام"]
  },
  {
    id: 20,
    text: "ما هو الحيوان الأسرع على اليابسة؟",
    answer: "الفهد",
    letter: "ف",
    category: "علوم",
    options: ["الفهد", "الأسد", "الغزال", "النمر"]
  },
  {
    id: 21,
    text: "ما اسم البحر الذي يفصل بين آسيا وأفريقيا؟",
    answer: "البحر الأحمر",
    letter: "ب",
    category: "جغرافيا",
    options: ["البحر الأحمر", "بحر العرب", "البحر الأبيض", "البحر الأسود"]
  },
  {
    id: 22,
    text: "كم عدد حروف اللغة العربية؟",
    answer: "ثمانية وعشرون",
    letter: "ث",
    category: "لغة",
    options: ["28", "26", "30", "24"]
  },
  {
    id: 23,
    text: "ما هو اسم أول خليفة في الإسلام؟",
    answer: "أبو بكر الصديق",
    letter: "أ",
    category: "تاريخ",
    options: ["أبو بكر الصديق", "عمر بن الخطاب", "عثمان بن عفان", "علي بن أبي طالب"]
  },
  {
    id: 24,
    text: "في أي مدينة توجد برج إيفل؟",
    answer: "باريس",
    letter: "ب",
    category: "جغرافيا",
    options: ["باريس", "برلين", "لندن", "روما"]
  },
  {
    id: 25,
    text: "ما هو الغاز الأكثر وفرة في الغلاف الجوي للأرض؟",
    answer: "النيتروجين",
    letter: "ن",
    category: "علوم",
    options: ["النيتروجين", "الأكسجين", "ثاني أكسيد الكربون", "الهيدروجين"]
  },
  {
    id: 26,
    text: "من اخترع المصباح الكهربائي؟",
    answer: "إديسون",
    letter: "إ",
    category: "علوم",
    options: ["إديسون", "تسلا", "فاراداي", "واط"]
  },
  {
    id: 27,
    text: "ما هو اسم النبي الذي بنى السفينة وأنقذ الأنواع من الطوفان؟",
    answer: "نوح",
    letter: "ن",
    category: "دين",
    options: ["نوح", "موسى", "إبراهيم", "داود"]
  },
  {
    id: 28,
    text: "ما هي دولة شعارها نسر الجمهورية؟",
    answer: "مصر",
    letter: "م",
    category: "جغرافيا",
    options: ["مصر", "العراق", "سوريا", "اليمن"]
  }
];

const rawQuestions = [
  ...legacyQuestions,
  ...islamQuestions,
  ...scienceQuestions,
  ...sportsQuestions,
  ...geographyQuestions,
  ...arabGeographyQuestions,
  ...animalsQuestions,
  ...cultureQuestions,
  ...historyQuestions,
  ...sportsOlympicsQuestions,
  ...arabicLiteratureQuestions,
  ...worldGeoQuestions,
  ...technologyQuestions,
  ...islamicHistoryQuestions,
  ...physicsQuestions,
  ...foodQuestions,
  ...quranQuestions,
  ...astronomyQuestions,
  ...generalQuestions,
  ...biologyQuestions,
  ...mathematicsQuestions,
  ...moviesQuestions,
  ...musicQuestions,
  ...arabicLangQuestions,
  ...environmentQuestions,
  ...travelQuestions,
  ...economyQuestions,
  ...healthQuestions,
  ...entertainmentQuestions,
  ...huroofLetterQuestions,
];

// ── Normalisation pipeline ───────────────────────────────────────────────────
// Turns the raw category files into one clean, consistent question bank:
//  • old one-word categories are merged into the board categories
//  • if `answer` is not literally one of the options, the first option is used
//  • `letter` is recomputed from the answer (ignoring "ال" and unifying أ/إ/آ/ا),
//    and set to null for numeric/Latin answers so Huroof never draws them
//  • duplicate questions (same text) are removed
// The client bank (client/src/data/questions.json) is generated from this
// output by `npm run build:questions`, so both sides always match.

const CATEGORY_ALIASES = {
  'جغرافيا': 'جغرافيا عالمية',
  'دين': 'قرآن ومعرفة إسلامية',
  'علوم': 'معلومات عامة',
  'تاريخ': 'تاريخ عالمي',
  'أدب': 'أدب عربي ولغة',
  'لغة': 'أدب عربي ولغة',
  'ثقافة عامة': 'معلومات عامة',
  'ثقافة': 'ثقافة وفنون',
  'رياضة': 'رياضة وأولمبياد',
  'طعام': 'طعام ومطبخ',
};

// Arabic letters for Huroof game grid (hamza forms unified as "أ")
const arabicLetters = [
  "أ", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر",
  "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف",
  "ق", "ك", "ل", "م", "ن", "ه", "و", "ي"
];
const LETTER_SET = new Set(arabicLetters);

function answerLetter(answer) {
  let a = String(answer).trim().replace(/^[«"'(\[]+/, '');
  if (/^ال[ء-ي]{2}/.test(a)) a = a.slice(2);
  let c = a[0];
  if ('أإآاٱ'.includes(c)) c = 'أ';
  if (c === 'ى') c = 'ي';
  return LETTER_SET.has(c) ? c : null;
}

function normText(t) {
  return String(t).replace(/[ً-ْـ]/g, '').replace(/[؟?!.,،:«»"'()\s]+/g, ' ').trim();
}

function normalize(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    if (!raw || !raw.text || !Array.isArray(raw.options) || raw.options.length < 2) continue;
    const key = normText(raw.text);
    if (seen.has(key)) continue;
    seen.add(key);
    const options = [...new Set(raw.options.map(o => String(o).trim()))];
    let answer = String(raw.answer ?? '').trim();
    if (!options.includes(answer)) answer = options[0];
    out.push({
      id: raw.id,
      text: raw.text.trim(),
      answer,
      options,
      category: CATEGORY_ALIASES[raw.category] || raw.category,
      letter: answerLetter(answer),
    });
  }
  // guarantee unique ids
  const ids = new Set();
  let next = 100000;
  for (const q of out) {
    if (q.id == null || ids.has(q.id)) q.id = next++;
    ids.add(q.id);
  }
  return out;
}

const questions = normalize(rawQuestions);

// ── Helpers ──────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Copy of a question with its options in random order (the answer is never always first). */
function withShuffledOptions(q) {
  return q ? { ...q, options: shuffle(q.options) } : q;
}

function getRandomQuestions(count = 10) {
  return shuffle(questions).slice(0, Math.min(count, questions.length)).map(withShuffledOptions);
}

function getQuestionsByLetter(letter) {
  return questions.filter(q => q.letter === letter).map(withShuffledOptions);
}

function getRandomQuestion() {
  return withShuffledOptions(questions[Math.floor(Math.random() * questions.length)]);
}

/** Random letters — prefers letters that have at least `minQuestions` questions. */
function getRandomLetters(count, minQuestions = 3) {
  const good = arabicLetters.filter(l => questions.filter(q => q.letter === l).length >= minQuestions);
  const pool = good.length >= count ? good : arabicLetters;
  return shuffle(pool).slice(0, count);
}

module.exports = {
  questions, arabicLetters, shuffle, withShuffledOptions,
  getRandomQuestions, getQuestionsByLetter, getRandomQuestion, getRandomLetters,
};
