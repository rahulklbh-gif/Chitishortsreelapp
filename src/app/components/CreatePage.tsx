import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Music,
  Settings,
  RotateCcw, // For Flip
  Sparkles, // For Effects
  Zap, // For Flash
  ChevronDown,
  Video as VideoIcon, // For Preview icon placeholder
  Search,
  Play,
  Pause,
  Check,
  ArrowLeft,
  ChevronRight,
  Upload, // For Gallery Upload
  Trash2, // For Reshoot/Discard
} from 'lucide-react';

// ==============================================
// 1. DATA & CONFIGURATION
// ==============================================

// 20 Filters Data (Simulation of complex filters using CSS properties for demo)
const FILTER_TYPES = {
  NORMAL: 'normal',
  VIVID: 'vivid',
  WARM: 'warm',
  COOL: 'cool',
  SEPIA: 'sepia',
  MONO: 'mono',
  NOIR: 'noir',
  DRAMATIC: 'dramatic',
  SILVER: 'silver',
  PLATINUM: 'platinum',
  VINTAGE: 'vintage',
  RETRO: 'retro',
  FADE: 'fade',
  BRIGHT: 'bright',
  DARK: 'dark',
  CINEMA: 'cinema',
  CLASSIC: 'classic',
  SOFT: 'soft',
  SHARP: 'sharp',
  DREAMY: 'dreamy',
};

const FILTERS_DATA = [
  { id: FILTER_TYPES.NORMAL, name: 'Normal', style: {} },
  { id: FILTER_TYPES.VIVID, name: 'Vivid', style: { filter: 'saturate(1.5) contrast(1.1)' } },
  { id: FILTER_TYPES.WARM, name: 'Warm', style: { filter: 'sepia(0.3) hue-rotate(-10deg)' } },
  { id: FILTER_TYPES.COOL, name: 'Cool', style: { filter: 'hue-rotate(30deg) saturate(1.1)' } },
  { id: FILTER_TYPES.SEPIA, name: 'Sepia', style: { filter: 'sepia(0.8)' } },
  { id: FILTER_TYPES.MONO, name: 'Mono', style: { filter: 'grayscale(1)' } },
  { id: FILTER_TYPES.NOIR, name: 'Noir', style: { filter: 'grayscale(1) contrast(1.5) brightness(0.8)' } },
  { id: FILTER_TYPES.DRAMATIC, name: 'Dramatic', style: { filter: 'contrast(1.4) brightness(0.9)' } },
  { id: FILTER_TYPES.SILVER, name: 'Silver', style: { filter: 'grayscale(1) brightness(1.2)' } },
  { id: FILTER_TYPES.PLATINUM, name: 'Platinum', style: { filter: 'grayscale(1) contrast(0.8) brightness(1.3)' } },
  { id: FILTER_TYPES.VINTAGE, name: 'Vintage', style: { filter: 'sepia(0.5) contrast(1.2) brightness(0.9)' } },
  { id: FILTER_TYPES.RETRO, name: 'Retro', style: { filter: 'hue-rotate(-20deg) contrast(1.1) saturate(0.8)' } },
  { id: FILTER_TYPES.FADE, name: 'Fade', style: { filter: 'opacity(0.8) contrast(0.9)' } },
  { id: FILTER_TYPES.BRIGHT, name: 'Bright', style: { filter: 'brightness(1.3)' } },
  { id: FILTER_TYPES.DARK, name: 'Dark', style: { filter: 'brightness(0.7)' } },
  { id: FILTER_TYPES.CINEMA, name: 'Cinema', style: { filter: 'contrast(1.3) saturate(1.2) sepia(0.2)' } },
  { id: FILTER_TYPES.CLASSIC, name: 'Classic', style: { filter: 'grayscale(0.8) contrast(1.1)' } },
  { id: FILTER_TYPES.SOFT, name: 'Soft', style: { filter: 'blur(0.5px) brightness(1.1)' } },
  { id: FILTER_TYPES.SHARP, name: 'Sharp', style: { filter: 'contrast(1.5)' } },
  { id: FILTER_TYPES.DREAMY, name: 'Dreamy', style: { filter: 'blur(1px) saturate(1.5) brightness(1.2)' } },
];

// Dummy Music Data
const MUSIC_DATA = [
  { id: '1', title: 'Mere Jaisa', duration: '00:30', url: 'path/to/sound1.mp3' }, // Replace with real URLs
  { id: '2', title: 'Sach Kehte Hain', duration: '00:45', url: 'path/to/sound2.mp3' },
  { id: '3', title: 'Ye Dil Ye Dil', duration: '01:00', url: 'path/to/sound3.mp3' },
  { id: '4', title: 'Jo Aankh Lad Jaye', duration: '00:30', url: 'path/to/sound4.mp3' },
  { id: '5', title: 'Holi Special', duration: '00:15', url: 'path/to/sound5.mp3' },
  { id: '6', title: 'Trending Beat', duration: '00:30', url: 'path/to/sound6.mp3' },
];

