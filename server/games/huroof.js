// حروف (Huroof) - Arabic Letter Grid Game
// Two teams compete on a grid of Arabic letters
// Correct answers claim that letter cell for your team
// First team to connect from one border to the opposite border wins (Hex-style)
// Team A (green): top-to-bottom connection
// Team B (orange): left-to-right connection

const { getRandomLetters, getQuestionsByLetter, getRandomQuestion } = require('../questions');

const GRID_SIZES = { small: 4, medium: 5, large: 6 };
const ANSWER_TIME = 30; // seconds per question

class HuroofGame {
  constructor(roomId, gridSize = 'medium') {
    this.roomId = roomId;
    this.gridN = GRID_SIZES[gridSize] || 5;
    this.players = {}; // socketId -> { name, team, connected }
    this.teams = {
      A: { name: 'الفريق الأخضر', color: 'green', members: [] },
      B: { name: 'الفريق البرتقالي', color: 'orange', members: [] }
    };
    this.host = null;
    this.state = 'lobby'; // lobby | playing | selecting | answering | results
    this.grid = []; // [{letter, owner: null|'A'|'B', row, col}]
    this.currentTurn = 'A'; // which team's turn
    this.selectedCell = null;
    this.currentQuestion = null;
    this.questionStartTime = null;
    this.winner = null;
    this._initGrid();
  }

  _initGrid() {
    const letters = getRandomLetters(this.gridN * this.gridN);
    this.grid = [];
    for (let row = 0; row < this.gridN; row++) {
      for (let col = 0; col < this.gridN; col++) {
        this.grid.push({
          index: row * this.gridN + col,
          row,
          col,
          letter: letters[row * this.gridN + col],
          owner: null
        });
      }
    }
  }

  addPlayer(socketId, name, team) {
    const assignedTeam = team || (this.teams.A.members.length <= this.teams.B.members.length ? 'A' : 'B');
    this.players[socketId] = { name, team: assignedTeam, connected: true };
    this.teams[assignedTeam].members.push(socketId);
    if (!this.host) this.host = socketId;
  }

  removePlayer(socketId) {
    if (this.players[socketId]) {
      this.players[socketId].connected = false;
      const team = this.players[socketId].team;
      this.teams[team].members = this.teams[team].members.filter(id => id !== socketId);
    }
    if (this.host === socketId) {
      const connected = Object.entries(this.players).find(([id, p]) => p.connected && id !== socketId);
      this.host = connected ? connected[0] : null;
    }
  }

  isHost(socketId) {
    return this.host === socketId;
  }

  startGame() {
    this._initGrid();
    this.state = 'selecting';
    this.currentTurn = 'A';
    this.winner = null;
    return {
      type: 'game_started',
      grid: this.grid,
      gridN: this.gridN,
      currentTurn: this.currentTurn,
      teams: this.teams
    };
  }

  selectCell(socketId, cellIndex) {
    if (this.state !== 'selecting') return null;
    const player = this.players[socketId];
    if (!player || player.team !== this.currentTurn) return null;

    const cell = this.grid[cellIndex];
    if (!cell || cell.owner !== null) return null;

    this.selectedCell = cellIndex;
    this.state = 'answering';
    this.questionStartTime = Date.now();

    // Get question related to the selected letter
    const letterQuestions = getQuestionsByLetter(cell.letter);
    this.currentQuestion = letterQuestions.length > 0
      ? letterQuestions[Math.floor(Math.random() * letterQuestions.length)]
      : getRandomQuestion();

    return {
      type: 'cell_selected',
      cellIndex,
      letter: cell.letter,
      team: this.currentTurn,
      question: {
        id: this.currentQuestion.id,
        text: this.currentQuestion.text,
        category: this.currentQuestion.category,
        options: this.currentQuestion.options,
        letter: cell.letter
      },
      timeLimit: ANSWER_TIME
    };
  }

