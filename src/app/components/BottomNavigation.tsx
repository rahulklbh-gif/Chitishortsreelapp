import { Home, Search, PlusSquare, Mail, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  const { user } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (user) {
      checkUnread();

      // Real-time: Naya notification aate hi dot dikhao
      const channel = supabase
        .channel('new-notifications')
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'notifications', 
            filter: `receiver_id=eq.${user.id}` 
          }, 
          () => setHasUnread(true)
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [user]);

  // Jab user Inbox tab par click kare, dot hata do
  useEffect(() => {
    if (activeTab === 'inbox') {
      setHasUnread(false);
    }
  }, [activeTab]);

  const checkUnread = async () => {
    if (!user) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('is_read', false);
    
    setHasUnread((count ?? 0) > 0);
  };

  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'discover', icon: Search, label: 'Discover' },
    { id: 'create', icon: PlusSquare, label: 'Create' },
    { id: 'inbox', icon: Mail, label: 'Inbox' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 z-50 safe-area-bottom">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isCreate = tab.id === 'create';
          const isInbox = tab.id === 'inbox';

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center justify-center flex-1 h-full relative"
            >
              <div className="relative">
                {isCreate ? (
                  <div className={`${isActive ? 'bg-gradient-to-r from-purple-600 to-pink-600' : 'bg-white'} p-2 rounded-lg`}>
                    <Icon className="w-6 h-6 text-black" strokeWidth={2} />
                  </div>
                ) : (
                  <Icon
                    className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-400'}`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                )}

                {/* PROBLEM 4 FIX: RED NOTIFICATION DOT */}
                {isInbox && hasUnread && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-black"></span>
                  </span>
                )}
              </div>
              
              <span className={`text-xs mt-1 ${isActive ? 'text-white' : 'text-gray-400'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
