const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://your-backend.hf.space';

export const jarvisAPI = {
  // Chat with JARVIS
  async chat(message, context = {}) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: ['chat', message, JSON.stringify(context)]
        }),
      });
      
      const data = await response.json();
      return JSON.parse(data.data[0]);
    } catch (error) {
      console.error('Chat error:', error);
      return { success: false, error: error.message };
    }
  },

  // Control device
  async controlDevice(device, action, value = null) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: ['device_control', device, action, value?.toString() || '']
        }),
      });
      
      const data = await response.json();
      return JSON.parse(data.data[0]);
    } catch (error) {
      console.error('Device control error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get device status
  async getDeviceStatus() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: ['get_status', '', '', '']
        }),
      });
      
      const data = await response.json();
      return JSON.parse(data.data[0]);
    } catch (error) {
      console.error('Get status error:', error);
      return { success: false, error: error.message };
    }
  },

  // Send sensor data (from ESP32)
  async sendSensorData(sensorData) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: ['sensor_data', '', '', JSON.stringify(sensorData)]
        }),
      });
      
      const data = await response.json();
      return JSON.parse(data.data[0]);
    } catch (error) {
      console.error('Sensor data error:', error);
      return { success: false, error: error.message };
    }
  },

  // Search
  async search(query) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: ['search', query, '', '']
        }),
      });
      
      const data = await response.json();
      return JSON.parse(data.data[0]);
    } catch (error) {
      console.error('Search error:', error);
      return { success: false, error: error.message };
    }
  },

  // Weather
  async getWeather(location = '') {
    try {
      const response = await fetch(`${BACKEND_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: ['weather', location, '', '']
        }),
      });
      
      const data = await response.json();
      return JSON.parse(data.data[0]);
    } catch (error) {
      console.error('Weather error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get system status
  async getStatus() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: ['status', '', '', '']
        }),
      });
      
      const data = await response.json();
      return JSON.parse(data.data[0]);
    } catch (error) {
      console.error('Status error:', error);
      return { status: 'offline', error: error.message };
    }
  },

  // Problem solving
  async solveProblem(problem, context = {}) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: ['solve', problem, JSON.stringify(context), '']
        }),
      });
      
      const data = await response.json();
      return JSON.parse(data.data[0]);
    } catch (error) {
      console.error('Problem solving error:', error);
      return { success: false, error: error.message };
    }
  },
};