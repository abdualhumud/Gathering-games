# ألعاب التجمعات — Gathering Games

Arabic social party games platform with real-time multiplayer.

## Games

### ⚡ اسبقهم (Asbiqhum) — "Beat Them"
Speed buzzer trivia: players race to buzz in first and answer correctly.
- Room-based multiplayer (2–8 players)
- Speed-weighted scoring: faster answers = more points
- 10 questions per round from Arabic general-knowledge question bank

### 🔤 حروف (Huroof) — Letter Grid
Hex-style board game for two teams: claim letter cells by answering trivia.
- First team to connect their two borders (top↔bottom or left↔right) wins
- Configurable grid: 4×4, 5×5, or 6×6
- Strategic cell selection (offense vs. defense)

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express + Socket.IO |
| Frontend | React + Vite |
| Real-time | WebSockets (Socket.IO) |
| Styling | CSS custom properties, RTL Arabic |

## Running Locally

```bash
# Install all dependencies
npm run install:all

# Start both server and client
npm run dev
```

Server: http://localhost:3001
Client: http://localhost:5173

## Architecture

```
/
├── server/
│   ├── index.js          # Express + Socket.IO server
│   ├── questions.js      # Arabic question bank (28 questions)
│   └── games/
│       ├── asbiqhum.js   # Speed trivia game logic
│       └── huroof.js     # Hex-style letter grid game logic
└── client/
    └── src/
        ├── App.jsx
        ├── socket.js
        ├── pages/
        │   ├── Home.jsx
        │   ├── AsbiqhumPage.jsx
        │   └── HuroofPage.jsx
        └── components/
            ├── Timer.jsx
            └── Scoreboard.jsx
```