  submitAnswer(socketId, answerIndex) {
    if (this.state !== 'answering') return null;
    const player = this.players[socketId];
    if (!player || player.team !== this.currentTurn) return null;

    const selectedOption = this.currentQuestion.options[answerIndex];
    const isCorrect = selectedOption === this.currentQuestion.answer;
    const cell = this.grid[this.selectedCell];

    if (isCorrect) {
      cell.owner = this.currentTurn;
    }

    const winCheck = isCorrect ? this._checkWin(this.currentTurn) : false;
    const result = {
      type: 'answer_result',
      isCorrect,
      correctAnswer: this.currentQuestion.answer,
      cellIndex: this.selectedCell,
      owner: isCorrect ? this.currentTurn : null,
      grid: this.grid
    };

    if (winCheck) {
      this.winner = this.currentTurn;
      this.state = 'results';
      result.winner = this.currentTurn;
      result.winnerName = this.teams[this.currentTurn].name;
      result.type = 'game_over';
    } else {
      // Switch turns
      this.currentTurn = this.currentTurn === 'A' ? 'B' : 'A';
      this.state = 'selecting';
      result.nextTurn = this.currentTurn;
    }

    this.selectedCell = null;
    this.currentQuestion = null;
    return result;
  }

  timeUp() {
    if (this.state !== 'answering') return null;
    const result = {
      type: 'time_up',
      correctAnswer: this.currentQuestion.answer,
      cellIndex: this.selectedCell,
      grid: this.grid
    };
    // No cell claimed, switch turns
    this.currentTurn = this.currentTurn === 'A' ? 'B' : 'A';
    this.state = 'selecting';
    result.nextTurn = this.currentTurn;
    this.selectedCell = null;
    this.currentQuestion = null;
    return result;
  }

  // Check if team has a winning path using BFS
  // Team A wins with top-to-bottom connection (rows 0 to gridN-1)
  // Team B wins with left-to-right connection (cols 0 to gridN-1)
  _checkWin(team) {
    const n = this.gridN;
    const owned = new Set(
      this.grid.filter(c => c.owner === team).map(c => c.index)
    );

    const startCells = team === 'A'
      ? this.grid.filter(c => c.row === 0 && owned.has(c.index)).map(c => c.index)
      : this.grid.filter(c => c.col === 0 && owned.has(c.index)).map(c => c.index);

    const visited = new Set();
    const queue = [...startCells];
    visited.add(...startCells);

    while (queue.length > 0) {
      const idx = queue.shift();
      const cell = this.grid[idx];

      // Check if reached opposite border
      if (team === 'A' && cell.row === n - 1) return true;
      if (team === 'B' && cell.col === n - 1) return true;

      // Get neighbors (4-directional + 2 diagonal for Hex-like)
      const neighbors = this._getNeighbors(cell.row, cell.col);
      for (const nIdx of neighbors) {
        if (owned.has(nIdx) && !visited.has(nIdx)) {
          visited.add(nIdx);
          queue.push(nIdx);
        }
      }
    }
    return false;
  }

  _getNeighbors(row, col) {
    const n = this.gridN;
    const neighbors = [];
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, 1], [1, -1]]; // Hex adjacency
    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < n && nc >= 0 && nc < n) {
        neighbors.push(nr * n + nc);
      }
    }
    return neighbors;
  }

  getState() {
    return {
      roomId: this.roomId,
      state: this.state,
      grid: this.grid,
      gridN: this.gridN,
      currentTurn: this.currentTurn,
      teams: this.teams,
      players: this.players,
      host: this.host,
      winner: this.winner,
      selectedCell: this.selectedCell,
      currentQuestion: this.currentQuestion ? {
        id: this.currentQuestion.id,
        text: this.currentQuestion.text,
        category: this.currentQuestion.category,
        options: this.currentQuestion.options
      } : null
    };
  }
}

module.exports = { HuroofGame, ANSWER_TIME };
