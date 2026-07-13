import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Play, CheckCircle2, XCircle, RefreshCcw, HelpCircle, ArrowRight, Trophy, Gamepad2, Timer, Sparkles, Disc, X, RotateCcw, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const generateInitialBoard = (size, numTeams) => {
  let newBoard = Array(size).fill(null).map(() => Array(size).fill(0));
  const mid = Math.floor(size / 2);
  
  if (numTeams <= 2) {
    newBoard[mid - 1][mid - 1] = 1;
    newBoard[mid][mid] = 1;
    newBoard[mid - 1][mid] = 2;
    newBoard[mid][mid - 1] = 2;
  } else {
    newBoard[mid - 1][mid - 1] = 1;
    newBoard[mid - 1][mid] = 2;
    newBoard[mid][mid - 1] = 3;
    newBoard[mid][mid] = numTeams === 4 ? 4 : 1;
  }
  return newBoard;
};

export default function ReversiGame({ onBackToMenu, selectedBank, session }) {
  const [gridSize, setGridSize] = useState(8); 
  const [timerDuration, setTimerDuration] = useState(30);
  const [gameState, setGameState] = useState('WAITING_START'); 
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [board, setBoard] = useState(() => generateInitialBoard(8, 2)); 
  const [previewMove, setPreviewMove] = useState(null); 
  const [lastFlipped, setLastFlipped] = useState([]); 

  const [timeLeft, setTimeLeft] = useState(30);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [showSolution, setShowSolution] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null });

  const [questions, setQuestions] = useState([]); 
  const [students, setStudents] = useState([]);
  const [teams, setTeams] = useState([]); 
  const [scores, setScores] = useState({});
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
      const beautifulColors = ["#E94560", "#00BCD4", "#FF9E00", "#40FF5A", "#7B2CBF", "#F15BB5"];
      
      const dynamicTeams = uniqueTeamNames.map((name, index) => ({
        internalId: index + 1,
        id: name,
        name: name,
        color: beautifulColors[index % beautifulColors.length],
        glow: `rgba(255,255,255,0.2)`
      }));
      setTeams(dynamicTeams);

      const initialPools = {};
      dynamicTeams.forEach(t => {
        initialPools[t.id] = activeStudents.filter(s => (s.team || 'קבוצה כללית') === t.id).map(s => s.id);
      });
      setStudentPools(initialPools);

      if (dynamicTeams.length > 0) {
        setCurrentTeamIndex(Math.floor(Math.random() * dynamicTeams.length));
        const initBoard = generateInitialBoard(gridSize, dynamicTeams.length);
        setBoard(initBoard);
        recalculateScores(initBoard, dynamicTeams);
      }
      setIsLoadingData(false);
    };

    fetchData();
  }, [session, selectedBank, gridSize]);

  useEffect(() => {
    let timer;
    if (gameState === 'QUESTION' && timeLeft > 0 && !showSolution) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && gameState === 'QUESTION') {
      setShowSolution(true); 
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft, showSolution]);

  const recalculateScores = useCallback((currentBoard, currentTeamsList) => {
    const targetTeams = currentTeamsList || teams;
    const newScores = {};
    targetTeams.forEach(t => newScores[t.id] = 0);
    
    for (let r = 0; r < currentBoard.length; r++) {
      for (let c = 0; c < currentBoard[r].length; c++) {
        const val = currentBoard[r][c]; 
        if (val > 0) {
          const matchedTeam = targetTeams.find(t => t.internalId === val);
          if (matchedTeam) {
            newScores[matchedTeam.id] = (newScores[matchedTeam.id] || 0) + 1;
          }
        }
      }
    }
    setScores(newScores);
  }, [teams]);

  const isAdjacentToAnyDisk = (r, c) => {
    const directions = [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]];
    for (const [dr, dc] of directions) {
      const nr = r + dr; const nc = c + dc;
      if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize) {
        if (board[nr][nc] > 0) return true;
      }
    }
    return false;
  };

  const getDisksToFlip = (row, col, internalTeamId) => {
    const flips = [];
    if (board[row][col] !== 0) return flips;

    const directions = [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]];
    
    for (const [dr, dc] of directions) {
      let r = row + dr;
      let c = col + dc;
      const potentialFlips = [];

      while (r >= 0 && r < gridSize && c >= 0 && c < gridSize && board[r][c] !== 0 && board[r][c] !== internalTeamId) {
        potentialFlips.push({r, c});
        r += dr;
        c += dc;
      }

      if (potentialFlips.length > 0 && r >= 0 && r < gridSize && c >= 0 && c < gridSize && board[r][c] === internalTeamId) {
        flips.push(...potentialFlips);
      }
    }
    return flips;
  };

  const startGame = () => {
    if (teams.length === 0) {
      alert("אין תלמידים פעילים במערכת! אנא הכנס תלמידים וסמן אותם ב-V בפאנל הניהול.");
      return;
    }

    const newBoard = generateInitialBoard(gridSize, teams.length);
    setBoard(newBoard);
    recalculateScores(newBoard, teams);
    
    const freshPools = {};
    teams.forEach(t => {
      freshPools[t.id] = students.filter(s => (s.team || 'קבוצה כללית') === t.id).map(s => s.id);
    });
    setStudentPools(freshPools);

    setGameState('WAITING_HEX'); 
    setPreviewMove(null);
    setLastFlipped([]);
    setCurrentTeamIndex(Math.floor(Math.random() * teams.length)); 
  };

  const nextTurn = () => {
    if (teams.length === 0) return;
    setCurrentTeamIndex(prev => (prev + 1) % teams.length);
    setGameState('WAITING_HEX');
    setPreviewMove(null);
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

  const handleCellClick = (r, c) => {
    if (gameState !== 'WAITING_HEX' || !currentTeam) return;
    
    if (board[r][c] === 0 && isAdjacentToAnyDisk(r, c)) {
      const flips = getDisksToFlip(r, c, currentTeam.internalId);
      // השינוי: אישור בחירת המשבצת גם אם ה-flips ריק ואין בליעה
      setPreviewMove({ r, c, flips });
    }
  };

  const handleAnswer = (isCorrect) => {
    if (isCorrect && previewMove && currentTeam) {
      const newBoard = board.map(row => [...row]);
      newBoard[previewMove.r][previewMove.c] = currentTeam.internalId;
      
      const flippedKeys = [];
      previewMove.flips.forEach(p => {
        newBoard[p.r][p.c] = currentTeam.internalId;
        flippedKeys.push(`${p.r},${p.c}`);
      });
      
      setBoard(newBoard);
      recalculateScores(newBoard, teams);
      setLastFlipped(flippedKeys); 

      let isFull = true;
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          if (newBoard[r][c] === 0) isFull = false;
        }
      }
      
      if (isFull) {
        setGameState('GAME_OVER');
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
        startGame();
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
  const cellSize = 100; 
  
  const renderBoard = () => {
    if (!board || board.length === 0 || board.length !== gridSize || !board[0]) return null;

    const cells = [];
    let cellCounter = 1;

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const isPreview = previewMove?.r === r && previewMove?.c === c;
        const groupVal = board[r][c];
        const owner = groupVal > 0 ? teams.find(g => g.internalId === groupVal) : null;
        const isJustFlipped = lastFlipped.includes(`${r},${c}`);

        cells.push(
          <g key={`${r},${c}`} onClick={() => handleCellClick(r, c)} className="cursor-pointer group">
            <rect 
              x={c * cellSize} y={r * cellSize} 
              width={cellSize} height={cellSize} 
              fill="#0f172a" stroke="#1e293b" strokeWidth="2"
              className="transition-colors hover:fill-slate-800"
            />
            
            <text 
              x={c * cellSize + cellSize/2} y={r * cellSize + cellSize/2 + 6} 
              textAnchor="middle" fill="#334155" fontSize={24} fontWeight="900"
              className="pointer-events-none"
            >
              {cellCounter}
            </text>

            {owner && (
              <circle 
                cx={c * cellSize + cellSize/2} cy={r * cellSize + cellSize/2} 
                r={cellSize/2 - 8}
                fill={owner.color}
                stroke="white" strokeWidth="3"
                className="pointer-events-none drop-shadow-lg"
                style={{ 
                  transformOrigin: `${c * cellSize + cellSize/2}px ${r * cellSize + cellSize/2}px`,
                  animation: isJustFlipped ? 'flip 0.4s ease-in-out' : 'none',
                  filter: `drop-shadow(0 4px 6px rgba(0,0,0,0.5))`
                }}
              />
            )}

            {isPreview && currentTeam && (
              <circle 
                cx={c * cellSize + cellSize/2} cy={r * cellSize + cellSize/2} 
                r={cellSize/2 - 8}
                fill={currentTeam.color}
                stroke="yellow" strokeWidth="3" strokeDasharray="6,6"
                className="pointer-events-none opacity-60 animate-pulse"
              />
            )}
          </g>
        );
        cellCounter++;
      }
    }
    return cells;
  };

  const getWinner = () => {
    let topScore = -1;
    let winner = null;
    teams.forEach(t => {
      if ((scores[t.id] || 0) > topScore) {
        topScore = scores[t.id];
        winner = t;
      }
    });
    return winner || { name: 'אין מנצח', color: '#fff' };
  };

  return (
    <div dir="rtl" className="h-screen w-full bg-[#070b19] text-white font-sans flex flex-col md:flex-row overflow-hidden relative">
      
      <style>{`
        @keyframes flip {
          0% { transform: scaleX(1); }
          50% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
      `}</style>

      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[700px] h-[700px] rounded-full bg-purple-600/10 blur-[180px] pointer-events-none" />

      <div className="w-full md:w-[420px] lg:w-[480px] shrink-0 bg-slate-900/80 backdrop-blur-2xl border-l border-white/5 p-6 flex flex-col z-20 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-y-auto">
        
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-lg">
              <Disc size={28} className="text-white" />
            </div>
            <h1 className="text-3xl font-black tracking-wide text-white">רברסי אסטרטגי</h1>
          </div>
          <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all">
            <Settings size={22} />
          </button>
        </div>

        <div className="flex gap-4 mb-4 shrink-0 overflow-x-auto pb-2">
          {teams.length === 0 && <p className="text-center w-full text-slate-500 text-sm">ממתין לנתונים...</p>}
          {teams.map((grp) => {
            const isActive = currentTeam && currentTeam.id === grp.id && gameState !== 'WAITING_START' && gameState !== 'GAME_OVER';
            return (
              <div 
                key={grp.id} 
                className={`relative flex-1 min-w-[100px] rounded-2xl p-4 flex flex-col items-center justify-center border-2 transition-all duration-500 overflow-hidden
                  ${isActive ? 'border-white/50 scale-105' : 'border-white/5 bg-black/40 scale-100'}`}
                style={{ backgroundColor: isActive ? grp.color : '' }}
              >
                {isActive && <div className="absolute inset-0 bg-white/20 animate-pulse pointer-events-none" />}
                <span className="text-sm font-bold text-center mb-1 z-10 break-all">{grp.name}</span>
                <span className="text-4xl font-black z-10 drop-shadow-md">{scores[grp.id] || 0}</span>
              </div>
            );
          })}
        </div>

        <div className="flex-1 min-h-[350px] shrink-0 bg-black/20 rounded-3xl border border-white/5 p-5 relative overflow-y-auto flex flex-col mt-4">          
          {gameState === 'WAITING_START' && (
            <div className="h-full flex flex-col items-center justify-center gap-6 animate-in fade-in duration-700">
              <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Gamepad2 size={48} className="text-emerald-400" />
              </div>
              <p className="text-lg text-slate-300 text-center font-medium px-4">
                {isLoadingData ? 'מתחבר למסד הנתונים ומושך נתונים...' : `הלוח מוכן עם ${questions.length} שאלות ו-${students.length} תלמידים פעילים.`}
              </p>
              <button 
                onClick={startGame}
                disabled={isLoadingData}
                className={`mt-4 w-full py-4 rounded-xl font-black text-xl flex items-center justify-center gap-3 transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)]
                  ${isLoadingData ? 'bg-slate-700 text-slate-400 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:scale-105 text-white'}`}
              >
                {isLoadingData ? <RefreshCcw className="animate-spin" size={24} /> : <Play fill="currentColor" size={24} />} 
                {isLoadingData ? 'טוען...' : 'התחל משחק'}
              </button>
            </div>
          )}

          {gameState === 'WAITING_HEX' && currentTeam && (
            <div className="h-full flex flex-col items-center justify-center gap-8 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center">
                <h3 className="text-2xl font-black mb-2" style={{ color: currentTeam.color }}>תור {currentTeam.name}</h3>
                <p className="text-slate-300 text-lg">בחר משבצת פנויה הנוגעת בדיסקית קיימת.</p>
              </div>
              
              <div className={`p-8 rounded-full border-4 border-dashed transition-all duration-500 ${previewMove ? 'border-transparent' : 'border-slate-600 animate-pulse'}`}>
                <Disc size={64} className={previewMove ? 'text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]' : 'text-slate-600'} />
              </div>

              <button 
                onClick={loadQuestion}
                disabled={!previewMove}
                className={`w-full py-4 rounded-xl font-bold text-xl flex items-center justify-center gap-3 transition-all duration-300
                  ${previewMove 
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

        
      </div>

      <div className="flex-1 min-w-0 h-full flex items-center justify-center p-4 md:p-12 relative z-10">
        <div className="w-full h-full max-h-[85vh] flex items-center justify-center p-4">
           <svg viewBox={`0 0 ${gridSize * cellSize} ${gridSize * cellSize}`} className="w-full h-full max-w-3xl drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-4 border-slate-700 bg-slate-900 rounded-xl overflow-hidden">
             {renderBoard()}
           </svg>
        </div>

        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md overflow-hidden">
            <div className="absolute inset-0" style={{ backgroundColor: `${getWinner().color}20` }} />
            
            {[...Array(40)].map((_, i) => (
              <div key={i} className="absolute animate-bounce" style={{
                left: `${Math.random() * 100}%`, top: `-10%`,
                animationDuration: `${2 + Math.random() * 2}s`,
                animationDelay: `${Math.random() * 2}s`,
                backgroundColor: getWinner().color, width: '12px', height: '12px', borderRadius: '50%'
              }} />
            ))}

            <div className="relative animate-[spin_10s_linear_infinite] p-1.5 rounded-[42px]" style={{ background: `linear-gradient(45deg, ${getWinner().color}, transparent, ${getWinner().color})` }}>
              <div className="bg-slate-900/90 border border-white/10 rounded-[40px] p-16 flex flex-col items-center shadow-2xl animate-in zoom-in-75 duration-700"
                   style={{ boxShadow: `0 0 100px ${getWinner().color}88` }}>
                
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-yellow-400 blur-3xl opacity-30 animate-pulse" />
                  <Trophy size={120} color="#FFD700" className="relative drop-shadow-[0_0_20px_rgba(255,215,0,1)] animate-bounce" />
                  <Sparkles size={40} color="#FFF" className="absolute -top-4 -right-4 animate-ping" />
                </div>
                
                <h2 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-amber-500 mb-6 drop-shadow-lg">ניצחון!</h2>
                <p className="text-5xl font-black mb-4 tracking-wide" style={{ color: getWinner().color }}>{getWinner().name}</p>
                <p className="text-2xl text-slate-300 mb-12 font-medium">כבשו את הלוח עם {scores[getWinner().id] || 0} דיסקיות!</p>
                
                <button onClick={startGame} className="px-12 py-5 rounded-full font-black text-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:scale-110 transition-transform shadow-[0_0_30px_rgba(245,158,11,0.5)] text-white">
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
              <h2 className="text-2xl font-bold flex items-center gap-2"><Settings className="text-emerald-400"/> הגדרות משחק</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><X size={20}/></button>
            </div>
            
            <div className="space-y-8">
              <div>
                <label className="flex justify-between text-lg mb-2">
                  <span>גודל לוח משבצות</span>
                  <span className="font-bold text-emerald-400">{gridSize}x{gridSize}</span>
                </label>
                <input type="range" min="6" max="12" step="2" value={gridSize} onChange={(e) => setGridSize(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
              </div>
              
              <div>
                <label className="flex justify-between text-lg mb-2">
                  <span>זמן לשאלה (שניות)</span>
                  <span className="font-bold text-emerald-400">{timerDuration}</span>
                </label>
                <input type="range" min="10" max="60" step="5" value={timerDuration} onChange={(e) => setTimerDuration(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
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
              <button onClick={() => confirmDialog.onConfirm()} className="flex-1 py-4 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-lg transition-all shadow-[0_0_15px_rgba(225,29,72,0.4)] text-white">כן, אני בטוח</button>
              <button onClick={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: null })} className="flex-1 py-4 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-lg transition-all text-white">ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}