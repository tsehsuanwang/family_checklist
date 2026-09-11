"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

interface Child {
  id: string;
  display_name: string;
  avatar_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [newChildName, setNewChildName] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    const checkAuthAndLoadChildren = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/auth/login");
        return;
      }

      setUser(sessionData.session.user);

      // Load full name from user metadata
      const name = sessionData.session.user.user_metadata?.full_name || "";
      setFullName(name);

      // Get or create family
      const { data: familiesData, error: familiesError } = await supabase
        .from("families")
        .select("id")
        .eq("created_by", sessionData.session.user.id)
        .single();

      let currentFamilyId = familiesData?.id;

      if (!familiesData || familiesError) {
        // Create a family if it doesn't exist
        const { data: newFamily, error: createError } = await supabase
          .from("families")
          .insert([
            {
              name: `${name || sessionData.session.user.email?.split("@")[0]}'s Family`,
              created_by: sessionData.session.user.id,
            },
          ])
          .select()
          .single();

        if (createError) {
          console.error("Error creating family:", createError);
          setError("Failed to set up your family");
          setLoading(false);
          return;
        }

        currentFamilyId = newFamily?.id;
      }

      setFamilyId(currentFamilyId);

      // Load children from Supabase
      const { data, error: childrenError } = await supabase
        .from("children")
        .select("*")
        .eq("family_id", currentFamilyId)
        .order("sort_order", { ascending: true });

      if (childrenError) {
        console.error("Error loading children:", childrenError);
        setError("Failed to load children");
      } else {
        setChildren(data || []);
      }

      setLoading(false);
    };

    checkAuthAndLoadChildren();
  }, [router]);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !fullName.trim()) return;

    setSavingName(true);
    setError("");

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() },
      });

      if (updateError) throw updateError;
      // Update local user state
      setUser({ ...user, user_metadata: { ...user.user_metadata, full_name: fullName.trim() } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save name");
    } finally {
      setSavingName(false);
    }
  };

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChildName.trim() || !user || !familyId) return;

    setSubmitting(true);
    setError("");

    try {
      const { data, error: insertError } = await supabase
        .from("children")
        .insert([
          {
            family_id: familyId,
            display_name: newChildName.trim(),
            sort_order: children.length,
            is_active: true,
          },
        ])
        .select();

      if (insertError) throw insertError;

      if (data) {
        setChildren([...children, data[0]]);
        setNewChildName("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add child");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteChild = async (childId: string) => {
    if (!confirm("Are you sure?")) return;

    try {
      const { error: deleteError } = await supabase
        .from("children")
        .delete()
        .eq("id", childId);

      if (deleteError) throw deleteError;

      setChildren(children.filter((c) => c.id !== childId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete child");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-slate-900">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden px-5 py-6 text-slate-900 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-2xl flex-col">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <span className="brand-mark" aria-hidden="true">✓</span>
            <span className="text-sm font-bold tracking-wide text-slate-700">Family Checklist</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline"
            >
              Dashboard
            </button>
            <button
              onClick={handleLogout}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="flex-1">
          <h1 className="text-3xl font-black text-slate-950 mb-2">Settings</h1>
          <p className="text-slate-600 mb-8">Manage your children and family settings.</p>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-8">
            <h2 className="text-xl font-bold text-slate-950 mb-4">Your Name</h2>

            <form onSubmit={handleSaveName} className="mb-6 pb-6 border-b border-slate-200">
              <label htmlFor="fullName" className="block text-sm font-semibold mb-2 text-slate-700">
                Full Name
              </label>
              <div className="flex gap-2">
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="flex-1 px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  disabled={savingName}
                  className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingName ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-8">
            <h2 className="text-xl font-bold text-slate-950 mb-6">Your Children</h2>

            {error && (
              <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleAddChild} className="mb-6 pb-6 border-b border-slate-200">
              <label htmlFor="childName" className="block text-sm font-semibold mb-2 text-slate-700">
                Add a new child
              </label>
              <div className="flex gap-2">
                <input
                  id="childName"
                  type="text"
                  value={newChildName}
                  onChange={(e) => setNewChildName(e.target.value)}
                  placeholder="Enter child's name"
                  className="flex-1 px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  disabled={submitting || !newChildName.trim()}
                  className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Adding..." : "Add"}
                </button>
              </div>
            </form>

            {children.length === 0 ? (
              <p className="text-slate-500 text-sm">No children yet. Add one to get started!</p>
            ) : (
              <ul className="space-y-2">
                {children.map((child) => (
                  <li
                    key={child.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <span className="font-medium text-slate-900">{child.display_name}</span>
                    <button
                      onClick={() => handleDeleteChild(child.id)}
                      className="text-xs text-red-600 hover:text-red-700 font-semibold"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="text-sm text-slate-500">
            <p>Logged in as: <strong>{user?.email}</strong></p>
          </div>
        </section>

        <footer className="pb-2 text-center text-xs font-medium text-slate-400">
          One small step at a time.
        </footer>
      </div>
    </main>
  );
}
