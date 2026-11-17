// Shared helpers for the online game engines.
// GG_TIME_SCALE (tests only) shrinks every timer, e.g. 0.02 → 20 s becomes 0.4 s.
const SCALE = Number(process.env.GG_TIME_SCALE) > 0 ? Number(process.env.GG_TIME_SCALE) : 1;
class BaseGame {
  constructor(room) {
    this.room = room;
    this.phase = 'lobby';
    this.deadline = null;   // { key, endsAt, duration }
    this._timerKey = 0;
  }

  /** Start the phase timer: after `seconds`, run fn (then the room broadcasts). */
  countdown(seconds, fn) {
    this._timerKey++;
    this.deadline = { key: this._timerKey, endsAt: Date.now() + seconds * 1000 * SCALE, duration: seconds };
    this.room.schedule((seconds * 1000 + 300) * SCALE, () => { this.deadline = null; fn(); });
  }

  /** Run fn after ms without a visible countdown. */
  after(ms, fn) {
    this.deadline = null;
    this.room.schedule(ms * SCALE, fn);
  }

  /** Real (unscaled) milliseconds left on the current countdown. */
  msLeft() { return this.deadline ? Math.max(0, this.deadline.endsAt - Date.now()) / SCALE : 0; }

  stopTimer() { this.deadline = null; this.room.clearSchedule(); }

  timerView() {
    if (!this.deadline) return null;
    const remainingMs = Math.max(0, this.deadline.endsAt - Date.now()) / SCALE;
    return { key: this.deadline.key, duration: this.deadline.duration, remaining: Math.ceil(remainingMs / 1000) };
  }

  isHost(player) { return this.room.hostId === player.id; }
  players() { return [...this.room.players.values()]; }
}

const isIndex = (v, len) => Number.isInteger(v) && v >= 0 && v < len;

/** Public copy of a question — never includes the answer. */
const publicQuestion = q => q && ({ id: q.id, text: q.text, category: q.category, options: q.options, letter: q.letter, difficulty: q.difficulty });

module.exports = { SCALE, BaseGame, isIndex, publicQuestion };
