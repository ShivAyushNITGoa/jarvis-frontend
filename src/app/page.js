"use client";

import { useState, useEffect, useRef } from "react";

// ============================
// CONFIG
// ============================

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://mainhushivam-jarvis-api.hf.space";

// ============================
// MAIN COMPONENT
// ============================

export default function Home() {
  // --- CHAT STATE ---
  const [messages, setMessages] = useState([]); // { type: "user"|"jarvis"|"system", text, time }
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // --- VOICE / AUDIO STATE ---
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceName, setVoiceName] = useState("default");
  const [voices, setVoices] = useState([]);
  const [audioReady, setAudioReady] = useState(false);

  // --- SYSTEM / IOT STATE ---
  const [status, setStatus] = useState("connecting"); // "online" | "offline"
  const [devices, setDevices] = useState({});
  const [sensors, setSensors] = useState({
    temperature: "--",
    humidity: "--",
    light_level: "--",
    motion: false,
    gas_level: "--"
  });

  // --- REFS ---
  const chatRef = useRef(null);
  const recognitionRef = useRef(null);
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  // ============================
  // INITIALIZATION
  // ============================

  useEffect(() => {
    initSystem();
  }, []);

  useEffect(() => {
    // Autoscroll chat on new messages
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const initSystem = async () => {
    // Initial greeting
    addMessage(
      "jarvis",
      "JARVIS online. Voice systems will activate after your first interaction."
    );

    // Backend health
    await checkHealth();

    // Devices / sensors
    await fetchDevices();
    const interval = setInterval(fetchDevices, 5000);

    // Setup voices
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const loadVoices = () => {
        const vs = window.speechSynthesis.getVoices();
        setVoices(vs);
        // Try to choose a decent default English voice
        const preferred =
          vs.find((v) => v.name.toLowerCase().includes("daniel")) || // example
          vs.find((v) => v.lang.startsWith("en-")) ||
          null;
        if (preferred) setVoiceName(preferred.name);
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Setup SpeechRecognition
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        recognitionRef.current = rec;
        rec.continuous = false;
        rec.lang = "en-US";
        rec.onstart = () => setIsListening(true);
        rec.onend = () => setIsListening(false);
        rec.onresult = (e) => {
          const transcript = e.results[0][0].transcript;
          setInput(transcript);
          if (e.results[0].isFinal) {
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

  // ============================
  // BACKEND COMM
  // ============================

  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_URL}/health`);
      if (!res.ok) throw new Error("bad health");
      const data = await res.json();
      if (data.status === "healthy") setStatus("online");
      else setStatus("offline");
    } catch (e) {
      console.error("Health error:", e);
      setStatus("offline");
    }
  };

  const fetchDevices = async () => {
    try {
      const res = await fetch(`${API_URL}/api/devices/status`);
      if (!res.ok) throw new Error("bad devices");
      const data = await res.json();
      setDevices(data.devices || {});
      setSensors(data.sensors || {});
    } catch (e) {
      console.error("Device fetch error:", e);
    }
  };

  const sendChatToBackend = async (message) => {
    const body = {
      message,
      user_id: "web_user"
    };
    const res = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Chat failed with ${res.status}`);
    return await res.json(); // { response, intent, timestamp }
  };

  const sendDeviceCommand = async (deviceId, action) => {
    try {
      const body = { device: deviceId, action };
      const res = await fetch(`${API_URL}/api/devices/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("control failed");
      await fetchDevices();
    } catch (e) {
      console.error("Device control error:", e);
    }
  };

  // ============================
  // CHAT / VOICE LOGIC
  // ============================

  const addMessage = (type, text) => {
    setMessages((prev) => [
      ...prev,
      {
        type,
        text,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        })
      }
    ]);
  };

  const handleSend = async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading) return;

    setInput("");
    setIsLoading(true);
    addMessage("user", text);

    // Make sure browser allows audio (user interacted)
    if (!audioReady) {
      setAudioReady(true);
    }

    // Cancel any existing speech
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    try {
      const data = await sendChatToBackend(text);
      const reply = data.response || "No response.";
      addMessage("jarvis", reply);

      // Voice output using browser TTS (no audio_url required)
      speakText(reply);

      // If device control
      if (data.intent && data.intent.type === "device_control") {
        await fetchDevices();
      }
    } catch (e) {
      console.error("Chat error:", e);
      addMessage(
        "jarvis",
        "I encountered a connection problem. Please try again."
      );
    }

    setIsLoading(false);
  };

  const speakText = (text) => {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) {
      console.warn("speechSynthesis not supported.");
      return;
    }

    // If user never clicked or interacted, some browsers may still block;
    // but sending a message via click generally counts as a gesture.
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Choose a voice, if we have one
    if (voiceName !== "default") {
      const chosen = voices.find((v) => v.name === voiceName);
      if (chosen) utterance.voice = chosen;
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
      alert("This browser does not support voice input.");
      return;
    }
    if (!audioReady) setAudioReady(true);

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  // ============================
  // VISUALIZER
  // ============================

  const startVisualizer = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const draw = () => {
      const w = (canvas.width = canvas.clientWidth || 300);
      const h = (canvas.height = canvas.clientHeight || 80);
      ctx.clearRect(0, 0, w, h);

      const t = Date.now() / 200;
      ctx.beginPath();
      ctx.strokeStyle = "#00d4ff";
      ctx.lineWidth = 2;

      for (let x = 0; x < w; x++) {
        const y = Math.sin(x * 0.04 + t) * 12 + h / 2;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const stopVisualizer = () => {
    cancelAnimationFrame(animRef.current);
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const w = (canvas.width = canvas.clientWidth || 300);
    const h = (canvas.height = canvas.clientHeight || 80);
    ctx.clearRect(0, 0, w, h);
    // Idle line
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.strokeStyle = "#333";
    ctx.stroke();
  };

  // ============================
  // RENDER
  // ============================

  return (
    <div className="min-h-screen bg-[#050510] text-[#00d4ff] font-sans relative overflow-hidden">
      {/* Glow background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-[#00d4ff33] rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-[#00ff8844] rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto p-4 md:p-6 h-screen flex flex-col">
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-full bg-gradient-to-tr from-[#00d4ff] to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(0,212,255,0.4)] ${
                isSpeaking ? "animate-pulse" : ""
              }`}
            >
              🤖
            </div>
            <div>
              <div className="text-2xl font-bold tracking-[0.25em] text-white">
                JARVIS
              </div>
              <div className="text-[10px] text-[#00ff88] font-mono">
                STATUS: {status.toUpperCase()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <select
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              className="bg-black/40 border border-[#00d4ff]/40 rounded-full px-3 py-1 text-xs text-gray-200 outline-none"
            >
              <option value="default">Default Browser Voice</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
          {/* LEFT COLUMN: SENSORS + VISUALIZER */}
          <div className="lg:col-span-3 hidden lg:flex flex-col space-y-4">
            <div className="bg-[#0a0a1a]/80 border border-white/10 rounded-2xl p-4 shadow-lg h-28 relative overflow-hidden">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest">
                Audio Visualizer
              </div>
              <canvas
                ref={canvasRef}
                className="w-full h-full mt-2"
                style={{ minHeight: "60px" }}
              />
            </div>

            <div className="bg-[#0a0a1a]/80 border border-white/10 rounded-2xl p-4 shadow-lg">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">
                Telemetry
              </div>
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

          {/* CENTER COLUMN: CHAT */}
          <div className="lg:col-span-6 flex flex-col bg-[#0a0a1a]/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            {/* Chat area */}
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
                        ? "bg-[#00d4ff]/20 text-white"
                        : m.type === "system"
                        ? "bg-yellow-500/10 text-yellow-200 border border-yellow-500/40"
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

            {/* Input area */}
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

          {/* RIGHT COLUMN: DEVICES */}
          <div className="lg:col-span-3 flex flex-col space-y-4">
            <div className="bg-[#0a0a1a]/80 border border-white/10 rounded-2xl p-4 shadow-lg">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">
                Devices
              </div>
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
                    No devices connected
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SCROLLBAR STYLE */}
        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #333;
            border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #00d4ff;
          }
        `}</style>
      </div>
    </div>
  );
}
