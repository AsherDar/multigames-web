import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Play, CheckCircle2, XCircle, RefreshCcw, Timer, Eye, Target, X, RotateCcw, AlertTriangle, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const EMOJI_POOL = [
  '🐶','🐱','🐭','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦆','🦉','🦇','🐺','🐴','🐝','🐛','🦋','🐌','🐞','🐜','🐢','🐍','🦖','🐙','🦑','🦀','🐡','🐠','🐬','🐳','🦈','🐊','🐅','🦓','🦍','🐘','🦏','🐫','🦒','🦘','🐎','🐏','🐐','🦌','🐕','🐈','🐓','🦚','🦜','🦢','🦩','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶','🌽','🥕','🧄','🧅','🥔','🍠','🥐','🍞','🥖','🥨','🧀','🥚','🍳','🥞','🧇','🥓','🥩','🍗','🍔','🌭','🥪','🍟','🍕','🌮','🌯','🥙','🧆','🥗','🍿','🧈','🧂','🥫','🍱','🍙','🍚','🍛','🍜','🍝','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🦞','🦐','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍼','🥛','☕','🍵','🍶','🍾','🍷','🍸','🍹','🍺','🍻','🥂','🥃','🥤','🧃','🧉','🧊','🥢','🍽','🍴','🥄','🔪','🏺'
];

// נקודות עוגן פזורות על הקלף כדי שהסמלים לא יסתירו אחד את השני לחלוטין
const GRID_POSITIONS = [
  {x: 20, y: 20}, {x: 50, y: 15}, {x: 80, y: 20},
  {x: 22, y: 45}, {x: 78, y: 45}, {x: 50, y: 50},
  {x: 20, y: 80}, {x: 50, y: 85}, {x: 80, y: 80},
  {x: 35, y: 30}, {x: 65, y: 30},
  {x: 35, y: 70}, {x: 65, y: 70}
];

