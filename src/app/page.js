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
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  // ============================================
  // INITIALIZATION
  // ============================================
  
  useEffect(() => {
    checkHealth();
    fetchDevices();
    
    // Add Welcome Message
    addMessage("jarvis", "Systems online. Advanced protocols active. How may I serve you today?");

    // Setup Speech Recognition
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false; // Stop after speaking
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
    
    // Cleanup
    return () => {
      clearInterval(interval);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

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
      
      // Handle Audio
      if (data.audio_url) {
        playAudio(`${API_URL}${data.audio_url}`);
      }

      // Handle Intents
      if (data.intent?.type === "device_control") {
        fetchDevices();
      }
      
    } catch (e) {
      addMessage("jarvis", "I apologize, I'm having trouble connecting to my servers.");
    }
    
    setIsLoading(false);
  };

  const playAudio = (url) => {
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.play().catch(e => console.error("Audio play error:", e));
      setIsSpeaking(true);
      startVisualizer();
      
      audioRef.current.onended = () => {
        setIsSpeaking(false);
        stopVisualizer();
      };
    }
  };

  const toggleMic = () => {
    if (!recognitionRef.current) return alert("Voice input not supported in this browser");
    
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      // Clear input and start listening
      setInput("");
      recognitionRef.current.start();
    }
  };

  const toggleDevice = async (id, currentState) => {
    // Optimistic update
    setDevices(prev => ({
      ...prev,
      [id]: { ...prev[id], state: !currentState }
    }));

    try {
      await fetch(`${API_URL}/api/devices/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device: id, action: currentState ? "off" : "on" })
      });
      setTimeout(fetchDevices, 1000); // Sync after delay
    } catch (e) {
      console.error("Control failed");
      fetchDevices(); // Revert on error
    }
  };

  // ============================================
  // AUDIO VISUALIZER
  // ============================================
  
  const startVisualizer = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let width = canvas.width = canvas.clientWidth;
    let height = canvas.height = canvas.clientHeight;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Draw dynamic waves
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
      
      // Second wave
      ctx.beginPath();
      ctx.strokeStyle = "#00ff88";
      for (let i = 0; i < width; i++) {
        const y = Math.sin(i * 0.03 - time) * 15 * Math.sin(time * 0.3) + height / 2;
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
      
      // Draw flat line
      ctx.beginPath();
      ctx.strokeStyle = "#00d4ff33";
      ctx.lineWidth = 1;
      ctx.moveTo(0, canvasRef.current.height / 2);
      ctx.lineTo(canvasRef.current.width, canvasRef.current.height / 2);
      ctx.stroke();
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-[#050510] text-gray-100 font-sans selection:bg-[#00d4ff] selection:text-black overflow-hidden relative">
      <audio ref={audioRef} className="hidden" crossOrigin="anonymous" />
      
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#00d4ff]/5 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#00ff88]/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative max-w-7xl mx-auto p-4 md:p-6 h-screen flex flex-col">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-tr from-[#00d4ff] to-[#0066ff] shadow-[0_0_20px_rgba(0,212,255,0.4)]">
              <span className="text-2xl">🤖</span>
              {isSpeaking && <div className="absolute inset-0 rounded-full border-2 border-white animate-ping"></div>}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-white">
                JARVIS
              </h1>
              <p className="text-[10px] text-[#00ff88] tracking-[0.2em] font-mono">SYSTEM ONLINE</p>
            </div>
          </div>
          
          <div className="flex gap-4 mt-4 md:mt-0">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs">
              <div className={`w-2 h-2 rounded-full ${status === 'online' ? 'bg-[#00ff88] shadow-[0_0_8px_#00ff88]' : 'bg-red-500'} animate-pulse`}></div>
              {status === 'online' ? 'CONNECTED' : 'DISCONNECTED'}
            </div>
            
            <select 
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-full px-3 py-1 text-xs text-gray-300 outline-none focus:border-[#00d4ff] cursor-pointer"
            >
              <option value="jarvis">JARVIS (Male)</option>
              <option value="friday">FRIDAY (Female)</option>
              <option value="british">British</option>
              <option value="indian">Indian</option>
            </select>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
          
          {/* LEFT: Sensors & Quick Stats */}
          <div className="lg:col-span-3 space-y-4 overflow-y-auto pr-2 custom-scrollbar hidden lg:block">
            
            {/* Visualizer */}
            <div className="bg-[#0a0a1a]/60 backdrop-blur border border-white/10 rounded-2xl p-4 shadow-xl h-32 flex flex-col relative overflow-hidden">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Audio Analysis</span>
              <canvas ref={canvasRef} className="w-full h-full" />
            </div>

            {/* Sensor Grid */}
            <div className="bg-[#0a0a1a]/60 backdrop-blur border border-white/10 rounded-2xl p-5 shadow-xl">
              <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-3 bg-[#00d4ff]"></span> Telemetry
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <SensorCard label="Temp" value={`${sensors.temperature}°C`} icon="🌡️" color="text-white" />
                <SensorCard label="Humidity" value={`${sensors.humidity}%`} icon="💧" color="text-[#00d4ff]" />
                <SensorCard label="Light" value={sensors.light_level} icon="☀️" color="text-[#ffaa00]" />
                <SensorCard 
                  label="Security" 
                  value={sensors.motion ? "MOTION" : "SECURE"} 
                  icon="🛡️" 
                  color={sensors.motion ? "text-red-500 animate-pulse" : "text-[#00ff88]"} 
                />
              </div>
            </div>

            {/* Protocols */}
            <div className="space-y-2">
              <ProtocolButton 
                label="Morning Protocol" 
                icon="🌅" 
                onClick={() => sendMessage("Activate morning protocol")} 
                color="hover:border-[#ffaa00]/50 hover:bg-[#ffaa00]/10"
              />
              <ProtocolButton 
                label="Night Protocol" 
                icon="🌙" 
                onClick={() => sendMessage("Activate night protocol")} 
                color="hover:border-[#9944ff]/50 hover:bg-[#9944ff]/10"
              />
              <ProtocolButton 
                label="System Scan" 
                icon="🔍" 
                onClick={() => sendMessage("Run system diagnostics")} 
                color="hover:border-[#00ff88]/50 hover:bg-[#00ff88]/10"
              />
            </div>

          </div>

          {/* CENTER: Main Chat Interface */}
          <div className="lg:col-span-6 flex flex-col bg-[#0a0a1a]/80 backdrop-blur-md border border-white/10 rounded-3xl shadow-2xl relative overflow-hidden">
            
            {/* Messages */}
            <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar scroll-smooth">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-30 pointer-events-none">
                  <div className="w-24 h-24 border-2 border-[#00d4ff] rounded-full flex items-center justify-center animate-[spin_10s_linear_infinite]">
                    <div className="w-16 h-16 border-2 border-[#00d4ff] rounded-full border-t-transparent animate-[spin_3s_linear_infinite]"></div>
                  </div>
                  <p className="mt-4 font-mono text-sm tracking-widest">AWAITING INPUT</p>
                </div>
              )}
              
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.type === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                  <div className={`max-w-[85%] rounded-2xl p-4 shadow-lg backdrop-blur-sm ${
                    m.type === 'user' 
                      ? 'bg-gradient-to-br from-[#00d4ff]/20 to-[#0066ff]/20 border border-[#00d4ff]/30 text-white rounded-tr-none' 
                      : 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-none'
                  }`}>
                    <div className="text-[10px] uppercase tracking-wider opacity-50 mb-1 flex justify-between gap-4">
                      <span>{m.type === 'user' ? 'COMMAND' : 'RESPONSE'}</span>
                      <span>{m.time}</span>
                    </div>
                    <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap font-light">
                      {m.text}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none p-4 flex gap-2 items-center">
                    <div className="w-2 h-2 bg-[#00d4ff] rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-[#00d4ff] rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-[#00d4ff] rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="p-4 bg-black/40 border-t border-white/10 backdrop-blur-md">
              <div className="flex gap-3 relative group">
                <div className={`absolute -inset-0.5 bg-gradient-to-r from-[#00d4ff] to-[#00ff88] rounded-xl opacity-20 group-hover:opacity-40 transition duration-500 blur ${isListening ? 'opacity-100 animate-pulse' : ''}`}></div>
                
                <div className="relative flex gap-2 w-full bg-[#0a0a1a] rounded-xl p-1">
                  <button 
                    onClick={toggleMic}
                    className={`p-3 rounded-lg transition-all duration-300 ${
                      isListening 
                        ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' 
                        : 'hover:bg-white/10 text-[#00d4ff]'
                    }`}
                  >
                    {isListening ? (
                      <span className="relative flex h-5 w-5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500"></span>
                      </span>
                    ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                    )}
                  </button>
                  
                  <input 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    placeholder={isListening ? "Listening..." : "Enter command..."}
                    className="flex-1 bg-transparent text-white placeholder-gray-600 focus:outline-none font-mono text-sm"
                    autoComplete="off"
                  />
                  
                  <button 
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isLoading}
                    className="px-4 py-2 bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-[#00d4ff] rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Device Control */}
          <div className="lg:col-span-3 space-y-4 overflow-y-auto custom-scrollbar">
            
            {/* Quick Actions Panel */}
            <div className="bg-[#0a0a1a]/60 backdrop-blur border border-white/10 rounded-2xl p-5 shadow-xl">
              <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-3 bg-[#00ff88]"></span> Control Center
              </h3>
              <div className="space-y-2">
                {Object.entries(devices).map(([id, dev]) => (
                  <DeviceCard 
                    key={id} 
                    name={dev.name} 
                    type={dev.type} 
                    state={dev.state} 
                    onClick={() => toggleDevice(id, dev.state)} 
                  />
                ))}
                {Object.keys(devices).length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-600 text-xs">Scanning IoT Network...</p>
                    <div className="mt-2 w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div className="w-1/2 h-full bg-[#00d4ff] animate-[shimmer_2s_infinite]"></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Only: Sensors (Visible only on small screens) */}
            <div className="lg:hidden grid grid-cols-2 gap-3">
              <SensorCard label="Temp" value={`${sensors.temperature}°`} icon="🌡️" color="text-white" />
              <SensorCard label="Status" value={status.toUpperCase()} icon="📡" color={status === 'online' ? 'text-green-400' : 'text-red-400'} />
            </div>

          </div>

        </div>
      </div>
      
      {/* Global Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #00d4ff; }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}

// ============================================
// COMPONENTS
// ============================================

const SensorCard = ({ label, value, icon, color }) => (
  <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex items-center gap-3">
    <span className="text-xl">{icon}</span>
    <div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
    </div>
  </div>
);

const ProtocolButton = ({ label, icon, onClick, color }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-3 bg-black/40 border border-white/5 rounded-xl transition-all group ${color}`}
  >
    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <div className="flex-1 text-left">
      <div className="text-sm font-medium text-gray-200 group-hover:text-white">{label}</div>
      <div className="text-[10px] text-gray-600">Click to activate</div>
    </div>
    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[#00d4ff]">→</div>
  </button>
);

const DeviceCard = ({ name, type, state, onClick }) => {
  const icons = {
    light: "💡", fan: "🌀", ac: "❄️", thermostat: "🌡️", tv: "📺", lock: "🔒"
  };

  return (
    <div className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/5 hover:border-[#00d4ff]/20 transition-all group">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${state ? 'bg-[#00d4ff]/20 text-[#00d4ff]' : 'bg-white/5 text-gray-500'}`}>
          {icons[type] || "🔌"}
        </div>
        <div>
          <div className="text-sm font-medium text-gray-200 group-hover:text-white">{name}</div>
          <div className="text-[10px] text-gray-600 uppercase tracking-wider">{state ? 'Active' : 'Standby'}</div>
        </div>
      </div>
      
      <button 
        onClick={onClick}
        className={`w-10 h-5 rounded-full transition-colors duration-300 relative ${state ? 'bg-[#00ff88]/20' : 'bg-gray-800'}`}
      >
        <div className={`absolute top-1 left-1 w-3 h-3 rounded-full transition-transform duration-300 shadow-lg ${state ? 'translate-x-5 bg-[#00ff88]' : 'translate-x-0 bg-gray-500'}`} />
      </button>
    </div>
  );
};
