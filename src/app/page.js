"use client";

import { useState, useEffect, useRef } from "react";

// API Configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://mainhushivam-jarvis-api.hf.space";

export default function Home() {
  // State Management
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState("connecting");
  const [voice, setVoice] = useState("jarvis");
  const [audioEnabled, setAudioEnabled] = useState(false); // Force user interaction
  
  // IoT State
  const [devices, setDevices] = useState({});
  const [sensors, setSensors] = useState({
    temperature: "--",
    humidity: "--",
    light_level: "--",
    motion: false
  });

  // Refs
  const chatRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioRef = useRef(null); // Reference to the <audio> element
  const canvasRef = useRef(null); // For visualizer
  const animationRef = useRef(null);

  // ============================================
  // INITIALIZATION
  // ============================================
  useEffect(() => {
    checkHealth();
    fetchDevices();
    
    // Add Welcome Message
    addMessage("jarvis", "System online. Click 'Enable Audio' to activate voice systems.");

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
          if (event.results[0].isFinal) {
            sendMessage(transcript);
          }
        };
        
        recognitionRef.current.onend = () => setIsListening(false);
      }
    }

    // Auto-refresh devices every 5s
    const interval = setInterval(fetchDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // ============================================
  // AUDIO SYSTEM (CRITICAL FIX)
  // ============================================

  const enableAudio = () => {
    // Play silent sound to unlock browser audio
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
      setAudioEnabled(true);
      addMessage("jarvis", "Audio systems active. I am listening.");
    }
  };

  const playResponseAudio = (url) => {
    if (!audioRef.current) return;
    
    // Ensure URL is absolute
    const audioUrl = url.startsWith("http") ? url : `${API_URL}${url}`;
    console.log("🔊 Playing audio from:", audioUrl);

    audioRef.current.src = audioUrl;
    audioRef.current.play()
      .then(() => {
        setIsSpeaking(true);
        startVisualizer();
      })
      .catch(err => {
        console.error("Audio playback failed:", err);
        addMessage("system", "Error playing audio. Please ensure 'Enable Audio' was clicked.");
      });

    audioRef.current.onended = () => {
      setIsSpeaking(false);
      stopVisualizer();
    };
  };

  // ============================================
  // CORE FUNCTIONS
  // ============================================

  const addMessage = (type, text) => {
    setMessages(prev => [...prev, {
      type,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
  };

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
      console.warn("Device sync failed");
    }
  };

  const sendMessage = async (text = input) => {
    if (!text.trim() || isLoading) return;
    
    const userMsg = text.trim();
    setInput("");
    setIsLoading(true);
    addMessage("user", userMsg);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userMsg, 
          user_id: "web_user",
          voice: voice 
        })
      });
      
      const data = await res.json();
      addMessage("jarvis", data.response);
      
      // Handle Audio Response
      if (data.audio_url) {
        playResponseAudio(data.audio_url);
      } else {
        console.warn("No audio URL returned from backend");
      }

      if (data.intent?.type === "device_control") {
        fetchDevices();
      }
      
    } catch (e) {
      console.error(e);
      addMessage("jarvis", "I apologize, I'm having trouble connecting to my servers.");
    }
    
    setIsLoading(false);
  };

  const toggleMic = () => {
    if (!recognitionRef.current) return alert("Voice input not supported in this browser");
    
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setInput("");
      recognitionRef.current.start();
    }
  };

  const toggleDevice = async (id, currentState) => {
    try {
      await fetch(`${API_URL}/api/devices/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device: id, action: currentState ? "off" : "on" })
      });
      setTimeout(fetchDevices, 1000);
    } catch (e) {
      console.error("Control failed");
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
        const y = Math.sin(i * 0.02 + time) * 20 * Math.sin(time * 0.5) + height / 2;
        if (i === 0) ctx.moveTo(i, y);
        else ctx.lineTo(i, y);
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
  // RENDER UI
  // ============================================
  return (
    <div className="min-h-screen bg-[#050510] text-[#00d4ff] font-sans selection:bg-[#00d4ff] selection:text-black overflow-hidden relative">
      
      {/* Hidden Audio Element */}
      <audio ref={audioRef} className="hidden" crossOrigin="anonymous" />

      {/* Audio Permission Overlay */}
      {!audioEnabled && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center p-8 border border-[#00d4ff] rounded-2xl bg-[#0a0a1a] shadow-[0_0_50px_rgba(0,212,255,0.3)] max-w-md mx-4">
            <h1 className="text-3xl font-bold mb-4 tracking-widest text-white">SYSTEM INITIALIZATION</h1>
            <p className="mb-8 text-gray-400">Audio output requires manual authorization.</p>
            <button 
              onClick={enableAudio}
              className="px-8 py-4 bg-[#00d4ff] text-black font-bold rounded-xl hover:bg-[#00b8e6] transition-all transform hover:scale-105 shadow-[0_0_20px_#00d4ff]"
            >
              INITIALIZE AUDIO SYSTEMS
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-4 md:p-6 h-screen flex flex-col">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-tr from-[#00d4ff] to-[#0066ff] shadow-[0_0_20px_rgba(0,212,255,0.4)] transition-all ${isSpeaking ? 'scale-110 shadow-[0_0_40px_#00d4ff]' : ''}`}>
              <span className="text-2xl">🤖</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-white">
                JARVIS
              </h1>
              <p className="text-[10px] text-[#00ff88] tracking-widest font-mono">
                STATUS: {status.toUpperCase()}
              </p>
            </div>
          </div>
          
          <div className="flex gap-4 mt-4 md:mt-0">
            <select 
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-full px-4 py-2 text-xs text-gray-300 outline-none focus:border-[#00d4ff] cursor-pointer"
            >
              <option value="jarvis">JARVIS (Male)</option>
              <option value="friday">FRIDAY (Female)</option>
              <option value="british">British</option>
              <option value="indian">Indian</option>
            </select>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
          
          {/* LEFT: Sensors & Visualizer */}
          <div className="lg:col-span-3 space-y-4 overflow-y-auto hidden lg:block">
            
            {/* Visualizer */}
            <div className="bg-[#0a0a1a]/60 backdrop-blur border border-white/10 rounded-2xl p-4 shadow-xl h-32 flex flex-col relative overflow-hidden">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Voice Synthesis</span>
              <canvas ref={canvasRef} className="w-full h-full" />
              {!isSpeaking && <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-700 font-mono">Waiting for input...</div>}
            </div>

            {/* Sensor Grid */}
            <div className="bg-[#0a0a1a]/60 backdrop-blur border border-white/10 rounded-2xl p-5 shadow-xl">
              <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-3 bg-[#00d4ff]"></span> Telemetry
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                  <div className="text-xl font-bold text-white">{sensors.temperature}°C</div>
                  <div className="text-[10px] text-gray-500">TEMP</div>
                </div>
                <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                  <div className="text-xl font-bold text-[#00d4ff]">{sensors.humidity}%</div>
                  <div className="text-[10px] text-gray-500">HUMIDITY</div>
                </div>
                <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                  <div className="text-xl font-bold text-[#ffaa00]">{sensors.light_level}</div>
                  <div className="text-[10px] text-gray-500">LIGHT</div>
                </div>
                <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                  <div className={`text-xl font-bold ${sensors.motion ? 'text-red-500 animate-pulse' : 'text-[#00ff88]'}`}>
                    {sensors.motion ? 'ALERT' : 'SECURE'}
                  </div>
                  <div className="text-[10px] text-gray-500">MOTION</div>
                </div>
              </div>
            </div>
          </div>

          {/* CENTER: Main Chat */}
          <div className="lg:col-span-6 flex flex-col bg-[#0a0a1a]/80 backdrop-blur-md border border-white/10 rounded-3xl shadow-2xl relative overflow-hidden">
            
            <div ref={chatRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar scroll-smooth">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-30">
                  <div className="w-24 h-24 border-2 border-[#00d4ff] rounded-full flex items-center justify-center animate-spin">
                    <div className="w-16 h-16 border-2 border-[#00d4ff] rounded-full border-t-transparent animate-spin"></div>
                  </div>
                  <p className="mt-4 font-mono text-sm tracking-widest text-[#00d4ff]">INITIALIZING AI CORE...</p>
                </div>
              )}
              
              {messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.type === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2`}>
                  <div className={`max-w-[85%] rounded-2xl p-4 border shadow-lg backdrop-blur-sm ${
                    m.type === 'user' 
                      ? 'bg-[#00d4ff]/10 border-[#00d4ff]/30 text-white rounded-tr-none' 
                      : 'bg-white/5 border-white/10 text-gray-200 rounded-tl-none'
                  }`}>
                    <div className="text-[10px] uppercase tracking-wider opacity-50 mb-1 flex justify-between gap-4 font-mono">
                      <span>{m.type === 'user' ? 'USER COMMAND' : 'AI RESPONSE'}</span>
                      <span>{m.time}</span>
                    </div>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex items-center gap-2 text-[#00d4ff] text-xs p-2 animate-pulse font-mono">
                  <span className="w-2 h-2 bg-[#00d4ff] rounded-full"></span>
                  PROCESSING REQUEST...
                </div>
              )}
            </div>

            <div className="p-4 bg-black/60 border-t border-white/10 backdrop-blur-md">
              <div className="flex gap-3">
                <button 
                  onClick={toggleMic}
                  className={`p-4 rounded-xl border transition-all duration-300 ${
                    isListening 
                      ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_15px_rgba(255,0,0,0.3)] animate-pulse' 
                      : 'bg-black/40 border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/10'
                  }`}
                >
                  {isListening ? '🔴' : '🎤'}
                </button>
                
                <input 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder={isListening ? "Listening..." : "Enter command..."}
                  className="flex-1 bg-black/40 border border-[#00d4ff]/30 rounded-xl px-6 text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4ff] focus:bg-black/60 transition-all font-mono text-sm"
                />
                
                <button 
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="px-6 rounded-xl bg-[#00d4ff] text-black font-bold hover:bg-[#00b8e6] disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(0,212,255,0.3)]"
                >
                  SEND
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Device Control */}
          <div className="lg:col-span-3 space-y-4 overflow-y-auto custom-scrollbar">
            <div className="bg-[#0a0a1a]/60 backdrop-blur border border-white/10 rounded-2xl p-5 shadow-xl">
              <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-3 bg-[#00ff88]"></span> Devices
              </h3>
              <div className="space-y-3">
                {Object.entries(devices).map(([id, dev]) => (
                  <div key={id} className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5 hover:border-[#00d4ff]/30 transition-all">
                    <span className="text-sm font-medium text-white">{dev.name}</span>
                    <button 
                      onClick={() => toggleDevice(id, dev.state)}
                      className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${dev.state ? 'bg-[#00ff88]/20' : 'bg-gray-800'}`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform duration-300 transform ${dev.state ? 'translate-x-6 bg-[#00ff88] shadow-[0_0_8px_#00ff88]' : 'translate-x-0 bg-gray-500'}`} />
                    </button>
                  </div>
                ))}
                {Object.keys(devices).length === 0 && (
                  <div className="text-center text-gray-600 text-xs py-8">Scanning for devices...</div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
