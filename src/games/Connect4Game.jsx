import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Play, CheckCircle2, XCircle, RefreshCcw, HelpCircle, ArrowRight, Trophy, Gamepad2, Timer, Sparkles, X, RotateCcw, AlertTriangle, AlignJustify } from 'lucide-react';

const mockGroups = [
  { id: 1, name: "קבוצה 1 (אדום)", color: "#E94560", glow: "rgba(233, 69, 96, 0.6)" },
  { id: 2, name: "קבוצה 2 (צהוב)", color: "#FFD700", glow: "rgba(255, 215, 0, 0.6)" }
];

const mockQuestions = [
  { id: 1, q: "מהי בירת צרפת?", a: "פריז" },
  { id: 2, q: "כמה שניות יש בשעה?", a: "3600" },
  { id: 3, q: "מי גילה את כוח המשיכה?", a: "אייזק ניוטון" },
  { id: 4, q: "מהו השורש הריבועי של 144?", a: "12" },
  { id: 5, q: "איזה יסוד מסומן באות O?", a: "חמצן" }
];

export default function Connect4Game({ onBackToMenu }) {
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(7);
  const [timerDuration, setTimerDuration] = useState(30);
  
  const [gameState, setGameState] = useState('WAITING_START'); 
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  
  const [board, setBoard] = useState(Array(6).fill(null).map(() => Array(7).fill(0)));
  
  const [previewMove, setPreviewMove] = useState(null); 
  const [winningCells, setWinningCells] = useState([]); 
  const [lastDrop, setLastDrop] = useState(null); // שמירת הדיסקית האחרונה שנפלה בשביל האנימציה

  const [timeLeft, setTimeLeft] = useState(30);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [showSolution, setShowSolution] = useState(false);
  const [scores, setScores] = useState({ 1: 0, 2: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null });

  const currentGroup = mockGroups[currentGroupIndex];

  useEffect(() => {
    let timer;
    if (gameState === 'QUESTION' && timeLeft > 0 && !showSolution) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && gameState === 'QUESTION') {
      setShowSolution(true); 
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft, showSolution]);

  useEffect(() => {
    setBoard(Array(rows).fill(null).map(() => Array(cols).fill(0)));
    setPreviewMove(null);
    setWinningCells([]);
    setLastDrop(null);
  }, [rows, cols]);

  const startGame = () => {
    setBoard(Array(rows).fill(null).map(() => Array(cols).fill(0)));
    setScores({ 1: 0, 2: 0 });
    setGameState('WAITING_MOVE');
    setPreviewMove(null);
    setWinningCells([]);
    setLastDrop(null);
    setCurrentGroupIndex(Math.floor(Math.random() * mockGroups.length));
  };

  const nextTurn = () => {
    let isTie = true;
    for (let c = 0; c < cols; c++) {
      if (board[0][c] === 0) isTie = false;
    }

    if (isTie) {
      alert("הלוח התמלא לחלוטין! המשחק הסתיים בתיקו.");
      setBoard(Array(rows).fill(null).map(() => Array(cols).fill(0)));
      setGameState('WAITING_START');
      return;
    }

    setCurrentGroupIndex(prev => (prev + 1) % mockGroups.length);
    setGameState('WAITING_MOVE');
    setPreviewMove(null);
    setShowSolution(false);
  };

  const loadQuestion = () => {
    const q = mockQuestions[Math.floor(Math.random() * mockQuestions.length)];
    setCurrentQuestion(q);
    setTimeLeft(timerDuration);
    setShowSolution(false);
    setGameState('QUESTION');
  };

  const getLowestEmptyRow = (c) => {
    for (let r = rows - 1; r >= 0; r--) {
      if (board[r][c] === 0) return r;
    }
    return -1;
  };

  const handleColumnClick = (c) => {
    if (gameState !== 'WAITING_MOVE') return;
    const targetRow = getLowestEmptyRow(c);
    if (targetRow >= 0) {
      setPreviewMove({ row: targetRow, col: c });
    }
  };

  const checkForConnect4 = (boardState, r, c, groupIndex) => {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    
    for (const [dr, dc] of directions) {
      let winningLine = [{ r, c }];
      
      let currR = r + dr;
      let currC = c + dc;
      while (currR >= 0 && currR < rows && currC >= 0 && currC < cols && boardState[currR][currC] === groupIndex) {
        winningLine.push({ r: currR, c: currC });
        currR += dr;
        currC += dc;
      }
      
      currR = r - dr;
      currC = c - dc;
      while (currR >= 0 && currR < rows && currC >= 0 && currC < cols && boardState[currR][currC] === groupIndex) {
        winningLine.push({ r: currR, c: currC });
        currR -= dr;
        currC -= dc;
      }

      if (winningLine.length >= 4) {
        return winningLine;
      }
    }
    return null;
  };

  const handleAnswer = (isCorrect) => {
    if (isCorrect && previewMove) {
      const { row, col } = previewMove;
      const newBoard = board.map(r => [...r]);
      newBoard[row][col] = currentGroup.id;
      setBoard(newBoard);
      
      // הגדרת הנפילה בשביל הפיזיקה
      setLastDrop({ r: row, c: col });

      const winningSequence = checkForConnect4(newBoard, row, col, currentGroup.id);
      
      if (winningSequence) {
        setWinningCells(winningSequence);
        setScores(prev => ({ ...prev, [currentGroup.id]: prev[currentGroup.id] + 1 }));
        // ממתין קצת שהאנימציה תיפול לפני מסך הניצחון
        setTimeout(() => setGameState('GAME_OVER'), 1000); 
        return;
      }
    }
    nextTurn();
  };

  const handleResetGame = () => {
    setConfirmDialog({
      isOpen: true,
      message: "האם אתה בטוח שברצונך לאפס את הלוח ולהתחיל משחק חדש?",
      onConfirm: () => {
        setBoard(Array(rows).fill(null).map(() => Array(cols).fill(0)));
        setGameState('WAITING_START');
        setPreviewMove(null);
        setWinningCells([]);
        setLastDrop(null);
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

  const getWinner = () => currentGroup;

  // בניית "מכסה" החורים בדומה ל-WPF GeometryGroup
  const buildSVGPlate = useCallback(() => {
    let d = `M 0,0 H ${cols * 100} V ${rows * 100} H 0 Z `;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = c * 100 + 50;
        const cy = r * 100 + 50;
        const radius = 42;
        // מצייר עיגול נגדי כדי לחורר את המשטח
        d += `M ${cx},${cy - radius} a ${radius},${radius} 0 1,0 0,${radius * 2} a ${radius},${radius} 0 1,0 0,-${radius * 2} `;
      }
    }
    return d;
  }, [rows, cols]);

  return (
    <div dir="rtl" className="h-screen w-full bg-[#001F3F] text-white font-sans flex flex-col md:flex-row overflow-hidden relative">
      
      {/* הגדרת מנוע האנימציה - פיזיקת נפילה עם הקפצה */}
      <style>{`
        @keyframes connect4drop {
          0% { transform: translateY(var(--start-y)); animation-timing-function: ease-in; }
          45% { transform: translateY(0); animation-timing-function: ease-out; }
          65% { transform: translateY(-40px); animation-timing-function: ease-in; }
          80% { transform: translateY(0); animation-timing-function: ease-out; }
          90% { transform: translateY(-10px); animation-timing-function: ease-in; }
          100% { transform: translateY(0); }
        }
      `}</style>

      {/* רקע עמוק */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1A1A2E] via-[#16213E] to-[#0F3460] opacity-80 pointer-events-none" />

      {/* פאנל שליטה */}
      <div className="w-full md:w-[420px] lg:w-[480px] shrink-0 bg-slate-900/80 backdrop-blur-2xl border-l border-white/5 p-6 flex flex-col z-20 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-y-auto">
        
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg">
              <AlignJustify size={28} className="text-white rotate-90" />
            </div>
            <h1 className="text-3xl font-black tracking-wide text-white">4 בשורה</h1>
          </div>
          <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all">
            <Settings size={22} />
          </button>
        </div>

        <div className="flex gap-4 mb-4 shrink-0">
          {mockGroups.map((grp) => {
            const isActive = currentGroupIndex === mockGroups.indexOf(grp) && gameState !== 'WAITING_START' && gameState !== 'GAME_OVER';
            return (
              <div 
                key={grp.id} 
                className={`relative flex-1 rounded-2xl p-4 flex flex-col items-center justify-center border-2 transition-all duration-500 overflow-hidden
                  ${isActive ? 'border-white/50 scale-105' : 'border-white/5 bg-black/40 scale-100'}`}
                style={{ backgroundColor: isActive ? grp.color : '' }}
              >
                {isActive && <div className="absolute inset-0 bg-white/20 animate-pulse pointer-events-none" />}
                <span className="text-sm font-bold text-center mb-1 z-10 text-white drop-shadow-md">{grp.name}</span>
                <span className="text-4xl font-black z-10 drop-shadow-md text-white">{scores[grp.id]}</span>
              </div>
            );
          })}
        </div>

        <div className="flex-1 min-h-[350px] shrink-0 bg-black/20 rounded-3xl border border-white/5 p-5 relative overflow-hidden flex flex-col mt-4">
          
          {gameState === 'WAITING_START' && (
            <div className="h-full flex flex-col items-center justify-center gap-6 animate-in fade-in duration-700">
              <div className="w-24 h-24 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Gamepad2 size={48} className="text-orange-400" />
              </div>
              <p className="text-lg text-slate-300 text-center font-medium px-4">לחץ על 'התחל' כדי להגריל מי מתחיל.</p>
              <button 
                onClick={startGame}
                className="mt-4 w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 font-black text-xl flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-[0_0_20px_rgba(249,115,22,0.4)]"
              >
                <Play fill="currentColor" size={24} /> התחל משחק
              </button>
            </div>
          )}

          {gameState === 'WAITING_MOVE' && (
            <div className="h-full flex flex-col items-center justify-center gap-8 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center">
                <h3 className="text-2xl font-black mb-2" style={{ color: currentGroup.color }}>תור {currentGroup.name}</h3>
                <p className="text-slate-300 text-lg">לחצו על העמודה בלוח שלתוכה תרצו להפיל דיסקית.</p>
              </div>
              
              <div className={`p-8 rounded-full border-4 border-dashed transition-all duration-500 ${previewMove ? 'border-transparent' : 'border-slate-600 animate-pulse'}`}
                   style={previewMove ? { backgroundColor: currentGroup.color } : {}}>
                <AlignJustify size={64} className={previewMove ? 'text-white rotate-90 drop-shadow-md' : 'text-slate-600 rotate-90'} />
              </div>

              <button 
                onClick={loadQuestion}
                disabled={!previewMove}
                className={`w-full py-4 rounded-xl font-bold text-xl flex items-center justify-center gap-3 transition-all duration-300
                  ${previewMove 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:scale-105 hover:shadow-[0_0_20px_rgba(245,158,11,0.5)] text-white cursor-pointer' 
                    : 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5'}`}
              >
                <HelpCircle size={24} /> אשר עמודה והצג שאלה
              </button>
            </div>
          )}

          {gameState === 'QUESTION' && currentQuestion && (
            <div className="h-full flex flex-col animate-in fade-in zoom-in-95 duration-500">
              <div className="shrink-0 flex items-center justify-between bg-slate-900/80 rounded-2xl p-4 mb-4 border border-white/10 shadow-inner">
                <div className="flex items-center gap-2 text-slate-400">
                  <Timer size={20} />
                  <span className="font-medium text-lg">זמן נותר:</span>
                </div>
                <span className={`text-4xl font-black tabular-nums transition-colors duration-300 ${timeLeft <= 5 ? 'text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.8)]' : 'text-white'}`}>
                  {timeLeft > 0 ? `00:${timeLeft.toString().padStart(2, '0')}` : 'זמנך תם!'}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-400/30 rounded-2xl p-6 flex flex-col justify-center shadow-lg mb-4">
                <p className="text-2xl font-bold text-blue-50 text-center leading-relaxed">
                  {currentQuestion.q}
                </p>
              </div>

              <div className={`shrink-0 h-[80px] rounded-2xl flex items-center justify-center p-4 mb-4 transition-all duration-500 border-2 
                  ${showSolution ? 'bg-amber-500/20 border-amber-500/50' : 'bg-transparent border-transparent'}`}>
                {showSolution && (
                  <p className="text-xl font-black text-amber-400 text-center animate-in slide-in-from-bottom-2">
                    פתרון: {currentQuestion.a}
                  </p>
                )}
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

      {/* =========================================================================
          אזור הלוח (Main Board)
          ========================================================================= */}
      <div className="flex-1 min-w-0 h-full flex items-center justify-center p-4 md:p-12 relative z-10">
        
        {/* קונטיינר ה-SVG - מונע לחלוטין חיתוכים, הדיסקיות מאחורי המכסה! */}
        <div className="w-full h-full max-h-[85vh] flex items-center justify-center p-4">
           <svg viewBox={`0 0 ${cols * 100} ${rows * 100}`} className="w-full h-full max-w-4xl drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)] border-4 border-slate-800 bg-[#141423] rounded-2xl overflow-hidden">
             
             {/* 1. ציור הדיסקיות השמורות על הלוח (נמצאות מתחת למכסה) */}
             {board.flatMap((row, r) => row.map((val, c) => {
               if (val === 0) return null;
               const isJustDropped = lastDrop?.r === r && lastDrop?.c === c;
               const color = val === 1 ? '#E94560' : '#FFD700';
               return (
                 <circle
                   key={`${r}-${c}`}
                   cx={c * 100 + 50}
                   cy={r * 100 + 50}
                   r="43"
                   fill={color}
                   stroke="rgba(255,255,255,0.2)"
                   strokeWidth="3"
                   style={isJustDropped ? {
                     animation: 'connect4drop 0.6s forwards',
                     // חישוב גובה הנפילה המדויק מחוץ ללוח:
                     '--start-y': `-${(r + 1) * 100}px`
                   } : {}}
                 />
               );
             }))}

             {/* 2. הדיסקית המהבהבת (Preview) */}
             {previewMove && (
               <circle
                 cx={previewMove.col * 100 + 50}
                 cy={previewMove.row * 100 + 50}
                 r="42"
                 fill={currentGroup.id === 1 ? '#E94560' : '#FFD700'}
                 opacity="0.4"
                 stroke="#FFD700"
                 strokeWidth="4"
                 strokeDasharray="10 10"
                 className="animate-pulse pointer-events-none"
               />
             )}

             {/* 3. המכסה הכחול המחורר - שומר על צורה עגולה ומושלמת לחורים */}
             <path fill="#0F3460" fillRule="evenodd" d={buildSVGPlate()} className="pointer-events-none" />

             {/* 4. טבעות הניצחון (מעל המכסה) */}
             {winningCells.map((cell, i) => (
               <circle
                 key={`win-${i}`}
                 cx={cell.c * 100 + 50}
                 cy={cell.r * 100 + 50}
                 r="46"
                 fill="none"
                 stroke="#FFD700"
                 strokeWidth="8"
                 className="animate-pulse pointer-events-none"
                 filter="drop-shadow(0px 0px 10px #FFD700)"
               />
             ))}

             {/* 5. עמודות לחיצות נסתרות שיקבלו את קליק העכבר */}
             {Array.from({length: cols}).map((_, c) => (
               <rect
                 key={`colclick-${c}`}
                 x={c * 100}
                 y="0"
                 width="100"
                 height={rows * 100}
                 fill="transparent"
                 className="cursor-pointer hover:fill-white/10 transition-colors duration-300"
                 onClick={() => handleColumnClick(c)}
               />
             ))}

           </svg>
        </div>

        {/* מסך ניצחון מרהיב */}
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md overflow-hidden">
            <div className="absolute inset-0" style={{ backgroundColor: `${getWinner().color}20` }} />
            
            {[...Array(40)].map((_, i) => (
              <div key={i} className="absolute animate-bounce" style={{
                left: `${Math.random() * 100}%`, top: `-10%`,
                animationDuration: `${2 + Math.random() * 2}s`,
                animationDelay: `${Math.random() * 2}s`,
                backgroundColor: getWinner().color, width: '16px', height: '16px', borderRadius: '50%'
              }} />
            ))}

            <div className="relative animate-[spin_10s_linear_infinite] p-1.5 rounded-[42px]" style={{ background: `linear-gradient(45deg, ${getWinner().color}, transparent, ${getWinner().color})` }}>
              <div className="bg-slate-900/90 border border-white/10 rounded-[40px] p-16 flex flex-col items-center shadow-2xl animate-in zoom-in-75 duration-700"
                   style={{ boxShadow: `0 0 100px ${getWinner().glow}` }}>
                
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-yellow-400 blur-3xl opacity-30 animate-pulse" />
                  <Trophy size={120} color="#FFD700" className="relative drop-shadow-[0_0_20px_rgba(255,215,0,1)] animate-bounce" />
                  <Sparkles size={40} color="#FFF" className="absolute -top-4 -right-4 animate-ping" />
                </div>
                
                <h2 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-amber-500 mb-6 drop-shadow-lg">
                  ניצחון!
                </h2>
                <p className="text-5xl font-black mb-4 tracking-wide" style={{ color: getWinner().color }}>{getWinner().name}</p>
                <p className="text-2xl text-slate-300 mb-12 font-medium">יצרו רצף של 4 וניצחו במשחק!</p>
                
                <button 
                  onClick={() => {
                    setBoard(Array(rows).fill(null).map(() => Array(cols).fill(0)));
                    setGameState('WAITING_START');
                    setWinningCells([]);
                  }}
                  className="px-12 py-5 rounded-full font-black text-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:scale-110 transition-transform shadow-[0_0_30px_rgba(245,158,11,0.5)] text-white"
                >
                  התחל משחק חדש
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* תפריט הגדרות קופץ */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-[400px] shadow-2xl">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/10">
              <h2 className="text-2xl font-bold flex items-center gap-2"><Settings className="text-orange-400"/> הגדרות משחק</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><X size={20}/></button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="flex justify-between text-lg mb-2">
                  <span>עמודות בלוח (רוחב)</span>
                  <span className="font-bold text-orange-400">{cols}</span>
                </label>
                <input type="range" min="5" max="10" step="1" value={cols} onChange={(e) => setCols(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
              </div>

              <div>
                <label className="flex justify-between text-lg mb-2">
                  <span>שורות בלוח (גובה)</span>
                  <span className="font-bold text-orange-400">{rows}</span>
                </label>
                <input type="range" min="5" max="10" step="1" value={rows} onChange={(e) => setRows(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
              </div>
              
              <div>
                <label className="flex justify-between text-lg mb-2">
                  <span>זמן לשאלה (שניות)</span>
                  <span className="font-bold text-orange-400">{timerDuration}</span>
                </label>
                <input type="range" min="10" max="60" step="5" value={timerDuration} onChange={(e) => setTimerDuration(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-white/10">
              <button onClick={handleResetGame} className="w-full py-4 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-600/30 hover:bg-rose-600 hover:text-white font-bold flex items-center justify-center gap-2 transition-all">
                <RotateCcw size={20} /> שמור ואפס לוח
              </button>
            </div>
          </div>
        </div>
      )}

      {/* תפריט אישור מותאם */}
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