'use client';

import { useState, useEffect } from 'react';
import { useJarvisStore } from '@/lib/store';
import { jarvisAPI } from '@/lib/api';

const DEVICE_ICONS = {
  light_main: '💡',
  light_bedroom: '💡',
  fan_main: '🌀',
  ac_main: '❄️',
  thermostat: '🌡️',
  tv: '📺',
  door: '🚪',
};

export default function DevicePanel() {
  const { devices, sensorData, updateDevice, updateSensorData } = useJarvisStore();
  const [loading, setLoading] = useState({});

  // Poll device status
  useEffect(() => {
    const fetchStatus = async () => {
      const result = await jarvisAPI.getDeviceStatus();
      if (result.success) {
        Object.entries(result.devices || {}).forEach(([key, value]) => {
          updateDevice(key, value);
        });
        if (result.sensors) {
          updateSensorData(result.sensors);
        }
      }
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleDevice = async (deviceId) => {
    setLoading(prev => ({ ...prev, [deviceId]: true }));
    
    const action = devices[deviceId] ? 'off' : 'on';
    const result = await jarvisAPI.controlDevice(deviceId, action);
    
    if (result.success) {
      updateDevice(deviceId, !devices[deviceId]);
    }
    
    setLoading(prev => ({ ...prev, [deviceId]: false }));
  };

  const setThermostat = async (value) => {
    const result = await jarvisAPI.controlDevice('thermostat', 'set', value);
    if (result.success) {
      updateDevice('thermostat', value);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Sensor Cards */}
      <div className="glass p-6 rounded-2xl">
        <h3 className="text-jarvis-blue font-semibold mb-4 flex items-center gap-2">
          📡 Sensors
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/30 p-4 rounded-xl text-center">
            <div className="text-3xl text-jarvis-blue font-bold">
              {sensorData.temperature}°C
            </div>
            <div className="text-white/60 text-sm">Temperature</div>
          </div>
          <div className="bg-black/30 p-4 rounded-xl text-center">
            <div className="text-3xl text-jarvis-blue font-bold">
              {sensorData.humidity}%
            </div>
            <div className="text-white/60 text-sm">Humidity</div>
          </div>
          <div className="bg-black/30 p-4 rounded-xl text-center">
            <div className="text-3xl text-jarvis-blue font-bold">
              {sensorData.light_level}
            </div>
            <div className="text-white/60 text-sm">Light Level</div>
          </div>
          <div className="bg-black/30 p-4 rounded-xl text-center">
            <div className={`text-3xl font-bold ${sensorData.motion ? 'text-jarvis-green' : 'text-white/40'}`}>
              {sensorData.motion ? '🚶' : '—'}
            </div>
            <div className="text-white/60 text-sm">Motion</div>
          </div>
        </div>
      </div>

      {/* Device Cards */}
      {Object.entries(devices).filter(([key]) => key !== 'esp32_connected' && key !== 'thermostat').map(([deviceId, state]) => (
        <div 
          key={deviceId}
          className={`device-card ${state ? 'active' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{DEVICE_ICONS[deviceId] || '📟'}</span>
              <div>
                <div className="font-medium capitalize">
                  {deviceId.replace(/_/g, ' ')}
                </div>
                <div className="text-sm text-white/60">
                  {state ? 'On' : 'Off'}
                </div>
              </div>
            </div>
            
            <button
              onClick={() => toggleDevice(deviceId)}
              disabled={loading[deviceId]}
              className={`device-toggle ${state ? 'active' : ''} ${loading[deviceId] ? 'opacity-50' : ''}`}
            />
          </div>
        </div>
      ))}

      {/* Thermostat */}
      <div className="glass p-6 rounded-2xl">
        <h3 className="text-jarvis-blue font-semibold mb-4 flex items-center gap-2">
          🌡️ Thermostat
        </h3>
        <div className="text-center">
          <div className="text-5xl font-bold text-jarvis-orange mb-4">
            {devices.thermostat}°C
          </div>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setThermostat(devices.thermostat - 1)}
              className="btn-icon"
            >
              −
            </button>
            <input
              type="range"
              min="16"
              max="30"
              value={devices.thermostat}
              onChange={(e) => setThermostat(parseInt(e.target.value))}
              className="w-full"
            />
            <button
              onClick={() => setThermostat(devices.thermostat + 1)}
              className="btn-icon"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass p-6 rounded-2xl">
        <h3 className="text-jarvis-blue font-semibold mb-4">⚡ Quick Actions</h3>
        <div className="space-y-3">
          <button 
            onClick={() => {
              Object.keys(devices).forEach(d => {
                if (d.startsWith('light')) toggleDevice(d);
              });
            }}
            className="btn-secondary w-full"
          >
            Toggle All Lights
          </button>
          <button 
            onClick={() => {
              Object.keys(devices).forEach(d => updateDevice(d, false));
            }}
            className="btn-secondary w-full"
          >
            All Devices Off
          </button>
          <button className="btn-secondary w-full">
            Night Mode
          </button>
        </div>
      </div>

      {/* ESP32 Status */}
      <div className="glass p-6 rounded-2xl">
        <h3 className="text-jarvis-blue font-semibold mb-4">📡 ESP32-S3 Status</h3>
        <div className={`flex items-center gap-3 ${devices.esp32_connected ? 'text-jarvis-green' : 'text-jarvis-red'}`}>
          <div className={`w-3 h-3 rounded-full ${devices.esp32_connected ? 'bg-jarvis-green' : 'bg-jarvis-red'} animate-pulse`} />
          <span>{devices.esp32_connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <div className="mt-4 text-sm text-white/60">
          <p>Last sync: Just now</p>
          <p>IP: 192.168.1.100</p>
        </div>
      </div>
    </div>
  );
}