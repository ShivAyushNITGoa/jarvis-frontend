"use client";

import { useState, useEffect, useRef } from "react";

// ============================
// CONFIG
// ============================

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://mainhushivam-jarvis-api.hf.space";

// ============================
// MAIN PAGE COMPONENT
// ============================

export default function Home() {
  // --- CHAT STATE ---
  const [messages, setMessages] = useState([]); // [{type: "user"|"jarvis"|"system", text, time}]
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // --- VOICE / AUDIO STATE ---
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [voiceName, setVoiceName] = useState("default_browser"); // for browser TTS
  const [availableVoices, setAvailableVoices] = useState([]);

  // --- SYSTEM / IOT STATE ---
  const [status, setStatus] = useState("connecting"); // "online" | "offline"
  const [devices, setDevices] = useState({});
  const [sensors, setSensors] = useState({
    temperature: "--",
    humidity: "--",
    light_level: "--",
    motion: false,
    gas_level: "--",
  });

  // --- REFS ---
  const chatRef = useRef(null);
  const recognitionRef = useRef(null); // Web Speech API recognition
  const canvasRef = useRef(null); // For simple visualizer
  const visualizerAnimRef = useRef(null);

  // ============================
  // INITIALIZATION
  // ============================

  // 1. On mount: check backend, fetch devices, setup voices & recognition
  useEffect(() => {
    initSystem();
  }, []);

  const initSystem = async () => {
    // Add greeting
    addMessage(
      "jarvis",
      "JARVIS online. Core systems operational. Type or speak a command to begin."
    );

    // Check backend /health
    await checkHealth();

    // Fetch devices & sensors initially
    await fetchDevices();

    // Setup polling for devices every 5s
    const interval = setInterval(fetchDevices, 5000);

    // Setup browser TTS voices
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
        // If you want, you can auto-pick a voice that sounds “Jarvis-like”
        const jarvisLike =
          voices.find((v) =>
            v.name.toLowerCase().includes("daniel") // Britishish
          ) || voices.find((v) => v.lang === "en-GB");
        if (jarvisLike) setVoiceName(jarvisLike.name);
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Setup Web Speech Recognition (for mic)
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = false;
        recognition.lang = "en-US";

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
          if (event.results[0].isFinal) {
            handleSend(transcript);
          }
        };
      }
    }

    return () => {
      clearInterval(interval);
      stopVisualizer();
    };
  };

  // 2. Auto scroll chat when messages update
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // ============================
  // BACKEND COMMUNICATION
  // ============================

  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_URL}/health`);
      if (!res.ok) throw new Error("Bad health response");
      const data = await res.json();
      if (data.status === "healthy") {
        setStatus("online");
      } else {
        setStatus("offline");
      }
    } catch (e) {
      console.error("Health check failed:", e);
      setStatus("offline");
    }
  };

  const fetchDevices = async () => {
    try {
      const res = await fetch(`${API_URL}/api/devices/status`);
      if (!res.ok) throw new Error("Bad devices response");
      const data = await res.json();
      setDevices(data.devices || {});
      setSensors(data.sensors || {});
    } catch (e) {
      console.error("Device fetch failed:", e);
    }
  };

  const sendToBackend = async (message) => {
    const body = {
      message,
      user_id: "web_user",
    };
    const res = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    return await res.json(); // {response, intent, timestamp}
  };

  const sendDeviceCommand = async (deviceId, action) => {
    try {
      const body = { device: deviceId, action };
      const res = await fetch(`${API_URL}/api/devices/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Device control failed");
      await fetchDevices();
    } catch (e) {
      console.error("Control device failed:", e);
    }
  };

  // ============================
  // CHAT + VOICE LOGIC
  // ============================

  const addMessage = (type, text) => {
    setMessages((prev) => [
      ...prev,
      {
        type, // "user" | "jarvis" | "system"
        text,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const handleSend = async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading) return;

    setInput("");
    setIsLoading(true);
    addMessage("user", text);

    // Stop any ongoing speech
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    try {
      const data = await sendToBackend(text);
      const reply = data.response || "No response.";
      addMessage("jarvis", reply);

      // Speak it using browser TTS
      speakText(reply);

      // If backend told us it did device control, refresh devices
      if (data.intent && data.intent.type === "device_control") {
        await fetchDevices();
      }
    } catch (e) {
      console.error("Chat error:", e);
      addMessage("jarvis", "I encountered a connection issue.");
    }

    setIsLoading(false);
  };

  const speakText = (text) => {
    if (typeof window === "undefined") return;
    if (!audioInitialized) {
      // If user never clicked to allow audio, don't auto-play
      console.warn("Audio not initialized (user never clicked).");
      return;
    }
    if (!window.speechSynthesis) {
      console.warn("speechSynthesis not supported in this browser.");
      return;
    }

    // Cancel any existing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Try to set specific voice if available
    const voices = window.speechSynthesis.getVoices();
    if (voiceName !== "default_browser") {
      const chosen = voices.find((v) => v.name === voiceName);
      if (chosen) {
        utterance.voice = chosen;
      }
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      startVisualizer();
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      stopVisualizer();
    };

    window.speechSynthesis.speak(utterance);
  };

  const toggleMic = () => {
    if (!recognitionRef.current) {
      alert("Browser does not support SpeechRecognition.");
      return;
    }
    // Ensure audio is initialized (user interaction)
    if (!audioInitialized) {
      initializeAudio();
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const initializeAudio = () => {
    // Any user click calling this will satisfy browser's "user gesture" requirement
    if (typeof window !== "undefined" && window.speechSynthesis) {
      // Prime voices
      window.speechSynthesis.cancel();
    }
    setAudioInitialized(true);
    addMessage("system", "Audio initialized. I will now speak my responses.");
  };

  // ============================
  // VISUALIZER (Simple)
  // ============================

  const startVisualizer = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const draw = () => {
      const w = (canvas.width = canvas.clientWidth || 300);
      const h = (canvas.height = canvas.clientHeight || 100);
      ctx.clearRect(0, 0, w, h);
      const t = Date.now() / 200;

      ctx.beginPath();
      ctx.strokeStyle = "#00d4ff";
      ctx.lineWidth = 2;

      for (let x = 0; x < w; x++) {
        const y = Math.sin(x * 0.03 + t) * 15 + h / 2;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      visualizerAnimRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const stopVisualizer = () => {
    cancelAnimationFrame(visualizerAnimRef.current);
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const w = (canvas.width = canvas.clientWidth || 300);
    const h = (canvas.height = canvas.clientHeight || 100);
    ctx.clearRect(0, 0, w, h);
    // Draw idle line
    ctx.beginPath();
    ctx.strokeStyle = "#444";
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  };

  // ============================
  // RENDER
  // ============================

  return (
    <div className="min-h-screen bg-[#050510] text-[#00d4ff] font-sans relative overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-[#00d4ff33] rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-[#00ff8844] rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto p-4 md:p-6 h-screen flex flex-col">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-tr from-[#00d4ff] to-blue-600 shadow-[0_0_20px_rgba(0,212,255,0.4)] ${
                isSpeaking ? "animate-pulse" : ""
              }`}
            >
              🤖
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-[0.2em] text-white">
                JARVIS
              </h1>
              <p className="text-[10px] text-[#00ff88] font-mono">
                STATUS: {status.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4 md:mt-0">
            {/* Voice selector (browser voices) */}
            <select
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              className="bg-black/40 border border-[#00d4ff]/40 rounded-full px-3 py-1 text-xs outline-none text-gray-200"
            >
              <option value="default_browser">Browser Default Voice</option>
              {availableVoices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>

            {/* Audio init button if not yet done */}
            {!audioInitialized && (
              <button
                onClick={initializeAudio}
                className="px-3 py-1 text-xs bg-[#00d4ff] text-black rounded-full font-bold"
              >
                ENABLE AUDIO
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
          {/* LEFT: Sensors + Visualizer */}
          <div className="lg:col-span-3 hidden lg:flex flex-col space-y-4">
            <div className="bg-[#0a0a1a]/80 border border-white/10 rounded-2xl p-4 shadow-lg h-32 relative overflow-hidden">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest">
                Audio Visualizer
              </span>
              <canvas ref={canvasRef} className="w-full h-full mt-2" />
            </div>

            <div className="bg-[#0a0a1a]/80 border border-white/10 rounded-2xl p-4 shadow-lg">
              <h3 className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">
                Telemetry
              </h3>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-black/40 rounded-lg p-2">
                  <div className="text-xl text-white font-bold">
                    {sensors.temperature}°C
                  </div>
                  <div className="text-[10px] text-gray-500">Temperature</div>
                </div>
                <div className="bg-black/40 rounded-lg p-2">
                  <div className="text-xl text-[#00d4ff] font-bold">
                    {sensors.humidity}%
                  </div>
                  <div className="text-[10px] text-gray-500">Humidity</div>
                </div>
              </div>
            </div>
          </div>

          {/* CENTER: Chat */}
          <div className="lg:col-span-6 flex flex-col bg-[#0a0a1a]/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div
              ref={chatRef}
              className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar"
            >
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.type === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl p-3 text-sm ${
                      m.type === "user"
                        ? "bg-[#00d4ff]/20 text-white self-end"
                        : m.type === "system"
                        ? "bg-yellow-500/10 text-yellow-200 border border-yellow-500/30"
                        : "bg-white/5 text-gray-200 border border-white/10"
                    }`}
                  >
                    <div className="text-[10px] text-gray-400 mb-1">
                      {m.type.toUpperCase()} • {m.time}
                    </div>
                    <div>{m.text}</div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="text-xs text-[#00d4ff] animate-pulse">
                  Processing...
                </div>
              )}
            </div>

            <div className="p-4 bg-black/60 border-t border-white/10 flex gap-2">
              <button
                onClick={toggleMic}
                className={`p-3 rounded-lg border ${
                  isListening
                    ? "border-red-500 text-red-500"
                    : "border-[#00d4ff] text-[#00d4ff]"
                }`}
              >
                {isListening ? "🔴" : "🎤"}
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type a command or question..."
                className="flex-1 bg-transparent border border-white/20 rounded-lg px-3 text-white text-sm focus:outline-none focus:border-[#00d4ff]"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="px-4 bg-[#00d4ff] text-black font-bold rounded-lg disabled:opacity-50"
              >
                SEND
              </button>
            </div>
          </div>

          {/* RIGHT: Devices */}
          <div className="lg:col-span-3 flex flex-col space-y-4">
            <div className="bg-[#0a0a1a]/80 border border-white/10 rounded-2xl p-4 shadow-lg">
              <h3 className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">
                Devices
              </h3>
              <div className="space-y-2">
                {Object.entries(devices).map(([id, dev]) => (
                  <div
                    key={id}
                    className="flex justify-between items-center bg-black/40 rounded-lg px-3 py-2"
                  >
                    <span className="text-sm text-gray-200">{dev.name}</span>
                    <button
                      onClick={() => sendDeviceCommand(id, dev.state ? "off" : "on")}
                      className={`text-xs px-2 py-1 rounded ${
                        dev.state
                          ? "bg-[#00ff88]/20 text-[#00ff88]"
                          : "bg-gray-700 text-gray-300"
                      }`}
                    >
                      {dev.state ? "ON" : "OFF"}
                    </button>
                  </div>
                ))}
                {Object.keys(devices).length === 0 && (
                  <div className="text-xs text-gray-500 text-center py-4">
                    No devices registered
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Small scrollbar styling */}
        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkitscrollbar-thumb {
            background: #333;
            border-radius: 4px;
          }
        `}</style>
      </div>
    </div>
  );
}
