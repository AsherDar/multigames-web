import React, { useState } from 'react';
import { Hexagon, LayoutGrid, Disc, AlignJustify, Anchor, Gamepad2, RotateCcw, LogOut } from 'lucide-react';

// ייבוא המשחקים מתוך תיקיית games
import HexGame from './games/HexGame';
import ReversiGame from './games/ReversiGame';
import BattleshipGame from './games/BattleshipGame';
import Connect4Game from './games/Connect4Game';
import DotsAndBoxesGame from './games/DotsAndBoxesGame';
import UltimateTicTacToeGame from './games/UltimateTicTacToeGame';

// ==========================================
// רכיב כרטיסייה עבור מסך הפתיחה
// ==========================================
const GameCard = ({ title, icon: Icon, glowColor, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`
        group relative w-full h-[140px] rounded-3xl p-6 flex flex-col items-center justify-center gap-3
        bg-white/5 backdrop-blur-md border border-white/10 transition-all duration-500 ease-out
        hover:-translate-y-2 hover:bg-white/10 hover:border-white/30 hover:shadow-[0_0_40px_-10px_var(--glow)]
        cursor-pointer overflow-hidden
      `}
      style={{ '--glow': glowColor }}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500" style={{ background: `radial-gradient(circle at center, ${glowColor} 0%, transparent 70%)` }} />
      <div className="text-white/70 group-hover:text-white transition-colors duration-300 drop-shadow-md z-10" style={{ filter: `drop-shadow(0 0 8px ${glowColor})` }}>
        <Icon size={48} strokeWidth={1.5} />
      </div>
      <span className="text-xl font-bold text-white/90 group-hover:text-white tracking-wide z-10">{title}</span>
    </button>
  );
};

// ==========================================
// מסך הפתיחה הראשי והניווט (Main App)
// ==========================================
export default function App() {
  const [currentScreen, setCurrentScreen] = useState('menu');
  const [selectedBank, setSelectedBank] = useState('');
  
  // נתוני דמה של מאגרי שאלות (בהמשך יתחבר למסד נתונים אמיתי)
  const questionBanks = [
    { id: 1, name: "הכנה לבגרות במתמטיקה 4 יח'" },
    { id: 2, name: "היסטוריה - שנות ה-20" },
    { id: 3, name: "אנגלית - אוצר מילים חורף 2024" }
  ];

  const handleGameStart = (gameName) => {
    if (!selectedBank) {
      alert("אנא בחר מאגר שאלות לפני תחילת המשחק!");
      return;
    }
    
    // ניתוב למשחקים בהתאם לשם הכרטיסייה
    if (gameName === "כיבוש הקס") {
      setCurrentScreen('hexGame');
    } else if (gameName === "רברסי") {
      setCurrentScreen('reversiGame');
      } else if (gameName === "מלחמה ימית") {
      setCurrentScreen('battleshipGame');
      } else if (gameName === "ארבע בשורה") {
      setCurrentScreen('connect4Game');
    } else if (gameName === "קווים וריבועים") {
      setCurrentScreen('dotsAndBoxesGame');   
      } else if (gameName === "איקס-עיגול אסטרטגי") {
      setCurrentScreen('ultimateTicTacToeGame');  
    } else {
      alert(`המשחק ${gameName} נמצא עדיין בשלבי פיתוח!`);
    }
  };

  const handleReset = () => {
    setSelectedBank('');
    alert("מאגר השאלות אופס");
  };

  // ==========================================
  // מנגנון הניווט (Routing) - מעבר בין מסכים
  // ==========================================
  
  if (currentScreen === 'hexGame') {
    return <HexGame onBackToMenu={() => setCurrentScreen('menu')} />;
  }
  
  if (currentScreen === 'reversiGame') {
    return <ReversiGame onBackToMenu={() => setCurrentScreen('menu')} />;
  }
  
  if (currentScreen === 'battleshipGame') {
    return <BattleshipGame onBackToMenu={() => setCurrentScreen('menu')} />;
  }

  if (currentScreen === 'connect4Game') {
    return <Connect4Game onBackToMenu={() => setCurrentScreen('menu')} />;
  }

  if (currentScreen === 'dotsAndBoxesGame') {
    return <DotsAndBoxesGame onBackToMenu={() => setCurrentScreen('menu')} />;
  }

  if (currentScreen === 'ultimateTicTacToeGame') {
    return <UltimateTicTacToeGame onBackToMenu={() => setCurrentScreen('menu')} />;
  }

  // ==========================================
  // תצוגת התפריט הראשי
  // ==========================================
  return (
    <div dir="rtl" className="min-h-screen w-full relative overflow-hidden bg-[#0a0a1a] font-sans flex flex-col items-center py-12 px-4 text-white">
      {/* הילות רקע */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-purple-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-cyan-600/15 blur-[150px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-6xl flex flex-col items-center">
        <div className="text-center mb-16">
          <h1 className="text-6xl md:text-[80px] font-black mb-4 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500 drop-shadow-[0_0_20px_rgba(192,132,252,0.3)]">
            MultiGames
          </h1>
          <p className="text-xl md:text-2xl font-light text-slate-300/80">
            בחר משחק ואתגר את הכיתה
          </p>
        </div>

        {/* גריד המשחקים */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 w-full mb-16 px-4">
          <GameCard title="כיבוש הקס" icon={Hexagon} glowColor="#e81cff" onClick={() => handleGameStart("כיבוש הקס")} />
          <GameCard title="קווים וריבועים" icon={LayoutGrid} glowColor="#40ff5a" onClick={() => handleGameStart("קווים וריבועים")} />
          <GameCard title="רברסי" icon={Disc} glowColor="#7b2cbf" onClick={() => handleGameStart("רברסי")} />
          <GameCard title="ארבע בשורה" icon={AlignJustify} glowColor="#ff9e00" onClick={() => handleGameStart("ארבע בשורה")} />
          <GameCard title="מלחמה ימית" icon={Anchor} glowColor="#00f5d4" onClick={() => handleGameStart("מלחמה ימית")} />
          <GameCard title="איקס-עיגול אסטרטגי" icon={Gamepad2} glowColor="#f15bb5" onClick={() => handleGameStart("איקס-עיגול אסטרטגי")} />
        </div>

        {/* סרגל כלים תחתון (בחירת מאגר שאלות) */}
        <div className="w-full max-w-3xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <span className="text-slate-200 text-lg font-medium">מאגר שאלות:</span>
            <select 
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              className="w-full sm:w-[260px] h-[48px] bg-black/40 text-white border border-white/20 rounded-xl px-4 font-medium text-base cursor-pointer outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all appearance-none"
            >
              <option value="" disabled>-- בחר מאגר מהרשימה --</option>
              {questionBanks.map(bank => (
                <option key={bank.id} value={bank.name} className="bg-slate-900 text-white">
                  {bank.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleReset} title="איפוס מאגר" className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 hover:border-white/30 transition-all duration-300">
              <RotateCcw size={20} />
            </button>
            <button onClick={() => alert('מתנתק מהמערכת...')} className="px-6 h-12 flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all duration-300 font-medium">
              <LogOut size={18} />
              <span>יציאה</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}