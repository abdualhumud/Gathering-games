// لوحة المال (MoneyBoard) — online team board, same rules as local "choices" mode.
// phase: lobby → pick → question → (steal) → result → pick … → over
//  • 6 categories × 6 cells: 2×200 (سهل), 2×400 (متوسط), 2×600 (صعب).
//  • The team whose turn it is picks a cell; any member may answer (first answer counts).
//  • Wrong → the other team gets one steal attempt (the wrong option stays struck).
//  • Turns always alternate: after every cell the other team picks (no streaks).
//  • Super powers (once per game per team): double, two, hafra, friend, block.
const { SCALE, BaseGame, isIndex, publicQuestion } = require('./base');
const { questions, shuffle, withShuffledOptions } = require('../questions');

const VALID_CATEGORIES = [...new Set(questions.map(q => q.category))]
  .filter(cat => questions.filter(q => q.category === cat).length >= 6);
const CATEGORY_COUNTS = Object.fromEntries(VALID_CATEGORIES.map(c => [c, questions.filter(q => q.category === c).length]));

const POINTS = [200, 400, 600, 200, 400, 600]; // same order as the client board
const ANSWER_TIME = 30;
const STEAL_TIME = 15;
const FRIEND_TIME = 30;
const RESULT_MS = 2600;
const POWERS = ['double', 'two', 'hafra', 'friend', 'block'];
const TEAMS = ['A', 'B'];

const other = t => (t === 'A' ? 'B' : 'A');

class MoneyBoardGame extends BaseGame {
  constructor(room) {
    super(room);
    this.categories = [];
    this.usedIds = new Set();
    this.teamNames = { A: 'الفريق الأول', B: 'الفريق الثاني' };
    this.resetMatch();
  }

  resetMatch() {
    this.board = null;
    this.teams = { A: { money: 0, powers: [...POWERS] }, B: { money: 0, powers: [...POWERS] } };
    this.stats = { A: { correct: 0, steals: 0 }, B: { correct: 0, steals: 0 } };
    this.currentTurn = 'A';
    this.answered = 0;
    this.resetCell();
    this.result = null;
  }

  resetCell() {
    this.cell = null;
    this.activeTeam = null;
    this.originalTeam = null;
    this.wrongOpts = [];
    this.effects = { double: false, two: false, hafra: false };
    this.friendUntil = null;
    this.lastPower = null;
  }

  normaliseTeam(team) {
    if (TEAMS.includes(team)) return team;
    const n = t => this.players().filter(p => p.team === t).length;
    return n('A') <= n('B') ? 'A' : 'B';
  }

  handle(player, type, data) {
    switch (type) {
      case 'team': {
        if (this.phase !== 'lobby') return 'لا يمكن تغيير الفريق بعد البدء';
        if (!TEAMS.includes(data.team)) return 'فريق غير صالح';
        player.team = data.team;
        return null;
      }
      case 'settings': {
        if (!this.isHost(player) || this.phase !== 'lobby') return 'للمضيف قبل البدء فقط';
        if (Array.isArray(data.categories)) {
          const cats = [...new Set(data.categories.filter(c => VALID_CATEGORIES.includes(c)))].slice(0, 6);
          this.categories = cats;
        }
        if (data.random) this.categories = shuffle(VALID_CATEGORIES).slice(0, 6);
        for (const t of TEAMS) {
          const name = data.teamNames && typeof data.teamNames[t] === 'string' ? data.teamNames[t].trim().slice(0, 20) : '';
          if (name) this.teamNames[t] = name;
        }
        return null;
      }
      case 'start': return this.start(player);
      case 'pick': return this.pick(player, data.col, data.row);
      case 'power': return this.usePower(player, data.power);
      case 'answer': return this.answer(player, data.index);
      case 'adjust': {
        if (!this.isHost(player) || !this.board) return 'للمضيف فقط';
        const amount = Number(data.amount);
        if (!TEAMS.includes(data.team) || !Number.isFinite(amount) || Math.abs(amount) > 100000) return 'قيمة غير صالحة';
        this.teams[data.team].money = Math.max(0, this.teams[data.team].money + Math.round(amount));
        return null;
      }
      case 'skip': {
        if (!this.isHost(player) || (this.phase !== 'question' && this.phase !== 'steal')) return 'غير متاح الآن';
        this.closeCell(null, { skipped: true });
        return null;
      }
      case 'restart': {
        if (!this.isHost(player) || this.phase !== 'over') return 'غير متاح الآن';
        this.stopTimer();
        this.resetMatch();
        this.phase = 'lobby';
        return null;
      }
      default: return 'إجراء غير معروف';
    }
  }

  start(player) {
    if (!this.isHost(player)) return 'المضيف فقط يبدأ اللعبة';
    if (this.phase !== 'lobby') return 'اللعبة بدأت';
    if (this.categories.length !== 6) return 'اختر 6 فئات';
    for (const t of TEAMS) {
      if (!this.room.connectedPlayers().some(p => p.team === t)) return `يحتاج ${this.teamNames[t]} لاعباً واحداً على الأقل`;
    }
    this.resetMatch();
    this.buildBoard();
    this.phase = 'pick';
    return null;
  }

  buildBoard() {
    const used = new Set();
    const fresh = pool => {
      const unseen = pool.filter(q => !used.has(q.id) && !this.usedIds.has(q.id));
      return shuffle(unseen.length ? unseen : pool.filter(q => !used.has(q.id)))[0];
    };
    this.board = this.categories.map(cat => {
      const pool = questions.filter(q => q.category === cat);
      return {
        category: cat,
        cells: POINTS.map((points, i) => {
          const wanted = (i % 3) + 1;     // 200 → سهل, 400 → متوسط, 600 → صعب
          const q = fresh(pool.filter(x => x.difficulty === wanted))
            || fresh(pool.filter(x => Math.abs(x.difficulty - wanted) === 1))
            || fresh(pool);
          used.add(q.id);
          this.usedIds.add(q.id);
          return { points, question: withShuffledOptions(q), answered: false, winner: null };
        }),
      };
    });
    this.totalCells = this.board.length * POINTS.length;
  }

