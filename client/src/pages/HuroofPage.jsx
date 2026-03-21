import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import { getRandomLetters, getQuestionsByLetter, getRandomQuestion } from '../questions';
import Timer from '../components/Timer';
import './HuroofPage.css';

const ANSWER_TIME = 30;
const GRID_SIZES = { small: 4, medium: 5, large: 6 };

// ─── Win check (BFS) ─────────────────────────────────────────────────────────

function checkWin(grid, gridN, team) {
  const owned = new Set(grid.filter(c => c.owner === team).map(c => c.index));
  const startCells = team === 'A'
    ? grid.filter(c => c.row === 0 && owned.has(c.index)).map(c => c.index)
    : grid.filter(c => c.col === 0 && owned.has(c.index)).map(c => c.index);
  const visited = new Set(startCells);
  const queue = [...startCells];
  while (queue.length > 0) {
    const idx = queue.shift();
    const cell = grid[idx];
    if (team === 'A' && cell.row === gridN - 1) return true;
    if (team === 'B' && cell.col === gridN - 1) return true;
    const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,1],[1,-1]];
    for (const [dr, dc] of dirs) {
      const nr = cell.row + dr, nc = cell.col + dc;
      if (nr >= 0 && nr < gridN && nc >= 0 && nc < gridN) {
        const nIdx = nr * gridN + nc;
        if (owned.has(nIdx) && !visited.has(nIdx)) { visited.add(nIdx); queue.push(nIdx); }
      }
    }
  }
  return false;
}

function buildGrid(gridN) {
  const letters = getRandomLetters(gridN * gridN);
  return Array.from({ length: gridN * gridN }, (_, i) => ({
    index: i, row: Math.floor(i / gridN), col: i % gridN,
    letter: letters[i], owner: null,
  }));
}

// ─── Local game logic ─────────────────────────────────────────────────────────

