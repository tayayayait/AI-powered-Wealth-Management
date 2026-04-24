import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateProfileSummary } from "@/lib/profile";

type Role = "user" | "admin";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: Role[];
  loading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoles = async (uid: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    setRoles((data ?? []).map((r) => r.role as Role));
  };

  const handleSession = async (s: Session | null) => {
    if (s?.user) {
      const profile = await getOrCreateProfileSummary(s.user);
      if (profile?.status === "suspended" || profile?.display_name === "[탈퇴회원]") {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setRoles([]);
        setLoading(false);
        return;
      }
      setSession(s);
      setUser(s.user);
      // defer to avoid deadlock
      setTimeout(() => loadRoles(s.user.id).finally(() => setLoading(false)), 0);
    } else {
      setSession(null);
      setUser(null);
      setRoles([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setLoading(true);
      void handleSession(s);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      void handleSession(s);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      throw error;
    }
    await handleSession(data.session);
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    setLoading(true);
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo, data: { display_name: displayName } },
    });
    if (error) {
      setLoading(false);
      throw error;
    }
    await handleSession(data.session);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value: AuthContextValue = {
    user,
    session,
    roles,
    loading,
    isAdmin: roles.includes("admin"),
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    refreshRoles: async () => { if (user) await loadRoles(user.id); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

