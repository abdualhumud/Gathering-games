import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getQuestionsByLetter, getRandomQuestion } from '../questions';
import Timer from '../components/Timer';
import HUROOF_THEMES, {
  getSavedTheme, saveTheme, buildCustomTheme, applyThemeCSS,
} from '../data/huroof-themes';
import './HuroofPage.css';

// ── Constants ──────────────────────────────────────────────────────────────────
const BUZZER_TIME = 8;   // seconds before buzzer window closes (no winner)
const ANSWER_TIME = 30;  // seconds to answer after buzzing in
const STEAL_TIME  = 15;  // seconds per steal attempt
const PRE_Q_DELAY = 1800; // ms to show active hex before buzzer opens

const ARABIC_LETTERS = [
  'ا','ب','ت','ث','ج','ح','خ','د','ذ','ر',
  'ز','س','ش','ص','ض','ط','ظ','ع','غ','ف',
  'ق','ك','ل','م','ن','ه','و','ي',
];

// 19-hex honeycomb: 5 rows [3, 4, 5, 4, 3]
// Row 0: indices 0-2   Row 1: 3-6   Row 2: 7-11   Row 3: 12-15   Row 4: 16-18
const HEX_ROWS    = [3, 4, 5, 4, 3];
const TOTAL_HEXES = 19;
const CENTER_IDX  = 9; // row 2, col 2

// Pre-computed adjacency (pointy-top hexes, same-row flat edges + inter-row)
const HEX_ADJ = {
  0:  [1, 3, 4],
  1:  [0, 2, 4, 5],
  2:  [1, 5, 6],
  3:  [0, 4, 7, 8],
  4:  [0, 1, 3, 5, 8, 9],
  5:  [1, 2, 4, 6, 9, 10],
  6:  [2, 5, 10, 11],
  7:  [3, 8, 12],
  8:  [3, 4, 7, 9, 12, 13],
  9:  [4, 5, 8, 10, 13, 14],  // CENTER
  10: [5, 6, 9, 11, 14, 15],
  11: [6, 10, 15],
  12: [7, 8, 13, 16],
  13: [8, 9, 12, 14, 16, 17],
  14: [9, 10, 13, 15, 17, 18],
  15: [10, 11, 14, 18],
  16: [12, 13, 17],
  17: [13, 14, 16, 18],
  18: [14, 15, 17],
};

