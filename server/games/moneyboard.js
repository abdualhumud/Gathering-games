// لوحة المال (MoneyBoard) — Jeopardy-style team trivia
// Two teams take turns picking a cell from a 6-category × 6-difficulty board.
// Correct answer → earn money and your team picks next.
// Wrong/timeout → other team gets a steal attempt.
// Most money after all 36 cells wins.
// Super powers: each team gets 5 (double, fifty50, shield, stealTurn, extraTime) – each usable once.

const { questions } = require('../questions');

const VALID_CATEGORIES = [
  // Original 15
  'جغرافيا عربية', 'حيوانات وطبيعة', 'ثقافة وفنون', 'تاريخ عالمي',
  'رياضة وأولمبياد', 'أدب عربي ولغة', 'جغرافيا عالمية', 'تكنولوجيا وحاسوب',
  'فيزياء وكيمياء', 'طعام ومطبخ', 'قرآن ومعرفة إسلامية', 'فلك وعلوم الفضاء',
  'معلومات عامة', 'أحياء وجسم الإنسان', 'رياضيات',
  // From existing server files
  'تاريخ إسلامي', 'علوم', 'جغرافيا', 'رياضة', 'دين',
  // New categories
  'أفلام ومسلسلات', 'موسيقى وفنون', 'لغة عربية ونحو', 'بيئة وطبيعة',
  'سفر وسياحة', 'اقتصاد وأعمال', 'صحة وطب', 'ألعاب وترفيه',
];

const POINTS = [200, 400, 600, 800, 1000, 1200];
const ANSWER_TIME = 30; // seconds
const STEAL_TIME  = 15; // seconds
const EXTRA_TIME  = 15; // seconds added by extraTime super power

function freshSuperPowers() {
  return { double: true, fifty50: true, shield: true, stealTurn: true, extraTime: true };
}

class MoneyBoardGame {
  constructor(roomId) {
    this.roomId          = roomId;
    this.host            = null;
    this.state           = 'lobby';  // lobby | playing | question | steal | gameover
    this.players         = {};       // socketId → { name, team, connected }
    this.teams           = {
      A: { money: 0, superPowers: freshSuperPowers() },
      B: { money: 0, superPowers: freshSuperPowers() },
    };
    this.currentTurn     = 'A';     // team that picks the next cell
    this.board           = null;    // array of { category, cells[] }
    this.currentCell     = null;    // { colIdx, rowIdx }
    this.currentQuestion = null;
    this.activeTeam      = null;    // team currently answering or stealing
    this.originalTeam    = null;    // team that originally picked the cell
    this.answeredCount   = 0;
    this.totalCells      = 36;
    // Active super power state for current question
    this.activeEffects   = { double: false, shield: false, stealTurn: null, removedOptions: null };
  }

  // ── Players ────────────────────────────────────────────────────────────────
  addPlayer(socketId, name, team = 'A') {
    this.players[socketId] = { name, team, connected: true };
    if (!this.host) this.host = socketId;
  }

  removePlayer(socketId) {
    if (this.players[socketId]) this.players[socketId].connected = false;
    if (this.host === socketId) {
      const next = Object.entries(this.players).find(([id, p]) => p.connected && id !== socketId);
      this.host = next ? next[0] : null;
    }
  }

  isHost(socketId) { return this.host === socketId; }

  // ── Board construction ─────────────────────────────────────────────────────
  buildBoard(selectedCategories) {
    this.board = selectedCategories.map(cat => {
      const pool = questions.filter(q => q.category === cat);
      const fallback = [...questions].sort(() => Math.random() - 0.5);
      const source = pool.length >= 6 ? pool : (pool.length > 0 ? pool : fallback);
      const shuffled = [...source].sort(() => Math.random() - 0.5);
      const sixth = Math.max(1, Math.floor(shuffled.length / 6));
      return {
        category: cat,
        cells: POINTS.map((pts, i) => {
          const slice = shuffled.slice(i * sixth, (i + 1) * sixth);
          const q = slice.length
            ? slice[Math.floor(Math.random() * slice.length)]
            : shuffled[i % shuffled.length] || fallback[i];
          return { points: pts, question: q, answered: false, winner: null };
        }),
      };
    });
    this.answeredCount = 0;
    this.totalCells = selectedCategories.length * POINTS.length;
  }

