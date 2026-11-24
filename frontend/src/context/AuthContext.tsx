import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "../lib/supabase.ts";
import { humanizeError } from "../lib/humanize.js";
import {
  clearJurySessionState,
  getJuryHeaders,
  getJurySessionState,
  JURY_ROLE_KEY,
  JURY_TOKEN_KEY,
} from "../lib/api.js";

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
  juryMode?: boolean;
}

interface AuthContextValue {
  user: AuthUserProfile | null;
  accessToken: string | null;
  isJuryMode: boolean;
  loading: boolean;
  sessionExpired: boolean;
  clearSessionExpired: () => void;
  signInWithPassword: (email: string, password: string) => Promise<AuthUserProfile>;
  signUpWarga: (email: string, password: string) => Promise<{ needsEmailConfirm: boolean; profile?: AuthUserProfile }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: (tokenOverride?: string) => Promise<AuthUserProfile | null>;
  switchJuryRole: (roleKey: string, juryTokenOverride?: string) => Promise<AuthUserProfile | null>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  accessToken: null,
  isJuryMode: false,
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
  switchJuryRole: async () => null,
});

async function fetchMe(
  token: string | null,
  juryOverride?: { juryToken?: string; juryRole?: string }
): Promise<AuthUserProfile> {
  const headers: Record<string, string> = {
    ...getJuryHeaders(juryOverride),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch("/api/auth/me", { headers });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(payload?.error?.message || payload?.message || "");
    (err as Error & { status?: number; code?: string }).status = res.status;
    (err as Error & { code?: string }).code = payload?.error?.code || payload?.code;
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
    juryMode: Boolean(data.juryMode),
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
    let mounted = true;
    const { juryToken, juryRole } = getJurySessionState();

    if (!supabase) {
      if (juryToken) {
        fetchMe(null, { juryToken, juryRole })
          .then((profile) => {
            if (mounted) setUser(profile);
          })
          .catch(() => {})
          .finally(() => {
            if (mounted) setLoading(false);
          });
      } else {
        setLoading(false);
      }
      return () => {
        mounted = false;
      };
    }

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        const token = data.session?.access_token ?? null;
        if (token) {
          await syncWithBackend(token).catch(() => {});
        } else if (juryToken) {
          const profile = await fetchMe(null, { juryToken, juryRole }).catch(() => null);
          if (mounted && profile) setUser(profile);
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
    clearJurySessionState();
    setUser(null);
    setAccessToken(null);
    setSessionExpired(false);
  }, []);

  const switchJuryRole = useCallback(
    async (roleKey: string, juryTokenOverride?: string) => {
      const state = getJurySessionState();
      const juryToken = juryTokenOverride || state.juryToken;
      if (!juryToken) return null;
      sessionStorage.setItem(JURY_TOKEN_KEY, juryToken);
      sessionStorage.setItem(JURY_ROLE_KEY, roleKey);
      const profile = await fetchMe(null, { juryToken, juryRole: roleKey });
      setAccessToken(null);
      setUser(profile);
      setSessionExpired(false);
      return profile;
    },
    []
  );

  const refreshProfile = useCallback(
    async (tokenOverride?: string) => {
      const token = tokenOverride || accessToken;
      if (token) {
        return syncWithBackend(token);
      }
      const { juryToken, juryRole } = getJurySessionState();
      if (juryToken) {
        return switchJuryRole(juryRole, juryToken);
      }
      return null;
    },
    [accessToken, syncWithBackend, switchJuryRole]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isJuryMode: Boolean(user?.juryMode || getJurySessionState().juryToken),
        loading,
        sessionExpired,
        clearSessionExpired,
        signInWithPassword,
        signUpWarga,
        signInWithGoogle,
        signOut,
        refreshProfile,
        switchJuryRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
