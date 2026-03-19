import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import Timer from '../components/Timer';
import './HuroofPage.css';

const ANSWER_TIME = 30;

export default function HuroofPage() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState('setup');
  const [playerName, setPlayerName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('A');
  const [gridSize, setGridSize] = useState('medium');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [cellSelected, setCellSelected] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [timeUpInfo, setTimeUpInfo] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [myId, setMyId] = useState(null);
  const [error, setError] = useState('');
  const [timerRunning, setTimerRunning] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [resultMessage, setResultMessage] = useState(null);

  useEffect(() => {
    socket.connect();
    setMyId(socket.id);
    socket.on('connect', () => setMyId(socket.id));

    socket.on('huroof:created', ({ roomCode, isHost, state }) => {
      setRoomCode(roomCode);
      setIsHost(isHost);
      setGameState(state);
      setScreen('lobby');
    });

    socket.on('huroof:joined', ({ roomCode, isHost, state }) => {
      setRoomCode(roomCode);
      setIsHost(isHost);
      setGameState(state);
      setScreen('lobby');
    });

    socket.on('huroof:player_joined', ({ state }) => setGameState(state));
    socket.on('huroof:player_left', ({ state }) => setGameState(state));

    socket.on('huroof:game_started', (data) => {
      setGameState(s => ({ ...s, ...data, state: 'selecting' }));
      setScreen('game');
      setGameOver(null);
      setResultMessage(null);
    });

    socket.on('huroof:cell_selected', (data) => {
      setCellSelected(data);
      setSelectedAnswer(null);
      setResultMessage(null);
      setTimerRunning(true);
      setGameState(s => ({ ...s, state: 'answering', selectedCell: data.cellIndex }));
    });

    socket.on('huroof:answer_result', (data) => {
      setTimerRunning(false);
      setResultMessage({ isCorrect: data.isCorrect, correctAnswer: data.correctAnswer });
      setGameState(s => ({ ...s, grid: data.grid, currentTurn: data.nextTurn, state: 'selecting', selectedCell: null }));
      setCellSelected(null);
      setSelectedAnswer(null);
      // Clear result after 2s
      setTimeout(() => setResultMessage(null), 2500);
    });

    socket.on('huroof:time_up', (data) => {
      setTimerRunning(false);
      setResultMessage({ isCorrect: false, timeUp: true, correctAnswer: data.correctAnswer });
      setGameState(s => ({ ...s, grid: data.grid, currentTurn: data.nextTurn, state: 'selecting', selectedCell: null }));
      setCellSelected(null);
      setSelectedAnswer(null);
      setTimeout(() => setResultMessage(null), 2500);
    });

    socket.on('huroof:game_over', (data) => {
      setTimerRunning(false);
      setGameState(s => ({ ...s, grid: data.grid, state: 'results' }));
      setGameOver(data);
      setScreen('gameover');
    });

    socket.on('error', ({ message }) => setError(message));

    return () => {
      socket.off('connect');
      ['created', 'joined', 'player_joined', 'player_left', 'game_started',
        'cell_selected', 'answer_result', 'time_up', 'game_over'].forEach(e => socket.off(`huroof:${e}`));
      socket.off('error');
      socket.disconnect();
    };
  }, []);

  const createRoom = () => {
    if (!playerName.trim()) return setError('أدخل اسمك');
    setError('');
    socket.emit('huroof:create', { playerName: playerName.trim(), team: selectedTeam, gridSize });
  };

  const joinRoom = () => {
    if (!playerName.trim()) return setError('أدخل اسمك');
    if (!joinCode.trim()) return setError('أدخل رمز الغرفة');
    setError('');
    socket.emit('huroof:join', { roomCode: joinCode.trim(), playerName: playerName.trim(), team: selectedTeam });
  };

  const startGame = () => socket.emit('huroof:start');

  const selectCell = (index) => {
    if (!gameState) return;
    if (gameState.state !== 'selecting') return;
    const myTeam = gameState.players?.[myId]?.team;
    if (myTeam !== gameState.currentTurn) return;
    const cell = gameState.grid?.[index];
    if (!cell || cell.owner !== null) return;
    socket.emit('huroof:select_cell', { cellIndex: index });
  };

  const submitAnswer = (idx) => {
    setSelectedAnswer(idx);
    socket.emit('huroof:answer', { answerIndex: idx });
  };

  const myTeam = gameState?.players?.[myId]?.team;
  const isMyTurn = myTeam === gameState?.currentTurn;
  const n = gameState?.gridN || 5;

  if (screen === 'setup') {
    return (
      <div className="page huroof-setup">
        <button className="back-btn" onClick={() => navigate('/')}>← العودة</button>
        <div className="setup-card card pop-in">
          <div className="setup-icon">🔤</div>
          <h1>حروف</h1>
          <p className="setup-desc">فريقان يتنافسان على ربط مسار عبر شبكة الحروف</p>

          <input
            className="input-field"
            placeholder="اسمك"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            maxLength={20}
          />

          <div className="team-select">
            <label>اختر فريقك:</label>
            <div className="team-btns">
              <button
                className={`team-btn team-a ${selectedTeam === 'A' ? 'selected' : ''}`}
                onClick={() => setSelectedTeam('A')}
              >🟢 الأخضر</button>
              <button
                className={`team-btn team-b ${selectedTeam === 'B' ? 'selected' : ''}`}
                onClick={() => setSelectedTeam('B')}
              >🟠 البرتقالي</button>
            </div>
          </div>

          <div className="grid-size-select">
            <label>حجم الشبكة:</label>
            <div className="size-btns">
              {['small', 'medium', 'large'].map(s => (
                <button
                  key={s}
                  className={`size-btn ${gridSize === s ? 'selected' : ''}`}
                  onClick={() => setGridSize(s)}
                >
                  {s === 'small' ? '4×4' : s === 'medium' ? '5×5' : '6×6'}
                </button>
              ))}
            </div>
          </div>

          <div className="setup-actions">
            <button className="btn-green" onClick={createRoom}>إنشاء غرفة</button>
            <span className="divider">أو</span>
            <div className="join-row">
              <input
                className="input-field join-input"
                placeholder="رمز الغرفة"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                style={{ textAlign: 'center', letterSpacing: 4, fontSize: '1.2rem' }}
              />
              <button className="btn-secondary" onClick={joinRoom}>انضم</button>
            </div>
          </div>
          {error && <div className="error-msg shake">{error}</div>}
        </div>
      </div>
    );
  }

  if (screen === 'lobby') {
    const teamA = Object.values(gameState?.players || {}).filter(p => p.team === 'A');
    const teamB = Object.values(gameState?.players || {}).filter(p => p.team === 'B');
    return (
      <div className="page huroof-lobby">
        <div className="lobby-card card">
          <h2>غرفة الانتظار</h2>
          <div className="room-code-display">
            <span>رمز الغرفة:</span>
            <strong className="room-code">{roomCode}</strong>
          </div>
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
          {isHost ? (
            <button className="btn-green start-btn" onClick={startGame}>ابدأ اللعبة 🔤</button>
          ) : (
            <p className="waiting-msg pulse">انتظار المضيف لبدء اللعبة...</p>
          )}
        </div>
      </div>
    );
  }

  if (screen === 'game') {
    const grid = gameState?.grid || [];
    const currentTurn = gameState?.currentTurn;
    const isAnswering = gameState?.state === 'answering';

    return (
      <div className="huroof-game-page">
        {/* Header */}
        <div className="huroof-header">
          <div className={`turn-indicator ${currentTurn === 'A' ? 'turn-a' : 'turn-b'}`}>
            {currentTurn === 'A' ? '🟢' : '🟠'}
            {isMyTurn ? 'دورك!' : `دور ${currentTurn === 'A' ? 'الأخضر' : 'البرتقالي'}`}
          </div>
          {isAnswering && <Timer duration={ANSWER_TIME} running={timerRunning} />}
        </div>

        {/* Result flash */}
        {resultMessage && (
          <div className={`result-flash pop-in ${resultMessage.isCorrect ? 'correct' : 'wrong'}`}>
            {resultMessage.timeUp ? '⏰ انتهى الوقت!' : resultMessage.isCorrect ? '✅ إجابة صحيحة!' : `❌ خطأ — الصواب: ${resultMessage.correctAnswer}`}
          </div>
        )}

        {/* Grid */}
        <div className="grid-container">
          {/* Top border label */}
          <div className="border-label top-label">🟢 الفريق الأخضر</div>
          <div className="grid-row-wrap">
            <div className="border-label left-label">🟠<br/>البرتقالي</div>
            <div
              className="huroof-grid"
              style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
            >
              {grid.map((cell, i) => (
                <button
                  key={i}
                  className={`grid-cell ${cell.owner === 'A' ? 'owned-a' : cell.owner === 'B' ? 'owned-b' : ''} ${gameState?.selectedCell === i ? 'selected-cell' : ''} ${isMyTurn && !isAnswering && !cell.owner ? 'clickable' : ''}`}
                  onClick={() => selectCell(i)}
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

        {/* Question panel */}
        {isAnswering && cellSelected && (
          <div className="question-panel card pop-in">
            <div className="q-letter-badge">{cellSelected.letter}</div>
            <p className="question-text">{cellSelected.question?.text}</p>
            <div className="options-grid">
              {cellSelected.question?.options?.map((opt, i) => (
                <button
                  key={i}
                  className={`option-btn ${selectedAnswer === i ? 'answered' : ''}`}
                  onClick={() => submitAnswer(i)}
                  disabled={selectedAnswer !== null || !isMyTurn}
                >
                  {opt}
                </button>
              ))}
            </div>
            {!isMyTurn && <p className="waiting-answer pulse">ينتظر إجابة الفريق الآخر...</p>}
          </div>
        )}

        {/* Teams legend */}
        <div className="teams-legend">
          <div className="legend-item legend-a">🟢 الفريق الأخضر: الأعلى ← الأسفل</div>
          <div className="legend-item legend-b">🟠 الفريق البرتقالي: اليمين ← اليسار</div>
        </div>
      </div>
    );
  }

  if (screen === 'gameover') {
    const winnerTeam = gameOver?.winner;
    const isMyTeamWinner = myTeam === winnerTeam;
    return (
      <div className="page asbiq-gameover">
        <div className="gameover-hero pop-in">
          <div className="gameover-trophy">{isMyTeamWinner ? '🏆' : '🎮'}</div>
          <h1 style={{ color: winnerTeam === 'A' ? 'var(--green)' : 'var(--orange)' }}>
            فاز {winnerTeam === 'A' ? '🟢 الفريق الأخضر' : '🟠 الفريق البرتقالي'}!
          </h1>
          {isMyTeamWinner && <p style={{ color: 'var(--gold)', fontSize: '1.2rem', marginTop: 8 }}>🎉 مبروك لفريقك!</p>}
        </div>

        {/* Final grid */}
        {gameState?.grid && (
          <div className="final-grid-wrap">
            <div
              className="huroof-grid final-grid"
              style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
            >
              {gameState.grid.map((cell, i) => (
                <div
                  key={i}
                  className={`grid-cell ${cell.owner === 'A' ? 'owned-a' : cell.owner === 'B' ? 'owned-b' : ''}`}
                >
                  {cell.letter}
                </div>
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
