# CLAUDE.md — Gathering Games Project Guide

## Project Overview

**ألعاب التجمعات** is an Arabic-language social party games platform. Three games are implemented, each with a local (offline, same-device) mode and an online room mode via WebSockets.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express + Socket.IO |
| Frontend | React 18 + Vite |
| Real-time | WebSockets (Socket.IO) |
| Routing | React Router v6 (HashRouter — required for GitHub Pages) |
| Styling | Plain CSS with custom properties, RTL Arabic (`direction: rtl`) |
| Font | Tajawal (Google Fonts) — the only Arabic-optimised weight-variable font used |
| Deployment | GitHub Actions → GitHub Pages (static export of `client/dist`) |

---

## Running Locally

```bash
# Install all dependencies (root + client)
npm run install:all

# Start both server (port 3001) and client dev server (port 5173)
npm run dev
```

Server: `http://localhost:3001`  
Client: `http://localhost:5173`

Build for production:
```bash
cd client && npm run build   # outputs to client/dist/
```

Preview built output:
```bash
cd client && npm run preview  # serves on :4173 by default
```

---

## Project Structure

```
/
├── server/
│   ├── index.js                 # Express + Socket.IO server, room stores
│   ├── questions.js             # Master question aggregator (imports all category files)
│   ├── questions_*.js           # 28 category files, ~100 questions each (~3000 total)
│   └── games/
│       ├── asbiqhum.js          # Speed-buzzer trivia game logic
│       ├── huroof.js            # Hex letter-grid game logic
│       └── moneyboard.js        # Jeopardy-style money board logic
└── client/
    └── src/
        ├── App.jsx              # HashRouter + 4 routes
        ├── index.css            # Global design tokens + shared components
        ├── socket.js            # Socket.IO client singleton
        ├── questions.js         # Client-side question list (mirrors server)
        ├── pages/
        │   ├── Home.jsx / Home.css
        │   ├── AsbiqhumPage.jsx / AsbiqhumPage.css
        │   ├── HuroofPage.jsx / HuroofPage.css
        │   └── MoneyBoardPage.jsx / MoneyBoardPage.css
        ├── components/
        │   ├── Timer.jsx / Timer.css
        │   └── Scoreboard.jsx / Scoreboard.css
        └── data/
            └── huroof-themes.js  # Theme definitions + CSS variable injection for Huroof
```

---

## Question Format

Every question object has this shape:

```js
{
  text: "نص السؤال",       // question text (Arabic)
  answer: "الإجابة",       // correct answer string
  options: ["أ", "ب", "ج", "د"],  // 4 multiple-choice options (includes answer)
  category: "اسم الفئة",   // category name (Arabic)
  letter: "ح",              // first letter of the answer (used by Huroof game)
}
```

The 15 MoneyBoard categories (must match exactly between client and server):
```
جغرافيا عربية، حيوانات وطبيعة، ثقافة وفنون، تاريخ عالمي، رياضة وأولمبياد،
أدب عربي ولغة، جغرافيا عالمية، تكنولوجيا وحاسوب، فيزياء وكيمياء، طعام ومطبخ،
قرآن ومعرفة إسلامية، فلك وعلوم الفضاء، معلومات عامة، أحياء وجسم الإنسان، رياضيات
```

---

## Games

### 1. اسبقهم (Asbiqhum) — Speed Buzzer Trivia

**Theme:** Electric / Speed — deep navy `#060c18`, electric cyan `#00d4ff`

**Local mode:**
- Add 2–8 players by name
- All players see the question; whoever presses their buzzer button first gets to answer
- Correct: points based on speed; Wrong: `-20` penalty
- 10 questions per game

**Online room mode:**
- One device creates a room (gets a 6-char code), others join
- Each player presses a single "🔔 اسبقهم!" buzzer button on their own device
- Server tracks who buzzed first; only that player sees the answer options

**CSS design decisions:**
- Scoped CSS vars on `.asbiq-*` selectors — avoids polluting global scope
- Per-player buzz buttons use `nth-child(1..8)` with `--pc` and `--pc-dim` vars for 8 distinct player colors
- `iconPulse` animation on setup icon; `trophyFloat` on gameover trophy

---

### 2. حروف (Huroof) — Hex Letter Grid

**Theme:** Configurable — multiple built-in themes + custom color picker

**Gameplay:**
- 5×5 flat-top hexagonal grid, each cell has a random Arabic letter
- 2–6 teams; first move must be the center hex (index 12)
- A team picks an unclaimed hex; a question is drawn for that letter
- Correct: team claims the hex; Wrong: opponent gets a steal attempt
- Winner is the first team to claim the most hexes (no path-win currently)

**Buzzer mechanic:**
- Short 8-second buzzer phase where any team can buzz in
- Then 30-second answer phase; if wrong, 15-second steal phase

**Themes system (`client/src/data/huroof-themes.js`):**
- Each theme exports CSS variable values injected into `:root` via `applyThemeCSS()`
- `buildCustomTheme(colorA, colorB)` generates a theme from two hex colors
- Theme choice is persisted in `localStorage`

---

### 3. لوحة المال (MoneyBoard) — Jeopardy Board

**Reference design:** asbghm.com — classic TV Jeopardy look

