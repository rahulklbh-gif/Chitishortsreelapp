import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'sonner';
import { BottomNavigation } from '@/app/components/BottomNavigation';
import { RealVideoFeed } from '@/app/components/RealVideoFeed';
import { CommentSheet } from '@/app/components/CommentSheet';
import { DiscoverPage } from '@/app/components/DiscoverPage';

// ✅ FIX: Curly braces {} hata diye kyunki CreatePage "default export" hai
import CreatePage from '@/app/components/CreatePage'; 

import { InboxPage } from '@/app/components/InboxPage';
import { ProfilePage } from '@/app/components/ProfilePage';
import { AuthModal } from '@/app/components/AuthModal';
import { LogIn } from 'lucide-react';
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
            <h1 className="text-2xl font-black italic text-white tracking-tighter">
              CHITI <span className="text-blue-500">SHORTS</span>
            </h1>
            {!user ? (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-full text-sm font-bold hover:opacity-90 transition shadow-lg shadow-blue-600/20"
              >
                <LogIn className="w-4 h-4" />
                SIGN IN
              </button>
            ) : (
              <button
                onClick={() => signOut()}
                className="px-4 py-2 bg-white/10 rounded-full text-sm font-bold text-white hover:bg-white/20 transition"
              >
                LOGOUT
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
