// لوحة المال (MoneyBoard) — Jeopardy-style team trivia
// Two teams take turns picking a cell from a 6-category × 3-difficulty board.
// Correct answer → earn money and your team picks next.
// Wrong/timeout → other team gets a steal attempt.
// Most money after all 18 cells wins.

const { questions } = require('../questions');

const VALID_CATEGORIES = [
  'جغرافيا عربية', 'حيوانات وطبيعة', 'ثقافة وفنون', 'تاريخ عالمي',
  'رياضة وأولمبياد', 'أدب عربي ولغة', 'جغرافيا عالمية', 'تكنولوجيا وحاسوب',
  'فيزياء وكيمياء', 'طعام ومطبخ', 'قرآن ومعرفة إسلامية', 'فلك وعلوم الفضاء',
  'معلومات عامة', 'أحياء وجسم الإنسان', 'رياضيات',
];

const POINTS = [200, 400, 600];
const ANSWER_TIME = 30; // seconds
const STEAL_TIME  = 15; // seconds

class MoneyBoardGame {
  constructor(roomId) {
    this.roomId    = roomId;
    this.host      = null;
    this.state     = 'lobby'; // lobby | playing | question | steal | gameover
    this.players   = {};      // socketId → { name, team, connected }
    this.teams     = { A: { money: 0 }, B: { money: 0 } };
    this.currentTurn       = 'A'; // team that picks the next cell
    this.board             = null; // [col][row] cells
    this.currentCell       = null; // { colIdx, rowIdx }
    this.currentQuestion   = null;
    this.activeTeam        = null; // team currently answering or stealing
    this.originalTeam      = null; // team that originally picked the cell
    this.answeredCount     = 0;
    this.totalCells        = 18;
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
    // selectedCategories: exactly 6 category strings
    this.board = selectedCategories.map(cat => {
      const pool = questions.filter(q => q.category === cat);
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const third = Math.floor(shuffled.length / 3) || 1;
      return {
        category: cat,
        cells: POINTS.map((pts, i) => {
          // Split pool into thirds for easy / medium / hard
          const slice = shuffled.slice(i * third, (i + 1) * third);
          const q = slice.length ? slice[Math.floor(Math.random() * slice.length)] : shuffled[i % shuffled.length];
          return { points: pts, question: q, answered: false, winner: null };
        }),
      };
    });
    this.answeredCount = 0;
    this.totalCells = selectedCategories.length * 3;
  }

  startGame(selectedCategories) {
    this.buildBoard(selectedCategories);
    this.state = 'playing';
    this.currentTurn = 'A';
    this.teams = { A: { money: 0 }, B: { money: 0 } };
  }

  // ── Gameplay ───────────────────────────────────────────────────────────────
  selectCell(socketId, colIdx, rowIdx) {
    const player = this.players[socketId];
    if (!player || player.team !== this.currentTurn) return null;
    if (this.state !== 'playing') return null;
    const cell = this.board[colIdx]?.cells[rowIdx];
    if (!cell || cell.answered) return null;

    this.currentCell    = { colIdx, rowIdx };
    this.currentQuestion = cell.question;
    this.activeTeam     = this.currentTurn;
    this.originalTeam   = this.currentTurn;
    this.state          = 'question';
    return {
      colIdx, rowIdx,
      question: cell.question,
      points: cell.points,
      activeTeam: this.activeTeam,
    };
  }

  answer(socketId, answerIndex) {
    const player = this.players[socketId];
    if (!player || player.team !== this.activeTeam) return null;
    if (this.state !== 'question' && this.state !== 'steal') return null;

    const { colIdx, rowIdx } = this.currentCell;
    const cell      = this.board[colIdx].cells[rowIdx];
    const isCorrect = cell.question.options[answerIndex] === cell.question.answer;

    if (isCorrect) {
      return this._awardAndAdvance(cell, this.activeTeam);
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
      // Give the other team a steal chance
      const stealTeam = this.activeTeam === 'A' ? 'B' : 'A';
      this.activeTeam = stealTeam;
      this.state = 'steal';
      return { isCorrect: false, steal: true, stealTeam };
    } else {
      // Steal failed — no one earns, original team picks next
      cell.answered = true;
      cell.winner   = null;
      this.answeredCount++;
      // Original team still gets to pick next (they were "robbed")
      this.currentTurn = this.originalTeam;
      return this._finishCell(cell, null);
    }
  }

  _awardAndAdvance(cell, winningTeam) {
    this.teams[winningTeam].money += cell.points;
    cell.answered = true;
    cell.winner   = winningTeam;
    this.answeredCount++;
    // Winner picks next
    this.currentTurn = winningTeam;
    return this._finishCell(cell, winningTeam);
  }

  _finishCell(cell, winningTeam) {
    const gameOver = this.answeredCount >= this.totalCells;
    if (gameOver) this.state = 'gameover';
    else          this.state = 'playing';
    return {
      isCorrect:    winningTeam !== null,
      winner:       winningTeam,
      steal:        false,
      pointsEarned: winningTeam ? cell.points : 0,
      nextTurn:     this.currentTurn,
      correctAnswer: cell.question.answer,
      teams:         { ...this.teams },
      board:         this._safeBoard(),
      gameOver,
    };
  }

  // ── State helpers ──────────────────────────────────────────────────────────
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
      teams:       this.teams,
      state:       this.state,
      currentTurn: this.currentTurn,
      board:       this._safeBoard(),
      host:        this.host,
      activeTeam:  this.activeTeam,
    };
  }

  getResults() {
    const aM = this.teams.A.money, bM = this.teams.B.money;
    return {
      teams: this.teams,
      winner: aM > bM ? 'A' : bM > aM ? 'B' : 'tie',
      board: this._safeBoard(),
    };
  }
}

module.exports = { MoneyBoardGame, VALID_CATEGORIES, ANSWER_TIME, STEAL_TIME };
