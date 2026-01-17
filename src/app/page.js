'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import JarvisCore from '@/components/JarvisCore';
import VoiceInterface from '@/components/VoiceInterface';
import ChatInterface from '@/components/ChatInterface';
import DevicePanel from '@/components/DevicePanel';
import FaceRecognition from '@/components/FaceRecognition';
import GestureControl from '@/components/GestureControl';
import { useJarvisStore } from '@/lib/store';
import { jarvisAPI } from '@/lib/api';

// Dynamic import for Three.js (no SSR)
const ThreeScene = dynamic(() => import('@/components/ThreeScene'), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center">Loading 3D...</div>
});

export default function Home() {
  const [activeTab, setActiveTab] = useState('chat');
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  
  const {
    isListening,
    isSpeaking,
    isProcessing,
    messages,
    devices,
    sensorData,
    faceDetected,
    gestureDetected,
    setStatus,
    addMessage,
  } = useJarvisStore();

  // PWA Install Prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('JARVIS installed');
    }
    
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  // Initialize
  useEffect(() => {
    // Check server status
    jarvisAPI.getStatus().then((data) => {
      if (data.status === 'online') {
        addMessage('jarvis', 'Good day! JARVIS online and ready. All systems operational.');
      }
    });
  }, []);

  return (
    <main className="min-h-screen relative">
      {/* Background Effects */}
      <div className="grid-bg" />
      <div className="scan-line" />
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-jarvis-blue tracking-wider">
              J.A.R.V.I.S
            </h1>
            <span className="status-badge online">
              <span className="status-dot" />
              ONLINE
            </span>
          </div>
          
          <nav className="flex items-center gap-2">
            {['chat', '3d', 'devices', 'vision', 'settings'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg transition-all capitalize ${
                  activeTab === tab
                    ? 'bg-jarvis-blue/20 text-jarvis-blue'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {tab === '3d' ? '3D' : tab}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <div className="pt-20 pb-32 container mx-auto px-4">
        
        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* JARVIS Core */}
            <div className="flex flex-col items-center justify-center py-8">
              <JarvisCore 
                isListening={isListening}
                isSpeaking={isSpeaking}
                isProcessing={isProcessing}
              />
              <div className="mt-6">
                <VoiceInterface />
              </div>
            </div>
            
            {/* Chat */}
            <div className="lg:col-span-2">
              <ChatInterface />
            </div>
          </div>
        )}

        {/* 3D Tab */}
        {activeTab === '3d' && (
          <div className="h-[70vh] rounded-2xl overflow-hidden glass">
            <ThreeScene />
          </div>
        )}

        {/* Devices Tab */}
        {activeTab === 'devices' && (
          <DevicePanel />
        )}

        {/* Vision Tab */}
        {activeTab === 'vision' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FaceRecognition />
            <GestureControl />
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="glass p-6 rounded-2xl max-w-2xl mx-auto">
            <h2 className="text-xl font-bold text-jarvis-blue mb-6">Settings</h2>
            
            <div className="space-y-6">
              {/* Backend URL */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Backend URL</label>
                <input
                  type="text"
                  className="w-full bg-black/30 border border-jarvis-blue/30 rounded-lg px-4 py-3 text-white"
                  placeholder="https://your-backend.hf.space"
                  defaultValue={process.env.NEXT_PUBLIC_BACKEND_URL}
                />
              </div>
              
              {/* Voice Settings */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Voice</label>
                <select className="w-full bg-black/30 border border-jarvis-blue/30 rounded-lg px-4 py-3 text-white">
                  <option value="male">JARVIS (Male)</option>
                  <option value="female">FRIDAY (Female)</option>
                  <option value="british">British Male</option>
                </select>
              </div>
              
              {/* Recognition Settings */}
              <div className="flex items-center justify-between">
                <span>Face Recognition</span>
                <div className="device-toggle active" />
              </div>
              
              <div className="flex items-center justify-between">
                <span>Gesture Control</span>
                <div className="device-toggle active" />
              </div>
              
              <div className="flex items-center justify-between">
                <span>Wake Word Detection</span>
                <div className="device-toggle" />
              </div>
              
              <button className="btn-primary w-full">Save Settings</button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 glass">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="text-white/60">
              ESP32: <span className={devices.esp32_connected ? 'text-jarvis-green' : 'text-jarvis-red'}>
                {devices.esp32_connected ? 'Connected' : 'Disconnected'}
              </span>
            </span>
            <span className="text-white/60">
              Temp: <span className="text-jarvis-blue">{sensorData.temperature}°C</span>
            </span>
            <span className="text-white/60">
              Humidity: <span className="text-jarvis-blue">{sensorData.humidity}%</span>
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            {faceDetected && (
              <span className="status-badge online">
                <span className="status-dot" />
                Face Detected
              </span>
            )}
            {gestureDetected && (
              <span className="status-badge processing">
                <span className="status-dot" />
                Gesture: {gestureDetected}
              </span>
            )}
          </div>
        </div>
      </footer>

      {/* Install Prompt */}
      {showInstallPrompt && (
        <div className="install-prompt">
          <div className="text-3xl">🤖</div>
          <div>
            <div className="font-bold">Install JARVIS</div>
            <div className="text-sm text-white/60">Add to home screen for quick access</div>
          </div>
          <button onClick={handleInstall} className="btn-primary">
            Install
          </button>
          <button 
            onClick={() => setShowInstallPrompt(false)}
            className="text-white/40 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
    </main>
  );
}