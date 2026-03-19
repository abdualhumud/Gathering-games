import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import AsbiqhumPage from './pages/AsbiqhumPage';
import HuroofPage from './pages/HuroofPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/asbiqhum" element={<AsbiqhumPage />} />
        <Route path="/huroof" element={<HuroofPage />} />
      </Routes>
    </BrowserRouter>
  );
}
