import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Play, CheckCircle2, XCircle, RefreshCcw, Timer, Trophy, Hash, RotateCcw, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function BingoGame({ onBackToMenu, selectedBank, session }) {
  const [gridSize, setGridSize] = useState(3);
  const [maxNumber, setMaxNumber] = useState(30);
  const [timerDuration, setTimerDuration] = useState(30);
  
  // States
  const [gameState, setGameState] = useState('WAITING_START'); 
  const [isLoadingData, setIsLoadingData] = useState(true); 
  const [isRolling, setIsRolling] = useState(false); // האם הרולטה רצה עכשיו?
  const [hitMessage, setHitMessage] = useState(false); // הודעת המתח לפני השאלה
  
  const [questions, setQuestions] = useState([]); 
  const [students, setStudents] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamCards, setTeamCards] = useState({});
  const [drawnNumbers, setDrawnNumbers] = useState([]);
  const [currentNumber, setCurrentNumber] = useState(null);
  const [eligibleTeams, setEligibleTeams] = useState([]);

  const [timeLeft, setTimeLeft] = useState(30);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [showSolution, setShowSolution] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null });
  const [winner, setWinner] = useState(null);

  // משיכת נתונים מהענן
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true); 
      if (!session?.user?.id || !selectedBank) return;

      const { data: qData } = await supabase.from('questions').select('*').eq('topic_id', selectedBank).eq('teacher_id', session.user.id);
      setQuestions(qData || []);

      const { data: sData } = await supabase.from('students').select('*').eq('teacher_id', session.user.id).eq('is_playing', true);
      const activeStudents = sData || [];
      setStudents(activeStudents);

      const uniqueTeamNames = [...new Set(activeStudents.map(s => s.team || 'קבוצה כללית'))];
      const beautifulColors = ["#E94560", "#FFD700", "#00BCD4", "#40FF5A", "#7B2CBF", "#F15BB5", "#FF8C00", "#FF1493"];
      
      const dynamicTeams = uniqueTeamNames.map((name, index) => ({
        id: name, name: name, color: beautifulColors[index % beautifulColors.length]
      }));
      
      setTeams(dynamicTeams);
      setIsLoadingData(false); 
    };
    fetchData();
  }, [session, selectedBank]);

  // טיימר לשאלה
  useEffect(() => {
    let timer;
    if (gameState === 'QUESTION' && timeLeft > 0 && !showSolution && eligibleTeams.length > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && gameState === 'QUESTION') {
      setShowSolution(true); 
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft, showSolution, eligibleTeams]);

  // יצירת כרטיסיות בינגו
  const generateCards = useCallback(() => {
    const newCards = {};
    const squaresCount = gridSize * gridSize;
    
    teams.forEach(team => {
      const numbers = new Set();
      while (numbers.size < squaresCount) {
        numbers.add(Math.floor(Math.random() * maxNumber) + 1);
      }
      newCards[team.id] = Array.from(numbers).map(n => ({ value: n, marked: false }));
    });
    
    setTeamCards(newCards);
    setDrawnNumbers([]);
    setCurrentNumber(null);
  }, [teams, gridSize, maxNumber]);

  const startGame = () => {
    if (teams.length === 0) { alert("לא נמצאו תלמידים פעילים!"); return; }
    if (questions.length === 0) { alert("אין שאלות במאגר!"); return; }
    generateCards();
    setWinner(null);
    setGameState('DRAWING');
  };

  const checkBingo = (card) => {
    for (let i = 0; i < gridSize; i++) {
      let rowWin = true;
      for (let j = 0; j < gridSize; j++) { if (!card[i * gridSize + j].marked) rowWin = false; }
      if (rowWin) return true;
    }
    for (let i = 0; i < gridSize; i++) {
      let colWin = true;
      for (let j = 0; j < gridSize; j++) { if (!card[j * gridSize + i].marked) colWin = false; }
      if (colWin) return true;
    }
    let diag1Win = true;
    for (let i = 0; i < gridSize; i++) { if (!card[i * gridSize + i].marked) diag1Win = false; }
    if (diag1Win) return true;
    
    let diag2Win = true;
    for (let i = 0; i < gridSize; i++) { if (!card[i * gridSize + (gridSize - 1 - i)].marked) diag2Win = false; }
    if (diag2Win) return true;

    return false;
  };

  // מנגנון הגרלה מונפש חדש (רולטה)
  const drawNumber = () => {
    if (isRolling) return; // מונע לחיצות כפולות

    let availableNumbers = [];
    for (let i = 1; i <= maxNumber; i++) {
      if (!drawnNumbers.includes(i)) availableNumbers.push(i);
    }
    
    if (availableNumbers.length === 0) {
      alert("נגמרו המספרים להגרלה!");
      return;
    }

    // המספר האמיתי שייבחר בסוף
    const finalNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
    
    setIsRolling(true);
    setHitMessage(false);
    setEligibleTeams([]); // מנקה זוכות קודמות כדי שלא יאירו כרטיסיות בטעות

    // אפקט הרולטה - מספרים מתחלפים מהר
    const rollInterval = setInterval(() => {
      setCurrentNumber(Math.floor(Math.random() * maxNumber) + 1);
    }, 80); // מתחלף כל 80 מילישניות

    // אחרי 2.5 שניות הרולטה עוצרת
    setTimeout(() => {
      clearInterval(rollInterval);
      setCurrentNumber(finalNumber); // שם את המספר האמיתי
      setDrawnNumbers(prev => [...prev, finalNumber]);

      // בודק לאיזה קבוצות יש את המספר הזה
      const eligible = teams.filter(t => 
        teamCards[t.id].some(cell => cell.value === finalNumber && !cell.marked)
      );
      
      setEligibleTeams(eligible);

      // אם מישהו פגע, עושים הפסקה דרמטית לפני השאלה
      if (eligible.length > 0) {
        setHitMessage(true); // מציג "יש פגיעה"
        
        setTimeout(() => {
          // אחרי 2.5 שניות של בניית מתח, קופצים לשאלה
          const randomQ = questions[Math.floor(Math.random() * questions.length)];
          setCurrentQuestion({ q: randomQ.question_text, a: randomQ.answer });
          setTimeLeft(timerDuration);
          setShowSolution(false);
          setHitMessage(false); // מעלים את ההודעה
          setIsRolling(false);
          setGameState('QUESTION');
        }, 2500);

      } else {
        // לאף אחד אין את המספר - חוזרים למצב רגיל
        setIsRolling(false);
      }
    }, 2500);
  };

  const handleCorrectAnswer = (teamId) => {
    const updatedCards = { ...teamCards };
    updatedCards[teamId] = updatedCards[teamId].map(cell => 
      cell.value === currentNumber ? { ...cell, marked: true } : cell
    );
    
    setTeamCards(updatedCards);

    if (checkBingo(updatedCards[teamId])) {
      const winningTeam = teams.find(t => t.id === teamId);
      setWinner(winningTeam);
      setGameState('GAME_OVER');
    } else {
      setGameState('DRAWING');
    }
  };

  const handleWrongAnswer = () => {
    setGameState('DRAWING');
  };

  const handleResetGame = () => {
    setConfirmDialog({
      isOpen: true,
      message: "האם אתה בטוח שברצונך לאפס ולהתחיל משחק חדש?",
      onConfirm: () => {
        setGameState('WAITING_START');
        setShowSettings(false);
        setConfirmDialog({ isOpen: false, message: '', onConfirm: null });
      }
    });
  };

  const handleBackToMenu = () => {
    setConfirmDialog({
      isOpen: true,
      message: "האם אתה בטוח שברצונך לצאת ולחזור לתפריט הראשי? המשחק לא יישמר.",
      onConfirm: () => {
        if(onBackToMenu) onBackToMenu();
        setConfirmDialog({ isOpen: false, message: '', onConfirm: null });
      }
    });
  };

  return (
    <div dir="rtl" className="h-screen w-full bg-[#001F3F] text-white font-sans flex flex-col md:flex-row overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1A1A2E] via-[#16213E] to-[#0F3460] opacity-80 pointer-events-none" />

      {/* פאנל שליטה */}
      <div className="w-full md:w-[420px] lg:w-[480px] shrink-0 bg-slate-900/80 backdrop-blur-2xl border-l border-white/5 p-6 flex flex-col z-20 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-y-auto relative">
        
        {/* הודעת פגיעה דרמטית */}
        {hitMessage && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in zoom-in duration-300 rounded-l-3xl border-l border-white/10">
             <div className="text-center p-8">
                <Trophy size={64} className="text-yellow-400 mx-auto mb-6 animate-bounce shadow-[0_0_20px_rgba(250,204,21,0.5)] rounded-full" />
                <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 mb-4 drop-shadow-lg">יש פגיעה!</h2>
                <p className="text-2xl font-bold text-white animate-pulse">התכוננו לשאלה...</p>
             </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg shadow-lg">
              <Hash size={28} className="text-white" />
            </div>
            <h1 className="text-3xl font-black tracking-wide text-white">בינגו טריוויה</h1>
          </div>
          <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all">
            <Settings size={22} />
          </button>
        </div>

        <div className="flex-1 min-h-[300px] shrink-0 bg-black/20 rounded-3xl border border-white/5 p-5 relative overflow-y-auto flex flex-col">
          
          {gameState === 'WAITING_START' && (
            <div className="h-full flex flex-col items-center justify-center gap-6 animate-in fade-in duration-700">
              <div className="w-24 h-24 rounded-full bg-cyan-500/10 flex items-center justify-center mb-4">
                <Hash size={48} className="text-cyan-400" />
              </div>
              <p className="text-lg text-slate-300 text-center font-medium px-4">
                {isLoadingData ? 'מושך נתונים...' : `מוכן עם ${questions.length} שאלות ו-${teams.length} קבוצות. מוכנים לבינגו?`}
              </p>
              <button 
                onClick={startGame} disabled={isLoadingData}
                className="mt-4 w-full py-4 rounded-xl font-black text-xl flex items-center justify-center gap-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:scale-105 text-white transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)]"
              >
                {isLoadingData ? <RefreshCcw className="animate-spin" size={24} /> : <Play fill="currentColor" size={24} />} 
                התחל משחק
              </button>
            </div>
          )}

          {gameState === 'DRAWING' && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-6 animate-in zoom-in-95 duration-300">
              {currentNumber && eligibleTeams.length === 0 && !isRolling && (
                <div className="bg-rose-500/20 border border-rose-500/50 text-rose-300 px-4 py-2 rounded-lg mb-2 animate-in slide-in-from-top-4">
                  לאף קבוצה אין את המספר {currentNumber}!
                </div>
              )}
              
              <div className="relative">
                <div className={`w-40 h-40 rounded-full border-8 flex items-center justify-center shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] transition-all duration-300 
                  ${isRolling ? 'border-cyan-500 bg-cyan-900/30' : 'border-slate-700 bg-slate-800'}`}>
                  {currentNumber ? (
                    <span className={`text-6xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] ${isRolling ? 'blur-[1px]' : 'animate-in zoom-in-75 duration-300'}`}>
                      {currentNumber}
                    </span>
                  ) : (
                    <Hash size={60} className="text-slate-600" />
                  )}
                </div>
              </div>
              <button 
                onClick={drawNumber}
                disabled={isRolling}
                className="w-full mt-4 py-5 rounded-2xl font-black text-2xl flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 text-white transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)]"
              >
                {isRolling ? 'מגריל...' : 'הגרל מספר חדש'}
              </button>
            </div>
          )}

          {gameState === 'QUESTION' && currentQuestion && (
            <div className="h-full flex flex-col animate-in fade-in zoom-in-95 duration-500">
              <div className="shrink-0 flex items-center justify-between bg-slate-900/80 rounded-2xl p-4 mb-3 border border-white/10 shadow-inner">
                <div className="flex items-center gap-2 text-slate-400"><Timer size={20} /><span className="font-medium text-lg">זמן נותר:</span></div>
                <span className={`text-4xl font-black tabular-nums transition-colors duration-300 ${timeLeft <= 5 ? 'text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.8)]' : 'text-white'}`}>
                  {timeLeft > 0 ? `00:${timeLeft.toString().padStart(2, '0')}` : 'זמנך תם!'}
                </span>
              </div>

              <div className="w-full flex-1 bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-400/30 rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg mb-3 relative overflow-hidden">
                 <div className="absolute top-2 right-2 w-12 h-12 rounded-full bg-yellow-400 text-slate-900 flex items-center justify-center text-xl font-black shadow-[0_0_15px_rgba(250,204,21,0.5)] rotate-12">
                   {currentNumber}
                 </div>
                <p className="text-lg md:text-xl font-bold text-white text-center leading-snug break-words mt-4">{currentQuestion.q}</p>
              </div>

              <div className={`shrink-0 min-h-[60px] rounded-2xl flex items-center justify-center p-3 mb-3 transition-all duration-500 border-2 ${showSolution ? 'bg-amber-500/20 border-amber-500/50' : 'bg-transparent border-transparent'}`}>
                {showSolution && <p className="text-xl font-black text-amber-400 text-center animate-in slide-in-from-bottom-2">פתרון: {currentQuestion.a}</p>}
              </div>

              <div className="mt-auto">
                <p className="text-center text-slate-400 text-sm mb-2">איזו קבוצה ענתה נכון?</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {eligibleTeams.map(t => (
                    <button 
                      key={t.id}
                      onClick={() => handleCorrectAnswer(t.id)}
                      className="py-3 rounded-xl font-bold text-white transition-transform hover:scale-105 active:scale-95 text-sm truncate px-2"
                      style={{ backgroundColor: t.color, boxShadow: `0 4px 0 ${t.color}88` }}
                    >
                      {t.name} צדקה
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleWrongAnswer} className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold transition-colors text-sm">
                    אף אחת
                  </button>
                  <button onClick={() => setShowSolution(true)} disabled={showSolution} className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white font-bold transition-colors text-sm">
                    הצג פתרון
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* אזור הלוחות */}
      <div className="flex-1 h-full p-4 md:p-8 relative z-10 overflow-y-auto bg-black/20">
        {(gameState !== 'WAITING_START' && gameState !== 'GAME_OVER') && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-max pb-10">
            {teams.map(team => {
              const card = teamCards[team.id];
              if (!card) return null;
              
              // הלוח יואר אם זה המספר הזוכה עכשיו (וגם בזמן השאלה וגם בזמן המתח)
              const hasCurrentNumber = (gameState === 'QUESTION' || hitMessage) && eligibleTeams.some(t => t.id === team.id);

              return (
                <div key={team.id} className={`bg-slate-900 rounded-3xl p-4 border-4 transition-all duration-300 ${hasCurrentNumber ? 'scale-105 shadow-[0_0_30px_rgba(255,255,255,0.2)]' : 'scale-100'}`} style={{ borderColor: hasCurrentNumber ? team.color : 'rgba(255,255,255,0.1)' }}>
                  <div className="text-center mb-4">
                    <span className="text-xl font-black px-4 py-1 rounded-full text-white" style={{ backgroundColor: team.color }}>{team.name}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2" style={{ aspectRatio: '1/1' }}>
                    {card.map((cell, idx) => {
                      const isHighlighted = hasCurrentNumber && cell.value === currentNumber && !cell.marked;
                      
                      return (
                        <div 
                          key={idx} 
                          className={`relative flex items-center justify-center rounded-xl text-3xl md:text-4xl font-black transition-all duration-500 overflow-hidden
                            ${cell.marked ? 'bg-slate-800 text-slate-600' : 'bg-slate-700 text-white'}
                            ${isHighlighted ? 'animate-pulse ring-4 ring-inset' : ''}
                          `}
                          style={{ 
                            backgroundColor: cell.marked ? `${team.color}22` : undefined,
                            ringColor: isHighlighted ? team.color : undefined
                          }}
                        >
                          <span className={cell.marked ? 'opacity-30' : 'opacity-100'}>{cell.value}</span>
                          
                          {/* איקס ענק אם סומן */}
                          {cell.marked && (
                            <div className="absolute inset-0 flex items-center justify-center animate-in zoom-in spin-in-12 duration-300">
                               <X size={64} style={{ color: team.color }} strokeWidth={4} className="drop-shadow-lg" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* מסך ניצחון */}
        {gameState === 'GAME_OVER' && winner && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md overflow-hidden rounded-3xl m-4">
            <div className="absolute inset-0" style={{ backgroundColor: `${winner.color}20` }} />
            
            {[...Array(50)].map((_, i) => (
              <div key={i} className="absolute animate-bounce" style={{
                left: `${Math.random() * 100}%`, top: `-10%`, animationDuration: `${2 + Math.random() * 2}s`, animationDelay: `${Math.random() * 2}s`,
                backgroundColor: winner.color, width: '16px', height: '16px', borderRadius: '50%'
              }} />
            ))}

            <div className="relative p-1.5 rounded-[42px]" style={{ background: `linear-gradient(45deg, ${winner.color}, transparent, ${winner.color})` }}>
              <div className="bg-slate-900/90 border border-white/10 rounded-[40px] p-16 flex flex-col items-center shadow-2xl animate-in zoom-in-75 duration-700" style={{ boxShadow: `0 0 100px ${winner.color}88` }}>
                <Trophy size={120} color="#FFD700" className="relative drop-shadow-[0_0_20px_rgba(255,215,0,1)] animate-bounce mb-8" />
                <h2 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-amber-500 mb-6 drop-shadow-lg">בינגו!</h2>
                <p className="text-5xl font-black mb-12 tracking-wide text-center" style={{ color: winner.color }}>{winner.name}<br/><span className="text-2xl text-slate-300 font-medium">השלימו שורה וניצחו!</span></p>
                
                <button onClick={() => { startGame(); }} className="px-12 py-5 rounded-full font-black text-2xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:scale-110 transition-transform shadow-[0_0_30px_rgba(6,182,212,0.5)] text-white">
                  משחק חדש
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* הגדרות */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-[400px] shadow-2xl">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/10">
              <h2 className="text-2xl font-bold flex items-center gap-2"><Settings className="text-cyan-400"/> הגדרות בינגו</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10"><X size={20}/></button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="flex justify-between text-lg mb-2"><span>מספר מקסימלי להגרלה</span><span className="font-bold text-cyan-400">{maxNumber}</span></label>
                <input type="range" min="15" max="60" step="5" value={maxNumber} onChange={(e) => setMaxNumber(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg cursor-pointer" />
                <p className="text-xs text-slate-400 mt-1">מספר נמוך = יותר התנגשויות בין קבוצות</p>
              </div>
              <div>
                <label className="flex justify-between text-lg mb-2"><span>זמן לשאלה (שניות)</span><span className="font-bold text-cyan-400">{timerDuration}</span></label>
                <input type="range" min="10" max="60" step="5" value={timerDuration} onChange={(e) => setTimerDuration(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg cursor-pointer" />
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-white/10 flex flex-col gap-3">
              <button onClick={handleResetGame} className="w-full py-4 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-600/30 hover:bg-rose-600 hover:text-white font-bold flex items-center justify-center gap-2 transition-all">
                <RotateCcw size={20} /> שמור וצור לוחות מחדש
              </button>
              <button onClick={handleBackToMenu} className="w-full py-4 rounded-xl bg-slate-800 text-slate-300 border border-slate-600 hover:bg-slate-700 hover:text-white font-bold flex items-center justify-center gap-2 transition-all">
                <span>חזור לתפריט הראשי</span> <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* אישור יציאה */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-8 w-[400px] shadow-2xl text-center">
            <AlertTriangle size={64} className="text-rose-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold mb-8 leading-relaxed text-white">{confirmDialog.message}</h2>
            <div className="flex gap-4">
              <button onClick={() => confirmDialog.onConfirm()} className="flex-1 py-4 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-lg transition-all shadow-[0_0_15px_rgba(225,29,72,0.4)] text-white">כן, אני בטוח</button>
              <button onClick={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: null })} className="flex-1 py-4 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-lg transition-all text-white">ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}