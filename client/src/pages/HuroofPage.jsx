import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getQuestionsByLetter, getRandomQuestion } from '../questions';
import Timer from '../components/Timer';
import HUROOF_THEMES, {
  getSavedTheme, saveTheme, buildCustomTheme, applyThemeCSS,
} from '../data/huroof-themes';
import './HuroofPage.css';

// ── Constants ──────────────────────────────────────────────────────────────────
const BUZZER_TIME = 8;
const ANSWER_TIME = 30;
const STEAL_TIME  = 15;
const PRE_Q_MS    = 1600;

const ARABIC_LETTERS = [
  'ا','ب','ت','ث','ج','ح','خ','د','ذ','ر',
  'ز','س','ش','ص','ض','ط','ظ','ع','غ','ف',
  'ق','ك','ل','م','ن','ه','و','ي',
];

// ── Flat-top honeycomb grid: 5 rows × 5 cols = 25 hexes ──────────────────────
// Visual arrangement (odd rows shifted right by W/2):
//  Row 0 (even): [0]  [1]  [2]  [3]  [4]
//  Row 1 (odd) :   [5]  [6]  [7]  [8]  [9]
//  Row 2 (even): [10] [11] [12] [13] [14]   ← center = 12
//  Row 3 (odd) :   [15] [16] [17] [18] [19]
//  Row 4 (even): [20] [21] [22] [23] [24]

const HEX_ROWS    = [5, 5, 5, 5, 5];
const TOTAL_HEXES = 25;
const CENTER_IDX  = 12; // row 2, col 2

