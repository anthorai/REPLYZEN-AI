import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/integrations/supabase/client";

interface UserProfile {
  user_id: string;
  email: string | null;
  display_name: string | null;
  plan: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const EnhancedAuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use refs to prevent race conditions
  const mountedRef = useRef(true);

  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    if (!mountedRef.current) return null;
    
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, display_name, plan, avatar_url, created_at, updated_at")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("Profile fetch error:", error);
        // Don't set error state for profile fetch - it's not critical
        if (mountedRef.current) setProfile(null);
        return null;
      }
      
      if (data && mountedRef.current) {
        setProfile(data as UserProfile);
        return data as UserProfile;
      } else {
        if (mountedRef.current) setProfile(null);
        return null;
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
      // Don't let profile errors break the auth flow
      if (mountedRef.current) setProfile(null);
      return null;
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) return;
    
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (!mountedRef.current) return;
      
      if (error) {
        console.error('Session refresh error:', error);
        setError(error.message);
        setSession(null);
        setUser(null);
        setProfile(null);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
      }
    } catch (err) {
      console.error('Unexpected error during session refresh:', err);
      if (mountedRef.current) {
        setError('Failed to refresh session');
        setSession(null);
        setUser(null);
        setProfile(null);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchProfile]);

  useEffect(() => {
    let isMounted = true;

    const supabase = getSupabaseClient();

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth session error:", error);
        }

        if (isMounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setError(null);

          if (session?.user) {
            await fetchProfile(session.user.id);
          } else {
            setProfile(null);
          }
        }
      } catch (err) {
        console.error("Auth initialization failed:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    initializeAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        setInitialized(true);
      }
    });

    return () => {
      isMounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [fetchProfile]);

  const signUp = async (email: string, password: string) => {
    if (!mountedRef.current) return { error: "Component unmounted" };
    
    try {
      setError(null);
      const { error } = await getSupabaseClient().auth.signUp({
        email,
        password,
        options: { 
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            display_name: email.split('@')[0] // Default display name
          }
        },
      });
      
      if (error && !mountedRef.current) {
        return { error: error.message };
      }
      
      return { error: error?.message ?? null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      if (mountedRef.current) setError(errorMessage);
      return { error: errorMessage };
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!mountedRef.current) return { error: "Component unmounted" };
    
    try {
      setError(null);
      setLoading(true);
      
      const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
      
      if (!mountedRef.current) return { error: "Component unmounted" };
      
      if (error) {
        setError(error.message);
      }
      
      setLoading(false);
      return { error: error?.message ?? null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      if (mountedRef.current) {
        setError(errorMessage);
        setLoading(false);
      }
      return { error: errorMessage };
    }
  };

  const signOut = async () => {
    if (!mountedRef.current) return;
    
    try {
      setError(null);
      await getSupabaseClient().auth.signOut();
      
      // State will be updated by the auth state listener
    } catch (err) {
      console.error('Sign out error:', err);
      if (mountedRef.current) {
        setError('Failed to sign out');
      }
    }
  };

  const resetPassword = async (email: string) => {
    if (!mountedRef.current) return { error: "Component unmounted" };
    
    try {
      setError(null);
      const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      return { error: error?.message ?? null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      if (mountedRef.current) setError(errorMessage);
      return { error: errorMessage };
    }
  };

  const value: AuthContextType = {
    session,
    user,
    profile,
    loading,
    initialized,
    error,
    signUp,
    signIn,
    signOut,
    resetPassword,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useEnhancedAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useEnhancedAuth must be used within EnhancedAuthProvider");
  return context;
};
