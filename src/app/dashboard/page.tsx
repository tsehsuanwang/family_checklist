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

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/auth/login");
        return;
      }
      setUser(data.session.user);

      // Get or create family
      const { data: familyMember } = await supabase
        .from("family_members")
        .select("family_id")
        .eq("user_id", data.session.user.id)
        .maybeSingle();

      let finalFamilyId = familyMember?.family_id;

      // If no family exists, create one
      if (!finalFamilyId) {
        const email = data.session.user.email || "";
        const name = data.session.user.user_metadata?.full_name || email.split("@")[0];
        const { data: newFamilyId, error: createError } = await supabase.rpc(
          "create_family_for_current_user",
          { family_name: `${name}'s Family` },
        );

        if (createError) {
          console.error("Error creating family:", createError);
          setLoading(false);
          return;
        }
        finalFamilyId = newFamilyId;
      }

      // Load children
      const { data: childrenData, error: childrenError } = await supabase
        .from("children")
        .select("*")
        .eq("family_id", finalFamilyId)
        .order("sort_order", { ascending: true });

      if (childrenError) {
        console.error("Error loading children:", childrenError);
      } else {
        setChildren(childrenData || []);
      }

      setLoading(false);
    };

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        router.push("/auth/login");
      } else {
        setUser(session.user);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [router]);

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

  const handleSelectChild = (childId: string) => {
    setSelectedChildId(childId);
    router.push(`/child/${childId}`);
  };

  return (
    <main className="min-h-screen overflow-hidden px-5 py-6 text-slate-900 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-2xl flex-col">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="brand-mark" aria-hidden="true">✓</span>
            <span className="text-sm font-bold tracking-wide text-slate-700">Kusuma App</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/routines")}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline"
            >
              Routines
            </button>
            <button
              onClick={() => router.push("/settings")}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline"
            >
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="flex flex-1 flex-col justify-center py-12">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-blue-600">
            Hello, {user?.user_metadata?.full_name || user?.email}
          </p>
          <h1 className="max-w-md text-4xl font-black leading-[1.05] tracking-tight text-slate-950 sm:text-5xl">
            Who is checking in?
          </h1>
          <p className="mt-4 max-w-sm text-base leading-7 text-slate-600">
            Pick your profile to see today&apos;s routines.
          </p>

          <div className="mt-9 grid gap-3" role="group" aria-label="Child profiles">
            {children.length === 0 ? (
              <p className="text-center text-slate-500">
                No children yet.{" "}
                <button
                  onClick={() => router.push("/settings")}
                  className="text-blue-600 hover:underline font-semibold"
                >
                  Add one in Settings
                </button>
              </p>
            ) : (
              children.map((child) => {
                const isSelected = selectedChildId === child.id;
                const initials = child.display_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);
                const colors = ["coral", "mint", "sun"];
                const color = colors[children.indexOf(child) % colors.length];

                return (
                  <button
                    key={child.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleSelectChild(child.id)}
                    className={`profile-button profile-${color} ${isSelected ? "profile-selected" : ""}`}
                  >
                    <span className="profile-avatar" aria-hidden="true">{initials}</span>
                    <span className="flex flex-1 flex-col items-start">
                      <span className="text-xl font-extrabold">{child.display_name}</span>
                      <span className="mt-0.5 text-sm font-medium opacity-70">Ready for your routine</span>
                    </span>
                    <span className="profile-arrow" aria-hidden="true">→</span>
                  </button>
                );
              })
            )}
          </div>

          <p className="mt-8 text-center text-sm font-medium text-slate-500">
            {selectedChildId
              ? `Great choice, ${children.find((c) => c.id === selectedChildId)?.display_name}!`
              : "Tap your name to begin"}
          </p>
        </section>

        <footer className="pb-2 text-center text-xs font-medium text-slate-400">
          One small step at a time.
        </footer>
      </div>
    </main>
  );
}
