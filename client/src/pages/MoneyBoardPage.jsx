import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import { questions as allQuestions } from '../questions';
import Timer from '../components/Timer';
import './MoneyBoardPage.css';

// ── Constants ─────────────────────────────────────────────────────────────────
const VALID_CATEGORIES = [
  'جغرافيا عربية', 'حيوانات وطبيعة', 'ثقافة وفنون', 'تاريخ عالمي',
  'رياضة وأولمبياد', 'أدب عربي ولغة', 'جغرافيا عالمية', 'تكنولوجيا وحاسوب',
  'فيزياء وكيمياء', 'طعام ومطبخ', 'قرآن ومعرفة إسلامية', 'فلك وعلوم الفضاء',
  'معلومات عامة', 'أحياء وجسم الإنسان', 'رياضيات',
];
const POINTS    = [200, 400, 600];
const DIFF_LABEL = ['سهل', 'متوسط', 'صعب'];
const ANSWER_TIME = 30;
const STEAL_TIME  = 15;
const TEAM_NAMES  = { A: 'الفريق الأول', B: 'الفريق الثاني' };
const TEAM_COLORS = { A: 'team-a', B: 'team-b' };

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildLocalBoard(selectedCats) {
  return selectedCats.map(cat => {
    const pool = allQuestions.filter(q => q.category === cat);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const third = Math.max(1, Math.floor(shuffled.length / 3));
    return {
      category: cat,
      cells: POINTS.map((pts, i) => {
        const slice = shuffled.slice(i * third, (i + 1) * third);
        const q = slice.length ? slice[Math.floor(Math.random() * slice.length)] : shuffled[i % shuffled.length];
        return { points: pts, question: q, answered: false, winner: null };
      }),
    };
  });
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

  const totalCells = 18;

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
    setScreen('game');
  };

  const pickCell = (colIdx, rowIdx) => {
    if (phase !== 'pick') return;
    const cell = board[colIdx]?.cells[rowIdx];
    if (!cell || cell.answered) return;
    setActiveCell({ colIdx, rowIdx });
    setActiveTeam(currentTurn);
    setOrigTeam(currentTurn);
    setSelAns(null);
    setPhase('answer');
    setTimer(true);
    setScreen('question');
  };

  const submitAnswer = (answerIdx) => {
    if (phase !== 'answer' && phase !== 'steal') return;
    setTimer(false);
    setSelAns(answerIdx);
    const { colIdx, rowIdx } = activeCell;
    const cell = board[colIdx].cells[rowIdx];
    const isCorrect = cell.question.options[answerIdx] === cell.question.answer;
    _resolveAnswer(isCorrect, cell);
  };

  const timeUp = useCallback(() => {
    if (phase !== 'answer' && phase !== 'steal') return;
    setTimer(false);
    const { colIdx, rowIdx } = activeCell;
    const cell = board[colIdx].cells[rowIdx];
    _resolveAnswer(false, cell);
  }, [phase, activeCell, board]); // eslint-disable-line

  function _resolveAnswer(isCorrect, cell) {
    if (isCorrect) {
      const winner = activeTeam;
      const newTeams = {
        ...teams,
        [winner]: { money: teams[winner].money + cell.points },
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
      setResultInfo({ isCorrect: true, winner, points: cell.points, correctAnswer: cell.question.answer, teams: newTeams });
      setPhase('result');
      setTurn(winner); // winner picks next
      if (newCount >= totalCells) setTimeout(() => setScreen('gameover'), 2200);
      else setTimeout(() => { setScreen('game'); setPhase('pick'); setActiveCell(null); setResultInfo(null); setSelAns(null); }, 2200);
    } else {
      if (phase === 'answer') {
        // Offer steal
        const stealTeam = activeTeam === 'A' ? 'B' : 'A';
        setActiveTeam(stealTeam);
        setPhase('steal');
        setSelAns(null);
        setTimer(true);
        setScreen('question'); // stay on question screen, now in steal mode
      } else {
        // Steal also wrong — no one wins, original team picks next
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
        setResultInfo({ isCorrect: false, winner: null, points: 0, correctAnswer: cell.question.answer, teams });
        setPhase('result');
        setTurn(originalTeam); // original team picks next
        if (newCount >= totalCells) setTimeout(() => setScreen('gameover'), 2200);
        else setTimeout(() => { setScreen('game'); setPhase('pick'); setActiveCell(null); setResultInfo(null); setSelAns(null); }, 2200);
      }
    }
  }

  const reset = () => {
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
  };

  const currentQuestion = activeCell && board
    ? board[activeCell.colIdx]?.cells[activeCell.rowIdx]?.question
    : null;
  const currentPoints = activeCell && board
    ? board[activeCell.colIdx]?.cells[activeCell.rowIdx]?.points
    : 0;

  return {
    screen, teamAName, setTeamAName, teamBName, setTeamBName,
    selected, toggleCategory, startGame,
    board, teams, currentTurn, activeTeam, phase,
    activeCell, currentQuestion, currentPoints,
    submitAnswer, timeUp, timerRunning, selectedAnswer,
    resultInfo, reset, answeredCount, totalCells,
  };
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MoneyBoardPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState(null); // null | 'local' | 'room'
  const local = useLocalGame();

  // Room state
  const [roomScreen, setRoomScreen] = useState('setup'); // setup | lobby | category_select | game | question | gameover
  const [playerName, setPlayerName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('A');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [myId, setMyId] = useState(null);
  const [error, setError] = useState('');
  const [roomSelected, setRoomSelected] = useState([]); // host's category picks
  const [roomCellData, setRoomCellData] = useState(null); // { colIdx, rowIdx, question, points, activeTeam }
  const [roomResult, setRoomResult] = useState(null);
  const [roomSteal, setRoomSteal] = useState(null);
  const [roomGameOver, setRoomGameOver] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [stealTimerRunning, setStealTimer] = useState(false);
  const [selAns, setSelAns] = useState(null);

  // Room socket
  useEffect(() => {
    if (mode !== 'room') return;
    socket.connect();
    setMyId(socket.id);
    socket.on('connect', () => setMyId(socket.id));
    socket.on('money:created', ({ roomCode: rc, isHost: h, state }) => { setRoomCode(rc); setIsHost(h); setGameState(state); setRoomScreen('lobby'); });
    socket.on('money:joined',  ({ roomCode: rc, isHost: h, state }) => { setRoomCode(rc); setIsHost(h); setGameState(state); setRoomScreen('lobby'); });
    socket.on('money:player_joined', ({ state }) => setGameState(state));
    socket.on('money:player_left',   ({ state }) => setGameState(state));
    socket.on('money:game_started',  ({ state }) => { setGameState(state); setRoomCellData(null); setRoomResult(null); setRoomSteal(null); setSelAns(null); setRoomScreen('game'); });
    socket.on('money:cell_selected', (data) => { setRoomCellData(data); setRoomSteal(null); setRoomResult(null); setSelAns(null); setTimerRunning(true); setStealTimer(false); setGameState(s => ({ ...s, activeTeam: data.activeTeam, state: 'question' })); setRoomScreen('question'); });
    socket.on('money:steal_chance',  (data) => { setRoomSteal(data); setTimerRunning(false); setStealTimer(true); setGameState(s => ({ ...s, activeTeam: data.stealTeam, state: 'steal' })); setSelAns(null); });
    socket.on('money:answer_result', (data) => {
      setTimerRunning(false); setStealTimer(false);
      setRoomResult(data);
      setGameState(s => ({ ...s, teams: data.teams, board: data.board, currentTurn: data.nextTurn, activeTeam: null, state: data.gameOver ? 'gameover' : 'playing' }));
      if (!data.gameOver) setTimeout(() => { setRoomScreen('game'); setRoomCellData(null); setRoomResult(null); setRoomSteal(null); setSelAns(null); }, 2500);
    });
    socket.on('money:game_over', (data) => { setRoomGameOver(data); setTimerRunning(false); setStealTimer(false); setRoomScreen('gameover'); });
    socket.on('error', ({ message }) => setError(message));
    return () => {
      ['connect','money:created','money:joined','money:player_joined','money:player_left',
       'money:game_started','money:cell_selected','money:steal_chance','money:answer_result',
       'money:game_over','error'].forEach(e => socket.off(e));
      socket.disconnect();
    };
  }, [mode]);

  // ── Mode selector ─────────────────────────────────────────────────────────
  if (!mode) return (
    <div className="page mb-setup">
      <button className="back-btn" onClick={() => navigate('/')}>← العودة</button>
      <div className="setup-card card pop-in">
        <div className="setup-icon">💰</div>
        <h1>لوحة المال</h1>
        <p className="setup-desc">فريقان يتنافسان — اختر فئة وصعوبة وأجب بشكل صحيح لجمع أكبر قدر من الريالات</p>
        <div className="mode-buttons">
          <button className="btn-primary mode-btn" onClick={() => setMode('local')}>
            🏠 لعب محلي <small>نفس الجهاز — بدون إنترنت</small>
          </button>
          <button className="btn-secondary mode-btn" onClick={() => setMode('room')}>
            🌐 غرفة أونلاين <small>أجهزة منفصلة — يتطلب خادماً</small>
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
        <div className="setup-card card pop-in">
          <div className="setup-icon">💰</div>
          <h1>لوحة المال — محلي</h1>

          <div className="team-names-row">
            <div className="team-name-field team-a-field">
              <label>{TEAM_NAMES.A}</label>
              <input className="input-field" value={local.teamAName} onChange={e => local.setTeamAName(e.target.value)} maxLength={20} />
            </div>
            <div className="team-name-field team-b-field">
              <label>{TEAM_NAMES.B}</label>
              <input className="input-field" value={local.teamBName} onChange={e => local.setTeamBName(e.target.value)} maxLength={20} />
            </div>
          </div>

          <div className="cat-select-section">
            <h3>اختر 6 فئات ({local.selected.length}/6)</h3>
            <div className="cat-grid">
              {VALID_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  className={`cat-chip ${local.selected.includes(cat) ? 'selected' : ''}`}
                  onClick={() => local.toggleCategory(cat)}
                  disabled={!local.selected.includes(cat) && local.selected.length >= 6}
                >
                  {cat}
                  {local.selected.includes(cat) && <span className="cat-num">{local.selected.indexOf(cat) + 1}</span>}
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn-primary"
            className="start-btn-inline"
            onClick={local.startGame}
            disabled={local.selected.length !== 6}
          >
            {local.selected.length < 6 ? `اختر ${6 - local.selected.length} فئات أخرى` : 'ابدأ اللعبة 💰'}
          </button>
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
      </div>
    );

    // ── Question screen ──
    if (local.screen === 'question') {
      const isSteal = local.phase === 'steal';
      const teamName = local.activeTeam === 'A' ? local.teamAName : local.teamBName;
      return (
        <div className="mb-question-page">
          <div className="q-page-header">
            <MoneyScores teams={{ A: { ...local.teams.A, name: local.teamAName }, B: { ...local.teams.B, name: local.teamBName } }} />
            <div className={`points-badge ${isSteal ? 'steal-badge' : ''}`}>
              {isSteal ? `🔀 سرقة — ${teamName}` : `💰 ${local.currentPoints} ريال`}
            </div>
            <Timer
              duration={isSteal ? STEAL_TIME : ANSWER_TIME}
              running={local.timerRunning}
              onEnd={local.timeUp}
              key={isSteal ? 'steal' : 'answer'}
            />
          </div>

          {isSteal && (
            <div className="steal-banner pop-in">
              ⚡ فرصة السرقة! — {teamName}
            </div>
          )}

          <div className="question-card card pop-in">
            <p className="question-text">{local.currentQuestion?.text}</p>
          </div>

          <div className="options-grid">
            {local.currentQuestion?.options?.map((opt, i) => (
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
          onReset={local.reset}
          onHome={() => navigate('/')}
        />
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ROOM MODE
  // ══════════════════════════════════════════════════════════════════════════
  const myTeam = gameState?.players?.[myId]?.team;
  const isMyTurn = myTeam === gameState?.currentTurn;
  const roomActiveTeam = gameState?.activeTeam;
  const isMyTeamActive = myTeam === roomActiveTeam;

  if (roomScreen === 'setup') return (
    <div className="page mb-setup">
      <button className="back-btn" onClick={() => { setMode(null); setRoomScreen('setup'); }}>← العودة</button>
      <div className="setup-card card pop-in">
        <div className="setup-icon">💰</div>
        <h1>لوحة المال — غرفة</h1>
        <input className="input-field" placeholder="اسمك" value={playerName} onChange={e => setPlayerName(e.target.value)} maxLength={20} />
        <div className="team-select">
          <label>اختر فريقك:</label>
          <div className="team-btns">
            <button className={`team-btn team-a-btn ${selectedTeam === 'A' ? 'selected' : ''}`} onClick={() => setSelectedTeam('A')}>🔵 الفريق الأول</button>
            <button className={`team-btn team-b-btn ${selectedTeam === 'B' ? 'selected' : ''}`} onClick={() => setSelectedTeam('B')}>🟠 الفريق الثاني</button>
          </div>
        </div>
        <div className="setup-actions">
          <button className="btn-primary" onClick={() => { if (!playerName.trim()) return setError('أدخل اسمك'); setError(''); socket.emit('money:create', { playerName: playerName.trim(), team: selectedTeam }); }}>إنشاء غرفة</button>
          <span className="divider">أو</span>
          <div className="join-row">
            <input className="input-field join-input room-code-input" placeholder="رمز الغرفة" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={6} />
            <button className="btn-secondary" onClick={() => { if (!playerName.trim()) return setError('أدخل اسمك'); if (!joinCode.trim()) return setError('أدخل رمز الغرفة'); setError(''); socket.emit('money:join', { roomCode: joinCode.trim(), playerName: playerName.trim(), team: selectedTeam }); }}>انضم</button>
          </div>
        </div>
        {error && <div className="error-msg shake">{error}</div>}
      </div>
    </div>
  );

  if (roomScreen === 'lobby') {
    const players = Object.values(gameState?.players || {});
    const teamA = players.filter(p => p.team === 'A');
    const teamB = players.filter(p => p.team === 'B');
    const canStart = teamA.length >= 1 && teamB.length >= 1;
    return (
      <div className="page mb-lobby">
        <div className="lobby-card card">
          <h2>غرفة الانتظار</h2>
          <div className="room-code-display"><span>رمز الغرفة:</span><strong className="room-code">{roomCode}</strong></div>
          <div className="teams-preview">
            <div className="team-preview"><h4>🔵 الفريق الأول ({teamA.length})</h4>{teamA.map(p => <div key={p.name} className="player-item">{p.name}</div>)}</div>
            <div className="team-preview"><h4>🟠 الفريق الثاني ({teamB.length})</h4>{teamB.map(p => <div key={p.name} className="player-item">{p.name}</div>)}</div>
          </div>
          {isHost ? (
            canStart ? (
              <button className="btn-primary start-btn" onClick={() => setRoomScreen('category_select')}>اختر الفئات ←</button>
            ) : (
              <p className="waiting-msg">انتظار لاعب في كل فريق...</p>
            )
          ) : <p className="waiting-msg pulse">انتظار المضيف...</p>}
        </div>
      </div>
    );
  }

  if (roomScreen === 'category_select') return (
    <div className="page mb-setup">
      <div className="setup-card card pop-in" style={{ maxWidth: 560 }}>
        <h2>اختر 6 فئات ({roomSelected.length}/6)</h2>
        <div className="cat-grid">
          {VALID_CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`cat-chip ${roomSelected.includes(cat) ? 'selected' : ''}`}
              onClick={() => setRoomSelected(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : prev.length < 6 ? [...prev, cat] : prev)}
              disabled={!roomSelected.includes(cat) && roomSelected.length >= 6}
            >
              {cat}
              {roomSelected.includes(cat) && <span className="cat-num">{roomSelected.indexOf(cat) + 1}</span>}
            </button>
          ))}
        </div>
        <button
          className="btn-primary"
          style={{ marginTop: 8 }}
          onClick={() => socket.emit('money:start', { selectedCategories: roomSelected })}
          disabled={roomSelected.length !== 6}
        >
          {roomSelected.length < 6 ? `اختر ${6 - roomSelected.length} فئات أخرى` : 'ابدأ اللعبة 💰'}
        </button>
      </div>
    </div>
  );

  if (roomScreen === 'game') {
    const board = gameState?.board ? gameState.board.map((col, ci) => ({
      category: col.category,
      cells: col.cells.map(c => ({ ...c, question: null })), // no question data in board state
    })) : null;
    return (
      <div className="mb-game-page">
        <MoneyBoardHeader
          teams={{ A: { money: gameState?.teams?.A?.money || 0, name: 'الفريق الأول' }, B: { money: gameState?.teams?.B?.money || 0, name: 'الفريق الثاني' } }}
          currentTurn={gameState?.currentTurn}
          phase={isMyTurn ? 'pick' : 'wait'}
          myTeam={myTeam}
        />
        {board && (
          <BoardGrid
            board={gameState.board.map(col => ({
              category: col.category,
              cells: col.cells.map(c => ({ ...c, question: null })),
            }))}
            activeCell={null}
            onPickCell={(ci, ri) => { if (!isMyTurn) return; socket.emit('money:select_cell', { colIdx: ci, rowIdx: ri }); }}
            canPick={isMyTurn && gameState?.state === 'playing'}
            currentTurn={gameState?.currentTurn}
          />
        )}
        {roomResult && (
          <ResultFlash info={roomResult} teamNames={{ A: 'الفريق الأول', B: 'الفريق الثاني' }} />
        )}
        {!isMyTurn && <p className="waiting-msg pulse">انتظار الفريق الآخر ليختار...</p>}
      </div>
    );
  }

  if (roomScreen === 'question') {
    const isSteal = gameState?.state === 'steal';
    const activeTeamName = roomActiveTeam === 'A' ? 'الفريق الأول' : 'الفريق الثاني';
    const canAnswer = isMyTeamActive;
    return (
      <div className="mb-question-page">
        <div className="q-page-header">
          <MoneyScores teams={{ A: { money: gameState?.teams?.A?.money || 0, name: 'الفريق الأول' }, B: { money: gameState?.teams?.B?.money || 0, name: 'الفريق الثاني' } }} />
          <div className={`points-badge ${isSteal ? 'steal-badge' : ''}`}>
            {isSteal ? `🔀 سرقة — ${activeTeamName}` : `💰 ${roomCellData?.points} ريال`}
          </div>
          <Timer
            duration={isSteal ? STEAL_TIME : ANSWER_TIME}
            running={isSteal ? stealTimerRunning : timerRunning}
            key={isSteal ? 'steal' : 'answer'}
          />
        </div>

        {isSteal && (
          <div className="steal-banner pop-in">
            ⚡ فرصة السرقة! — {activeTeamName}
          </div>
        )}

        <div className="question-card card pop-in">
          <p className="question-text">{roomCellData?.question?.text}</p>
        </div>

        {canAnswer ? (
          <div className="options-grid">
            {roomCellData?.question?.options?.map((opt, i) => (
              <button key={i} className={`option-btn ${selAns === i ? 'answered' : ''}`}
                onClick={() => { setSelAns(i); socket.emit('money:answer', { answerIndex: i }); }}
                disabled={selAns !== null}>
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <p className="waiting-msg pulse">ينتظر إجابة {activeTeamName}...</p>
        )}

        {roomResult && <ResultFlash info={roomResult} teamNames={{ A: 'الفريق الأول', B: 'الفريق الثاني' }} />}
      </div>
    );
  }

  if (roomScreen === 'gameover') {
    const aM = roomGameOver?.teams?.A?.money || 0, bM = roomGameOver?.teams?.B?.money || 0;
    const winner = roomGameOver?.winner; // 'A' | 'B' | 'tie'
    return (
      <GameOverScreen
        teams={{ A: { money: aM, name: 'الفريق الأول' }, B: { money: bM, name: 'الفريق الثاني' } }}
        winner={winner === 'tie' ? null : winner}
        isTie={winner === 'tie'}
        myTeam={myTeam}
        onReset={() => navigate('/')}
        onHome={() => navigate('/')}
      />
    );
  }

  return null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MoneyBoardHeader({ teams, currentTurn, phase, myTeam }) {
  const pickingName = teams[currentTurn]?.name;
  return (
    <div className="mb-header">
      <MoneyScores teams={teams} currentTurn={currentTurn} myTeam={myTeam} />
      <div className={`turn-pill ${TEAM_COLORS[currentTurn]}`}>
        {phase === 'pick' ? `دور ${pickingName} — اختر سؤالاً` : ''}
        {phase === 'wait' ? `انتظار ${pickingName}...` : ''}
      </div>
    </div>
  );
}

function MoneyScores({ teams, currentTurn, myTeam }) {
  return (
    <div className="money-scores">
      {['A', 'B'].map(t => (
        <div key={t} className={`money-score-box ${TEAM_COLORS[t]} ${currentTurn === t ? 'active-turn' : ''} ${myTeam === t ? 'my-team' : ''}`}>
          <span className="score-team-name">{teams[t]?.name}</span>
          <span className="score-money">
            <span className="money-icon">💰</span>
            {(teams[t]?.money || 0).toLocaleString('ar-SA')} ريال
          </span>
        </div>
      ))}
    </div>
  );
}

function BoardGrid({ board, activeCell, onPickCell, canPick, currentTurn }) {
  if (!board) return null;
  return (
    <div className="mb-board">
      {/* Category headers */}
      <div className="mb-board-row mb-headers">
        {board.map((col, ci) => (
          <div key={ci} className="mb-header-cell">{col.category}</div>
        ))}
      </div>
      {/* 3 rows: 200 / 400 / 600 */}
      {[0, 1, 2].map(rowIdx => (
        <div key={rowIdx} className="mb-board-row">
          {board.map((col, colIdx) => {
            const cell = col.cells[rowIdx];
            const isActive = activeCell?.colIdx === colIdx && activeCell?.rowIdx === rowIdx;
            return (
              <button
                key={colIdx}
                className={`mb-cell ${cell.answered ? `answered winner-${cell.winner || 'none'}` : ''} ${isActive ? 'active-cell' : ''} ${canPick && !cell.answered ? 'pickable' : ''}`}
                onClick={() => !cell.answered && canPick && onPickCell(colIdx, rowIdx)}
                disabled={cell.answered || !canPick}
              >
                {cell.answered ? (
                  <span className="cell-winner-icon">{cell.winner === 'A' ? '🔵' : cell.winner === 'B' ? '🟠' : '—'}</span>
                ) : (
                  <>
                    <span className="cell-points">{cell.points}</span>
                    <span className="cell-riyal">ريال</span>
                    <span className="cell-diff">{DIFF_LABEL[rowIdx]}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ResultFlash({ info, teamNames }) {
  const winnerName = info.winner ? teamNames[info.winner] : null;
  return (
    <div className={`result-flash pop-in ${info.isCorrect ? 'correct' : 'wrong'}`}>
      {info.isCorrect
        ? `✅ ${winnerName} — +${info.points.toLocaleString('ar-SA')} ريال`
        : info.correctAnswer
          ? `❌ إجابة خاطئة — الصواب: ${info.correctAnswer}`
          : '❌ إجابة خاطئة'
      }
    </div>
  );
}

function GameOverScreen({ teams, winner, isTie, myTeam, onReset, onHome }) {
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
            <span className="final-money">💰 {(teams[t]?.money || 0).toLocaleString('ar-SA')} ريال</span>
            {winner === t && <span className="final-crown">👑</span>}
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