const DEFAULT_TEAM_COLORS = ['#22c55e','#f97316','#3b82f6','#a855f7','#ef4444','#eab308'];
const DEFAULT_TEAM_NAMES  = [
  'الفريق الأخضر','الفريق البرتقالي','الفريق الأزرق',
  'الفريق البنفسجي','الفريق الأحمر','الفريق الذهبي',
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function buildHexGrid() {
  const pool = [...ARABIC_LETTERS].sort(() => Math.random() - 0.5);
  return Array.from({ length: TOTAL_HEXES }, (_, i) => ({
    index: i,
    letter: pool[i % pool.length],
    owner: null, // null | teamIndex
  }));
}

function getOwnedByTeam(hexGrid, teamIdx) {
  return hexGrid.filter(h => h.owner === teamIdx).map(h => h.index);
}

function getSelectableForTeam(hexGrid, teamIdx, isFirstRound) {
  if (isFirstRound) return [CENTER_IDX];
  const owned = new Set(getOwnedByTeam(hexGrid, teamIdx));
  if (owned.size === 0) {
    // No hexes owned yet — pick any unowned hex adjacent to center (or any unowned)
    return hexGrid.filter(h => h.owner === null).map(h => h.index);
  }
  const adj = new Set();
  for (const idx of owned) {
    for (const n of HEX_ADJ[idx] ?? []) {
      if (hexGrid[n].owner === null) adj.add(n);
    }
  }
  if (adj.size > 0) return [...adj];
  // Fallback: any unowned hex
  return hexGrid.filter(h => h.owner === null).map(h => h.index);
}

function makeRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Setup sub-component ────────────────────────────────────────────────────────
function SetupScreen({ onStart, navigate }) {
  const [numTeams, setNumTeams]   = useState(2);
  const [teamNames, setTeamNames] = useState([...DEFAULT_TEAM_NAMES]);
  const [teamColors, setTeamColors] = useState([...DEFAULT_TEAM_COLORS]);
  const [themeId, setThemeId]     = useState(() => getSavedTheme().id || 'classic');
  const [customA, setCustomA]     = useState('#22c55e');
  const [customB, setCustomB]     = useState('#f97316');

  useEffect(() => {
    if (themeId !== 'custom') {
      const t = HUROOF_THEMES[themeId];
      if (t) applyThemeCSS(t);
    } else {
      applyThemeCSS(buildCustomTheme(customA, customB));
    }
  }, [themeId, customA, customB]);

  const handleStart = () => {
    const teams = Array.from({ length: numTeams }, (_, i) => ({
      name:  teamNames[i] || DEFAULT_TEAM_NAMES[i],
      color: teamColors[i] || DEFAULT_TEAM_COLORS[i],
      score: 0,
    }));
    onStart(teams);
  };

  return (
    <div className="page huroof-setup">
      <button className="back-btn" onClick={() => navigate('/')}>← العودة</button>
      <div className="setup-card card pop-in">
        <div className="setup-icon">⬡</div>
        <h1>لعبة الحروف</h1>
        <p className="setup-desc">
          تنافس على احتلال خلايا شبكة الحروف — الفريق الأسرع في الضغط يجيب أولاً
        </p>

        {/* Number of teams */}
        <div className="grid-size-select">
          <label>عدد الفرق:</label>
          <div className="size-btns">
            {[2, 3, 4].map(n => (
              <button
                key={n}
                className={`size-btn ${numTeams === n ? 'selected' : ''}`}
                onClick={() => setNumTeams(n)}
              >
                {n} فرق
              </button>
            ))}
          </div>
        </div>

        {/* Team names + colors */}
        <div className="huroof-teams-config">
          {Array.from({ length: numTeams }, (_, i) => (
            <div key={i} className="huroof-team-row">
              <input
                type="color"
                value={teamColors[i]}
                onChange={e => {
                  const next = [...teamColors]; next[i] = e.target.value; setTeamColors(next);
                }}
                className="team-color-picker"
              />
              <input
                className="input-field team-name-input"
                value={teamNames[i]}
                onChange={e => {
                  const next = [...teamNames]; next[i] = e.target.value; setTeamNames(next);
                }}
                maxLength={20}
                placeholder={`اسم الفريق ${i + 1}`}
              />
            </div>
          ))}
        </div>

        {/* Theme picker */}
        <div className="theme-picker">
          <label>ثيم اللعبة:</label>
          <div className="theme-presets">
            {Object.values(HUROOF_THEMES).map(t => (
              <button
                key={t.id}
                title={t.name}
                className={`theme-swatch ${themeId === t.id ? 'active' : ''}`}
                style={{ '--swatch-a': t.teamA.main, '--swatch-b': t.teamB.main }}
                onClick={() => { setThemeId(t.id); saveTheme(t.id); }}
              >
                <span style={{ background: t.teamA.main }} />
                <span style={{ background: t.teamB.main }} />
              </button>
            ))}
            <button
              title="مخصص"
              className={`theme-swatch ${themeId === 'custom' ? 'active' : ''}`}
              onClick={() => setThemeId('custom')}
            >
              <span style={{ background: customA }} />
              <span style={{ background: customB }} />
            </button>
          </div>
          {themeId === 'custom' && (
            <div className="custom-theme-row">
              <label>أ:</label>
              <input type="color" value={customA} onChange={e => setCustomA(e.target.value)} />
              <label>ب:</label>
              <input type="color" value={customB} onChange={e => setCustomB(e.target.value)} />
            </div>
          )}
        </div>

        <button className="btn-green start-game-btn" onClick={handleStart}>
          ابدأ اللعبة ⬡
        </button>
      </div>
    </div>
  );
}

// ── Hex Grid ───────────────────────────────────────────────────────────────────
function HexGrid({ hexGrid, teams, activeHexIdx, selectableIdxs, onSelectHex, phase }) {
  let rowStart = 0;
  return (
    <div className="hex-grid-container">
      <div className="hex-grid" dir="ltr">
        {HEX_ROWS.map((count, rowIdx) => {
          const hexesInRow = hexGrid.slice(rowStart, rowStart + count);
          const isOdd = rowIdx % 2 === 1;
          rowStart += count;
          return (
            <div key={rowIdx} className={`hex-row ${isOdd ? 'hex-row-odd' : ''}`}>
              {hexesInRow.map((hex) => {
                const isOwned    = hex.owner !== null;
                const isActive   = hex.index === activeHexIdx;
                const isSelect   = selectableIdxs.includes(hex.index);
                const isCenter   = hex.index === CENTER_IDX;
                const ownerTeam  = isOwned ? teams[hex.owner] : null;
                const canClick   = phase === 'path-select' && isSelect;

                return (
                  <button
                    key={hex.index}
                    className={[
                      'hex-cell',
                      isOwned ? 'hex-owned' : '',
                      isActive ? 'selected-cell' : '',
                      isSelect && !isOwned ? 'adjacent-selectable' : '',
                      isCenter && !isOwned && phase !== 'path-select' ? 'center-hex' : '',
                      canClick ? 'clickable' : '',
                    ].filter(Boolean).join(' ')}
                    style={ownerTeam ? {
                      '--cell-color':     ownerTeam.color,
                      '--cell-color-dim': makeRgba(ownerTeam.color, 0.18),
                    } : {}}
                    onClick={() => canClick && onSelectHex(hex.index)}
                    disabled={!canClick}
                  >
                    <div className="hex-cell-inner">{hex.letter}</div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Score Bar ──────────────────────────────────────────────────────────────────
function ScoreBar({ teams, controlTeamIdx }) {
  return (
    <div className="score-bar">
      {teams.map((t, i) => (
        <div
          key={i}
          className={`score-item ${controlTeamIdx === i ? 'score-active' : ''}`}
          style={{
            '--sc': t.color,
            '--sc-dim': makeRgba(t.color, 0.15),
            '--sc-border': makeRgba(t.color, 0.35),
          }}
        >
          <span className="score-dot" style={{ background: t.color }} />
          <span>{t.name}</span>
          <span className="score-pts">{t.score}</span>
        </div>
      ))}
    </div>
  );
}

// ── Buzzer Panel ───────────────────────────────────────────────────────────────
function BuzzerPanel({ teams, buzzedTeamIdx, onBuzz, timerRunning, onTimerEnd }) {
  return (
    <div className="buzzer-overlay">
      <div className="buzzer-card">
        <div className="buzzer-title">
          {buzzedTeamIdx === null ? '⚡ اضغط الجرس أولاً!' : `🎯 ${teams[buzzedTeamIdx].name}`}
        </div>
        {buzzedTeamIdx === null && (
          <Timer duration={BUZZER_TIME} running={timerRunning} onEnd={onTimerEnd} key="buzzer-timer" />
        )}
        <div className="buzzer-teams">
          {teams.map((t, i) => (
            <button
              key={i}
              className={`buzzer-team-btn ${buzzedTeamIdx === i ? 'pressed' : ''}`}
              style={{
                '--bt': t.color,
                '--bt-dim': makeRgba(t.color, 0.2),
                '--bt-glow': makeRgba(t.color, 0.4),
              }}
              onClick={() => buzzedTeamIdx === null && onBuzz(i)}
              disabled={buzzedTeamIdx !== null}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Answer Panel ───────────────────────────────────────────────────────────────
function AnswerPanel({ question, letter, activeTeam, isSteal, stealTeam, selectedAnswer, onAnswer, timerRunning, onTimerEnd }) {
  const team = isSteal ? stealTeam : activeTeam;
  return (
    <div className="buzzer-overlay">
      <div className="buzzer-card">
        {isSteal && (
          <div className="steal-banner steal-banner-overlay pop-in">
            ⚡ فرصة السرقة — {stealTeam?.name}
          </div>
        )}
        <div className="buzzer-title" style={{ color: team?.color }}>
          {team?.name}
        </div>
        <div className="q-letter-badge" style={{ background: team?.color, color: '#fff' }}>
          {letter}
        </div>
        <p className="buzzer-question">{question?.text}</p>
        <Timer
          duration={isSteal ? STEAL_TIME : ANSWER_TIME}
          running={timerRunning}
          onEnd={onTimerEnd}
          key={isSteal ? 'steal' : 'answer'}
        />
        <div className="buzzer-options">
          {question?.options?.map((opt, i) => (
            <button
              key={i}
              className={`buzzer-option-btn ${selectedAnswer === i ? 'answered' : ''}`}
              onClick={() => selectedAnswer === null && onAnswer(i)}
              disabled={selectedAnswer !== null}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Result Flash ───────────────────────────────────────────────────────────────
function ResultFlash({ result }) {
  if (!result) return null;
  const cls = result.type === 'correct' ? 'correct' : result.type === 'timeout' ? 'wrong' : 'wrong';
  return (
    <div className={`result-flash pop-in ${cls}`}>
      {result.type === 'correct' && `✅ ${result.teamName} — إجابة صحيحة!`}
      {result.type === 'wrong' && `❌ خطأ — الصواب: ${result.correctAnswer}`}
      {result.type === 'timeout' && `⏰ انتهى الوقت — الصواب: ${result.correctAnswer}`}
      {result.type === 'no-buzz' && '⏱ لم يضغط أحد الجرس — تجاوز الخلية'}
    </div>
  );
}

// ── Main Game Hook ─────────────────────────────────────────────────────────────
function useHuroofGame(teams) {
  const [hexGrid, setHexGrid]         = useState(() => buildHexGrid());
  const [phase, setPhase]             = useState('pre-question');
  // 'pre-question' | 'buzzing' | 'answering' | 'steal' | 'result' | 'path-select' | 'gameover'
  const [activeHexIdx, setActiveHexIdx] = useState(CENTER_IDX);
  const [controlTeamIdx, setControlTeamIdx] = useState(null); // who picks next
  const [buzzedTeamIdx, setBuzzedTeamIdx]   = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer]   = useState(null);
  const [resultInfo, setResultInfo]           = useState(null);
  const [buzzerRunning, setBuzzerRunning]     = useState(false);
  const [answerRunning, setAnswerRunning]     = useState(false);
  const [teamsState, setTeamsState]           = useState(teams);
  const [round, setRound]                     = useState(1);
  const [stealQueue, setStealQueue]           = useState([]); // teams that haven't stolen yet
  const [isSteal, setIsSteal]                 = useState(false);
  const [selectableIdxs, setSelectableIdxs]   = useState([CENTER_IDX]);
  const preQTimeout = useRef(null);

  // Load question for active hex
  const loadQuestion = useCallback((hexIdx, grid) => {
    const hex = grid[hexIdx];
    const qs = getQuestionsByLetter ? getQuestionsByLetter(hex.letter) : [];
    return qs.length > 0
      ? qs[Math.floor(Math.random() * qs.length)]
      : (getRandomQuestion ? getRandomQuestion() : null);
  }, []);

  // Start buzzer phase for current active hex
  const startBuzzer = useCallback((grid, hexIdx) => {
    const q = loadQuestion(hexIdx, grid);
    setCurrentQuestion(q);
    setBuzzedTeamIdx(null);
    setSelectedAnswer(null);
    setResultInfo(null);
    setIsSteal(false);
    setStealQueue([]);
    setPhase('buzzing');
    setBuzzerRunning(true);
    setAnswerRunning(false);
  }, [loadQuestion]);

  // Initialize: pre-question delay then open buzzer
  useEffect(() => {
    preQTimeout.current = setTimeout(() => {
      startBuzzer(hexGrid, CENTER_IDX);
    }, PRE_Q_DELAY);
    return () => clearTimeout(preQTimeout.current);
  }, []); // eslint-disable-line

  // Team buzzes in
  const onBuzz = useCallback((teamIdx) => {
    setBuzzedTeamIdx(teamIdx);
    setBuzzerRunning(false);
    setPhase('answering');
    setAnswerRunning(true);
    // Build steal queue (all other teams, in order)
    setStealQueue(teams.map((_, i) => i).filter(i => i !== teamIdx));
  }, [teams]);

  // No one buzzed in time
  const onBuzzerTimeout = useCallback(() => {
    setBuzzerRunning(false);
    setResultInfo({ type: 'no-buzz', correctAnswer: currentQuestion?.answer });
    setPhase('result');
    // After result: pick next selectable hex if control team exists, else pass turn
    setTimeout(() => {
      setResultInfo(null);
      // Mark hex as claimed by nobody (skip)
      setHexGrid(prev => {
        const next = prev.map((h, i) => i === activeHexIdx ? { ...h, owner: -1 } : h);
        advanceRound(next, controlTeamIdx, round);
        return next;
      });
    }, 2200);
  }, [currentQuestion, activeHexIdx, controlTeamIdx, round]); // eslint-disable-line

  // Player submits answer
  const onAnswer = useCallback((answerIdx) => {
    setAnswerRunning(false);
    setSelectedAnswer(answerIdx);
    const isCorrect = currentQuestion?.options?.[answerIdx] === currentQuestion?.answer;

    if (isCorrect) {
      const winnerIdx = isSteal ? stealQueue[0] : buzzedTeamIdx;
      // Update score and grid
      setTeamsState(prev => prev.map((t, i) =>
        i === winnerIdx ? { ...t, score: t.score + 1 } : t
      ));
      setHexGrid(prev => {
        const next = prev.map((h, i) =>
          i === activeHexIdx ? { ...h, owner: winnerIdx } : h
        );
        return next;
      });
      setResultInfo({ type: 'correct', teamName: teams[winnerIdx]?.name, correctAnswer: currentQuestion?.answer });
      setPhase('result');
      // After result: let winner pick next path
      setTimeout(() => {
        setResultInfo(null);
        setHexGrid(prev => {
          const unclaimed = prev.filter(h => h.owner === null).length;
          if (unclaimed === 0) {
            setPhase('gameover');
            return prev;
          }
          const nextSelectable = getSelectableForTeam(prev, winnerIdx, false);
          setSelectableIdxs(nextSelectable);
          setControlTeamIdx(winnerIdx);
          setPhase('path-select');
          return prev;
        });
      }, 2200);
    } else {
      // Wrong answer
      setResultInfo({ type: 'wrong', correctAnswer: currentQuestion?.answer });
      setPhase('result');
      setTimeout(() => {
        setResultInfo(null);
        // Try steal: give remaining teams a chance
        const remaining = isSteal ? stealQueue.slice(1) : stealQueue;
        if (remaining.length > 0) {
          setIsSteal(true);
          setStealQueue(remaining);
          setBuzzedTeamIdx(null);
          setSelectedAnswer(null);
          setResultInfo(null);
          setPhase('steal');
          setAnswerRunning(true);
        } else {
          // No one answered correctly — skip hex
          setHexGrid(prev => {
            const next = prev.map((h, i) => i === activeHexIdx ? { ...h, owner: -1 } : h);
            advanceRound(next, controlTeamIdx, round);
            return next;
          });
        }
      }, 1800);
    }
  }, [currentQuestion, isSteal, stealQueue, buzzedTeamIdx, activeHexIdx, teams, controlTeamIdx, round]); // eslint-disable-line

  // Answer timer expired
  const onAnswerTimeout = useCallback(() => {
    setAnswerRunning(false);
    setResultInfo({ type: 'timeout', correctAnswer: currentQuestion?.answer });
    setPhase('result');
    setTimeout(() => {
      setResultInfo(null);
      const remaining = isSteal ? stealQueue.slice(1) : stealQueue;
      if (remaining.length > 0) {
        setIsSteal(true);
        setStealQueue(remaining);
        setBuzzedTeamIdx(null);
        setSelectedAnswer(null);
        setPhase('steal');
        setAnswerRunning(true);
      } else {
        setHexGrid(prev => {
          const next = prev.map((h, i) => i === activeHexIdx ? { ...h, owner: -1 } : h);
          advanceRound(next, controlTeamIdx, round);
          return next;
        });
      }
    }, 1800);
  }, [currentQuestion, isSteal, stealQueue, activeHexIdx, controlTeamIdx, round]); // eslint-disable-line

  // Control team selects next hex
  const onSelectHex = useCallback((hexIdx) => {
    setActiveHexIdx(hexIdx);
    setSelectableIdxs([]);
    setPhase('pre-question');
    setRound(r => r + 1);
    preQTimeout.current = setTimeout(() => {
      startBuzzer(hexGrid, hexIdx);
    }, PRE_Q_DELAY);
  }, [hexGrid, startBuzzer]); // eslint-disable-line

  // Helper: advance to next round after skipped hex
  function advanceRound(grid, ctrlIdx, currentRound) {
    const unclaimed = grid.filter(h => h.owner === null).length;
    if (unclaimed === 0) {
      setPhase('gameover');
      return;
    }
    if (ctrlIdx !== null) {
      const nextSel = getSelectableForTeam(grid, ctrlIdx, false);
      setSelectableIdxs(nextSel);
      setControlTeamIdx(ctrlIdx);
      setPhase('path-select');
    } else {
      // First round skipped — let all teams see next hex
      setSelectableIdxs(grid.filter(h => h.owner === null).map(h => h.index));
      setPhase('path-select');
    }
    setRound(currentRound + 1);
  }

  // Cleanup
  useEffect(() => () => clearTimeout(preQTimeout.current), []);

  return {
    hexGrid, phase, activeHexIdx, controlTeamIdx, buzzedTeamIdx,
    currentQuestion, selectedAnswer, resultInfo,
    buzzerRunning, answerRunning, teamsState, selectableIdxs,
    isSteal, stealQueue,
    onBuzz, onBuzzerTimeout, onAnswer, onAnswerTimeout, onSelectHex,
  };
}

// ── Game Screen ────────────────────────────────────────────────────────────────
function GameScreen({ teams, onBack }) {
  const g = useHuroofGame(teams);

  const activeTeam   = g.buzzedTeamIdx !== null ? teams[g.buzzedTeamIdx] : null;
  const stealingTeam = g.isSteal && g.stealQueue.length > 0 ? teams[g.stealQueue[0]] : null;
  const ctrlTeam     = g.controlTeamIdx !== null ? g.teamsState[g.controlTeamIdx] : null;

  // Count owned hexes per team
  const ownedCount = teams.map((_, i) =>
    g.hexGrid.filter(h => h.owner === i).length
  );

  if (g.phase === 'gameover') {
    const maxScore = Math.max(...g.teamsState.map(t => t.score));
    const winners  = g.teamsState.filter(t => t.score === maxScore);
    return (
      <div className="page asbiq-gameover">
        <div className="gameover-hero pop-in">
          <div className="gameover-trophy">🏆</div>
          <h1 className="winner-text" style={{ color: winners[0]?.color }}>
            {winners.length === 1
              ? `فاز ${winners[0].name}!`
              : `تعادل: ${winners.map(w => w.name).join(' & ')}!`}
          </h1>
        </div>

        {/* Final grid */}
        <div className="final-grid-wrap">
          <HexGrid
            hexGrid={g.hexGrid}
            teams={g.teamsState}
            activeHexIdx={-1}
            selectableIdxs={[]}
            onSelectHex={() => {}}
            phase="gameover"
          />
        </div>

        {/* Scores */}
        <div className="score-bar" style={{ marginTop: 16 }}>
          {g.teamsState.map((t, i) => (
            <div key={i} className="score-item"
              style={{ '--sc': t.color, '--sc-dim': makeRgba(t.color, 0.15), '--sc-border': makeRgba(t.color, 0.35) }}>
              <span className="score-dot" style={{ background: t.color }} />
              <span>{t.name}</span>
              <span className="score-pts">{t.score} خلية</span>
            </div>
          ))}
        </div>

        <div className="gameover-actions">
          <button className="btn-secondary" onClick={onBack}>العب مجدداً</button>
        </div>
      </div>
    );
  }

  return (
    <div className="huroof-game-page">
      {/* Header */}
      <div className="huroof-header">
        <button className="back-btn-inline" onClick={onBack}>← العودة</button>
        <div className="huroof-phase-label">
          {g.phase === 'pre-question'  && '🔍 جاهزوا...'}
          {g.phase === 'buzzing'       && '⚡ اضغط الجرس!'}
          {g.phase === 'answering'     && (activeTeam ? `🎯 ${activeTeam.name} يجيب` : '')}
          {g.phase === 'steal'         && (stealingTeam ? `⚡ سرقة — ${stealingTeam.name}` : '')}
          {g.phase === 'result'        && '📋 النتيجة'}
          {g.phase === 'path-select'   && (ctrlTeam ? `🗺 ${ctrlTeam.name} يختار الخلية التالية` : '')}
        </div>
      </div>

      {/* Scores */}
      <ScoreBar teams={g.teamsState} controlTeamIdx={g.controlTeamIdx} />

      {/* Result flash (shown above grid) */}
      {g.resultInfo && <ResultFlash result={g.resultInfo} />}

      {/* Hex Grid */}
      <HexGrid
        hexGrid={g.hexGrid}
        teams={g.teamsState}
        activeHexIdx={g.activeHexIdx}
        selectableIdxs={g.selectableIdxs}
        onSelectHex={g.onSelectHex}
        phase={g.phase}
      />

      {/* Legend */}
      <div className="teams-legend">
        {teams.map((t, i) => (
          <div key={i} className="legend-item"
            style={{ color: t.color, borderColor: makeRgba(t.color, 0.4), background: makeRgba(t.color, 0.08) }}>
            <span className="score-dot" style={{ background: t.color }} />
            {t.name}: {ownedCount[i]} خلية
          </div>
        ))}
      </div>

      {/* Overlays */}
      {(g.phase === 'buzzing') && (
        <BuzzerPanel
          teams={teams}
          buzzedTeamIdx={g.buzzedTeamIdx}
          onBuzz={g.onBuzz}
          timerRunning={g.buzzerRunning}
          onTimerEnd={g.onBuzzerTimeout}
        />
      )}

      {(g.phase === 'answering') && (
        <AnswerPanel
          question={g.currentQuestion}
          letter={g.hexGrid[g.activeHexIdx]?.letter}
          activeTeam={activeTeam}
          isSteal={false}
          stealTeam={null}
          selectedAnswer={g.selectedAnswer}
          onAnswer={g.onAnswer}
          timerRunning={g.answerRunning}
          onTimerEnd={g.onAnswerTimeout}
        />
      )}

      {(g.phase === 'steal') && stealingTeam && (
        <AnswerPanel
          question={g.currentQuestion}
          letter={g.hexGrid[g.activeHexIdx]?.letter}
          activeTeam={activeTeam}
          isSteal={true}
          stealTeam={stealingTeam}
          selectedAnswer={g.selectedAnswer}
          onAnswer={g.onAnswer}
          timerRunning={g.answerRunning}
          onTimerEnd={g.onAnswerTimeout}
        />
      )}
    </div>
  );
}

// ── Root Component ─────────────────────────────────────────────────────────────
export default function HuroofPage() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState(null);

  // Apply saved theme on mount
  useEffect(() => {
    applyThemeCSS(getSavedTheme());
  }, []);

  if (!teams) {
    return (
      <SetupScreen
        onStart={(t) => setTeams(t)}
        navigate={navigate}
      />
    );
  }

  return (
    <GameScreen
      teams={teams}
      onBack={() => setTeams(null)}
    />
  );
}
