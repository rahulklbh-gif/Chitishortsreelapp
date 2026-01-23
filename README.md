# 📱 Chiti Shorts Reel

A modern, mobile-optimized short video sharing platform built with React and optimized for low server costs. Think TikTok, but as a Progressive Web App!

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![PWA](https://img.shields.io/badge/PWA-ready-purple)

## ✨ Features

### 🎥 Core Features
- **Vertical Video Feed** - Full-screen, swipe-able vertical video scrolling
- **Social Interactions** - Like, comment, share, and follow creators
- **Trending Discovery** - Explore trending hashtags and popular creators
- **Video Creation** - Upload videos with filters and background music
- **User Profiles** - Manage your videos and view analytics
- **Real-time Notifications** - Get notified of likes, comments, and new followers

### 📱 Mobile-First Design
- **Responsive Layout** - Optimized for all screen sizes
- **Touch Gestures** - Swipe to navigate between videos
- **PWA Support** - Install on home screen like a native app
- **Offline Capability** - Basic functionality works without internet
- **Low Data Mode** - Optimized video streaming to save bandwidth

### 🔧 Technical Features
- **React 18** - Modern React with hooks
- **Tailwind CSS v4** - Utility-first styling
- **TypeScript** - Type-safe code
- **Supabase Integration** - Backend ready (optional)
- **LocalStorage** - Persistent user preferences
- **Service Worker** - Offline support and caching

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ or pnpm
- Modern web browser
- (Optional) Supabase account for backend

### Installation

```bash
# Clone the repository
git clone <your-repo-url>

# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build
```

## 📲 Install on Your Phone

This app is a **Progressive Web App (PWA)** that can be installed on your phone just like a native app!

### 🍎 iPhone/iPad (iOS)

1. **Open Safari browser**
2. **Navigate to the app URL**
3. **Tap the Share button** (square with arrow)
4. **Scroll down** and tap **"Add to Home Screen"**
5. **Tap "Add"** - Done! 🎉

### 🤖 Android

1. **Open Chrome browser**
2. **Navigate to the app URL**
3. **Tap the menu (⋮)** in the top right
4. **Select "Install app"** or **"Add to Home screen"**
5. **Tap "Install"** - Done! 🎉

Or simply wait for the automatic install prompt to appear!

### 💻 Desktop

1. **Open in Chrome or Edge**
2. **Click the install icon** in the address bar
3. **Click "Install"** - Opens in its own window!

📖 **[Full Installation Guide](./INSTALLATION_GUIDE.md)**

## 🏗️ Project Structure

```
chiti-shorts-reel/
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker
│   └── icon-*.png            # App icons
├── src/
│   ├── app/
│   │   ├── App.tsx           # Main app component
│   │   └── components/
│   │       ├── VideoFeed.tsx      # Vertical video feed
│   │       ├── VideoPlayer.tsx    # Individual video player
│   │       ├── VideoActions.tsx   # Like/Comment/Share buttons
│   │       ├── BottomNavigation.tsx # 5-tab navigation
│   │       ├── DiscoverPage.tsx   # Search & trending
│   │       ├── CreatePage.tsx     # Video upload
│   │       ├── InboxPage.tsx      # Notifications
│   │       ├── ProfilePage.tsx    # User profile
│   │       ├── CommentSheet.tsx   # Comments UI
│   │       ├── InstallPrompt.tsx  # PWA install prompt
│   │       └── mockData.ts        # Sample videos
│   ├── styles/
│   │   ├── index.css         # Global styles
│   │   ├── tailwind.css      # Tailwind imports
│   │   └── theme.css         # Custom theme
│   └── main.tsx              # App entry point
├── supabase/                 # Backend (optional)
│   └── functions/
│       └── server/
└── index.html                # HTML entry point
```

## 🎨 Components Overview

### Core Components

**VideoFeed**
- Vertical scrolling video container
- Touch and wheel event handling
- Automatic video playback on active slide

**VideoPlayer**
- HTML5 video player with controls
- Mute/unmute toggle
- Video info overlay (caption, hashtags, music)

**VideoActions**
- Like button with localStorage persistence
- Comment button with bottom sheet
- Share with native share API
- Follow/unfollow functionality

**BottomNavigation**
- 5-tab navigation system
- Home, Discover, Create, Inbox, Profile
- Active state indicators

**DiscoverPage**
- Trending hashtags grid
- Popular creators list
- Search functionality (UI ready)

**CreatePage**
- Video upload from gallery
- Filter selection (Grayscale, Sepia, etc.)
- Music track selection
- Caption with hashtags

**ProfilePage**
- User stats (followers, following, likes)
- Video grid layout
- Edit profile functionality

**InboxPage**
- Activity notifications
- Like, comment, follow, mention alerts
- Message placeholder

**CommentSheet**
- Bottom sheet modal
- Comment list with likes
- Add new comments
- Persistent in localStorage

## 🔐 Backend Integration (Optional)

The app is configured to work with Supabase but includes mock data for quick testing.

### Using Mock Data (Default)
- No setup required
- Data stored in localStorage
- Perfect for demos and prototypes

### Using Supabase Backend

Edit these files (already created if you set them up):
- `/utils/supabase/info.tsx` - Supabase credentials
- `/supabase/functions/server/index.tsx` - API routes
- `/supabase/functions/server/kv_store.tsx` - Data persistence

Features with backend:
- Real user authentication
- Persistent video storage
- Real-time comments and likes
- Cloud-based video hosting
- Cross-device sync

## 🎯 Optimization Features

### Low Server Cost Strategy

1. **Client-Side Processing**
   - Filters applied in browser
   - Video compression before upload
   - Cached video playback

2. **Efficient Storage**
   - 30-second video limit
   - Maximum 10MB per video
   - 480p/720p compression

3. **Smart Caching**
   - Service worker caching
   - Video thumbnail optimization
   - LocalStorage for user data

4. **Bandwidth Savings**
   - Lazy loading videos
   - Thumbnail previews
   - Progressive video loading

## 🌐 Browser Support

- ✅ Chrome 90+ (Android/Desktop)
- ✅ Safari 14+ (iOS/macOS)
- ✅ Firefox 88+
- ✅ Edge 90+
- ✅ Samsung Internet 14+

## 📱 Device Support

- ✅ iPhone 6S+ (iOS 11.3+)
- ✅ Android 5.0+
- ✅ iPad
- ✅ Desktop browsers

## 🚧 Roadmap

- [ ] Backend video upload integration
- [ ] Video recording with camera
- [ ] Advanced filters and effects
- [ ] Real-time chat/DMs
- [ ] Push notifications
- [ ] Video analytics
- [ ] Monetization features
- [ ] Live streaming
- [ ] Duet/Stitch features
- [ ] Green screen effects

## 🐛 Known Issues

- Service worker needs manual registration in some browsers
- iOS Safari requires user interaction for autoplay
- Videos must be under 30 seconds
- Some filters may not work on older devices

## 🤝 Contributing

This is a demo project built with Figma Make. Feel free to:
- Report bugs
- Suggest features
- Submit pull requests
- Share feedback

## 📄 License

MIT License - feel free to use this project for learning or commercial purposes.

## 💡 Tips for Best Experience

1. **Install the app** for full-screen experience
2. **Use WiFi** for initial video loading
3. **Allow notifications** for real-time updates
4. **Enable camera access** for video creation
5. **Grant storage access** for video uploads

## 🆘 Support

Having trouble installing? Check out:
- [Installation Guide](./INSTALLATION_GUIDE.md)
- [Troubleshooting Section](#-troubleshooting)

## 🎉 Credits

Built with:
- React
- Tailwind CSS
- Lucide Icons
- Supabase (optional)
- Vite

---

**Made with ❤️ using Figma Make**

🌟 **Star this repo** if you found it helpful!
