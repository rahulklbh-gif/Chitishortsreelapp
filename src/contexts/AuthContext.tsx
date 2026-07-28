"use client";

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
      
      // ✅ SIGNED_IN par loading ko turant false karein aur reload sambhalein
      if (_event === 'SIGNED_IN') {
        setLoading(false); 
        const hasReloaded = sessionStorage.getItem('auth_reloaded');
        if (!hasReloaded) {
          sessionStorage.setItem('auth_reloaded', 'true');
          window.location.reload();
        }
      }

      if (_event === 'SIGNED_OUT') {
        setLoading(false);
        sessionStorage.removeItem('auth_reloaded');
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 🚀 GLOBAL REAL-TIME PRESENCE (User App me Kahin Bhi Ho - Online Dikhega)
  useEffect(() => {
    if (!user?.id) return;

    // Global Presence Channel for Online Status Tracking Across Entire App
    const globalPresence = supabase.channel('global-app-presence', {
      config: { presence: { key: user.id } }
    });

    globalPresence.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Track Online Status
        await globalPresence.track({ 
          online_at: new Date().toISOString(),
          user_id: user.id
        });
        
        // Update DB Last Seen for Backup
        await supabase.from('profiles').update({ 
          last_seen: new Date().toISOString() 
        }).eq('id', user.id);
      }
    });

    return () => {
      supabase.removeChannel(globalPresence);
    };
  }, [user?.id]);

  // 2. Google Sign-In Logic (Intact)
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

  // 3. Email Sign-In Logic (Intact)
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  // 4. Email Sign-Up Logic (Intact)
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

  // 5. Sign Out Logic (Intact)
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Logged out successfully');
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
      {/* ✅ Yahan change kiya hai: Loading hone par bhi children render honge */}
      {children}
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
