"use client";

import { useState, useEffect, useRef } from "react";

// API Configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://mainhushivam-jarvis-api.hf.space";

export default function Home() {
  // State
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState("connecting");
  const [voice, setVoice] = useState("jarvis");
  const [audioEnabled, setAudioEnabled] = useState(false); // New state for permission
  
  // IoT State
  const [devices, setDevices] = useState({});
  const [sensors, setSensors] = useState({ temperature: "--", humidity: "--" });

  // Refs
  const chatRef = useRef(null);
  const recognitionRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  // ============================================
  // INITIALIZATION
  // ============================================
  useEffect(() => {
    checkHealth();
    fetchDevices();
    
    // Setup Speech Recognition
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.lang = "en-US";
        
        recognitionRef.current.onstart = () => setIsListening(true);
        recognitionRef.current.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
          if (event.results[0].isFinal) sendMessage(transcript);
        };
        recognitionRef.current.onend = () => setIsListening(false);
      }
    }

    // Polling
    const interval = setInterval(fetchDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  // ============================================
  // AUDIO ENGINE (THE FIX)
  // ============================================
  
  const enableAudio = () => {
    setAudioEnabled(true);
    // Play a silent sound to unlock audio context on iOS/Chrome
    const audio = new Audio();
    audio.play().catch(() => {});
    addMessage("jarvis", "Audio systems initialized. I am ready.");
  };

  const playAudio = (relativePath) => {
    if (!audioEnabled) return;

    // Construct full URL
    // Ensure no double slashes
    const baseUrl = API_URL.replace(/\/$/, "");
    const path = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
    const fullUrl = `${baseUrl}${path}`;

    console.log("🔊 Attempting to play:", fullUrl);

    const audio = new Audio(fullUrl);
    audio.crossOrigin = "anonymous";
    
    audio.onplay = () => {
      setIsSpeaking(true);
      startVisualizer();
    };

    audio.onended = () => {
      setIsSpeaking(false);
      stopVisualizer();
    };

    audio.onerror = (e) => {
      console.error("❌ Audio Error:", e);
      setIsSpeaking(false);
      stopVisualizer();
    };

    audio.play().catch(error => {
      console.error("❌ Playback failed:", error);
      // If blocked, try to force it
      if (error.name === 'NotAllowedError') {
        alert("Please click the screen to enable audio output.");
      }
    });
  };

  // ============================================
  // CORE FUNCTIONS
  // ============================================

  const addMessage = (type, text) => {
    setMessages(prev => [...prev, { type, text, time: new Date().toLocaleTimeString() }]);
  };

  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_URL}/health`);
      if (res.ok) setStatus("online");
    } catch { setStatus("offline"); }
  };

  const fetchDevices = async () => {
    try {
      const res = await fetch(`${API_URL}/api/devices/status`);
      const data = await res.json();
      setDevices(data.devices || {});
      setSensors(data.sensors || {});
    } catch (e) {}
  };

  const sendMessage = async (text = input) => {
    if (!text.trim() || isLoading) return;
    
    const userMsg = text.trim();
    setInput("");
    setIsLoading(true);
    addMessage("user", userMsg);

    try {
      console.log("📤 Sending to:", `${API_URL}/api/chat`);
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, user_id: "web_user", voice: voice })
      });
      
      const data = await res.json();
      console.log("📥 Received:", data);

      addMessage("jarvis", data.response);
      
      // Try to play audio if URL exists
      if (data.audio_url) {
        playAudio(data.audio_url);
      } else {
        console.warn("⚠️ No audio_url in response");
      }

      if (data.intent?.type === "device_control") fetchDevices();
      
    } catch (e) {
      console.error("Fetch Error:", e);
      addMessage("jarvis", "Connection error.");
    }
    
    setIsLoading(false);
  };

  const toggleMic = () => {
    if (!recognitionRef.current) return alert("Voice input not supported");
    if (isListening) recognitionRef.current.stop();
    else {
      if (!audioEnabled) enableAudio(); // Enable audio when mic is clicked
      setInput("");
      recognitionRef.current.start();
    }
  };

  // ============================================
  // VISUALIZER
  // ============================================
  const startVisualizer = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let width = canvas.width = canvas.clientWidth;
    let height = canvas.height = canvas.clientHeight;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const time = Date.now() / 300;
      
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#00d4ff";
      for (let i = 0; i < width; i++) {
        const y = Math.sin(i * 0.02 + time) * 20 + height / 2;
        ctx.lineTo(i, y);
      }
      ctx.stroke();
      animationRef.current = requestAnimationFrame(draw);
    };
    draw();
  };

  const stopVisualizer = () => {
    cancelAnimationFrame(animationRef.current);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="min-h-screen bg-[#050510] text-[#00d4ff] font-sans overflow-hidden relative">
      
      {/* 🛑 AUDIO PERMISSION OVERLAY */}
      {!audioEnabled && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center p-8 border border-[#00d4ff] rounded-2xl bg-[#0a0a1a] shadow-[0_0_50px_rgba(0,212,255,0.3)]">
            <h1 className="text-3xl font-bold mb-4">INITIALIZE SYSTEM</h1>
            <p className="mb-6 text-gray-400">Audio output requires permission</p>
            <button 
              onClick={enableAudio}
              className="px-8 py-3 bg-[#00d4ff] text-black font-bold rounded-full hover:bg-[#00b8e6] transition-all transform hover:scale-105"
            >
              ENABLE AUDIO
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-4 h-screen flex flex-col">
        {/* Header */}
        <header className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-tr from-blue-500 to-cyan-400 ${isSpeaking ? 'animate-pulse' : ''}`}>
              🤖
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-widest text-white">JARVIS</h1>
              <p className="text-[10px] text-[#00ff88] tracking-widest">ONLINE</p>
            </div>
          </div>
          <select 
            value={voice} 
            onChange={(e) => setVoice(e.target.value)}
            className="bg-black/40 border border-white/20 rounded px-2 py-1 text-xs"
          >
            <option value="jarvis">Male (Jarvis)</option>
            <option value="friday">Female (Friday)</option>
          </select>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
          
          {/* Left Panel - Visualizer & Sensors */}
          <div className="lg:col-span-3 space-y-4 hidden lg:block">
            <div className="bg-[#0a0a1a]/50 border border-white/10 rounded-xl p-4 h-32 relative">
              <canvas ref={canvasRef} className="w-full h-full" />
              {!isSpeaking && <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-600">AUDIO IDLE</div>}
            </div>
            
            <div className="bg-[#0a0a1a]/50 border border-white/10 rounded-xl p-4">
              <h3 className="text-xs text-gray-500 mb-2">SENSORS</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-black/40 rounded text-center">
                  <div className="text-white font-bold">{sensors.temperature}°C</div>
                  <div className="text-[10px] text-gray-500">TEMP</div>
                </div>
                <div className="p-2 bg-black/40 rounded text-center">
                  <div className="text-[#00ff88] font-bold">{sensors.humidity}%</div>
                  <div className="text-[10px] text-gray-500">HUMIDITY</div>
                </div>
              </div>
            </div>
          </div>

          {/* Center - Chat */}
          <div className="lg:col-span-6 flex flex-col bg-[#0a0a1a]/80 border border-white/10 rounded-2xl relative overflow-hidden">
            <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl p-3 ${
                    m.type === 'user' ? 'bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-white' : 'bg-white/5 border border-white/10 text-gray-300'
                  }`}>
                    <div className="text-[10px] opacity-50 mb-1">{m.type === 'user' ? 'COMMAND' : 'RESPONSE'}</div>
                    <div className="text-sm">{m.text}</div>
                  </div>
                </div>
              ))}
              {isLoading && <div className="text-xs text-[#00d4ff] animate-pulse p-4">Processing...</div>}
            </div>

            <div className="p-4 bg-black/60 border-t border-white/10 flex gap-2">
              <button 
                onClick={toggleMic}
                className={`p-3 rounded-lg border ${isListening ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-[#00d4ff] text-[#00d4ff]'}`}
              >
                {isListening ? '🔴' : '🎤'}
              </button>
              <input 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Enter command..."
                className="flex-1 bg-transparent border border-white/20 rounded-lg px-4 text-white focus:border-[#00d4ff] focus:outline-none"
              />
              <button onClick={() => sendMessage()} className="px-4 bg-[#00d4ff] text-black font-bold rounded-lg">SEND</button>
            </div>
          </div>

          {/* Right - Devices */}
          <div className="lg:col-span-3 overflow-y-auto">
            <div className="bg-[#0a0a1a]/50 border border-white/10 rounded-xl p-4">
              <h3 className="text-xs text-gray-500 mb-2">DEVICES</h3>
              <div className="space-y-2">
                {Object.entries(devices).map(([id, dev]) => (
                  <div key={id} className="flex justify-between items-center p-2 bg-black/40 rounded border border-white/5">
                    <span className="text-sm text-gray-300">{dev.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${dev.state ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'bg-gray-800 text-gray-500'}`}>
                      {dev.state ? 'ON' : 'OFF'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