const TIMERS = [15, 30, 60];

// ==============================================
// 2. MAIN COMPONENT
// ==============================================

const ShortVideoCreator = () => {
  // --- STATES ---

  // Modes used to switch screens
  const MODES = {
    CAMERA: 'camera',
    MUSIC_SELECTION: 'music_selection',
    PREVIEW: 'preview', // Used after recording OR gallery upload
  };
  const [currentMode, setCurrentMode] = useState(MODES.CAMERA);

  // Camera & Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [selectedTimer, setSelectedTimer] = useState(15); // Default 15s
  const [facingMode, setFacingMode] = useState('user'); // 'user' (front) or 'environment' (back)
  const [flashMode, setFlashMode] = useState('off'); // 'off', 'on', 'auto'

  // Selection States
  const [selectedMusic, setSelectedMusic] = useState(null); // { id, title, url }
  const [selectedFilterId, setSelectedFilterId] = useState(FILTER_TYPES.NORMAL);
  const [showFilterSelector, setShowFilterSelector] = useState(false); // To toggle filter tray in camera mode

  // Preview/Gallery States
  const [recordedVideoURI, setRecordedVideoURI] = useState(null); // URL of recorded or uploaded video

  // Music Player States (for selection screen)
  const [playingMusicId, setPlayingMusicId] = useState(null);

  // --- REFS ---
  const cameraVideoRef = useRef(null); // Live camera feed
  const previewVideoRef = useRef(null); // Recorded/Uploaded video playback
  const mediaRecorderRef = useRef(null);
  const audioPlayerRef = useRef(new Audio()); // THE MUSIC PLAYER FIX
  const recordingTimerInterval = useRef(null);
  const chunks = useRef([]);

  // ==============================================
  // 3. EFFECTS & LOGIC
  // ==============================================

  // --- Camera Stream Initialization ---
  useEffect(() => {
    let stream = null;
    const startCamera = async () => {
      if (currentMode !== MODES.CAMERA) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode },
          audio: true, // Always capture microphone
        });
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        // Handle permission errors here
      }
    };

    startCamera();

    // Cleanup function to stop camera stream when changing modes or unmounting
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [currentMode, facingMode]);

  // --- MUSIC PLAYER LOGIC (THE FIX) ---
  useEffect(() => {
    // When selectedMusic changes, load it into our audio player ref
    if (selectedMusic && selectedMusic.url) {
      audioPlayerRef.current.src = selectedMusic.url;
      audioPlayerRef.current.load();
      console.log("Music loaded ready for recording:", selectedMusic.title);
    } else {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current.removeAttribute('src');
    }
  }, [selectedMusic]);

  // --- Recording Start/Stop Logic ---
  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = () => {
    if (!cameraVideoRef.current || !cameraVideoRef.current.srcObject) return;

    chunks.current = [];
    // Need to ensure we record both video and audio tracks if available
    const stream = cameraVideoRef.current.srcObject;
    const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? { mimeType: 'video/webm;codecs=vp9' } : { mimeType: 'video/webm' };
    mediaRecorderRef.current = new MediaRecorder(stream, options);

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.current.push(event.data);
      }
    };

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunks.current, { type: 'video/webm' });
      const videoURL = URL.createObjectURL(blob);
      setRecordedVideoURI(videoURL);
      setCurrentMode(MODES.PREVIEW); // Switch to preview screen
      setShowFilterSelector(true); // Ensure filters are visible in preview
      clearInterval(recordingTimerInterval.current);
      setRecordingDuration(0);
      // Stop music if it was playing
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    };

    // --- FIX: Play Music When Recording Starts ---
    if (selectedMusic && audioPlayerRef.current.src) {
        // Reset to start in case it was played before
        audioPlayerRef.current.currentTime = 0;
        // Using catch for browsers that block autoplay without interaction
        audioPlayerRef.current.play().catch(e => console.error("Audio play failed (autoplay policy):", e));
    }
    // -------------------------------------------

    mediaRecorderRef.current.start();
    setIsRecording(true);

    // Start Timer
    let duration = 0;
    recordingTimerInterval.current = setInterval(() => {
      duration += 1;
      setRecordingDuration(duration);
      // Auto-stop based on selected timer
      if (duration >= selectedTimer) {
        stopRecording();
      }
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
       // Audio stops in onstop handler above
    }
  };

  // --- Gallery Upload Logic ---
  const handleGalleryUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('video/')) {
      const videoURL = URL.createObjectURL(file);
      setRecordedVideoURI(videoURL);
      // If uploading from gallery, we might want to clear previously selected music for recording
      // setSelectedMusic(null);
      setCurrentMode(MODES.PREVIEW);
      setShowFilterSelector(true); // FIX: Ensure filters show up for gallery uploads too
    }
  };

  // --- Music Selection Screen Handlers ---
  const handlePlayPreview = (musicId, url) => {
    // Simple preview player logic for selection screen (separate from recording player)
    const previewPlayer = document.getElementById('music-preview-player');
    if (playingMusicId === musicId) {
      previewPlayer.pause();
      setPlayingMusicId(null);
    } else {
      previewPlayer.src = url;
      previewPlayer.play().catch(e => console.log("Preview play failed", e));
      setPlayingMusicId(musicId);
    }
  };

  const handleSelectMusic = (music) => {
    setSelectedMusic(music);
    setPlayingMusicId(null);
    setCurrentMode(MODES.CAMERA); // Go back to camera
  };

  // --- Reshoot / Discard Logic ---
  const handleReshoot = () => {
    setRecordedVideoURI(null);
    // Don't reset filter or music, users usually want to keep settings for reshoot
    setCurrentMode(MODES.CAMERA);
  };

  // Helper to get current filter style object
  const getCurrentFilterStyle = () => {
    const filter = FILTERS_DATA.find(f => f.id === selectedFilterId);
    return filter ? filter.style : {};
  };

  // ==============================================
  // 4. RENDERING (UI)
  // ==============================================

  // ---- RENDER: Top Bar Controls (Camera Mode) ----
  const renderTopBar = () => (
    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/50 to-transparent">
      <button className="p-2 rounded-full bg-black/40 text-white">
        <X size={24} />
      </button>

      {/* Music Selector Pill */}
      <button
        onClick={() => setCurrentMode(MODES.MUSIC_SELECTION)}
        className={`flex items-center space-x-2 px-4 py-2 rounded-full ${selectedMusic ? 'bg-pink-600' : 'bg-black/40'} text-white font-semibold truncate max-w-[60%]`}
      >
        <Music size={18} />
        <span className="truncate">{selectedMusic ? selectedMusic.title : 'Add Sound'}</span>
      </button>

      <button className="p-2 rounded-full bg-black/40 text-white">
        <Settings size={24} />
      </button>
    </div>
  );

  // ---- RENDER: Right Side Toolbar (Camera Mode) ----
  const renderRightToolbar = () => (
    <div className="absolute top-20 right-4 flex flex-col space-y-6 z-20 items-center">
      {/* Flip */}
      <button onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')} className="flex flex-col items-center text-white space-y-1">
        <div className="p-3 bg-black/40 rounded-full"><RotateCcw size={24} /></div>
        <span className="text-xs shadow-sm">Flip</span>
      </button>

      {/* Effects (Toggles Filter Selector) */}
      <button onClick={() => setShowFilterSelector(!showFilterSelector)} className="flex flex-col items-center text-white space-y-1">
        <div className={`p-3 rounded-full ${showFilterSelector ? 'bg-cyan-500' : 'bg-black/40'}`}><Sparkles size={24} /></div>
        <span className="text-xs shadow-sm">Effects</span>
      </button>
      
      {/* Flash */}
      <button onClick={() => setFlashMode(prev => prev === 'on' ? 'off' : 'on')} className="flex flex-col items-center text-white space-y-1">
         <div className={`p-3 rounded-full ${flashMode === 'on' ? 'bg-yellow-500 text-black' : 'bg-black/40'}`}><Zap size={24} fill={flashMode === 'on' ? "currentColor" : "none"} /></div>
        <span className="text-xs shadow-sm">Flash</span>
      </button>

       {/* Preview Icon Placeholder (as seen in screenshot 1) */}
       <button className="flex flex-col items-center text-white space-y-1 opacity-50">
         <div className="p-3 bg-black/40 rounded-lg"><VideoIcon size={24} /></div>
        <span className="text-xs shadow-sm">Preview</span>
      </button>
    </div>
  );

  // ---- RENDER: Bottom Recording Controls (Camera Mode) ----
  const renderBottomControls = () => {
    const progressPercentage = (recordingDuration / selectedTimer) * 100;

    return (
      <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col items-center z-20 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
        
        {/* Timer Selection Pills */}
        {!isRecording && (
          <div className="flex space-x-4 mb-6 bg-black/40 p-1 rounded-full">
            {TIMERS.map(time => (
              <button
                key={time}
                onClick={() => setSelectedTimer(time)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${selectedTimer === time ? 'bg-white text-black' : 'text-white/70'}`}
              >
                {time}S
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center w-full px-8">
          {/* Gallery Upload Input */}
          {!isRecording ? (
             <div className="flex flex-col items-center justify-center w-12">
                 <label htmlFor="gallery-upload" className="p-3 bg-black/40 rounded-lg border-2 border-white/20 cursor-pointer">
                  <Upload size={24} className="text-white" />
                  <input 
                      id="gallery-upload" 
                      type="file" 
                      accept="video/*" 
                      className="hidden" 
                      onChange={handleGalleryUpload}
                  />
                </label>
                 <span className="text-white text-[10px] mt-1 font-medium">Upload</span>
             </div>
          ) : <div className="w-12"></div>}

          {/* Recording Button with Progress Ring */}
          <div className="relative">
             {isRecording && (
                <svg className="w-24 h-24 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 pointer-events-none">
                   <circle cx="48" cy="48" r="46" stroke="white" strokeWidth="4" fill="none" className="opacity-30"/>
                   <circle 
                     cx="48" cy="48" r="46" stroke="#ff0050" strokeWidth="4" fill="none"
                     strokeDasharray={`${2 * Math.PI * 46}`}
                     strokeDashoffset={`${2 * Math.PI * 46 * (1 - progressPercentage / 100)}`}
                     className="transition-all duration-200 ease-linear"
                   />
                </svg>
             )}
            <button
              onClick={toggleRecording}
              className={`rounded-full border-4 transition-all duration-200 ${isRecording ? 'w-10 h-10 bg-red-600 border-transparent rounded-lg' : 'w-20 h-20 bg-red-600 border-white'}`}
            ></button>
          </div>

           {/* Placeholder for balance */}
           <div className="w-12"></div>
        </div>
      </div>
    );
  };

  // ---- RENDER: Filter Horizontal List (Shared between Camera & Preview) ----
  const renderFilterSelector = () => {
    if (!showFilterSelector && currentMode === MODES.CAMERA) return null;

    return (
      <div className={`absolute left-0 right-0 transition-all duration-300 z-30 ${currentMode === MODES.CAMERA ? (showFilterSelector ? 'bottom-32' : '-bottom-24 opacity-0') : 'bottom-24'}`}>
        <div className="overflow-x-auto whitespace-nowrap px-4 py-2 no-scrollbar hide-scrollbar" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
          {FILTERS_DATA.map(filter => {
             const isActive = selectedFilterId === filter.id;
             return (
            <button
              key={filter.id}
              onClick={() => setSelectedFilterId(filter.id)}
              className="inline-flex flex-col items-center mx-2 space-y-2"
            >
              <div className={`w-16 h-20 rounded-lg overflow-hidden border-2 transition-all ${isActive ? 'border-cyan-400 scale-110' : 'border-white/30 opacity-70'}`}>
                {/* In a real app, these thumbs would have the filter applied too */}
                <img src={filter.thumb} alt={filter.name} className="w-full h-full object-cover" style={filter.style} />
              </div>
              <span className={`text-[10px] font-medium ${isActive ? 'text-cyan-400' : 'text-white/70'}`}>{filter.name}</span>
            </button>
          )})}
        </div>
      </div>
    );
  };

  // ==============================================
  // 5. MAIN RENDER SWITCH
  // ==============================================
  
  // ---- SCREEN 1: Camera Recording Mode ----
  if (currentMode === MODES.CAMERA) {
    return (
      <div className="relative h-screen w-full bg-black overflow-hidden font-sans">
        {/* Live Video Feed with Filter Applied */}
        <video
          ref={cameraVideoRef}
          autoPlay
          playsInline
          muted // Mute video feed itself, we handle audio separately
          className={`w-full h-full object-cover transform ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          // FIX: Apply filter style to live camera
          style={getCurrentFilterStyle()}
        ></video>

        {renderTopBar()}
        {renderRightToolbar()}
        {renderFilterSelector()}
        {renderBottomControls()}
        
        {/* Timer display when recording */}
        {isRecording && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-600 px-3 py-1 rounded flex items-center space-x-1 z-20 animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span className="text-white text-xs font-bold">{recordingDuration}s / {selectedTimer}s</span>
            </div>
        )}
      </div>
    );
  }

  // ---- SCREEN 2: Music Selection Mode ----
  if (currentMode === MODES.MUSIC_SELECTION) {
    return (
      <div className="relative h-screen w-full bg-zinc-950 text-white font-sans flex flex-col">
         {/* Hidden audio element for previewing tracks */}
         <audio id="music-preview-player" className="hidden"></audio>
         
        <div className="p-4 flex items-center border-b border-zinc-800">
          <button onClick={() => setCurrentMode(MODES.CAMERA)} className="p-2">
            <X size={24} />
          </button>
          {/* Search Bar */}
          <div className="flex-1 ml-4 bg-zinc-800 rounded-lg flex items-center px-3 py-2">
             <Search size={18} className="text-zinc-400 mr-2"/>
             <input type="text" placeholder="Search sounds..." className="bg-transparent outline-none flex-1 text-sm text-white placeholder-zinc-400"/>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {MUSIC_DATA.map(music => {
            const isPlaying = playingMusicId === music.id;
            const isSelected = selectedMusic && selectedMusic.id === music.id;
            return (
            <div key={music.id} className="flex items-center justify-between p-3 hover:bg-zinc-900 rounded-lg">
              <div className="flex items-center space-x-4">
                 {/* Play/Pause Preview Button */}
                <button 
                    onClick={() => handlePlayPreview(music.id, music.url)}
                    className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center border border-zinc-700 text-red-500"
                >
                    {isPlaying ? <Pause size={20} fill="currentColor"/> : <Play size={20} fill="currentColor" className="ml-1"/>}
                </button>
                <div>
                  <h3 className="font-semibold text-sm">{music.title}</h3>
                  <p className="text-xs text-zinc-400">{music.duration}</p>
                </div>
              </div>
              {/* Use Button */}
              <button
                onClick={() => handleSelectMusic(music)}
                className={`px-4 py-1.5 rounded text-xs font-bold ${isSelected ? 'bg-zinc-700 text-white border border-zinc-600' : 'bg-red-600 text-white'}`}
              >
                {isSelected ? 'USED' : 'USE'}
              </button>
            </div>
          )})}
        </div>
      </div>
    );
  }

  // ---- SCREEN 3: Preview Mode (Post-Recording or Gallery Upload) ----
  if (currentMode === MODES.PREVIEW) {
    return (
      <div className="relative h-screen w-full bg-black overflow-hidden font-sans">
        {/* Preview Video with Filter Applied */}
        <video
          ref={previewVideoRef}
          src={recordedVideoURI}
          autoPlay
          loop
          playsInline
          // Ensure audio from the video file plays here
          className="w-full h-full object-contain bg-zinc-900"
          // FIX: Apply filter style to preview video (works for recorded OR gallery upload)
          style={getCurrentFilterStyle()}
        ></video>

        {/* Top Bar - Back/Close */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/50 to-transparent">
          <button onClick={handleReshoot} className="p-2 rounded-full bg-black/40 text-white">
             <X size={24} />
          </button>
          {selectedMusic && (
               <div className="flex items-center space-x-2 px-4 py-2 rounded-full bg-black/40 text-white font-semibold text-xs">
                 <Music size={14} /> <span>{selectedMusic.title}</span>
               </div>
          )}
           <div className="w-10"></div> {/* Spacer */}
        </div>
        
        {/* Right Toolbar - Suggestion: Maybe keep effects button here to toggle drawer? */}
        <div className="absolute top-20 right-4 flex flex-col space-y-6 z-20 items-center">
           <button className="flex flex-col items-center text-white space-y-1">
            <div className="p-3 bg-black/40 rounded-full text-cyan-400"><Sparkles size={24} /></div>
            <span className="text-xs shadow-sm">Effects</span>
          </button>
          {/* Add Stickers, Text, etc. here */}
        </div>

        {/* Bottom Area: Filters + Next Button */}
        <div className="absolute bottom-0 left-0 right-0 z-30 flex flex-col">
             {/* FIX: Render the filter selector here in preview mode */}
            {renderFilterSelector()}

            <div className="p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex justify-between items-center">
                 {/* Reshoot/Discard */}
                <button onClick={handleReshoot} className="flex flex-col items-center text-white/80 hover:text-white">
                     <div className="p-3 bg-zinc-800/80 rounded-full mb-1"><Trash2 size={20}/></div>
                    <span className="text-xs">Reshoot</span>
                </button>

                {/* Next Button */}
                <button className="px-8 py-3 bg-red-600 rounded-full text-white font-bold flex items-center space-x-2 shadow-lg shadow-red-600/30">
                    <span>Next</span>
                    <ChevronRight size={20}/>
                </button>
            </div>
        </div>
      </div>
    );
  }

  return null; // Should not reach here
};

export default ShortVideoCreator; 
