"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Child {
  id: string;
  display_name: string;
}

interface Task {
  id: string;
  title: string;
  sort_order: number;
}

interface Routine {
  id: string;
  name: string;
  description: string | null;
  routine_type: "checklist" | "math";
  math_difficulty: "grade_1" | "grade_2" | "grade_3" | "grade_4" | "grade_5" | "grade_6";
  math_operations: string[];
  math_question_count: number;
  tasks: Task[];
  mathQuestions: MathQuestion[];
  assignmentId: string;
  completedTaskIds: string[];
}

interface MathQuestion {
  id: string;
  prompt: string;
  answer: number;
}

const getToday = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const createMathQuestions = (routineId: string, date: string, difficulty: Routine["math_difficulty"], operations: string[], count: number): MathQuestion[] => {
  let seed = Array.from(`${routineId}-${date}`).reduce((total, character) => total + character.charCodeAt(0), 0);
  const next = (max: number) => {
    seed = (seed * 9301 + 49297) % 233280;
    return Math.floor((seed / 233280) * max) + 1;
  };
  const limits = {
    grade_1: 10,
    grade_2: 20,
    grade_3: 50,
    grade_4: 100,
    grade_5: 500,
    grade_6: 1000,
  };
  const multiplicationLimits = {
    grade_1: 5,
    grade_2: 10,
    grade_3: 10,
    grade_4: 12,
    grade_5: 15,
    grade_6: 20,
  };
  const limit = limits[difficulty];
  const multiplicationLimit = multiplicationLimits[difficulty];

  return Array.from({ length: count }, (_, index) => {
    const operation = operations[index % operations.length];
    if (operation === "multiplication") {
      const left = next(multiplicationLimit);
      const right = next(multiplicationLimit);
      return { id: `${routineId}-${index}`, prompt: `${left} x ${right}`, answer: left * right };
    }
    if (operation === "division") {
      const divisor = next(multiplicationLimit);
      const answer = next(multiplicationLimit);
      return { id: `${routineId}-${index}`, prompt: `${divisor * answer} ÷ ${divisor}`, answer };
    }
    const left = next(limit);
    const right = next(limit);
    if (operation === "subtraction") {
      const larger = Math.max(left, right);
      const smaller = Math.min(left, right);
      return { id: `${routineId}-${index}`, prompt: `${larger} - ${smaller}`, answer: larger - smaller };
    }
    return { id: `${routineId}-${index}`, prompt: `${left} + ${right}`, answer: left + right };
  });
};

