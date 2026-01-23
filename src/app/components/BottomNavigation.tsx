import { Home, Search, PlusSquare, Mail, User } from 'lucide-react';

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
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

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center justify-center flex-1 h-full relative"
            >
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
