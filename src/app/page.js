"use client";

import { useState, useEffect, useRef } from "react";

// Get API URL from env or default
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://mainhushivam-jarvis-api.hf.space";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState("connecting");
  const [devices, setDevices] = useState({});
  const [sensors, setSensors] = useState({});
  const chatRef = useRef(null);
  const recognitionRef = useRef(null);

  // Initialize
  useEffect(() => {
    checkHealth();
    fetchDevices();
    
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
                {isListening ? '🔴' : '🎤'}
              </button>
              <input 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Enter command..."
                className="flex-1 bg-black/50 border border-[#00d4ff]/30 rounded-full px-6 text-white focus:outline-none focus:border-[#00d4ff]"
              />
              <button 
                onClick={() => sendMessage()}
                className="px-6 rounded-full bg-[#00d4ff] text-black font-bold hover:bg-[#00b8e6]"
              >
                SEND
              </button>
            </div>
          </div>

          {/* Right Panel - Devices */}
          <div className="space-y-6">
            
            {/* Quick Actions */}
            <div className="bg-black/40 border border-[#00d4ff]/30 rounded-xl p-4">
              <h3 className="text-sm font-bold text-[#00d4ff] mb-3 uppercase tracking-wider">Quick Access</h3>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => sendMessage("Turn on lights")} className="p-2 bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-xs rounded border border-[#00d4ff]/30">💡 Lights On</button>
                <button onClick={() => sendMessage("Turn off lights")} className="p-2 bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-xs rounded border border-[#00d4ff]/30">🌑 Lights Off</button>
                <button onClick={() => sendMessage("Weather report")} className="p-2 bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-xs rounded border border-[#00d4ff]/30">🌤️ Weather</button>
                <button onClick={() => sendMessage("System status")} className="p-2 bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-xs rounded border border-[#00d4ff]/30">📊 Status</button>
              </div>
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
            </div>

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

          </div>
        </div>
      </div>
    </div>
  );
}
