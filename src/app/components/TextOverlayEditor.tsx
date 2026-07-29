"use client";

import React from 'react';
import { CaseSensitive, Maximize2, Edit3, Trash2 } from 'lucide-react';

export const FONT_STYLES = [
  { id: 'classic', name: 'CLASSIC', class: 'font-black italic bg-black/50 text-white backdrop-blur-sm border border-white/10 px-4 py-2 rounded-xl text-center' },
  { id: 'modern', name: 'MODERN', class: 'font-sans font-black tracking-widest bg-yellow-400 text-black px-4 py-2 rounded-md shadow-lg text-center' },
  { id: 'bold', name: 'BLOCK', class: 'font-serif font-extrabold bg-white text-black border-2 border-black px-4 py-2 text-center' },
  { id: 'marker', name: 'MARKER', class: 'font-mono uppercase bg-red-600 text-white font-bold px-5 py-2 rounded-full tracking-tight text-center' }
];

interface TextOverlayEditorProps {
  currentText: string;
  setCurrentText: (val: string) => void;
  currentColor: string;
  setCurrentColor: (val: string) => void;
  currentFontSize: number;
  setCurrentFontSize: (val: number) => void;
  currentFontStyle: string;
  setCurrentFontStyle: (val: string) => void;
  isUppercase: boolean;
  setIsUppercase: React.Dispatch<React.SetStateAction<boolean>>;
  editingTextId: number | null;
  handleSaveTextOverlayData: () => void;
}

export function TextOverlayEditor({
  currentText,
  setCurrentText,
  currentColor,
  setCurrentColor,
  currentFontSize,
  setCurrentFontSize,
  currentFontStyle,
  setCurrentFontStyle,
  isUppercase,
  setIsUppercase,
  editingTextId,
  handleSaveTextOverlayData
}: TextOverlayEditorProps) {
  return (
    <div className="fixed inset-0 z-[100000] bg-black/95 backdrop-blur-3xl flex flex-col p-6">
      <div className="flex justify-between items-center mb-10">
        <button onClick={() => setIsUppercase(!isUppercase)} className={`p-3 rounded-xl border ${isUppercase ? 'bg-white text-black' : 'border-white/20 text-white'}`}>
          <CaseSensitive size={24}/>
        </button>
        <button onClick={handleSaveTextOverlayData} className="bg-red-600 text-white px-8 py-3 rounded-full font-black uppercase tracking-widest transition-transform active:scale-95">
          {editingTextId !== null ? "Save Changes" : "Apply Text"}
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <input 
          autoFocus 
          value={currentText} 
          onChange={e => setCurrentText(e.target.value)} 
          className={`bg-transparent text-center outline-none w-full border-b border-white/10 py-4 ${FONT_STYLES.find(f => f.id === currentFontStyle)?.class}`} 
          style={{ color: currentColor, fontSize: `${currentFontSize}px` }} 
          placeholder="TYPE OVERLAY PHRASE..."
        />
      </div>

      <div className="space-y-8 pb-10">
        {/* FONT STYLE PICKER */}
        <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
          {FONT_STYLES.map(font => (
            <button 
              key={font.id} 
              onClick={() => setCurrentFontStyle(font.id)} 
              className={`px-6 py-2 rounded-xl whitespace-nowrap text-[10px] font-black border transition-all ${currentFontStyle === font.id ? 'bg-white text-black border-white' : 'border-white/10 text-zinc-500'}`}
            >
              {font.name}
            </button>
          ))}
        </div>

        {/* DYNAMIC TEXT SIZE SLIDER CONTROL */}
        <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
          <Maximize2 size={16} className="text-zinc-500"/>
          <input 
            type="range" min="16" max="100" 
            value={currentFontSize} 
            onChange={(e) => setCurrentFontSize(parseInt(e.target.value))}
            className="flex-1 accent-red-600"
          />
          <span className="text-[10px] font-black w-10 text-right">{currentFontSize}px</span>
        </div>

        {/* RE-ADJUSTABLE COLOR MATRIX */}
        <div className="flex justify-between items-center overflow-x-auto no-scrollbar gap-4 py-1">
          {['#ffffff', '#ff0000', '#00ff00', '#0088ff', '#ffff00', '#ff00ff', '#00ffff', '#000000'].map(c => (
            <button key={c} onClick={() => setCurrentColor(c)} className={`w-10 h-10 rounded-full border-2 shrink-0 transition-transform ${currentColor === c ? 'border-white scale-110 shadow-xl' : 'border-transparent opacity-50'}`} style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Sub-component for Video Overlay Rendering & Editing Controls
export function VideoTextOverlays({
  textOverlays,
  setDraggingId,
  handleOpenTextCanvasEditor,
  setTextOverlays
}: {
  textOverlays: any[];
  setDraggingId: (id: number | null) => void;
  handleOpenTextCanvasEditor: (existingOverlayNode?: any) => void;
  setTextOverlays: React.Dispatch<React.SetStateAction<any[]>>;
}) {
  return (
    <div className="absolute inset-0 pointer-events-none z-[350]">
      {textOverlays.map(t => (
        <div 
          key={t.id} 
          onMouseDown={() => setDraggingId(t.id)}
          onTouchStart={() => setDraggingId(t.id)}
          className="absolute flex flex-col items-center gap-2 group cursor-move select-none touch-none z-[300] pointer-events-auto" 
          style={{ top: `${t.y}%`, left: `${t.x}%`, transform: 'translate(-50%, -50%)' }}
        >
          <div className="relative flex items-center justify-center">
            <span 
              style={{ color: t.color, fontSize: `${t.fontSize}px` }} 
              className={`${FONT_STYLES.find(f => f.id === t.fontStyle)?.class} drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] whitespace-nowrap`}
            >
              {t.text}
            </span>

            {/* Hover Action Controls */}
            <div className="absolute -top-12 bg-black/90 px-2 py-1 border border-white/10 rounded-xl flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xl z-[400]">
              <button onClick={() => handleOpenTextCanvasEditor(t)} className="text-yellow-400 p-1 hover:bg-white/10 rounded-md transition-colors">
                <Edit3 size={14}/>
              </button>
              <button onClick={(e) => { e.stopPropagation(); setTextOverlays(prev => prev.filter(x => x.id !== t.id)); }} className="text-red-500 p-1 hover:bg-white/10 rounded-md transition-colors">
                <Trash2 size={14}/>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
