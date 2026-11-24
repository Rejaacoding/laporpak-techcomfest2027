import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "../lib/supabase.ts";
import { humanizeError } from "../lib/humanize.js";

export type UserRole = "WARGA" | "ADMIN_DINAS";

export interface AuthUserProfile {
  aliasName: string;
  role: UserRole;
  departmentId: string | null;
  departmentName?: string | null;
  departmentShortName?: string | null;
  trustScore: number;
  frozenUntil: string | null;
  cooldownUntil: string | null;
  activeTicketCount?: number;
}

interface AuthContextValue {
  user: AuthUserProfile | null;
  accessToken: string | null;
  loading: boolean;
  sessionExpired: boolean;
  clearSessionExpired: () => void;
  signInWithPassword: (email: string, password: string) => Promise<AuthUserProfile>;
  signUpWarga: (email: string, password: string) => Promise<{ needsEmailConfirm: boolean; profile?: AuthUserProfile }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: (tokenOverride?: string) => Promise<AuthUserProfile | null>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  accessToken: null,
  loading: true,
  sessionExpired: false,
  clearSessionExpired: () => {},
  signInWithPassword: async () => {
    throw new Error("AuthProvider belum terpasang.");
  },
  signUpWarga: async () => {
    throw new Error("AuthProvider belum terpasang.");
  },
  signInWithGoogle: async () => {
    throw new Error("AuthProvider belum terpasang.");
  },
  signOut: async () => {},
  refreshProfile: async () => null,
});

async function fetchMe(token: string): Promise<AuthUserProfile> {
  const res = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(payload?.message || "");
    (err as Error & { status?: number; code?: string }).status = res.status;
    (err as Error & { code?: string }).code = payload?.code;
    throw err;
  }

  const data = payload?.data || {};
  return {
    aliasName: data.aliasName,
    role: data.role,
    departmentId: data.departmentId ?? null,
    departmentName: data.departmentName ?? null,
    departmentShortName: data.departmentShortName ?? null,
    trustScore: Number(data.trustScore ?? 0.5),
    frozenUntil: data.frozenUntil ?? null,
    cooldownUntil: data.cooldownUntil ?? null,
    activeTicketCount: data.activeTicketCount,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const clearSessionExpired = useCallback(() => setSessionExpired(false), []);

  const syncWithBackend = useCallback(async (token: string | null) => {
    if (!token) {
      setUser(null);
      setAccessToken(null);
      return null;
    }

    try {
      const profile = await fetchMe(token);
      setAccessToken(token);
      setUser(profile);
      setSessionExpired(false);
      return profile;
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401) {
        // Token expired/invalid: sign out Supabase without touching local draft storage
        setSessionExpired(true);
        await supabase?.auth.signOut().catch(() => {});
      }
      setUser(null);
      setAccessToken(null);
      throw err;
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        const token = data.session?.access_token ?? null;
        if (token) {
          await syncWithBackend(token).catch(() => {});
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (event === "SIGNED_OUT") {
          setUser(null);
          setAccessToken(null);
          return;
        }
        const token = session?.access_token ?? null;
        if (token) {
          await syncWithBackend(token).catch(() => {});
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [syncWithBackend]);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      if (!supabase) {
        throw new Error("Layanan autentikasi belum dikonfigurasi.");
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        throw new Error(humanizeError(error));
      }
      const token = data.session?.access_token;
      if (!token) {
        throw new Error("Sesi masuk tidak ditemukan. Silakan coba lagi.");
      }
      const profile = await syncWithBackend(token);
      if (!profile) {
        throw new Error("Gagal memuat profil akun. Silakan coba lagi.");
      }
      return profile;
    },
    [syncWithBackend]
  );

  const signUpWarga = useCallback(
    async (email: string, password: string) => {
      if (!supabase) {
        throw new Error("Layanan autentikasi belum dikonfigurasi.");
      }
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) {
        throw new Error(humanizeError(error));
      }
      const token = data.session?.access_token;
      if (!token) {
        return { needsEmailConfirm: true };
      }
      const profile = await syncWithBackend(token);
      return { needsEmailConfirm: false, profile: profile || undefined };
    },
    [syncWithBackend]
  );

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      throw new Error("Layanan autentikasi belum dikonfigurasi.");
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) {
      throw new Error(humanizeError(error));
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut().catch(() => {});
    setUser(null);
    setAccessToken(null);
    setSessionExpired(false);
  }, []);

  const refreshProfile = useCallback(
    async (tokenOverride?: string) => {
      const token = tokenOverride || accessToken;
      if (!token) return null;
      return syncWithBackend(token);
    },
    [accessToken, syncWithBackend]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        sessionExpired,
        clearSessionExpired,
        signInWithPassword,
        signUpWarga,
        signInWithGoogle,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
