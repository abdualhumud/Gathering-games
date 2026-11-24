import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import SoundToggle from './components/SoundToggle';
import Home from './pages/Home';
import AsbiqhumPage from './pages/AsbiqhumPage';
import HuroofPage from './pages/HuroofPage';
import MoneyBoardPage from './pages/MoneyBoardPage';

export default function App() {
  return (
    <HashRouter>
      <GameChrome />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/asbiqhum" element={<AsbiqhumPage />} />
        <Route path="/huroof" element={<HuroofPage />} />
        <Route path="/moneyboard" element={<MoneyBoardPage />} />
      </Routes>
    </HashRouter>
  );
}

/** Mute button on every game page (not on the home page). */
function GameChrome() {
  const { pathname } = useLocation();
  return pathname === '/' ? null : <SoundToggle />;
}
