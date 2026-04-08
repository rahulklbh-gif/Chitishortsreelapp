import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { toast } from 'sonner';

// 1. Context Interface - Defines what data is available in the app
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: any }>; 
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions on page load
    const initializeAuth = async () => {
      try {
        const { data: { session: activeSession }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        setSession(activeSession);
        setUser(activeSession?.user ?? null);
      } catch (error: any) {
        console.error('Auth initialization error:', error.message);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes (Login, Logout, Token Refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);

      // ✅ FIXED: Login hote hi sirf EK BAAR reload hoga, loop nahi banega
      if (_event === 'SIGNED_IN') {
        const hasReloaded = sessionStorage.getItem('auth_reloaded');
        if (!hasReloaded) {
          sessionStorage.setItem('auth_reloaded', 'true');
          window.location.reload();
        }
      }

      // Logout hone par flag saaf kar dein taaki agli baar login par fir refresh ho sake
      if (_event === 'SIGNED_OUT') {
        sessionStorage.removeItem('auth_reloaded');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Google Sign-In Logic - YouTube Scopes Removed
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'openid email profile', 
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
          redirectTo: 'https://chitishort.store'
        }
      });

      if (error) throw error;
    } catch (error: any) {
      toast.error('Google Sign-In failed: ' + error.message);
      console.error('Sign-In Error:', error);
    }
  };

  // 3. Email Sign-In Logic
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  // 4. Email Sign-Up Logic
  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });
    return { error };
  };

  // 5. Sign Out Logic
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Logged out successfully');
      // Logout par bhi session storage clean kar dena chahiye
      sessionStorage.removeItem('auth_reloaded');
      window.location.reload();
    } catch (error: any) {
      toast.error('Error signing out');
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      signInWithGoogle, 
      signIn, 
      signUp, 
      signOut 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// Custom hook to use Auth
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
