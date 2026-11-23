import { useNavigate } from 'react-router-dom';
import './Home.css';

// Small drawings instead of emoji — one per game, in the game's accent colour.
function BuzzerArt() {
  return (
    <svg viewBox="0 0 120 80" className="home-art" aria-hidden="true">
      <rect x="22" y="56" width="76" height="12" rx="6" fill="currentColor" opacity="0.15" />
      <path d="M32 56a28 22 0 0 1 56 0z" fill="currentColor" />
      <ellipse cx="50" cy="40" rx="8" ry="4" fill="#fff" opacity="0.45" />
      <path d="M96 18l8-8M100 30h10M90 10l2-9" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
function HexArt() {
  const hex = (x, y, fill, letter, ink) => (
    <g key={letter} transform={`translate(${x} ${y})`}>
      <path d="M0 -17 L15 -8.5 L15 8.5 L0 17 L-15 8.5 L-15 -8.5 Z" fill={fill} />
      <text y="6" textAnchor="middle" fontSize="15" fontWeight="900" fill={ink} fontFamily="Tajawal">{letter}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 120 80" className="home-art" aria-hidden="true">
      {hex(30, 26, 'currentColor', 'ح', '#fff')}
      {hex(61, 26, '#ea6a12', 'ر', '#fff')}
      {hex(92, 26, 'var(--surface3)', 'و', '#6f6b74')}
      {hex(45.5, 53, 'var(--surface3)', 'ف', '#6f6b74')}
      {hex(76.5, 53, 'currentColor', 'ب', '#fff')}
    </svg>
  );
}
function BoardArt() {
  const cells = [];
  [200, 400, 600].forEach((v, r) => [0, 1, 2].forEach(c => cells.push(
    <g key={`${r}${c}`}>
      <rect x={14 + c * 32} y={6 + r * 24} width="28" height="20" rx="4" fill={r === 1 && c === 1 ? 'var(--surface3)' : '#25307f'} />
      {!(r === 1 && c === 1) && <text x={28 + c * 32} y={20 + r * 24} textAnchor="middle" fontSize="9" fontWeight="900" fill="#f0c040" fontFamily="Tajawal">{v}</text>}
    </g>,
  )));
  return <svg viewBox="0 0 120 80" className="home-art" aria-hidden="true">{cells}</svg>;
}

const GAMES = [
  {
    path: '/asbiqhum', cls: 'g-asbiq', title: 'اسبقهم', art: <BuzzerArt />,
    desc: 'سؤال على الشاشة، وأسرع واحد يضغط الجرس يجاوب. كل ما كنت أسرع زادت نقاطك.',
    meta: ['٢–٨ لاعبين', 'فردي'],
  },
  {
    path: '/huroof', cls: 'g-huroof', title: 'حروف', art: <HexArt />,
    desc: 'شبكة حروف، وكل جواب يبدأ بحرف الخلية. أول فريق يوصل طرفي الشبكة يفوز.',
    meta: ['فريقان أو أكثر', 'استراتيجية'],
  },
  {
    path: '/moneyboard', cls: 'g-money', title: 'لوحة المال', art: <BoardArt />,
    desc: 'ست فئات وستة وثلاثون سؤالاً من ٢٠٠ إلى ٦٠٠ ريال. كل ما زاد المبلغ صعب السؤال.',
    meta: ['فريقان', '٤٬٩٠٠+ سؤال'],
  },
];

export default function Home() {
  const navigate = useNavigate();
  return (
    <div className="home-page">
      <header className="home-bar">
        <span className="home-brand">ألعاب التجمعات</span>
      </header>

      <section className="home-hero">
        <h1>العب مع أهلك وربعك</h1>
        <p>ثلاث ألعاب أسئلة جماعية بالعربي — على جهاز واحد، أو كل واحد من جواله.</p>
      </section>

      <div className="games-grid">
        {GAMES.map(g => (
          <button key={g.path} className={`game-card ${g.cls}`} onClick={() => navigate(g.path)}>
            <div className="game-card-art">{g.art}</div>
            <div className="game-card-body">
              <h2>{g.title}</h2>
              <p>{g.desc}</p>
              <div className="game-card-meta">
                {g.meta.map(m => <span key={m}>{m}</span>)}
              </div>
            </div>
            <span className="game-card-go">العب ←</span>
          </button>
        ))}
      </div>

      <footer className="home-footer">بدون تسجيل · يعمل على الجوال والتلفزيون</footer>
    </div>
  );
}
