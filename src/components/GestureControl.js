'use client';

import { useEffect, useRef, useState } from 'react';
import { useJarvisStore } from '@/lib/store';

const GESTURES = {
  'Closed_Fist': { action: 'toggle_light', label: 'Toggle Light' },
  'Open_Palm': { action: 'stop', label: 'Stop' },
  'Pointing_Up': { action: 'volume_up', label: 'Volume Up' },
  'Thumb_Up': { action: 'confirm', label: 'Confirm' },
  'Thumb_Down': { action: 'cancel', label: 'Cancel' },
  'Victory': { action: 'toggle_fan', label: 'Toggle Fan' },
};

export default function GestureControl() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [detector, setDetector] = useState(null);
  const [currentGesture, setCurrentGesture] = useState(null);
  
  const { setGestureDetected } = useJarvisStore();

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      // Load Hand Pose Detection
      const tf = await import('@tensorflow/tfjs');
      const handPoseDetection = await import('@tensorflow-models/hand-pose-detection');
      
      await tf.ready();
      
      const model = await handPoseDetection.createDetector(
        handPoseDetection.SupportedModels.MediaPipeHands,
        {
          runtime: 'tfjs',
          modelType: 'full',
          maxHands: 2,
        }
      );
      
      setDetector(model);
      setIsActive(true);
      
    } catch (error) {
      console.error('Camera/Model error:', error);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setIsActive(false);
    setCurrentGesture(null);
    setGestureDetected(null);
  };

  // Detection loop
  useEffect(() => {
    if (!isActive || !detector || !videoRef.current) return;
    
    let animationId;
    
    const detect = async () => {
      try {
        const hands = await detector.estimateHands(videoRef.current);
        
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && canvasRef.current) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          
          hands.forEach((hand) => {
            // Draw keypoints
            hand.keypoints.forEach((point) => {
              ctx.fillStyle = hand.handedness === 'Left' ? '#00d4ff' : '#ffaa00';
              ctx.beginPath();
              ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
              ctx.fill();
            });
            
            // Draw connections
            const connections = [
              [0, 1], [1, 2], [2, 3], [3, 4],
              [0, 5], [5, 6], [6, 7], [7, 8],
              [0, 9], [9, 10], [10, 11], [11, 12],
              [0, 13], [13, 14], [14, 15], [15, 16],
              [0, 17], [17, 18], [18, 19], [19, 20],
              [5, 9], [9, 13], [13, 17],
            ];
            
            ctx.strokeStyle = hand.handedness === 'Left' ? '#00d4ff' : '#ffaa00';
            ctx.lineWidth = 2;
            
            connections.forEach(([i, j]) => {
              const p1 = hand.keypoints[i];
              const p2 = hand.keypoints[j];
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            });
            
            // Simple gesture detection (example)
            const gesture = detectGesture(hand.keypoints);
            if (gesture) {
              setCurrentGesture(gesture);
              setGestureDetected(gesture);
              
              ctx.fillStyle = '#00ff88';
              ctx.font = '18px Arial';
              ctx.fillText(GESTURES[gesture]?.label || gesture, 10, 30);
            }
          });
          
          if (hands.length === 0) {
            setCurrentGesture(null);
            setGestureDetected(null);
          }
        }
      } catch (error) {
        console.error('Detection error:', error);
      }
      
      animationId = requestAnimationFrame(detect);
    };
    
    detect();
    
    return () => cancelAnimationFrame(animationId);
  }, [isActive, detector]);

  // Simple gesture detection logic
  const detectGesture = (keypoints) => {
    // This is a simplified example
    // Real implementation would use proper gesture recognition
    
    const thumbTip = keypoints[4];
    const indexTip = keypoints[8];
    const middleTip = keypoints[12];
    const ringTip = keypoints[16];
    const pinkyTip = keypoints[20];
    const wrist = keypoints[0];
    
    // Check if fingers are extended
    const thumbExtended = thumbTip.y < keypoints[3].y;
    const indexExtended = indexTip.y < keypoints[6].y;
    const middleExtended = middleTip.y < keypoints[10].y;
    const ringExtended = ringTip.y < keypoints[14].y;
    const pinkyExtended = pinkyTip.y < keypoints[18].y;
    
    // Detect gestures
    if (!thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      return 'Closed_Fist';
    }
    
    if (thumbExtended && indexExtended && middleExtended && ringExtended && pinkyExtended) {
      return 'Open_Palm';
    }
    
    if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      return 'Thumb_Up';
    }
    
    if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
      return 'Victory';
    }
    
    if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      return 'Pointing_Up';
    }
    
    return null;
  };

  return (
    <div className="glass p-6 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-jarvis-blue font-semibold flex items-center gap-2">
          ✋ Gesture Control
        </h3>
        <button
          onClick={isActive ? stopCamera : startCamera}
          className={`px-4 py-2 rounded-lg ${
            isActive 
              ? 'bg-jarvis-red/20 text-jarvis-red border border-jarvis-red/30' 
              : 'bg-jarvis-green/20 text-jarvis-green border border-jarvis-green/30'
          }`}
        >
          {isActive ? 'Stop' : 'Start'}
        </button>
      </div>
      
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full transform -scale-x-100"
          width={640}
          height={480}
        />
        
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center text-white/40">
            Click Start to enable gesture control
          </div>
        )}
      </div>
      
      {/* Gesture Info */}
      <div className="mt-4">
        {currentGesture ? (
          <div className="status-badge processing">
            <span className="status-dot" />
            {GESTURES[currentGesture]?.label || currentGesture}
          </div>
        ) : (
          <div className="text-white/40 text-sm">Show a gesture to control</div>
        )}
      </div>
      
      {/* Gesture Guide */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        {Object.entries(GESTURES).map(([gesture, info]) => (
          <div 
            key={gesture}
            className={`p-2 rounded text-center ${
              currentGesture === gesture 
                ? 'bg-jarvis-green/20 text-jarvis-green' 
                : 'bg-black/20 text-white/60'
            }`}
          >
            {info.label}
          </div>
        ))}
      </div>
    </div>
  );
}