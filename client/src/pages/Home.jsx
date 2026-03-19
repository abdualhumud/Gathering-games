import { useNavigate } from 'react-router-dom';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="home-page">
      <div className="home-hero">
        <div className="home-logo">🎮</div>
        <h1 className="home-title">ألعاب التجمعات</h1>
        <p className="home-subtitle">العاب ترفيهية جماعية باللغة العربية</p>
      </div>

      <div className="games-grid">
        <div className="game-card" onClick={() => navigate('/asbiqhum')}>
          <div className="game-card-icon">⚡</div>
          <h2 className="game-card-title">اسبقهم</h2>
          <p className="game-card-desc">
            لعبة ثقافية سريعة — اضغط أولاً وأجب بشكل صحيح للفوز بالنقاط
          </p>
          <div className="game-card-tags">
            <span className="tag tag-red">سباق</span>
            <span className="tag tag-blue">ثقافة عامة</span>
            <span className="tag">2-8 لاعبين</span>
          </div>
          <button className="btn-primary game-card-btn">العب الآن</button>
        </div>

        <div className="game-card" onClick={() => navigate('/huroof')}>
          <div className="game-card-icon">🔤</div>
          <h2 className="game-card-title">حروف</h2>
          <p className="game-card-desc">
            لعبة الشبكة — فريقان يتنافسان للإجابة على أسئلة وربط مسار من حرف لآخر
          </p>
          <div className="game-card-tags">
            <span className="tag tag-green">استراتيجية</span>
            <span className="tag tag-orange">فريقان</span>
            <span className="tag">2+ لاعبين</span>
          </div>
          <button className="btn-green game-card-btn">العب الآن</button>
        </div>
      </div>

      <footer className="home-footer">
        <p>ألعاب التجمعات &copy; 2024 — مبني بالحب 🤍</p>
      </footer>
    </div>
  );
}