  startGame(selectedCategories) {
    this.buildBoard(selectedCategories);
    this.state = 'playing';
    this.currentTurn = 'A';
    this.teams = {
      A: { money: 0, superPowers: freshSuperPowers() },
      B: { money: 0, superPowers: freshSuperPowers() },
    };
    this.activeEffects = { double: false, shield: false, stealTurn: null, removedOptions: null };
  }

  // ── Gameplay ───────────────────────────────────────────────────────────────
  selectCell(socketId, colIdx, rowIdx) {
    const player = this.players[socketId];
    if (!player || player.team !== this.currentTurn) return null;
    if (this.state !== 'playing') return null;
    const cell = this.board[colIdx]?.cells[rowIdx];
    if (!cell || cell.answered) return null;

    this.currentCell     = { colIdx, rowIdx };
    this.currentQuestion = cell.question;
    this.activeTeam      = this.currentTurn;
    this.originalTeam    = this.currentTurn;
    this.state           = 'question';
    this.activeEffects   = { double: false, shield: false, stealTurn: null, removedOptions: null };
    return {
      colIdx, rowIdx,
      question:   cell.question,
      points:     cell.points,
      activeTeam: this.activeTeam,
    };
  }

  // ── Super Powers ───────────────────────────────────────────────────────────
  activateSuperPower(socketId, power) {
    const player = this.players[socketId];
    if (!player) return null;
    const team = player.team;

    if (!this.teams[team].superPowers[power]) return null; // already used or invalid

    // Mark as used
    this.teams[team].superPowers[power] = false;

    if (power === 'double') {
      this.activeEffects.double = true;
      return { power, team, activeEffects: this.activeEffects };
    }

    if (power === 'shield') {
      this.activeEffects.shield = true;
      return { power, team, activeEffects: this.activeEffects };
    }

    if (power === 'stealTurn') {
      this.activeEffects.stealTurn = team;
      return { power, team, activeEffects: this.activeEffects };
    }

    if (power === 'extraTime') {
      return { power, team, extraSeconds: EXTRA_TIME };
    }

    if (power === 'fifty50') {
      // Only works if question has 4 options
      const q = this.currentQuestion;
      if (!q || !q.options || q.options.length < 4) return null;
      const correctIndex = q.options.indexOf(q.answer);
      const wrongIndices = q.options.map((_, i) => i).filter(i => i !== correctIndex);
      // Shuffle and remove 2 wrong answers
      const toRemove = [...wrongIndices].sort(() => Math.random() - 0.5).slice(0, 2);
      this.activeEffects.removedOptions = toRemove;
      return { power, team, removedOptions: toRemove };
    }

    return null;
  }

  // ── Operator actions (server-side manual override) ─────────────────────────
  operatorAdjust(team, amount) {
    if (!this.teams[team]) return null;
    this.teams[team].money = Math.max(0, this.teams[team].money + amount);
    return { teams: { ...this.teams } };
  }

  operatorSkipQuestion() {
    if (this.state !== 'question' && this.state !== 'steal') return null;
    const { colIdx, rowIdx } = this.currentCell;
    const cell = this.board[colIdx].cells[rowIdx];
    cell.answered = true;
    cell.winner = null;
    this.answeredCount++;
    this.currentTurn = this.originalTeam;
    this.activeEffects = { double: false, shield: false, stealTurn: null, removedOptions: null };
    return this._finishCell(cell, null);
  }

  // ── Answer handling ────────────────────────────────────────────────────────
  answer(socketId, answerIndex) {
    const player = this.players[socketId];
    if (!player || player.team !== this.activeTeam) return null;
    if (this.state !== 'question' && this.state !== 'steal') return null;

    const { colIdx, rowIdx } = this.currentCell;
    const cell      = this.board[colIdx].cells[rowIdx];
    const isCorrect = cell.question.options[answerIndex] === cell.question.answer;

    if (isCorrect) {
      const effectiveTeam = this.activeEffects.stealTurn || this.activeTeam;
      return this._awardAndAdvance(cell, effectiveTeam);
    } else {
      return this._handleWrong(cell);
    }
  }

