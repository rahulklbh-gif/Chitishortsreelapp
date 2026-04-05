import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
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
import { cn } from "@/lib/utils";

// --- STORY BAR COMPONENT (Naya Add kiya hai bina logic chhade) ---
function StoryBar({ users, navigate }: { users: any[], navigate: any }) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2 mt-2">
      {/* Add Story Button */}
      <div className="flex flex-col items-center gap-1 shrink-0" onClick={() => navigate('/create?type=story')}>
        <div className="relative size-14 rounded-full border-2 border-dashed border-zinc-500 flex items-center justify-center cursor-pointer">
          <Plus className="size-6 text-zinc-400" />
          <div className="absolute -bottom-1 -right-1 bg-blue-600 rounded-full p-1 border-2 border-black">
            <Plus className="size-3 text-white" />
          </div>
        </div>
        <span className="text-[10px] text-zinc-400">Your Story</span>
      </div>

      {/* Other Users Stories */}
      {users?.map((u) => (
        <div key={u.id} className="flex flex-col items-center gap-1 shrink-0 cursor-pointer">
          <div className={cn(
            "size-14 rounded-full p-[2px]",
            u.has_unseen_story ? "bg-gradient-to-tr from-yellow-400 via-orange-500 to-fuchsia-600" : "bg-zinc-700"
          )}>
            <div className="size-full rounded-full border-2 border-black overflow-hidden bg-zinc-900">
              <img src={u.avatar_url || "/default-avatar.png"} className="size-full object-cover" alt="story" />
            </div>
          </div>
          <span className="text-[10px] text-zinc-300 truncate w-14 text-center">{u.username}</span>
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

  // Story data state (Yahan Supabase se data aayega)
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
      {/* ✅ HEADER SECTION: Jahan pehle sirf H1 tha, ab wahan Story Bar hai */}
      {location.pathname === '/' && (
        <div className="fixed top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/95 via-black/70 to-transparent p-4 pb-2">
          <div className="flex items-center justify-between">
            {/* Branding ko thoda chhota karke side me kar diya */}
            <h1 className="text-xl font-black text-white italic tracking-tighter">
              CHITI
            </h1>
            
            <div className="flex items-center gap-3">
              {!user ? (
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-sm font-semibold hover:opacity-90 transition"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </button>
              ) : (
                <button
                  onClick={() => navigate('/chats')} 
                  className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition relative"
                >
                  <Send size={22} className="-rotate-12" />
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-black"></span>
                </button>
              )}
            </div>
          </div>

          {/* 📱 Naya Story Bar: Bilkul Instagram jaisa */}
          <StoryBar users={stories} navigate={navigate} />
        </div>
      )}

      {/* ⚠️ Content Margin: Story bar ki wajah se thoda gap zaroori hai */}
      <main className={location.pathname === '/' ? 'pt-4' : 'pt-0'}>
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

      {/* Same Bottom Nav & Sheets */}
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
      <Router>
        <AppContent />
        <Toaster position="top-center" richColors closeButton theme="dark" />
      </Router>
    </AuthProvider>
  );
}

export default App;