  pick(player, col, row) {
    if (this.phase !== 'pick') return 'انتظر';
    if (player.team !== this.currentTurn) return 'ليس دور فريقك';
    if (!isIndex(col, this.board.length) || !isIndex(row, POINTS.length)) return 'خانة غير صالحة';
    const c = this.board[col].cells[row];
    if (c.answered) return 'الخانة مستخدمة';
    this.resetCell();
    this.result = null;
    this.cell = { col, row };
    this.activeTeam = this.currentTurn;
    this.originalTeam = this.currentTurn;
    this.phase = 'question';
    this.countdown(ANSWER_TIME, () => this.wrong(null));
    return null;
  }

  usePower(player, power) {
    if (this.phase !== 'question') return 'القوى قبل الإجابة فقط';
    if (player.team !== this.activeTeam) return 'ليس دور فريقك';
    const mine = this.teams[player.team].powers;
    if (!POWERS.includes(power) || !mine.includes(power)) return 'القوة غير متاحة';
    if (this.effects[power]) return 'مفعّلة بالفعل';
    this.teams[player.team].powers = mine.filter(p => p !== power);
    this.lastPower = { team: player.team, power, by: player.name };
    if (power === 'friend') {
      // 30 s to call a friend: added to the answer clock
      const left = Math.ceil(this.msLeft() / 1000);
      this.friendUntil = Date.now() + FRIEND_TIME * 1000 * SCALE;
      this.countdown(left + FRIEND_TIME, () => this.wrong(null));
    } else if (power === 'block') {
      const opp = this.teams[other(player.team)];
      if (opp.powers.length) {
        const gone = opp.powers[Math.floor(Math.random() * opp.powers.length)];
        opp.powers = opp.powers.filter(p => p !== gone);
        this.lastPower.blocked = gone;
      }
    } else {
      this.effects[power] = true;
    }
    return null;
  }

  answer(player, index) {
    if (this.phase !== 'question' && this.phase !== 'steal') return 'لا يوجد سؤال';
    if (player.team !== this.activeTeam) return 'ليس دور فريقك';
    const q = this.currentCell().question;
    if (!isIndex(index, q.options.length) || this.wrongOpts.includes(index)) return 'اختيار غير صالح';
    if (q.options[index] === q.answer) this.correct(player, index);
    else this.wrong(index, player);
    return null;
  }

  currentCell() { return this.board[this.cell.col].cells[this.cell.row]; }

  correct(player, index) {
    const c = this.currentCell();
    const winner = this.activeTeam;
    const earned = this.effects.double ? c.points * 2 : c.points;
    const deduct = this.effects.hafra ? c.points : 0;
    this.teams[winner].money += earned;
    if (deduct) this.teams[other(winner)].money = Math.max(0, this.teams[other(winner)].money - deduct);
    this.stats[winner].correct++;
    if (this.phase === 'steal') this.stats[winner].steals++;
    this.closeCell(winner, { points: earned, hafraPoints: deduct, by: player.name, selected: index });
  }

  wrong(index, player) {
    if (index !== null && index !== undefined) this.wrongOpts.push(index);
    if (this.phase === 'question' && this.effects.two) {
      this.effects.two = false;                 // إجابتين: one more try, no steal
      this.countdown(ANSWER_TIME, () => this.wrong(null));
      return;
    }
    if (this.phase === 'question') {
      this.activeTeam = other(this.activeTeam);
      this.effects.double = false;
      this.effects.hafra = false;
      this.friendUntil = null;
      this.phase = 'steal';
      this.countdown(STEAL_TIME, () => this.wrong(null));
      return;
    }
    this.closeCell(null, { by: player ? player.name : null, selected: index ?? null });
  }

  closeCell(winner, extra) {
    const c = this.currentCell();
    c.answered = true;
    c.winner = winner;
    this.answered++;
    this.currentTurn = other(this.originalTeam);   // no streaks: turns always alternate
    this.result = { winner, correctAnswer: c.question.answer, points: 0, hafraPoints: 0, ...extra };
    this.phase = 'result';
    this.after(RESULT_MS, () => {
      this.resetCell();
      this.result = null;
      this.phase = this.answered >= this.totalCells ? 'over' : 'pick';
    });
  }

  onLeave() {}

  view() {
    const c = this.cell ? this.currentCell() : null;
    const open = this.phase === 'question' || this.phase === 'steal' || this.phase === 'result';
    return {
      phase: this.phase,
      categories: this.categories,
      allCategories: CATEGORY_COUNTS,
      teamNames: this.teamNames,
      teams: this.teams,
      stats: this.stats,
      currentTurn: this.currentTurn,
      activeTeam: this.activeTeam,
      board: this.board && this.board.map(col => ({
        category: col.category,
        cells: col.cells.map(x => ({ points: x.points, answered: x.answered, winner: x.winner })),
      })),
      cell: this.cell,
      question: open && c ? publicQuestion(c.question) : null,
      points: c ? c.points : 0,
      wrongOpts: this.wrongOpts,
      effects: this.effects,
      lastPower: this.lastPower,
      friend: this.friendUntil && this.friendUntil > Date.now()
        ? Math.ceil((this.friendUntil - Date.now()) / 1000 / SCALE) : 0,
      result: this.result,
      timer: this.timerView(),
    };
  }
}

module.exports = { MoneyBoardGame, VALID_CATEGORIES, ANSWER_TIME, STEAL_TIME };