function useLocalGame() {
  const [screen, setScreen] = useState('setup'); // setup | game | gameover
  const [gridSize, setGridSize] = useState('medium');
  const [grid, setGrid] = useState([]);
  const [gridN, setGridN] = useState(5);
  const [currentTurn, setCurrentTurn] = useState('A');
  const [gamePhase, setGamePhase] = useState('selecting'); // selecting | answering
  const [selectedCell, setSelectedCell] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [resultMessage, setResultMessage] = useState(null);
  const [winner, setWinner] = useState(null);

  const startGame = () => {
    const n = GRID_SIZES[gridSize] || 5;
    setGridN(n);
    setGrid(buildGrid(n));
    setCurrentTurn('A');
    setGamePhase('selecting');
    setSelectedCell(null);
    setCurrentQuestion(null);
    setSelectedAnswer(null);
    setTimerRunning(false);
    setResultMessage(null);
    setWinner(null);
    setScreen('game');
  };

  const selectCell = (index) => {
    if (gamePhase !== 'selecting') return;
    const cell = grid[index];
    if (!cell || cell.owner !== null) return;
    const letterQs = getQuestionsByLetter(cell.letter);
    const q = letterQs.length > 0
      ? letterQs[Math.floor(Math.random() * letterQs.length)]
      : getRandomQuestion();
    setSelectedCell(index);
    setCurrentQuestion(q);
    setSelectedAnswer(null);
    setGamePhase('answering');
    setTimerRunning(true);
  };

  const submitAnswer = (answerIdx) => {
    if (gamePhase !== 'answering') return;
    setSelectedAnswer(answerIdx);
    setTimerRunning(false);
    const isCorrect = currentQuestion.options[answerIdx] === currentQuestion.answer;
    let newGrid = grid.map((c, i) =>
      i === selectedCell && isCorrect ? { ...c, owner: currentTurn } : c
    );
    if (isCorrect && checkWin(newGrid, gridN, currentTurn)) {
      setGrid(newGrid);
      setWinner(currentTurn);
      setScreen('gameover');
      return;
    }
    setGrid(newGrid);
    setResultMessage({ isCorrect, correctAnswer: currentQuestion.answer });
    const next = currentTurn === 'A' ? 'B' : 'A';
    setTimeout(() => {
      setResultMessage(null);
      setCurrentTurn(next);
      setGamePhase('selecting');
      setSelectedCell(null);
      setCurrentQuestion(null);
      setSelectedAnswer(null);
    }, 2000);
  };

  const timeUp = () => {
    if (gamePhase !== 'answering') return;
    setTimerRunning(false);
    setResultMessage({ isCorrect: false, timeUp: true, correctAnswer: currentQuestion?.answer });
    const next = currentTurn === 'A' ? 'B' : 'A';
    setTimeout(() => {
      setResultMessage(null);
      setCurrentTurn(next);
      setGamePhase('selecting');
      setSelectedCell(null);
      setCurrentQuestion(null);
      setSelectedAnswer(null);
    }, 2000);
  };

  const reset = () => { setScreen('setup'); setWinner(null); };

  return {
    screen, gridSize, setGridSize, grid, gridN,
    currentTurn, gamePhase, selectedCell, currentQuestion,
    selectedAnswer, timerRunning, resultMessage, winner,
    startGame, selectCell, submitAnswer, timeUp, reset,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HuroofPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState(null); // null | 'local' | 'room'

  // Room state
  const [roomScreen, setRoomScreen] = useState('setup');
  const [playerName, setPlayerName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('A');
  const [gridSize, setGridSize] = useState('medium');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [cellSelected, setCellSelected] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [myId, setMyId] = useState(null);
  const [error, setError] = useState('');
  const [timerRunning, setTimerRunning] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [resultMessage, setResultMessage] = useState(null);

  const local = useLocalGame();

  // Room socket setup
  useEffect(() => {
    if (mode !== 'room') return;
    socket.connect();
    setMyId(socket.id);
    socket.on('connect', () => setMyId(socket.id));
    socket.on('huroof:created', ({ roomCode, isHost, state }) => { setRoomCode(roomCode); setIsHost(isHost); setGameState(state); setRoomScreen('lobby'); });
    socket.on('huroof:joined', ({ roomCode, isHost, state }) => { setRoomCode(roomCode); setIsHost(isHost); setGameState(state); setRoomScreen('lobby'); });
    socket.on('huroof:player_joined', ({ state }) => setGameState(state));
    socket.on('huroof:player_left', ({ state }) => setGameState(state));
    socket.on('huroof:game_started', (data) => { setGameState(s => ({ ...s, ...data, state: 'selecting' })); setRoomScreen('game'); setGameOver(null); setResultMessage(null); });
    socket.on('huroof:cell_selected', (data) => { setCellSelected(data); setSelectedAnswer(null); setResultMessage(null); setTimerRunning(true); setGameState(s => ({ ...s, state: 'answering', selectedCell: data.cellIndex })); });
    socket.on('huroof:answer_result', (data) => { setTimerRunning(false); setResultMessage({ isCorrect: data.isCorrect, correctAnswer: data.correctAnswer }); setGameState(s => ({ ...s, grid: data.grid, currentTurn: data.nextTurn, state: 'selecting', selectedCell: null })); setCellSelected(null); setSelectedAnswer(null); setTimeout(() => setResultMessage(null), 2500); });
    socket.on('huroof:time_up', (data) => { setTimerRunning(false); setResultMessage({ isCorrect: false, timeUp: true, correctAnswer: data.correctAnswer }); setGameState(s => ({ ...s, grid: data.grid, currentTurn: data.nextTurn, state: 'selecting', selectedCell: null })); setCellSelected(null); setSelectedAnswer(null); setTimeout(() => setResultMessage(null), 2500); });
    socket.on('huroof:game_over', (data) => { setTimerRunning(false); setGameState(s => ({ ...s, grid: data.grid, state: 'results' })); setGameOver(data); setRoomScreen('gameover'); });
    socket.on('error', ({ message }) => setError(message));
    return () => {
      ['connect','huroof:created','huroof:joined','huroof:player_joined','huroof:player_left',
       'huroof:game_started','huroof:cell_selected','huroof:answer_result','huroof:time_up','huroof:game_over','error']
        .forEach(e => socket.off(e));
      socket.disconnect();
    };
  }, [mode]);

  // ── Mode selection ────────────────────────────────────────────────────────
  if (!mode) {
    return (
      <div className="page huroof-setup">
        <button className="back-btn" onClick={() => navigate('/')}>← العودة</button>
        <div className="setup-card card pop-in">
          <div className="setup-icon">🔤</div>
          <h1>حروف</h1>
          <p className="setup-desc">فريقان يتنافسان على ربط مسار عبر شبكة الحروف</p>
          <div className="mode-buttons">
            <button className="btn-green mode-btn" onClick={() => setMode('local')}>
              🏠 لعب محلي
              <small>نفس الجهاز — بدون إنترنت</small>
            </button>
            <button className="btn-secondary mode-btn" onClick={() => setMode('room')}>
              🌐 غرفة أونلاين
              <small>أجهزة منفصلة — يتطلب خادماً</small>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── LOCAL MODE ────────────────────────────────────────────────────────────
  if (mode === 'local') {
    if (local.screen === 'setup') {
      return (
        <div className="page huroof-setup">
          <button className="back-btn" onClick={() => setMode(null)}>← العودة</button>
          <div className="setup-card card pop-in">
            <div className="setup-icon">🔤</div>
            <h1>حروف — محلي</h1>
            <p className="setup-desc">فريقان على نفس الجهاز</p>
            <div className="grid-size-select">
              <label>حجم الشبكة:</label>
              <div className="size-btns">
                {['small', 'medium', 'large'].map(s => (
                  <button key={s} className={`size-btn ${local.gridSize === s ? 'selected' : ''}`} onClick={() => local.setGridSize(s)}>
                    {s === 'small' ? '4×4' : s === 'medium' ? '5×5' : '6×6'}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn-green start-game-btn" onClick={local.startGame}>ابدأ اللعبة 🔤</button>
          </div>
        </div>
      );
    }

    if (local.screen === 'game') {
      const isAnswering = local.gamePhase === 'answering';
      const n = local.gridN;
      return (
        <div className="huroof-game-page">
          <div className="huroof-header">
            <div className={`turn-indicator ${local.currentTurn === 'A' ? 'turn-a' : 'turn-b'}`}>
              {local.currentTurn === 'A' ? '🟢' : '🟠'}
              {`دور ${local.currentTurn === 'A' ? 'الأخضر' : 'البرتقالي'}`}
            </div>
            {isAnswering && <Timer duration={ANSWER_TIME} running={local.timerRunning} onEnd={local.timeUp} />}
          </div>

          {local.resultMessage && (
            <div className={`result-flash pop-in ${local.resultMessage.isCorrect ? 'correct' : 'wrong'}`}>
              {local.resultMessage.timeUp ? '⏰ انتهى الوقت!' : local.resultMessage.isCorrect ? '✅ إجابة صحيحة!' : `❌ خطأ — الصواب: ${local.resultMessage.correctAnswer}`}
            </div>
          )}

          <div className="grid-container">
            <div className="border-label top-label">🟢 الفريق الأخضر</div>
            <div className="grid-row-wrap">
              <div className="border-label left-label">🟠<br/>البرتقالي</div>
              <div className="huroof-grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
                {local.grid.map((cell, i) => (
                  <button
                    key={i}
                    className={`grid-cell ${cell.owner === 'A' ? 'owned-a' : cell.owner === 'B' ? 'owned-b' : ''} ${local.selectedCell === i ? 'selected-cell' : ''} ${!isAnswering && !cell.owner ? 'clickable' : ''}`}
                    onClick={() => local.selectCell(i)}
                    disabled={isAnswering || !!cell.owner}
                  >
                    {cell.letter}
                  </button>
                ))}
              </div>
              <div className="border-label right-label">🟠<br/>البرتقالي</div>
            </div>
            <div className="border-label bottom-label">🟢 الفريق الأخضر</div>
          </div>

          {isAnswering && local.currentQuestion && (
            <div className="question-panel card pop-in">
              <div className="q-letter-badge">{local.grid[local.selectedCell]?.letter}</div>
              <p className="question-text">{local.currentQuestion.text}</p>
              <div className="options-grid">
                {local.currentQuestion.options.map((opt, i) => (
                  <button
                    key={i}
                    className={`option-btn ${local.selectedAnswer === i ? 'answered' : ''}`}
                    onClick={() => local.submitAnswer(i)}
                    disabled={local.selectedAnswer !== null}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="teams-legend">
            <div className="legend-item legend-a">🟢 الفريق الأخضر: الأعلى ← الأسفل</div>
            <div className="legend-item legend-b">🟠 الفريق البرتقالي: اليمين ← اليسار</div>
          </div>
        </div>
      );
    }

    if (local.screen === 'gameover') {
      const n = local.gridN;
      return (
        <div className="page asbiq-gameover">
          <div className="gameover-hero pop-in">
            <div className="gameover-trophy">🏆</div>
            <h1 className={local.winner === 'A' ? 'winner-a' : 'winner-b'}>
              فاز {local.winner === 'A' ? '🟢 الفريق الأخضر' : '🟠 الفريق البرتقالي'}!
            </h1>
          </div>
          <div className="final-grid-wrap">
            <div className="huroof-grid final-grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
              {local.grid.map((cell, i) => (
                <div key={i} className={`grid-cell ${cell.owner === 'A' ? 'owned-a' : cell.owner === 'B' ? 'owned-b' : ''}`}>{cell.letter}</div>
              ))}
            </div>
          </div>
          <div className="gameover-actions">
            <button className="btn-secondary" onClick={local.reset}>العب مجدداً</button>
            <button className="btn-primary" onClick={() => navigate('/')}>الرئيسية</button>
          </div>
        </div>
      );
    }
  }

  // ── ROOM MODE ─────────────────────────────────────────────────────────────
  const myTeam = gameState?.players?.[myId]?.team;
  const isMyTurn = myTeam === gameState?.currentTurn;
  const n = gameState?.gridN || 5;

  if (roomScreen === 'setup') {
    return (
      <div className="page huroof-setup">
        <button className="back-btn" onClick={() => { setMode(null); setRoomScreen('setup'); }}>← العودة</button>
        <div className="setup-card card pop-in">
          <div className="setup-icon">🔤</div>
          <h1>حروف — غرفة</h1>
          <input className="input-field" placeholder="اسمك" value={playerName} onChange={e => setPlayerName(e.target.value)} maxLength={20} />
          <div className="team-select">
            <label>اختر فريقك:</label>
            <div className="team-btns">
              <button className={`team-btn team-a ${selectedTeam === 'A' ? 'selected' : ''}`} onClick={() => setSelectedTeam('A')}>🟢 الأخضر</button>
              <button className={`team-btn team-b ${selectedTeam === 'B' ? 'selected' : ''}`} onClick={() => setSelectedTeam('B')}>🟠 البرتقالي</button>
            </div>
          </div>
          <div className="grid-size-select">
            <label>حجم الشبكة:</label>
            <div className="size-btns">
              {['small', 'medium', 'large'].map(s => (
                <button key={s} className={`size-btn ${gridSize === s ? 'selected' : ''}`} onClick={() => setGridSize(s)}>
                  {s === 'small' ? '4×4' : s === 'medium' ? '5×5' : '6×6'}
                </button>
              ))}
            </div>
          </div>
          <div className="setup-actions">
            <button className="btn-green" onClick={() => { if (!playerName.trim()) return setError('أدخل اسمك'); setError(''); socket.emit('huroof:create', { playerName: playerName.trim(), team: selectedTeam, gridSize }); }}>إنشاء غرفة</button>
            <span className="divider">أو</span>
            <div className="join-row">
              <input className="input-field join-input" placeholder="رمز الغرفة" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={6} style={{ textAlign: 'center', letterSpacing: 4, fontSize: '1.2rem' }} />
              <button className="btn-secondary" onClick={() => { if (!playerName.trim()) return setError('أدخل اسمك'); if (!joinCode.trim()) return setError('أدخل رمز الغرفة'); setError(''); socket.emit('huroof:join', { roomCode: joinCode.trim(), playerName: playerName.trim(), team: selectedTeam }); }}>انضم</button>
            </div>
          </div>
          {error && <div className="error-msg shake">{error}</div>}
        </div>
      </div>
    );
  }

  if (roomScreen === 'lobby') {
    const teamA = Object.values(gameState?.players || {}).filter(p => p.team === 'A');
    const teamB = Object.values(gameState?.players || {}).filter(p => p.team === 'B');
    return (
      <div className="page huroof-lobby">
        <div className="lobby-card card">
          <h2>غرفة الانتظار</h2>
          <div className="room-code-display"><span>رمز الغرفة:</span><strong className="room-code">{roomCode}</strong></div>
          <div className="teams-preview">
            <div className="team-preview team-a-preview">
              <h4>🟢 الفريق الأخضر ({teamA.length})</h4>
              {teamA.map(p => <div key={p.name} className="player-item">{p.name}</div>)}
              <small>يربط من الأعلى للأسفل</small>
            </div>
            <div className="team-preview team-b-preview">
              <h4>🟠 الفريق البرتقالي ({teamB.length})</h4>
              {teamB.map(p => <div key={p.name} className="player-item">{p.name}</div>)}
              <small>يربط من اليمين لليسار</small>
            </div>
          </div>
          {isHost
            ? <button className="btn-green start-btn" onClick={() => socket.emit('huroof:start')}>ابدأ اللعبة 🔤</button>
            : <p className="waiting-msg pulse">انتظار المضيف لبدء اللعبة...</p>}
        </div>
      </div>
    );
  }

  if (roomScreen === 'game') {
    const grid = gameState?.grid || [];
    const currentTurn = gameState?.currentTurn;
    const isAnswering = gameState?.state === 'answering';
    return (
      <div className="huroof-game-page">
        <div className="huroof-header">
          <div className={`turn-indicator ${currentTurn === 'A' ? 'turn-a' : 'turn-b'}`}>
            {currentTurn === 'A' ? '🟢' : '🟠'}
            {isMyTurn ? 'دورك!' : `دور ${currentTurn === 'A' ? 'الأخضر' : 'البرتقالي'}`}
          </div>
          {isAnswering && <Timer duration={ANSWER_TIME} running={timerRunning} />}
        </div>
        {resultMessage && (
          <div className={`result-flash pop-in ${resultMessage.isCorrect ? 'correct' : 'wrong'}`}>
            {resultMessage.timeUp ? '⏰ انتهى الوقت!' : resultMessage.isCorrect ? '✅ إجابة صحيحة!' : `❌ خطأ — الصواب: ${resultMessage.correctAnswer}`}
          </div>
        )}
        <div className="grid-container">
          <div className="border-label top-label">🟢 الفريق الأخضر</div>
          <div className="grid-row-wrap">
            <div className="border-label left-label">🟠<br/>البرتقالي</div>
            <div className="huroof-grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
              {grid.map((cell, i) => (
                <button key={i}
                  className={`grid-cell ${cell.owner === 'A' ? 'owned-a' : cell.owner === 'B' ? 'owned-b' : ''} ${gameState?.selectedCell === i ? 'selected-cell' : ''} ${isMyTurn && !isAnswering && !cell.owner ? 'clickable' : ''}`}
                  onClick={() => { if (!gameState || gameState.state !== 'selecting') return; if (myTeam !== gameState.currentTurn) return; if (!cell || cell.owner !== null) return; socket.emit('huroof:select_cell', { cellIndex: i }); }}
                  disabled={isAnswering || !isMyTurn || !!cell.owner}
                >
                  {cell.letter}
                </button>
              ))}
            </div>
            <div className="border-label right-label">🟠<br/>البرتقالي</div>
          </div>
          <div className="border-label bottom-label">🟢 الفريق الأخضر</div>
        </div>
        {isAnswering && cellSelected && (
          <div className="question-panel card pop-in">
            <div className="q-letter-badge">{cellSelected.letter}</div>
            <p className="question-text">{cellSelected.question?.text}</p>
            <div className="options-grid">
              {cellSelected.question?.options?.map((opt, i) => (
                <button key={i} className={`option-btn ${selectedAnswer === i ? 'answered' : ''}`} onClick={() => { setSelectedAnswer(i); socket.emit('huroof:answer', { answerIndex: i }); }} disabled={selectedAnswer !== null || !isMyTurn}>{opt}</button>
              ))}
            </div>
            {!isMyTurn && <p className="waiting-answer pulse">ينتظر إجابة الفريق الآخر...</p>}
          </div>
        )}
        <div className="teams-legend">
          <div className="legend-item legend-a">🟢 الفريق الأخضر: الأعلى ← الأسفل</div>
          <div className="legend-item legend-b">🟠 الفريق البرتقالي: اليمين ← اليسار</div>
        </div>
      </div>
    );
  }

  if (roomScreen === 'gameover') {
    const winnerTeam = gameOver?.winner;
    const isMyTeamWinner = myTeam === winnerTeam;
    return (
      <div className="page asbiq-gameover">
        <div className="gameover-hero pop-in">
          <div className="gameover-trophy">{isMyTeamWinner ? '🏆' : '🎮'}</div>
          <h1 className={winnerTeam === 'A' ? 'winner-a' : 'winner-b'}>
            فاز {winnerTeam === 'A' ? '🟢 الفريق الأخضر' : '🟠 الفريق البرتقالي'}!
          </h1>
          {isMyTeamWinner && <p className="congrats-msg">🎉 مبروك لفريقك!</p>}
        </div>
        {gameState?.grid && (
          <div className="final-grid-wrap">
            <div className="huroof-grid final-grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
              {gameState.grid.map((cell, i) => (
                <div key={i} className={`grid-cell ${cell.owner === 'A' ? 'owned-a' : cell.owner === 'B' ? 'owned-b' : ''}`}>{cell.letter}</div>
              ))}
            </div>
          </div>
        )}
        <button className="btn-primary" onClick={() => navigate('/')}>العودة للرئيسية</button>
      </div>
    );
  }

  return null;
}
