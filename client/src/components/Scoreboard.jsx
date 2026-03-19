import './Scoreboard.css';

const medals = ['🥇', '🥈', '🥉'];

export default function Scoreboard({ players, highlightId }) {
  return (
    <div className="scoreboard">
      {players.map((p, i) => (
        <div key={p.id} className={`score-row ${p.id === highlightId ? 'highlight' : ''}`}>
          <span className="score-rank">{medals[i] || `${i + 1}`}</span>
          <span className="score-name">{p.name}</span>
          <span className="score-pts">{p.score} <small>نقطة</small></span>
        </div>
      ))}
    </div>
  );
}
