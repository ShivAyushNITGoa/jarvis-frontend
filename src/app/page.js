'use client';
"use client";

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
import { useState, useEffect, useRef } from "react";

// Dynamic import for Three.js (no SSR)
const ThreeScene = dynamic(() => import('@/components/ThreeScene'), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center">Loading 3D...</div>
});
// Get API URL from env or default
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://mainhushivam-jarvis-api.hf.space";

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
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState("connecting");
  const [devices, setDevices] = useState({});
  const [sensors, setSensors] = useState({});
  const chatRef = useRef(null);
  const recognitionRef = useRef(null);

  // PWA Install Prompt
  // Initialize
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };
    checkHealth();
    fetchDevices();

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
    // Welcome message
    setMessages([{
      type: "jarvis",
      text: "JARVIS Online. Systems functional. How may I assist you?",
      timestamp: new Date().toISOString()
    }]);

    // Setup Speech Recognition
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.lang = "en-US";
        
        recognitionRef.current.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
          if (event.results[0].isFinal) {
            sendMessage(transcript);
            setIsListening(false);
          }
        };
        
        recognitionRef.current.onend = () => setIsListening(false);
      }
    }
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_URL}/health`);
      if (res.ok) setStatus("online");
      else setStatus("offline");
    } catch {
      setStatus("offline");
    }
  };

  const fetchDevices = async () => {
    try {
      const res = await fetch(`${API_URL}/api/devices/status`);
      const data = await res.json();
      setDevices(data.devices || {});
      setSensors(data.sensors || {});
    } catch (e) {
      console.error("Device fetch failed");
    }
  };

  const sendMessage = async (text = input) => {
    if (!text.trim() || isLoading) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    const userMsg = text.trim();
    setInput("");
    setIsLoading(true);
    
    setMessages(prev => [...prev, { type: "user", text: userMsg }]);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, user_id: "web_user" })
      });
      
      const data = await res.json();
      
      setMessages(prev => [...prev, { type: "jarvis", text: data.response }]);
      speak(data.response);
      
      if (data.intent?.type === "device_control") fetchDevices();
      
    } catch (e) {
      setMessages(prev => [...prev, { type: "jarvis", text: "Connection error. Please try again." }]);
    }

    if (outcome === 'accepted') {
      console.log('JARVIS installed');
    setIsLoading(false);
  };

  const speak = (text) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleMic = () => {
    if (!recognitionRef.current) return alert("Voice not supported in this browser");

    setDeferredPrompt(null);
    setShowInstallPrompt(false);
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
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
  const toggleDevice = async (id, currentState) => {
    try {
      await fetch(`${API_URL}/api/devices/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device: id, action: currentState ? "off" : "on" })
      });
      fetchDevices();
    } catch (e) {
      console.error("Control failed");
    }
  };

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
    <div className="min-h-screen bg-[#0a0a1a] text-[#00d4ff] font-sans p-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <header className="text-center mb-8 pt-4">
          <h1 className="text-5xl font-bold mb-2 tracking-widest text-shadow-glow">JARVIS</h1>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <span className={`w-2 h-2 rounded-full ${status === 'online' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></span>
            SYSTEM {status.toUpperCase()}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

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
          {/* Main Chat */}
          <div className="lg:col-span-2">
            <div ref={chatRef} className="bg-black/40 border border-[#00d4ff]/30 rounded-xl h-[500px] overflow-y-auto p-4 mb-4 relative">
              {messages.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                  System Ready.
                </div>
              )}
              
              {messages.map((m, i) => (
                <div key={i} className={`mb-4 p-3 rounded-lg max-w-[85%] ${m.type === 'user' ? 'ml-auto bg-[#00ff88]/10 border-l-2 border-[#00ff88]' : 'bg-[#00d4ff]/10 border-l-2 border-[#00d4ff]'}`}>
                  <div className={`text-xs font-bold mb-1 ${m.type === 'user' ? 'text-[#00ff88]' : 'text-[#00d4ff]'}`}>
                    {m.type === 'user' ? 'COMMAND' : 'RESPONSE'}
                  </div>
                  <div className="text-white/90">{m.text}</div>
                </div>
              ))}
              
              {isLoading && <div className="text-xs text-[#00d4ff] animate-pulse">Processing...</div>}
            </div>

            <div className="flex gap-2">
              <button 
                onClick={toggleMic}
                className={`p-4 rounded-full border border-[#00d4ff] transition-all ${isListening ? 'bg-[#00ff88] text-black animate-pulse' : 'bg-transparent text-[#00d4ff]'}`}
              >
                {tab === '3d' ? '3D' : tab}
                {isListening ? '🔴' : '🎤'}
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
              <input 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Enter command..."
                className="flex-1 bg-black/50 border border-[#00d4ff]/30 rounded-full px-6 text-white focus:outline-none focus:border-[#00d4ff]"
              />
              <div className="mt-6">
                <VoiceInterface />
              </div>
            </div>
            
            {/* Chat */}
            <div className="lg:col-span-2">
              <ChatInterface />
              <button 
                onClick={() => sendMessage()}
                className="px-6 rounded-full bg-[#00d4ff] text-black font-bold hover:bg-[#00b8e6]"
              >
                SEND
              </button>
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
          {/* Right Panel - Devices */}
          <div className="space-y-6">

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
            {/* Quick Actions */}
            <div className="bg-black/40 border border-[#00d4ff]/30 rounded-xl p-4">
              <h3 className="text-sm font-bold text-[#00d4ff] mb-3 uppercase tracking-wider">Quick Access</h3>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => sendMessage("Turn on lights")} className="p-2 bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-xs rounded border border-[#00d4ff]/30">💡 Lights On</button>
                <button onClick={() => sendMessage("Turn off lights")} className="p-2 bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-xs rounded border border-[#00d4ff]/30">🌑 Lights Off</button>
                <button onClick={() => sendMessage("Weather report")} className="p-2 bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-xs rounded border border-[#00d4ff]/30">🌤️ Weather</button>
                <button onClick={() => sendMessage("System status")} className="p-2 bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-xs rounded border border-[#00d4ff]/30">📊 Status</button>
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

            {/* Devices List */}
            <div className="bg-black/40 border border-[#00d4ff]/30 rounded-xl p-4">
              <h3 className="text-sm font-bold text-[#00d4ff] mb-3 uppercase tracking-wider">Connected Devices</h3>
              <div className="space-y-2">
                {Object.entries(devices).map(([id, dev]) => (
                  <div key={id} className="flex justify-between items-center bg-black/30 p-2 rounded">
                    <span className="text-sm text-gray-300">{dev.name}</span>
                    <button 
                      onClick={() => toggleDevice(id, dev.state)}
                      className={`text-xs px-2 py-1 rounded font-bold ${dev.state ? 'bg-[#00ff88] text-black' : 'bg-gray-700 text-white'}`}
                    >
                      {dev.state ? 'ON' : 'OFF'}
                    </button>
                  </div>
                ))}
                {Object.keys(devices).length === 0 && (
                  <div className="text-xs text-gray-500 text-center py-4">No devices detected</div>
                )}
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
            {/* Sensors */}
            <div className="bg-black/40 border border-[#00d4ff]/30 rounded-xl p-4">
              <h3 className="text-sm font-bold text-[#00d4ff] mb-3 uppercase tracking-wider">Environment</h3>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-[#00ff88]">{sensors.temperature || '--'}°C</div>
                  <div className="text-xs text-gray-500">Temperature</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#00d4ff]">{sensors.humidity || '--'}%</div>
                  <div className="text-xs text-gray-500">Humidity</div>
                </div>
              </div>
            </div>

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
      </div>
    </div>
  );
}
}
