import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MoneyRoom from '../rooms/MoneyRoom';
import { hasSeat } from '../rooms/useRoom';
import { inviteCode } from '../rooms/roomUtils';
import { questions as allQuestions, categoryCounts, pickFresh, markSeen, shuffle } from '../questions';
import Timer from '../components/Timer';
import './MoneyBoardPage.css';

// ── Constants ─────────────────────────────────────────────────────────────────
// Every category in the bank with enough questions for a column (generated
// from server/questions*.js, so client and server always agree).
const MIN_PER_CATEGORY = 6;
const VALID_CATEGORIES = categoryCounts
  .filter(([, n]) => n >= MIN_PER_CATEGORY)
  .map(([cat]) => cat);
const POINTS    = [200, 400, 600];
const DIFF_LABEL = ['سهل', 'متوسط', 'صعب'];
const ANSWER_TIME = 30;
const STEAL_TIME  = 15;
export const TEAM_NAMES  = { A: 'الفريق الأول', B: 'الفريق الثاني' };
export const TEAM_COLORS = { A: 'team-a', B: 'team-b' };

// ── Super Powers (matching asbghm.com) ───────────────────────────────────────
export const SUPER_POWERS = [
  { id: 'double', icon: '2x',  name: 'مضاعفة النقاط', desc: 'ضاعف نقاطك إذا أجبت صح' },
  { id: 'two',    icon: '✌️',  name: 'إجابتين',        desc: 'فرصتان للإجابة بدل واحدة' },
  { id: 'hafra',  icon: '🔄',  name: 'الحفرة',          desc: 'أجب صح وانقص نقاط خصمك' },
  { id: 'friend', icon: '📞',  name: 'اتصل بصديق',     desc: '30 ثانية للتشاور مع صديق' },
  { id: 'block',  icon: '🚫',  name: 'بلوك',            desc: 'احجب وسيلة عشوائية من الخصم' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

// Pre-computed question counts per category (used in setup UI)
const CATEGORY_Q_COUNT = Object.fromEntries(categoryCounts);
const freshStats = () => ({ A: { correct: 0, steals: 0 }, B: { correct: 0, steals: 0 } });

/**
 * Builds the board: 3 different questions per category, preferring questions
 * this device hasn't seen recently, with options shuffled (the correct answer
 * is no longer always the first option).
 */
// Each category: 6 questions — 2 × 200 (سهل), 2 × 400 (متوسط), 2 × 600 (صعب).
function buildLocalBoard(selectedCats) {
  const points = [...POINTS, ...POINTS];
  const used = new Set();
  const board = selectedCats.map(cat => {
    const pool = allQuestions.filter(q => q.category === cat);
    const cells = points.map((pts, i) => {
      // row i → difficulty i+1 (200 سهل، 400 متوسط، 600 صعب), falling back to
      // nearby levels, then the whole category, then the whole bank.
      const wanted = (i % 3) + 1;
      const tiers = [
        pool.filter(q => q.difficulty === wanted),
        pool.filter(q => Math.abs(q.difficulty - wanted) === 1),
        pool,
        allQuestions,
      ];
      let q = null;
      for (const tier of tiers) {
        q = pickFresh(tier, 1, used)[0];
        if (q) break;
      }
      if (q) used.add(q.id);
      return { points: pts, question: q || null, answered: false, winner: null };
    });
    return { category: cat, cells };
  });
  markSeen([...used]);
  return board;
}

// ── LOCAL game hook ───────────────────────────────────────────────────────────
function useLocalGame() {
  const [screen, setScreen]         = useState('setup');   // setup | game | question | steal | gameover
  const [teamAName, setTeamAName]   = useState('الفريق الأول');
  const [teamBName, setTeamBName]   = useState('الفريق الثاني');
  const [selected, setSelected]     = useState([]);        // chosen category indices
  const [board, setBoard]           = useState(null);
  const [teams, setTeams]           = useState({ A: { money: 0 }, B: { money: 0 } });
  const [currentTurn, setTurn]      = useState('A');
  const [activeCell, setActiveCell] = useState(null);      // { colIdx, rowIdx }
  const [activeTeam, setActiveTeam] = useState(null);
  const [originalTeam, setOrigTeam] = useState(null);
  const [phase, setPhase]           = useState('pick');    // pick | answer | steal | result
  const [resultInfo, setResultInfo] = useState(null);
  const [timerRunning, setTimer]    = useState(false);
  const [answeredCount, setCount]   = useState(0);
  const [selectedAnswer, setSelAns] = useState(null);
  const [wrongOpts, setWrongOpts]   = useState([]);        // options already tried & wrong this question
  const [attempt, setAttempt]       = useState(0);         // bumps the Timer key so it restarts
  const [stats, setStats]           = useState(freshStats);
  const timeoutRef                  = useRef(null);

  // ── Super Powers state ─────────────────────────────────────────────────
  const [superPowers, setSuperPowers] = useState({
    A: ['double', 'two', 'hafra', 'friend', 'block'],
    B: ['double', 'two', 'hafra', 'friend', 'block'],
  });
  const [eliminatedOpts, setEliminatedOpts] = useState([]); // unused now but kept for safety
  const [friendTimer,    setFriendTimer]     = useState(false); // show timer overlay
  const [isDoubled,      setIsDoubled]       = useState(false); // 2x active
  const [isTwoAnswers,   setIsTwoAnswers]    = useState(false); // إجابتين active
  const [isHafra,        setIsHafra]         = useState(false); // الحفرة active

  const [answerMode, setAnswerMode] = useState('choices'); // 'choices' | 'host'
  const [revealed, setRevealed]     = useState(false);     // host mode: answer shown

  const totalCells = board ? board.reduce((n, col) => n + col.cells.length, 0) : selected.length * 6;

  const randomCategories = () => setSelected(shuffle(VALID_CATEGORIES).slice(0, 6));
  const clearCategories  = () => setSelected([]);

  const toggleCategory = (cat) => {
    setSelected(prev => {
      if (prev.includes(cat)) return prev.filter(c => c !== cat);
      if (prev.length >= 6)   return prev; // max 6
      return [...prev, cat];
    });
  };

  const startGame = () => {
    const b = buildLocalBoard(selected);
    setBoard(b);
    setTeams({ A: { money: 0 }, B: { money: 0 } });
    setTurn('A');
    setActiveCell(null);
    setActiveTeam(null);
    setOrigTeam(null);
    setPhase('pick');
    setResultInfo(null);
    setTimer(false);
    setCount(0);
    setSelAns(null);
    setWrongOpts([]);
    setStats(freshStats());
    setEliminatedOpts([]);
    setFriendTimer(false);
    setIsDoubled(false);
    setIsTwoAnswers(false);
    setIsHafra(false);
    setSuperPowers({ A: ['double', 'two', 'hafra', 'friend', 'block'], B: ['double', 'two', 'hafra', 'friend', 'block'] });
    setScreen('game');
  };

  // Adjust score manually (moderator panel)
  const adjustScore = (team, delta) => {
    setTeams(prev => ({
      ...prev,
      [team]: { money: Math.max(0, (prev[team].money || 0) + delta) },
    }));
  };

  // Activate a super power for the current active team
  const useSuperPower = (powerId) => {
    if (!activeTeam) return;
    const teamPowers = superPowers[activeTeam] || [];
    if (!teamPowers.includes(powerId)) return;
    // Consume the power
    setSuperPowers(prev => ({
      ...prev,
      [activeTeam]: prev[activeTeam].filter(p => p !== powerId),
    }));
    if (powerId === 'double') {
      setIsDoubled(true);
    } else if (powerId === 'two') {
      setIsTwoAnswers(true);
    } else if (powerId === 'hafra') {
      setIsHafra(true);
    } else if (powerId === 'friend') {
      setFriendTimer(true);
    } else if (powerId === 'block') {
      // Remove a random available power from the opponent
      const opponent = activeTeam === 'A' ? 'B' : 'A';
      setSuperPowers(prev => {
        const oppPowers = prev[opponent] || [];
        if (!oppPowers.length) return prev;
        const toRemove = oppPowers[Math.floor(Math.random() * oppPowers.length)];
        return { ...prev, [opponent]: oppPowers.filter(p => p !== toRemove) };
      });
    }
  };

  const pickCell = (colIdx, rowIdx) => {
    if (phase !== 'pick') return;
    const cell = board[colIdx]?.cells[rowIdx];
    if (!cell || cell.answered) return;
    setActiveCell({ colIdx, rowIdx });
    setActiveTeam(currentTurn);
    setOrigTeam(currentTurn);
    setSelAns(null);
    setWrongOpts([]);
    setRevealed(false);
    setAttempt(a => a + 1);
    setPhase('answer');
    setTimer(true);
    setIsDoubled(false);
    setIsTwoAnswers(false);
    setIsHafra(false);
    setEliminatedOpts([]);
    setFriendTimer(false);
    setScreen('question');
  };

  const submitAnswer = (answerIdx) => {
    if (phase !== 'answer' && phase !== 'steal') return;
    setTimer(false);
    setSelAns(answerIdx);
    const { colIdx, rowIdx } = activeCell;
    const cell = board[colIdx].cells[rowIdx];
    const isCorrect = cell.question.options[answerIdx] === cell.question.answer;
    _resolveAnswer(isCorrect, cell, answerIdx);
  };

  const timeUp = useCallback(() => {
    if (phase !== 'answer' && phase !== 'steal') return;
    setTimer(false);
    if (answerMode === 'host') return; // the host still decides who answered
    const { colIdx, rowIdx } = activeCell;
    const cell = board[colIdx].cells[rowIdx];
    _resolveAnswer(false, cell);
  }, [phase, activeCell, board, answerMode]); // eslint-disable-line

  function _resolveAnswer(isCorrect, cell, answerIdx = null) {
    clearTimeout(timeoutRef.current);
    const markWrong = () => { if (answerIdx !== null) setWrongOpts(w => [...w, answerIdx]); };
    const resetPowers = () => { setIsDoubled(false); setIsTwoAnswers(false); setIsHafra(false); setEliminatedOpts([]); setFriendTimer(false); };
    const clearAndReturn = () => { setScreen('game'); setPhase('pick'); setActiveCell(null); setResultInfo(null); setSelAns(null); resetPowers(); };

    if (isCorrect) {
      const winner  = activeTeam;
      const earned  = isDoubled ? cell.points * 2 : cell.points;
      const opponent = winner === 'A' ? 'B' : 'A';
      // الحفرة: also deduct from opponent
      const oppDeduct = isHafra ? cell.points : 0;
      const newTeams = {
        A: { money: Math.max(0, teams.A.money + (winner === 'A' ? earned : -oppDeduct)) },
        B: { money: Math.max(0, teams.B.money + (winner === 'B' ? earned : -oppDeduct)) },
      };
      const newBoard = board.map((col, ci) => ({
        ...col,
        cells: col.cells.map((c, ri) =>
          ci === activeCell.colIdx && ri === activeCell.rowIdx
            ? { ...c, answered: true, winner }
            : c
        ),
      }));
      const newCount = answeredCount + 1;
      setTeams(newTeams);
      setBoard(newBoard);
      setCount(newCount);
      setStats(prev => ({
        ...prev,
        [winner]: {
          correct: prev[winner].correct + 1,
          steals: prev[winner].steals + (phase === 'steal' ? 1 : 0),
        },
      }));
      setResultInfo({ isCorrect: true, winner, points: earned, hafra: isHafra && oppDeduct > 0, hafraPoints: oppDeduct, correctAnswer: cell.question?.answer, teams: newTeams });
      setPhase('result');
      setTurn(winner);
      resetPowers();
      if (newCount >= totalCells) {
        timeoutRef.current = setTimeout(() => setScreen('gameover'), 2200);
      } else {
        timeoutRef.current = setTimeout(clearAndReturn, 2200);
      }
    } else {
      if (phase === 'answer' && isTwoAnswers) {
        // إجابتين: first wrong → give another try (no steal)
        setIsTwoAnswers(false); // consume the two-answers bonus
        markWrong();
        setSelAns(null);
        setAttempt(a => a + 1);
        setTimer(true);
        // stay on question screen in answer phase
      } else if (phase === 'answer') {
        // Offer steal to opponent
        const stealTeam = activeTeam === 'A' ? 'B' : 'A';
        setActiveTeam(stealTeam);
        setPhase('steal');
        markWrong();          // the stealing team sees which option was already wrong
        setSelAns(null);
        setAttempt(a => a + 1);
        setTimer(true);
        setIsDoubled(false);
        setIsHafra(false);
        setScreen('question');
      } else {
        // Steal also wrong — no one wins
        const newBoard = board.map((col, ci) => ({
          ...col,
          cells: col.cells.map((c, ri) =>
            ci === activeCell.colIdx && ri === activeCell.rowIdx
              ? { ...c, answered: true, winner: null }
              : c
          ),
        }));
        const newCount = answeredCount + 1;
        setBoard(newBoard);
        setCount(newCount);
        markWrong();
        setResultInfo({ isCorrect: false, winner: null, points: 0, correctAnswer: cell.question?.answer, teams });
        setPhase('result');
        setTurn(originalTeam);
        resetPowers();
        if (newCount >= totalCells) {
          timeoutRef.current = setTimeout(() => setScreen('gameover'), 2200);
        } else {
          timeoutRef.current = setTimeout(clearAndReturn, 2200);
        }
      }
    }
  }

  // ── Host mode: the host reveals the answer and says who got it ──────────
  const revealAnswer = () => { setTimer(false); setRevealed(true); };

  const judge = (winner) => {           // winner: 'A' | 'B' | null
    if (phase !== 'answer' || !activeCell) return;
    clearTimeout(timeoutRef.current);
    setTimer(false);
    setRevealed(true);
    const cell = board[activeCell.colIdx].cells[activeCell.rowIdx];
    const picker = originalTeam;
    const powersApply = winner && winner === picker;
    const earned = winner ? (powersApply && isDoubled ? cell.points * 2 : cell.points) : 0;
    const oppDeduct = powersApply && isHafra ? cell.points : 0;
    const newTeams = {
      A: { money: Math.max(0, teams.A.money + (winner === 'A' ? earned : 0) - (winner === 'B' ? oppDeduct : 0)) },
      B: { money: Math.max(0, teams.B.money + (winner === 'B' ? earned : 0) - (winner === 'A' ? oppDeduct : 0)) },
    };
    const newBoard = board.map((col, ci) => ({
      ...col,
      cells: col.cells.map((c, ri) =>
        ci === activeCell.colIdx && ri === activeCell.rowIdx ? { ...c, answered: true, winner } : c),
    }));
    const newCount = answeredCount + 1;
    setTeams(newTeams);
    setBoard(newBoard);
    setCount(newCount);
    if (winner) {
      setStats(prev => ({
        ...prev,
        [winner]: { correct: prev[winner].correct + 1, steals: prev[winner].steals + (winner !== picker ? 1 : 0) },
      }));
    }
    setResultInfo({ isCorrect: !!winner, winner, points: earned, hafra: oppDeduct > 0, hafraPoints: oppDeduct, correctAnswer: cell.question?.answer, teams: newTeams });
    setPhase('result');
    setTurn(picker === 'A' ? 'B' : 'A');  // turns alternate in host mode
    setIsDoubled(false); setIsTwoAnswers(false); setIsHafra(false); setFriendTimer(false);
    timeoutRef.current = setTimeout(() => {
      if (newCount >= totalCells) { setScreen('gameover'); return; }
      setScreen('game'); setPhase('pick'); setActiveCell(null); setResultInfo(null); setRevealed(false);
    }, 2000);
  };

  // Cleanup on unmount
  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const reset = () => {
    clearTimeout(timeoutRef.current);
    setScreen('setup');
    setSelected([]);
    setBoard(null);
    setTeams({ A: { money: 0 }, B: { money: 0 } });
    setPhase('pick');
    setActiveCell(null);
    setActiveTeam(null);
    setOrigTeam(null);
    setResultInfo(null);
    setTimer(false);
    setCount(0);
    setSelAns(null);
    setWrongOpts([]);
  };

  const currentQuestion = activeCell && board
    ? board[activeCell.colIdx]?.cells[activeCell.rowIdx]?.question
    : null;
  const currentPoints = activeCell && board
    ? board[activeCell.colIdx]?.cells[activeCell.rowIdx]?.points
    : 0;

  return {
    screen, teamAName, setTeamAName, teamBName, setTeamBName,
    selected, toggleCategory, startGame, randomCategories, clearCategories,
    wrongOpts, attempt, stats,
    answerMode, setAnswerMode, revealed, revealAnswer, judge, originalTeam,
    board, teams, currentTurn, activeTeam, phase,
    activeCell, pickCell, currentQuestion, currentPoints,
    submitAnswer, timeUp, timerRunning, selectedAnswer,
    resultInfo, reset, answeredCount, totalCells,
    // Super powers
    superPowers, useSuperPower, eliminatedOpts,
    friendTimer, setFriendTimer, isDoubled, isTwoAnswers, isHafra,
    // Moderator
    adjustScore,
  };
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MoneyBoardPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState(() => (inviteCode() || hasSeat('money') ? 'room' : null)); // null | 'local' | 'room'
  const [modOpen, setModOpen] = useState(false); // moderator panel
  const local = useLocalGame();

  if (mode === 'room') return <MoneyRoom onExit={() => setMode(null)} />;

  // ── Mode selector ─────────────────────────────────────────────────────────
  if (!mode) return (
    <div className="page mb-setup">
      <button className="back-btn" onClick={() => navigate('/')}>← العودة</button>
      <div className="mb-stage-card pop-in">
        <div className="mb-marquee">
          <span className="mb-marquee-kicker">مسابقة الفريقين</span>
          <h1 className="mb-logo">لوحة <span>المال</span></h1>
          <div className="mb-logo-coins" aria-hidden="true"><i>200</i><i>400</i><i>600</i></div>
        </div>
        <p className="mb-tagline">٦ فئات · ٣٦ سؤالاً · كل ما ارتفع المبلغ صعب السؤال</p>
        <div className="mb-mode-tiles">
          <button className="mb-mode-tile primary" onClick={() => setMode('local')}>
            <span className="mb-mode-title">لعب محلي</span>
            <span className="mb-mode-sub">شاشة واحدة للجميع — بدون إنترنت</span>
          </button>
          <button className="mb-mode-tile" onClick={() => setMode('room')}>
            <span className="mb-mode-title">غرفة أونلاين</span>
            <span className="mb-mode-sub">كل لاعب على جهازه — يتطلب خادماً</span>
          </button>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // LOCAL MODE
  // ══════════════════════════════════════════════════════════════════════════
  if (mode === 'local') {
    // ── Setup ──
    if (local.screen === 'setup') return (
      <div className="page mb-setup">
        <button className="back-btn" onClick={() => setMode(null)}>← العودة</button>
        <div className="mb-stage-card mb-setup-card pop-in">
          <div className="mb-marquee">
            <span className="mb-marquee-kicker">مسابقة الفريقين</span>
            <h1 className="mb-logo">لوحة <span>المال</span></h1>
            <div className="mb-logo-coins" aria-hidden="true"><i>200</i><i>400</i><i>600</i></div>
          </div>

          <div className="team-names-row">
            <div className="team-name-field team-a-field">
              <label>{TEAM_NAMES.A}</label>
              <input className="input-field" value={local.teamAName} onChange={e => local.setTeamAName(e.target.value)} maxLength={20} />
            </div>
            <span className="mb-vs">ضد</span>
            <div className="team-name-field team-b-field">
              <label>{TEAM_NAMES.B}</label>
              <input className="input-field" value={local.teamBName} onChange={e => local.setTeamBName(e.target.value)} maxLength={20} />
            </div>
          </div>

          <div className="mb-options">
            <div className="mb-option-group">
              <span className="mb-option-label">طريقة الإجابة</span>
              <div className="mb-seg">
                <button className={local.answerMode === 'choices' ? 'on' : ''} onClick={() => local.setAnswerMode('choices')}>اختيارات</button>
                <button className={local.answerMode === 'host' ? 'on' : ''} onClick={() => local.setAnswerMode('host')}>المقدّم يحكم</button>
              </div>
            </div>
            <p className="mb-option-hint">
              {local.answerMode === 'host'
                ? 'الفريق يجاوب بصوته، والمقدّم يظهر الإجابة ويحدد من جاوب صح.'
                : 'أربعة اختيارات على الشاشة؛ الخطأ يعطي الفريق الآخر فرصة سرقة.'}
            </p>
          </div>

          <div className="cat-select-section">
            <div className="cat-select-head">
              <h3>اختر ٦ فئات <span className="cat-count">{local.selected.length}/6</span></h3>
              <div className="cat-quick-btns">
                <button className="cat-quick-btn" onClick={local.randomCategories}>🎲 عشوائي</button>
                {local.selected.length > 0 && (
                  <button className="cat-quick-btn" onClick={local.clearCategories}>✕ مسح</button>
                )}
              </div>
            </div>
            <div className="cat-grid">
              {VALID_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  className={`cat-chip ${local.selected.includes(cat) ? 'selected' : ''} ${CATEGORY_Q_COUNT[cat] < 3 ? 'cat-chip-low' : ''}`}
                  onClick={() => local.toggleCategory(cat)}
                  disabled={!local.selected.includes(cat) && local.selected.length >= 6}
                >
                  <span className="cat-name">{cat}</span>
                  <span className="cat-q-badge">{CATEGORY_Q_COUNT[cat]} سؤال</span>
                  {local.selected.includes(cat) && <span className="cat-num">{local.selected.indexOf(cat) + 1}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-start-bar">
            <div className="mb-slots">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <span key={i} className={`mb-slot ${local.selected[i] ? 'filled' : ''}`}>{local.selected[i] || i + 1}</span>
              ))}
            </div>
            <button
              className="mb-start-btn start-btn-inline"
              onClick={local.startGame}
              disabled={local.selected.length !== 6}
            >
              {local.selected.length < 6 ? `اختر ${6 - local.selected.length} فئات أخرى` : 'ابدأ اللعبة'}
            </button>
          </div>
        </div>
      </div>
    );

    // ── Game board ──
    if (local.screen === 'game') return (
      <div className="mb-game-page">
        <MoneyBoardHeader
          teams={{ A: { ...local.teams.A, name: local.teamAName }, B: { ...local.teams.B, name: local.teamBName } }}
          currentTurn={local.currentTurn}
          phase={local.phase}
        />
        <BoardGrid
          board={local.board}
          activeCell={local.activeCell}
          onPickCell={local.pickCell}
          canPick={local.phase === 'pick'}
          currentTurn={local.currentTurn}
        />
        {local.resultInfo && (
          <ResultFlash info={local.resultInfo} teamNames={{ A: local.teamAName, B: local.teamBName }} />
        )}
        {/* Moderator panel trigger */}
        <button className="mod-panel-btn" onClick={() => setModOpen(true)} title="لوحة المشرف">
          ⚙️
        </button>
        {modOpen && (
          <ModeratorPanel
            teams={{ A: { ...local.teams.A, name: local.teamAName }, B: { ...local.teams.B, name: local.teamBName } }}
            onAdjust={local.adjustScore}
            onClose={() => setModOpen(false)}
          />
        )}
      </div>
    );

    // ── Question screen ──
    if (local.screen === 'question') {
      const isSteal    = local.phase === 'steal';
      const teamKey    = local.activeTeam || 'A';
      const teamName   = teamKey === 'A' ? local.teamAName : local.teamBName;
      const catName    = local.activeCell ? local.board?.[local.activeCell.colIdx]?.category : '';
      const teamPowers = local.superPowers?.[teamKey] || [];
      const opts       = local.currentQuestion?.options || [];
      return (
        <div className="mb-question-page">
          <div className="q-page-header">
            <MoneyScores teams={{ A: { ...local.teams.A, name: local.teamAName }, B: { ...local.teams.B, name: local.teamBName } }} />
            <div className={`points-badge ${isSteal ? 'steal-badge' : ''}`}>
              {isSteal ? `سرقة — ${teamName}` : <>{local.currentPoints}<small>ريال</small></>}
            </div>
            <Timer
              duration={isSteal ? STEAL_TIME : ANSWER_TIME}
              running={local.timerRunning}
              onEnd={local.timeUp}
              key={`t${local.attempt}`}
            />
          </div>

          {isSteal && (
            <div className="steal-banner pop-in">فرصة السرقة — {teamName}</div>
          )}

          {/* Active power indicators */}
          {(local.isDoubled || local.isTwoAnswers || local.isHafra) && (
            <div className="active-powers-bar pop-in">
              {local.isDoubled   && <span className="active-power-tag double-tag">2x مضاعفة النقاط</span>}
              {local.isTwoAnswers && <span className="active-power-tag two-tag">✌️ إجابتين</span>}
              {local.isHafra    && <span className="active-power-tag hafra-tag">🔄 الحفرة مفعّلة</span>}
            </div>
          )}

          {/* Super Powers bar */}
          {!isSteal && (
            <div className="super-powers-bar">
              <span className="sp-label">قوى {teamName}:</span>
              {SUPER_POWERS.map(sp => {
                const available = teamPowers.includes(sp.id);
                const alreadyActive =
                  (sp.id === 'double' && local.isDoubled) ||
                  (sp.id === 'two'    && local.isTwoAnswers) ||
                  (sp.id === 'hafra'  && local.isHafra);
                return (
                  <button key={sp.id}
                    className={`sp-btn sp-${sp.id} ${!available ? 'sp-used' : ''} ${alreadyActive ? 'sp-active' : ''}`}
                    title={sp.name + ' — ' + sp.desc}
                    onClick={() => available && !alreadyActive && local.selectedAnswer === null && local.useSuperPower(sp.id)}
                    disabled={!available || alreadyActive || local.selectedAnswer !== null}>
                    <span className="sp-icon">{sp.icon}</span>
                    <span className="sp-name">{sp.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Call-a-Friend overlay timer */}
          {local.friendTimer && (
            <div className="friend-timer-banner pop-in">
              📞 وقت الاتصال بصديق
              <Timer duration={30} running={true} onEnd={() => local.setFriendTimer(false)} key="friend" />
            </div>
          )}

          <div className="question-card card pop-in">
            {catName && <p className="question-category-tag">{catName} · <b>{local.activeCell ? local.board[local.activeCell.colIdx].cells[local.activeCell.rowIdx].points : ''} ريال</b></p>}
            <p className="question-text">{local.currentQuestion?.text}</p>
          </div>

          {local.answerMode === 'host' ? (
            <div className="host-panel">
              {!local.revealed ? (
                <button className="btn-gold host-reveal-btn" onClick={local.revealAnswer}>إظهار الإجابة</button>
              ) : (
                <>
                  <div className="host-answer pop-in">
                    <span className="host-answer-label">الإجابة</span>
                    <strong>{local.currentQuestion?.answer}</strong>
                  </div>
                  {local.phase === 'answer' && (
                    <div className="host-judge">
                      <span className="host-judge-label">مين جاوب صح؟</span>
                      <div className="host-judge-btns">
                        <button className="judge-btn judge-a" onClick={() => local.judge('A')}>{local.teamAName}</button>
                        <button className="judge-btn judge-b" onClick={() => local.judge('B')}>{local.teamBName}</button>
                        <button className="judge-btn judge-none" onClick={() => local.judge(null)}>ولا أحد</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
          <div className="options-grid">
            {opts.map((opt, i) => {
              const revealed = local.phase === 'result';
              const isRight  = opt === local.currentQuestion?.answer;
              const tried    = local.wrongOpts.includes(i);
              const cls = revealed
                ? (isRight ? 'opt-correct' : (local.selectedAnswer === i || tried) ? 'opt-wrong' : 'opt-dim')
                : tried ? 'opt-wrong opt-eliminated'
                : local.selectedAnswer === i ? 'answered' : '';
              return (
                <button key={i}
                  className={`option-btn ${cls}`}
                  onClick={() => local.submitAnswer(i)}
                  disabled={local.selectedAnswer !== null || tried || revealed}>
                  <span className="opt-key">{OPT_KEYS[i]}</span>
                  <span className="opt-text">{opt}</span>
                </button>
              );
            })}
          </div>
          )}

          {local.resultInfo && (
            <ResultFlash info={local.resultInfo} teamNames={{ A: local.teamAName, B: local.teamBName }} />
          )}
        </div>
      );
    }

    // ── Game over ──
    if (local.screen === 'gameover') {
      const aM = local.teams.A.money, bM = local.teams.B.money;
      const winner = aM > bM ? 'A' : bM > aM ? 'B' : null;
      return (
        <GameOverScreen
          teams={{ A: { ...local.teams.A, name: local.teamAName }, B: { ...local.teams.B, name: local.teamBName } }}
          winner={winner}
          isTie={winner === null}
          stats={local.stats}
          onReset={local.reset}
          onHome={() => navigate('/')}
        />
      );
    }
  }

  return null;
}

export const OPT_KEYS = ['أ', 'ب', 'ج', 'د'];

// ── Sub-components ────────────────────────────────────────────────────────────

export function MoneyBoardHeader({ teams, currentTurn, phase, myTeam }) {
  const pickingName = teams[currentTurn]?.name;
  const pillText = phase === 'pick'
    ? <>دور <b>{pickingName}</b> — اختر سؤالاً</>
    : phase === 'wait'
      ? <>انتظار <b>{pickingName}</b>…</>
      : <b>{pickingName}</b>;
  return (
    <div className="mb-header">
      <div className="mb-header-logo">لوحة <span>المال</span></div>
      <MoneyScores teams={teams} currentTurn={currentTurn} myTeam={myTeam} />
      <div className={`turn-pill ${TEAM_COLORS[currentTurn]}`}><i className="turn-dot" />{pillText}</div>
    </div>
  );
}

export function MoneyScores({ teams, currentTurn, myTeam }) {
  return (
    <div className="money-scores">
      {['A', 'B'].map(t => (
        <div key={t} className={`money-score-box ${TEAM_COLORS[t]} ${currentTurn === t ? 'active-turn' : ''} ${myTeam === t ? 'my-team' : ''}`}>
          <span className="score-team-name">{teams[t]?.name}</span>
          <span className="score-money">
            {(teams[t]?.money || 0).toLocaleString('en-US')}
            <small>ريال</small>
          </span>
        </div>
      ))}
    </div>
  );
}

export function BoardGrid({ board, activeCell, onPickCell, canPick, currentTurn }) {
  if (!board) return null;
  return (
    <div className="mb-board-frame">
    <div className="mb-board">
      {/* Category headers */}
      <div className="mb-board-row mb-headers">
        {board.map((col, ci) => (
          <div key={ci} className="mb-header-cell">{col.category}</div>
        ))}
      </div>
      {/* 3 rows: 200 / 400 / 600 — with 6 questions per category each slot holds two cells */}
      {[0, 1, 2].map(rowIdx => (
        <div key={rowIdx} className="mb-board-row">
          {board.map((col, colIdx) => {
            const idxs = col.cells.length === 6 ? [rowIdx, rowIdx + 3] : [rowIdx];
            const buttons = idxs.map(ri => {
              const cell = col.cells[ri];
              const isActive = activeCell?.colIdx === colIdx && activeCell?.rowIdx === ri;
              return (
                <button
                  key={ri}
                  className={`mb-cell ${cell.answered ? `answered winner-${cell.winner || 'none'}` : ''} ${isActive ? 'active-cell' : ''} ${canPick && !cell.answered ? 'pickable' : ''}`}
                  onClick={() => !cell.answered && canPick && onPickCell(colIdx, ri)}
                  disabled={cell.answered || !canPick}
                >
                  {cell.answered ? (
                    <span className="cell-claimed">{cell.points}</span>
                  ) : (
                    <>
                      <span className="cell-points">{cell.points}</span>
                      <span className="cell-riyal">ريال</span>
                    </>
                  )}
                </button>
              );
            });
            return idxs.length === 2
              ? <div key={colIdx} className="mb-cell-pair">{buttons}</div>
              : buttons[0];
          })}
        </div>
      ))}
    </div>
    </div>
  );
}

export function ResultFlash({ info, teamNames }) {
  const winnerName = info.winner ? teamNames[info.winner] : null;
  return (
    <div className={`result-flash pop-in ${info.isCorrect ? 'correct' : 'wrong'}`}>
      {info.isCorrect
        ? <>✅ {winnerName} — +{info.points.toLocaleString('en-US')} ريال{info.hafra ? ` 🔄 −${info.hafraPoints} من الخصم` : ''}</>
        : info.correctAnswer
          ? `❌ إجابة خاطئة — الصواب: ${info.correctAnswer}`
          : '❌ إجابة خاطئة'
      }
    </div>
  );
}

// ── Moderator Panel ────────────────────────────────────────────────────────────
export function ModeratorPanel({ teams, onAdjust, onClose }) {
  const [customA, setCustomA] = useState('');
  const [customB, setCustomB] = useState('');
  const QUICK = [100, 200, 400, 600];
  return (
    <div className="mod-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mod-panel card pop-in">
        <div className="mod-header">
          <h3>⚙️ لوحة المشرف</h3>
          <button className="mod-close" onClick={onClose}>✕</button>
        </div>
        {['A', 'B'].map(t => (
          <div key={t} className={`mod-team-section mod-team-${t.toLowerCase()}`}>
            <div className="mod-team-name">{teams[t]?.name}</div>
            <div className="mod-money">💰 {(teams[t]?.money || 0).toLocaleString('en-US')} ريال</div>
            <div className="mod-btns">
              {QUICK.map(v => (
                <button key={v} className="mod-add-btn" onClick={() => onAdjust(t, v)}>+{v}</button>
              ))}
            </div>
            <div className="mod-btns">
              {QUICK.map(v => (
                <button key={v} className="mod-sub-btn" onClick={() => onAdjust(t, -v)}>−{v}</button>
              ))}
            </div>
            <div className="mod-custom-row">
              <input
                type="number" min="0" step="100"
                placeholder="مبلغ مخصص"
                value={t === 'A' ? customA : customB}
                onChange={e => t === 'A' ? setCustomA(e.target.value) : setCustomB(e.target.value)}
                className="input-field mod-custom-input"
              />
              <button className="mod-add-btn"
                onClick={() => { const v = parseInt(t === 'A' ? customA : customB) || 0; onAdjust(t, v); }}>
                أضف +
              </button>
              <button className="mod-sub-btn"
                onClick={() => { const v = parseInt(t === 'A' ? customA : customB) || 0; onAdjust(t, -v); }}>
                اخصم −
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GameOverScreen({ teams, winner, isTie, myTeam, stats, onReset, onHome }) {
  const aM = teams.A.money, bM = teams.B.money;
  const winnerName = winner ? teams[winner]?.name : null;
  const isMyTeamWin = myTeam && myTeam === winner;
  return (
    <div className="page mb-gameover">
      <div className="gameover-hero pop-in">
        <div className="gameover-trophy">{isTie ? '🤝' : isMyTeamWin ? '🏆' : '🎮'}</div>
        {isTie ? <h1>تعادل!</h1> : <h1>فاز {winnerName}!</h1>}
      </div>
      <div className="final-money-table card">
        {['A', 'B'].map(t => (
          <div key={t} className={`final-row ${TEAM_COLORS[t]} ${winner === t ? 'winner-row' : ''}`}>
            <span className="final-team-name">{teams[t]?.name}</span>
            <span className="final-money">💰 {(teams[t]?.money || 0).toLocaleString('en-US')} ريال</span>
            {winner === t && <span className="final-crown">👑</span>}
            {stats && (
              <span className="final-stats">
                ✅ {stats[t].correct} إجابة صحيحة{stats[t].steals ? ` · ⚡ ${stats[t].steals} سرقة` : ''}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="gameover-actions">
        {onReset && <button className="btn-secondary" onClick={onReset}>العب مجدداً</button>}
        <button className="btn-primary" onClick={onHome}>الرئيسية</button>
      </div>
    </div>
  );
}
