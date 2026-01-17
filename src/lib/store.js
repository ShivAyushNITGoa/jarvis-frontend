import { create } from 'zustand';

export const useJarvisStore = create((set, get) => ({
  // Status
  isListening: false,
  isSpeaking: false,
  isProcessing: false,
  isConnected: true,
  
  // Messages
  messages: [],
  
  // Devices
  devices: {
    esp32_connected: false,
    light_main: false,
    light_bedroom: false,
    fan_main: false,
    ac_main: false,
    thermostat: 22,
  },
  
  // Sensor Data
  sensorData: {
    temperature: 25,
    humidity: 50,
    light_level: 500,
    motion: false,
  },
  
  // Recognition
  faceDetected: false,
  gestureDetected: null,
  poseData: null,
  
  // User
  user: {
    name: 'User',
    preferences: {},
  },
  
  // Actions
  setStatus: (status) => set(status),
  
  setListening: (value) => set({ isListening: value }),
  setSpeaking: (value) => set({ isSpeaking: value }),
  setProcessing: (value) => set({ isProcessing: value }),
  
  addMessage: (sender, text) => set((state) => ({
    messages: [...state.messages, {
      id: Date.now(),
      sender,
      text,
      timestamp: new Date().toISOString(),
    }]
  })),
  
  clearMessages: () => set({ messages: [] }),
  
  updateDevice: (deviceId, value) => set((state) => ({
    devices: { ...state.devices, [deviceId]: value }
  })),
  
  updateSensorData: (data) => set((state) => ({
    sensorData: { ...state.sensorData, ...data }
  })),
  
  setFaceDetected: (value) => set({ faceDetected: value }),
  setGestureDetected: (value) => set({ gestureDetected: value }),
  setPoseData: (value) => set({ poseData: value }),
  
  setUser: (user) => set({ user }),
}));