const DEFAULT_COLORS = ['#22c55e','#f97316','#3b82f6','#a855f7','#ef4444','#eab308'];
const DEFAULT_NAMES  = [
  'الفريق الأخضر','الفريق البرتقالي','الفريق الأزرق',
  'الفريق البنفسجي','الفريق الأحمر','الفريق الذهبي',
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function rgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function buildGrid() {
  const pool = [...ARABIC_LETTERS].sort(() => Math.random() - 0.5);
  return Array.from({ length: TOTAL_HEXES }, (_, i) => ({
    index: i,
    letter: pool[i % pool.length],
    owner: null,  // null | teamIndex | -1 (skipped)
  }));
}

/** Winner picks ANY unowned hex on the board */
function getSelectable(grid, isFirstRound) {
  if (isFirstRound) return [CENTER_IDX];
  return grid.filter(h => h.owner === null).map(h => h.index);
}

function loadQ(letter) {
  const qs = getQuestionsByLetter ? getQuestionsByLetter(letter) : [];
  return qs.length > 0
    ? qs[Math.floor(Math.random() * qs.length)]
    : (getRandomQuestion ? getRandomQuestion() : null);
}

// ── Setup Screen ───────────────────────────────────────────────────────────────
function SetupScreen({ onStart, navigate }) {
  const [numTeams,   setNumTeams]   = useState(2);
  const [names,      setNames]      = useState([...DEFAULT_NAMES]);
  const [colors,     setColors]     = useState([...DEFAULT_COLORS]);
  const [themeId,    setThemeId]    = useState(() => getSavedTheme()?.id || 'classic');
  const [customA,    setCustomA]    = useState('#22c55e');
  const [customB,    setCustomB]    = useState('#f97316');

  useEffect(() => {
    const t = themeId === 'custom' ? buildCustomTheme(customA, customB) : HUROOF_THEMES[themeId];
    if (t) applyThemeCSS(t);
  }, [themeId, customA, customB]);

  const start = () => {
    const teams = Array.from({ length: numTeams }, (_, i) => ({
      name: names[i] || DEFAULT_NAMES[i],
      color: colors[i] || DEFAULT_COLORS[i],
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
          شبكة حروف سداسية — الفريق الأسرع يضغط الجرس ويجيب ويختار الحرف التالي من أي مكان في الشبكة
        </p>

        {/* Team count */}
        <div className="grid-size-select">
          <label>عدد الفرق:</label>
          <div className="size-btns">
            {[2, 3, 4].map(n => (
              <button key={n} className={`size-btn ${numTeams === n ? 'selected' : ''}`}
                onClick={() => setNumTeams(n)}>{n} فرق
              </button>
            ))}
          </div>
        </div>

        {/* Team rows */}
        <div className="huroof-teams-config">
          {Array.from({ length: numTeams }, (_, i) => (
            <div key={i} className="huroof-team-row">
              <input type="color" value={colors[i]}
                onChange={e => { const c=[...colors]; c[i]=e.target.value; setColors(c); }}
                className="team-color-picker" />
              <input className="input-field team-name-input"
                value={names[i]}
                onChange={e => { const n=[...names]; n[i]=e.target.value; setNames(n); }}
                maxLength={20} placeholder={`الفريق ${i+1}`} />
            </div>
          ))}
        </div>

        {/* Theme presets */}
        <div className="theme-picker">
          <label>ثيم الألوان:</label>
          <div className="theme-presets">
            {Object.values(HUROOF_THEMES).map(t => (
              <button key={t.id} title={t.name}
                className={`theme-swatch ${themeId === t.id ? 'active' : ''}`}
                onClick={() => { setThemeId(t.id); saveTheme(t.id); }}>
                <span style={{ background: t.teamA.main }} />
                <span style={{ background: t.teamB.main }} />
              </button>
            ))}
            <button title="مخصص"
              className={`theme-swatch ${themeId === 'custom' ? 'active' : ''}`}
              onClick={() => setThemeId('custom')}>
              <span style={{ background: customA }} />
              <span style={{ background: customB }} />
            </button>
          </div>
          {themeId === 'custom' && (
            <div className="custom-theme-row">
              <label>اللون أ:</label>
              <input type="color" value={customA} onChange={e => setCustomA(e.target.value)} />
              <label>اللون ب:</label>
              <input type="color" value={customB} onChange={e => setCustomB(e.target.value)} />
            </div>
          )}
        </div>

        <button className="btn-green start-game-btn" onClick={start}>
          ابدأ اللعبة ⬡
        </button>
      </div>
    </div>
  );
}

// ── Flat-Top Hex Grid ──────────────────────────────────────────────────────────
function HexGrid({ grid, teams, activeIdx, selectableIdxs, onSelect, phase }) {
  let cursor = 0;
  return (
    <div className="hex-grid-container">
      <div className="hex-grid" dir="ltr">
        {HEX_ROWS.map((count, rowIdx) => {
          const rowHexes = grid.slice(cursor, cursor + count);
          cursor += count;
          const isOdd = rowIdx % 2 === 1;
          return (
            <div key={rowIdx} className={`hex-row ${isOdd ? 'hex-row-odd' : ''}`}>
              {rowHexes.map(hex => {
                const isOwned    = hex.owner !== null && hex.owner !== -1;
                const isSkipped  = hex.owner === -1;
                const isActive   = hex.index === activeIdx;
                const isCenter   = hex.index === CENTER_IDX && hex.owner === null && phase !== 'path-select';
                const isSelect   = selectableIdxs.includes(hex.index);
                const canClick   = phase === 'path-select' && isSelect && !isOwned;
                const ownerTeam  = isOwned ? teams[hex.owner] : null;

                return (
                  <button
                    key={hex.index}
                    className={[
                      'hex-cell',
                      isOwned   ? 'hex-owned'          : '',
                      isSkipped ? 'hex-skipped'         : '',
                      isActive  ? 'selected-cell'       : '',
                      isCenter  ? 'center-hex'          : '',
                      isSelect && !isOwned ? 'adjacent-selectable' : '',
                      canClick  ? 'clickable'            : '',
                    ].filter(Boolean).join(' ')}
                    style={ownerTeam ? {
                      '--cell-color':     ownerTeam.color,
                      '--cell-color-dim': rgba(ownerTeam.color, 0.18),
                    } : {}}
                    onClick={() => canClick && onSelect(hex.index)}
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
function ScoreBar({ teams, controlIdx }) {
  return (
    <div className="score-bar">
      {teams.map((t, i) => (
        <div key={i} className={`score-item ${controlIdx === i ? 'score-active' : ''}`}
          style={{
            '--sc':       t.color,
            '--sc-dim':   rgba(t.color, 0.14),
            '--sc-border':rgba(t.color, 0.35),
            '--sc-glow':  rgba(t.color, 0.4),
          }}>
          <span className="score-dot" style={{ background: t.color }} />
          {t.name}
          <strong className="score-pts">{t.score}</strong>
        </div>
      ))}
    </div>
  );
}

// ── Buzzer Overlay ─────────────────────────────────────────────────────────────
function BuzzerOverlay({ teams, buzzedIdx, onBuzz, timerRun, onTimeout }) {
  return (
    <div className="buzzer-overlay">
      <div className="buzzer-card">
        <div className="buzzer-badge">
          {buzzedIdx === null ? '⚡ اضغط الجرس أولاً!' : `🎯 ${teams[buzzedIdx].name}`}
        </div>
        {buzzedIdx === null && (
          <Timer duration={BUZZER_TIME} running={timerRun} onEnd={onTimeout} key="bz" />
        )}
        <div className="buzzer-team-grid">
          {teams.map((t, i) => (
            <button key={i}
              className={`buzzer-btn ${buzzedIdx === i ? 'pressed' : ''}`}
              style={{ '--bt': t.color, '--bt-dim': rgba(t.color, 0.2), '--bt-glow': rgba(t.color, 0.45) }}
              onClick={() => buzzedIdx === null && onBuzz(i)}
              disabled={buzzedIdx !== null}>
              {t.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Answer Overlay ─────────────────────────────────────────────────────────────
function AnswerOverlay({ question, letter, team, isSteal, selAns, onAnswer, timerRun, onTimeout }) {
  return (
    <div className="buzzer-overlay">
      <div className="buzzer-card">
        {isSteal && (
          <div className="steal-pill">⚡ فرصة السرقة</div>
        )}
        <div className="buzzer-badge" style={{ color: team?.color }}>
          {team?.name}
        </div>
        <div className="letter-badge" style={{ background: team?.color || 'var(--huroof-accent)' }}>
          {letter}
        </div>
        <p className="q-text">{question?.text}</p>
        <Timer
          duration={isSteal ? STEAL_TIME : ANSWER_TIME}
          running={timerRun}
          onEnd={onTimeout}
          key={isSteal ? 'steal' : 'ans'}
        />
        <div className="opts-grid">
          {question?.options?.map((opt, i) => (
            <button key={i}
              className={`opt-btn ${selAns === i ? 'picked' : ''}`}
              onClick={() => selAns === null && onAnswer(i)}
              disabled={selAns !== null}>
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
  const cls = result.correct ? 'flash-correct' : 'flash-wrong';
  return (
    <div className={`result-flash ${cls} pop-in`}>
      {result.correct  && `✅ ${result.teamName} — إجابة صحيحة!`}
      {!result.correct && !result.timeout && `❌ خطأ — الصواب: ${result.answer}`}
      {result.timeout  && `⏰ انتهى الوقت — الصواب: ${result.answer}`}
      {result.noBuzz   && '⏱ لم يضغط أحد — تجاوز الحرف'}
    </div>
  );
}

// ── Game Hook ──────────────────────────────────────────────────────────────────
function useGame(initTeams) {
  const [grid,        setGrid]        = useState(() => buildGrid());
  const [teams,       setTeams]       = useState(initTeams);
  const [phase,       setPhase]       = useState('pre');
  // phase: 'pre' | 'buzzing' | 'answering' | 'steal' | 'result' | 'path-select' | 'over'
  const [activeIdx,   setActiveIdx]   = useState(CENTER_IDX);
  const [controlIdx,  setControlIdx]  = useState(null);
  const [buzzedIdx,   setBuzzedIdx]   = useState(null);
  const [question,    setQuestion]    = useState(null);
  const [selAns,      setSelAns]      = useState(null);
  const [result,      setResult]      = useState(null);
  const [buzzerRun,   setBuzzerRun]   = useState(false);
  const [answerRun,   setAnswerRun]   = useState(false);
  const [selectable,  setSelectable]  = useState([CENTER_IDX]);
  const [isSteal,     setIsSteal]     = useState(false);
  const [stealQueue,  setStealQueue]  = useState([]);
  const [round,       setRound]       = useState(1);
  const preTimer = useRef(null);

  const openBuzzer = useCallback((g, idx) => {
    const q = loadQ(g[idx].letter);
    setQuestion(q);
    setBuzzedIdx(null);
    setSelAns(null);
    setResult(null);
    setIsSteal(false);
    setStealQueue([]);
    setPhase('buzzing');
    setBuzzerRun(true);
    setAnswerRun(false);
  }, []);

  // Initial: pre-delay then buzzer
  useEffect(() => {
    preTimer.current = setTimeout(() => openBuzzer(grid, CENTER_IDX), PRE_Q_MS);
    return () => clearTimeout(preTimer.current);
  }, []); // eslint-disable-line

  const buzz = useCallback((tIdx) => {
    setBuzzedIdx(tIdx);
    setBuzzerRun(false);
    setIsSteal(false);
    setStealQueue(initTeams.map((_, i) => i).filter(i => i !== tIdx));
    setPhase('answering');
    setAnswerRun(true);
  }, [initTeams]);

  const noBuzz = useCallback(() => {
    setBuzzerRun(false);
    setResult({ noBuzz: true, answer: question?.answer });
    setPhase('result');
    setTimeout(() => {
      setResult(null);
      setGrid(prev => {
        const next = prev.map((h, i) => i === activeIdx ? { ...h, owner: -1 } : h);
        advanceAfterSkip(next);
        return next;
      });
    }, 2200);
  }, [question, activeIdx]); // eslint-disable-line

  const answer = useCallback((aIdx) => {
    setAnswerRun(false);
    setSelAns(aIdx);
    const correct = question?.options?.[aIdx] === question?.answer;
    const winnerIdx = isSteal ? stealQueue[0] : buzzedIdx;

    if (correct) {
      setTeams(prev => prev.map((t, i) =>
        i === winnerIdx ? { ...t, score: t.score + 1 } : t
      ));
      setGrid(prev => {
        const next = prev.map((h, i) =>
          i === activeIdx ? { ...h, owner: winnerIdx } : h
        );
        return next;
      });
      setResult({ correct: true, teamName: initTeams[winnerIdx]?.name, answer: question?.answer });
      setPhase('result');
      setTimeout(() => {
        setResult(null);
        setGrid(prev => {
          const unclaimed = prev.filter(h => h.owner === null).length;
          if (unclaimed === 0) { setPhase('over'); return prev; }
          // Winner picks ANY unowned hex
          const sel = getSelectable(prev, false);
          setSelectable(sel);
          setControlIdx(winnerIdx);
          setPhase('path-select');
          return prev;
        });
      }, 2200);
    } else {
      setResult({ correct: false, answer: question?.answer });
      setPhase('result');
      setTimeout(() => {
        setResult(null);
        const remaining = isSteal ? stealQueue.slice(1) : stealQueue;
        if (remaining.length > 0) {
          // Next team in queue steals
          setIsSteal(true);
          setStealQueue(remaining);
          setBuzzedIdx(null);
          setSelAns(null);
          setPhase('steal');
          setAnswerRun(true);
        } else {
          // No one got it — skip hex
          setGrid(prev => {
            const next = prev.map((h, i) => i === activeIdx ? { ...h, owner: -1 } : h);
            advanceAfterSkip(next);
            return next;
          });
        }
      }, 1800);
    }
  }, [question, isSteal, stealQueue, buzzedIdx, activeIdx, initTeams]); // eslint-disable-line

  const answerTimeout = useCallback(() => {
    setAnswerRun(false);
    setResult({ correct: false, timeout: true, answer: question?.answer });
    setPhase('result');
    setTimeout(() => {
      setResult(null);
      const remaining = isSteal ? stealQueue.slice(1) : stealQueue;
      if (remaining.length > 0) {
        setIsSteal(true);
        setStealQueue(remaining);
        setBuzzedIdx(null);
        setSelAns(null);
        setPhase('steal');
        setAnswerRun(true);
      } else {
        setGrid(prev => {
          const next = prev.map((h, i) => i === activeIdx ? { ...h, owner: -1 } : h);
          advanceAfterSkip(next);
          return next;
        });
      }
    }, 1800);
  }, [question, isSteal, stealQueue, activeIdx]); // eslint-disable-line

  const selectHex = useCallback((idx) => {
    clearTimeout(preTimer.current);
    setActiveIdx(idx);
    setSelectable([]);
    setPhase('pre');
    setRound(r => r + 1);
    preTimer.current = setTimeout(() => {
      setGrid(g => { openBuzzer(g, idx); return g; });
    }, PRE_Q_MS);
  }, [openBuzzer]);

  function advanceAfterSkip(g) {
    const unclaimed = g.filter(h => h.owner === null).length;
    if (unclaimed === 0) { setPhase('over'); return; }
    if (controlIdx !== null) {
      setSelectable(getSelectable(g, false));
      setPhase('path-select');
    } else {
      setSelectable(getSelectable(g, false));
      setPhase('path-select');
    }
    setRound(r => r + 1);
  }

  useEffect(() => () => clearTimeout(preTimer.current), []);

  const stealingTeam = isSteal && stealQueue.length > 0 ? teams[stealQueue[0]] : null;
  const activeTeam   = buzzedIdx !== null ? teams[buzzedIdx] : null;
  const currentTeam  = isSteal ? stealingTeam : activeTeam;

  return {
    grid, teams, phase, activeIdx, controlIdx, buzzedIdx,
    question, selAns, result, buzzerRun, answerRun,
    selectable, stealingTeam, currentTeam,
    buzz, noBuzz, answer, answerTimeout, selectHex,
  };
}

// ── Game Over Screen ───────────────────────────────────────────────────────────
function GameOver({ teams, grid, onBack }) {
  const maxScore = Math.max(...teams.map(t => t.score));
  const winners  = teams.filter(t => t.score === maxScore);
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
      <div className="final-grid-wrap">
        <HexGrid
          grid={grid} teams={teams}
          activeIdx={-1} selectableIdxs={[]}
          onSelect={() => {}} phase="over"
        />
      </div>
      <div className="score-bar" style={{ marginTop: 14 }}>
        {teams.map((t, i) => (
          <div key={i} className="score-item"
            style={{ '--sc': t.color, '--sc-dim': rgba(t.color,0.15), '--sc-border': rgba(t.color,0.35) }}>
            <span className="score-dot" style={{ background: t.color }} />
            {t.name} — <strong>{t.score} خلية</strong>
          </div>
        ))}
      </div>
      <div className="gameover-actions">
        <button className="btn-secondary" onClick={onBack}>العب مجدداً</button>
      </div>
    </div>
  );
}

// ── Game Screen ────────────────────────────────────────────────────────────────
function GameScreen({ initTeams, onBack }) {
  const g = useGame(initTeams);

  if (g.phase === 'over') {
    return <GameOver teams={g.teams} grid={g.grid} onBack={onBack} />;
  }

  const ctrlTeam = g.controlIdx !== null ? g.teams[g.controlIdx] : null;
  const ownedCounts = initTeams.map((_, i) => g.grid.filter(h => h.owner === i).length);

  const phaseLabel = {
    pre:          '🔍 استعدوا...',
    buzzing:      '⚡ اضغط الجرس!',
    answering:    g.currentTeam ? `🎯 ${g.currentTeam.name} يجيب` : '',
    steal:        g.stealingTeam ? `⚡ سرقة — ${g.stealingTeam.name}` : '',
    result:       '📋 النتيجة',
    'path-select': ctrlTeam ? `🗺 ${ctrlTeam.name} — اختر أي حرف في الشبكة` : '',
  }[g.phase] || '';

  return (
    <div className="huroof-game-page">
      {/* Header */}
      <div className="huroof-header">
        <button className="back-btn-inline" onClick={onBack}>← العودة</button>
        <div className="huroof-phase-label">{phaseLabel}</div>
      </div>

      {/* Scores */}
      <ScoreBar teams={g.teams} controlIdx={g.controlIdx} />

      {/* Path-select hint */}
      {g.phase === 'path-select' && ctrlTeam && (
        <div className="path-select-hint" style={{
          borderColor: rgba(ctrlTeam.color, 0.5),
          color: ctrlTeam.color,
          background: rgba(ctrlTeam.color, 0.08),
        }}>
          🗺 {ctrlTeam.name} — اضغط على أي حرف لم يُؤخذ بعد
        </div>
      )}

      {/* Result flash */}
      {g.result && <ResultFlash result={g.result} />}

      {/* Hex grid */}
      <HexGrid
        grid={g.grid}
        teams={g.teams}
        activeIdx={g.activeIdx}
        selectableIdxs={g.selectable}
        onSelect={g.selectHex}
        phase={g.phase}
      />

      {/* Legend */}
      <div className="teams-legend">
        {initTeams.map((t, i) => (
          <div key={i} className="legend-item"
            style={{ color: t.color, borderColor: rgba(t.color, 0.4), background: rgba(t.color, 0.07) }}>
            <span className="score-dot" style={{ background: t.color }} />
            {t.name}: {ownedCounts[i]} خلية
          </div>
        ))}
      </div>

      {/* Buzzer overlay */}
      {g.phase === 'buzzing' && (
        <BuzzerOverlay
          teams={initTeams}
          buzzedIdx={g.buzzedIdx}
          onBuzz={g.buzz}
          timerRun={g.buzzerRun}
          onTimeout={g.noBuzz}
        />
      )}

      {/* Answer overlay */}
      {(g.phase === 'answering') && (
        <AnswerOverlay
          question={g.question}
          letter={g.grid[g.activeIdx]?.letter}
          team={g.currentTeam}
          isSteal={false}
          selAns={g.selAns}
          onAnswer={g.answer}
          timerRun={g.answerRun}
          onTimeout={g.answerTimeout}
        />
      )}

      {/* Steal overlay */}
      {g.phase === 'steal' && g.stealingTeam && (
        <AnswerOverlay
          question={g.question}
          letter={g.grid[g.activeIdx]?.letter}
          team={g.stealingTeam}
          isSteal={true}
          selAns={g.selAns}
          onAnswer={g.answer}
          timerRun={g.answerRun}
          onTimeout={g.answerTimeout}
        />
      )}
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────
export default function HuroofPage() {
  const navigate = useNavigate();
  const [teams,  setTeams]  = useState(null);

  useEffect(() => { applyThemeCSS(getSavedTheme()); }, []);

  if (!teams) {
    return <SetupScreen onStart={setTeams} navigate={navigate} />;
  }
  return <GameScreen initTeams={teams} onBack={() => setTeams(null)} />;
}
