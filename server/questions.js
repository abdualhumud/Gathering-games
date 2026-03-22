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

const questions = [
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
];

// Arabic letters for Huroof game grid
const arabicLetters = [
  "أ", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر",
  "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف",
  "ق", "ك", "ل", "م", "ن", "ه", "و", "ي"
];

function getRandomQuestions(count = 10) {
  const shuffled = [...questions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function getQuestionsByLetter(letter) {
  return questions.filter(q => q.letter === letter);
}

function getRandomQuestion() {
  return questions[Math.floor(Math.random() * questions.length)];
}

function getRandomLetters(count) {
  const shuffled = [...arabicLetters].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

module.exports = { questions, arabicLetters, getRandomQuestions, getQuestionsByLetter, getRandomQuestion, getRandomLetters };
