import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
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
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      console.log('[AuthContext] Fetching profile for user:', userId);
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, display_name, plan, avatar_url, created_at, updated_at")
        .eq("user_id", userId)
        .single();

      if (!error && data) {
        console.log('[AuthContext] Profile fetched successfully:', data);
        setProfile(data as unknown as UserProfile);
      } else {
        console.warn('[AuthContext] Profile fetch error or no data:', error);
        setProfile(null);
      }
    } catch (err) {
      console.error("[AuthContext] Error fetching profile:", err);
      setProfile(null);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      console.log('[AuthContext] Refreshing session...');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[AuthContext] Session refreshed:', session ? 'Active' : 'None');
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
    } catch (err) {
      console.error("[AuthContext] Error refreshing session:", err);
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  }, [fetchProfile]);

  useEffect(() => {
    // Prevent multiple initializations
    if (initialized) {
      console.log('[AuthContext] Already initialized, skipping...');
      return;
    }

    console.log('[AuthContext] Initializing auth context...');
    
    // Set up listener BEFORE getSession
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthContext] Auth state change:', event, session ? 'Session exists' : 'No session');
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
        setInitialized(true);
      }
    );

    // Initial session check with timeout
    const initializeAuth = async () => {
      try {
        console.log('[AuthContext] Performing initial session check...');
        
        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Auth initialization timeout')), 10000);
        });

        const sessionPromise = supabase.auth.getSession().then(async ({ data: { session } }) => {
          console.log('[AuthContext] Initial session check:', session ? 'Session exists' : 'No session');
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            await fetchProfile(session.user.id);
          }
          
          return session;
        });

        const session = await Promise.race([sessionPromise, timeoutPromise]);
        
        setLoading(false);
        setInitialized(true);
        console.log('[AuthContext] Initialization completed');
        
      } catch (err: any) {
        console.error('[AuthContext] Initialization error:', err);
        setLoading(false);
        setInitialized(true);
        
        // Set default state on error
        setSession(null);
        setUser(null);
        setProfile(null);
      }
    };

    initializeAuth();

    return () => {
      console.log('[AuthContext] Cleaning up auth subscription...');
      subscription.unsubscribe();
    };
  }, [initialized, fetchProfile]);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      console.log('[AuthContext] Attempting signup for:', email);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { 
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            display_name: email.split('@')[0], // Default display name
          }
        },
      });
      
      if (error) {
        console.error('[AuthContext] Signup error:', error);
        return { error: error.message };
      }
      
      console.log('[AuthContext] Signup successful');
      return { error: null };
    } catch (err) {
      console.error('[AuthContext] Unexpected signup error:', err);
      return { error: 'An unexpected error occurred during signup.' };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      console.log('[AuthContext] Attempting sign in for:', email);
      const { error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      if (error) {
        console.error('[AuthContext] Sign in error:', error);
        return { error: error.message };
      }
      
      console.log('[AuthContext] Sign in successful');
      return { error: null };
    } catch (err) {
      console.error('[AuthContext] Unexpected sign in error:', err);
      return { error: 'An unexpected error occurred during sign in.' };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      console.log('[AuthContext] Signing out...');
      await supabase.auth.signOut();
      console.log('[AuthContext] Sign out successful');
    } catch (err) {
      console.error('[AuthContext] Sign out error:', err);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      console.log('[AuthContext] Sending password reset for:', email);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) {
        console.error('[AuthContext] Password reset error:', error);
        return { error: error.message };
      }
      
      console.log('[AuthContext] Password reset email sent');
      return { error: null };
    } catch (err) {
      console.error('[AuthContext] Unexpected password reset error:', err);
      return { error: 'An unexpected error occurred during password reset.' };
    }
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    session,
    user,
    profile,
    loading: loading && !initialized, // Only show loading during initial load
    signUp,
    signIn,
    signOut,
    resetPassword,
    refreshSession,
  }), [session, user, profile, loading, initialized, signUp, signIn, signOut, resetPassword, refreshSession]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
