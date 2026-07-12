import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
// הוספתי את האייקון Eye עבור המשחק החדש
import { Hexagon, LayoutGrid, Disc, AlignJustify, Anchor, Gamepad2, RotateCcw, LogOut, Settings, Mail, Lock, Eye, Hash } from 'lucide-react';

// ייבוא פאנל הניהול (נמצא בתוך src)
import TeacherDashboard from './TeacherDashboard';

// ייבוא המשחקים מתוך תיקיית games
import BattleshipGame from './games/BattleshipGame';
import Connect4Game from './games/Connect4Game';
import DotsAndBoxesGame from './games/DotsAndBoxesGame';
import HexGame from './games/HexGame';
import ReversiGame from './games/ReversiGame';
import UltimateTicTacToeGame from './games/UltimateTicTacToeGame';
import SpotMatchGame from './games/SpotMatchGame';
import BingoGame from './games/BingoGame';

// ==========================================
// רכיב כרטיסייה עבור מסך הפתיחה (העיצוב המקורי שלך)
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
  // === ניהול מצב (State) ענני ===
  const [session, setSession] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('menu');
  const [questionBanks, setQuestionBanks] = useState([]);
  const [selectedBank, setSelectedBank] = useState('');
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);

  // משתני התחברות למסך הכניסה
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 1. האזנה להתחברות מול Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. משיכת מאגרי השאלות מהענן
  useEffect(() => {
    const fetchTopics = async () => {
      setIsLoadingBanks(true);
      const { data, error } = await supabase.from('topics').select('*');

      if (error) {
        console.error("שגיאה במשיכת נושאים:", error);
      } else {
        const banks = data || [];
        setQuestionBanks(banks);
        
        setSelectedBank(prevBank => {
          const stillExists = banks.find(b => String(b.id) === String(prevBank));
          return stillExists ? prevBank : (banks.length > 0 ? banks[0].id : '');
        });
      }
      setIsLoadingBanks(false);
    };

    if (currentScreen === 'menu' && session) {
      fetchTopics();
    }
  }, [currentScreen, session]);

  // פעולות מערכת
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError("אימייל או סיסמה שגויים.");
    setIsLoggingIn(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleGameStart = (gameId) => {
    if (!selectedBank) {
      alert("אנא בחר מאגר שאלות לפני תחילת המשחק!");
      return;
    }
    setCurrentScreen(gameId);
  };

  // ==========================================
  // 3. מסך התחברות (לפני כניסה למערכת)
  // ==========================================
  if (!session) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#0a0a1a] flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-white/10 p-10 rounded-3xl w-full max-w-md text-center shadow-2xl">
          <Gamepad2 size={48} className="text-cyan-400 mx-auto mb-4" />
          <h1 className="text-4xl font-black text-white mb-2">MultiGames</h1>
          <p className="text-slate-400 mb-8">התחברות למערכת מורים</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="אימייל" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white outline-none focus:border-cyan-400" required />
            <input type="password" placeholder="סיסמה" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white outline-none focus:border-cyan-400" required />
            {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
            <button type="submit" disabled={isLoggingIn} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition-all mt-4">
              {isLoggingIn ? 'מתחבר...' : 'התחבר למערכת'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // 4. מנגנון הניווט (Routing) - מעבר בין מסכים
  // ==========================================
  if (currentScreen === 'teacher') return <TeacherDashboard session={session} onBack={() => setCurrentScreen('menu')} />;
  if (currentScreen === 'battleshipGame') return <BattleshipGame session={session} selectedBank={selectedBank} onBackToMenu={() => setCurrentScreen('menu')} />;
  if (currentScreen === 'connect4Game') return <Connect4Game session={session} selectedBank={selectedBank} onBackToMenu={() => setCurrentScreen('menu')} />;
  if (currentScreen === 'dotsAndBoxesGame') return <DotsAndBoxesGame session={session} selectedBank={selectedBank} onBackToMenu={() => setCurrentScreen('menu')} />;
  if (currentScreen === 'hexGame') return <HexGame session={session} selectedBank={selectedBank} onBackToMenu={() => setCurrentScreen('menu')} />;
  if (currentScreen === 'reversiGame') return <ReversiGame session={session} selectedBank={selectedBank} onBackToMenu={() => setCurrentScreen('menu')} />;
  if (currentScreen === 'ultimateTicTacToeGame') return <UltimateTicTacToeGame session={session} selectedBank={selectedBank} onBackToMenu={() => setCurrentScreen('menu')} />;
  if (currentScreen === 'bingoGame') return <BingoGame session={session} selectedBank={selectedBank} onBackToMenu={() => setCurrentScreen('menu')} />;
  if (currentScreen === 'spotMatchGame') return <SpotMatchGame session={session} selectedBank={selectedBank} onBackToMenu={() => setCurrentScreen('menu')} />;

  // ==========================================
  // 5. תצוגת התפריט הראשי (העיצוב המקורי)
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

        {/* גריד המשחקים המעודכן */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 w-full mb-16 px-4">
          <GameCard title="כיבוש הקס" icon={Hexagon} glowColor="#e81cff" onClick={() => handleGameStart("hexGame")} />
          <GameCard title="קווים וריבועים" icon={LayoutGrid} glowColor="#40ff5a" onClick={() => handleGameStart("dotsAndBoxesGame")} />
          <GameCard title="רברסי" icon={Disc} glowColor="#7b2cbf" onClick={() => handleGameStart("reversiGame")} />
          <GameCard title="ארבע בשורה" icon={AlignJustify} glowColor="#ff9e00" onClick={() => handleGameStart("connect4Game")} />
          <GameCard title="מלחמה ימית" icon={Anchor} glowColor="#00f5d4" onClick={() => handleGameStart("battleshipGame")} />
          <GameCard title="איקס-עיגול אסטרטגי" icon={Gamepad2} glowColor="#f15bb5" onClick={() => handleGameStart("ultimateTicTacToeGame")} />      
          <GameCard title="בינגו טריוויה" icon={Hash} glowColor="#06b6d4" onClick={() => handleGameStart("bingoGame")} />
          <GameCard title="מצא את ההתאמה" icon={Eye} glowColor="#ffea00" onClick={() => handleGameStart("spotMatchGame")} />
        </div>

        {/* סרגל כלים תחתון מחובר למסד הנתונים */}
        <div className="w-full max-w-4xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <span className="text-slate-200 text-lg font-medium">מאגר שאלות:</span>
            <select 
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              className="w-full sm:w-[260px] h-[48px] bg-black/40 text-white border border-white/20 rounded-xl px-4 font-medium text-base cursor-pointer outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all appearance-none"
            >
              {isLoadingBanks ? (
                <option value="">טוען נתונים...</option>
              ) : questionBanks.length === 0 ? (
                <option value="">אין מאגרים במערכת</option>
              ) : (
                <>
                  <option value="" disabled>-- בחר מאגר מהרשימה --</option>
                  {questionBanks.map(bank => (
                    <option key={bank.id} value={bank.id} className="bg-slate-900 text-white">
                      {bank.topic_name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
              onClick={() => setCurrentScreen('teacher')} 
              className="flex-1 md:flex-none px-6 h-12 flex items-center justify-center gap-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500 hover:text-white hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all duration-300 font-medium"
            >
              <Settings size={18} />
              <span>פאנל ניהול</span>
            </button>
            <button 
              onClick={handleLogout} 
              className="flex-1 md:flex-none px-6 h-12 flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all duration-300 font-medium"
            >
              <LogOut size={18} />
              <span>יציאה</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}