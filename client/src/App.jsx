import { HashRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import AsbiqhumPage from './pages/AsbiqhumPage';
import HuroofPage from './pages/HuroofPage';
import MoneyBoardPage from './pages/MoneyBoardPage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/asbiqhum" element={<AsbiqhumPage />} />
        <Route path="/huroof" element={<HuroofPage />} />
        <Route path="/moneyboard" element={<MoneyBoardPage />} />
      </Routes>
    </HashRouter>
  );
}
