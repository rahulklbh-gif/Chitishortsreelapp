import { Smartphone, Download, Share, MoreVertical, X } from 'lucide-react';
import { useState } from 'react';

interface InstallGuideProps {
  onClose: () => void;
}

export function InstallGuide({ onClose }: InstallGuideProps) {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'unknown'>('unknown');

  useState(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform('ios');
    } else if (/android/.test(userAgent)) {
      setPlatform('android');
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="w-8 h-8 text-white" />
              <div>
                <h2 className="text-xl font-bold text-white">Install App</h2>
                <p className="text-sm text-white/80">Add to your home screen</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* iOS Instructions */}
          {(platform === 'ios' || platform === 'unknown') && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
                  <span className="text-xl">🍎</span>
                </div>
                <h3 className="text-lg font-bold text-white">For iPhone/iPad</h3>
              </div>
              
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                    1
                  </div>
                  <div className="flex-1 text-gray-300">
                    <p className="font-semibold text-white mb-1">Open in Safari</p>
                    <p className="text-sm">This must be done in Safari browser</p>
                  </div>
                </li>
                
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                    2
                  </div>
                  <div className="flex-1 text-gray-300">
                    <p className="font-semibold text-white mb-1">Tap Share Button</p>
                    <div className="flex items-center gap-2 text-sm">
                      <Share className="w-4 h-4" />
                      <span>Tap this icon at the bottom</span>
                    </div>
                  </div>
                </li>
                
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                    3
                  </div>
                  <div className="flex-1 text-gray-300">
                    <p className="font-semibold text-white mb-1">Add to Home Screen</p>
                    <p className="text-sm">Scroll and find "Add to Home Screen"</p>
                  </div>
                </li>
                
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                    4
                  </div>
                  <div className="flex-1 text-gray-300">
                    <p className="font-semibold text-white mb-1">Tap Add</p>
                    <p className="text-sm">Confirm by tapping "Add" in top right</p>
                  </div>
                </li>
              </ol>
            </div>
          )}

          {/* Android Instructions */}
          {(platform === 'android' || platform === 'unknown') && (
            <div className="space-y-4 mt-8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
                  <span className="text-xl">🤖</span>
                </div>
                <h3 className="text-lg font-bold text-white">For Android</h3>
              </div>
              
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-pink-600 rounded-full flex items-center justify-center text-white font-bold">
                    1
                  </div>
                  <div className="flex-1 text-gray-300">
                    <p className="font-semibold text-white mb-1">Open Menu</p>
                    <div className="flex items-center gap-2 text-sm">
                      <MoreVertical className="w-4 h-4" />
                      <span>Tap three dots in top right corner</span>
                    </div>
                  </div>
                </li>
                
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-pink-600 rounded-full flex items-center justify-center text-white font-bold">
                    2
                  </div>
                  <div className="flex-1 text-gray-300">
                    <p className="font-semibold text-white mb-1">Select Install</p>
                    <p className="text-sm">Look for "Install app" or "Add to Home screen"</p>
                  </div>
                </li>
                
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-pink-600 rounded-full flex items-center justify-center text-white font-bold">
                    3
                  </div>
                  <div className="flex-1 text-gray-300">
                    <p className="font-semibold text-white mb-1">Confirm Install</p>
                    <p className="text-sm">Tap "Install" in the popup</p>
                  </div>
                </li>
              </ol>
            </div>
          )}

          {/* Benefits */}
          <div className="bg-gray-800 rounded-2xl p-4 space-y-2">
            <h4 className="font-semibold text-white mb-2">✨ Benefits:</h4>
            <ul className="space-y-1 text-sm text-gray-300">
              <li>✓ Full-screen app experience</li>
              <li>✓ Faster loading times</li>
              <li>✓ Works offline</li>
              <li>✓ Easy access from home screen</li>
            </ul>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-white font-semibold hover:opacity-90 transition"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}