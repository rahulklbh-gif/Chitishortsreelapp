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
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Google Sign-In Logic with YouTube Permissions
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // IMPORTANT: Space-separated scopes for YouTube Upload
          scopes: 'openid email profile https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent', // Forces Google to show the permission screen
          },
          redirectTo: window.location.origin
        }
      });

      if (error) throw error;
    } catch (error: any) {
      toast.error('Google Sign-In failed: ' + error.message);
      console.error('Sign-In Error:', error);
    }
  };

  // 3. Sign Out Logic
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Logged out successfully');
    } catch (error: any) {
      toast.error('Error signing out');
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithGoogle, signOut }}>
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
