"use client";

import { useState, useEffect, useRef } from "react";

// API Configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://mainhushivam-jarvis-api.hf.space";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState("connecting");
  const [voice, setVoice] = useState("jarvis");
  const [audioInitialized, setAudioInitialized] = useState(false);
  
  // IoT State
  const [devices, setDevices] = useState({});
  const [sensors, setSensors] = useState({ temperature: "--", humidity: "--" });

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
    
    // Setup Browser Speech Recognition
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

    const interval = setInterval(fetchDevices, 5000);
    return () => {
      clearInterval(interval);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  // ============================================
  // HYBRID AUDIO ENGINE (The Fix)
  // ============================================

  const initializeAudio = () => {
    // 1. Unlock AudioContext
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    audioCtx.resume();

    // 2. Prepare HTML Audio
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
      audioRef.current.pause();
    }

    // 3. Prepare Browser TTS
    window.speechSynthesis.cancel();
    
    setAudioInitialized(true);
    addMessage("jarvis", "Audio systems active. I am listening.");
  };

  const speak = (text, audioUrl) => {
    if (!audioInitialized) return;

    // Strategy A: Try Backend Audio (High Quality)
    if (audioUrl) {
      // Clean URL
      const cleanBase = API_URL.replace(/\/$/, "");
      const cleanPath = audioUrl.startsWith("/") ? audioUrl : `/${audioUrl}`;
      const fullUrl = `${cleanBase}${cleanPath}`;

      console.log("🔊 Trying Backend Audio:", fullUrl);

      if (audioRef.current) {
        audioRef.current.src = fullUrl;
        audioRef.current.load();
        
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsSpeaking(true);
              startVisualizer();
            })
            .catch(error => {
              console.error("❌ Backend Audio Failed:", error);
              // Fallback to Strategy B immediately
              fallbackSpeak(text);
            });
        }
        
        audioRef.current.onended = () => {
          setIsSpeaking(false);
          stopVisualizer();
        };
        
        // If file fails to load (404, CORS)
        audioRef.current.onerror = () => {
          console.error("❌ Audio Load Error. Switching to Fallback.");
          fallbackSpeak(text);
        };
        
        return; // Exit if audio setup was successful
      }
    }

    // Strategy B: Browser Native TTS (Fallback)
    fallbackSpeak(text);
  };

  const fallbackSpeak = (text) => {
    console.log("🤖 Using Browser Fallback Voice");
    stopVisualizer(); // Canvas visualizer doesn't work well with native TTS
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Select Voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Samantha"));
    if (preferredVoice) utterance.voice = preferredVoice;
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
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

    // Stop any current speech
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    window.speechSynthesis.cancel();

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, user_id: "web_user", voice: voice })
      });
      
      const data = await res.json();
      addMessage("jarvis", data.response);
      
      // TRIGGER VOICE
      speak(data.response, data.audio_url);

      if (data.intent?.type === "device_control") fetchDevices();
      
    } catch (e) {
      console.error(e);
      addMessage("jarvis", "Connection error.");
    }
    
    setIsLoading(false);
  };

  const toggleMic = () => {
    if (!recognitionRef.current) return alert("Browser does not support voice input");
    if (!audioInitialized) initializeAudio();

    if (isListening) recognitionRef.current.stop();
    else {
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
      setTimeout(fetchDevices, 500);
    } catch (e) {}
  };

  // ============================================
  // VISUALIZER
  // ============================================
  const startVisualizer = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      const time = Date.now() / 200;
      for (let i = 0; i < canvas.width; i++) {
        const y = (Math.sin(i * 0.05 + time) * 15 + canvas.height / 2);
        ctx.lineTo(i, y);
      }
      ctx.strokeStyle = "#00d4ff";
      ctx.lineWidth = 2;
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
  // UI RENDER
  // ============================================
  return (
    <div className="min-h-screen bg-[#050510] text-[#00d4ff] font-sans overflow-hidden relative">
      
      {/* Hidden Audio Element */}
      <audio ref={audioRef} className="hidden" crossOrigin="anonymous" />

      {/* Startup Overlay */}
      {!audioInitialized && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          <div className="w-24 h-24 rounded-full border-4 border-[#00d4ff] flex items-center justify-center animate-pulse mb-8">
            <span className="text-4xl">🤖</span>
          </div>
          <h1 className="text-3xl font-bold mb-2 tracking-widest text-white">JARVIS SYSTEM</h1>
          <p className="mb-8 text-gray-400">Security protocols require authorization</p>
          <button 
            onClick={initializeAudio}
            className="px-10 py-4 bg-[#00d4ff] text-black font-bold rounded-full hover:bg-[#00b8e6] transition-all shadow-[0_0_30px_rgba(0,212,255,0.4)]"
          >
            INITIALIZE SYSTEMS
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-4 h-screen flex flex-col">
        {/* Header */}
        <header className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-tr from-[#00d4ff] to-blue-600 flex items-center justify-center ${isSpeaking ? 'animate-pulse shadow-[0_0_20px_#00d4ff]' : ''}`}>
              🤖
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-widest text-white">JARVIS</h1>
              <p className="text-[10px] text-[#00ff88]">ONLINE</p>
            </div>
          </div>
          <div className="flex gap-2">
            <select value={voice} onChange={e => setVoice(e.target.value)} className="bg-white/10 rounded px-2 py-1 text-xs outline-none">
              <option value="jarvis">JARVIS</option>
              <option value="friday">FRIDAY</option>
            </select>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
          
          {/* Left Panel */}
          <div className="lg:col-span-3 hidden lg:block space-y-4">
            <div className="bg-white/5 rounded-xl p-4 h-32 relative border border-white/10">
              <canvas ref={canvasRef} className="w-full h-full" width={300} height={100} />
              {!isSpeaking && <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-600">AUDIO IDLE</div>}
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h3 className="text-xs text-gray-500 mb-2">TELEMETRY</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center p-2 bg-black/20 rounded">
                  <div className="text-white font-bold">{sensors.temperature}°C</div>
                  <div className="text-[10px] text-gray-500">TEMP</div>
                </div>
                <div className="text-center p-2 bg-black/20 rounded">
                  <div className="text-[#00d4ff] font-bold">{sensors.humidity}%</div>
                  <div className="text-[10px] text-gray-500">HUM</div>
                </div>
              </div>
            </div>
          </div>

          {/* Center Chat */}
          <div className="lg:col-span-6 flex flex-col bg-white/5 rounded-2xl border border-white/10 relative overflow-hidden">
            <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl p-3 text-sm ${m.type === 'user' ? 'bg-[#00d4ff]/20 text-white' : 'bg-black/40 text-gray-300'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {isLoading && <div className="text-xs text-[#00d4ff] animate-pulse">Processing...</div>}
            </div>
            
            <div className="p-4 bg-black/40 flex gap-2">
              <button onClick={toggleMic} className={`p-3 rounded-lg border ${isListening ? 'border-red-500 text-red-500' : 'border-[#00d4ff] text-[#00d4ff]'}`}>
                {isListening ? '🔴' : '🎤'}
              </button>
              <input 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Command..."
                className="flex-1 bg-transparent border border-white/20 rounded-lg px-4 text-white focus:border-[#00d4ff] outline-none"
              />
              <button onClick={() => sendMessage()} className="px-4 bg-[#00d4ff] text-black font-bold rounded-lg">SEND</button>
            </div>
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h3 className="text-xs text-gray-500 mb-2">DEVICES</h3>
              <div className="space-y-2">
                {Object.entries(devices).map(([id, dev]) => (
                  <div key={id} className="flex justify-between items-center p-2 bg-black/20 rounded">
                    <span className="text-sm text-gray-300">{dev.name}</span>
                    <button 
                      onClick={() => toggleDevice(id, dev.state)}
                      className={`text-xs px-2 py-1 rounded ${dev.state ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'bg-gray-700 text-gray-400'}`}
                    >
                      {dev.state ? 'ON' : 'OFF'}
                    </button>
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
