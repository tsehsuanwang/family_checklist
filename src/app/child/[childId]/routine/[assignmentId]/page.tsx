"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Task { id: string; title: string; sort_order: number; }
interface MathQuestion {
  id: string;
  prompt: string;
  answer: number | string;
  visual?: {
    type: "clock" | "square" | "rectangle" | "triangle" | "shape";
    hour?: number;
    minutes?: number;
    width?: number;
    height?: number;
    side?: number;
    sides?: number;
    name?: string;
  };
}
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

function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null;

  const pieces = Array.from({ length: 18 }, (_, index) => ({
    id: index,
    left: `${(index * 13) % 100}%`,
    delay: `${(index % 6) * 0.08}s`,
    rotate: `${(index % 8) * 45}deg`,
    color: ["#fbbf24", "#f472b6", "#34d399", "#60a5fa", "#fca5a5", "#a78bfa"][index % 6],
  }));

  return (
    <>
      <style>{`
        @keyframes confetti-pop {
          0% { opacity: 0; transform: translate3d(0, 0, 0) scale(0.7) rotate(0deg); }
          12% { opacity: 1; }
          100% { opacity: 0; transform: translate3d(var(--drift-x), -110px, 0) scale(1.1) rotate(var(--spin)); }
        }
        .confetti-piece {
          position: absolute;
          top: 22%;
          width: 10px;
          height: 16px;
          border-radius: 9999px;
          animation: confetti-pop 1.1s ease-out forwards;
          opacity: 0;
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        {pieces.map((piece) => (
          <span
            key={piece.id}
            className="confetti-piece"
            style={{
              left: piece.left,
              background: piece.color,
              animationDelay: piece.delay,
              [  let seed = Array.from(`${routineId}-${date}`).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const next = (max: number) => { seed = (seed * 9301 + 49297) % 233280; return Math.floor((seed / 233280) * max) + 1; };

  const defaultsByDifficulty: Record<RoutineData["math_difficulty"], string[]> = {
    grade_1: ["addition", "subtraction"],
    grade_2: ["addition", "subtraction", "multiplication", "division", "time"],
    grade_3: ["multiplication", "division", "area", "perimeter", "shapes"],
    grade_4: ["addition", "subtraction", "multiplication", "division"],
    grade_5: ["addition", "subtraction", "multiplication", "division"],
    grade_6: ["addition", "subtraction", "multiplication", "division"],
  };

  const selectedOperations = (operations.length ? operations : defaultsByDifficulty[difficulty]).filter(Boolean);

  const getTimeQuestion = () => {
    const minuteSteps = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    const hour = next(12);
    const minutes = minuteSteps[next(minuteSteps.length) - 1];
    const timeString = `${hour}:${String(minutes).padStart(2, "0")}`;
    return {
      id: `${routineId}-${seed}`,
      prompt: `What time does the clock show?`,
      answer: timeString,
      visual: { type: "clock", hour, minutes },
    };
  };

  const getAreaQuestion = () => {
    const isSquare = next(2) === 1;
    if (isSquare) {
      const side = next(difficulty === "grade_3" ? 12 : 9);
      return {
        id: `${routineId}-${seed}`,
        prompt: `A square has side length ${side} cm. What is its area?`,
        answer: side * side,
        visual: { type: "square", side },
      };
    }
    const width = next(difficulty === "grade_3" ? 12 : 9);
    const height = next(difficulty === "grade_3" ? 12 : 9);
    return {
      id: `${routineId}-${seed}`,
      prompt: `A rectangle is ${width} cm long and ${height} cm wide. What is its area?`,
      answer: width * height,
      visual: { type: "rectangle", width, height },
    };
  };

  const getPerimeterQuestion = () => {
    const shape = ["square", "rectangle", "triangle"][next(3) - 1];
    if (shape === "square") {
      const side = next(12);
      return {
        id: `${routineId}-${seed}`,
        prompt: `A square has side length ${side} cm. What is its perimeter?`,
        answer: side * 4,
        visual: { type: "square", side },
      };
    }
    if (shape === "rectangle") {
      const width = next(12);
      const height = next(12);
      return {
        id: `${routineId}-${seed}`,
        prompt: `A rectangle is ${width} cm long and ${height} cm wide. What is its perimeter?`,
        answer: (width * 2) + (height * 2),
        visual: { type: "rectangle", width, height },
      };
    }
    const sideA = next(12);
    const sideB = next(12);
    const sideC = next(12);
    return {
      id: `${routineId}-${seed}`,
      prompt: `A triangle has side lengths ${sideA} cm, ${sideB} cm, and ${sideC} cm. What is its perimeter?`,
      answer: sideA + sideB + sideC,
      visual: { type: "triangle", side: sideA },
    };
  };

  const getShapeQuestion = () => {
    const shapeData = [
      { name: "trapezoid", sides: 4 },
      { name: "parallelogram", sides: 4 },
      { name: "pentagon", sides: 5 },
      { name: "hexagon", sides: 6 },
    ];
    const shape = shapeData[next(shapeData.length) - 1];
    return {
      id: `${routineId}-${seed}`,
      prompt: `A ${shape.name} has how many sides?`,
      answer: shape.sides,
      visual: { type: "shape", name: shape.name, sides: shape.sides },
    };
  };

  return Array.from({ length: count }, (_, index) => {
    const operation = selectedOperations[index % selectedOperations.length];

    if (operation === "time") return getTimeQuestion();
    if (operation === "area") return getAreaQuestion();
    if (operation === "perimeter") return getPerimeterQuestion();
    if (operation === "shapes") return getShapeQuestion();

    const factor = { grade_1: 5, grade_2: 5, grade_3: 10, grade_4: 12, grade_5: 15, grade_6: 20 }[difficulty];

    if (operation === "multiplication") {
      const left = next(factor);
      const right = next(factor);
      return { id: `${routineId}-${index}`, prompt: `${left} x ${right}`, answer: left * right };
    }
    if (operation === "division") {
      const divisor = next(difficulty === "grade_2" ? 3 : difficulty === "grade_3" ? 5 : factor);
      const result = next(difficulty === "grade_2" ? 10 : factor);
      return { id: `${routineId}-${index}`, prompt: `${divisor * result} ÷ ${divisor}`, answer: result };
    }
    const left = next(difficulty === "grade_2" ? 999 : 99);
    const right = next(difficulty === "grade_2" ? 999 : 99);
    if (operation === "subtraction") {
      const larger = Math.max(left, right);
      const smaller = Math.min(left, right);
      return { id: `${routineId}-${index}`, prompt: `${larger} - ${smaller}`, answer: larger - smaller };
    }
    return { id: `${routineId}-${index}`, prompt: `${left} + ${right}`, answer: left + right };
  });
};

const renderMathVisual = (visual?: MathQuestion["visual"]) => {
  if (!visual) return null;

  const commonSvgProps = { width: 88, height: 88, viewBox: "0 0 100 100", className: "h-16 w-16" };

  if (visual.type === "clock") {
    const hourAngle = ((visual.hour ?? 12) / 12) * 360 - 90;
    const minuteAngle = ((visual.minutes ?? 0) / 60) * 360 - 90;
    const hourX = 50 + Math.cos((hourAngle * Math.PI) / 180) * 18;
    const hourY = 50 + Math.sin((hourAngle * Math.PI) / 180) * 18;
    const minuteX = 50 + Math.cos((minuteAngle * Math.PI) / 180) * 30;
    const minuteY = 50 + Math.sin((minuteAngle * Math.PI) / 180) * 30;
    return (
      <svg {...commonSvgProps}>
        <circle cx="50" cy="50" r="38" fill="white" stroke="#cbd5e1" strokeWidth="2" />
        {[...Array(12)].map((_, index) => { const angle = (index / 12) * Math.PI * 2 - Math.PI / 2; const innerX = 50 + Math.cos(angle) * 28; const innerY = 50 + Math.sin(angle) * 28; const outerX = 50 + Math.cos(angle) * 34; const outerY = 50 + Math.sin(angle) * 34; return <line key={index} x1={innerX} y1={innerY} x2={outerX} y2={outerY} stroke="#94a3b8" strokeWidth="2" />; })}
        <line x1="50" y1="50" x2={hourX} y2={hourY} stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
        <line x1="50" y1="50" x2={minuteX} y2={minuteY} stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
        <circle cx="50" cy="50" r="4" fill="#0f172a" />
      </svg>
    );
  }

  if (visual.type === "square") {
    return (
      <svg {...commonSvgProps}>
        <rect x="18" y="18" width="64" height="64" rx="4" fill="#dbeafe" stroke="#2563eb" strokeWidth="3" />
        <text x="50" y="54" textAnchor="middle" fontSize="12" fill="#0f172a" fontWeight="700">{visual.side ?? 0}</text>
      </svg>
    );
  }

  if (visual.type === "rectangle") {
    const width = Math.max(32, (visual.width ?? 4) * 4);
    const height = Math.max(24, (visual.height ?? 3) * 4);
    const x = 50 - width / 2;
    const y = 50 - height / 2;
    return (
      <svg {...commonSvgProps}>
        <rect x={x} y={y} width={width} height={height} rx="4" fill="#dcfce7" stroke="#16a34a" strokeWidth="3" />
        <text x="50" y="54" textAnchor="middle" fontSize="11" fill="#0f172a" fontWeight="700">{visual.width} × {visual.height}</text>
      </svg>
    );
  }

  if (visual.type === "triangle") {
    return (
      <svg {...commonSvgProps}>
        <polygon points="50,16 18,76 82,76" fill="#fef3c7" stroke="#d97706" strokeWidth="3" />
        <text x="50" y="52" textAnchor="middle" fontSize="12" fill="#0f172a" fontWeight="700">△</text>
      </svg>
    );
  }

  const sides = visual.sides ?? 4;
  const points = Array.from({ length: sides }, (_, index) => {
    const angle = (Math.PI * 2 * index) / sides - Math.PI / 2;
    const x = 50 + Math.cos(angle) * 30;
    const y = 50 + Math.sin(angle) * 30;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg {...commonSvgProps}>
      <polygon points={points} fill="#f3e8ff" stroke="#7c3aed" strokeWidth="3" />
      <text x="50" y="54" textAnchor="middle" fontSize="10" fill="#0f172a" fontWeight="700">{visual.name ?? sides}</text>
    </svg>
  );
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
      const [{ data: routineData, error: routineError }, { data: taskData, error: taskError }, { data: completionData, error: completionError }, { data: mathCompletionData, error: mathCompletionError }] = await Promise.all([
        supabase.from("routines").select("id, name, description, routine_type, math_difficulty, math_operations, math_question_count").eq("id", assignment.routine_id).single(),
        supabase.from("tasks").select("id, title, sort_order").eq("routine_id", assignment.routine_id).order("sort_order"),
        supabase.from("task_completions").select("task_id").eq("assignment_id", assignmentId).eq("completion_date", today()),
        supabase.from("math_completions").select("question_index, submitted_answer, is_correct").eq("assignment_id", assignmentId).eq("completion_date", today()).order("question_index"),
      ]);
      if (routineError || taskError || completionError || mathCompletionError || !routineData) { setError(routineError?.message || taskError?.message || completionError?.message || mathCompletionError?.message || "Failed to load routine"); setLoading(false); return; }
      setRoutine(routineData);
      setTasks(taskData || []);
      setCompletedTaskIds((completionData || []).map((item) => item.task_id));
      if (routineData.routine_type === "math") {
        const generatedQuestions = makeQuestions(routineData.id, today(), routineData.math_difficulty, routineData.math_operations, routineData.math_question_count);
        setQuestions(generatedQuestions);
        const savedAnswers = Array(generatedQuestions.length).fill("");
        const savedResults = Array(generatedQuestions.length).fill(false);
        (mathCompletionData || []).forEach((item) => {
          savedAnswers[item.question_index] = item.submitted_answer === null ? "" : String(item.submitted_answer);
          savedResults[item.question_index] = item.is_correct;
        });
        setAnswers(savedAnswers);
        setResults((mathCompletionData || []).length ? savedResults : null);
      }
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

  const checkAnswers = async () => {
    const nextResults = questions.map((question, index) => {
      const raw = answers[index].trim();
      if (typeof question.answer === "string") {
        return raw.replace(/\s+/g, "") === String(question.answer).replace(/\s+/g, "");
      }
      return Number(raw) === Number(question.answer);
    });
    const { error: saveError } = await supabase.from("math_completions").upsert(
      questions.map((question, index) => ({
        assignment_id: assignmentId,
        question_index: index,
        completion_date: today(),
        submitted_answer: answers[index] === "" ? null : String(answers[index]).trim(),
        is_correct: nextResults[index],
      })),
      { onConflict: "assignment_id,question_index,completion_date" },
    );
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setResults(nextResults);
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center"><p>Loading...</p></main>;
  const score = results?.filter(Boolean).length || 0;
  const complete = routine?.routine_type === "math" ? Boolean(results && score === questions.length) : completedTaskIds.length === tasks.length && tasks.length > 0;

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eff6ff,transparent_48%)] px-5 py-6 text-slate-900 sm:px-8">
    <div className="relative mx-auto max-w-2xl">
      <header className="mb-8 flex items-center justify-between"><button onClick={() => router.push(`/child/${childId}`)} className="text-sm font-semibold text-slate-600 underline">Back to routines</button><button onClick={() => router.push("/dashboard")} className="text-sm font-semibold text-slate-600 underline">Profiles</button></header>
      {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <section className="relative mb-6 overflow-hidden rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
        <ConfettiBurst active={complete} />
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">{childName}&apos;s routine</p>
        <div className="mt-2 flex items-center justify-between gap-4"><h1 className="text-4xl font-black text-slate-950">{routine?.name}</h1><span className={`rounded-full px-3 py-1 text-xs font-bold ${complete ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>{complete ? "Complete" : "In progress"}</span></div>
        {routine?.description && <p className="mt-2 text-slate-500">{routine.description}</p>}
        {complete && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">Fantastic job! You completed this routine.</div>}
      </section>
      {routine?.routine_type === "math" ? <section className="space-y-3">{questions.map((question, index) => <label key={question.id} className={`flex items-center gap-3 rounded-xl border-2 bg-white p-4 ${results?.[index] === true ? "border-emerald-200" : results?.[index] === false ? "border-red-200" : "border-slate-200"}`}><div className="flex items-center gap-3">{renderMathVisual(question.visual)}<span className="min-w-24 font-bold">{question.prompt} =</span></div><input inputMode="numeric" value={answers[index] || ""} onChange={(event) => { const next = [...answers]; next[index] = event.target.value; setAnswers(next); }} className="w-24 rounded-lg border-2 border-slate-200 px-3 py-2 text-lg font-bold" />{results?.[index] === true && <span className="ml-auto text-lg font-black text-emerald-600">✓</span>}{results?.[index] === false && <span className="ml-auto text-sm font-bold text-red-600">Try again</span>}</label>)}<button onClick={checkAnswers} className="rounded-lg bg-blue-600 px-5 py-3 font-bold text-white">Check answers</button>{results && <p className="font-semibold">{score} of {questions.length} correct</p>}</section> : <section className="space-y-3">{tasks.map((task) => { const checked = completedTaskIds.includes(task.id); return <label key={task.id} className={`flex items-center gap-3 rounded-xl border-2 bg-white p-4 ${checked ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}`}><input type="checkbox" checked={checked} onChange={() => toggleTask(task.id)} className="h-6 w-6 accent-blue-600" /><span className={checked ? "font-medium text-slate-500 line-through" : "font-semibold"}>{task.title}</span>{checked && <span className="ml-auto text-lg font-black text-emerald-600">✓</span>}</label>; })}</section>}
    </div>
  </main>;
}
