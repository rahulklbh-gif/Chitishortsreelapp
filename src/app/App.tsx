import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { WatchPartyProvider } from '@/contexts/WatchPartyContext'; // 👈 WatchParty Provider Import
import { Toaster } from 'sonner';
import { BottomNavigation } from '@/app/components/BottomNavigation';
import { RealVideoFeed } from '@/app/components/RealVideoFeed';
import { CommentSheet } from '@/app/components/CommentSheet';
import { DiscoverPage } from '@/app/components/DiscoverPage';
import CreatePage from '@/app/components/CreatePage'; 
import { InboxPage } from '@/app/components/InboxPage';
import { ProfilePage } from '@/app/components/ProfilePage';
import { AuthModal } from '@/app/components/AuthModal';
import { LogIn, Send, Plus } from 'lucide-react'; 
import { useAuth } from '@/contexts/AuthContext';
import { ChatListPage } from '@/app/components/ChatListPage';
import { ChatRoom } from '@/app/components/ChatRoom';

// Sahi path aapke screenshot ke mutabiq
import { cn } from "@/app/components/ui/utils";

// --- STORY BAR COMPONENT (Transparent background aur alignment fix kiya) ---
function StoryBar({ users, navigate }: { users: any[], navigate: any }) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2 px-1">
      {/* 🟢 STORY BUTTON: Ab ye top-left corner mein message icon ke barabar alignment mein hai */}
      <div className="flex flex-col items-center gap-1 shrink-0" onClick={() => navigate('/create?type=story')}>
        <div className="relative size-12 rounded-full border-2 border-dashed border-white/50 flex items-center justify-center cursor-pointer hover:border-white transition-all shadow-lg">
          <Plus className="size-5 text-white" />
          <div className="absolute -bottom-1 -right-1 bg-blue-600 rounded-full p-0.5 border-2 border-black">
            <Plus className="size-2.5 text-white" />
          </div>
        </div>
        <span className="text-[9px] text-white font-medium drop-shadow-md">Your Story</span>
      </div>

      {/* Other Users Stories */}
      {users?.map((u) => (
        <div key={u.id} className="flex flex-col items-center gap-1 shrink-0 cursor-pointer">
          <div className={cn(
            "size-12 rounded-full p-[2px]",
            u.has_unseen_story ? "bg-gradient-to-tr from-yellow-400 via-orange-500 to-fuchsia-600" : "bg-white/20"
          )}>
            <div className="size-full rounded-full border-2 border-black overflow-hidden bg-zinc-900">
              <img src={u.avatar_url || "/default-avatar.png"} className="size-full object-cover" alt="story" />
            </div>
          </div>
          <span className="text-[9px] text-white truncate w-12 text-center drop-shadow-md">{u.username}</span>
        </div>
      ))}
    </div>
  );
}

function AppContent() {
  const [commentSheetOpen, setCommentSheetOpen] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [videoOwnerId, setVideoOwnerId] = useState<string>(''); 
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { user } = useAuth();
  
  const navigate = useNavigate();
  const location = useLocation();
  const [stories, setStories] = useState([]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      console.log('Chiti Shorts is ready to be installed');
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const activeTab = location.pathname === '/' ? 'home' : 
                    location.pathname.startsWith('/discover') ? 'discover' :
                    location.pathname.startsWith('/create') ? 'create' :
                    location.pathname.startsWith('/inbox') ? 'inbox' :
                    location.pathname.startsWith('/profile') ? 'profile' : 'home';

  const handleComment = (videoId: string, ownerId: string) => {
    setSelectedVideoId(videoId);
    setVideoOwnerId(ownerId);
    setCommentSheetOpen(true);
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'home') navigate('/');
    else navigate(`/${tab}`);
  };

  return (
    <div className="relative min-h-screen bg-black">
      {location.pathname === '/' && (
        /* ✅ Header ko transparent kiya aur padding kam ki taaki video clear dikhe */
        <div className="fixed top-0 left-0 right-0 z-30 bg-transparent p-3 pt-2">
          <div className="flex items-start justify-between">
            
            {/* 📱 Story Bar: Ab ye sabse upar corner mein hai */}
            <StoryBar users={stories} navigate={navigate} />

            {/* Message/Auth Icons: Inka position Story button ke level mein set kiya */}
            <div className="flex items-center pt-1 px-1">
              {!user ? (
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-xs font-semibold hover:opacity-90 transition shadow-lg"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign In
                </button>
              ) : (
                <button
                  onClick={() => navigate('/chats')} 
                  className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40 transition relative border border-white/10"
                >
                  <Send size={20} className="-rotate-12" />
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-black"></span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video content ko upar tak stretch rakha hai taaki header niche na aaye */}
      <main className="pt-0">
        <Routes>
          <Route path="/" element={<RealVideoFeed key={location.key} onComment={handleComment} />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:username" element={<ProfilePage />} />
          <Route path="/chats" element={<ChatListPage />} />
          <Route path="/chat/:roomId" element={<ChatRoom />} />
        </Routes>
      </main>

      <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
      <CommentSheet
        videoId={selectedVideoId}
        videoOwnerId={videoOwnerId}
        isOpen={commentSheetOpen}
        onClose={() => setCommentSheetOpen(false)}
      />
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <WatchPartyProvider> {/* 🔴 Root Global Persistent Connection Context Wrapper */}
        <Router>
          <AppContent />
          <Toaster position="top-center" richColors closeButton theme="dark" />
        </Router>
      </WatchPartyProvider>
    </AuthProvider>
  );
}

export default App;
