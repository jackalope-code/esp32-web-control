

import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import Settings from './components/Settings';
import Messages from './components/Messages';
import Sensors from './components/Sensors';
import Controls from './components/Controls';
import Log from './components/Log';
import NFC from './components/NFC';

const VITE_NO_AUTH = import.meta.env.VITE_NO_AUTH === 'true';
const API_BASE = import.meta.env.VITE_API_BASE || '';

function App() {
  const [connected, setConnected] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('auth_token'));
  const [tempUnit, _setTempUnit] = useState('C');
  const [distanceUnit, _setDistanceUnit] = useState('m');
  const [aqDisplay, _setAqDisplay] = useState('percent');
  const [messages, setMessages] = useState([]);
  const [sensors, setSensors] = useState({ BME680: {}, TSL2591: {} });
  const [log, setLog] = useState([]);
  const [wifi, setWifi] = useState(null);
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [displayInfo, setDisplayInfo] = useState({ count: 0, display_mode: 'chained', chained_capacity: 4, displays: [] });
  const [nfcInfo, setNfcInfo] = useState({ tags: [], lastRead: null });
  const [rgbColor, setRgbColor] = useState(null);
  const wsRef = useRef(null);

  // Check for token in URL on mount (OAuth callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      localStorage.setItem('auth_token', urlToken);
      setToken(urlToken);
      window.history.replaceState({}, document.title, window.location.pathname);
      setLog((prev) => [
        { time: new Date().toLocaleTimeString(), text: 'Authentication successful' },
        ...prev.slice(0, 99)
      ]);
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    setLog((prev) => [
      { time: new Date().toLocaleTimeString(), text: 'Logged out' },
      ...prev.slice(0, 99)
    ]);
  };

  const sendCommand = (cmdObj) => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify(cmdObj));
      if (cmdObj && cmdObj.cmd === 'status') {
        const now = new Date();
        const time = now.toLocaleTimeString();
        setLog((prev) => [
          { time, text: 'Sent: got data ' + JSON.stringify(cmdObj)},
          ...prev.slice(0, 99)
        ]);
      }
    }
  };

  const setTempUnit = (unit) => {
    _setTempUnit(unit);
    sendCommand({ cmd: 'set_temp_unit', value: unit });
    sendCommand({ cmd: 'status' });
  };

  const setDistanceUnit = (unit) => {
    _setDistanceUnit(unit);
    sendCommand({ cmd: 'set_distance_unit', value: unit });
    sendCommand({ cmd: 'status' });
  };

  const setAqDisplay = (display) => {
    _setAqDisplay(display);
    sendCommand({ cmd: 'set_air_quality_display', value: display });
    sendCommand({ cmd: 'status' });
  };

  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout = null;
    let ws;
    // Use same-origin WS so Vite's proxy handles it in dev; in production the
    // Express server serves the built client on the same port as the WS server.
    const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const WS_BASE = `${WS_PROTOCOL}//${window.location.host}`;
    // Include token in WebSocket URL if available
    const WS_URL = token
      ? `${WS_BASE}/ws?token=${encodeURIComponent(token)}`
      : `${WS_BASE}/ws`;
    let connecting = false;

    function connectWS() {
      if (connecting) return;
      connecting = true;
      if (wsRef.current && (wsRef.current.readyState === 0 || wsRef.current.readyState === 1)) {
        connecting = false;
        return;
      }
      try {
        ws = new window.WebSocket(WS_URL);
        wsRef.current = ws;
      } catch {
        connecting = false;
        setConnected(false);
        setLog((prev) => [
          { time: new Date().toLocaleTimeString(), text: `WebSocket error` },
          ...prev.slice(0, 99)
        ]);
        return;
      }

      ws.onopen = () => {
        connecting = false;
        if (isMounted) setConnected(true);
        setLog((prev) => [
          { time: new Date().toLocaleTimeString(), text: 'WebSocket connected' },
          ...prev.slice(0, 99)
        ]);
        try {
          ws.send(JSON.stringify({ cmd: 'status' }));
          ws.send(JSON.stringify({ cmd: 'display_list' }));
          ws.send(JSON.stringify({ cmd: 'nfc_list' }));
          ws.send(JSON.stringify({ cmd: 'rgb_led_get' }));
        } catch {
          setLog((prev) => [
            { time: new Date().toLocaleTimeString(), text: `WebSocket error` },
            ...prev.slice(0, 99)
          ]);
        }
      };

      ws.onclose = (event) => {
        connecting = false;
        if (isMounted) setConnected(false);
        setLog((prev) => [
          { time: new Date().toLocaleTimeString(), text: 'WebSocket disconnected' },
          ...prev.slice(0, 99)
        ]);
        if (event.code !== 1000) {
          reconnectTimeout = setTimeout(connectWS, 5000);
        }
      };

      ws.onerror = () => {
        connecting = false;
        if (isMounted) setConnected(false);
        setLog((prev) => [
          { time: new Date().toLocaleTimeString(), text: 'WebSocket error' },
          ...prev.slice(0, 99)
        ]);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const now = new Date();
          const time = now.toLocaleTimeString();
          if (msg.type === 'settings_update' && isMounted) {
            if (msg.cmd === 'set_temp_unit' && msg.value) _setTempUnit(msg.value);
            if (msg.cmd === 'set_distance_unit' && msg.value) _setDistanceUnit(msg.value);
            if (msg.cmd === 'set_air_quality_display' && msg.value) _setAqDisplay(msg.value);
          }
          if (msg.type === 'sensor_data' && isMounted) {
            setSensors(msg.sensors);
            const bme = msg.sensors?.BME680 || {};
            const firmwareTempUnit = bme.temp?.unit || (typeof bme.temp_unit === 'string' ? bme.temp_unit : null);
            const firmwareDistUnit = bme.altitude?.unit || null;
            if (firmwareTempUnit && firmwareTempUnit !== tempUnit) _setTempUnit(firmwareTempUnit);
            if (firmwareDistUnit && firmwareDistUnit !== distanceUnit) _setDistanceUnit(firmwareDistUnit);
            if (bme.aq_display && bme.aq_display !== aqDisplay) _setAqDisplay(bme.aq_display);
            if (msg.wifi) setWifi(msg.wifi);
            setDeviceConnected(true);
            setLog((prev) => [
              { time, text: `Sensor data: ${JSON.stringify(msg.sensors)}` },
              ...prev.slice(0, 99)
            ]);
          }
          if (msg.type === 'device_status' && isMounted) {
            setDeviceConnected(!!msg.connected);
          }
          if (msg.type === 'display_update' && isMounted) {
            setLog((prev) => [
              { time, text: `Display update: ${msg.cmd === 'display_message' ? `message → "${msg.value}"` : msg.cmd === 'display_sensor' ? `sensor → ${msg.sensor}` : JSON.stringify(msg)} on ${msg.display || 'display'}` },
              ...prev.slice(0, 99)
            ]);
          }
          if (msg.type === 'connected' && isMounted) {
            if (msg.user) setUser(msg.user);
            if (msg.rgb && msg.rgb.r != null) setRgbColor({ r: msg.rgb.r, g: msg.rgb.g, b: msg.rgb.b });
            setLog((prev) => [
              { time, text: `Connected: ${msg.message || 'Successfully connected'}` },
              ...prev.slice(0, 99)
            ]);
          }
          if (msg.type === 'message' && isMounted) {
            setMessages((prev) => [...prev, msg]);
            setLog((prev) => [
              { time, text: `Message: ${msg.message}` },
              ...prev.slice(0, 99)
            ]);
          }
          if (msg.type === 'ack' && isMounted) {
            if (msg.cmd === 'status') {
              if (msg.rgb && msg.rgb.r != null) setRgbColor({ r: msg.rgb.r, g: msg.rgb.g, b: msg.rgb.b });
              setLog((prev) => [
                { time, text: `Response: status → ${msg.success ? 'success' : 'fail'}${msg.pins ? ", pins: " + JSON.stringify(msg.pins) : ''}${msg.wifi ? ", wifi: " + JSON.stringify(msg.wifi) : ''}` },
                ...prev.slice(0, 99)
              ]);
            } else if (msg.cmd === 'rgb_led' || msg.cmd === 'rgb_led_get') {
              if (msg.success && msg.r != null) setRgbColor({ r: msg.r, g: msg.g, b: msg.b });
              setLog((prev) => [
                { time, text: `RGB LED: r=${msg.r} g=${msg.g} b=${msg.b} (${msg.success ? 'ok' : 'fail'})` },
                ...prev.slice(0, 99)
              ]);
            } else if (msg.cmd === 'display_list') {
              setDisplayInfo({ count: msg.count || 0, display_mode: msg.display_mode || 'chained', chained_capacity: msg.chained_capacity || 4, displays: msg.displays || [] });
              setLog((prev) => [
                { time, text: `Display list: ${msg.count} display(s), mode=${msg.display_mode}, capacity=${msg.chained_capacity || 4} chars` },
                ...prev.slice(0, 99)
              ]);
            } else if (msg.cmd === 'nfc_list') {
              setNfcInfo(prev => ({ ...prev, tags: msg.tags || [] }));
              setLog((prev) => [
                { time, text: `NFC tags: ${(msg.tags || []).join(', ') || 'none'}` },
                ...prev.slice(0, 99)
              ]);
            } else if (msg.cmd === 'nfc_read') {
              setNfcInfo(prev => ({ ...prev, lastRead: { tag: msg.tag, type: msg.type, value: msg.value } }));
              setLog((prev) => [
                { time, text: `NFC read tag ${msg.tag}: ${msg.type ? `${msg.type} → "${msg.value}"` : 'empty'}` },
                ...prev.slice(0, 99)
              ]);
            } else if (msg.cmd === 'nfc_write') {
              setLog((prev) => [
                { time, text: `NFC write ${msg.success ? 'OK' : 'FAILED'}: ${msg.type} → "${msg.value}" on tag ${msg.tag}` },
                ...prev.slice(0, 99)
              ]);
            } else {
              setLog((prev) => [
                { time, text: `Ack: ${JSON.stringify(msg)}` },
                ...prev.slice(0, 99)
              ]);
            }
          }
          if (msg.type === 'error' && isMounted) {
            setLog((prev) => [
              { time, text: `Error: ${msg.message}` },
              ...prev.slice(0, 99)
            ]);
          }
          if (msg.cmd === 'nfc_read' && msg.type !== 'ack' && isMounted) {
            setNfcInfo(prev => ({ ...prev, lastRead: { tag: msg.tag, type: msg.type, value: msg.value } }));
            setLog((prev) => [
              { time, text: `NFC read tag ${msg.tag}: ${msg.type ? `${msg.type} → "${msg.value}"` : 'empty'}` },
              ...prev.slice(0, 99)
            ]);
          }
          if (msg.cmd === 'nfc_list' && msg.type !== 'ack' && isMounted) {
            setNfcInfo(prev => ({ ...prev, tags: msg.tags || [] }));
            setLog((prev) => [
              { time, text: `NFC tags: ${(msg.tags || []).join(', ') || 'none'}` },
              ...prev.slice(0, 99)
            ]);
          }
          if (msg.cmd === 'nfc_write' && msg.type !== 'ack' && isMounted) {
            setLog((prev) => [
              { time, text: `NFC write ${msg.success ? 'OK' : 'FAILED'}: ${msg.type} → "${msg.value}" on tag ${msg.tag}` },
              ...prev.slice(0, 99)
            ]);
          }
        } catch {
          const now = new Date();
          const time = now.toLocaleTimeString();
          setLog((prev) => [
            { time, text: `Raw: ${event.data}` },
            ...prev.slice(0, 99)
          ]);
        }
      };
    }

    connectWS();
    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [token, tempUnit, distanceUnit, aqDisplay]);

  const handleOAuthLogin = (provider) => {
    window.location.href = `/${provider}`;
  };

  // Show login screen if NO_AUTH is false and no token
  if (!VITE_NO_AUTH && !token) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            ESP32 Sensor Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6 text-center">
            Please sign in to access the dashboard
          </p>
          <div className="space-y-3">
            <button
              onClick={() => handleOAuthLogin('auth/google')}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </button>
            <button
              onClick={() => handleOAuthLogin('auth/github')}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg shadow-sm hover:bg-gray-800 text-white font-medium"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
              Sign in with GitHub
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <header className="px-4 py-4 md:px-8 md:py-6 bg-white dark:bg-gray-800 shadow">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ESP32 Sensor Dashboard</h1>
            <div className="status-bar flex items-center gap-3">
              <div className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></div>
              <span className="text-gray-700 dark:text-gray-200">{connected ? 'Connected' : 'Disconnected'}</span>
              {VITE_NO_AUTH && <span className="no-auth-badge bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">No Auth Mode</span>}
              {user && !VITE_NO_AUTH && <span className="user-info text-gray-600 dark:text-gray-300 text-sm">{user.email || user.id}</span>}
              {!VITE_NO_AUTH && <button className="logout-btn ml-2 px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600" onClick={logout}>Logout</button>}
            </div>
          </div>
        </header>
        <main className="w-full max-w-7xl mx-auto px-2 sm:px-4 py-4 md:py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col gap-8">
              <Settings
                tempUnit={tempUnit}
                setTempUnit={setTempUnit}
                distanceUnit={distanceUnit}
                setDistanceUnit={setDistanceUnit}
                aqDisplay={aqDisplay}
                setAqDisplay={setAqDisplay}
              />
              <Messages messages={messages} wifi={wifi} deviceConnected={deviceConnected} />
              <Controls sendCommand={sendCommand} displayInfo={displayInfo} rgbColor={rgbColor} setRgbColor={setRgbColor} />
              <NFC sendCommand={sendCommand} nfcInfo={nfcInfo} />
            </div>
            <div className="flex flex-col gap-8">
              <Sensors sensors={sensors} tempUnit={tempUnit} aqDisplay={aqDisplay} distanceUnit={distanceUnit} />
              <Log log={log} />
            </div>
          </div>
        </main>
      </div>
    );
  }

  export default App;
