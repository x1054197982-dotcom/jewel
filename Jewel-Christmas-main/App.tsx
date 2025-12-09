import React, { useState, useCallback } from 'react';
import { Canvas3D } from './components/Canvas3D';
import { VisionController } from './components/VisionController';
import { Overlay } from './components/Overlay';
import { GameState, GestureData } from './types';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.TREE);
  const [gestureData, setGestureData] = useState<GestureData>({
    isHandPresent: false,
    isFist: false,
    isPinch: false,
    isOpen: false,
    position: { x: 0, y: 0 }
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [isVisionReady, setIsVisionReady] = useState(false);

  // Handle gesture updates from VisionController
  const handleGestureUpdate = useCallback((data: GestureData) => {
    setGestureData(data);
    
    // State machine logic based on gestures
    // Note: We avoid setting state continuously to prevent re-renders, 
    // but here we are just setting the target state.
    // The visual transition happens in Canvas3D's loop.
    if (data.isFist) {
      setGameState(GameState.TREE);
    } else if (data.isOpen) {
      // If we were zooming and open hand, go back to scatter
      // If we were tree and open hand, go to scatter
      setGameState(prev => prev === GameState.ZOOM && !data.isPinch ? GameState.SCATTER : GameState.SCATTER);
    } else if (data.isPinch && photos.length > 0) {
       // Only allow zoom if photos exist
       setGameState(GameState.ZOOM);
    }
  }, [photos.length]);

  const handlePhotoUpload = (files: FileList | null) => {
    if (files) {
      setPhotos(prev => [...prev, ...Array.from(files)]);
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0">
        <Canvas3D 
          gameState={gameState} 
          gestureData={gestureData}
          newPhotos={photos}
        />
      </div>

      {/* Vision Controller (Webcam & Logic) */}
      <VisionController 
        onGestureUpdate={handleGestureUpdate}
        onReady={() => setIsVisionReady(true)}
      />

      {/* UI Overlay */}
      <Overlay 
        gameState={gameState} 
        isVisionReady={isVisionReady}
        onPhotoUpload={handlePhotoUpload}
      />
    </div>
  );
};

export default App;