  timeUp() {
    if (this.state !== 'question' && this.state !== 'steal') return null;
    const { colIdx, rowIdx } = this.currentCell;
    const cell = this.board[colIdx].cells[rowIdx];
    return this._handleWrong(cell);
  }

  _handleWrong(cell) {
    if (this.state === 'question') {
      // Shield: skip steal, give back to original team
      if (this.activeEffects.shield) {
        cell.answered = true;
        cell.winner   = null;
        this.answeredCount++;
        this.currentTurn = this.originalTeam;
        this.activeEffects = { double: false, shield: false, stealTurn: null, removedOptions: null };
        return this._finishCell(cell, null);
      }
      // Normal: offer steal to other team
      const stealTeam = this.activeTeam === 'A' ? 'B' : 'A';
      this.activeTeam = stealTeam;
      this.state = 'steal';
      return { isCorrect: false, steal: true, stealTeam };
    } else {
      // Steal also wrong — no one earns, original team picks next
      cell.answered = true;
      cell.winner   = null;
      this.answeredCount++;
      this.currentTurn = this.originalTeam;
      this.activeEffects = { double: false, shield: false, stealTurn: null, removedOptions: null };
      return this._finishCell(cell, null);
    }
  }

  _awardAndAdvance(cell, winningTeam) {
    const pts = this.activeEffects.double ? cell.points * 2 : cell.points;
    this.teams[winningTeam].money += pts;
    cell.answered = true;
    cell.winner   = winningTeam;
    this.answeredCount++;
    // If stealTurn effect was active: the team that activated it picks next
    const nextTurn = this.activeEffects.stealTurn
      ? (this.activeEffects.stealTurn === 'A' ? 'A' : 'B')
      : winningTeam;
    this.currentTurn = nextTurn;
    this.activeEffects = { double: false, shield: false, stealTurn: null, removedOptions: null };
    return this._finishCell(cell, winningTeam, pts);
  }

  _finishCell(cell, winningTeam, pointsEarned) {
    const earned = pointsEarned !== undefined ? pointsEarned : 0;
    const gameOver = this.answeredCount >= this.totalCells;
    if (gameOver) this.state = 'gameover';
    else          this.state = 'playing';
    return {
      isCorrect:    winningTeam !== null,
      winner:       winningTeam,
      steal:        false,
      pointsEarned: earned,
      nextTurn:     this.currentTurn,
      correctAnswer: cell.question.answer,
      teams:         this._safeTeams(),
      board:         this._safeBoard(),
      gameOver,
    };
  }

  // ── State helpers ──────────────────────────────────────────────────────────
  _safeTeams() {
    return {
      A: { money: this.teams.A.money, superPowers: { ...this.teams.A.superPowers } },
      B: { money: this.teams.B.money, superPowers: { ...this.teams.B.superPowers } },
    };
  }

  _safeBoard() {
    if (!this.board) return null;
    return this.board.map(col => ({
      category: col.category,
      cells: col.cells.map(c => ({ points: c.points, answered: c.answered, winner: c.winner })),
    }));
  }

  getState() {
    return {
      players:     this.players,
      teams:       this._safeTeams(),
      state:       this.state,
      currentTurn: this.currentTurn,
      board:       this._safeBoard(),
      host:        this.host,
      activeTeam:  this.activeTeam,
      activeEffects: this.activeEffects,
    };
  }

  getResults() {
    const aM = this.teams.A.money, bM = this.teams.B.money;
    return {
      teams: this._safeTeams(),
      winner: aM > bM ? 'A' : bM > aM ? 'B' : 'tie',
      board: this._safeBoard(),
    };
  }
}

module.exports = { MoneyBoardGame, VALID_CATEGORIES, ANSWER_TIME, STEAL_TIME, EXTRA_TIME };
