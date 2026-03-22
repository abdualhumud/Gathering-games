const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { AsbiqhumGame, QUESTION_TIME } = require('./games/asbiqhum');
const { HuroofGame, ANSWER_TIME } = require('./games/huroof');
const { MoneyBoardGame, VALID_CATEGORIES, ANSWER_TIME: MB_ANSWER_TIME, STEAL_TIME, EXTRA_TIME } = require('./games/moneyboard');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static client in production
app.use(express.static(path.join(__dirname, '../client/dist')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Room stores
const asbiqhumRooms  = {}; // roomCode -> AsbiqhumGame
const huroofRooms    = {}; // roomCode -> HuroofGame
const moneyRooms     = {}; // roomCode -> MoneyBoardGame
const socketRooms    = {}; // socketId -> { game, roomCode }
const roomTimers     = {}; // roomCode -> timer

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function clearRoomTimer(roomCode) {
  if (roomTimers[roomCode]) {
    clearTimeout(roomTimers[roomCode]);
    delete roomTimers[roomCode];
  }
}

// ──────────────────────────────────────────────
// REST endpoints
// ──────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', rooms: { asbiqhum: Object.keys(asbiqhumRooms).length, huroof: Object.keys(huroofRooms).length, moneyboard: Object.keys(moneyRooms).length } }));
app.get('/api/categories', (req, res) => res.json({ categories: VALID_CATEGORIES }));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// ──────────────────────────────────────────────
// Socket.IO
// ──────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] connected: ${socket.id}`);

  // ── ASBIQHUM ──────────────────────────────
  socket.on('asbiqhum:create', ({ playerName }) => {
    const code = generateRoomCode();
    const game = new AsbiqhumGame(code);
    game.addPlayer(socket.id, playerName);
    asbiqhumRooms[code] = game;
    socketRooms[socket.id] = { game: 'asbiqhum', roomCode: code };
    socket.join(code);
    socket.emit('asbiqhum:created', { roomCode: code, isHost: true, state: game.getState() });
    console.log(`[asbiqhum] room created: ${code} by ${playerName}`);
  });

  socket.on('asbiqhum:join', ({ roomCode, playerName }) => {
    const code = roomCode.toUpperCase();
    const game = asbiqhumRooms[code];
    if (!game) return socket.emit('error', { message: 'الغرفة غير موجودة' });
    if (game.state !== 'lobby') return socket.emit('error', { message: 'اللعبة بدأت بالفعل' });

    game.addPlayer(socket.id, playerName);
    socketRooms[socket.id] = { game: 'asbiqhum', roomCode: code };
    socket.join(code);
    socket.emit('asbiqhum:joined', { roomCode: code, isHost: game.isHost(socket.id), state: game.getState() });
    io.to(code).emit('asbiqhum:player_joined', { state: game.getState() });
  });

  socket.on('asbiqhum:start', () => {
    const info = socketRooms[socket.id];
    if (!info || info.game !== 'asbiqhum') return;
    const game = asbiqhumRooms[info.roomCode];
    if (!game || !game.isHost(socket.id)) return socket.emit('error', { message: 'أنت لست المضيف' });
    if (Object.keys(game.players).length < 2) return socket.emit('error', { message: 'تحتاج لاعبَين على الأقل' });

    const questionEvent = game.startGame();
    io.to(info.roomCode).emit('asbiqhum:question', questionEvent);

    // Auto-advance after time limit
    clearRoomTimer(info.roomCode);
    roomTimers[info.roomCode] = setTimeout(() => {
      handleAsbiqhumTimeUp(info.roomCode);
    }, QUESTION_TIME * 1000 + 500);
  });

  socket.on('asbiqhum:buzz', () => {
    const info = socketRooms[socket.id];
    if (!info || info.game !== 'asbiqhum') return;
    const game = asbiqhumRooms[info.roomCode];
    if (!game) return;

    const event = game.buzz(socket.id);
    if (event) {
      clearRoomTimer(info.roomCode);
      io.to(info.roomCode).emit('asbiqhum:buzzed', event);
      // Give buzzed player time to answer
      roomTimers[info.roomCode] = setTimeout(() => {
        const timeUpEvent = game.timeUp();
        if (timeUpEvent) {
          io.to(info.roomCode).emit('asbiqhum:time_up', timeUpEvent);
          scheduleNextQuestion(info.roomCode);
        }
      }, 10000); // 10 seconds to answer after buzz
    }
  });

  socket.on('asbiqhum:answer', ({ answerIndex }) => {
    const info = socketRooms[socket.id];
    if (!info || info.game !== 'asbiqhum') return;
    const game = asbiqhumRooms[info.roomCode];
    if (!game) return;

    clearRoomTimer(info.roomCode);
    const event = game.submitAnswer(socket.id, answerIndex);
    if (event) {
      io.to(info.roomCode).emit('asbiqhum:answer_result', event);
      if (event.type === 'game_over') {
        io.to(info.roomCode).emit('asbiqhum:game_over', event);
      } else {
        scheduleNextQuestion(info.roomCode);
      }
    }
  });

  function handleAsbiqhumTimeUp(roomCode) {
    const game = asbiqhumRooms[roomCode];
    if (!game) return;
    const event = game.timeUp();
    if (event) {
      io.to(roomCode).emit('asbiqhum:time_up', event);
      scheduleNextQuestion(roomCode);
    }
  }

  function scheduleNextQuestion(roomCode) {
    const game = asbiqhumRooms[roomCode];
    if (!game) return;
    clearRoomTimer(roomCode);
    roomTimers[roomCode] = setTimeout(() => {
      const questionEvent = game.nextQuestion();
      if (questionEvent.type === 'game_over') {
        io.to(roomCode).emit('asbiqhum:game_over', questionEvent);
      } else {
        io.to(roomCode).emit('asbiqhum:question', questionEvent);
        roomTimers[roomCode] = setTimeout(() => {
          handleAsbiqhumTimeUp(roomCode);
        }, QUESTION_TIME * 1000 + 500);
      }
    }, 3000); // 3 second delay between questions
  }

  // ── HUROOF ────────────────────────────────
  socket.on('huroof:create', ({ playerName, team, gridSize }) => {
    const code = generateRoomCode();
    const game = new HuroofGame(code, gridSize || 'medium');
    game.addPlayer(socket.id, playerName, team || 'A');
    huroofRooms[code] = game;
    socketRooms[socket.id] = { game: 'huroof', roomCode: code };
    socket.join(code);
    socket.emit('huroof:created', { roomCode: code, isHost: true, state: game.getState() });
  });

  socket.on('huroof:join', ({ roomCode, playerName, team }) => {
    const code = roomCode.toUpperCase();
    const game = huroofRooms[code];
    if (!game) return socket.emit('error', { message: 'الغرفة غير موجودة' });
    if (game.state !== 'lobby') return socket.emit('error', { message: 'اللعبة بدأت بالفعل' });

    game.addPlayer(socket.id, playerName, team);
    socketRooms[socket.id] = { game: 'huroof', roomCode: code };
    socket.join(code);
    socket.emit('huroof:joined', { roomCode: code, isHost: game.isHost(socket.id), state: game.getState() });
    io.to(code).emit('huroof:player_joined', { state: game.getState() });
  });

  socket.on('huroof:start', () => {
    const info = socketRooms[socket.id];
    if (!info || info.game !== 'huroof') return;
    const game = huroofRooms[info.roomCode];
    if (!game || !game.isHost(socket.id)) return socket.emit('error', { message: 'أنت لست المضيف' });

    const event = game.startGame();
    io.to(info.roomCode).emit('huroof:game_started', event);
  });

  socket.on('huroof:select_cell', ({ cellIndex }) => {
    const info = socketRooms[socket.id];
    if (!info || info.game !== 'huroof') return;
    const game = huroofRooms[info.roomCode];
    if (!game) return;

    const event = game.selectCell(socket.id, cellIndex);
    if (event) {
      io.to(info.roomCode).emit('huroof:cell_selected', event);
      clearRoomTimer(info.roomCode);
      roomTimers[info.roomCode] = setTimeout(() => {
        const timeUpEvent = game.timeUp();
        if (timeUpEvent) {
          io.to(info.roomCode).emit('huroof:time_up', timeUpEvent);
        }
      }, ANSWER_TIME * 1000 + 500);
    }
  });

  socket.on('huroof:answer', ({ answerIndex }) => {
    const info = socketRooms[socket.id];
    if (!info || info.game !== 'huroof') return;
    const game = huroofRooms[info.roomCode];
    if (!game) return;

    clearRoomTimer(info.roomCode);
    const event = game.submitAnswer(socket.id, answerIndex);
    if (event) {
      if (event.type === 'game_over') {
        io.to(info.roomCode).emit('huroof:game_over', event);
      } else {
        io.to(info.roomCode).emit('huroof:answer_result', event);
      }
    }
  });

  // ── MONEY BOARD ───────────────────────────
  socket.on('money:create', ({ playerName, team }) => {
    const code = generateRoomCode();
    const game = new MoneyBoardGame(code);
    game.addPlayer(socket.id, playerName, team || 'A');
    moneyRooms[code] = game;
    socketRooms[socket.id] = { game: 'money', roomCode: code };
    socket.join(code);
    socket.emit('money:created', { roomCode: code, isHost: true, state: game.getState(), categories: VALID_CATEGORIES });
    console.log(`[money] room created: ${code} by ${playerName}`);
  });

  socket.on('money:join', ({ roomCode, playerName, team }) => {
    const code = roomCode.toUpperCase();
    const game = moneyRooms[code];
    if (!game) return socket.emit('error', { message: 'الغرفة غير موجودة' });
    if (game.state !== 'lobby') return socket.emit('error', { message: 'اللعبة بدأت بالفعل' });
    game.addPlayer(socket.id, playerName, team || 'A');
    socketRooms[socket.id] = { game: 'money', roomCode: code };
    socket.join(code);
    socket.emit('money:joined', { roomCode: code, isHost: game.isHost(socket.id), state: game.getState(), categories: VALID_CATEGORIES });
    io.to(code).emit('money:player_joined', { state: game.getState() });
  });

  socket.on('money:start', ({ selectedCategories }) => {
    const info = socketRooms[socket.id];
    if (!info || info.game !== 'money') return;
    const game = moneyRooms[info.roomCode];
    if (!game || !game.isHost(socket.id)) return socket.emit('error', { message: 'أنت لست المضيف' });
    if (!selectedCategories || selectedCategories.length !== 6) return socket.emit('error', { message: 'اختر 6 فئات' });
    game.startGame(selectedCategories);
    io.to(info.roomCode).emit('money:game_started', { state: game.getState() });
    console.log(`[money] game started: ${info.roomCode}`);
  });

  socket.on('money:select_cell', ({ colIdx, rowIdx }) => {
    const info = socketRooms[socket.id];
    if (!info || info.game !== 'money') return;
    const game = moneyRooms[info.roomCode];
    if (!game) return;
    const event = game.selectCell(socket.id, colIdx, rowIdx);
    if (event) {
      io.to(info.roomCode).emit('money:cell_selected', event);
      clearRoomTimer(info.roomCode);
      roomTimers[info.roomCode] = setTimeout(() => {
        const result = game.timeUp();
        if (result) handleMoneyResult(info.roomCode, result);
      }, MB_ANSWER_TIME * 1000 + 500);
    }
  });

  socket.on('money:answer', ({ answerIndex }) => {
    const info = socketRooms[socket.id];
    if (!info || info.game !== 'money') return;
    const game = moneyRooms[info.roomCode];
    if (!game) return;
    clearRoomTimer(info.roomCode);
    const result = game.answer(socket.id, answerIndex);
    if (result) {
      if (result.steal) {
        io.to(info.roomCode).emit('money:steal_chance', result);
        roomTimers[info.roomCode] = setTimeout(() => {
          const r2 = game.timeUp();
          if (r2) handleMoneyResult(info.roomCode, r2);
        }, STEAL_TIME * 1000 + 500);
      } else {
        handleMoneyResult(info.roomCode, result);
      }
    }
  });

  socket.on('money:super_power', ({ power }) => {
    const info = socketRooms[socket.id];
    if (!info || info.game !== 'money') return;
    const game = moneyRooms[info.roomCode];
    if (!game) return;
    const result = game.activateSuperPower(socket.id, power);
    if (result) {
      io.to(info.roomCode).emit('money:super_power_used', result);
      // If extraTime, extend the current timer
      if (power === 'extraTime') {
        clearRoomTimer(info.roomCode);
        const isSteal = game.state === 'steal';
        const baseTime = isSteal ? STEAL_TIME : MB_ANSWER_TIME;
        roomTimers[info.roomCode] = setTimeout(() => {
          const r = game.timeUp();
          if (r) handleMoneyResult(info.roomCode, r);
        }, (baseTime + EXTRA_TIME) * 1000 + 500);
      }
    }
  });

  socket.on('money:operator_adjust', ({ team, amount }) => {
    const info = socketRooms[socket.id];
    if (!info || info.game !== 'money') return;
    const game = moneyRooms[info.roomCode];
    if (!game || !game.isHost(socket.id)) return;
    const result = game.operatorAdjust(team, amount);
    if (result) io.to(info.roomCode).emit('money:teams_updated', result);
  });

  socket.on('money:operator_skip', () => {
    const info = socketRooms[socket.id];
    if (!info || info.game !== 'money') return;
    const game = moneyRooms[info.roomCode];
    if (!game || !game.isHost(socket.id)) return;
    clearRoomTimer(info.roomCode);
    const result = game.operatorSkipQuestion();
    if (result) handleMoneyResult(info.roomCode, result);
  });

  function handleMoneyResult(roomCode, result) {
    const game = moneyRooms[roomCode];
    if (!game) return;
    if (result.steal) {
      io.to(roomCode).emit('money:steal_chance', result);
      clearRoomTimer(roomCode);
      roomTimers[roomCode] = setTimeout(() => {
        const r2 = game.timeUp();
        if (r2) handleMoneyResult(roomCode, r2);
      }, STEAL_TIME * 1000 + 500);
    } else if (result.gameOver) {
      io.to(roomCode).emit('money:answer_result', result);
      io.to(roomCode).emit('money:game_over', game.getResults());
    } else {
      io.to(roomCode).emit('money:answer_result', result);
    }
  }

  // ── DISCONNECT ────────────────────────────
  socket.on('disconnect', () => {
    const info = socketRooms[socket.id];
    if (info) {
      if (info.game === 'asbiqhum' && asbiqhumRooms[info.roomCode]) {
        asbiqhumRooms[info.roomCode].removePlayer(socket.id);
        io.to(info.roomCode).emit('asbiqhum:player_left', { state: asbiqhumRooms[info.roomCode].getState() });
      } else if (info.game === 'huroof' && huroofRooms[info.roomCode]) {
        huroofRooms[info.roomCode].removePlayer(socket.id);
        io.to(info.roomCode).emit('huroof:player_left', { state: huroofRooms[info.roomCode].getState() });
      } else if (info.game === 'money' && moneyRooms[info.roomCode]) {
        moneyRooms[info.roomCode].removePlayer(socket.id);
        io.to(info.roomCode).emit('money:player_left', { state: moneyRooms[info.roomCode].getState() });
      }
      delete socketRooms[socket.id];
    }
    console.log(`[-] disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
