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
  routine_type: "checklist" | "math";
  math_difficulty: "grade_1" | "grade_2" | "grade_3" | "grade_4" | "grade_5" | "grade_6";
  math_operations: string[];
  math_question_count: number;
  tasks: Task[];
  childIds: string[];
  assignmentIds: Record<string, string>;
  daysOfWeek: number[];
}

const weekdays = [
  { value: 1, label: "Mo", name: "Mon" },
  { value: 2, label: "Tu", name: "Tue" },
  { value: 3, label: "We", name: "Wed" },
  { value: 4, label: "Th", name: "Thu" },
  { value: 5, label: "Fr", name: "Fri" },
  { value: 6, label: "Sa", name: "Sat" },
  { value: 0, label: "Su", name: "Sun" },
];

const allDays = weekdays.map((day) => day.value);
const mathOperations = [
  { value: "addition", label: "Addition" },
  { value: "subtraction", label: "Subtraction" },
  { value: "multiplication", label: "Multiplication" },
  { value: "division", label: "Division" },
];

const mathGrades = [
  { value: "grade_1", label: "Grade 1" },
  { value: "grade_2", label: "Grade 2" },
  { value: "grade_3", label: "Grade 3" },
  { value: "grade_4", label: "Grade 4" },
  { value: "grade_5", label: "Grade 5" },
  { value: "grade_6", label: "Grade 6" },
];

