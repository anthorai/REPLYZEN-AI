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
      console.log('Fetching profile for user:', userId);
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, display_name, plan, avatar_url, created_at, updated_at")
        .eq("user_id", userId)
        .single();

      if (!error && data) {
        console.log('Profile fetched successfully:', data);
        setProfile(data as unknown as UserProfile);
      } else {
        console.warn('Profile fetch error or no data:', error);
        setProfile(null);
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
      setProfile(null);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      console.log('Refreshing session...');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session refreshed:', session ? 'Active' : 'None');
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
    } catch (err) {
      console.error("Error refreshing session:", err);
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  }, [fetchProfile]);

  useEffect(() => {
    if (initialized) return;

    console.log('Initializing auth context...');
    
    // Set up listener BEFORE getSession
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session ? 'Session exists' : 'No session');
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

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('Initial session check:', session ? 'Session exists' : 'No session');
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      
      setLoading(false);
      setInitialized(true);
    });

    return () => {
      console.log('Cleaning up auth subscription...');
      subscription.unsubscribe();
    };
  }, [initialized, fetchProfile]);

  const signUp = async (email: string, password: string) => {
    try {
      console.log('Attempting signup for:', email);
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
        console.error('Signup error:', error);
        return { error: error.message };
      }
      
      console.log('Signup successful');
      return { error: null };
    } catch (err) {
      console.error('Unexpected signup error:', err);
      return { error: 'An unexpected error occurred during signup.' };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Attempting sign in for:', email);
      const { error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      if (error) {
        console.error('Sign in error:', error);
        return { error: error.message };
      }
      
      console.log('Sign in successful');
      return { error: null };
    } catch (err) {
      console.error('Unexpected sign in error:', err);
      return { error: 'An unexpected error occurred during sign in.' };
    }
  };

  const signOut = async () => {
    try {
      console.log('Signing out...');
      await supabase.auth.signOut();
      console.log('Sign out successful');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      console.log('Sending password reset for:', email);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) {
        console.error('Password reset error:', error);
        return { error: error.message };
      }
      
      console.log('Password reset email sent');
      return { error: null };
    } catch (err) {
      console.error('Unexpected password reset error:', err);
      return { error: 'An unexpected error occurred during password reset.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{ 
        session, 
        user, 
        profile, 
        loading: loading && !initialized, // Only show loading during initial load
        signUp, 
        signIn, 
        signOut, 
        resetPassword, 
        refreshSession 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
