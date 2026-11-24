// اسبقهم (Asbiqhum) — online speed-buzzer trivia.
// phase: lobby → question ⇄ buzzed → result → … → over
//  • Everyone sees the question; the first to buzz gets 10 s to answer.
//  • Correct: points by speed (100 × time left / 20, min 10).
//  • Wrong:   −20 (never below 0) and that player is locked out; the clock
//             resumes for the others if time is left.
const { BaseGame, isIndex, publicQuestion } = require('./base');
const { questions, shuffle, withShuffledOptions } = require('../questions');

const QUESTION_TIME = 20;
const ANSWER_TIME = 10;
const RESULT_MS = 4000;
const BASE_POINTS = 100;
const WRONG_PENALTY = -20;
const QUESTION_OPTIONS = [5, 10, 15, 20];

class AsbiqhumGame extends BaseGame {
  constructor(room, options) {
    super(room);
    this.total = QUESTION_OPTIONS.includes(options.questions) ? options.questions : 10;
    this.usedIds = new Set();
    this.scores = {};
    this.resetRound();
  }

  resetRound() {
    this.qs = [];
    this.qIndex = -1;
    this.current = null;
    this.buzzerId = null;
    this.locked = new Set();
    this.result = null;
    this.timeLeftMs = 0;    // question clock when paused by a buzz
  }

  onJoin(p) { if (p.role !== 'display') this.scores[p.id] = 0; }
  onLeave(p) {
    delete this.scores[p.id];
    this.locked.delete(p.id);
    // kicked/left while holding the buzzer → give the question back to the others
    if (this.phase === 'buzzed' && this.buzzerId === p.id) {
      if (this.timeLeftMs > 2000 && this.room.activePlayers().some(x => x.id !== p.id)) this.openQuestion(Math.ceil(this.timeLeftMs / 1000));
      else this.showResult({ kind: 'timeout' });
    }
  }

  handle(player, type, data) {
    switch (type) {
      case 'settings': {
        if (!this.isHost(player) || this.phase !== 'lobby') return 'للمضيف قبل البدء فقط';
        if (QUESTION_OPTIONS.includes(data.questions)) this.total = data.questions;
        return null;
      }
      case 'start': return this.start(player);
      case 'buzz': return this.buzz(player);
      case 'answer': return this.answer(player, data.index);
      case 'next': {
        if (!this.isHost(player) || this.phase !== 'result') return 'غير متاح الآن';
        this.advance();
        return null;
      }
      case 'restart': {
        if (!this.isHost(player) || this.phase !== 'over') return 'غير متاح الآن';
        this.stopTimer();
        this.resetRound();
        this.phase = 'lobby';
        return null;
      }
      default: return 'إجراء غير معروف';
    }
  }

  start(player) {
    if (!this.isHost(player)) return 'المضيف فقط يبدأ اللعبة';
    if (this.phase !== 'lobby') return 'اللعبة بدأت';
    if (this.room.activePlayers().length < 2) return 'تحتاج لاعبَين على الأقل';
    let pool = questions.filter(q => !this.usedIds.has(q.id));
    if (pool.length < this.total) { this.usedIds.clear(); pool = questions; }
    this.resetRound();
    this.qs = shuffle(pool).slice(0, this.total).map(withShuffledOptions);
    this.qs.forEach(q => this.usedIds.add(q.id));
    for (const id of Object.keys(this.scores)) this.scores[id] = 0;
    this.nextQuestion();
    return null;
  }

  nextQuestion() {
    this.qIndex++;
    if (this.qIndex >= this.qs.length) { this.finish(); return; }
    this.current = this.qs[this.qIndex];
    this.buzzerId = null;
    this.locked = new Set();
    this.result = null;
    this.openQuestion(QUESTION_TIME);
  }

  openQuestion(seconds) {
    this.phase = 'question';
    this.buzzerId = null;
    this.countdown(seconds, () => this.showResult({ kind: 'timeout' }));
  }

  buzz(player) {
    if (player.role === 'display') return 'شاشة العرض لا تلعب';
    if (this.phase !== 'question') return null;          // late buzz: silently ignored
    if (this.locked.has(player.id)) return 'أجبت خطأ في هذا السؤال';
    this.timeLeftMs = this.msLeft();
    this.buzzerId = player.id;
    this.phase = 'buzzed';
    this.countdown(ANSWER_TIME, () => this.wrong(player.id, null, true));
    return null;
  }

  answer(player, index) {
    if (this.phase !== 'buzzed' || this.buzzerId !== player.id) return 'ليس دورك للإجابة';
    if (!isIndex(index, this.current.options.length)) return 'اختيار غير صالح';
    const correct = this.current.options[index] === this.current.answer;
    if (correct) {
      const points = Math.max(10, Math.round(BASE_POINTS * (this.timeLeftMs / 1000) / QUESTION_TIME));
      this.scores[player.id] = (this.scores[player.id] || 0) + points;
      this.showResult({ kind: 'correct', playerId: player.id, points, selected: index });
    } else {
      this.wrong(player.id, index, false);
    }
    return null;
  }

  wrong(playerId, index, timedOut) {
    this.scores[playerId] = Math.max(0, (this.scores[playerId] || 0) + WRONG_PENALTY);
    this.locked.add(playerId);
    const others = this.room.activePlayers().filter(p => !this.locked.has(p.id));
    const lastWrong = { playerId, selected: index, timedOut };
    if (others.length && this.timeLeftMs > 2000) {
      this.lastWrong = lastWrong;
      this.openQuestion(Math.ceil(this.timeLeftMs / 1000));
    } else {
      this.showResult({ kind: 'wrong', points: WRONG_PENALTY, ...lastWrong });
    }
  }

  showResult(res) {
    this.phase = 'result';
    this.lastWrong = null;
    this.result = { ...res, correctAnswer: this.current.answer };
    this.after(RESULT_MS, () => this.advance());
  }

  advance() {
    if (this.qIndex + 1 >= this.qs.length) this.finish();
    else this.nextQuestion();
  }

  finish() {
    this.stopTimer();
    this.phase = 'over';
    this.current = null;
  }

  onDisconnect(p) {
    // Buzzed player vanished → count it as a miss right away.
    if (this.phase === 'buzzed' && this.buzzerId === p.id) this.wrong(p.id, null, true);
  }

  view() {
    return {
      phase: this.phase,
      total: this.total,
      qIndex: this.qIndex,
      question: this.phase === 'lobby' || this.phase === 'over' ? null : publicQuestion(this.current),
      buzzerId: this.buzzerId,
      locked: [...this.locked],
      lastWrong: this.lastWrong || null,
      result: this.result,
      scores: this.scores,
      timer: this.timerView(),
    };
  }
}

module.exports = { AsbiqhumGame, QUESTION_TIME };