export default function RoutinesPage() {
  const router = useRouter();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [newRoutineName, setNewRoutineName] = useState("");
  const [newRoutineDescription, setNewRoutineDescription] = useState("");
  const [newRoutineType, setNewRoutineType] = useState<"checklist" | "math">("checklist");
  const [newMathDifficulty, setNewMathDifficulty] = useState<Routine["math_difficulty"]>("grade_1");
  const [newMathOperations, setNewMathOperations] = useState(["addition"]);
  const [newMathQuestionCount, setNewMathQuestionCount] = useState(5);
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
          supabase.from("routines").select("id, name, description, routine_type, math_difficulty, math_operations, math_question_count").eq("family_id", currentFamilyId).eq("is_active", true).order("created_at"),
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
              supabase.from("routine_assignments").select("id, routine_id, child_id, days_of_week").in("routine_id", routineIds),
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
          childIds: (assignmentData || []).filter((assignment) => assignment.routine_id === routine.id).map((assignment) => assignment.child_id),
          assignmentIds: Object.fromEntries((assignmentData || []).filter((assignment) => assignment.routine_id === routine.id).map((assignment) => [assignment.child_id, assignment.id])),
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
        routine_type: newRoutineType,
        math_difficulty: newMathDifficulty,
        math_operations: newMathOperations,
        math_question_count: newMathQuestionCount,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .select("id, name, description, routine_type, math_difficulty, math_operations, math_question_count")
      .single();

    if (insertError) {
      setError(insertError.message);
    } else if (data) {
      setRoutines([...routines, { ...data, tasks: [], childIds: [], assignmentIds: {}, daysOfWeek: allDays }]);
      setNewRoutineName("");
      setNewRoutineDescription("");
      setNewRoutineType("checklist");
      setNewMathDifficulty("grade_1");
      setNewMathOperations(["addition"]);
      setNewMathQuestionCount(5);
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

  const updateMathDifficulty = async (routine: Routine, difficulty: Routine["math_difficulty"]) => {
    const { error: updateError } = await supabase
      .from("routines")
      .update({ math_difficulty: difficulty })
      .eq("id", routine.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setRoutines(routines.map((item) => item.id === routine.id ? { ...item, math_difficulty: difficulty } : item));
  };

  const updateMathSettings = async (routine: Routine, changes: Partial<Pick<Routine, "math_operations" | "math_question_count">>) => {
    const { error: updateError } = await supabase
      .from("routines")
      .update(changes)
      .eq("id", routine.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setRoutines(routines.map((item) => item.id === routine.id ? { ...item, ...changes } : item));
  };

  const toggleMathOperation = (routine: Routine, operation: string) => {
    const selected = routine.math_operations.includes(operation);
    const mathOperationsForRoutine = selected
      ? routine.math_operations.filter((item) => item !== operation)
      : [...routine.math_operations, operation];

    if (mathOperationsForRoutine.length === 0) return;
    updateMathSettings(routine, { math_operations: mathOperationsForRoutine });
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

  const assignRoutine = async (routine: Routine, childId: string, assigned: boolean) => {
    const existingAssignmentId = routine.assignmentIds[childId];
    const result = assigned
      ? await supabase.from("routine_assignments").insert({ routine_id: routine.id, child_id: childId, days_of_week: routine.daysOfWeek }).select("id").single()
      : existingAssignmentId
        ? await supabase.from("routine_assignments").delete().eq("id", existingAssignmentId)
        : { data: null, error: null };
    if (result.error) {
      setError(result.error.message);
      return;
    }
    const childIds = assigned ? [...routine.childIds, childId] : routine.childIds.filter((id) => id !== childId);
    const assignmentIds = { ...routine.assignmentIds };
    if (assigned && result.data) assignmentIds[childId] = result.data.id;
    if (!assigned) delete assignmentIds[childId];
    setRoutines(routines.map((item) => item.id === routine.id ? { ...item, childIds, assignmentIds } : item));
  };

  const updateRoutineDays = async (routine: Routine, day: number) => {
    const daysOfWeek = routine.daysOfWeek.includes(day)
      ? routine.daysOfWeek.filter((value) => value !== day)
      : [...routine.daysOfWeek, day].sort((left, right) => left - right);

    if (daysOfWeek.length === 0) return;

    if (routine.childIds.length === 0) {
      setError("Choose at least one child before setting active days.");
      return;
    }

    const { error: updateError } = await supabase
      .from("routine_assignments")
      .update({ days_of_week: daysOfWeek })
      .in("id", Object.values(routine.assignmentIds));

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
            <span className="text-sm font-bold tracking-wide text-slate-700">Kusuma App</span>
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
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <select value={newRoutineType} onChange={(event) => setNewRoutineType(event.target.value as "checklist" | "math")} className="rounded-lg border-2 border-slate-200 px-4 py-2 focus:border-blue-600 focus:outline-none">
              <option value="checklist">Checklist routine</option>
              <option value="math">Math practice</option>
            </select>
            {newRoutineType === "math" && <>
              <select value={newMathDifficulty} onChange={(event) => setNewMathDifficulty(event.target.value as Routine["math_difficulty"])} className="rounded-lg border-2 border-slate-200 px-4 py-2 focus:border-blue-600 focus:outline-none">
                {mathGrades.map((grade) => <option key={grade.value} value={grade.value}>{grade.label}</option>)}
              </select>
              <label className="text-sm font-semibold text-slate-700">Questions
                <input type="number" min="1" max="20" value={newMathQuestionCount} onChange={(event) => setNewMathQuestionCount(Number(event.target.value))} className="mt-1 block w-full rounded-lg border-2 border-slate-200 px-4 py-2 font-normal focus:border-blue-600 focus:outline-none" />
              </label>
              <fieldset className="sm:col-span-2">
                <legend className="text-sm font-semibold text-slate-700">Operations</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {mathOperations.map((operation) => {
                    const selected = newMathOperations.includes(operation.value);
                    return <button key={operation.value} type="button" onClick={() => setNewMathOperations(selected ? newMathOperations.filter((item) => item !== operation.value) : [...newMathOperations, operation.value])} className={`rounded-full border px-3 py-1 text-sm font-semibold ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 text-slate-600"}`}>{operation.label}</button>;
                  })}
                </div>
              </fieldset>
            </>}
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
                {routine.routine_type === "math" && <label className="mb-4 flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
                  Grade level
                  <select value={routine.math_difficulty} onChange={(event) => updateMathDifficulty(routine, event.target.value as Routine["math_difficulty"])} className="rounded-md border border-slate-200 px-3 py-2 font-normal focus:border-blue-600 focus:outline-none">
                    {mathGrades.map((grade) => <option key={grade.value} value={grade.value}>{grade.label}</option>)}
                  </select>
                </label>}
                {routine.routine_type === "math" && <div className="mb-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">Number of questions
                    <input type="number" min="1" max="20" value={routine.math_question_count} onChange={(event) => updateMathSettings(routine, { math_question_count: Math.min(20, Math.max(1, Number(event.target.value))) })} className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 font-normal focus:border-blue-600 focus:outline-none" />
                  </label>
                  <fieldset>
                    <legend className="text-sm font-semibold text-slate-700">Operations</legend>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {mathOperations.map((operation) => {
                        const active = routine.math_operations.includes(operation.value);
                        return <button key={operation.value} type="button" onClick={() => toggleMathOperation(routine, operation.value)} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 text-slate-600"}`}>{operation.label}</button>;
                      })}
                    </div>
                  </fieldset>
                </div>}
                {routine.routine_type === "checklist" && <>
                  <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">Checklist steps</h3><span className="text-xs text-slate-400">{routine.tasks.length} steps</span></div>
                  <div className="space-y-2">
                    {routine.tasks.map((task) => <div key={task.id} className="flex items-center gap-2"><input defaultValue={task.title} onBlur={(event) => updateTask(routine.id, task.id, event.target.value)} className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none" aria-label="Task title" /><button type="button" onClick={() => deleteTask(routine.id, task.id)} className="px-2 text-xs font-semibold text-red-600">Remove</button></div>)}
                  </div>
                  <form onSubmit={(event) => addTask(routine, event)} className="mt-3 flex gap-2"><input value={newTaskNames[routine.id] || ""} onChange={(event) => setNewTaskNames({ ...newTaskNames, [routine.id]: event.target.value })} placeholder="Add a checklist step" className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none" /><button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Add step</button></form>
                </>}
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <fieldset>
                  <legend className="text-sm font-semibold text-slate-700">Assigned children</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {children.map((child) => {
                      const assigned = routine.childIds.includes(child.id);
                      return <label key={child.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${assigned ? "border-blue-300 bg-blue-50" : "border-slate-200"}`}>
                        <input type="checkbox" checked={assigned} onChange={(event) => assignRoutine(routine, child.id, event.target.checked)} className="h-4 w-4 accent-blue-600" />
                        <span>{child.display_name}</span>
                      </label>;
                    })}
                  </div>
                </fieldset>
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
                        disabled={routine.childIds.length === 0}
                        onClick={() => updateRoutineDays(routine, day.value)}
                        className={`h-9 w-9 rounded-full border text-xs font-bold transition ${active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-400"} disabled:cursor-not-allowed disabled:opacity-40`}
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
