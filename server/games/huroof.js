// حروف (Huroof) — online hex letter grid, same rules as the local game (2 teams).
// phase: lobby → pre → buzzing → answering → result → select → pre … → over
//  • 5×5 hex grid (odd rows shifted right), first question on the centre hex.
//  • Buzzing (12 s): any player buzzes for their team → that team answers (30 s).
//  • Wrong / time-out → the other team gets a 15 s steal.  Nobody → hex stays free.
//  • Correct → the team claims the hex and picks the next one.
//  • Win: "path" — team 0 connects left↔right, team 1 top↔bottom;
//         "majority" — most hexes when the grid is full.
const { BaseGame, isIndex, publicQuestion } = require('./base');
const { arabicLetters, shuffle, getQuestionsByLetter, getRandomQuestion } = require('../questions');

const N = 5;
const TOTAL = N * N;
const CENTER = 12;
const BUZZER_TIME = 12;
const ANSWER_TIME = 30;
const STEAL_TIME = 15;
const PRE_MS = 1600;
const RESULT_MS = 2200;
const STEAL_GAP_MS = 1800;
const TEAMS = [
  { name: 'الفريق الأخضر', color: '#22c55e' },
  { name: 'الفريق البرتقالي', color: '#f97316' },
];

function neighbours(idx) {
  const r = Math.floor(idx / N), c = idx % N;
  const odd = r % 2 === 1;
  return [
    [r, c - 1], [r, c + 1],
    [r - 1, odd ? c : c - 1], [r - 1, odd ? c + 1 : c],
    [r + 1, odd ? c : c - 1], [r + 1, odd ? c + 1 : c],
  ].filter(([rr, cc]) => rr >= 0 && rr < N && cc >= 0 && cc < N).map(([rr, cc]) => rr * N + cc);
}

function findPath(grid, team) {
  const horizontal = team === 0;
  const isStart = i => (horizontal ? i % N === 0 : i < N);
  const isEnd = i => (horizontal ? i % N === N - 1 : i >= N * (N - 1));
  const prev = new Map();
  const queue = [];
  grid.forEach(h => { if (h.owner === team && isStart(h.index)) { prev.set(h.index, -1); queue.push(h.index); } });
  while (queue.length) {
    const cur = queue.shift();
    if (isEnd(cur)) {
      const path = [];
      for (let p = cur; p !== -1; p = prev.get(p)) path.push(p);
      return path;
    }
    for (const nb of neighbours(cur)) {
      if (!prev.has(nb) && grid[nb].owner === team) { prev.set(nb, cur); queue.push(nb); }
    }
  }
  return null;
}

class HuroofGame extends BaseGame {
  constructor(room, options) {
    super(room);
    this.winMode = options.winMode === 'majority' ? 'majority' : 'path';
    this.usedIds = new Set();
    this.resetMatch();
  }

  resetMatch() {
    const letters = shuffle(arabicLetters.filter(l => getQuestionsByLetter(l).length > 0)).slice(0, TOTAL);
    this.grid = Array.from({ length: TOTAL }, (_, i) => ({ index: i, letter: letters[i % letters.length], owner: null }));
    this.activeIdx = CENTER;
    this.control = null;        // team that picks the next hex
    this.answering = null;      // team answering now
    this.queue = [];            // teams that may still steal
    this.isSteal = false;
    this.question = null;
    this.selected = null;
    this.result = null;
    this.winInfo = null;
  }

  normaliseTeam(team) {
    if (team === 0 || team === 1) return team;
    const n = t => this.players().filter(p => p.team === t).length;
    return n(0) <= n(1) ? 0 : 1;
  }