**Visual spec (board):**
- `background: #010814` — very dark navy for game/question pages
- Board wrapper: `background: #000`, `padding: 4px`, black gaps between cells
- Category header cells: `background: #2e2ea8` — visible blue-purple, white bold text
- Money cells: `background: #2e2ea8`, hover `#4040cc`, active gold outline
- Money amount: `font-size: 2.4rem`, `color: #f0c040`, large and dominant
- "ريال" sub-label: `color: #c8a830`, `font-size: 0.7rem`
- Answered (Team A win): `background: #0f0f6a; opacity: 0.65`
- Answered (Team B win): `background: #4a1800; opacity: 0.65`
- Team A color: `var(--blue)` (#5b9aff); Team B color: `var(--orange)` (#f97316)

**DO NOT** use olive/cream colors for MoneyBoard. That theme was tried and reverted.

**Gameplay:**
- 2 teams, 6 categories chosen from 15 available, 3 difficulty rows (200 / 400 / 600 ريال)
- Alternating turns; the active team picks a cell
- 30s to answer; wrong → opponent gets 15s steal chance
- All 18 cells filled → game over, highest money wins

**Super powers (5 per team, matching asbghm.com):**

| ID | Icon | Name | Effect |
|---|---|---|---|
| `double` | 2x | مضاعفة النقاط | Correct answer earns 2× points |
| `two` | ✌️ | إجابتين | First wrong answer → second attempt (no steal) |
| `hafra` | 🔄 | الحفرة | Correct answer also deducts same amount from opponent |
| `friend` | 📞 | اتصل بصديق | 30-second call-a-friend countdown overlay |
| `block` | 🚫 | بلوك | Removes one random unused power from opponent |

**Moderator panel:** Fixed ⚙️ button (bottom-left), allows manual ±score adjustment per team during game.

**Result flash:** Fixed `position: fixed; bottom: 28px` banner — correct=green, wrong=red.

**Category picker:** Gold chip when selected, shows question count badge; max 6 selectable.

---

## CSS Architecture

### Global tokens (`client/src/index.css`)
```css
:root {
  --bg: #0d0d1a;       --surface: #181830;   --surface2: #12122a;
  --accent: #e94560;   --green: #22c55e;     --orange: #f97316;
  --blue: #5b9aff;     --gold: #fbbf24;      --text: #f0f0f5;
  --muted: #8a8aab;    --radius: 14px;       --radius-sm: 8px;
}
```

### Scoping pattern (important)
Each game's CSS scopes its custom variables to its own page classes to avoid conflicts:

```css
/* MoneyBoard — no scoped vars, uses global tokens directly */
/* Huroof — vars injected into :root by JS (theme system) */
/* Asbiqhum — vars scoped to .asbiq-setup, .asbiq-lobby, etc. */
.asbiq-setup, .asbiq-lobby, .asbiq-question, .asbiq-result, .asbiq-gameover {
  --elec: #00d4ff;
  --navy: #060c18;
  /* ... */
}
```

### Shared utility classes (defined in `index.css`, used across games)
`.page`, `.card`, `.pop-in`, `.pulse`, `.shake`, `.back-btn`, `.setup-card`,
`.input-field`, `.options-grid`, `.option-btn`, `.gameover-hero`, `.final-scores`,
`.lobby-card`, `.room-code`, `.player-item`, `.btn-primary`, `.btn-secondary`,
`.btn-green`, `.btn-gold`, `.btn-orange`

---

## Socket.IO Event Namespaces

| Game | Prefix | Key events |
|---|---|---|
| Asbiqhum | `asbiqhum:` | create, join, start, buzz, answer, time_up, game_over |
| Huroof | `huroof:` | create, join, start, select_hex, buzz, answer, steal, game_over |
| MoneyBoard | `money:` | create, join, start, select_cell, answer, steal_chance, answer_result, game_over |

---

## GitHub Pages Deployment

- Workflow file: `.github/workflows/deploy.yml`
- Triggers on push to: `main` or `claude/gaming-platform-research-UFWNO`
- Builds `client/` with Vite, uploads `client/dist/` as Pages artifact
- **HashRouter is required** because GitHub Pages doesn't support server-side routing — `BrowserRouter` would break on direct URL access
- `vite.config.js` must have `base: '/Gathering-games/'` for asset paths to resolve correctly on GitHub Pages
- If the live site doesn't update after a push: check GitHub → Actions tab for workflow status; also try hard-refresh (Ctrl+Shift+R) to clear browser cache

---

## Key Design Decisions & Lessons

1. **MoneyBoard board color** — The correct cell color is `#2e2ea8` (visible blue-purple). `#06068c` is too dark (near-black) and doesn't match the asbghm.com reference design.

2. **MoneyBoard theme** — The olive/cream theme was tried and rejected. Always use the dark Jeopardy style (dark navy background, blue-purple cells, gold amounts).

3. **HashRouter over BrowserRouter** — GitHub Pages serves everything from one HTML file; `BrowserRouter` causes 404 on refresh or direct navigation. `HashRouter` works without server config.

4. **CSS variable scoping** — Scope game-specific CSS variables to that game's page classes, not `:root`, to prevent cross-game color leaks (especially important since all three games share `index.css` globals).

5. **Questions client/server mirroring** — `client/src/questions.js` and `server/questions.js` both aggregate the same question data. Any new category must be added to both, and the category string must exactly match `VALID_CATEGORIES` in `MoneyBoardPage.jsx`.

6. **Local-first architecture** — All three games work fully offline in local mode without the Node.js server. Online room mode requires the server on port 3001. This matters for GitHub Pages deployment (only static files hosted — room mode requires a separately deployed server).

7. **Huroof letter matching** — Questions are indexed by the first letter of their `answer` field. The `letter` property must be set correctly when adding questions for Huroof to draw relevant questions per hex.

8. **Super powers reset on each question** — `isDoubled`, `isTwoAnswers`, `isHafra`, `eliminatedOpts`, `friendTimer` must all be reset when `pickCell()` is called (not just when the answer resolves), so powers from a previous question don't carry over.
