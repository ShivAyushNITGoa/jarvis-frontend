"use client";

import { useState, useEffect, useRef } from "react";

// Get API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://mainhushivam-jarvis-api.hf.space";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState("connecting");
  const [voice, setVoice] = useState("jarvis");
  const [devices, setDevices] = useState({});
  const [sensors, setSensors] = useState({});
  
  const chatRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);

  // Initialize
  useEffect(() => {
    checkHealth();
    fetchDevices();
    
    // Welcome
    addMessage("jarvis", "System online. Advanced mode active. How can I serve you?");

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

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const addMessage = (type, text) => {
    setMessages(prev => [...prev, { type, text, time: new Date().toLocaleTimeString() }]);
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
      console.error("Device fetch failed");
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
      
      // Play Audio from Backend
      if (data.audio_url) {
        const audioUrl = `${API_URL}${data.audio_url}`;
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play();
        }
      }

      if (data.intent?.type === "device_control") fetchDevices();
      
    } catch (e) {
      addMessage("jarvis", "Connection error. Please try again.");
    }
    
    setIsLoading(false);
  };

  const toggleMic = () => {
    if (!recognitionRef.current) return alert("Voice not supported");
    
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

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
    <div className="min-h-screen bg-[#050510] text-[#00d4ff] font-sans selection:bg-[#00d4ff] selection:text-black">
      <audio ref={audioRef} className="hidden" />
      
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-[#00d4ff]/20 pb-6">
          <div className="text-center md:text-left">
            <h1 className="text-6xl font-bold tracking-tighter drop-shadow-[0_0_15px_rgba(0,212,255,0.5)]">
              JARVIS
            </h1>
            <p className="text-sm text-gray-400 tracking-widest mt-1">ADVANCED AI SYSTEM v3.0</p>
          </div>
          
          <div className="flex items-center gap-6 mt-4 md:mt-0">
            <div className="flex flex-col items-end">
              <span className="text-xs text-gray-500 uppercase">System Status</span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${status === 'online' ? 'bg-[#00ff88] shadow-[0_0_10px_#00ff88]' : 'bg-red-500'} animate-pulse`}></span>
                <span className="font-bold text-white tracking-wide">{status.toUpperCase()}</span>
              </div>
            </div>
            
            <div className="flex flex-col items-end">
              <span className="text-xs text-gray-500 uppercase">Voice Module</span>
              <select 
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="bg-[#0a0a1a] border border-[#00d4ff]/30 text-[#00d4ff] text-xs rounded px-2 py-1 outline-none focus:border-[#00d4ff]"
              >
                <option value="jarvis">JARVIS (Male)</option>
                <option value="friday">FRIDAY (Female)</option>
                <option value="british">British</option>
                <option value="indian">Indian</option>
              </select>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-200px)]">
          
          {/* LEFT: Devices & Sensors */}
          <div className="lg:col-span-3 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
            
            {/* Sensor Panel */}
            <div className="bg-[#0a0a1a]/80 backdrop-blur border border-[#00d4ff]/20 rounded-xl p-5 shadow-lg">
              <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-4 bg-[#00d4ff]"></span> Environment
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-black/40 rounded-lg border border-white/5">
                  <div className="text-2xl font-bold text-white">{sensors.temperature || '--'}°</div>
                  <div className="text-[10px] text-gray-500 uppercase mt-1">Temp</div>
                </div>
                <div className="text-center p-3 bg-black/40 rounded-lg border border-white/5">
                  <div className="text-2xl font-bold text-[#00ff88]">{sensors.humidity || '--'}%</div>
                  <div className="text-[10px] text-gray-500 uppercase mt-1">Humidity</div>
                </div>
                <div className="text-center p-3 bg-black/40 rounded-lg border border-white/5">
                  <div className="text-xl font-bold text-[#ffaa00]">{sensors.light_level || '--'}</div>
                  <div className="text-[10px] text-gray-500 uppercase mt-1">Light</div>
                </div>
                <div className="text-center p-3 bg-black/40 rounded-lg border border-white/5">
                  <div className={`text-xl font-bold ${sensors.motion ? 'text-red-500 animate-pulse' : 'text-gray-600'}`}>
                    {sensors.motion ? 'DETECTED' : 'CLEAR'}
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase mt-1">Motion</div>
                </div>
              </div>
            </div>

            {/* Device Control */}
            <div className="bg-[#0a0a1a]/80 backdrop-blur border border-[#00d4ff]/20 rounded-xl p-5 shadow-lg">
              <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-4 bg-[#00ff88]"></span> Connected Devices
              </h3>
              <div className="space-y-3">
                {Object.entries(devices).map(([id, dev]) => (
                  <div key={id} className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5 hover:border-[#00d4ff]/30 transition-all">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white">{dev.name}</span>
                      <span className="text-[10px] text-gray-500 uppercase">{dev.type}</span>
                    </div>
                    <button 
                      onClick={() => toggleDevice(id, dev.state)}
                      className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${dev.state ? 'bg-[#00ff88]/20' : 'bg-gray-800'}`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform duration-300 transform ${dev.state ? 'translate-x-6 bg-[#00ff88] shadow-[0_0_8px_#00ff88]' : 'translate-x-0 bg-gray-500'}`} />
                    </button>
                  </div>
                ))}
                {Object.keys(devices).length === 0 && (
                  <div className="text-center text-gray-600 text-xs py-4">Scanning for devices...</div>
                )}
              </div>
            </div>

          </div>

          {/* CENTER: Chat Interface */}
          <div className="lg:col-span-6 flex flex-col h-full bg-[#0a0a1a]/90 backdrop-blur border border-[#00d4ff]/20 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative">
            
            {/* Messages Area */}
            <div ref={chatRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.type === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-4 border ${
                    m.type === 'user' 
                      ? 'bg-[#00d4ff]/10 border-[#00d4ff]/30 text-white rounded-br-none' 
                      : 'bg-[#0a0a1a] border-white/10 text-gray-200 rounded-bl-none shadow-lg'
                  }`}>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</div>
                  </div>
                  <span className="text-[10px] text-gray-600 mt-1 px-2">{m.time}</span>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex items-center gap-2 text-[#00d4ff] text-xs p-2 animate-pulse">
                  <span className="w-1.5 h-1.5 bg-[#00d4ff] rounded-full"></span>
                  PROCESSING REQUEST...
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-black/60 border-t border-[#00d4ff]/20">
              <div className="flex gap-3 relative">
                <button 
                  onClick={toggleMic}
                  className={`p-4 rounded-xl border transition-all duration-300 ${
                    isListening 
                      ? 'bg-[#00ff88]/20 border-[#00ff88] text-[#00ff88] shadow-[0_0_15px_rgba(0,255,136,0.3)]' 
                      : 'bg-black/40 border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/10'
                  }`}
                >
                  {isListening ? (
                    <div className="flex gap-1 h-5 items-center">
                      <div className="w-1 h-3 bg-[#00ff88] animate-[bounce_1s_infinite]"></div>
                      <div className="w-1 h-5 bg-[#00ff88] animate-[bounce_1.2s_infinite]"></div>
                      <div className="w-1 h-3 bg-[#00ff88] animate-[bounce_1s_infinite]"></div>
                    </div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                  )}
                </button>
                
                <input 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Enter command or query..."
                  className="flex-1 bg-black/40 border border-[#00d4ff]/30 rounded-xl px-6 text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4ff] focus:bg-black/60 transition-all font-mono text-sm"
                />
                
                <button 
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="px-6 rounded-xl bg-[#00d4ff] text-black font-bold hover:bg-[#00b8e6] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(0,212,255,0.3)] hover:shadow-[0_0_25px_rgba(0,212,255,0.5)]"
                >
                  SEND
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Quick Actions & Stats */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Quick Actions */}
            <div className="bg-[#0a0a1a]/80 backdrop-blur border border-[#00d4ff]/20 rounded-xl p-5 shadow-lg">
              <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-4 bg-[#ffaa00]"></span> Protocols
              </h3>
              <div className="grid grid-cols-1 gap-2">
                <button onClick={() => sendMessage("Good morning protocol")} className="flex items-center gap-3 p-3 bg-black/40 hover:bg-[#ffaa00]/10 border border-white/5 hover:border-[#ffaa00]/50 rounded-lg group transition-all">
                  <span className="text-xl">🌅</span>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-bold text-white group-hover:text-[#ffaa00]">Morning Protocol</span>
                    <span className="text-[10px] text-gray-500">Lights On • News • Weather</span>
                  </div>
                </button>
                
                <button onClick={() => sendMessage("Good night protocol")} className="flex items-center gap-3 p-3 bg-black/40 hover:bg-[#9944ff]/10 border border-white/5 hover:border-[#9944ff]/50 rounded-lg group transition-all">
                  <span className="text-xl">🌙</span>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-bold text-white group-hover:text-[#9944ff]">Night Protocol</span>
                    <span className="text-[10px] text-gray-500">Lights Off • Security • Alarm</span>
                  </div>
                </button>

                <button onClick={() => sendMessage("Security check")} className="flex items-center gap-3 p-3 bg-black/40 hover:bg-[#ff4444]/10 border border-white/5 hover:border-[#ff4444]/50 rounded-lg group transition-all">
                  <span className="text-xl">🛡️</span>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-bold text-white group-hover:text-[#ff4444]">Security Scan</span>
                    <span className="text-[10px] text-gray-500">Check Sensors • Cameras</span>
                  </div>
                </button>
              </div>
            </div>

            {/* System Info */}
            <div className="bg-[#0a0a1a]/80 backdrop-blur border border-[#00d4ff]/20 rounded-xl p-5 shadow-lg">
              <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-4 bg-white"></span> System Stats
              </h3>
              <div className="space-y-4 text-xs font-mono">
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-gray-500">CORE</span>
                  <span className="text-[#00d4ff]">LLaMA 3.3 70B</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-gray-500">MEMORY</span>
                  <span className="text-[#00ff88]">ACTIVE</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-gray-500">LATENCY</span>
                  <span className="text-white">~45ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">UPTIME</span>
                  <span className="text-white">99.9%</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
