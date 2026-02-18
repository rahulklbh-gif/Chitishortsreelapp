import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'sonner';
import { BottomNavigation } from '@/app/components/BottomNavigation';
import { RealVideoFeed } from '@/app/components/RealVideoFeed';
import { CommentSheet } from '@/app/components/CommentSheet';
import { DiscoverPage } from '@/app/components/DiscoverPage';

// ✅ IMPORT FIX: Curly braces hata diye gaye hain
import CreatePage from '@/app/components/CreatePage'; 

import { InboxPage } from '@/app/components/InboxPage';
import { ProfilePage } from '@/app/components/ProfilePage';
import { AuthModal } from '@/app/components/AuthModal';
import { LogIn, Send } from 'lucide-react'; // ✅ Send icon add kiya
import { useAuth } from '@/contexts/AuthContext';

function AppContent() {
  const [commentSheetOpen, setCommentSheetOpen] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [videoOwnerId, setVideoOwnerId] = useState<string>(''); 
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { user, signOut } = useAuth();
  
  const navigate = useNavigate();
  const location = useLocation();

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
        <div className="fixed top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/90 to-transparent p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Chiti Shorts Reel
            </h1>
            {!user ? (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-sm font-semibold hover:opacity-90 transition"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
            ) : (
              /* ✅ FIX: Yahan se Sign Out hata diya aur Message Icon laga diya */
              <button
                onClick={() => navigate('/chats')} 
                className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition relative"
              >
                <Send size={22} className="-rotate-12" />
                {/* Notification dot */}
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-black"></span>
              </button>
            )}
          </div>
        </div>
      )}

      <main className={location.pathname === '/' ? '' : 'pt-0'}>
        <Routes>
          <Route 
            path="/" 
            element={<RealVideoFeed key={location.key} onComment={handleComment} />} 
          />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:username" element={<ProfilePage />} />
          {/* ✅ Naya Route Chat Page ke liye */}
          <Route path="/chats" element={<div className="text-white p-20">Chat List Page Coming Soon...</div>} />
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
      <Router>
        <AppContent />
        <Toaster 
          position="top-center"
          richColors
          closeButton
          theme="dark"
        />
      </Router>
    </AuthProvider>
  );
}

export default App;
