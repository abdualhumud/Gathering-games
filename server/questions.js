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
const { loadBank } = require('./bank/loader');

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
  ...loadBank(),
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

// Old questions (ids < 5000) removed after a manual accuracy review:
// wrong facts, ambiguous/duplicate correct options, giveaways or nonsense.
// Kept as an id list so the original category files stay untouched.
const EXCLUDED_IDS = new Set([
  5, 11, 28, 76, 77, 79, 80, 86, 87, 88, 106, 153, 154, 1055, 1060, 1064, 1069, 1071, 1082, 1086,
  1088, 1089, 1090, 1094, 1097, 1100, 1107, 1109, 1110, 1111, 1112, 1117, 1122, 1125, 1133, 1135, 1137, 1139, 1147, 1148,
  1151, 1158, 1159, 1160, 1161, 1163, 1166, 1167, 1168, 1172, 1174, 1179, 1182, 1187, 1188, 1190, 1191, 1192, 1193, 1194,
  1195, 1197, 1198, 1199, 1204, 1213, 1214, 1217, 1230, 1238, 1245, 1251, 1281, 1283, 1285, 1286, 1287, 1288, 1294, 1296,
  1297, 1299, 1308, 1311, 1318, 1331, 1352, 1353, 1363, 1364, 1368, 1372, 1377, 1378, 1379, 1384, 1385, 1387, 1389, 1390,
  1400, 1408, 1418, 1419, 1420, 1422, 1426, 1428, 1435, 1439, 1445, 1448, 1453, 1456, 1461, 1465, 1466, 1467, 1474, 1482,
  1484, 1487, 1488, 1492, 1495, 1496, 1503, 1508, 1511, 1514, 1519, 1524, 1525, 1533, 1536, 1539, 1551, 1552, 1554, 1556,
  1560, 1561, 1563, 1564, 1566, 1569, 1575, 1577, 1580, 1581, 1582, 1584, 1587, 1588, 1589, 1591, 1595, 1599, 1600, 1653,
  1668, 1683, 1729, 1731, 1736, 1746, 1753, 1757, 1767, 1774, 1776, 1780, 1781, 1783, 1784, 1789, 1790, 1792, 1795, 1799,
  1800, 1818, 1830, 1834, 1837, 1838, 1840, 1852, 1855, 1861, 1868, 1870, 1871, 1872, 1875, 1885, 1890, 1899, 1924, 1938,
  1940, 1965, 1968, 1972, 1993, 1995, 1999, 2003, 2004, 2005, 2008, 2009, 2013, 2015, 2018, 2020, 2021, 2023, 2024, 2025,
  2026, 2027, 2029, 2031, 2032, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2043, 2046, 2047, 2048, 2049, 2050, 2052, 2055,
  2056, 2057, 2058, 2060, 2063, 2064, 2065, 2066, 2067, 2068, 2069, 2074, 2075, 2076, 2078, 2083, 2087, 2088, 2090, 2091,
  2094, 2095, 2096, 2097, 2098, 2099, 2100, 2106, 2116, 2119, 2122, 2137, 2138, 2144, 2146, 2147, 2150, 2151, 2152, 2153,
  2157, 2162, 2163, 2164, 2167, 2168, 2171, 2173, 2174, 2175, 2177, 2180, 2181, 2184, 2185, 2186, 2187, 2188, 2189, 2190,
  2193, 2195, 2197, 2198, 2199, 2200, 2222, 2223, 2233, 2236, 2237, 2238, 2239, 2245, 2251, 2252, 2263, 2268, 2271, 2276,
  2280, 2281, 2285, 2287, 2288, 2289, 2291, 2294, 2295, 2296, 2298, 2300, 2304, 2308, 2309, 2310, 2311, 2314, 2320, 2323,
  2328, 2329, 2331, 2332, 2333, 2336, 2337, 2345, 2346, 2350, 2357, 2361, 2364, 2377, 2397, 2434, 2448, 2449, 2458, 2465,
  2471, 2474, 2478, 2481, 2492, 2496, 2498, 2502, 2507, 2518, 2532, 2538, 2540, 2550, 2557, 2561, 2569, 2576, 2580, 2584,
  2586, 2592, 2599, 2600, 3003, 3005, 3010, 3016, 3021, 3023, 3027, 3029, 3102, 3105, 3108, 3110, 3111, 3112, 3114, 3115,
  3116, 3118, 3119, 3126, 3128, 3129, 3207, 3209, 3217, 3218, 3222, 3226, 3227, 3229, 3304, 3307, 3309, 3310, 3312, 3315,
  3316, 3318, 3321, 3323, 3325, 3326, 3401, 3402, 3404, 3405, 3410, 3411, 3413, 3414, 3415, 3417, 3418, 3420, 3422, 3423,
  3425, 3428, 3508, 3523, 3524, 3526, 3613, 3627, 3701, 3703, 3705, 3707, 3709, 3711, 3714, 3716, 3717, 3718, 3719, 3720,
  3722, 3723, 3725, 3727, 3728, 3729, 3730,
]);

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
    if (raw.id < 5000 && EXCLUDED_IDS.has(raw.id)) continue;
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
      difficulty: [1, 2, 3].includes(raw.difficulty) ? raw.difficulty : 2,
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
