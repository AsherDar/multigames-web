import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { ArrowRight, Users, Database, Plus, Trash2, CheckSquare, Square, UploadCloud, FolderPlus, UserPlus } from 'lucide-react';

export default function TeacherDashboard({ session, onBack }) {
  const [activeTab, setActiveTab] = useState('questions'); 
  
  const [topics, setTopics] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [students, setStudents] = useState([]);

  // טפסים
  const [newTopicName, setNewTopicName] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentTeam, setNewStudentTeam] = useState('קבוצה א'); // ברירת מחדל לקבוצה
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newAnswerText, setNewAnswerText] = useState('');

  const teacherId = session.user.id;

  useEffect(() => {
    fetchTopics();
    fetchStudents();
    fetchQuestions();
  }, []);

  const fetchTopics = async () => {
    const { data } = await supabase.from('topics').select('*').eq('teacher_id', teacherId);
    if (data) {
      setTopics(data);
      if (data.length > 0 && !selectedTopicId) setSelectedTopicId(data[0].id);
    }
  };

  const fetchStudents = async () => {
    const { data, error } = await supabase.from('students').select('*').eq('teacher_id', teacherId).order('name');
    if (error) {
      console.error("Error fetching students:", error);
    } else if (data) {
      setStudents(data);
    }
  };

  const fetchQuestions = async () => {
    const { data } = await supabase.from('questions').select('*').eq('teacher_id', teacherId);
    if (data) setQuestions(data);
  };

  // --- פעולות מאגרים (Topics) ---
  const handleAddTopic = async (e) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;
    const { data, error } = await supabase.from('topics').insert([
      { topic_name: newTopicName, teacher_id: teacherId }
    ]).select();
    
    if (error) {
      alert("שגיאה ביצירת מאגר: " + error.message);
    } else if (data) {
      setNewTopicName('');
      fetchTopics();
      setSelectedTopicId(data[0].id);
    }
  };

  const deleteTopic = async (topicId) => {
    if(window.confirm('האם אתה בטוח שברצונך למחוק את המאגר הזה? \nשים לב: כל השאלות שבתוכו יימחקו לצמיתות!')) {
      await supabase.from('questions').delete().eq('topic_id', topicId);
      const { error } = await supabase.from('topics').delete().eq('id', topicId);
      
      if (error) {
        alert("שגיאה במחיקת המאגר: " + error.message);
      } else {
        const { data } = await supabase.from('topics').select('*').eq('teacher_id', teacherId);
        const remainingTopics = data || [];
        setTopics(remainingTopics);
        if (remainingTopics.length > 0) {
          setSelectedTopicId(remainingTopics[0].id);
        } else {
          setSelectedTopicId('');
        }
        fetchQuestions();
      }
    }
  };

  // --- פעולות שאלות (Questions) ---
  const handleAddQuestion = async (e) => {
    e.preventDefault();
    if (!newQuestionText.trim() || !newAnswerText.trim() || !selectedTopicId) return;

    const { error } = await supabase.from('questions').insert([
      { question_text: newQuestionText, answer: newAnswerText, topic_id: selectedTopicId, teacher_id: teacherId }
    ]);

    if (error) {
      alert("שגיאה בשמירת השאלה: " + error.message);
    } else {
      setNewQuestionText('');
      setNewAnswerText('');
      fetchQuestions();
    }
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!selectedTopicId) {
       alert('אנא בחר או צור מאגר תחילה!');
       return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
       const text = event.target.result;
       const lines = text.split('\n');
       const questionsToInsert = [];

       lines.forEach(line => {
          if (!line.trim()) return;
          const parts = line.split(',');
          if (parts.length >= 2) {
             questionsToInsert.push({
                question_text: parts[0].trim(),
                answer: parts[1].trim(),
                topic_id: selectedTopicId,
                teacher_id: teacherId
             });
          }
       });

       if (questionsToInsert.length > 0) {
          const { error } = await supabase.from('questions').insert(questionsToInsert);
          if (!error) {
             alert(`מעולה! יובאו בהצלחה ${questionsToInsert.length} שאלות למאגר.`);
             fetchQuestions();
          } else {
             alert('שגיאה בייבוא הנתונים: ' + error.message);
          }
       }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = ''; 
  };

  const deleteQuestion = async (questionId) => {
    if(window.confirm('למחוק שאלה זו?')) {
      const { error } = await supabase.from('questions').delete().eq('id', questionId);
      if (error) alert("שגיאה במחיקת השאלה: " + error.message);
      else fetchQuestions();
    }
  };

  // --- פעולות תלמידים (עם תמיכה בקבוצות) ---
  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newStudentTeam.trim()) return;
    
    const { error } = await supabase.from('students').insert([
      { name: newStudentName, team: newStudentTeam, teacher_id: teacherId, is_playing: true }
    ]);
    
    if (error) {
      alert("שגיאה בהוספת תלמיד: " + error.message);
    } else {
      setNewStudentName('');
      fetchStudents();
    }
  };

  const handleStudentCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split('\n');
      const studentsToInsert = [];

      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;
        const parts = trimmedLine.split(',');
        if (parts[0].trim()) {
          studentsToInsert.push({
            name: parts[0].trim(),
            team: parts[1] ? parts[1].trim() : 'קבוצה א', // עמודה ב' היא הקבוצה, אם אין - מקבל ברירת מחדל
            teacher_id: teacherId,
            is_playing: true
          });
        }
      });

      if (studentsToInsert.length > 0) {
        const { error } = await supabase.from('students').insert(studentsToInsert);
        if (!error) {
          alert(`מעולה! יובאו בהצלחה ${studentsToInsert.length} תלמידים עם שיוך לקבוצות.`);
          fetchStudents();
        } else {
          alert('שגיאה בייבוא תלמידים: ' + error.message);
        }
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = ''; 
  };

  const toggleStudentStatus = async (studentId, currentStatus) => {
    const { error } = await supabase.from('students').update({ is_playing: !currentStatus }).eq('id', studentId);
    if (error) {
      alert("שגיאה בעדכון סטטוס תלמיד: " + error.message);
    } else {
      fetchStudents();
    }
  };

  const deleteStudent = async (studentId) => {
    if(window.confirm('למחוק תלמיד זה?')) {
      const { error } = await supabase.from('students').delete().eq('id', studentId);
      if (error) {
        alert("שגיאה במחיקת תלמיד: " + error.message);
      } else {
        fetchStudents();
      }
    }
  };

  // מונע בעיות של סוגי נתונים (String מול Int) ומציג שאלות בצורה מדויקת במסננת
  const filteredQuestions = questions.filter(q => String(q.topic_id) === String(selectedTopicId));

  return (
    <div dir="rtl" className="min-h-screen w-full bg-[#0a0a1a] text-white p-6 md:p-12 font-sans flex flex-col">
      {/* כותרת עליונה */}
      <div className="flex justify-between items-center mb-8 bg-slate-900/80 p-6 rounded-3xl border border-white/10 shadow-lg">
        <div>
          <h1 className="text-3xl font-black text-cyan-400 mb-2">פאנל ניהול למורה</h1>
          <p className="text-slate-400">ניהול מערכי השיעור, מאגרי השאלות וקבוצות הכיתה</p>
        </div>
        <button onClick={onBack} className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center gap-2 transition-colors">
          <span>חזור למשחקים</span> <ArrowRight size={20} />
        </button>
      </div>

      {/* לשוניות ניווט */}
      <div className="flex gap-4 mb-8">
        <button onClick={() => setActiveTab('questions')} className={`flex-1 py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-lg transition-all ${activeTab === 'questions' ? 'bg-cyan-600 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)]' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
          <Database size={24} /> מאגרי שאלות
        </button>
        <button onClick={() => setActiveTab('students')} className={`flex-1 py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-lg transition-all ${activeTab === 'students' ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.4)]' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
          <Users size={24} /> רשימת תלמידים וקבוצות
        </button>
      </div>

      {/* לוח תוכן דינמי */}
      <div className="flex-1 bg-slate-900/50 rounded-3xl border border-white/5 p-6 md:p-8">
        
        {/* ----- לשונית 1: ניהול שאלות ומאגרים ----- */}
        {activeTab === 'questions' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              {/* יצירת מאגר */}
              <div className="bg-slate-800/50 p-6 rounded-2xl border border-white/5">
                <h3 className="text-lg font-bold mb-4 text-cyan-300 flex items-center gap-2"><FolderPlus size={20}/> מאגר חדש</h3>
                <form onSubmit={handleAddTopic} className="flex flex-col gap-3">
                  <input type="text" value={newTopicName} onChange={(e) => setNewTopicName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-cyan-400 outline-none" placeholder="שם המאגר (למשל: היסטוריה א)" required />
                  <button type="submit" className="py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl font-bold transition-all">צור מאגר</button>
                </form>
              </div>

              {/* ניהול השאלות בתוך המאגר */}
              <div className="bg-slate-800/50 p-6 rounded-2xl border border-white/5">
                <h3 className="text-lg font-bold mb-4 text-cyan-300">הזנת שאלות</h3>
                <div className="mb-4">
                  <label className="block text-sm text-slate-400 mb-1">לאיזה מאגר?</label>
                  <div className="flex gap-2">
                    <select value={selectedTopicId} onChange={(e) => setSelectedTopicId(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-cyan-400 outline-none">
                      {topics.length === 0 && <option value="">אין מאגרים קיימים</option>}
                      {topics.map(t => <option key={t.id} value={t.id}>{t.topic_name}</option>)}
                    </select>
                    {topics.length > 0 && (
                      <button type="button" onClick={() => deleteTopic(selectedTopicId)} title="מחק את המאגר הנבחר" className="px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-colors flex items-center justify-center">
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* ייבוא CSV לשאלות */}
                <div className="mb-6 bg-cyan-900/20 border border-cyan-500/20 p-4 rounded-xl text-center">
                  <label className="cursor-pointer flex flex-col items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors">
                    <UploadCloud size={30} />
                    <span className="font-bold">ייבוא שאלות מקובץ CSV</span>
                    <span className="text-xs text-slate-400">עמודה א' שאלה, עמודה ב' תשובה</span>
                    <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
                  </label>
                </div>

                <div className="text-center text-slate-500 mb-4 font-bold text-sm">-- או הזנה ידנית --</div>

                <form onSubmit={handleAddQuestion} className="space-y-3">
                  <textarea value={newQuestionText} onChange={(e) => setNewQuestionText(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-cyan-400 outline-none" placeholder="השאלה" rows="2" required />
                  <input type="text" value={newAnswerText} onChange={(e) => setNewAnswerText(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-cyan-400 outline-none" placeholder="התשובה" required />
                  <button type="submit" disabled={!selectedTopicId} className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                    <Plus size={20} /> הוסף שאלה למאגר
                  </button>
                </form>
              </div>
            </div>

            {/* תצוגת השאלות המסוננות */}
            <div className="lg:col-span-2">
              <h3 className="text-xl font-bold mb-6 text-slate-200">השאלות במאגר הנבחר ({filteredQuestions.length})</h3>
              <div className="space-y-3 max-h-[700px] overflow-y-auto pr-2">
                {filteredQuestions.length === 0 ? (
                   <p className="text-slate-500 mt-10 text-center">לא נמצאו שאלות במאגר זה. הוסף שאלות או ייבא קובץ.</p>
                ) : (
                  filteredQuestions.map(q => (
                    <div key={q.id} className="bg-slate-800/80 p-4 rounded-xl border border-white/5 flex justify-between items-center gap-4">
                      <div>
                        <span className="text-xs font-bold text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded-md mb-2 inline-block">
                          {topics.find(t => t.id === q.topic_id)?.topic_name || 'נושא לא ידוע'}
                        </span>
                        <p className="font-medium text-lg">{q.question_text}</p>
                        <p className="text-slate-400 text-sm">תשובה: {q.answer}</p>
                      </div>
                      <button onClick={() => deleteQuestion(q.id)} className="p-3 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ----- לשונית 2: ניהול תלמידים וקבוצות ----- */}
        {activeTab === 'students' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              {/* טופס הוספה ידנית */}
              <div className="bg-slate-800/50 p-6 rounded-2xl border border-white/5 h-fit">
                <h3 className="text-xl font-bold mb-6 text-purple-300 flex items-center gap-2"><UserPlus size={20}/> הוספת תלמיד חדש</h3>
                <form onSubmit={handleAddStudent} className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">שם התלמיד:</label>
                    <input type="text" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-purple-400 outline-none" placeholder="למשל: דוד כהן" required />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">שיוך לקבוצה:</label>
                    <input type="text" value={newStudentTeam} onChange={(e) => setNewStudentTeam(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-purple-400 outline-none" placeholder="למשל: קבוצה א, קבוצה ב, אדומים" required />
                  </div>
                  <button type="submit" className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                    <Plus size={20} /> הוסף לכיתה
                  </button>
                </form>
              </div>

              {/* ייבוא המוני של תלמידים + קבוצות */}
              <div className="bg-slate-800/50 p-6 rounded-2xl border border-white/5 h-fit">
                <h3 className="text-lg font-bold mb-4 text-purple-300">ייבוא המוני</h3>
                <div className="bg-purple-900/20 border border-purple-500/20 p-4 rounded-xl text-center">
                  <label className="cursor-pointer flex flex-col items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors">
                    <UploadCloud size={30} />
                    <span className="font-bold">ייבוא תלמידים מקובץ CSV</span>
                    <span className="text-xs text-slate-400">עמודה א': שם תלמיד, עמודה ב': שם הקבוצה</span>
                    <input type="file" accept=".csv" onChange={handleStudentCSVUpload} className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            {/* רשימת הכיתה */}
            <div className="lg:col-span-2">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-200">רשימת התלמידים והקבוצות ({students.length})</h3>
                <p className="text-sm text-slate-400">לחץ על תלמיד כדי לקבוע אם הוא משחק כרגע בכיתה</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[700px] overflow-y-auto">
                {students.map(student => (
                  <div key={student.id} className={`p-4 rounded-xl border flex items-center justify-between transition-all ${student.is_playing ? 'bg-purple-900/20 border-purple-500/30 shadow-[0_0_15px_rgba(147,51,234,0.05)]' : 'bg-slate-800/50 border-white/5 opacity-50'}`}>
                    <button onClick={() => toggleStudentStatus(student.id, student.is_playing)} className="flex items-center gap-3 flex-1 text-right outline-none">
                      {student.is_playing ? <CheckSquare className="text-purple-400 shrink-0" /> : <Square className="text-slate-500 shrink-0" />}
                      <span className={`font-medium break-all ${student.is_playing ? 'text-white' : 'text-slate-400 line-through'}`}>
                        {student.name}
                        <span className="text-xs text-purple-400 font-bold mr-2 bg-purple-500/10 px-2 py-0.5 rounded-md inline-block">
                          {student.team}
                        </span>
                      </span>
                    </button>
                    <button onClick={() => deleteStudent(student.id)} className="text-slate-500 hover:text-red-400 transition-colors p-1 shrink-0">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}