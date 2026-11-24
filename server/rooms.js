// Room manager shared by all online games.
//
// Model: the server is authoritative. Every change ends with `room.broadcast()`,
// which sends each connected player its own view (`game.view(playerId)`) as
// `room:state`. Clients just render the latest state, so re-joining after a
// refresh / lost connection is simply "send me the state again".
//
// Identity: each player gets a public `id` (shown to others) and a secret
// `token` (kept on the device). `room:rejoin` with the token re-attaches a new
// socket to the same seat.
const crypto = require('crypto');

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
const CODE_LEN = 5;
const MAX_PLAYERS = 16;
const LOBBY_DROP_MS = 30 * 1000;          // disconnected in lobby → seat removed
const EMPTY_ROOM_TTL_MS = 15 * 60 * 1000;  // nobody connected → room deleted
const MAX_ROOM_AGE_MS = 8 * 60 * 60 * 1000;

const randId = (bytes = 9) => crypto.randomBytes(bytes).toString('base64url');

function cleanName(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
}

class Room {
  constructor(manager, code, type, GameClass, options) {
    this.manager = manager;
    this.code = code;
    this.type = type;
    this.players = new Map();   // id → { id, name, token, connected, team, socketId, joinedAt }
    this.hostId = null;
    this.createdAt = Date.now();
    this.emptySince = null;
    this._timer = null;
    this.game = new GameClass(this, options || {});
  }

  // ── timers (one phase timer per room) ──
  schedule(ms, fn) {
    this.clearSchedule();
    this._timer = setTimeout(() => {
      this._timer = null;
      try { fn(); this.broadcast(); } catch (e) { console.error(`[${this.code}] timer error`, e); }
    }, ms);
  }
  clearSchedule() { if (this._timer) { clearTimeout(this._timer); this._timer = null; } }

  // ── players ──
  connectedPlayers() { return [...this.players.values()].filter(p => p.connected); }
  /** Connected seats that actually play (the TV display seat does not). */
  activePlayers() { return this.connectedPlayers().filter(p => p.role !== 'display'); }

  addPlayer(name, extra = {}) {
    if (this.players.size >= MAX_PLAYERS) return { error: 'الغرفة ممتلئة' };
    let finalName = name;
    const taken = new Set([...this.players.values()].map(p => p.name));
    for (let n = 2; taken.has(finalName); n++) finalName = `${name} ${n}`;
    const player = { id: randId(6), token: randId(18), name: finalName, connected: true, team: null, role: 'player', socketId: null, joinedAt: Date.now(), ...extra };
    const err = this.game.canJoin ? this.game.canJoin(player) : null;
    if (err) return { error: err };
    this.players.set(player.id, player);
    if (!this.hostId) this.hostId = player.id;
    this.game.onJoin && this.game.onJoin(player);
    return { player };
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    this.game.onLeave && this.game.onLeave(p);
    if (this.hostId === id) this.pickNewHost();
  }

  pickNewHost() {
    const next = this.connectedPlayers().sort((a, b) => a.joinedAt - b.joinedAt)[0]
      || [...this.players.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0];
    this.hostId = next ? next.id : null;
  }

  attach(player, socket) {
    if (player.socketId && player.socketId !== socket.id) {
      const old = this.manager.io.sockets.sockets.get(player.socketId);
      if (old) { old.leave(this.code); this.manager.bySocket.delete(old.id); old.emit('room:replaced'); }
    }
    player.socketId = socket.id;
    player.connected = true;
    this.emptySince = null;
    socket.join(this.code);
    this.manager.bySocket.set(socket.id, { code: this.code, playerId: player.id });
  }

  detach(player) {
    player.connected = false;
    player.socketId = null;
    if (!this.connectedPlayers().length) this.emptySince = Date.now();
    this.game.onDisconnect && this.game.onDisconnect(player);
    // In the lobby a dropped seat is freed after a grace period.
    setTimeout(() => {
      if (!this.manager.rooms.has(this.code)) return;
      if (!player.connected && this.game.phase === 'lobby' && this.players.get(player.id) === player) {
        this.removePlayer(player.id);
        this.broadcast();
      } else if (!player.connected && this.hostId === player.id && this.connectedPlayers().length) {
        this.pickNewHost();       // host gone for good → hand over control
        this.broadcast();
      }
    }, LOBBY_DROP_MS);
  }

  // ── state sync ──
  baseView(viewerId) {
    return {
      code: this.code,
      game: this.type,
      youId: viewerId,
      hostId: this.hostId,
      isHost: viewerId === this.hostId,
      players: [...this.players.values()]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map(p => ({ id: p.id, name: p.name, team: p.team, role: p.role, connected: p.connected })),
    };
  }

  viewFor(id) {
    return { ...this.baseView(id), ...this.game.view(id) };
  }

  broadcast() {
    for (const p of this.players.values()) {
      if (!p.connected || !p.socketId) continue;
      const s = this.manager.io.sockets.sockets.get(p.socketId);
      if (s) s.emit('room:state', this.viewFor(p.id));
    }
  }

  destroy() { this.clearSchedule(); this.game.destroy && this.game.destroy(); }
}

class RoomManager {
  constructor(io, gameTypes) {
    this.io = io;
    this.types = gameTypes;      // { asbiqhum: GameClass, ... }
    this.rooms = new Map();      // code → Room
    this.bySocket = new Map();   // socketId → { code, playerId }
    this._sweep = setInterval(() => this.sweep(), 60 * 1000);
    this._sweep.unref && this._sweep.unref();
  }

  newCode() {
    for (let tries = 0; tries < 1000; tries++) {
      let c = '';
      for (let i = 0; i < CODE_LEN; i++) c += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
      if (!this.rooms.has(c)) return c;
    }
    throw new Error('no free room code');
  }

  create(type, options) {
    const GameClass = this.types[type];
    if (!GameClass) return null;
    const room = new Room(this, this.newCode(), type, GameClass, options);
    this.rooms.set(room.code, room);
    return room;
  }

  get(code) {
    if (typeof code !== 'string') return null;
    return this.rooms.get(code.trim().toUpperCase()) || null;
  }

  ofSocket(socketId) {
    const ref = this.bySocket.get(socketId);
    if (!ref) return null;
    const room = this.rooms.get(ref.code);
    const player = room && room.players.get(ref.playerId);
    return room && player ? { room, player } : null;
  }

  sweep() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const idle = room.emptySince && now - room.emptySince > EMPTY_ROOM_TTL_MS;
      const old = now - room.createdAt > MAX_ROOM_AGE_MS;
      if (idle || old || room.players.size === 0) {
        room.destroy();
        this.rooms.delete(code);
      }
    }
  }

  stats() {
    const byType = {};
    for (const r of this.rooms.values()) byType[r.type] = (byType[r.type] || 0) + 1;
    return { rooms: this.rooms.size, byType, sockets: this.bySocket.size };
  }
}

module.exports = { RoomManager, cleanName };
