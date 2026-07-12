import React, { useState, useEffect } from 'react';
import { Settings, Play, CheckCircle2, XCircle, RefreshCcw, HelpCircle, ArrowRight, Trophy, Gamepad2, Timer, Sparkles, X, RotateCcw, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const generateInitialBoard = () => {
  return Array(3).fill(null).map((_, macroR) => 
    Array(3).fill(null).map((_, macroC) => ({
      macroR, macroC,
      state: 0, 
      microCells: Array(3).fill(null).map((_, microR) => 
        Array(3).fill(null).map((_, microC) => ({
          microR, microC, state: 0 
        }))
      )
    }))
  );
};

export default function UltimateTicTacToeGame({ onBackToMenu, selectedBank, session }) {
  const [board, setBoard] = useState(generateInitialBoard());
  const [activeMacro, setActiveMacro] = useState({ r: -1, c: -1 }); 
  const [freePlay, setFreePlay] = useState(false);
  
  const [timerDuration, setTimerDuration] = useState(30);
  const [gameState, setGameState] = useState('WAITING_START'); 
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [previewCell, setPreviewCell] = useState(null); 
  const [newlyWonMacros, setNewlyWonMacros] = useState([]); 

  const [timeLeft, setTimeLeft] = useState(30);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [showSolution, setShowSolution] = useState(false);
  
  const [showSettings, setShowSettings] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null });

  const [questions, setQuestions] = useState([]); 
  const [students, setStudents] = useState([]);
  const [teams, setTeams] = useState([]); 
  const [studentPools, setStudentPools] = useState({}); 
  const [selectedStudents, setSelectedStudents] = useState([]); 

  const currentTeam = teams[currentTeamIndex];

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      if (!session?.user?.id || !selectedBank) return;

      const { data: qData } = await supabase
        .from('questions')
        .select('*')
        .eq('topic_id', selectedBank)
        .eq('teacher_id', session.user.id);
      setQuestions(qData || []);

      const { data: sData } = await supabase
        .from('students')
        .select('*')
        .eq('teacher_id', session.user.id)
        .eq('is_playing', true);
      
      const activeStudents = sData || [];
      setStudents(activeStudents);

      const uniqueTeamNames = [...new Set(activeStudents.map(s => s.team || 'קבוצה כללית'))];
      const teamNamesToUse = uniqueTeamNames.slice(0, 2);
      const ttColors = ["#E94560", "#00BCD4"];
      const ttSymbols = ["X", "O"];
      const ttGlows = ["rgba(233, 69, 96, 0.6)", "rgba(0, 188, 212, 0.6)"];
      
      const dynamicTeams = teamNamesToUse.map((name, index) => ({
        internalId: index + 1,
        id: name,
        name: name,
        color: ttColors[index],
        symbol: ttSymbols[index],
        glow: ttGlows[index]
      }));
      
      setTeams(dynamicTeams);

      const initialPools = {};
      dynamicTeams.forEach(t => {
        initialPools[t.id] = activeStudents.filter(s => (s.team || 'קבוצה כללית') === t.id).map(s => s.id);
      });
      setStudentPools(initialPools);

      if (dynamicTeams.length > 0) {
        setCurrentTeamIndex(Math.floor(Math.random() * dynamicTeams.length));
      }
      setIsLoadingData(false);
    };

    fetchData();
  }, [session, selectedBank]);

  useEffect(() => {
    let timer;
    if (gameState === 'QUESTION' && timeLeft > 0 && !showSolution) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && gameState === 'QUESTION') {
      setShowSolution(true); 
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft, showSolution]);

  const startGame = () => {
    if (teams.length < 2) {
      alert("המשחק דורש לפחות 2 קבוצות שונות בכיתה! אנא שייך את התלמידים ל-2 קבוצות לפחות בפאנל הניהול.");
      return;
    }

    setBoard(generateInitialBoard());
    setActiveMacro({ r: -1, c: -1 });
    setNewlyWonMacros([]);
    
    const freshPools = {};
    teams.forEach(t => {
      freshPools[t.id] = students.filter(s => (s.team || 'קבוצה כללית') === t.id).map(s => s.id);
    });
    setStudentPools(freshPools);

    setGameState('WAITING_CELL');
    setPreviewCell(null);
    setCurrentTeamIndex(Math.floor(Math.random() * teams.length));
  };

  const nextTurn = () => {
    if (teams.length === 0) return;
    setCurrentTeamIndex(prev => (prev + 1) % teams.length);
    setGameState('WAITING_CELL');
    setPreviewCell(null);
    setShowSolution(false);
    setSelectedStudents([]);
  };

  const loadQuestion = () => {
    if (questions.length === 0) {
      alert("אין שאלות במאגר זה! אנא הוסף שאלות בפאנל הניהול.");
      return;
    }
    if (!currentTeam) return;

    const teamStudents = students.filter(s => (s.team || 'קבוצה כללית') === currentTeam.id);
    if (teamStudents.length === 0) return;

    let currentPool = studentPools[currentTeam.id] || [];
    if (currentPool.length < 2) {
      currentPool = teamStudents.map(s => s.id);
    }

    let chosenIds = [];
    const poolCopy = [...currentPool];
    
    for (let i = 0; i < 2; i++) {
      if (poolCopy.length === 0) break;
      const randomIndex = Math.floor(Math.random() * poolCopy.length);
      chosenIds.push(poolCopy.splice(randomIndex, 1)[0]);
    }

    const chosenObjects = teamStudents.filter(s => chosenIds.includes(s.id));
    setSelectedStudents(chosenObjects);

    setStudentPools(prev => ({
      ...prev,
      [currentTeam.id]: poolCopy
    }));

    const randomQ = questions[Math.floor(Math.random() * questions.length)];
    setCurrentQuestion({ q: randomQ.question_text, a: randomQ.answer });
    
    setTimeLeft(timerDuration);
    setShowSolution(false);
    setGameState('QUESTION');
  };

  const handleCellClick = (macroR, macroC, microR, microC) => {
    if (gameState !== 'WAITING_CELL' || !currentTeam) return;
    const targetMacro = board[macroR][macroC];
    
    if (targetMacro.state !== 0) return;
    if (targetMacro.microCells[microR][microC].state !== 0) return;

    if (!freePlay && activeMacro.r !== -1 && activeMacro.c !== -1) {
      if (macroR !== activeMacro.r || macroC !== activeMacro.c) return;
    }

    setPreviewCell({ macroR, macroC, microR, microC });
  };

  const checkWin = (grid, p) => {
    for (let i = 0; i < 3; i++) {
      if (grid[i][0].state === p && grid[i][1].state === p && grid[i][2].state === p) return true;
      if (grid[0][i].state === p && grid[1][i].state === p && grid[2][i].state === p) return true;
    }
    if (grid[0][0].state === p && grid[1][1].state === p && grid[2][2].state === p) return true;
    if (grid[0][2].state === p && grid[1][1].state === p && grid[2][0].state === p) return true;
    return false;
  };

  const checkDraw = (grid) => {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (grid[r][c].state === 0) return false;
      }
    }
    return true;
  };

  const handleAnswer = (isCorrect) => {
    if (isCorrect && previewCell && currentTeam) {
      const { macroR, macroC, microR, microC } = previewCell;
      const newBoard = [...board];
      const playerVal = currentTeam.internalId;
      
      newBoard[macroR][macroC].microCells[microR][microC].state = playerVal;

      if (checkWin(newBoard[macroR][macroC].microCells, playerVal)) {
        newBoard[macroR][macroC].state = playerVal;
        setNewlyWonMacros(prev => [...prev, `${macroR}-${macroC}`]); 
      } else if (checkDraw(newBoard[macroR][macroC].microCells)) {
        newBoard[macroR][macroC].state = 3; 
        setNewlyWonMacros(prev => [...prev, `${macroR}-${macroC}`]);
      }

      setBoard(newBoard);

      const nextMacroTarget = newBoard[microR][microC];
      if (nextMacroTarget.state !== 0) {
        setActiveMacro({ r: -1, c: -1 }); 
      } else {
        setActiveMacro({ r: microR, c: microC });
      }

      if (checkWin(newBoard, playerVal)) {
        setGameState('GAME_OVER');
        return;
      }
    } else {
      setPreviewCell(null);
    }
    nextTurn();
  };

  const handleResetGame = () => {
    setConfirmDialog({
      isOpen: true,
      message: "האם אתה בטוח שברצונך לאפס את הלוח ולהתחיל משחק חדש?",
      onConfirm: () => {
        setBoard(generateInitialBoard());
        setActiveMacro({ r: -1, c: -1 });
        setNewlyWonMacros([]);
        setGameState('WAITING_START');
        setPreviewCell(null);
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
    <div dir="rtl" className="h-screen w-full bg-[#1A0033] text-white font-sans flex flex-col md:flex-row overflow-hidden relative">
      
      <style>{`
        @keyframes stampPop {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div className="absolute inset-0 bg-gradient-to-br from-[#1A0033] via-[#330066] to-[#4B0082] opacity-80 pointer-events-none" />

      <div className="w-full md:w-[420px] lg:w-[480px] shrink-0 bg-slate-900/80 backdrop-blur-2xl border-l border-white/5 p-6 flex flex-col z-20 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-y-auto">
        
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg shadow-lg">
              <X size={28} className="text-white" />
            </div>
            <h1 className="text-3xl font-black tracking-wide text-white">איקס-עיגול אסטרטגי</h1>
          </div>
          <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all">
            <Settings size={22} />
          </button>
        </div>

        <div className="flex gap-4 mb-4 shrink-0 overflow-x-auto pb-2">
          {teams.length < 2 && <p className="text-center w-full text-rose-400 text-sm font-bold">המשחק דורש 2 קבוצות פעילות!</p>}
          {teams.map((grp, index) => {
            const isActive = currentTeamIndex === index && gameState !== 'WAITING_START' && gameState !== 'GAME_OVER';
            return (
              <div 
                key={grp.id} 
                className={`relative flex-1 min-w-[100px] rounded-2xl p-4 flex flex-col items-center justify-center border-2 transition-all duration-500 overflow-hidden
                  ${isActive ? 'border-white/50 scale-105' : 'border-white/5 bg-black/40 scale-100'}`}
                style={{ backgroundColor: isActive ? grp.color : '' }}
              >
                {isActive && <div className="absolute inset-0 bg-white/20 animate-pulse pointer-events-none" />}
                <span className="text-sm font-bold text-center mb-1 z-10 text-white drop-shadow-md break-all">{grp.name}</span>
                <span className="text-4xl font-black z-10 drop-shadow-md text-white">{grp.symbol}</span>
              </div>
            );
          })}
        </div>

        <div className="flex-1 min-h-[350px] shrink-0 bg-black/20 rounded-3xl border border-white/5 p-5 relative overflow-hidden flex flex-col mt-4">
          
          {gameState === 'WAITING_START' && (
            <div className="h-full flex flex-col items-center justify-center gap-6 animate-in fade-in duration-700">
              <div className="w-24 h-24 rounded-full bg-pink-500/10 flex items-center justify-center">
                <Gamepad2 size={48} className="text-pink-400" />
              </div>
              <p className="text-lg text-slate-300 text-center font-medium px-4">
                {isLoadingData ? 'מתחבר למסד הנתונים ומושך נתונים...' : `הלוח מוכן עם ${questions.length} שאלות ו-${students.length} תלמידים פעילים.`}
              </p>
              <button 
                onClick={startGame}
                disabled={isLoadingData || teams.length < 2}
                className={`mt-4 w-full py-4 rounded-xl font-black text-xl flex items-center justify-center gap-3 transition-all shadow-[0_0_20px_rgba(236,72,153,0.4)]
                  ${(isLoadingData || teams.length < 2) ? 'bg-slate-700 text-slate-400 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:scale-105 text-white'}`}
              >
                {isLoadingData ? <RefreshCcw className="animate-spin" size={24} /> : <Play fill="currentColor" size={24} />} 
                {isLoadingData ? 'טוען...' : 'התחל משחק'}
              </button>
            </div>
          )}

          {gameState === 'WAITING_CELL' && currentTeam && (
            <div className="h-full flex flex-col items-center justify-center gap-8 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center">
                <h3 className="text-2xl font-black mb-2" style={{ color: currentTeam.color }}>תור {currentTeam.name}</h3>
                <p className="text-slate-300 text-lg mb-2">בחרו משבצת פנויה.</p>
                {!freePlay && activeMacro.r !== -1 && (
                  <p className="text-yellow-400 font-bold bg-yellow-400/10 px-4 py-2 rounded-full border border-yellow-400/30">
                    יש לשחק בלוח המסומן
                  </p>
                )}
              </div>
              
              <div className={`w-24 h-24 rounded-2xl border-4 border-dashed transition-all duration-500 flex items-center justify-center
                ${previewCell ? 'border-transparent' : 'border-slate-600 animate-pulse'}`}
                   style={previewCell ? { backgroundColor: currentTeam.color } : {}}>
                <span className={`text-6xl font-black ${previewCell ? 'text-white drop-shadow-md' : 'text-slate-600'}`}>
                  {previewCell ? currentTeam.symbol : '?'}
                </span>
              </div>

              <button 
                onClick={loadQuestion}
                disabled={!previewCell}
                className={`w-full py-4 rounded-xl font-bold text-xl flex items-center justify-center gap-3 transition-all duration-300
                  ${previewCell 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:scale-105 hover:shadow-[0_0_20px_rgba(245,158,11,0.5)] text-white cursor-pointer' 
                    : 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5'}`}
              >
                <HelpCircle size={24} /> אשר מיקום והגרל תלמידים
              </button>
            </div>
          )}

          {gameState === 'QUESTION' && currentQuestion && (
            <div className="h-full flex flex-col animate-in fade-in zoom-in-95 duration-500">
              <div className="bg-purple-900/40 border border-purple-500/30 rounded-2xl p-4 mb-3 text-center shadow-inner">
                <p className="text-xs text-purple-300 font-bold mb-1">🎯 התלמידים שנבחרו לענות:</p>
                <p className="text-xl font-black text-yellow-300 tracking-wide drop-shadow-sm">
                  {selectedStudents.length > 0 ? selectedStudents.map(s => s.name).join(' ⚔️ ') : 'טוען תלמיד...'}
                </p>
              </div>

              <div className="shrink-0 flex items-center justify-between bg-slate-900/80 rounded-2xl p-4 mb-3 border border-white/10 shadow-inner">
                <div className="flex items-center gap-2 text-slate-400">
                  <Timer size={20} />
                  <span className="font-medium text-lg">זמן נותר:</span>
                </div>
                <span className={`text-4xl font-black tabular-nums transition-colors duration-300 ${timeLeft <= 5 ? 'text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.8)]' : 'text-white'}`}>
                  {timeLeft > 0 ? `00:${timeLeft.toString().padStart(2, '0')}` : 'זמנך תם!'}
                </span>
              </div>

               <div className="w-full min-h-[120px] bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-400/30 rounded-2xl p-4 flex items-center justify-center shadow-lg mb-3">
                <p className="text-lg md:text-xl font-bold text-white text-center leading-snug break-words">
                  {currentQuestion.q}
                </p>
              </div>

              <div className={`shrink-0 h-[70px] rounded-2xl flex items-center justify-center p-3 mb-3 transition-all duration-500 border-2 
                  ${showSolution ? 'bg-amber-500/20 border-amber-500/50' : 'bg-transparent border-transparent'}`}>
                {showSolution && <p className="text-xl font-black text-amber-400 text-center animate-in slide-in-from-bottom-2">פתרון: {currentQuestion.a}</p>}
              </div>

              <div className="shrink-0 grid grid-cols-2 gap-3 mt-auto">
                <button onClick={() => handleAnswer(true)} className="py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-lg flex items-center justify-center gap-2 transition-all hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                  <CheckCircle2 /> תשובה נכונה
                </button>
                <button onClick={() => handleAnswer(false)} className="py-4 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-lg flex items-center justify-center gap-2 transition-all hover:shadow-[0_0_15px_rgba(225,29,72,0.4)]">
                  <XCircle /> תשובה שגויה
                </button>
                <button onClick={() => setShowSolution(true)} disabled={showSolution} className="py-3 rounded-xl bg-purple-600/80 hover:bg-purple-500 disabled:opacity-30 disabled:hover:bg-purple-600/80 font-bold transition-colors">
                  הצג פתרון
                </button>
                <button onClick={loadQuestion} className="py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold transition-colors flex items-center justify-center gap-2">
                  <RefreshCcw size={18} /> החלף שאלה
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto pt-6 border-t border-white/10 shrink-0">
          <button onClick={handleBackToMenu} className="w-full py-4 rounded-xl bg-red-950/40 text-red-400 hover:bg-red-600 hover:text-white border border-red-500/20 font-bold transition-all flex items-center justify-center gap-2">
            <span>חזור לתפריט הראשי</span> <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-w-0 h-full flex items-center justify-center p-4 md:p-12 relative z-10">
        
        <div className="w-full h-full max-h-[85vh] max-w-[85vh] bg-[#E91E63]/20 rounded-3xl p-3 md:p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] border-4 border-pink-500/50"
             style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gridTemplateRows: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
          
          {board.map((macroRow, mR) => 
            macroRow.map((macroCell, mC) => {
              
              const isMacroActive = !freePlay && gameState !== 'GAME_OVER' && 
                                    (activeMacro.r === -1 || (activeMacro.r === mR && activeMacro.c === mC)) &&
                                    macroCell.state === 0;

              const justWon = newlyWonMacros.includes(`${mR}-${mC}`);
              const winnerTeam = teams.find(t => t.internalId === macroCell.state);
              
              return (
                <div key={`macro-${mR}-${mC}`} className={`relative bg-[#1A0B2E] rounded-xl overflow-hidden transition-all duration-300 border-2 flex items-center justify-center w-full h-full
                  ${isMacroActive ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'border-slate-600/50'}`}>
                  
                  {macroCell.state !== 0 ? (
                    <span className={`text-[80px] md:text-[120px] font-black drop-shadow-2xl select-none`}
                          style={{ 
                            color: winnerTeam ? winnerTeam.color : '#64748b',
                            animation: justWon ? 'stampPop 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' : 'none'
                          }}>
                      {winnerTeam ? winnerTeam.symbol : '-'}
                    </span>
                  ) : (
                    <div className="w-full h-full p-2 bg-[#130627]" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gridTemplateRows: 'repeat(3, minmax(0, 1fr))', gap: '6px' }}>
                      {macroCell.microCells.map((microRow, miR) => 
                        microRow.map((micro, miC) => {
                          const isPreview = previewCell?.macroR === mR && previewCell?.macroC === mC && previewCell?.microR === miR && previewCell?.microC === miC;
                          let content = "";
                          let textColor = "";
                          
                          let bg = "bg-[#2D1B54]"; 
                          let borderClass = "border-2 border-[#4A3076]"; 
                          
                          if (micro.state > 0) {
                            const microOwner = teams.find(t => t.internalId === micro.state);
                            if (microOwner) {
                                content = microOwner.symbol;
                                textColor = microOwner.color;
                                borderClass = `border-2 border-[${textColor}]/30`;
                            }
                          } else if (isPreview && currentTeam) {
                            content = currentTeam.symbol;
                            textColor = currentTeam.color;
                            bg = "bg-[#4B0082]/80 animate-pulse";
                            borderClass = `border-2 border-[${textColor}]`;
                          }

                          return (
                            <button
                              key={`micro-${miR}-${miC}`}
                              onClick={() => handleCellClick(mR, mC, miR, miC)}
                              className={`w-full h-full flex items-center justify-center rounded-lg transition-all text-3xl md:text-4xl font-black ${bg} ${borderClass} hover:bg-[#3D256A] hover:border-white/40 cursor-pointer shadow-inner`}
                              style={{ color: textColor }}
                            >
                              {content}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {gameState === 'GAME_OVER' && currentTeam && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md overflow-hidden">
            <div className="absolute inset-0" style={{ backgroundColor: `${currentTeam.color}20` }} />
            
            {[...Array(40)].map((_, i) => (
              <div key={i} className="absolute animate-bounce" style={{
                left: `${Math.random() * 100}%`, top: `-10%`,
                animationDuration: `${2 + Math.random() * 2}s`,
                animationDelay: `${Math.random() * 2}s`,
                backgroundColor: currentTeam.color, width: '16px', height: '16px', borderRadius: '50%'
              }} />
            ))}

            <div className="relative animate-[spin_10s_linear_infinite] p-1.5 rounded-[42px]" style={{ background: `linear-gradient(45deg, ${currentTeam.color}, transparent, ${currentTeam.color})` }}>
              <div className="bg-slate-900/90 border border-white/10 rounded-[40px] p-16 flex flex-col items-center shadow-2xl animate-in zoom-in-75 duration-700"
                   style={{ boxShadow: `0 0 100px ${currentTeam.glow}` }}>
                
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-yellow-400 blur-3xl opacity-30 animate-pulse" />
                  <Trophy size={120} color="#FFD700" className="relative drop-shadow-[0_0_20px_rgba(255,215,0,1)] animate-bounce" />
                  <Sparkles size={40} color="#FFF" className="absolute -top-4 -right-4 animate-ping" />
                </div>
                
                <h2 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-amber-500 mb-6 drop-shadow-lg">
                  ניצחון!
                </h2>
                <p className="text-5xl font-black mb-4 tracking-wide" style={{ color: currentTeam.color }}>{currentTeam.name}</p>
                <p className="text-2xl text-slate-300 mb-12 font-medium">כבשה את הלוח הגדול!</p>
                
                <button 
                  onClick={startGame}
                  className="px-12 py-5 rounded-full font-black text-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:scale-110 transition-transform shadow-[0_0_30px_rgba(245,158,11,0.5)] text-white"
                >
                  התחל משחק חדש
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-[400px] shadow-2xl">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/10">
              <h2 className="text-2xl font-bold flex items-center gap-2"><Settings className="text-pink-400"/> הגדרות משחק</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><X size={20}/></button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="flex justify-between text-lg mb-2">
                  <span>זמן לשאלה (שניות)</span>
                  <span className="font-bold text-pink-400">{timerDuration}</span>
                </label>
                <input type="range" min="10" max="60" step="5" value={timerDuration} onChange={(e) => setTimerDuration(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <input 
                  type="checkbox" 
                  id="chkFreePlay" 
                  checked={freePlay} 
                  onChange={(e) => setFreePlay(e.target.checked)} 
                  className="w-5 h-5 cursor-pointer accent-pink-500"
                />
                <label htmlFor="chkFreePlay" className="text-lg cursor-pointer select-none">מצב חופשי (ללא הגבלת לוח פעיל)</label>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-white/10 flex flex-col gap-3">
              <button onClick={handleResetGame} className="w-full py-4 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-600/30 hover:bg-rose-600 hover:text-white font-bold flex items-center justify-center gap-2 transition-all">
                <RotateCcw size={20} /> שמור ואפס לוח
              </button>
              
              <button onClick={handleBackToMenu} className="w-full py-4 rounded-xl bg-slate-800 text-slate-300 border border-slate-600 hover:bg-slate-700 hover:text-white font-bold flex items-center justify-center gap-2 transition-all">
                <span>חזור לתפריט הראשי</span> <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-8 w-[400px] shadow-2xl text-center">
            <AlertTriangle size={64} className="text-rose-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold mb-8 leading-relaxed text-white">{confirmDialog.message}</h2>
            <div className="flex gap-4">
              <button onClick={() => confirmDialog.onConfirm()} className="flex-1 py-4 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-lg transition-all shadow-[0_0_15px_rgba(225,29,72,0.4)] text-white">
                כן, אני בטוח
              </button>
              <button onClick={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: null })} className="flex-1 py-4 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-lg transition-all text-white">
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}