import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Settings, Play, CheckCircle2, XCircle, RefreshCcw, HelpCircle, ArrowRight, Trophy, Gamepad2, Timer, Sparkles, Hexagon, X, RotateCcw, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function HexGame({ onBackToMenu, selectedBank, session }) {
  // === State - ניהול מצב משחק ===
  const [gridSize, setGridSize] = useState(6);
  const [timerDuration, setTimerDuration] = useState(30);
  const [gameState, setGameState] = useState('WAITING_START'); 
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [hexes, setHexes] = useState({}); 
  const [previewHex, setPreviewHex] = useState(null); 
  const [timeLeft, setTimeLeft] = useState(30);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [showSolution, setShowSolution] = useState(false);
  const [winningPath, setWinningPath] = useState([]);
  
  const [showSettings, setShowSettings] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null });

  // === State - נתונים מ-Supabase ===
  const [questions, setQuestions] = useState([]); 
  const [students, setStudents] = useState([]);
  const [teams, setTeams] = useState([]); 
  const [scores, setScores] = useState({});
  const [studentPools, setStudentPools] = useState({}); 
  const [selectedStudents, setSelectedStudents] = useState([]); 

  const currentTeam = teams[currentTeamIndex];

  // === משיכת נתונים ראשונית ===
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
      
      const dynamicTeams = teamNamesToUse.map((name, index) => ({
        internalId: index + 1, // 1 או 2
        id: name,
        name: name,
        color: index === 0 ? "#E94560" : "#00BCD4", // הצבעים המקוריים שלך
        goal: index === 0 ? "לחבר עליון ותחתון" : "לחבר ימין ושמאל",
        glow: index === 0 ? "rgba(233, 69, 96, 0.6)" : "rgba(0, 188, 212, 0.6)"
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

  // === טיימר ===
  useEffect(() => {
    let timer;
    if (gameState === 'QUESTION' && timeLeft > 0 && !showSolution) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && gameState === 'QUESTION') {
      setShowSolution(true); 
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft, showSolution]);

  // === מתמטיקה של משושים (Hex Math המקורית שלך) ===
  const hexRadius = 28;
  const hexWidth = Math.sqrt(3) * hexRadius;
  const hexHeight = 2 * hexRadius;

  const getHexCenter = useCallback((r, c) => {
    const x = (c + r * 0.5) * hexWidth;
    const y = r * (hexHeight * 0.75);
    return { x, y };
  }, [hexWidth, hexHeight]);

  const getHexVert = useCallback((r, c, vIndex) => {
    const { x, y } = getHexCenter(r, c);
    const angle_deg = 60 * vIndex - 30;
    const angle_rad = Math.PI / 180 * angle_deg;
    return { x: x + hexRadius * Math.cos(angle_rad), y: y + hexRadius * Math.sin(angle_rad) };
  }, [getHexCenter, hexRadius]);

  const getHexPointsString = useCallback((r, c) => {
    let points = [];
    for (let i = 0; i < 6; i++) {
      const v = getHexVert(r, c, i);
      points.push(`${v.x},${v.y}`);
    }
    return points.join(" ");
  }, [getHexVert]);

  // חישוב Bounding Box מושלם כדי שה-SVG יהיה ממורכז תמיד בלי חיתוכים (מקורי שלך)
  const svgViewBox = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        for (let i = 0; i < 6; i++) {
          const v = getHexVert(r, c, i);
          if (v.x < minX) minX = v.x;
          if (v.y < minY) minY = v.y;
          if (v.x > maxX) maxX = v.x;
          if (v.y > maxY) maxY = v.y;
        }
      }
    }
    return `${minX - 20} ${minY - 20} ${maxX - minX + 40} ${maxY - minY + 40}`;
  }, [gridSize, getHexVert]);

  // === לוגיקת משחק ===
  const startGame = () => {
    if (teams.length < 2) {
      alert("משחק הקס דורש בדיוק 2 קבוצות פעילות! אנא חלק את התלמידים ל-2 קבוצות בפאנל הניהול.");
      return;
    }
    setHexes({});
    setWinningPath([]);
    
    const freshScores = {};
    const freshPools = {};
    teams.forEach(t => {
      freshScores[t.id] = 0;
      freshPools[t.id] = students.filter(s => (s.team || 'קבוצה כללית') === t.id).map(s => s.id);
    });
    setScores(freshScores);
    setStudentPools(freshPools);

    setGameState('WAITING_HEX');
    setPreviewHex(null);
    setCurrentTeamIndex(Math.floor(Math.random() * teams.length));
  };

  const nextTurn = () => {
    if (teams.length === 0) return;
    setCurrentTeamIndex(prev => (prev + 1) % teams.length);
    setGameState('WAITING_HEX');
    setPreviewHex(null);
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

    const q = questions[Math.floor(Math.random() * questions.length)];
    setCurrentQuestion({ q: q.question_text, a: q.answer });
    
    setTimeLeft(timerDuration);
    setShowSolution(false);
    setGameState('QUESTION');
  };

  const handleHexClick = (r, c) => {
    if (gameState !== 'WAITING_HEX') return;
    const key = `${r},${c}`;
    if (hexes[key]) return; 
    setPreviewHex({ r, c });
  };

  const checkWin = useCallback((currentHexes, teamInfo) => {
    const isTopBottom = teamInfo.internalId === 1; // קבוצה 1 מנסה לחבר עליון לתחתון
    const queue = [];
    const cameFrom = new Map();
    const visited = new Set();

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const key = `${r},${c}`;
        if (currentHexes[key] === teamInfo.internalId) {
          if (isTopBottom && r === 0) {
            queue.push({ r, c, key });
            visited.add(key);
          } else if (!isTopBottom && c === 0) {
            queue.push({ r, c, key });
            visited.add(key);
          }
        }
      }
    }

    const directions = [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, -1], [1, 0]];

    while (queue.length > 0) {
      const current = queue.shift();

      if (isTopBottom && current.r === gridSize - 1) return reconstructPath(cameFrom, current);
      if (!isTopBottom && current.c === gridSize - 1) return reconstructPath(cameFrom, current);

      for (const [dr, dc] of directions) {
        const nr = current.r + dr;
        const nc = current.c + dc;
        const nKey = `${nr},${nc}`;

        if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize) {
          if (currentHexes[nKey] === teamInfo.internalId && !visited.has(nKey)) {
            visited.add(nKey);
            cameFrom.set(nKey, current);
            queue.push({ r: nr, c: nc, key: nKey });
          }
        }
      }
    }
    return null;
  }, [gridSize]);

  const reconstructPath = (cameFrom, current) => {
    const path = [current.key];
    let curr = current;
    while (cameFrom.has(curr.key)) {
      curr = cameFrom.get(curr.key);
      path.push(curr.key);
    }
    return path;
  };

  const handleAnswer = (isCorrect) => {
    if (isCorrect && previewHex && currentTeam) {
      const key = `${previewHex.r},${previewHex.c}`;
      const newHexes = { ...hexes, [key]: currentTeam.internalId };
      setHexes(newHexes);
      
      setScores(prev => ({ ...prev, [currentTeam.id]: (prev[currentTeam.id] || 0) + 1 }));

      const path = checkWin(newHexes, currentTeam);
      if (path) {
        setWinningPath(path);
        setGameState('GAME_OVER');
        return;
      }
    }
    nextTurn();
  };

  // פעולת איפוס עם חלונית אישור מעוצבת
  const handleResetGame = () => {
    setConfirmDialog({
      isOpen: true,
      message: "האם אתה בטוח שברצונך לאפס את הלוח ולהתחיל משחק חדש?",
      onConfirm: () => {
        setHexes({});
        setGameState('WAITING_START');
        setPreviewHex(null);
        setWinningPath([]);
        setShowSettings(false);
        setConfirmDialog({ isOpen: false, message: '', onConfirm: null });
      }
    });
  };

  // פעולת חזרה לתפריט ראשי עם חלונית אישור מעוצבת
  const handleBackToMenu = () => {
    setConfirmDialog({
      isOpen: true,
      message: "האם אתה בטוח שברצונך לצאת ולחזור לתפריט הראשי? המשחק לא יישמר.",
      onConfirm: () => {
        if (onBackToMenu) onBackToMenu();
        setConfirmDialog({ isOpen: false, message: '', onConfirm: null });
      }
    });
  };

  // === ציור הלוח והמשושים (מקורי שלך) ===
  const renderBorders = () => {
    if (teams.length < 2) return null; // הגנה אם אין קבוצות עדיין
    
    const topPoly = [];
    topPoly.push(getHexVert(0, 0, 4));
    for (let c = 0; c < gridSize; c++) {
      topPoly.push(getHexVert(0, c, 5));
      topPoly.push(getHexVert(0, c, 0));
    }

    const bottomPoly = [];
    bottomPoly.push(getHexVert(gridSize - 1, 0, 3));
    for (let c = 0; c < gridSize; c++) {
      bottomPoly.push(getHexVert(gridSize - 1, c, 2));
      bottomPoly.push(getHexVert(gridSize - 1, c, 1));
    }

    const leftPoly = [];
    leftPoly.push(getHexVert(0, 0, 4));
    for (let r = 0; r < gridSize; r++) {
      leftPoly.push(getHexVert(r, 0, 3));
      if (r < gridSize - 1) leftPoly.push(getHexVert(r, 0, 2));
    }

    const rightPoly = [];
    rightPoly.push(getHexVert(0, gridSize - 1, 0));
    for (let r = 0; r < gridSize; r++) {
      rightPoly.push(getHexVert(r, gridSize - 1, 1));
      if (r < gridSize - 1) rightPoly.push(getHexVert(r + 1, gridSize - 1, 0));
    }

    const toSvgPoints = (arr) => arr.map(p => `${p.x},${p.y}`).join(" ");

    return (
      <g strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" fill="none">
        <polyline points={toSvgPoints(topPoly)} stroke={teams[0].color} className="drop-shadow-[0_0_8px_rgba(233,69,96,0.8)]" />
        <polyline points={toSvgPoints(bottomPoly)} stroke={teams[0].color} className="drop-shadow-[0_0_8px_rgba(233,69,96,0.8)]" />
        <polyline points={toSvgPoints(leftPoly)} stroke={teams[1].color} className="drop-shadow-[0_0_8px_rgba(0,188,212,0.8)]" />
        <polyline points={toSvgPoints(rightPoly)} stroke={teams[1].color} className="drop-shadow-[0_0_8px_rgba(0,188,212,0.8)]" />
      </g>
    );
  };

  const renderHexagons = () => {
    const polygons = [];
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const key = `${r},${c}`;
        const isCaptured = hexes[key] !== undefined;
        const owner = isCaptured ? teams.find(t => t.internalId === hexes[key]) : null;
        const isPreview = previewHex?.r === r && previewHex?.c === c;
        const isWinning = winningPath.includes(key);
        const { x, y } = getHexCenter(r, c);

        let fillColor = "#16213E"; 
        let strokeColor = "#2c3e50";
        let strokeWidth = 2;

        if (isWinning && owner) {
          fillColor = owner.color;
          strokeColor = "#FFD700"; 
          strokeWidth = 4;
        } else if (isCaptured && owner) {
          fillColor = owner.color;
          strokeColor = owner.color;
        } else if (isPreview && currentTeam) {
          fillColor = currentTeam.color;
          strokeColor = currentTeam.color;
        }

        polygons.push(
          <g key={key} onClick={() => handleHexClick(r, c)} className="cursor-pointer group">
            <defs>
              <radialGradient id={`grad-${key}`}>
                <stop offset="0%" stopColor={isCaptured && owner ? owner.color : "#1e293b"} stopOpacity="0.9" />
                <stop offset="100%" stopColor={isCaptured && owner ? owner.color : "#0f172a"} stopOpacity="1" />
              </radialGradient>
            </defs>
            <polygon 
              points={getHexPointsString(r, c)}
              fill={`url(#grad-${key})`}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              className={`
                transition-all duration-300 ease-in-out origin-center
                ${!isCaptured && gameState === 'WAITING_HEX' ? 'hover:fill-slate-700' : ''}
                ${isPreview ? 'opacity-80 scale-[1.02]' : 'opacity-100'}
                ${isWinning ? 'animate-pulse scale-[1.05]' : ''}
              `}
              style={isWinning ? { filter: `drop-shadow(0 0 15px #FFD700)` } : {}}
            />
            <text 
              x={x} y={y + 6} 
              textAnchor="middle" 
              fill={isCaptured || isPreview || isWinning ? "white" : "#475569"} 
              fontSize={14} 
              fontWeight="900"
              className="pointer-events-none transition-colors duration-300"
            >
              {(r * gridSize) + c + 1}
            </text>
          </g>
        );
      }
    }
    return polygons;
  };

  return (
    <div dir="rtl" className="h-screen w-full bg-[#070b19] text-white font-sans flex flex-col md:flex-row overflow-hidden relative">
      
      {/* הילות רקע עמוקות */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-rose-600/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[700px] h-[700px] rounded-full bg-cyan-600/10 blur-[180px] pointer-events-none" />

      {/* =========================================================================
          פאנל שליטה ימני - מוגדר ברוחב קבוע
         ========================================================================= */}
      <div className="w-full md:w-[420px] lg:w-[480px] shrink-0 bg-slate-900/80 backdrop-blur-2xl border-l border-white/5 p-6 flex flex-col z-20 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-y-auto">
        
        {/* כותרת עליונה */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-lg">
              <Hexagon size={28} className="text-white" />
            </div>
            <h1 className="text-3xl font-black tracking-wide text-white">כיבוש הקס</h1>
          </div>
          <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all">
            <Settings size={22} />
          </button>
        </div>

        {/* תצוגת קבוצות וניקוד */}
        <div className="flex gap-4 mb-6 shrink-0">
          {teams.length < 2 && <p className="text-center w-full text-rose-400 text-sm font-bold">המשחק דורש 2 קבוצות פעילות!</p>}
          {teams.map((grp, index) => {
            const isActive = currentTeamIndex === index && gameState !== 'WAITING_START' && gameState !== 'GAME_OVER';
            return (
              <div 
                key={grp.id} 
                className={`relative flex-1 rounded-2xl p-4 flex flex-col items-center justify-center border-2 transition-all duration-500 overflow-hidden
                  ${isActive ? 'border-white/50 scale-105' : 'border-white/5 bg-black/40 scale-100'}`}
                style={{ backgroundColor: isActive ? grp.color : '' }}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-white/20 animate-pulse pointer-events-none" />
                )}
                <span className="text-sm font-bold text-center mb-1 z-10">{grp.name}</span>
                <span className="text-xs text-white/70 mb-2 z-10 font-medium tracking-wide">{grp.goal}</span>
                <span className="text-4xl font-black z-10 drop-shadow-md">{scores[grp.id] || 0}</span>
              </div>
            );
          })}
        </div>

        {/* קופסת הלוגיקה */}
        <div className="flex-1 min-h-[420px] shrink-0 bg-black/20 rounded-3xl border border-white/5 p-5 relative overflow-hidden flex flex-col">
          
          {gameState === 'WAITING_START' && (
            <div className="h-full flex flex-col items-center justify-center gap-6 animate-in fade-in duration-700">
              <div className="w-24 h-24 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Gamepad2 size={48} className="text-blue-400" />
              </div>
              <p className="text-lg text-slate-300 text-center font-medium px-4">
                {isLoadingData ? 'מתחבר למסד הנתונים ומושך נתונים...' : `הלוח מוכן עם ${questions.length} שאלות ו-${students.length} תלמידים פעילים.`}
              </p>
              <button 
                onClick={startGame}
                disabled={isLoadingData || teams.length < 2}
                className={`mt-4 w-full py-4 rounded-xl font-black text-xl flex items-center justify-center gap-3 transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)]
                  ${(isLoadingData || teams.length < 2) ? 'bg-slate-700 text-slate-400 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-105 text-white'}`}
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
                <p className="text-slate-300 text-lg">סמנו משושה אסטרטגי על הלוח.</p>
              </div>
              
              <div className={`p-8 rounded-full border-4 border-dashed transition-all duration-500 ${previewHex ? 'border-transparent' : 'border-slate-600 animate-pulse'}`}>
                <Hexagon size={64} className={previewHex ? 'text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]' : 'text-slate-600'} />
              </div>

              <button 
                onClick={loadQuestion}
                disabled={!previewHex}
                className={`w-full py-4 rounded-xl font-bold text-xl flex items-center justify-center gap-3 transition-all duration-300
                  ${previewHex 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:scale-105 hover:shadow-[0_0_20px_rgba(245,158,11,0.5)] text-white cursor-pointer' 
                    : 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5'}`}
              >
                <HelpCircle size={24} /> אשר מיקום והצג שאלה
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

              <div className="flex-1 overflow-y-auto bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-400/30 rounded-2xl p-3 md:p-4 flex flex-col justify-center shadow-lg mb-3">
                <p className="text-base sm:text-lg font-semibold text-blue-50 text-center leading-snug break-words">
                  {currentQuestion.q}
                </p>
              </div>

              <div className={`shrink-0 h-[70px] rounded-2xl flex items-center justify-center p-3 mb-3 transition-all duration-500 border-2 
                  ${showSolution ? 'bg-amber-500/20 border-amber-500/50' : 'bg-transparent border-transparent'}`}>
                {showSolution && (
                  <p className="text-lg font-black text-amber-400 text-center animate-in slide-in-from-bottom-2">
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

        {/* כפתורי יציאה תחתונים */}
        <div className="mt-auto pt-6 border-t border-white/10 shrink-0">
          <button onClick={handleBackToMenu} className="w-full py-4 rounded-xl bg-red-950/40 text-red-400 hover:bg-red-600 hover:text-white border border-red-500/20 font-bold transition-all flex items-center justify-center gap-2">
            <span>חזור לתפריט הראשי</span> <ArrowRight size={18} />
          </button>
        </div>

      </div>

      {/* =========================================================================
          אזור הלוח (Main Board) - נשאר 100% נאמן לעיצוב שלך
         ========================================================================= */}
      <div className="flex-1 min-w-0 h-full flex items-center justify-center p-4 md:p-12 relative z-10">
        
        {/* קונטיינר ה-SVG המקורי */}
        <div className="w-full h-full max-h-[85vh] flex items-center justify-center">
           <svg viewBox={svgViewBox} className="w-full h-full drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-visible">
             {/* ציור קווי הגבול המדויקים */}
             {renderBorders()}
             {/* ציור המשושים */}
             {renderHexagons()}
           </svg>
        </div>

        {/* מסך ניצחון מרהיב (Overlay) */}
        {gameState === 'GAME_OVER' && currentTeam && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md overflow-hidden">
            <div className="absolute inset-0" style={{ backgroundColor: `${currentTeam.color}20` }} />
            
            {[...Array(40)].map((_, i) => (
              <div key={i} className="absolute animate-bounce" style={{
                left: `${Math.random() * 100}%`, top: `-10%`,
                animationDuration: `${2 + Math.random() * 2}s`,
                animationDelay: `${Math.random() * 2}s`,
                backgroundColor: currentTeam.color, width: '12px', height: '12px', borderRadius: '50%'
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
                <p className="text-2xl text-slate-300 mb-12 font-medium">יצרו רצף מנצח וכבשו את הלוח!</p>
                
                <button 
                  onClick={() => {
                    setHexes({}); setGameState('WAITING_START'); setWinningPath([]); 
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

      {/* תפריט הגדרות קופץ (Modal) */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-[400px] shadow-2xl">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/10">
              <h2 className="text-2xl font-bold flex items-center gap-2"><Settings className="text-blue-400"/> הגדרות משחק</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><X size={20}/></button>
            </div>
            
            <div className="space-y-8">
              <div>
                <label className="flex justify-between text-lg mb-2">
                  <span>גודל לוח משושים</span>
                  <span className="font-bold text-blue-400">{gridSize}x{gridSize}</span>
                </label>
                <input type="range" min="3" max="10" value={gridSize} onChange={(e) => setGridSize(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
              </div>
              
              <div>
                <label className="flex justify-between text-lg mb-2">
                  <span>זמן לשאלה (שניות)</span>
                  <span className="font-bold text-blue-400">{timerDuration}</span>
                </label>
                <input type="range" min="10" max="60" step="5" value={timerDuration} onChange={(e) => setTimerDuration(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-white/10">
              <button onClick={handleResetGame} className="w-full py-4 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-600/30 hover:bg-rose-600 hover:text-white font-bold flex items-center justify-center gap-2 transition-all">
                <RotateCcw size={20} /> אפס לוח לחלוטין
              </button>
            </div>
          </div>
        </div>
      )}

      {/* תפריט התראה מותאם אישית (Custom Confirm Modal) */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-8 w-[400px] shadow-2xl text-center">
            <AlertTriangle size={64} className="text-rose-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold mb-8 leading-relaxed text-white">{confirmDialog.message}</h2>
            <div className="flex gap-4">
              <button 
                onClick={() => confirmDialog.onConfirm()} 
                className="flex-1 py-4 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-lg transition-all shadow-[0_0_15px_rgba(225,29,72,0.4)] text-white"
              >
                כן, אני בטוח
              </button>
              <button 
                onClick={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: null })} 
                className="flex-1 py-4 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-lg transition-all text-white"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}