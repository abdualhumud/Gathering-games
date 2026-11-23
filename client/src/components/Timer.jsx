import { useEffect, useState, useRef } from 'react';
import './Timer.css';

// `total` (optional) is the full length of the phase — lets a timer that
// starts part-way (online rooms) draw the ring from the right point.
export default function Timer({ duration, running, onEnd, total }) {
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
          onEnd?.();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running, onEnd]);

  const pct = (timeLeft / (total || duration || 1)) * 100;
  const color = pct > 50 ? '#16a34a' : pct > 25 ? '#d97706' : '#dc2626';

  return (
    <div className="timer-wrap">
      <svg className="timer-ring" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r="26" fill="none" stroke="var(--surface3, #ebe8e2)" strokeWidth="4" />
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
