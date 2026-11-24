// ألعاب التجمعات — game server (Express + Socket.IO).
//
// Socket protocol (all requests use acknowledgements: socket.emit(evt, data, ack)):
//   room:create { game, name, team?, options? }  → ack { ok, code, playerId, token }
//   room:join   { game, code, name, team? }      → ack { ok, code, playerId, token }
//   room:rejoin { game, code, token }            → ack { ok, code, playerId, token }
//   room:leave  {}                               → ack { ok }
//   room:action { type, ...payload }             → ack { ok } | { ok:false, error }
// Server → client:
//   room:state  <per-player view>   (after every change)
//   room:replaced                   (same seat opened on another tab/device)
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const { RoomManager, cleanName } = require('./rooms');
const { AsbiqhumGame } = require('./games/asbiqhum');
const { HuroofGame } = require('./games/huroof');
const { MoneyBoardGame, VALID_CATEGORIES } = require('./games/moneyboard');
const { questions } = require('./questions');

const PORT = process.env.PORT || 3001;
// Comma-separated list of allowed browser origins, or "*" (default).
const ORIGINS = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean);
const corsOrigin = ORIGINS.includes('*') ? '*' : ORIGINS;

const app = express();
app.use(cors({ origin: corsOrigin }));
app.disable('x-powered-by');

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
  pingInterval: 20000,
  pingTimeout: 25000,
  maxHttpBufferSize: 1e5,
});

const rooms = new RoomManager(io, {
  asbiqhum: AsbiqhumGame,
  huroof: HuroofGame,
  money: MoneyBoardGame,
});

// ── REST ──────────────────────────────────────────────────────────────────────
const startedAt = Date.now();
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  uptimeSec: Math.round((Date.now() - startedAt) / 1000),
  questions: questions.length,
  ...rooms.stats(),
}));
app.get('/api/categories', (req, res) => res.json({ categories: VALID_CATEGORIES }));

// ── Static client (when the server also hosts the site) ───────────────────────
// The client is built with base "/Gathering-games/" (GitHub Pages), so serve it
// there and redirect the bare root.
const dist = path.join(__dirname, '../client/dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use('/Gathering-games', express.static(dist, { maxAge: '1h', index: 'index.html' }));
  app.get('/', (req, res) => res.redirect('/Gathering-games/'));
  app.get('/Gathering-games/*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  app.get('/', (req, res) => res.type('text').send('Gathering Games server is running. See /api/health'));
}

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const RATE_WINDOW_MS = 1000;
const RATE_MAX = Number(process.env.GG_RATE_MAX) || 25;

io.on('connection', (socket) => {
  let windowStart = Date.now(), count = 0;
  const limited = () => {
    const now = Date.now();
    if (now - windowStart > RATE_WINDOW_MS) { windowStart = now; count = 0; }
    return ++count > RATE_MAX;
  };

  // Wrap every handler: validate the ack, never let an exception kill the process.
  const on = (event, handler) => socket.on(event, (data, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    if (limited()) return reply({ ok: false, error: 'طلبات كثيرة — تمهّل قليلاً' });
    try {
      const out = handler(data && typeof data === 'object' ? data : {});
      reply(out || { ok: true });
    } catch (e) {
      console.error(`[socket ${event}]`, e);
      reply({ ok: false, error: 'خطأ في الخادم' });
    }
  });

  const leaveCurrent = () => {
    const cur = rooms.ofSocket(socket.id);
    if (!cur) return;
    socket.leave(cur.room.code);
    rooms.bySocket.delete(socket.id);
    const { room, player } = cur;
    if (room.game.phase === 'lobby') room.removePlayer(player.id);
    else { player.connected = false; player.socketId = null; room.game.onDisconnect && room.game.onDisconnect(player); }
    if (room.players.size === 0) { room.destroy(); rooms.rooms.delete(room.code); return; }
    if (room.hostId === player.id) room.pickNewHost();
    room.broadcast();
  };

  const seat = (room, player) => {
    room.attach(player, socket);
    room.broadcast();
    return { ok: true, code: room.code, playerId: player.id, token: player.token };
  };

  // display: true → this device is the TV screen: it hosts the room but does not play.
  on('room:create', ({ game, name, team, options, display }) => {
    const n = cleanName(name) || (display ? 'شاشة العرض' : '');
    if (!n) return { ok: false, error: 'أدخل اسمك' };
    if (!rooms.types[game]) return { ok: false, error: 'لعبة غير معروفة' };
    leaveCurrent();
    const room = rooms.create(game, options);
    const { player, error } = display
      ? room.addPlayer(n, { team: null, role: 'display' })
      : room.addPlayer(n, { team: room.game.normaliseTeam ? room.game.normaliseTeam(team) : null });
    if (error) return { ok: false, error };
    console.log(`[${game}] room ${room.code} created`);
    return seat(room, player);
  });

  on('room:join', ({ game, code, name, team }) => {
    const n = cleanName(name);
    if (!n) return { ok: false, error: 'أدخل اسمك' };
    const room = rooms.get(code);
    if (!room || room.type !== game) return { ok: false, error: 'الغرفة غير موجودة — تأكد من الرمز' };
    if (room.game.phase !== 'lobby') return { ok: false, error: 'اللعبة بدأت بالفعل' };
    leaveCurrent();
    const { player, error } = room.addPlayer(n, { team: room.game.normaliseTeam ? room.game.normaliseTeam(team) : null });
    if (error) return { ok: false, error };
    return seat(room, player);
  });

  on('room:rejoin', ({ game, code, token }) => {
    const room = rooms.get(code);
    if (!room || room.type !== game || typeof token !== 'string') return { ok: false, error: 'انتهت الغرفة', gone: true };
    const player = [...room.players.values()].find(p => p.token === token);
    if (!player) return { ok: false, error: 'انتهت جلستك في هذه الغرفة', gone: true };
    return seat(room, player);
  });

  on('room:leave', () => { leaveCurrent(); return { ok: true }; });

  on('room:action', (data) => {
    const cur = rooms.ofSocket(socket.id);
    if (!cur) return { ok: false, error: 'لست في غرفة', gone: true };
    const { room, player } = cur;
    const type = typeof data.type === 'string' ? data.type : '';
    // Host-only room management shared by all games
    if (type === 'kick') {
      if (room.hostId !== player.id) return { ok: false, error: 'للمضيف فقط' };
      const target = room.players.get(data.playerId);
      if (!target || target.id === player.id) return { ok: false, error: 'لاعب غير موجود' };
      if (target.socketId) {
        const s = io.sockets.sockets.get(target.socketId);
        if (s) { s.leave(room.code); s.emit('room:kicked'); }
        rooms.bySocket.delete(target.socketId);
      }
      room.removePlayer(target.id);
      room.broadcast();
      return { ok: true };
    }
    const error = room.game.handle(player, type, data);
    room.broadcast();
    return error ? { ok: false, error } : { ok: true };
  });

  socket.on('disconnect', () => {
    const cur = rooms.ofSocket(socket.id);
    rooms.bySocket.delete(socket.id);
    if (!cur || cur.player.socketId !== socket.id) return;
    cur.room.detach(cur.player);
    cur.room.broadcast();
  });
});

process.on('unhandledRejection', e => console.error('unhandledRejection', e));
process.on('uncaughtException', e => console.error('uncaughtException', e));

if (require.main === module) {
  server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = { app, server, io, rooms };
