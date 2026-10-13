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

interface WeeklyReportDay {
  date: string;
  label: string;
  completed: number;
  expected: number;
}

const getToday = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const getDateDaysAgo = (daysAgo: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const createMathQuestions = (routineId: string, date: string, difficulty: Routine["math_difficulty"], operations: string[], count: number): MathQuestion[] => {
  let seed = Array.from(`${routineId}-${date}`).reduce((total, character) => total + character.charCodeAt(0), 0);
  const next = (max: number) => {
    seed = (seed * 9301 + 49297) % 233280;
    return Math.floor((seed / 233280) * max) + 1;
  };

  const defaultsByDifficulty: Record<Routine["math_difficulty"], string[]> = {
    grade_1: ["addition", "subtraction"],
    grade_2: ["addition", "subtraction", "multiplication", "division", "time"],
    grade_3: ["multiplication", "division", "area", "perimeter", "shapes"],
    grade_4: ["addition", "subtraction", "multiplication", "division"],
    grade_5: ["addition", "subtraction", "multiplication", "division"],
    grade_6: ["addition", "subtraction", "multiplication", "division"],
  };

  const selectedOperations = (operations.length ? operations : defaultsByDifficulty[difficulty]).filter(Boolean);

  const getTimeQuestion = (): MathQuestion => {
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

  const getAreaQuestion = (): MathQuestion => {
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

  const getPerimeterQuestion = (): MathQuestion => {
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

  const getShapeQuestion = (): MathQuestion => {
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

    const multiplicationLimit = difficulty === "grade_2" ? 5 : difficulty === "grade_3" ? 10 : 12;
    const divisionLimit = difficulty === "grade_2" ? 3 : difficulty === "grade_3" ? 5 : 10;

    if (operation === "multiplication") {
      const left = next(multiplicationLimit);
      const right = next(multiplicationLimit);
      return { id: `${routineId}-${index}`, prompt: `${left} x ${right}`, answer: left * right };
    }
    if (operation === "division") {
      const divisor = next(divisionLimit);
      const result = next(difficulty === "grade_2" ? 10 : divisionLimit + 4);
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

export default function ChildChecklistPage() {
  const params = useParams<{ childId: string }>();
  const router = useRouter();
  const childId = params.childId;
  const [child, setChild] = useState<Child | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [mathResults, setMathResults] = useState<Record<string, boolean[]>>({});
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReportDay[]>([]);
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
      const routineIds = (assignments || []).map((assignment) => assignment.routine_id);

      if (routineIds.length === 0) {
        setWeeklyReport(Array.from({ length: 7 }, (_, index) => ({
          date: getDateDaysAgo(6 - index),
          label: new Date(`${getDateDaysAgo(6 - index)}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" }),
          completed: 0,
          expected: 0,
        })));
        setLoading(false);
        return;
      }

      const weekStart = getDateDaysAgo(6);
      const todayDate = getToday();

      const [{ data: routineData, error: routineError }, { data: taskData, error: taskError }, { data: completionData, error: completionError }, { data: mathCompletionData, error: mathCompletionError }] = await Promise.all([
        supabase.from("routines").select("id, name, description, routine_type, math_difficulty, math_operations, math_question_count").in("id", routineIds).eq("is_active", true),
        supabase.from("tasks").select("id, routine_id, title, sort_order").in("routine_id", routineIds).order("sort_order"),
        supabase.from("task_completions").select("assignment_id, task_id, completion_date").gte("completion_date", weekStart).lte("completion_date", todayDate),
        supabase.from("math_completions").select("assignment_id, question_index, is_correct, completion_date").gte("completion_date", weekStart).lte("completion_date", todayDate),
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

      const report = Array.from({ length: 7 }, (_, index) => {
        const date = getDateDaysAgo(6 - index);
        const dateObject = new Date(`${date}T00:00:00`);
        const scheduledAssignments = (assignments || []).filter((assignment) => {
          const starts = assignment.starts_on <= date;
          const ends = !assignment.ends_on || assignment.ends_on >= date;
          return starts && ends && (assignment.days_of_week || []).includes(dateObject.getDay());
        });
        const scheduledIds = new Set(scheduledAssignments.map((assignment) => assignment.id));
        const expected = scheduledAssignments.reduce((total, assignment) => {
          const routine = (routineData || []).find((item) => item.id === assignment.routine_id);
          if (!routine) return total;
          return total + (routine.routine_type === "math"
            ? routine.math_question_count
            : (taskData || []).filter((task) => task.routine_id === routine.id).length);
        }, 0);
        const completedTasksForDay = (completionData || []).filter((completion) => completion.completion_date === date && scheduledIds.has(completion.assignment_id));
        const completedMathForDay = (mathCompletionData || []).filter((completion) => completion.completion_date === date && completion.is_correct && scheduledIds.has(completion.assignment_id));
        return {
          date,
          label: dateObject.toLocaleDateString(undefined, { weekday: "short" }),
          completed: completedTasksForDay.length + completedMathForDay.length,
          expected,
        };
      });
      setWeeklyReport(report);

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
  const perfectWeek = weeklyReport.length === 7 && weeklyReport.every((day) => day.expected > 0 && day.completed >= day.expected);

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

        <section className={`mb-8 rounded-2xl border p-5 shadow-sm sm:p-6 ${perfectWeek ? "border-emerald-300 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
              <div className="flex items-end justify-between gap-4">
                <div>
              <p className={`text-sm font-bold uppercase tracking-[0.18em] ${perfectWeek ? "text-emerald-700" : "text-amber-700"}`}>{perfectWeek ? "Amazing achievement" : "Your week in a glance"}</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">{perfectWeek ? "A perfect week!" : "Seven days of small wins"}</h2>
                </div>
            <span className="text-3xl" aria-hidden="true">{perfectWeek ? "🏆" : "★"}</span>
              </div>
              <div className="mt-5 grid grid-cols-7 gap-2">
                {weeklyReport.map((day) => {
                  const percent = day.expected ? Math.round((day.completed / day.expected) * 100) : 0;
                  const complete = day.expected > 0 && percent === 100;
                  return (
                    <div key={day.date} className="text-center">
                      <div className="flex h-24 flex-col justify-end overflow-hidden rounded-xl bg-white/80 p-1">
                        <div className={`min-h-2 rounded-lg transition-all ${complete ? "bg-emerald-400" : "bg-amber-400"}`} style={{ height: `${Math.max(percent, day.expected ? 10 : 2)}%` }} />
                      </div>
                      <p className="mt-2 text-xs font-black text-slate-700">{day.label}</p>
                      <p className="text-[10px] font-semibold text-slate-500">{day.expected ? `${percent}%` : "—"}</p>
                    </div>
                  );
                })}
              </div>
              {perfectWeek ? (
                <p className="mt-4 text-sm font-black text-emerald-800">Congratulations! You earned 100% every day this week!</p>
              ) : weeklyReport.some((day) => day.completed > 0) ? (
                <p className="mt-4 text-sm font-semibold text-amber-900">You completed {weeklyReport.reduce((total, day) => total + day.completed, 0)} steps this week. Keep your streak going!</p>
              ) : (
                <p className="mt-4 text-sm font-semibold text-amber-900">Your first win of the week is waiting for you.</p>
              )}
        </section>

        {routines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">No routines are scheduled for today.</div>
        ) : (
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
        )}
      </div>
    </main>
  );
}
