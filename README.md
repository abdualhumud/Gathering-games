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

## Online rooms (اللعب أونلاين)

The live site (GitHub Pages) is static, so online rooms need the game server running somewhere.

**Easiest — Render (free):**
1. Open https://render.com/deploy?repo=https://github.com/abdualhumud/Gathering-games and sign in with GitHub.
2. Accept the blueprint (`render.yaml`) → it builds and starts `gathering-games`.
3. The site **and** the rooms then both work at `https://<your-service>.onrender.com`.
4. Optional, so the GitHub Pages site uses the server too: repo **Settings → Secrets and variables → Actions → Variables → New** `SERVER_URL = https://<your-service>.onrender.com`, then re-run the Pages workflow.
   (Players can also paste the address in the room screen under «عنوان الخادم».)

Free Render instances sleep after ~15 minutes without traffic; the first visit wakes them in about a minute.

Run the room tests: `npm run test:rooms`.

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
