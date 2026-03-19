// اسبقهم (Asbiqhum) - "Beat Them" Speed Buzzer Trivia Game
// Players race to buzz in first and answer trivia questions
// Points = base points × (timeRemaining / totalTime)

const { getRandomQuestions } = require('../questions');

const QUESTION_TIME = 20; // seconds per question
const BASE_POINTS = 100;
const WRONG_ANSWER_PENALTY = -20;
const QUESTIONS_PER_GAME = 10;

class AsbiqhumGame {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = {}; // socketId -> { name, score, buzzed }
    this.host = null;
    this.state = 'lobby'; // lobby | playing | question | buzzed | results
    this.questions = [];
    this.currentQuestionIndex = -1;
    this.currentQuestion = null;
    this.buzzedPlayer = null;
    this.questionStartTime = null;
    this.timer = null;
    this.questionTimer = null;
  }

  addPlayer(socketId, name) {
    this.players[socketId] = { name, score: 0, buzzed: false, connected: true };
    if (!this.host) this.host = socketId;
  }

  removePlayer(socketId) {
    if (this.players[socketId]) {
      this.players[socketId].connected = false;
    }
    // If host disconnects, assign new host
    if (this.host === socketId) {
      const connected = Object.entries(this.players).find(([id, p]) => p.connected && id !== socketId);
      this.host = connected ? connected[0] : null;
    }
  }

  isHost(socketId) {
    return this.host === socketId;
  }

  startGame() {
    this.questions = getRandomQuestions(QUESTIONS_PER_GAME);
    this.currentQuestionIndex = -1;
    this.state = 'playing';
    // Reset scores
    Object.values(this.players).forEach(p => { p.score = 0; });
    return this.nextQuestion();
  }

  nextQuestion() {
    if (this.timer) clearTimeout(this.timer);
    this.currentQuestionIndex++;
    if (this.currentQuestionIndex >= this.questions.length) {
      return this.endGame();
    }
    this.currentQuestion = this.questions[this.currentQuestionIndex];
    this.buzzedPlayer = null;
    this.questionStartTime = Date.now();
    this.state = 'question';
    // Reset buzz flags
    Object.values(this.players).forEach(p => { p.buzzed = false; });

    return {
      type: 'new_question',
      questionNumber: this.currentQuestionIndex + 1,
      totalQuestions: this.questions.length,
      question: {
        id: this.currentQuestion.id,
        text: this.currentQuestion.text,
        category: this.currentQuestion.category,
        options: this.currentQuestion.options
      },
      timeLimit: QUESTION_TIME
    };
  }

  buzz(socketId) {
    if (this.state !== 'question') return null;
    if (this.players[socketId].buzzed) return null;

    const timeElapsed = (Date.now() - this.questionStartTime) / 1000;
    this.buzzedPlayer = socketId;
    this.state = 'buzzed';

    return {
      type: 'buzzed',
      playerId: socketId,
      playerName: this.players[socketId].name,
      timeElapsed: timeElapsed.toFixed(2)
    };
  }

  submitAnswer(socketId, answerIndex) {
    if (this.state !== 'buzzed') return null;
    if (this.buzzedPlayer !== socketId) return null;

    const timeElapsed = (Date.now() - this.questionStartTime) / 1000;
    const timeRemaining = Math.max(0, QUESTION_TIME - timeElapsed);
    const selectedOption = this.currentQuestion.options[answerIndex];
    const isCorrect = selectedOption === this.currentQuestion.answer;

    let pointsEarned = 0;
    if (isCorrect) {
      pointsEarned = Math.round(BASE_POINTS * (timeRemaining / QUESTION_TIME));
      pointsEarned = Math.max(pointsEarned, 10); // minimum 10 points for correct answer
      this.players[socketId].score += pointsEarned;
    } else {
      pointsEarned = WRONG_ANSWER_PENALTY;
      this.players[socketId].score = Math.max(0, this.players[socketId].score + WRONG_ANSWER_PENALTY);
    }

    this.players[socketId].buzzed = true;

    const result = {
      type: 'answer_result',
      playerId: socketId,
      playerName: this.players[socketId].name,
      isCorrect,
      pointsEarned,
      correctAnswer: this.currentQuestion.answer,
      scores: this.getScoreboard()
    };

    return result;
  }

  timeUp() {
    if (this.state !== 'question' && this.state !== 'buzzed') return null;
    return {
      type: 'time_up',
      correctAnswer: this.currentQuestion.answer,
      scores: this.getScoreboard()
    };
  }

  endGame() {
    this.state = 'results';
    const sorted = Object.entries(this.players)
      .map(([id, p]) => ({ id, name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score);

    return {
      type: 'game_over',
      results: sorted,
      winner: sorted[0]
    };
  }

  getScoreboard() {
    return Object.entries(this.players)
      .map(([id, p]) => ({ id, name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score);
  }

  getState() {
    return {
      roomId: this.roomId,
      state: this.state,
      players: this.getScoreboard(),
      currentQuestion: this.currentQuestion ? {
        id: this.currentQuestion.id,
        text: this.currentQuestion.text,
        category: this.currentQuestion.category,
        options: this.currentQuestion.options,
        number: this.currentQuestionIndex + 1,
        total: this.questions.length
      } : null,
      buzzedPlayer: this.buzzedPlayer,
      buzzedPlayerName: this.buzzedPlayer ? this.players[this.buzzedPlayer]?.name : null,
      host: this.host
    };
  }
}

module.exports = { AsbiqhumGame, QUESTION_TIME };
