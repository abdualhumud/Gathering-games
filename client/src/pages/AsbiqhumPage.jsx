import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import Timer from '../components/Timer';
import Scoreboard from '../components/Scoreboard';
import './AsbiqhumPage.css';

const QUESTION_TIME = 20;

export default function AsbiqhumPage() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState('setup'); // setup | lobby | question | buzzed | result | gameover
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

  useEffect(() => {
    socket.connect();
    setMyId(socket.id);

    socket.on('connect', () => setMyId(socket.id));

    socket.on('asbiqhum:created', ({ roomCode, isHost, state }) => {
      setRoomCode(roomCode);
      setIsHost(isHost);
      setGameState(state);
      setScreen('lobby');
    });

    socket.on('asbiqhum:joined', ({ roomCode, isHost, state }) => {
      setRoomCode(roomCode);
      setIsHost(isHost);
      setGameState(state);
      setScreen('lobby');
    });

    socket.on('asbiqhum:player_joined', ({ state }) => setGameState(state));
    socket.on('asbiqhum:player_left', ({ state }) => setGameState(state));

    socket.on('asbiqhum:question', (data) => {
      setQuestion(data);
      setBuzzedInfo(null);
      setAnswerResult(null);
      setTimeUpInfo(null);
      setSelectedAnswer(null);
      setTimerRunning(true);
      setScreen('question');
    });

    socket.on('asbiqhum:buzzed', (data) => {
      setBuzzedInfo(data);
      setTimerRunning(false);
      setScreen('buzzed');
    });

    socket.on('asbiqhum:answer_result', (data) => {
      setAnswerResult(data);
      setTimerRunning(false);
      setScreen('result');
    });

    socket.on('asbiqhum:time_up', (data) => {
      setTimeUpInfo(data);
      setTimerRunning(false);
      setScreen('result');
    });

    socket.on('asbiqhum:game_over', (data) => {
      setFinalResults(data);
      setScreen('gameover');
    });

    socket.on('error', ({ message }) => setError(message));

    return () => {
      socket.off('connect');
      socket.off('asbiqhum:created');
      socket.off('asbiqhum:joined');
      socket.off('asbiqhum:player_joined');
      socket.off('asbiqhum:player_left');
      socket.off('asbiqhum:question');
      socket.off('asbiqhum:buzzed');
      socket.off('asbiqhum:answer_result');
      socket.off('asbiqhum:time_up');
      socket.off('asbiqhum:game_over');
      socket.off('error');
      socket.disconnect();
    };
  }, []);

  const createRoom = () => {
    if (!playerName.trim()) return setError('أدخل اسمك');
    setError('');
    socket.emit('asbiqhum:create', { playerName: playerName.trim() });
  };

  const joinRoom = () => {
    if (!playerName.trim()) return setError('أدخل اسمك');
    if (!joinCode.trim()) return setError('أدخل رمز الغرفة');
    setError('');
    socket.emit('asbiqhum:join', { roomCode: joinCode.trim(), playerName: playerName.trim() });
  };

  const startGame = () => socket.emit('asbiqhum:start');
  const buzz = () => socket.emit('asbiqhum:buzz');
  const submitAnswer = (idx) => {
    setSelectedAnswer(idx);
    socket.emit('asbiqhum:answer', { answerIndex: idx });
  };

  const amBuzzed = buzzedInfo?.playerId === myId;
  const scores = answerResult?.scores || timeUpInfo?.scores || gameState?.players || [];

  if (screen === 'setup') {
    return (
      <div className="page asbiq-setup">
        <button className="back-btn" onClick={() => navigate('/')}>← العودة</button>
        <div className="setup-card card pop-in">
          <div className="setup-icon">⚡</div>
          <h1>اسبقهم</h1>
          <p className="setup-desc">لعبة ثقافية سريعة — اضغط الجرس أولاً وأجب بشكل صحيح للفوز</p>

          <input
            className="input-field"
            placeholder="اسمك"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            maxLength={20}
          />

          <div className="setup-actions">
            <button className="btn-primary" onClick={createRoom}>إنشاء غرفة</button>
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
    return (
      <div className="page asbiq-lobby">
        <div className="lobby-card card">
          <h2>غرفة الانتظار</h2>
          <div className="room-code-display">
            <span>رمز الغرفة:</span>
            <strong className="room-code">{roomCode}</strong>
          </div>
          <p className="lobby-hint">شارك الرمز مع أصدقائك للانضمام</p>

          <div className="players-list">
            <h3>اللاعبون ({gameState?.players?.length || 0})</h3>
            {gameState?.players?.map(p => (
              <div key={p.id} className="player-item">
                <span>{p.id === gameState.host ? '👑 ' : '👤 '}{p.name}</span>
              </div>
            ))}
          </div>

          {isHost ? (
            <button
              className="btn-primary start-btn"
              onClick={startGame}
              disabled={gameState?.players?.length < 2}
            >
              {gameState?.players?.length < 2 ? 'انتظر لاعباً آخر...' : 'ابدأ اللعبة ⚡'}
            </button>
          ) : (
            <p className="waiting-msg pulse">انتظار المضيف لبدء اللعبة...</p>
          )}
        </div>
      </div>
    );
  }

  if (screen === 'question' || screen === 'buzzed') {
    const iAmBuzzed = screen === 'buzzed' && amBuzzed;
    return (
      <div className="page asbiq-question">
        <div className="question-header">
          <span className="q-counter">سؤال {question?.questionNumber} / {question?.totalQuestions}</span>
          <Timer duration={QUESTION_TIME} running={timerRunning} />
          <span className="q-category">{question?.question?.category}</span>
        </div>

        <div className="question-card card pop-in">
          <p className="question-text">{question?.question?.text}</p>
        </div>

        {screen === 'question' && (
          <button className="buzz-btn" onClick={buzz}>
            🔔 اسبقهم!
          </button>
        )}

        {screen === 'buzzed' && (
          <div className="buzzed-info pop-in">
            <div className="buzzed-banner">
              {amBuzzed ? '🎯 أنت ضغطت الجرس أولاً!' : `⚡ ${buzzedInfo?.playerName} ضغط الجرس!`}
            </div>
            {iAmBuzzed && (
              <div className="options-grid">
                {question?.question?.options?.map((opt, i) => (
                  <button
                    key={i}
                    className="option-btn"
                    onClick={() => submitAnswer(i)}
                    disabled={selectedAnswer !== null}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
            {!iAmBuzzed && <p className="waiting-answer pulse">ينتظر إجابة {buzzedInfo?.playerName}...</p>}
          </div>
        )}

        <div className="side-scores">
          <Scoreboard players={scores} highlightId={myId} />
        </div>
      </div>
    );
  }

  if (screen === 'result') {
    const correct = answerResult?.isCorrect;
    const timeUp = !!timeUpInfo;
    return (
      <div className="page asbiq-result">
        <div className={`result-banner pop-in ${correct ? 'correct' : timeUp ? 'timeout' : 'wrong'}`}>
          {timeUp ? '⏰ انتهى الوقت!' : correct ? `✅ إجابة صحيحة! +${answerResult.pointsEarned}` : `❌ إجابة خاطئة`}
        </div>
        <div className="correct-answer card">
          <span>الإجابة الصحيحة:</span>
          <strong>{answerResult?.correctAnswer || timeUpInfo?.correctAnswer}</strong>
        </div>
        <div className="result-scores card">
          <h3>النقاط</h3>
          <Scoreboard players={scores} highlightId={myId} />
        </div>
        <p className="next-hint pulse">السؤال التالي قريباً...</p>
      </div>
    );
  }

  if (screen === 'gameover') {
    const winner = finalResults?.winner;
    const isWinner = winner?.id === myId;
    return (
      <div className="page asbiq-gameover">
        <div className="gameover-hero pop-in">
          <div className="gameover-trophy">{isWinner ? '🏆' : '🎮'}</div>
          <h1>{isWinner ? 'أنت الفائز!' : `فاز ${winner?.name}!`}</h1>
        </div>
        <div className="final-scores card">
          <h3>النتائج النهائية</h3>
          <Scoreboard players={finalResults?.results || []} highlightId={myId} />
        </div>
        <button className="btn-primary" onClick={() => navigate('/')}>العودة للرئيسية</button>
      </div>
    );
  }

  return null;
}
