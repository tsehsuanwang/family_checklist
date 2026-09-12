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
  tasks: Task[];
  assignmentId: string;
  completedTaskIds: string[];
}

const getToday = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

export default function ChildChecklistPage() {
  const params = useParams<{ childId: string }>();
  const router = useRouter();
  const childId = params.childId;
  const [child, setChild] = useState<Child | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
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

      const [{ data: routineData, error: routineError }, { data: taskData, error: taskError }, { data: completionData, error: completionError }] = await Promise.all([
        supabase.from("routines").select("id, name, description").in("id", routineIds).eq("is_active", true),
        supabase.from("tasks").select("id, routine_id, title, sort_order").in("routine_id", routineIds).order("sort_order"),
        supabase.from("task_completions").select("assignment_id, task_id").eq("completion_date", today),
      ]);

      if (routineError || taskError || completionError) {
        setError(routineError?.message || taskError?.message || completionError?.message || "Failed to load checklist");
        setLoading(false);
        return;
      }

      setRoutines(activeAssignments.flatMap((assignment) => {
        const routine = (routineData || []).find((item) => item.id === assignment.routine_id);
        if (!routine) return [];
        return [{
          ...routine,
          tasks: (taskData || []).filter((task) => task.routine_id === routine.id),
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

  const toggleTask = async (routine: Routine, taskId: string) => {
    const completed = routine.completedTaskIds.includes(taskId);
    const today = getToday();
    const result = completed
      ? await supabase.from("task_completions").delete().eq("assignment_id", routine.assignmentId).eq("task_id", taskId).eq("completion_date", today)
      : await supabase.from("task_completions").insert({ assignment_id: routine.assignmentId, task_id: taskId, completion_date: today });

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setRoutines(routines.map((item) => {
      if (item.assignmentId !== routine.assignmentId) return item;
      return {
        ...item,
        completedTaskIds: completed
          ? item.completedTaskIds.filter((id) => id !== taskId)
          : [...item.completedTaskIds, taskId],
      };
    }));
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-slate-900"><p>Loading...</p></main>;
  }

  const totalTasks = routines.reduce((total, routine) => total + routine.tasks.length, 0);
  const completedTasks = routines.reduce((total, routine) => total + routine.completedTaskIds.length, 0);

  return (
    <main className="min-h-screen px-5 py-6 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-10 flex items-center justify-between">
          <button onClick={() => router.push("/dashboard")} className="text-sm font-semibold text-slate-600 underline">Back to profiles</button>
          <button onClick={() => router.push("/routines")} className="text-sm font-semibold text-slate-600 underline">Edit routines</button>
        </header>

        <section className="mb-8">
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-blue-600">Today&apos;s checklist</p>
          <h1 className="text-4xl font-black tracking-tight text-slate-950">{child?.display_name}</h1>
          <p className="mt-3 text-slate-600">{completedTasks} of {totalTasks} steps complete</p>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: totalTasks ? `${(completedTasks / totalTasks) * 100}%` : "0%" }} /></div>
        </section>

        {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {routines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">No routines are scheduled for today.</div>
        ) : (
          <div className="space-y-5">{routines.map((routine) => {
            const completed = routine.completedTaskIds.length;
            return <article key={routine.assignmentId} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">{routine.name}</h2>
              {routine.description && <p className="mt-1 text-sm text-slate-500">{routine.description}</p>}
              <p className="mt-4 mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">{completed} of {routine.tasks.length} complete</p>
              <div className="space-y-2">{routine.tasks.map((task) => {
                const isComplete = routine.completedTaskIds.includes(task.id);
                return <label key={task.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${isComplete ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}`}>
                  <input type="checkbox" checked={isComplete} onChange={() => toggleTask(routine, task.id)} className="h-5 w-5 accent-blue-600" />
                  <span className={isComplete ? "text-slate-500 line-through" : "font-medium text-slate-900"}>{task.title}</span>
                </label>;
              })}</div>
            </article>;
          })}</div>
        )}
      </div>
    </main>
  );
}
