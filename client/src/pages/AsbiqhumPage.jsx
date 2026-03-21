import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import { getRandomQuestions } from '../questions';
import Timer from '../components/Timer';
import Scoreboard from '../components/Scoreboard';
import './AsbiqhumPage.css';

const QUESTION_TIME = 20;
const BASE_POINTS = 100;
const WRONG_PENALTY = -20;
const QUESTIONS_PER_GAME = 10;

// ─── Local game logic ────────────────────────────────────────────────────────

function useLocalGame() {
  const [screen, setScreen] = useState('setup'); // setup | question | buzzed | result | gameover
  const [players, setPlayers] = useState([]);
  const [nameInput, setNameInput] = useState('');
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [buzzedIdx, setBuzzedIdx] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [timeUpInfo, setTimeUpInfo] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const questionStartTime = useRef(null);

  const addPlayer = () => {
    const name = nameInput.trim();
    if (!name) return;
    if (players.find(p => p.name === name)) return;
    setPlayers(prev => [...prev, { name, score: 0 }]);
    setNameInput('');
  };

  const removePlayer = (name) => setPlayers(prev => prev.filter(p => p.name !== name));

  const startGame = () => {
    const qs = getRandomQuestions(QUESTIONS_PER_GAME);
    setQuestions(qs);
    setQIndex(0);
    setPlayers(prev => prev.map(p => ({ ...p, score: 0 })));
    setBuzzedIdx(null);
    setAnswerResult(null);
    setTimeUpInfo(null);
    setSelectedAnswer(null);
    questionStartTime.current = Date.now();
    setTimerRunning(true);
    setScreen('question');
  };

  const buzz = (playerIdx) => {
    if (screen !== 'question') return;
    setTimerRunning(false);
    setBuzzedIdx(playerIdx);
    setScreen('buzzed');
  };

  const submitAnswer = (answerIdx) => {
    if (screen !== 'buzzed' || buzzedIdx === null) return;
    setSelectedAnswer(answerIdx);
    const q = questions[qIndex];
    const timeElapsed = (Date.now() - questionStartTime.current) / 1000;
    const timeRemaining = Math.max(0, QUESTION_TIME - timeElapsed);
    const isCorrect = q.options[answerIdx] === q.answer;
    let points = 0;
    if (isCorrect) {
      points = Math.max(10, Math.round(BASE_POINTS * (timeRemaining / QUESTION_TIME)));
    } else {
      points = WRONG_PENALTY;
    }
    const updatedPlayers = players.map((p, i) =>
      i === buzzedIdx ? { ...p, score: Math.max(0, p.score + points) } : p
    );
    setPlayers(updatedPlayers);
    setAnswerResult({ isCorrect, pointsEarned: points, correctAnswer: q.answer, scores: updatedPlayers });
    setTimerRunning(false);
    setScreen('result');
  };

  const timeUp = () => {
    if (screen !== 'question') return;
    setTimerRunning(false);
    setTimeUpInfo({ correctAnswer: questions[qIndex]?.answer, scores: players });
    setScreen('result');
  };

  const nextQuestion = () => {
    const next = qIndex + 1;
    if (next >= questions.length) {
      setScreen('gameover');
      return;
    }
    setQIndex(next);
    setBuzzedIdx(null);
    setAnswerResult(null);
    setTimeUpInfo(null);
    setSelectedAnswer(null);
    questionStartTime.current = Date.now();
    setTimerRunning(true);
    setScreen('question');
  };

  const reset = () => {
    setScreen('setup');
    setPlayers([]);
    setQIndex(0);
    setBuzzedIdx(null);
    setAnswerResult(null);
    setTimeUpInfo(null);
    setSelectedAnswer(null);
    setTimerRunning(false);
  };

  const currentQuestion = questions[qIndex];
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return {
    screen, players, nameInput, setNameInput,
    addPlayer, removePlayer, startGame,
    currentQuestion, qIndex, buzzedIdx, buzz,
    submitAnswer, answerResult, timeUpInfo, timeUp,
    selectedAnswer, timerRunning, nextQuestion,
    reset, sortedPlayers,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AsbiqhumPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState(null); // null | 'local' | 'room'

  // Room mode state
  const [roomScreen, setRoomScreen] = useState('setup');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [question, setQuestion] = useState(null);
  const [buzzedInfo, setBuzzedInfo] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [timeUpInfo, setTimeUpInfo] = useState(null);
  const [finalResults, setFinalResults] = useState(null);
  const [myId, setMyId] = useState(null);
  const [error, setError] = useState('');
  const [timerRunning, setTimerRunning] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);

  const local = useLocalGame();

  // Room socket setup
  useEffect(() => {
    if (mode !== 'room') return;
    socket.connect();
    setMyId(socket.id);
    socket.on('connect', () => setMyId(socket.id));
    socket.on('asbiqhum:created', ({ roomCode, isHost, state }) => { setRoomCode(roomCode); setIsHost(isHost); setGameState(state); setRoomScreen('lobby'); });
    socket.on('asbiqhum:joined', ({ roomCode, isHost, state }) => { setRoomCode(roomCode); setIsHost(isHost); setGameState(state); setRoomScreen('lobby'); });
    socket.on('asbiqhum:player_joined', ({ state }) => setGameState(state));
    socket.on('asbiqhum:player_left', ({ state }) => setGameState(state));
    socket.on('asbiqhum:question', (data) => { setQuestion(data); setBuzzedInfo(null); setAnswerResult(null); setTimeUpInfo(null); setSelectedAnswer(null); setTimerRunning(true); setRoomScreen('question'); });
    socket.on('asbiqhum:buzzed', (data) => { setBuzzedInfo(data); setTimerRunning(false); setRoomScreen('buzzed'); });
    socket.on('asbiqhum:answer_result', (data) => { setAnswerResult(data); setTimerRunning(false); setRoomScreen('result'); });
    socket.on('asbiqhum:time_up', (data) => { setTimeUpInfo(data); setTimerRunning(false); setRoomScreen('result'); });
    socket.on('asbiqhum:game_over', (data) => { setFinalResults(data); setRoomScreen('gameover'); });
    socket.on('error', ({ message }) => setError(message));
    return () => {
      ['connect','asbiqhum:created','asbiqhum:joined','asbiqhum:player_joined','asbiqhum:player_left',
       'asbiqhum:question','asbiqhum:buzzed','asbiqhum:answer_result','asbiqhum:time_up','asbiqhum:game_over','error']
        .forEach(e => socket.off(e));
      socket.disconnect();
    };
  }, [mode]);

  // ── Mode selection ──────────────────────────────────────────────────────────
  if (!mode) {
    return (
      <div className="page asbiq-setup">
        <button className="back-btn" onClick={() => navigate('/')}>← العودة</button>
        <div className="setup-card card pop-in">
          <div className="setup-icon">⚡</div>
          <h1>اسبقهم</h1>
          <p className="setup-desc">لعبة ثقافية سريعة — اضغط الجرس أولاً وأجب بشكل صحيح للفوز</p>
          <div className="mode-buttons">
            <button className="btn-primary mode-btn" onClick={() => setMode('local')}>
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

  // ── LOCAL MODE ──────────────────────────────────────────────────────────────
  if (mode === 'local') {
    if (local.screen === 'setup') {
      return (
        <div className="page asbiq-setup">
          <button className="back-btn" onClick={() => setMode(null)}>← العودة</button>
          <div className="setup-card card pop-in">
            <div className="setup-icon">⚡</div>
            <h1>اسبقهم — محلي</h1>
            <p className="setup-desc">أضف اللاعبين ثم ابدأ اللعبة</p>

            <div className="join-row">
              <input
                className="input-field join-input"
                placeholder="اسم اللاعب"
                value={local.nameInput}
                onChange={e => local.setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && local.addPlayer()}
                maxLength={20}
              />
              <button className="btn-secondary" onClick={local.addPlayer}>إضافة</button>
            </div>

            <div className="players-list" style={{ marginTop: 12 }}>
              {local.players.map(p => (
                <div key={p.name} className="player-item" style={{ justifyContent: 'space-between' }}>
                  <span>👤 {p.name}</span>
                  <button onClick={() => local.removePlayer(p.name)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
                </div>
              ))}
            </div>

            <button
              className="btn-primary"
              style={{ marginTop: 16 }}
              onClick={local.startGame}
              disabled={local.players.length < 2}
            >
              {local.players.length < 2 ? 'أضف لاعبَين على الأقل' : 'ابدأ اللعبة ⚡'}
            </button>
          </div>
        </div>
      );
    }

    if (local.screen === 'question' || local.screen === 'buzzed') {
      const q = local.currentQuestion;
      return (
        <div className="page asbiq-question">
          <div className="question-header">
            <span className="q-counter">سؤال {local.qIndex + 1} / {QUESTIONS_PER_GAME}</span>
            <Timer duration={QUESTION_TIME} running={local.timerRunning} onEnd={local.timeUp} />
            <span className="q-category">{q?.category}</span>
          </div>

          <div className="question-card card pop-in">
            <p className="question-text">{q?.text}</p>
          </div>

          {local.screen === 'question' && (
            <div className="local-buzz-buttons">
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: 8 }}>اضغط زرك للإجابة أولاً!</p>
              <div className="buzz-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {local.players.map((p, i) => (
                  <button key={p.name} className="buzz-btn player-buzz" onClick={() => local.buzz(i)}>
                    🔔 {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {local.screen === 'buzzed' && (
            <div className="buzzed-info pop-in">
              <div className="buzzed-banner">🎯 {local.players[local.buzzedIdx]?.name} ضغط الجرس أولاً!</div>
              <div className="options-grid">
                {q?.options?.map((opt, i) => (
                  <button
                    key={i}
                    className="option-btn"
                    onClick={() => local.submitAnswer(i)}
                    disabled={local.selectedAnswer !== null}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="side-scores">
            <Scoreboard players={local.players.map(p => ({ id: p.name, name: p.name, score: p.score }))} />
          </div>
        </div>
      );
    }

    if (local.screen === 'result') {
      const correct = local.answerResult?.isCorrect;
      const timeUp = !!local.timeUpInfo;
      const scores = (local.answerResult?.scores || local.timeUpInfo?.scores || local.players)
        .map(p => ({ id: p.name, name: p.name, score: p.score }));
      return (
        <div className="page asbiq-result">
          <div className={`result-banner pop-in ${correct ? 'correct' : timeUp ? 'timeout' : 'wrong'}`}>
            {timeUp ? '⏰ انتهى الوقت!' : correct ? `✅ إجابة صحيحة! +${local.answerResult.pointsEarned}` : '❌ إجابة خاطئة'}
          </div>
          <div className="correct-answer card">
            <span>الإجابة الصحيحة:</span>
            <strong>{local.answerResult?.correctAnswer || local.timeUpInfo?.correctAnswer}</strong>
          </div>
          <div className="result-scores card">
            <h3>النقاط</h3>
            <Scoreboard players={scores} />
          </div>
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={local.nextQuestion}>
            {local.qIndex + 1 >= QUESTIONS_PER_GAME ? 'النتائج النهائية' : 'السؤال التالي ←'}
          </button>
        </div>
      );
    }

    if (local.screen === 'gameover') {
      const sorted = [...local.players].sort((a, b) => b.score - a.score);
      return (
        <div className="page asbiq-gameover">
          <div className="gameover-hero pop-in">
            <div className="gameover-trophy">🏆</div>
            <h1>فاز {sorted[0]?.name}!</h1>
            <p style={{ color: 'var(--gold)' }}>{sorted[0]?.score} نقطة</p>
          </div>
          <div className="final-scores card">
            <h3>النتائج النهائية</h3>
            <Scoreboard players={sorted.map(p => ({ id: p.name, name: p.name, score: p.score }))} />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button className="btn-secondary" onClick={local.reset}>العب مجدداً</button>
            <button className="btn-primary" onClick={() => navigate('/')}>الرئيسية</button>
          </div>
        </div>
      );
    }
  }

  // ── ROOM MODE ───────────────────────────────────────────────────────────────
  const amBuzzed = buzzedInfo?.playerId === myId;
  const scores = answerResult?.scores || timeUpInfo?.scores || gameState?.players || [];

  if (roomScreen === 'setup') {
    return (
      <div className="page asbiq-setup">
        <button className="back-btn" onClick={() => { setMode(null); setRoomScreen('setup'); }}>← العودة</button>
        <div className="setup-card card pop-in">
          <div className="setup-icon">⚡</div>
          <h1>اسبقهم — غرفة</h1>
          <input className="input-field" placeholder="اسمك" value={playerName} onChange={e => setPlayerName(e.target.value)} maxLength={20} />
          <div className="setup-actions">
            <button className="btn-primary" onClick={() => { if (!playerName.trim()) return setError('أدخل اسمك'); setError(''); socket.emit('asbiqhum:create', { playerName: playerName.trim() }); }}>إنشاء غرفة</button>
            <span className="divider">أو</span>
            <div className="join-row">
              <input className="input-field join-input" placeholder="رمز الغرفة" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={6} style={{ textAlign: 'center', letterSpacing: 4, fontSize: '1.2rem' }} />
              <button className="btn-secondary" onClick={() => { if (!playerName.trim()) return setError('أدخل اسمك'); if (!joinCode.trim()) return setError('أدخل رمز الغرفة'); setError(''); socket.emit('asbiqhum:join', { roomCode: joinCode.trim(), playerName: playerName.trim() }); }}>انضم</button>
            </div>
          </div>
          {error && <div className="error-msg shake">{error}</div>}
        </div>
      </div>
    );
  }

  if (roomScreen === 'lobby') {
    return (
      <div className="page asbiq-lobby">
        <div className="lobby-card card">
          <h2>غرفة الانتظار</h2>
          <div className="room-code-display"><span>رمز الغرفة:</span><strong className="room-code">{roomCode}</strong></div>
          <p className="lobby-hint">شارك الرمز مع أصدقائك للانضمام</p>
          <div className="players-list">
            <h3>اللاعبون ({gameState?.players?.length || 0})</h3>
            {gameState?.players?.map(p => <div key={p.id} className="player-item"><span>{p.id === gameState.host ? '👑 ' : '👤 '}{p.name}</span></div>)}
          </div>
          {isHost ? (
            <button className="btn-primary start-btn" onClick={() => socket.emit('asbiqhum:start')} disabled={gameState?.players?.length < 2}>
              {gameState?.players?.length < 2 ? 'انتظر لاعباً آخر...' : 'ابدأ اللعبة ⚡'}
            </button>
          ) : <p className="waiting-msg pulse">انتظار المضيف لبدء اللعبة...</p>}
        </div>
      </div>
    );
  }

  if (roomScreen === 'question' || roomScreen === 'buzzed') {
    const iAmBuzzed = roomScreen === 'buzzed' && amBuzzed;
    return (
      <div className="page asbiq-question">
        <div className="question-header">
          <span className="q-counter">سؤال {question?.questionNumber} / {question?.totalQuestions}</span>
          <Timer duration={QUESTION_TIME} running={timerRunning} />
          <span className="q-category">{question?.question?.category}</span>
        </div>
        <div className="question-card card pop-in"><p className="question-text">{question?.question?.text}</p></div>
        {roomScreen === 'question' && <button className="buzz-btn" onClick={() => socket.emit('asbiqhum:buzz')}>🔔 اسبقهم!</button>}
        {roomScreen === 'buzzed' && (
          <div className="buzzed-info pop-in">
            <div className="buzzed-banner">{amBuzzed ? '🎯 أنت ضغطت الجرس أولاً!' : `⚡ ${buzzedInfo?.playerName} ضغط الجرس!`}</div>
            {iAmBuzzed && (
              <div className="options-grid">
                {question?.question?.options?.map((opt, i) => (
                  <button key={i} className="option-btn" onClick={() => { setSelectedAnswer(i); socket.emit('asbiqhum:answer', { answerIndex: i }); }} disabled={selectedAnswer !== null}>{opt}</button>
                ))}
              </div>
            )}
            {!iAmBuzzed && <p className="waiting-answer pulse">ينتظر إجابة {buzzedInfo?.playerName}...</p>}
          </div>
        )}
        <div className="side-scores"><Scoreboard players={scores} highlightId={myId} /></div>
      </div>
    );
  }

  if (roomScreen === 'result') {
    const correct = answerResult?.isCorrect;
    const timeUp = !!timeUpInfo;
    return (
      <div className="page asbiq-result">
        <div className={`result-banner pop-in ${correct ? 'correct' : timeUp ? 'timeout' : 'wrong'}`}>
          {timeUp ? '⏰ انتهى الوقت!' : correct ? `✅ إجابة صحيحة! +${answerResult.pointsEarned}` : '❌ إجابة خاطئة'}
        </div>
        <div className="correct-answer card"><span>الإجابة الصحيحة:</span><strong>{answerResult?.correctAnswer || timeUpInfo?.correctAnswer}</strong></div>
        <div className="result-scores card"><h3>النقاط</h3><Scoreboard players={scores} highlightId={myId} /></div>
        <p className="next-hint pulse">السؤال التالي قريباً...</p>
      </div>
    );
  }

  if (roomScreen === 'gameover') {
    const winner = finalResults?.winner;
    const isWinner = winner?.id === myId;
    return (
      <div className="page asbiq-gameover">
        <div className="gameover-hero pop-in">
          <div className="gameover-trophy">{isWinner ? '🏆' : '🎮'}</div>
          <h1>{isWinner ? 'أنت الفائز!' : `فاز ${winner?.name}!`}</h1>
        </div>
        <div className="final-scores card"><h3>النتائج النهائية</h3><Scoreboard players={finalResults?.results || []} highlightId={myId} /></div>
        <button className="btn-primary" onClick={() => navigate('/')}>العودة للرئيسية</button>
      </div>
    );
  }

  return null;
}
