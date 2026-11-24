import { useMuted, setMuted, play } from '../sound';
import './SoundToggle.css';

/** Small fixed button on game pages to mute / unmute the sound effects. */
export default function SoundToggle() {
  const muted = useMuted();
  return (
    <button className="sound-toggle" aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'} title={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
      onClick={() => { setMuted(!muted); if (muted) setTimeout(() => play('start'), 0); }}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {muted
          ? <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />}
      </svg>
    </button>
  );
}
