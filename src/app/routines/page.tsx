"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Child {
  id: string;
  display_name: string;
}

interface Task {
  id: string;
  routine_id: string;
  title: string;
  sort_order: number;
}

interface Routine {
  id: string;
  name: string;
  description: string | null;
  tasks: Task[];
  childId: string;
  daysOfWeek: number[];
}

const weekdays = [
  { value: 1, label: "M", name: "Mon" },
  { value: 2, label: "T", name: "Tue" },
  { value: 3, label: "W", name: "Wed" },
  { value: 4, label: "T", name: "Thu" },
  { value: 5, label: "F", name: "Fri" },
  { value: 6, label: "S", name: "Sat" },
  { value: 0, label: "S", name: "Sun" },
];

const allDays = weekdays.map((day) => day.value);

export default function RoutinesPage() {
  const router = useRouter();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [newRoutineName, setNewRoutineName] = useState("");
  const [newRoutineDescription, setNewRoutineDescription] = useState("");
  const [newTaskNames, setNewTaskNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPage = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/auth/login");
        return;
      }

      const user = sessionData.session.user;
      const { data: family, error: familyError } = await supabase
        .from("families")
        .select("id")
        .eq("created_by", user.id)
        .maybeSingle();

      if (familyError) {
        setError(familyError.message);
        setLoading(false);
        return;
      }

      let currentFamilyId = family?.id;
      if (!currentFamilyId) {
        const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "Your";
        const { data: newFamilyId, error: createError } = await supabase.rpc(
          "create_family_for_current_user",
          { family_name: `${name}'s Family` },
        );
        if (createError) {
          setError(createError.message);
          setLoading(false);
          return;
        }
        currentFamilyId = newFamilyId;
      }

      setFamilyId(currentFamilyId);

      const [{ data: childData, error: childError }, { data: routineData, error: routineError }] =
        await Promise.all([
          supabase.from("children").select("id, display_name").eq("family_id", currentFamilyId).order("sort_order"),
          supabase.from("routines").select("id, name, description").eq("family_id", currentFamilyId).eq("is_active", true).order("created_at"),
        ]);

      if (childError || routineError) {
        setError(childError?.message || routineError?.message || "Failed to load routines");
        setLoading(false);
        return;
      }

      const loadedRoutines = routineData || [];
      const routineIds = loadedRoutines.map((routine) => routine.id);
      const [{ data: taskData, error: taskError }, { data: assignmentData, error: assignmentError }] =
        routineIds.length
          ? await Promise.all([
              supabase.from("tasks").select("id, routine_id, title, sort_order").in("routine_id", routineIds).order("sort_order"),
              supabase.from("routine_assignments").select("routine_id, child_id, days_of_week").in("routine_id", routineIds),
            ])
          : [{ data: [], error: null }, { data: [], error: null }];

      if (taskError || assignmentError) {
        setError(taskError?.message || assignmentError?.message || "Failed to load routine details");
      }

      setChildren(childData || []);
      setRoutines(
        loadedRoutines.map((routine) => ({
          ...routine,
          tasks: (taskData || []).filter((task) => task.routine_id === routine.id),
          childId: (assignmentData || []).find((assignment) => assignment.routine_id === routine.id)?.child_id || "",
          daysOfWeek: (assignmentData || []).find((assignment) => assignment.routine_id === routine.id)?.days_of_week || allDays,
        })),
      );
      setLoading(false);
    };

    loadPage();
  }, [router]);

  const handleCreateRoutine = async (event: FormEvent) => {
    event.preventDefault();
    if (!familyId || !newRoutineName.trim()) return;

    setSaving(true);
    setError("");
    const { data, error: insertError } = await supabase
      .from("routines")
      .insert({
        family_id: familyId,
        name: newRoutineName.trim(),
        description: newRoutineDescription.trim() || null,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .select("id, name, description")
      .single();

    if (insertError) {
      setError(insertError.message);
    } else if (data) {
      setRoutines([...routines, { ...data, tasks: [], childId: "", daysOfWeek: allDays }]);
      setNewRoutineName("");
      setNewRoutineDescription("");
    }
    setSaving(false);
  };

  const updateRoutine = async (routine: Routine, field: "name" | "description", value: string) => {
    const nextValue = value.trim();
    if (field === "name" && !nextValue) return;
    const { error: updateError } = await supabase
      .from("routines")
      .update({ [field]: nextValue || null })
      .eq("id", routine.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setRoutines(routines.map((item) => item.id === routine.id ? { ...item, [field]: nextValue } : item));
  };

  const deleteRoutine = async (routineId: string) => {
    if (!window.confirm("Delete this routine and its tasks?")) return;
    const { error: deleteError } = await supabase.from("routines").delete().eq("id", routineId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setRoutines(routines.filter((routine) => routine.id !== routineId));
  };

  const addTask = async (routine: Routine, event: FormEvent) => {
    event.preventDefault();
    const title = newTaskNames[routine.id]?.trim();
    if (!title) return;
    const { data, error: insertError } = await supabase
      .from("tasks")
      .insert({ routine_id: routine.id, title, sort_order: routine.tasks.length })
      .select("id, routine_id, title, sort_order")
      .single();
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setRoutines(routines.map((item) => item.id === routine.id ? { ...item, tasks: [...item.tasks, data] } : item));
    setNewTaskNames({ ...newTaskNames, [routine.id]: "" });
  };

  const updateTask = async (routineId: string, taskId: string, title: string) => {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    const { error: updateError } = await supabase.from("tasks").update({ title: nextTitle }).eq("id", taskId);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setRoutines(routines.map((routine) => routine.id === routineId
      ? { ...routine, tasks: routine.tasks.map((task) => task.id === taskId ? { ...task, title: nextTitle } : task) }
      : routine));
  };

  const deleteTask = async (routineId: string, taskId: string) => {
    const { error: deleteError } = await supabase.from("tasks").delete().eq("id", taskId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setRoutines(routines.map((routine) => routine.id === routineId
      ? { ...routine, tasks: routine.tasks.filter((task) => task.id !== taskId) }
      : routine));
  };

  const assignRoutine = async (routine: Routine, childId: string) => {
    if (!childId) return;
    const { data: existing } = await supabase
      .from("routine_assignments")
      .select("id")
      .eq("routine_id", routine.id)
      .maybeSingle();
    const result = existing
      ? await supabase.from("routine_assignments").update({ child_id: childId, days_of_week: routine.daysOfWeek }).eq("id", existing.id)
      : await supabase.from("routine_assignments").insert({ routine_id: routine.id, child_id: childId, days_of_week: routine.daysOfWeek });
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setRoutines(routines.map((item) => item.id === routine.id ? { ...item, childId } : item));
  };

  const updateRoutineDays = async (routine: Routine, day: number) => {
    const daysOfWeek = routine.daysOfWeek.includes(day)
      ? routine.daysOfWeek.filter((value) => value !== day)
      : [...routine.daysOfWeek, day].sort((left, right) => left - right);

    if (daysOfWeek.length === 0) return;

    const { data: existing } = await supabase
      .from("routine_assignments")
      .select("id")
      .eq("routine_id", routine.id)
      .maybeSingle();

    if (!existing) {
      setError("Choose a child before setting active days.");
      return;
    }

    const { error: updateError } = await supabase
      .from("routine_assignments")
      .update({ days_of_week: daysOfWeek })
      .eq("id", existing.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setRoutines(routines.map((item) => item.id === routine.id ? { ...item, daysOfWeek } : item));
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-slate-900"><p>Loading...</p></main>;
  }

  return (
    <main className="min-h-screen px-5 py-6 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="brand-mark" aria-hidden="true">✓</span>
            <span className="text-sm font-bold tracking-wide text-slate-700">Family Checklist</span>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push("/dashboard")} className="text-xs font-semibold text-slate-600 underline">Dashboard</button>
            <button onClick={logout} className="text-xs font-semibold text-slate-600 underline">Logout</button>
          </div>
        </header>

        <div className="mb-8">
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-blue-600">Parent controls</p>
          <h1 className="text-4xl font-black tracking-tight text-slate-950">Build your routines</h1>
          <p className="mt-3 text-slate-600">Create a checklist, add its steps, and choose which child sees it.</p>
        </div>

        {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleCreateRoutine} className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">New routine</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={newRoutineName} onChange={(event) => setNewRoutineName(event.target.value)} placeholder="Routine name, e.g. Morning" className="rounded-lg border-2 border-slate-200 px-4 py-2 focus:border-blue-600 focus:outline-none" required />
            <input value={newRoutineDescription} onChange={(event) => setNewRoutineDescription(event.target.value)} placeholder="Optional description" className="rounded-lg border-2 border-slate-200 px-4 py-2 focus:border-blue-600 focus:outline-none" />
          </div>
          <button type="submit" disabled={saving || !newRoutineName.trim()} className="mt-4 rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? "Creating..." : "Create routine"}</button>
        </form>

        <div className="space-y-5">
          {routines.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">No routines yet. Create your first one above.</p> : routines.map((routine) => (
            <article key={routine.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <input defaultValue={routine.name} onBlur={(event) => updateRoutine(routine, "name", event.target.value)} className="w-full border-0 p-0 text-xl font-black text-slate-950 focus:outline-none" aria-label="Routine name" />
                  <input defaultValue={routine.description || ""} onBlur={(event) => updateRoutine(routine, "description", event.target.value)} placeholder="Add a description" className="mt-1 w-full border-0 p-0 text-sm text-slate-500 focus:outline-none" aria-label="Routine description" />
                </div>
                <button type="button" onClick={() => deleteRoutine(routine.id)} className="text-xs font-semibold text-red-600 underline">Delete</button>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">Checklist steps</h3><span className="text-xs text-slate-400">{routine.tasks.length} steps</span></div>
                <div className="space-y-2">
                  {routine.tasks.map((task) => <div key={task.id} className="flex items-center gap-2"><input defaultValue={task.title} onBlur={(event) => updateTask(routine.id, task.id, event.target.value)} className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none" aria-label="Task title" /><button type="button" onClick={() => deleteTask(routine.id, task.id)} className="px-2 text-xs font-semibold text-red-600">Remove</button></div>)}
                </div>
                <form onSubmit={(event) => addTask(routine, event)} className="mt-3 flex gap-2"><input value={newTaskNames[routine.id] || ""} onChange={(event) => setNewTaskNames({ ...newTaskNames, [routine.id]: event.target.value })} placeholder="Add a checklist step" className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none" /><button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Add step</button></form>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <label className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
                  Assigned child
                  <select value={routine.childId} onChange={(event) => assignRoutine(routine, event.target.value)} className="rounded-md border border-slate-200 px-3 py-2 font-normal focus:border-blue-600 focus:outline-none">
                    <option value="">Choose a child</option>
                    {children.map((child) => <option key={child.id} value={child.id}>{child.display_name}</option>)}
                  </select>
                </label>
                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-700">Active days</p>
                  <div className="mt-2 grid grid-cols-7 gap-1.5">
                    {weekdays.map((day) => {
                      const active = routine.daysOfWeek.includes(day.value);
                      return <button
                        key={day.name}
                        type="button"
                        title={day.name}
                        aria-label={`${day.name} ${active ? "active" : "inactive"}`}
                        aria-pressed={active}
                        disabled={!routine.childId}
                        onClick={() => updateRoutineDays(routine, day.value)}
                        className={`aspect-square rounded-lg border-2 text-sm font-bold transition ${active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-400"} disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        {day.label}
                      </button>;
                    })}
                  </div>
                  <p className="mt-2 text-xs text-slate-400">Choose the days this routine should appear.</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
