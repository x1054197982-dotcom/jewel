import React, { useEffect, useRef } from 'react';
import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { GestureData } from '../types';

interface VisionControllerProps {
  onGestureUpdate: (data: GestureData) => void;
  onReady: () => void;
}

export const VisionController: React.FC<VisionControllerProps> = ({ onGestureUpdate, onReady }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastVideoTimeRef = useRef(-1);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>();

  useEffect(() => {
    let mounted = true;

    const setupVision = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        if (!mounted) return;

        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });

        handLandmarkerRef.current = handLandmarker;
        startWebcam();
      } catch (error) {
        console.error("Failed to load vision tasks", error);
      }
    };

    const startWebcam = () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener('loadeddata', () => {
              if (mounted) {
                onReady();
                predictWebcam();
              }
            });
          }
        });
      }
    };

    setupVision();

    return () => {
      mounted = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const predictWebcam = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const handLandmarker = handLandmarkerRef.current;

    if (!video || !canvas || !handLandmarker) return;

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const startTimeMs = performance.now();
      const result = handLandmarker.detectForVideo(video, startTimeMs);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Ensure canvas matches video size
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        processResults(result, ctx, canvas.width, canvas.height);
      }
    }
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const processResults = (result: HandLandmarkerResult, ctx: CanvasRenderingContext2D, w: number, h: number) => {
    let gestureData: GestureData = {
      isHandPresent: false,
      isFist: false,
      isPinch: false,
      isOpen: false,
      position: { x: 0, y: 0 }
    };

    if (result.landmarks && result.landmarks.length > 0) {
      const landmarks = result.landmarks[0];
      gestureData.isHandPresent = true;

      // Draw Skeleton
      drawSkeleton(ctx, landmarks, w, h);

      // Analysis
      const palmX = 1 - (landmarks[0].x + landmarks[9].x) / 2; // Mirror x
      const palmY = (landmarks[0].y + landmarks[9].y) / 2;
      gestureData.position = { x: palmX, y: palmY };

      // Finger folding detection for Fist
      // Tips: 8, 12, 16, 20. Bases: 0 (Wrist). Simple euclidean dist check.
      let foldedCount = 0;
      [8, 12, 16, 20].forEach(tipIdx => {
        const dx = landmarks[tipIdx].x - landmarks[0].x;
        const dy = landmarks[tipIdx].y - landmarks[0].y;
        if (Math.sqrt(dx * dx + dy * dy) < 0.35) foldedCount++;
      });

      // Pinch detection (Thumb tip 4 and Index tip 8)
      const pdx = landmarks[4].x - landmarks[8].x;
      const pdy = landmarks[4].y - landmarks[8].y;
      const pinchDist = Math.sqrt(pdx * pdx + pdy * pdy);

      gestureData.isPinch = pinchDist < 0.08;
      gestureData.isFist = foldedCount >= 4;
      gestureData.isOpen = !gestureData.isFist && !gestureData.isPinch;
    }

    onGestureUpdate(gestureData);
  };

  const drawSkeleton = (ctx: CanvasRenderingContext2D, landmarks: any[], w: number, h: number) => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#34d399'; // Emerald-400
    ctx.fillStyle = '#f59e0b'; // Amber-500

    const connections = [
      [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
      [5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],
      [13,17],[17,18],[18,19],[19,20],[0,17]
    ];

    connections.forEach(([startIdx, endIdx]) => {
      const start = landmarks[startIdx];
      const end = landmarks[endIdx];
      ctx.beginPath();
      ctx.moveTo(start.x * w, start.y * h);
      ctx.lineTo(end.x * w, end.y * h);
      ctx.stroke();
    });

    landmarks.forEach(lm => {
      ctx.beginPath();
      ctx.arc(lm.x * w, lm.y * h, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  return (
    <div className="absolute top-6 right-6 w-40 h-32 z-20 rounded-lg overflow-hidden border-2 border-white/20 bg-black/50 backdrop-blur shadow-lg transform -scale-x-100">
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-60" autoPlay playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />
    </div>
  );
};