export default function SpotMatchGame({ onBackToMenu, selectedBank, session }) {
  const [itemsPerCard, setItemsPerCard] = useState(8);
  const [maxScore, setMaxScore] = useState(10);
  const [timerDuration, setTimerDuration] = useState(30);
  
  // WAITING_START, FIND_MATCH, SELECT_TEAM, QUESTION, GAME_OVER
  const [gameState, setGameState] = useState('WAITING_START'); 
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(true); 
  const [isFlipping, setIsFlipping] = useState(false);
  
  const [cardA, setCardA] = useState([]);
  const [cardB, setCardB] = useState([]);
  const [targetSymbol, setTargetSymbol] = useState(null);

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

      const { data: qData } = await supabase.from('questions').select('*').eq('topic_id', selectedBank).eq('teacher_id', session.user.id);
      setQuestions(qData || []);

      const { data: sData } = await supabase.from('students').select('*').eq('teacher_id', session.user.id).eq('is_playing', true);
      const activeStudents = sData || [];
      setStudents(activeStudents);

      const uniqueTeamNames = [...new Set(activeStudents.map(s => s.team || 'קבוצה כללית'))];
      const beautifulColors = ["#E94560", "#FFD700", "#00BCD4", "#40FF5A", "#7B2CBF", "#F15BB5"];
      
      const dynamicTeams = uniqueTeamNames.map((name, index) => ({
        id: name, name: name, color: beautifulColors[index % beautifulColors.length]
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

  const shuffleArray = (array) => {
    let shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const generateNewCards = useCallback(() => {
    const shuffledPool = shuffleArray(EMOJI_POOL);
    const target = shuffledPool.pop(); 
    
    const itemsA = [target];
    const itemsB = [target];

    for(let i = 0; i < itemsPerCard - 1; i++) {
      itemsA.push(shuffledPool.pop());
      itemsB.push(shuffledPool.pop());
    }

    const shuffledA = shuffleArray(itemsA);
    const shuffledB = shuffleArray(itemsB);
    
    const positionsA = shuffleArray(GRID_POSITIONS).slice(0, itemsPerCard);
    const positionsB = shuffleArray(GRID_POSITIONS).slice(0, itemsPerCard);

    // מספור בלתי תלוי (1 עד כמה שיש בכל קלף)
    const formatItem = (emoji, index, positions) => ({
      emoji,
      number: index + 1,
      rotation: Math.random() * 360,
      size: Math.floor(Math.random() * 20) + 35,
      x: positions[index].x + (Math.random() * 8 - 4),
      y: positions[index].y + (Math.random() * 8 - 4),
    });

    setCardA(shuffledA.map((emoji, idx) => formatItem(emoji, idx, positionsA)));
    setCardB(shuffledB.map((emoji, idx) => formatItem(emoji, idx, positionsB)));
    setTargetSymbol(target);
  }, [itemsPerCard]);

  const flipAndGenerate = () => {
    setIsFlipping(true); 
    setTimeout(() => {
      generateNewCards(); 
      setIsFlipping(false); 
    }, 300);
  };

  const startGame = () => {
    if (teams.length === 0) { alert("לא נמצאו תלמידים פעילים!"); return; }
    
    const freshScores = {};
    teams.forEach(t => freshScores[t.id] = 0);
    setScores(freshScores);
    
    flipAndGenerate();
    setGameState('FIND_MATCH');
  };

  const handleSymbolClick = (emoji) => {
    if (gameState !== 'FIND_MATCH') return;
    
    if (emoji === targetSymbol) {
      setGameState('SELECT_TEAM');
    }
  };

  const handleTeamSelection = (teamIndex) => {
    setCurrentTeamIndex(teamIndex);
    loadQuestion(teams[teamIndex]);
  };

  const loadQuestion = (selectedTeam) => {
    if (questions.length === 0) { alert("אין שאלות במאגר!"); return; }

    const teamStudents = students.filter(s => (s.team || 'קבוצה כללית') === selectedTeam.id);
    let currentPool = studentPools[selectedTeam.id] || [];

    if (currentPool.length < 2) currentPool = teamStudents.map(s => s.id);

    let chosenIds = [];
    const poolCopy = [...currentPool];
    
    for (let i = 0; i < 2; i++) {
      if (poolCopy.length === 0) break;
      const randomIndex = Math.floor(Math.random() * poolCopy.length);
      chosenIds.push(poolCopy.splice(randomIndex, 1)[0]);
    }

    setSelectedStudents(teamStudents.filter(s => chosenIds.includes(s.id)));
    setStudentPools(prev => ({ ...prev, [selectedTeam.id]: poolCopy }));

    const randomQ = questions[Math.floor(Math.random() * questions.length)];
    setCurrentQuestion({ q: randomQ.question_text, a: randomQ.answer });
    
    setTimeLeft(timerDuration);
    setShowSolution(false);
    setGameState('QUESTION');
  };

  const handleAnswer = (isCorrect) => {
    if (isCorrect) {
      const newScore = (scores[currentTeam.id] || 0) + 1;
      setScores(prev => ({ ...prev, [currentTeam.id]: newScore }));
      
      if (newScore >= maxScore) {
        setGameState('GAME_OVER');
        return;
      }
    }
    
    flipAndGenerate();
    setGameState('FIND_MATCH');
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

  const getWinner = () => {
    let winner = currentTeam;
    teams.forEach(t => { if(scores[t.id] >= maxScore) winner = t; });
    return winner || { name: 'אין מנצח', color: '#fff' };
  };

  return (
    <div dir="rtl" className="h-screen w-full bg-[#001F3F] text-white font-sans flex flex-col md:flex-row overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1A1A2E] via-[#16213E] to-[#0F3460] opacity-80 pointer-events-none" />

      {/* פאנל שליטה */}
      <div className="w-full md:w-[420px] lg:w-[480px] shrink-0 bg-slate-900/80 backdrop-blur-2xl border-l border-white/5 p-6 flex flex-col z-20 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-lg">
              <Eye size={28} className="text-white" />
            </div>
            <h1 className="text-3xl font-black tracking-wide text-white">מצא את ההתאמה</h1>
          </div>
          <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all">
            <Settings size={22} />
          </button>
        </div>

        {/* תצוגת הקבוצות */}
        <div className="flex flex-col gap-4 mb-4 shrink-0 overflow-y-auto pb-2 max-h-[40vh]">
          {teams.length === 0 && <p className="text-center w-full text-slate-500 text-sm">ממתין לטעינת נתונים...</p>}
          {teams.map((grp, index) => {
            const isActive = currentTeamIndex === index && gameState === 'QUESTION';
            const score = scores[grp.id] || 0;
            return (
              <div 
                key={grp.id} 
                className={`relative rounded-2xl p-4 flex flex-col justify-center border-2 transition-all duration-500 overflow-hidden
                  ${isActive ? 'border-white/50 scale-105' : 'border-white/5 bg-black/40 scale-100'}`}
                style={{ backgroundColor: isActive ? grp.color : 'rgba(0,0,0,0.4)' }}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-lg font-bold text-white drop-shadow-md">{grp.name}</span>
                  <span className="text-2xl font-black text-white drop-shadow-md">{score}/{maxScore}</span>
                </div>
                
                <div className="flex flex-wrap gap-1.5 justify-end" dir="ltr">
                  {Array.from({length: maxScore}).map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-6 h-6 md:w-8 md:h-8 rounded-md transition-all duration-500 ${i < score ? 'shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'bg-transparent'}`}
                      style={{ 
                        backgroundColor: i < score ? grp.color : 'transparent',
                        border: `2px solid ${i < score ? 'transparent' : 'rgba(255,255,255,0.2)'}`
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex-1 min-h-[250px] shrink-0 bg-black/20 rounded-3xl border border-white/5 p-5 relative overflow-y-auto flex flex-col mt-4">
          
          {gameState === 'WAITING_START' && (
            <div className="h-full flex flex-col items-center justify-center gap-6 animate-in fade-in duration-700">
              <div className="w-24 h-24 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Target size={48} className="text-purple-400" />
              </div>
              <p className="text-lg text-slate-300 text-center font-medium px-4">
                {isLoadingData ? 'מושך נתונים...' : `מוכן עם ${questions.length} שאלות. מצאו את הסמל המשותף ומלאו את ריבועי הניצחון!`}
              </p>
              <button 
                onClick={startGame} disabled={isLoadingData}
                className="mt-4 w-full py-4 rounded-xl font-black text-xl flex items-center justify-center gap-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:scale-105 text-white transition-all"
              >
                {isLoadingData ? <RefreshCcw className="animate-spin" size={24} /> : <Play fill="currentColor" size={24} />} 
                {isLoadingData ? 'טוען...' : 'התחל משחק'}
              </button>
            </div>
          )}

          {gameState === 'FIND_MATCH' && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4 animate-in fade-in duration-500">
              <Eye size={64} className="text-slate-500 animate-pulse mb-2" />
              <h3 className="text-3xl font-black text-white">איזה מספר מופיע פעמיים?</h3>
              <p className="text-slate-300 text-lg">צעקו את שני המספרים של הסמל המשותף!</p>
            </div>
          )}

          {gameState === 'QUESTION' && currentQuestion && (
            <div className="h-full flex flex-col animate-in fade-in zoom-in-95 duration-500">
              <div className="bg-purple-900/40 border border-purple-500/30 rounded-2xl p-4 mb-3 text-center shadow-inner">
                <p className="text-xs text-purple-300 font-bold mb-1">🎯 התלמידים שנבחרו לענות:</p>
                <p className="text-xl font-black text-yellow-300 tracking-wide">
                  {selectedStudents.length > 0 ? selectedStudents.map(s => s.name).join(' ⚔️ ') : 'טוען תלמיד...'}
                </p>
              </div>

              <div className="shrink-0 flex items-center justify-between bg-slate-900/80 rounded-2xl p-4 mb-3 border border-white/10 shadow-inner">
                <div className="flex items-center gap-2 text-slate-400"><Timer size={20} /><span className="font-medium text-lg">זמן נותר:</span></div>
                <span className={`text-4xl font-black tabular-nums transition-colors duration-300 ${timeLeft <= 5 ? 'text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.8)]' : 'text-white'}`}>
                  {timeLeft > 0 ? `00:${timeLeft.toString().padStart(2, '0')}` : 'זמנך תם!'}
                </span>
              </div>

              <div className="w-full min-h-[120px] bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-400/30 rounded-2xl p-4 flex items-center justify-center shadow-lg mb-3">
                <p className="text-lg md:text-xl font-bold text-white text-center leading-snug break-words">{currentQuestion.q}</p>
              </div>

              <div className={`shrink-0 h-[70px] rounded-2xl flex items-center justify-center p-3 mb-3 transition-all duration-500 border-2 ${showSolution ? 'bg-amber-500/20 border-amber-500/50' : 'bg-transparent border-transparent'}`}>
                {showSolution && <p className="text-xl font-black text-amber-400 text-center animate-in slide-in-from-bottom-2">פתרון: {currentQuestion.a}</p>}
              </div>

              <div className="shrink-0 grid grid-cols-2 gap-3 mt-auto">
                <button onClick={() => handleAnswer(true)} className="py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-lg flex items-center justify-center gap-2 transition-all">
                  <CheckCircle2 /> תשובה נכונה
                </button>
                <button onClick={() => handleAnswer(false)} className="py-4 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-lg flex items-center justify-center gap-2 transition-all">
                  <XCircle /> תשובה שגויה
                </button>
                <button onClick={() => setShowSolution(true)} disabled={showSolution} className="py-3 rounded-xl bg-purple-600/80 hover:bg-purple-500 disabled:opacity-30 font-bold transition-colors">
                  הצג פתרון
                </button>
                <button onClick={() => {flipAndGenerate(); setGameState('FIND_MATCH');}} className="py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold transition-colors flex items-center justify-center gap-2">
                  <RefreshCcw size={18} /> בטל והגרל לוח
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* אזור הלוחות */}
      <div className="flex-1 min-w-0 h-full flex flex-col items-center justify-center p-4 md:p-8 relative z-10 overflow-y-auto">
        {(gameState === 'FIND_MATCH' || gameState === 'SELECT_TEAM' || gameState === 'QUESTION') && (
           <div className="flex flex-col xl:flex-row gap-8 xl:gap-16 items-center justify-center w-full max-w-6xl animate-in zoom-in-95 duration-500">
             
             {/* קלף א' מונפש */}
             <div className={`w-[300px] h-[300px] md:w-[450px] md:h-[450px] bg-white rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-8 border-slate-200 relative overflow-hidden transition-all duration-300 transform ${isFlipping ? 'scale-x-0 opacity-50' : 'scale-x-100 opacity-100'}`}>
                <div className="absolute inset-0 opacity-5 pointer-events-none" style={{backgroundImage: 'radial-gradient(circle, #000 2px, transparent 2px)', backgroundSize: '20px 20px'}}></div>
                <div className="w-full h-full relative z-10">
                  {cardA.map((item, idx) => (
                    <div 
                      key={`a-${idx}`} 
                      className="absolute flex items-center justify-center p-2 transition-transform duration-200 hover:z-30 hover:scale-110"
                      style={{ left: `${item.x}%`, top: `${item.y}%`, transform: 'translate(-50%, -50%)' }}
                    >
                      <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-sm font-black w-7 h-7 flex items-center justify-center rounded-full shadow-md z-20 border-2 border-white pointer-events-none">
                        {item.number}
                      </span>
                      <button 
                        onClick={() => handleSymbolClick(item.emoji)}
                        className="leading-none m-0 p-0 drop-shadow-md"
                        style={{ fontSize: `${item.size}px`, transform: `rotate(${item.rotation}deg)`, cursor: gameState === 'FIND_MATCH' ? 'pointer' : 'default', lineHeight: 1 }}
                      >
                        {item.emoji}
                      </button>
                    </div>
                  ))}
                </div>
             </div>

             {/* קלף ב' מונפש */}
             <div className={`w-[300px] h-[300px] md:w-[450px] md:h-[450px] bg-white rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-8 border-slate-200 relative overflow-hidden transition-all duration-300 transform ${isFlipping ? 'scale-x-0 opacity-50 delay-75' : 'scale-x-100 opacity-100 delay-75'}`}>
                <div className="absolute inset-0 opacity-5 pointer-events-none" style={{backgroundImage: 'radial-gradient(circle, #000 2px, transparent 2px)', backgroundSize: '20px 20px'}}></div>
                <div className="w-full h-full relative z-10">
                  {cardB.map((item, idx) => (
                    <div 
                      key={`b-${idx}`} 
                      className="absolute flex items-center justify-center p-2 transition-transform duration-200 hover:z-30 hover:scale-110"
                      style={{ left: `${item.x}%`, top: `${item.y}%`, transform: 'translate(-50%, -50%)' }}
                    >
                      <span className="absolute -top-2 -right-2 bg-pink-600 text-white text-sm font-black w-7 h-7 flex items-center justify-center rounded-full shadow-md z-20 border-2 border-white pointer-events-none">
                        {item.number}
                      </span>
                      <button 
                        onClick={() => handleSymbolClick(item.emoji)}
                        className="leading-none m-0 p-0 drop-shadow-md"
                        style={{ fontSize: `${item.size}px`, transform: `rotate(${item.rotation}deg)`, cursor: gameState === 'FIND_MATCH' ? 'pointer' : 'default', lineHeight: 1 }}
                      >
                        {item.emoji}
                      </button>
                    </div>
                  ))}
                </div>
             </div>

           </div>
        )}

        {/* חלון בחירת קבוצה צף */}
        {gameState === 'SELECT_TEAM' && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-900 border border-purple-500/30 rounded-3xl p-8 max-w-2xl w-full mx-4 shadow-2xl text-center">
              <Trophy size={64} className="text-yellow-400 mx-auto mb-4 animate-bounce" />
              <h2 className="text-3xl font-black mb-8 text-white">מעולה! איזו קבוצה צעקה נכון?</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {teams.map((t, index) => (
                  <button 
                    key={t.id}
                    onClick={() => handleTeamSelection(index)}
                    className="py-6 rounded-2xl font-black text-xl text-white transition-transform hover:scale-105 active:scale-95"
                    style={{ backgroundColor: t.color, boxShadow: `0 8px 0 ${t.color}88` }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* מסך ניצחון */}
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md overflow-hidden">
            <div className="absolute inset-0" style={{ backgroundColor: `${getWinner().color}20` }} />
            
            {[...Array(50)].map((_, i) => (
              <div key={i} className="absolute animate-bounce" style={{
                left: `${Math.random() * 100}%`, top: `-10%`, animationDuration: `${2 + Math.random() * 2}s`, animationDelay: `${Math.random() * 2}s`,
                backgroundColor: getWinner().color, width: '16px', height: '16px', borderRadius: '50%'
              }} />
            ))}

            <div className="relative animate-[spin_10s_linear_infinite] p-1.5 rounded-[42px]" style={{ background: `linear-gradient(45deg, ${getWinner().color}, transparent, ${getWinner().color})` }}>
              <div className="bg-slate-900/90 border border-white/10 rounded-[40px] p-16 flex flex-col items-center shadow-2xl animate-in zoom-in-75 duration-700" style={{ boxShadow: `0 0 100px ${getWinner().color}88` }}>
                <Trophy size={120} color="#FFD700" className="relative drop-shadow-[0_0_20px_rgba(255,215,0,1)] animate-bounce mb-8" />
                <h2 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-amber-500 mb-6 drop-shadow-lg">ניצחון!</h2>
                <p className="text-5xl font-black mb-4 tracking-wide" style={{ color: getWinner().color }}>{getWinner().name}</p>
                <p className="text-2xl text-slate-300 mb-12 font-medium">מילאו את כל הריבועים והוכיחו חדות עין!</p>
                
                <button onClick={() => { startGame(); setGameState('WAITING_START'); }} className="px-12 py-5 rounded-full font-black text-2xl bg-gradient-to-r from-purple-500 to-pink-600 hover:scale-110 transition-transform shadow-[0_0_30px_rgba(168,85,247,0.5)] text-white">
                  התחל משחק חדש
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
              <h2 className="text-2xl font-bold flex items-center gap-2"><Settings className="text-purple-400"/> הגדרות משחק</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10"><X size={20}/></button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="flex justify-between text-lg mb-2"><span>כמות ריבועים לניצחון</span><span className="font-bold text-purple-400">{maxScore}</span></label>
                <input type="range" min="5" max="20" step="1" value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg cursor-pointer" />
              </div>
              <div>
                <label className="flex justify-between text-lg mb-2"><span>סמלים בכל קלף</span><span className="font-bold text-purple-400">{itemsPerCard}</span></label>
                <input type="range" min="4" max="12" step="1" value={itemsPerCard} onChange={(e) => setItemsPerCard(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg cursor-pointer" />
              </div>
              <div>
                <label className="flex justify-between text-lg mb-2"><span>זמן לשאלה (שניות)</span><span className="font-bold text-purple-400">{timerDuration}</span></label>
                <input type="range" min="10" max="60" step="5" value={timerDuration} onChange={(e) => setTimerDuration(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg cursor-pointer" />
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-white/10 flex flex-col gap-3">
              <button onClick={handleResetGame} className="w-full py-4 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-600/30 hover:bg-rose-600 hover:text-white font-bold flex items-center justify-center gap-2 transition-all">
                <RotateCcw size={20} /> שמור ואפס לוח
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