import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'sonner';
import { BottomNavigation } from '@/app/components/BottomNavigation';
import { RealVideoFeed } from '@/app/components/RealVideoFeed';
import { CommentSheet } from '@/app/components/CommentSheet';
import { DiscoverPage } from '@/app/components/DiscoverPage';
import { CreatePage } from '@/app/components/CreatePage';
import { InboxPage } from '@/app/components/InboxPage';
import { ProfilePage } from '@/app/components/ProfilePage';
import { AuthModal } from '@/app/components/AuthModal';
import { LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

function AppContent() {
  const [commentSheetOpen, setCommentSheetOpen] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { user, signOut } = useAuth();
  
  // React Router ke hooks
  const navigate = useNavigate();
  const location = useLocation();

  // Active tab ko URL se match karne ke liye logic
  const activeTab = location.pathname === '/' ? 'home' : 
                    location.pathname.startsWith('/discover') ? 'discover' :
                    location.pathname.startsWith('/create') ? 'create' :
                    location.pathname.startsWith('/inbox') ? 'inbox' :
                    location.pathname.startsWith('/profile') ? 'profile' : 'home';

  const handleComment = (videoId: string) => {
    setSelectedVideoId(videoId);
    setCommentSheetOpen(true);
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'home') navigate('/');
    else navigate(`/${tab}`);
  };

  return (
    <div className="relative min-h-screen bg-black">
      {/* App Header - Only show on home tab */}
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
              <button
                onClick={() => signOut()}
                className="px-4 py-2 bg-gray-800 rounded-full text-sm font-semibold text-white hover:bg-gray-700 transition"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content using Routes */}
      <main className={location.pathname === '/' ? '' : 'pt-0'}>
        <Routes>
          <Route path="/" element={<RealVideoFeed onComment={handleComment} />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:username" element={<ProfilePage />} />
        </Routes>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Comment Sheet */}
      <CommentSheet
        videoId={selectedVideoId}
        isOpen={commentSheetOpen}
        onClose={() => setCommentSheetOpen(false)}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
}

// Main App component wrapping everything in Router
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
