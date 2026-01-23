import { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share } from 'lucide-react';

export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Check if already installed
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
    const hasSeenPrompt = localStorage.getItem('installPromptDismissed');
    
    if (isInstalled || hasSeenPrompt) {
      return;
    }

    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iOS = /iphone|ipad|ipod/.test(userAgent);
    const android = /android/.test(userAgent);

    setIsIOS(iOS);
    setIsAndroid(android);

    // Show prompt after a delay
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 3000);

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('installPromptDismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl shadow-2xl p-4 max-w-md mx-auto">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded-full transition"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-7 h-7 text-purple-600" />
          </div>
          
          <div className="flex-1">
            <h3 className="text-white font-bold text-lg mb-1">
              Install Chiti Shorts
            </h3>
            
            {isIOS ? (
              <div className="text-white/90 text-sm space-y-2">
                <p>Install this app on your iPhone:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Tap the <Share className="w-3 h-3 inline" /> Share button below</li>
                  <li>Scroll and tap "Add to Home Screen"</li>
                  <li>Tap "Add" in the top right</li>
                </ol>
              </div>
            ) : isAndroid || deferredPrompt ? (
              <>
                <p className="text-white/90 text-sm mb-3">
                  Install the app for a better experience!
                </p>
                <button
                  onClick={handleInstall}
                  className="w-full bg-white text-purple-600 font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-100 transition"
                >
                  <Download className="w-5 h-5" />
                  Install Now
                </button>
              </>
            ) : (
              <div className="text-white/90 text-sm space-y-2">
                <p>For the best experience:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Open menu (⋮) in your browser</li>
                  <li>Tap "Add to Home screen"</li>
                  <li>Tap "Install" or "Add"</li>
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