export default function ChildChecklistPage() {
  const params = useParams<{ childId: string }>();
  const router = useRouter();
  const childId = params.childId;
  const [child, setChild] = useState<Child | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [mathResults, setMathResults] = useState<Record<string, boolean[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadChecklist = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/auth/login");
        return;
      }

      const { data: childData, error: childError } = await supabase
        .from("children")
        .select("id, display_name")
        .eq("id", childId)
        .single();

      if (childError || !childData) {
        setError(childError?.message || "Child profile not found");
        setLoading(false);
        return;
      }
      setChild(childData);

      const { data: assignments, error: assignmentError } = await supabase
        .from("routine_assignments")
        .select("id, routine_id, starts_on, ends_on, days_of_week, sort_order")
        .eq("child_id", childId)
        .eq("is_active", true)
        .order("sort_order");

      if (assignmentError) {
        setError(assignmentError.message);
        setLoading(false);
        return;
      }

      const today = getToday();
      const dayOfWeek = new Date(`${today}T00:00:00`).getDay();
      const activeAssignments = (assignments || []).filter((assignment) => {
        const starts = assignment.starts_on <= today;
        const ends = !assignment.ends_on || assignment.ends_on >= today;
        const scheduledToday = (assignment.days_of_week || []).includes(dayOfWeek);
        return starts && ends && scheduledToday;
      });
      const routineIds = activeAssignments.map((assignment) => assignment.routine_id);

      if (routineIds.length === 0) {
        setLoading(false);
        return;
      }

      const [{ data: routineData, error: routineError }, { data: taskData, error: taskError }, { data: completionData, error: completionError }, { data: mathCompletionData, error: mathCompletionError }] = await Promise.all([
        supabase.from("routines").select("id, name, description, routine_type, math_difficulty, math_operations, math_question_count").in("id", routineIds).eq("is_active", true),
        supabase.from("tasks").select("id, routine_id, title, sort_order").in("routine_id", routineIds).order("sort_order"),
        supabase.from("task_completions").select("assignment_id, task_id").eq("completion_date", today),
        supabase.from("math_completions").select("assignment_id, question_index, is_correct").eq("completion_date", today),
      ]);

      if (routineError || taskError || completionError || mathCompletionError) {
        setError(routineError?.message || taskError?.message || completionError?.message || mathCompletionError?.message || "Failed to load checklist");
        setLoading(false);
        return;
      }

      const loadedMathResults: Record<string, boolean[]> = {};
      (mathCompletionData || []).forEach((completion) => {
        const results = loadedMathResults[completion.assignment_id] || [];
        results[completion.question_index] = completion.is_correct;
        loadedMathResults[completion.assignment_id] = results;
      });
      setMathResults(loadedMathResults);

      setRoutines(activeAssignments.flatMap((assignment) => {
        const routine = (routineData || []).find((item) => item.id === assignment.routine_id);
        if (!routine) return [];
        return [{
          ...routine,
          tasks: (taskData || []).filter((task) => task.routine_id === routine.id),
          mathQuestions: routine.routine_type === "math"
            ? createMathQuestions(routine.id, today, routine.math_difficulty, routine.math_operations, routine.math_question_count)
            : [],
          assignmentId: assignment.id,
          completedTaskIds: (completionData || [])
            .filter((completion) => completion.assignment_id === assignment.id)
            .map((completion) => completion.task_id),
        }];
      }));
      setLoading(false);
    };

    loadChecklist();
  }, [childId, router]);

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-slate-900"><p>Loading...</p></main>;
  }

  const totalTasks = routines.reduce((total, routine) => total + (routine.routine_type === "math" ? routine.mathQuestions.length : routine.tasks.length), 0);
  const completedTasks = routines.reduce((total, routine) => total + (routine.routine_type === "math" ? (mathResults[routine.assignmentId] || []).filter(Boolean).length : routine.completedTaskIds.length), 0);
  const overallProgress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const getMathProgress = (routine: Routine) => {
    const results = mathResults[routine.assignmentId] || [];
    return routine.mathQuestions.length ? Math.round((results.filter(Boolean).length / routine.mathQuestions.length) * 100) : 0;
  };

  const getRoutineProgress = (routine: Routine) => routine.routine_type === "math"
    ? getMathProgress(routine)
    : routine.tasks.length ? Math.round((routine.completedTaskIds.length / routine.tasks.length) * 100) : 0;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eff6ff,transparent_48%)] px-5 py-6 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 flex items-center justify-between">
          <button onClick={() => router.push("/dashboard")} className="text-sm font-semibold text-slate-600 underline">Back to profiles</button>
          <button onClick={() => router.push("/routines")} className="text-sm font-semibold text-slate-600 underline">Edit routines</button>
        </header>

        <section className="mb-8 rounded-2xl border border-blue-100 bg-white/80 p-5 shadow-sm backdrop-blur sm:p-7">
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-blue-600">Today&apos;s rhythm</p>
          <h1 className="text-4xl font-black tracking-tight text-slate-950">{child?.display_name}</h1>
          <div className="mt-5 flex items-end justify-between gap-4">
            <p className="text-slate-600">{completedTasks} of {totalTasks} steps complete</p>
            <span className="text-3xl font-black text-blue-600">{overallProgress}%</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${overallProgress}%` }} /></div>
        </section>

        {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {routines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">No routines are scheduled for today.</div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {routines.map((routine) => {
                const progress = getRoutineProgress(routine);
                const itemCount = routine.routine_type === "math" ? routine.mathQuestions.length : routine.tasks.length;
                const isComplete = progress === 100 && itemCount > 0;
                return <button
                  key={routine.assignmentId}
                  type="button"
                  onClick={() => router.push(`/child/${childId}/routine/${routine.assignmentId}`)}
                  className={`rounded-2xl border-2 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${isComplete ? "border-emerald-200 bg-emerald-50" : "border-white bg-white"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xl font-black text-slate-950">{routine.name}</span>
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 text-sm font-black ${isComplete ? "border-emerald-400 text-emerald-600" : "border-blue-200 text-blue-600"}`}>{isComplete ? "✓" : `${progress}%`}</span>
                  </div>
                  {routine.description && <p className="mt-2 line-clamp-2 text-sm text-slate-500">{routine.description}</p>}
                  <div className="mt-5 flex items-center justify-between text-xs font-bold uppercase tracking-wide">
                    <span className={isComplete ? "text-emerald-600" : "text-slate-500"}>{isComplete ? "Complete" : progress ? "In progress" : "Ready to start"}</span>
                    <span className="text-slate-400">{routine.routine_type === "math" ? `${(mathResults[routine.assignmentId] || []).filter(Boolean).length}/${routine.mathQuestions.length} correct` : `${routine.completedTaskIds.length}/${routine.tasks.length} steps`}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full transition-all ${isComplete ? "bg-emerald-500" : "bg-blue-600"}`} style={{ width: `${progress}%` }} /></div>
                </button>;
              })}
            </div>

          </>
        )}
      </div>
    </main>
  );
}
