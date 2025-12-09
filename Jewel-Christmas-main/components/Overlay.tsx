import React, { useState } from 'react';
import { GameState } from '../types';
import { Upload, Camera, Hand, Minimize2, Maximize2 } from 'lucide-react';

interface OverlayProps {
  gameState: GameState;
  isVisionReady: boolean;
  onPhotoUpload: (files: FileList | null) => void;
}

export const Overlay: React.FC<OverlayProps> = ({ gameState, isVisionReady, onPhotoUpload }) => {
  const [minimized, setMinimized] = useState(false);

  const getStatusText = () => {
    if (!isVisionReady) return "INITIALIZING VISION SYSTEM...";
    switch (gameState) {
      case GameState.TREE: return "CONVERGENCE: TREE FORM";
      case GameState.SCATTER: return "DIVERGENCE: NEBULA SCATTER";
      case GameState.ZOOM: return "FOCUS: MEMORY RECALL";
      default: return "SYSTEM READY";
    }
  };

  const getStatusColor = () => {
    if (!isVisionReady) return "text-gray-500";
    switch (gameState) {
      case GameState.TREE: return "text-emerald-400";
      case GameState.SCATTER: return "text-blue-400";
      case GameState.ZOOM: return "text-amber-400";
      default: return "text-white";
    }
  };

  if (minimized) {
    return (
      <button 
        onClick={() => setMinimized(false)}
        className="absolute top-6 left-6 z-50 p-2 bg-black/50 border border-white/20 rounded-full text-amber-400 hover:bg-black/80 transition-all"
      >
        <Maximize2 size={24} />
      </button>
    );
  }

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 flex flex-col justify-between p-6">
      
      {/* Header Section */}
      <div className="pointer-events-auto flex flex-col items-start gap-4 max-w-md">
        <div className="flex items-center gap-4">
          <h1 className="text-4xl md:text-5xl font-bold font-['Cinzel'] tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-amber-200 to-white drop-shadow-[0_0_15px_rgba(212,175,55,0.5)]">
            JEWEL XMAS
          </h1>
          <button 
            onClick={() => setMinimized(true)}
            className="p-2 text-white/50 hover:text-white transition-colors"
          >
            <Minimize2 size={20} />
          </button>
        </div>
        
        <div className={`text-lg font-bold tracking-widest transition-colors duration-500 ${getStatusColor()}`}>
          {getStatusText()}
        </div>

        <div className="bg-black/60 backdrop-blur-md border-l-2 border-amber-500 p-4 rounded-r-lg shadow-[0_0_30px_rgba(0,0,0,0.5)] text-sm text-gray-200 space-y-2">
           <div className="flex items-center gap-2">
             <Hand size={16} className="text-emerald-400" />
             <span><strong className="text-emerald-400">FIST:</strong> Form Tree</span>
           </div>
           <div className="flex items-center gap-2">
             <Hand size={16} className="text-blue-400" />
             <span><strong className="text-blue-400">OPEN HAND:</strong> Scatter Stars</span>
           </div>
           <div className="flex items-center gap-2">
             <Hand size={16} className="text-amber-400" />
             <span><strong className="text-amber-400">PINCH:</strong> Grab Memory (Requires Photo)</span>
           </div>
           <div className="flex items-center gap-2">
             <Hand size={16} className="text-purple-400" />
             <span><strong className="text-purple-400">SWIPE:</strong> Rotate Nebula</span>
           </div>
        </div>
      </div>

      {/* Loading Indicator */}
      {!isVisionReady && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-amber-200 tracking-widest text-sm animate-pulse">CALIBRATING SENSORS...</p>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="pointer-events-auto flex items-end justify-between">
        <label className="group cursor-pointer">
           <div className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-zinc-800 to-zinc-900 border border-zinc-700 rounded-full hover:border-amber-500 hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all duration-300">
              <Upload className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-semibold text-gray-300 group-hover:text-white uppercase tracking-wider">Upload Memory</span>
           </div>
           <input 
             type="file" 
             multiple 
             accept="image/*" 
             className="hidden" 
             onChange={(e) => onPhotoUpload(e.target.files)}
            />
        </label>
      </div>
    </div>
  );
};