import { useState } from 'react';
import { BottomNavigation } from '@/app/components/BottomNavigation';
import { VideoFeed } from '@/app/components/VideoFeed';
import { CommentSheet } from '@/app/components/CommentSheet';
import { DiscoverPage } from '@/app/components/DiscoverPage';
import { CreatePage } from '@/app/components/CreatePage';
import { InboxPage } from '@/app/components/InboxPage';
import { ProfilePage } from '@/app/components/ProfilePage';
import { InstallPrompt } from '@/app/components/InstallPrompt';
import { mockVideos } from '@/app/components/mockData';

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [commentSheetOpen, setCommentSheetOpen] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');

  const handleComment = (videoId: string) => {
    setSelectedVideoId(videoId);
    setCommentSheetOpen(true);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <VideoFeed videos={mockVideos} onComment={handleComment} />;
      case 'discover':
        return <DiscoverPage />;
      case 'create':
        return <CreatePage />;
      case 'inbox':
        return <InboxPage />;
      case 'profile':
        return <ProfilePage />;
      default:
        return <VideoFeed videos={mockVideos} onComment={handleComment} />;
    }
  };

  return (
    <div className="relative min-h-screen bg-black">
      {/* App Header - Only show on non-home tabs */}
      {activeTab === 'home' && (
        <div className="fixed top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/80 to-transparent p-4">
          <h1 className="text-2xl font-bold text-white text-center tracking-tight">
            Chiti Shorts Reel
          </h1>
        </div>
      )}

      {/* Main Content */}
      <main className={activeTab === 'home' ? '' : 'pt-0'}>
        {renderContent()}
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Comment Sheet */}
      <CommentSheet
        videoId={selectedVideoId}
        isOpen={commentSheetOpen}
        onClose={() => setCommentSheetOpen(false)}
      />

      {/* Install Prompt */}
      <InstallPrompt />
    </div>
  );
}

export default App;