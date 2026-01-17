'use client';

import { useState, useRef, useEffect } from 'react';
import { useJarvisStore } from '@/lib/store';
import { jarvisAPI } from '@/lib/api';

export default function ChatInterface() {
  const [input, setInput] = useState('');
  const chatEndRef = useRef(null);
  
  const { 
    messages, 
    addMessage, 
    clearMessages,
    setProcessing,
    setSpeaking,
  } = useJarvisStore();

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    setInput('');
    
    // Add user message
    addMessage('user', userMessage);
    setProcessing(true);
    
    try {
      // Send to JARVIS
      const response = await jarvisAPI.chat(userMessage);
      
      if (response.success) {
        addMessage('jarvis', response.response);
        
        // Speak response
        if (window.speechSynthesis) {
          setSpeaking(true);
          const utterance = new SpeechSynthesisUtterance(response.response);
          utterance.onend = () => setSpeaking(false);
          window.speechSynthesis.speak(utterance);
        }
      } else {
        addMessage('jarvis', 'I encountered an error. Please try again.');
      }
    } catch (error) {
      addMessage('jarvis', 'Connection error. Please check your network.');
    }
    
    setProcessing(false);
  };

  return (
    <div className="glass rounded-2xl overflow-hidden h-[500px] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-jarvis-blue/20 flex justify-between items-center">
        <h2 className="text-jarvis-blue font-semibold tracking-wider">
          COMMUNICATION LOG
        </h2>
        <button 
          onClick={clearMessages}
          className="text-white/40 hover:text-white text-sm"
        >
          Clear
        </button>
      </div>
      
      {/* Messages */}
      <div className="chat-container flex-1">
        {messages.length === 0 && (
          <div className="text-center text-white/40 py-8">
            <p>Say "Hey JARVIS" or type a message to begin...</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.sender}`}>
            <div className="message-sender">
              {msg.sender === 'jarvis' ? 'JARVIS' : 'YOU'}
            </div>
            <div className="text-white">{msg.text}</div>
          </div>
        ))}
        
        <div ref={chatEndRef} />
      </div>
      
      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-jarvis-blue/20">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-black/30 border border-jarvis-blue/30 rounded-full px-5 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-jarvis-blue"
          />
          <button type="submit" className="btn-primary">
            Send
          </button>
        </div>
      </form>
    </div>
  );
}