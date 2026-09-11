"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.push("/dashboard");
      } else {
        router.push("/auth/login");
      }
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-slate-900">
        <p>Loading...</p>
      </main>
    );
  }

  return null;
}
