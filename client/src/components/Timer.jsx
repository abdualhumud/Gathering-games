import { useEffect, useState, useRef } from 'react';
import './Timer.css';

export default function Timer({ duration, running, onExpire }) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const intervalRef = useRef(null);

  useEffect(() => {
    setTimeLeft(duration);
  }, [duration]);

  useEffect(() => {
    if (!running) {
      clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(intervalRef.current);
          onExpire?.();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running, onExpire]);

  const pct = (timeLeft / duration) * 100;
  const color = pct > 50 ? 'var(--green)' : pct > 25 ? 'var(--gold)' : 'var(--accent)';

  return (
    <div className="timer-wrap">
      <svg className="timer-ring" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle
          cx="30" cy="30" r="26" fill="none"
          stroke={color} strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 26}`}
          strokeDashoffset={`${2 * Math.PI * 26 * (1 - pct / 100)}`}
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s', transform: 'rotate(-90deg)', transformOrigin: 'center' }}
        />
      </svg>
      <span className="timer-number" style={{ color }}>{timeLeft}</span>
    </div>
  );
}
