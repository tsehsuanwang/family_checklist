"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Task { id: string; title: string; sort_order: number; }
interface MathQuestion { id: string; prompt: string; answer: number; }
interface RoutineData {
  id: string;
  name: string;
  description: string | null;
  routine_type: "checklist" | "math";
  math_difficulty: "grade_1" | "grade_2" | "grade_3" | "grade_4" | "grade_5" | "grade_6";
  math_operations: string[];
  math_question_count: number;
}

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const makeQuestions = (routineId: string, date: string, difficulty: RoutineData["math_difficulty"], operations: string[], count: number): MathQuestion[] => {
  let seed = Array.from(`${routineId}-${date}`).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const next = (max: number) => { seed = (seed * 9301 + 49297) % 233280; return Math.floor((seed / 233280) * max) + 1; };
  const limits = { grade_1: 10, grade_2: 20, grade_3: 50, grade_4: 100, grade_5: 500, grade_6: 1000 };
  const factors = { grade_1: 5, grade_2: 10, grade_3: 10, grade_4: 12, grade_5: 15, grade_6: 20 };
  const limit = limits[difficulty];
  const factor = factors[difficulty];
  return Array.from({ length: count }, (_, index) => {
    const operation = operations[index % operations.length];
    if (operation === "multiplication") { const left = next(factor); const right = next(factor); return { id: `${routineId}-${index}`, prompt: `${left} x ${right}`, answer: left * right }; }
    if (operation === "division") { const divisor = next(factor); const answer = next(factor); return { id: `${routineId}-${index}`, prompt: `${divisor * answer} ÷ ${divisor}`, answer }; }
    const left = next(limit); const right = next(limit);
    if (operation === "subtraction") { const larger = Math.max(left, right); const smaller = Math.min(left, right); return { id: `${routineId}-${index}`, prompt: `${larger} - ${smaller}`, answer: larger - smaller }; }
    return { id: `${routineId}-${index}`, prompt: `${left} + ${right}`, answer: left + right };
  });
};

export default function RoutineDetailPage() {
  const { childId, assignmentId } = useParams<{ childId: string; assignmentId: string }>();
  const router = useRouter();
  const [childName, setChildName] = useState("");
  const [routine, setRoutine] = useState<RoutineData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [questions, setQuestions] = useState<MathQuestion[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [results, setResults] = useState<boolean[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) { router.push("/auth/login"); return; }
      const [{ data: child }, { data: assignment, error: assignmentError }] = await Promise.all([
        supabase.from("children").select("display_name").eq("id", childId).single(),
        supabase.from("routine_assignments").select("routine_id").eq("id", assignmentId).eq("child_id", childId).single(),
      ]);
      if (assignmentError || !assignment) { setError(assignmentError?.message || "Routine assignment not found"); setLoading(false); return; }
      setChildName(child?.display_name || "");
      const [{ data: routineData, error: routineError }, { data: taskData, error: taskError }, { data: completionData, error: completionError }] = await Promise.all([
        supabase.from("routines").select("id, name, description, routine_type, math_difficulty, math_operations, math_question_count").eq("id", assignment.routine_id).single(),
        supabase.from("tasks").select("id, title, sort_order").eq("routine_id", assignment.routine_id).order("sort_order"),
        supabase.from("task_completions").select("task_id").eq("assignment_id", assignmentId).eq("completion_date", today()),
      ]);
      if (routineError || taskError || completionError || !routineData) { setError(routineError?.message || taskError?.message || completionError?.message || "Failed to load routine"); setLoading(false); return; }
      setRoutine(routineData);
      setTasks(taskData || []);
      setCompletedTaskIds((completionData || []).map((item) => item.task_id));
      if (routineData.routine_type === "math") setQuestions(makeQuestions(routineData.id, today(), routineData.math_difficulty, routineData.math_operations, routineData.math_question_count));
      setLoading(false);
    };
    load();
  }, [assignmentId, childId, router]);

  const toggleTask = async (taskId: string) => {
    const completed = completedTaskIds.includes(taskId);
    const result = completed
      ? await supabase.from("task_completions").delete().eq("assignment_id", assignmentId).eq("task_id", taskId).eq("completion_date", today())
      : await supabase.from("task_completions").insert({ assignment_id: assignmentId, task_id: taskId, completion_date: today() });
    if (result.error) { setError(result.error.message); return; }
    setCompletedTaskIds(completed ? completedTaskIds.filter((id) => id !== taskId) : [...completedTaskIds, taskId]);
  };

  const checkAnswers = () => setResults(questions.map((question, index) => Number(answers[index]) === question.answer));

  if (loading) return <main className="flex min-h-screen items-center justify-center"><p>Loading...</p></main>;
  const score = results?.filter(Boolean).length || 0;
  const complete = routine?.routine_type === "math" ? Boolean(results && score === questions.length) : completedTaskIds.length === tasks.length && tasks.length > 0;

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eff6ff,transparent_48%)] px-5 py-6 text-slate-900 sm:px-8">
    <div className="mx-auto max-w-2xl">
      <header className="mb-8 flex items-center justify-between"><button onClick={() => router.push(`/child/${childId}`)} className="text-sm font-semibold text-slate-600 underline">Back to routines</button><button onClick={() => router.push("/dashboard")} className="text-sm font-semibold text-slate-600 underline">Profiles</button></header>
      {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <section className="mb-6 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"><p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">{childName}&apos;s routine</p><div className="mt-2 flex items-center justify-between gap-4"><h1 className="text-4xl font-black text-slate-950">{routine?.name}</h1><span className={`rounded-full px-3 py-1 text-xs font-bold ${complete ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>{complete ? "Complete" : "In progress"}</span></div>{routine?.description && <p className="mt-2 text-slate-500">{routine.description}</p>}</section>
      {routine?.routine_type === "math" ? <section className="space-y-3">{questions.map((question, index) => <label key={question.id} className={`flex items-center gap-3 rounded-xl border-2 bg-white p-4 ${results?.[index] === true ? "border-emerald-200" : results?.[index] === false ? "border-red-200" : "border-slate-200"}`}><span className="min-w-24 font-bold">{question.prompt} =</span><input inputMode="numeric" value={answers[index] || ""} onChange={(event) => { const next = [...answers]; next[index] = event.target.value; setAnswers(next); }} className="w-24 rounded-lg border-2 border-slate-200 px-3 py-2 text-lg font-bold" />{results?.[index] === true && <span className="ml-auto text-lg font-black text-emerald-600">✓</span>}{results?.[index] === false && <span className="ml-auto text-sm font-bold text-red-600">Try again</span>}</label>)}<button onClick={checkAnswers} className="rounded-lg bg-blue-600 px-5 py-3 font-bold text-white">Check answers</button>{results && <p className="font-semibold">{score} of {questions.length} correct</p>}</section> : <section className="space-y-3">{tasks.map((task) => { const checked = completedTaskIds.includes(task.id); return <label key={task.id} className={`flex items-center gap-3 rounded-xl border-2 bg-white p-4 ${checked ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}`}><input type="checkbox" checked={checked} onChange={() => toggleTask(task.id)} className="h-6 w-6 accent-blue-600" /><span className={checked ? "font-medium text-slate-500 line-through" : "font-semibold"}>{task.title}</span>{checked && <span className="ml-auto text-lg font-black text-emerald-600">✓</span>}</label>; })}</section>}
    </div>
  </main>;
}