  handle(player, type, data) {
    switch (type) {
      case 'team': {
        if (this.phase !== 'lobby') return 'لا يمكن تغيير الفريق بعد البدء';
        if (data.team !== 0 && data.team !== 1) return 'فريق غير صالح';
        player.team = data.team;
        return null;
      }
      case 'settings': {
        if (!this.isHost(player) || this.phase !== 'lobby') return 'للمضيف قبل البدء فقط';
        if (data.winMode === 'path' || data.winMode === 'majority') this.winMode = data.winMode;
        return null;
      }
      case 'start': {
        if (!this.isHost(player)) return 'المضيف فقط يبدأ اللعبة';
        if (this.phase !== 'lobby') return 'اللعبة بدأت';
        for (const t of [0, 1]) {
          if (!this.room.connectedPlayers().some(p => p.team === t)) return `يحتاج ${TEAMS[t].name} لاعباً واحداً على الأقل`;
        }
        this.resetMatch();
        this.goPre(CENTER);
        return null;
      }
      case 'buzz': {
        if (this.phase !== 'buzzing') return null;   // too late: ignore quietly
        this.answering = player.team;
        this.queue = [1 - player.team];
        this.isSteal = false;
        this.buzzedBy = player.name;
        this.phase = 'answering';
        this.countdown(ANSWER_TIME, () => this.resolve(false, true, null));
        return null;
      }
      case 'answer': {
        if (this.phase !== 'answering') return 'لا يوجد سؤال';
        if (player.team !== this.answering) return 'ليس دور فريقك';
        if (!isIndex(data.index, this.question.options.length)) return 'اختيار غير صالح';
        this.answeredBy = player.name;
        this.resolve(this.question.options[data.index] === this.question.answer, false, data.index);
        return null;
      }
      case 'skip': {
        // a bad question can be swapped while buzzing (host only)
        if (!this.isHost(player) || this.phase !== 'buzzing') return 'غير متاح الآن';
        this.openQuestion(this.activeIdx);
        return null;
      }
      case 'select': {
        if (this.phase !== 'select') return 'انتظر';
        if (this.control !== null && player.team !== this.control && !this.isHost(player)) return 'ليس دور فريقك';
        if (!isIndex(data.index, TOTAL) || this.grid[data.index].owner !== null) return 'اختر حرفاً متاحاً';
        this.goPre(data.index);
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

  goPre(idx) {
    this.activeIdx = idx;
    this.result = null;
    this.selected = null;
    this.phase = 'pre';
    this.after(PRE_MS, () => this.openQuestion(idx));
  }

  drawQuestion(letter) {
    const pool = getQuestionsByLetter(letter);
    const fresh = pool.filter(q => !this.usedIds.has(q.id));
    const q = shuffle(fresh.length ? fresh : pool)[0] || getRandomQuestion();
    this.usedIds.add(q.id);
    return q;
  }

  openQuestion(idx) {
    this.question = this.drawQuestion(this.grid[idx].letter);
    this.selected = null;
    this.result = null;
    this.answering = null;
    this.isSteal = false;
    this.queue = [];
    this.buzzedBy = null;
    this.answeredBy = null;
    this.phase = 'buzzing';
    this.countdown(BUZZER_TIME, () => this.unresolved({ noBuzz: true }));
  }

  resolve(correct, timeout, index) {
    this.stopTimer();
    this.selected = index;
    if (correct) {
      const winner = this.answering;
      this.grid[this.activeIdx].owner = winner;
      this.result = { correct: true, team: winner, answer: this.question.answer, by: this.answeredBy };
      this.phase = 'result';
      const path = this.winMode === 'path' ? findPath(this.grid, winner) : null;
      this.after(RESULT_MS, () => {
        if (path) { this.winInfo = { team: winner, path }; this.finish(); return; }
        this.goSelect(winner);
      });
      return;
    }
    const res = { correct: false, timeout, answer: this.question.answer, team: this.answering, by: this.answeredBy };
    if (this.queue.length) {
      this.result = res;
      this.phase = 'result';
      this.after(STEAL_GAP_MS, () => {
        this.answering = this.queue.shift();
        this.isSteal = true;
        this.selected = null;
        this.result = null;
        this.answeredBy = null;
        this.phase = 'answering';
        this.countdown(STEAL_TIME, () => this.resolve(false, true, null));
      });
    } else {
      this.unresolved(res);
    }
  }

  unresolved(res) {
    this.result = { answer: this.question.answer, ...res };
    this.phase = 'result';
    this.after(RESULT_MS, () => this.goSelect(this.control));   // hex stays free
  }

  goSelect(control) {
    this.result = null;
    this.selected = null;
    this.question = null;
    if (!this.grid.some(h => h.owner === null)) { this.finishMajority(); return; }
    this.control = control;
    this.activeIdx = -1;
    this.phase = 'select';
  }

  finishMajority() {
    const counts = [0, 1].map(t => this.grid.filter(h => h.owner === t).length);
    const max = Math.max(...counts);
    const leaders = [0, 1].filter(t => counts[t] === max);
    this.winInfo = { team: leaders[0], tie: leaders.length > 1, leaders, majority: true };
    this.finish();
  }

  finish() { this.stopTimer(); this.phase = 'over'; }

  view() {
    const showAnswer = this.phase === 'result';
    return {
      phase: this.phase,
      winMode: this.winMode,
      teams: TEAMS,
      grid: this.grid,
      activeIdx: this.activeIdx,
      control: this.control,
      answering: this.answering,
      isSteal: this.isSteal,
      buzzedBy: this.buzzedBy || null,
      question: this.question && (this.phase === 'buzzing' || this.phase === 'answering' || this.phase === 'result')
        ? { ...publicQuestion(this.question), ...(showAnswer ? { answer: this.question.answer } : {}) }
        : null,
      selected: this.selected,
      result: this.result,
      winInfo: this.winInfo,
      counts: [0, 1].map(t => this.grid.filter(h => h.owner === t).length),
      timer: this.timerView(),
    };
  }
}

module.exports = { HuroofGame, ANSWER_TIME, neighbours, findPath };
