import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Play, CheckCircle2, XCircle, RefreshCcw, HelpCircle, ArrowRight, Trophy, Gamepad2, Timer, Sparkles, X, RotateCcw, AlertTriangle, LayoutGrid } from 'lucide-react';
import { supabase } from '../lib/supabaseClient'; 

export default function DotsAndBoxesGame({ onBackToMenu, selectedBank, session }) {
  const [gridSize, setGridSize] = useState(6);
  const [timerDuration, setTimerDuration] = useState(30);
  const [questionOnEveryLine, setQuestionOnEveryLine] = useState(false);
  
  const [gameState, setGameState] = useState('WAITING_START'); 
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [lines, setLines] = useState({}); 
  const [boxes, setBoxes] = useState({}); 
  const [previewLine, setPreviewLine] = useState(null); 
  
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
        id: name,
        name: name,
        color: beautifulColors[index % beautifulColors.length],
        glow: `rgba(255,255,255,0.2)`
      }));
      setTeams(dynamicTeams);

      const initialScores = {};
      const initialPools = {};
      dynamicTeams.forEach(t => {
        initialScores[t.id] = 0;
        initialPools[t.id] = activeStudents.filter(s => (s.team || 'קבוצה כללית') === t.id).map(s => s.id);
      });
      setScores(initialScores);
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

  const initGame = useCallback((size) => {
    setLines({});
    setBoxes({});
    setPreviewLine(null);
    setGameState('WAITING_START');
  }, []);

  useEffect(() => {
    initGame(gridSize);
  }, [gridSize, initGame]);

  const startGame = () => {
    if (teams.length === 0) {
      alert("אין תלמידים פעילים במערכת! אנא הכנס תלמידים וסמן אותם ב-V בפאנל הניהול.");
      return;
    }

    initGame(gridSize);
    
    const freshScores = {};
    const freshPools = {};
    teams.forEach(t => {
      freshScores[t.id] = 0;
      freshPools[t.id] = students.filter(s => (s.team || 'קבוצה כללית') === t.id).map(s => s.id);
    });
    setScores(freshScores);
    setStudentPools(freshPools);

    setGameState('WAITING_LINE');
    setCurrentTeamIndex(Math.floor(Math.random() * teams.length));
  };

  const nextTurn = () => {
    if (teams.length === 0) return;
    setCurrentTeamIndex(prev => (prev + 1) % teams.length);
    setGameState('WAITING_LINE');
    setPreviewLine(null);
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

  const handleLineClick = (dir, r, c) => {
    if (gameState !== 'WAITING_LINE') return;
    const lineKey = `${dir}-${r}-${c}`;
    if (lines[lineKey]) return; 
    setPreviewLine({ dir, r, c, key: lineKey });
  };

  const checkIfBoxWillComplete = (dir, r, c, currentLines) => {
    let completesBox = false;
    const testLines = { ...currentLines, [`${dir}-${r}-${c}`]: currentTeam?.id || 1 };

    const checkSquare = (sr, sc) => {
      if (sr < 0 || sr >= gridSize - 1 || sc < 0 || sc >= gridSize - 1) return false;
      return testLines[`h-${sr}-${sc}`] && 
             testLines[`h-${sr + 1}-${sc}`] && 
             testLines[`v-${sr}-${sc}`] && 
             testLines[`v-${sr}-${sc + 1}`];
    };

    if (dir === 'h') {
      if (checkSquare(r - 1, c)) completesBox = true;
      if (checkSquare(r, c)) completesBox = true;
    } else {
      if (checkSquare(r, c - 1)) completesBox = true;
      if (checkSquare(r, c)) completesBox = true;
    }

    return completesBox;
  };

  const handleConfirmLine = () => {
    if (!previewLine) return;
    
    const willComplete = checkIfBoxWillComplete(previewLine.dir, previewLine.r, previewLine.c, lines);
    const askQuestion = willComplete || questionOnEveryLine;

    if (askQuestion) {
      loadQuestion();
    } else {
      const newLines = { ...lines, [previewLine.key]: currentTeam.id };
      setLines(newLines);
      setPreviewLine(null);
      nextTurn();
    }
  };

  const handleAnswer = (isCorrect) => {
    if (isCorrect && previewLine && currentTeam) {
      const newLines = { ...lines, [previewLine.key]: currentTeam.id };
      setLines(newLines);
      
      let completedCount = 0;
      const newBoxes = { ...boxes };
      
      const checkAndFillBox = (sr, sc) => {
        if (sr < 0 || sr >= gridSize - 1 || sc < 0 || sc >= gridSize - 1) return 0;
        if (newBoxes[`${sr}-${sc}`]) return 0; 
        
        if (newLines[`h-${sr}-${sc}`] && 
            newLines[`h-${sr + 1}-${sc}`] && 
            newLines[`v-${sr}-${sc}`] && 
            newLines[`v-${sr}-${sc + 1}`]) {
          newBoxes[`${sr}-${sc}`] = currentTeam.id;
          return 1;
        }
        return 0;
      };

      const r = previewLine.r;
      const c = previewLine.c;
      
      if (previewLine.dir === 'h') {
        completedCount += checkAndFillBox(r - 1, c);
        completedCount += checkAndFillBox(r, c);
      } else {
        completedCount += checkAndFillBox(r, c - 1);
        completedCount += checkAndFillBox(r, c);
      }

      setBoxes(newBoxes);
      
      if (completedCount > 0) {
        setScores(prev => ({ ...prev, [currentTeam.id]: (prev[currentTeam.id] || 0) + completedCount }));
      }

      const totalBoxes = (gridSize - 1) * (gridSize - 1);
      const currentCompleted = Object.keys(newBoxes).length;
      if (currentCompleted >= totalBoxes) {
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

  const renderBoard = () => {
    const elements = [];
    const spacing = 100;
    const padding = 40;
    const lineThickness = 16;
    let lineCounter = 1;

    for (let r = 0; r < gridSize - 1; r++) {
      for (let c = 0; c < gridSize - 1; c++) {
        const boxOwnerId = boxes[`${r}-${c}`];
        if (boxOwnerId) {
          const owner = teams.find(g => g.id === boxOwnerId);
          elements.push(
            <rect 
              key={`box-${r}-${c}`}
              x={c * spacing + padding + lineThickness/2} 
              y={r * spacing + padding + lineThickness/2} 
              width={spacing - lineThickness} 
              height={spacing - lineThickness} 
              fill={owner?.color || '#FFF'}
              style={{
                transformOrigin: `${c * spacing + padding + spacing/2}px ${r * spacing + padding + spacing/2}px`,
                animation: 'boxFillAnim 0.6s ease-out forwards'
              }}
            />
          );
        }
      }
    }

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize - 1; c++) {
        const key = `h-${r}-${c}`;
        const ownerId = lines[key];
        const isPreview = previewLine?.key === key;
        
        let color = "#cbd5e1";
        if (ownerId) {
            const ownerTeam = teams.find(g => g.id === ownerId);
            color = ownerTeam ? ownerTeam.color : "#cbd5e1";
        } else if (isPreview && currentTeam) {
            color = currentTeam.color;
        }

        const opacity = ownerId ? 1 : isPreview ? 0.6 : 0.2;

        elements.push(
          <g key={`gh-${r}-${c}`} onClick={() => handleLineClick('h', r, c)} className="cursor-pointer group">
            <rect x={c * spacing + padding} y={r * spacing + padding - 20} width={spacing} height={40} fill="transparent" />
            <rect 
              x={c * spacing + padding} 
              y={r * spacing + padding - lineThickness/2} 
              width={spacing} 
              height={lineThickness} 
              fill={color} 
              opacity={opacity}
              rx={lineThickness/2}
              className={!ownerId && !isPreview ? "group-hover:opacity-50 transition-opacity" : ""}
            />
            {!ownerId && !isPreview && (
              <text 
                x={c * spacing + padding + spacing/2} 
                y={r * spacing + padding + 1} 
                textAnchor="middle" 
                dominantBaseline="central" 
                fill="white" 
                opacity="0.9" 
                fontSize="18" 
                fontWeight="bold" 
                className="pointer-events-none drop-shadow-md">
                {lineCounter}
              </text>
            )}
          </g>
        );
        lineCounter++;
      }
    }

    for (let r = 0; r < gridSize - 1; r++) {
      for (let c = 0; c < gridSize; c++) {
        const key = `v-${r}-${c}`;
        const ownerId = lines[key];
        const isPreview = previewLine?.key === key;
        
        let color = "#cbd5e1";
        if (ownerId) {
            const ownerTeam = teams.find(g => g.id === ownerId);
            color = ownerTeam ? ownerTeam.color : "#cbd5e1";
        } else if (isPreview && currentTeam) {
            color = currentTeam.color;
        }

        const opacity = ownerId ? 1 : isPreview ? 0.6 : 0.2;

        elements.push(
          <g key={`gv-${r}-${c}`} onClick={() => handleLineClick('v', r, c)} className="cursor-pointer group">
            <rect x={c * spacing + padding - 20} y={r * spacing + padding} width={40} height={spacing} fill="transparent" />
            <rect 
              x={c * spacing + padding - lineThickness/2} 
              y={r * spacing + padding} 
              width={lineThickness} 
              height={spacing} 
              fill={color} 
              opacity={opacity}
              rx={lineThickness/2}
              className={!ownerId && !isPreview ? "group-hover:opacity-50 transition-opacity" : ""}
            />
            {!ownerId && !isPreview && (
              <text 
                x={c * spacing + padding} 
                y={r * spacing + padding + spacing/2 + 2} 
                textAnchor="middle" 
                dominantBaseline="central" 
                fill="white" 
                opacity="0.9" 
                fontSize="18" 
                fontWeight="bold" 
                className="pointer-events-none drop-shadow-md">
                {lineCounter}
              </text>
            )}
          </g>
        );
        lineCounter++;
      }
    }

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        elements.push(
          <circle 
            key={`dot-${r}-${c}`} 
            cx={c * spacing + padding} 
            cy={r * spacing + padding} 
            r="10" 
            fill="white" 
            className="pointer-events-none drop-shadow-md"
          />
        );
      }
    }

    return elements;
  };

  const svgSize = (gridSize - 1) * 100 + 80;

  return (
    <div dir="rtl" className="h-screen w-full bg-[#1A1A2E] text-white font-sans flex flex-col md:flex-row overflow-hidden relative">
      
      <style>{`
        @keyframes boxFillAnim {
          0% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0.8; transform: scale(1); }
        }
      `}</style>

      <div className="absolute inset-0 bg-gradient-to-br from-[#1A1A2E] via-[#16213E] to-[#0F3460] opacity-90 pointer-events-none" />

      <div className="w-full md:w-[420px] lg:w-[480px] shrink-0 bg-slate-900/80 backdrop-blur-2xl border-l border-white/5 p-6 flex flex-col z-20 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-y-auto">
        
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg">
              <LayoutGrid size={28} className="text-white" />
            </div>
            <h1 className="text-3xl font-black tracking-wide text-white">קווים וריבועים</h1>
          </div>
          <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all">
            <Settings size={22} />
          </button>
        </div>

        <div className="flex gap-4 mb-4 shrink-0 overflow-x-auto pb-2">
          {teams.length === 0 && <p className="text-center w-full text-slate-500 text-sm">ממתין לנתונים...</p>}
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
                <span className="text-sm font-bold text-center mb-1 z-10 break-all">{grp.name}</span>
                <span className="text-4xl font-black z-10 drop-shadow-md">{scores[grp.id] || 0}</span>
              </div>
            );
          })}
        </div>

        <div className="flex-1 min-h-[380px] shrink-0 bg-black/20 rounded-3xl border border-white/5 p-5 relative overflow-hidden flex flex-col mt-2">
          
          {gameState === 'WAITING_START' && (
            <div className="h-full flex flex-col items-center justify-center gap-6 animate-in fade-in duration-700">
              <div className="w-24 h-24 rounded-full bg-indigo-500/10 flex items-center justify-center">
                <Gamepad2 size={48} className="text-indigo-400" />
              </div>
              <p className="text-lg text-slate-300 text-center font-medium px-4">
                {isLoadingData ? 'מתחבר למסד הנתונים ומושך נתונים...' : `הלוח מוכן עם ${questions.length} שאלות ו-${students.length} תלמידים פעילים.`}
              </p>
              <button 
                onClick={startGame}
                disabled={isLoadingData}
                className={`mt-4 w-full py-4 rounded-xl font-black text-xl flex items-center justify-center gap-3 transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)]
                  ${isLoadingData ? 'bg-slate-700 text-slate-400 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:scale-105 text-white'}`}
              >
                {isLoadingData ? <RefreshCcw className="animate-spin" size={24} /> : <Play fill="currentColor" size={24} />} 
                {isLoadingData ? 'טוען...' : 'התחל משחק'}
              </button>
            </div>
          )}

          {gameState === 'WAITING_LINE' && currentTeam && (
            <div className="h-full flex flex-col items-center justify-center gap-8 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center">
                <h3 className="text-2xl font-black mb-2" style={{ color: currentTeam.color }}>תור {currentTeam.name}</h3>
                <p className="text-slate-300 text-lg">לחצו על מספר הקו בלוח שתרצו לתפוס.</p>
              </div>
              
              <div className={`p-8 rounded-full border-4 border-dashed transition-all duration-500 ${previewLine ? 'border-transparent' : 'border-slate-600 animate-pulse'}`}
                   style={previewLine ? { backgroundColor: currentTeam.color } : {}}>
                <LayoutGrid size={64} className={previewLine ? 'text-white drop-shadow-md' : 'text-slate-600'} />
              </div>

              <button 
                onClick={handleConfirmLine}
                disabled={!previewLine}
                className={`w-full py-4 rounded-xl font-bold text-xl flex items-center justify-center gap-3 transition-all duration-300
                  ${previewLine 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:scale-105 hover:shadow-[0_0_20px_rgba(245,158,11,0.5)] text-white cursor-pointer' 
                    : 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5'}`}
              >
                <CheckCircle2 size={24} /> 
                {previewLine && (checkIfBoxWillComplete(previewLine.dir, previewLine.r, previewLine.c, lines) || questionOnEveryLine) 
                  ? 'אשר קו והגרל תלמידים' 
                  : 'אשר קו וסיים תור'}
              </button>
            </div>
          )}

          {gameState === 'QUESTION' && currentQuestion && (
            <div className="h-full flex flex-col animate-in fade-in zoom-in-95 duration-500">
              
              <div className="bg-purple-900/40 border border-purple-500/30 rounded-2xl p-4 mb-3 text-center shadow-inner">
                <p className="text-xs text-purple-300 font-bold mb-1">🎯 התלמידים שנבחרו לענות:</p>
                <p className="text-xl font-black text-yellow-300 tracking-wide drop-shadow-sm">
                  {selectedStudents.length > 0 
                    ? selectedStudents.map(s => s.name).join(' ⚔️ ') 
                    : 'טוען תלמיד...'}
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

      <div className="flex-1 min-w-0 h-full flex items-center justify-center p-4 md:p-12 relative z-10">
        
        <div className="w-full h-full max-h-[85vh] flex items-center justify-center p-4">
           <svg viewBox={`0 0 ${svgSize} ${svgSize}`} className="w-full h-full max-w-2xl drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-4 border-slate-700/50 bg-[#0F3460]/40 rounded-2xl overflow-visible">
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
                
                <h2 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-amber-500 mb-6 drop-shadow-lg">ניצחון!</h2>
                <p className="text-5xl font-black mb-4 tracking-wide" style={{ color: getWinner().color }}>{getWinner().name}</p>
                <p className="text-2xl text-slate-300 mb-12 font-medium">סגרו את רוב הריבועים בלוח וניצחו!</p>
                
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
              <h2 className="text-2xl font-bold flex items-center gap-2"><Settings className="text-indigo-400"/> הגדרות משחק</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><X size={20}/></button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="flex justify-between text-lg mb-2">
                  <span>גודל לוח (נקודות)</span>
                  <span className="font-bold text-indigo-400">{gridSize}x{gridSize}</span>
                </label>
                <input type="range" min="4" max="10" step="1" value={gridSize} onChange={(e) => setGridSize(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
              </div>
              
              <div>
                <label className="flex justify-between text-lg mb-2">
                  <span>זמן לשאלה (שניות)</span>
                  <span className="font-bold text-indigo-400">{timerDuration}</span>
                </label>
                <input type="range" min="10" max="60" step="5" value={timerDuration} onChange={(e) => setTimerDuration(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <input type="checkbox" id="chkQuestion" checked={questionOnEveryLine} onChange={(e) => setQuestionOnEveryLine(e.target.checked)} className="w-5 h-5 cursor-pointer accent-indigo-500" />
                <label htmlFor="chkQuestion" className="text-lg cursor-pointer select-none">דרוש שאלה על כל קו בלוח</label>
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