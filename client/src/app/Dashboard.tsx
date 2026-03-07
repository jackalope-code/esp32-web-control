'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [connected, setConnected] = useState(false);
  const [tempUnit, setTempUnit] = useState('C');
  const [distanceUnit, setDistanceUnit] = useState('m');
  const [aqDisplay, setAqDisplay] = useState('percent');
  const [messages, setMessages] = useState<Array<{time: string; text: string}>>([]);
  const [sensors, setSensors] = useState({ BME680: {}, TSL2591: {} });
  const [log, setLog] = useState<Array<{time: string; text: string}>>([]);
  const [wifi, setWifi] = useState(null);
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [displayInfo, setDisplayInfo] = useState({ count: 0, display_mode: 'chained', chained_capacity: 4, displays: [] });
  const [nfcInfo, setNfcInfo] = useState({ tags: [], lastRead: null });
  const [rgbColor, setRgbColor] = useState(null);
  const wsRef = useRef<WebSocket | null>(null);

  const WS_HOST = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const WS_PORT = '8080';

  const fetchWsToken = async () => {
    try {
      const res = await fetch('/api/ws-token', { credentials: 'include' });
      const data = await res.json();
      return data.token;
    } catch (error) {
      console.error('Failed to fetch WebSocket token:', error);
      return null;
    }
  };

  const sendCommand = (cmdObj: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(cmdObj));
      const now = new Date();
      const time = now.toLocaleTimeString();
      setLog((prev) => [
        { time, text: 'Sent: ' + JSON.stringify(cmdObj) },
        ...prev.slice(0, 99)
      ]);
    }
  };

  const connectWS = async (token: string) => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const WS_URL = `ws://${WS_HOST}:${WS_PORT}/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setLog((prev) => [
        { time: new Date().toLocaleTimeString(), text: 'WebSocket connected' },
        ...prev.slice(0, 99)
      ]);
      sendCommand({ cmd: 'status' });
      sendCommand({ cmd: 'display_list' });
      sendCommand({ cmd: 'nfc_list' });
      sendCommand({ cmd: 'rgb_led_get' });
    };

    ws.onclose = () => {
      setConnected(false);
      setLog((prev) => [
        { time: new Date().toLocaleTimeString(), text: 'WebSocket disconnected' },
        ...prev.slice(0, 99)
      ]);
      setTimeout(() => fetchWsToken().then(token => token && connectWS(token)), 5000);
    };

    ws.onerror = () => {
      setConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const now = new Date();
        const time = now.toLocaleTimeString();

        if (msg.type === 'sensor_data') {
          setSensors(msg.sensors);
          const bme = msg.sensors?.BME680 || {};
          const firmwareTempUnit = bme.temp?.unit;
          const firmwareDistUnit = bme.altitude?.unit;
          if (firmwareTempUnit && firmwareTempUnit !== tempUnit) setTempUnit(firmwareTempUnit);
          if (firmwareDistUnit && firmwareDistUnit !== distanceUnit) setDistanceUnit(firmwareDistUnit);
          if (msg.wifi) setWifi(msg.wifi);
          setDeviceConnected(true);
        }

        if (msg.type === 'connected') {
          if (msg.rgb) setRgbColor({ r: msg.rgb.r, g: msg.rgb.g, b: msg.rgb.b });
        }

        if (msg.type === 'ack') {
          if (msg.cmd === 'rgb_led' || msg.cmd === 'rgb_led_get') {
            if (msg.success && msg.r != null) setRgbColor({ r: msg.r, g: msg.g, b: msg.b });
          } else if (msg.cmd === 'display_list') {
            setDisplayInfo({ count: msg.count || 0, display_mode: msg.display_mode || 'chained', chained_capacity: msg.chained_capacity || 4, displays: msg.displays || [] });
          } else if (msg.cmd === 'nfc_list') {
            setNfcInfo(prev => ({ ...prev, tags: msg.tags || [] }));
          }
        }

        if (msg.type === 'error') {
          setLog((prev) => [
            { time, text: `Error: ${msg.message}` },
            ...prev.slice(0, 99)
          ]);
        }
      } catch {
        // Ignore parse errors
      }
    };
  };

  useEffect(() => {
    if (session?.user) {
      fetchWsToken().then(token => {
        if (token) connectWS(token);
      });
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [session]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!session) {
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
              onClick={() => signIn('google')}
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
              onClick={() => signIn('github')}
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="px-4 py-4 md:px-8 md:py-6 bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ESP32 Sensor Dashboard</h1>
          <div className="status-bar flex items-center gap-3">
            <div className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></div>
            <span className="text-gray-700 dark:text-gray-200">{connected ? 'Connected' : 'Disconnected'}</span>
            <span className="text-gray-600 dark:text-gray-300 text-sm">
              {session.user?.email || session.user?.name}
            </span>
            <button 
              onClick={() => signOut()} 
              className="ml-2 px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="w-full max-w-7xl mx-auto px-2 sm:px-4 py-4 md:py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex flex-col gap-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-4">Settings</h2>
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">Temperature: {tempUnit}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Distance: {distanceUnit}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">AQI Display: {aqDisplay}</p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-4">Controls</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Device: {deviceConnected ? 'Connected' : 'Disconnected'}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">RGB: {rgbColor ? `r=${rgbColor.r} g=${rgbColor.g} b=${rgbColor.b}` : 'Unknown'}</p>
            </div>
          </div>
          <div className="flex flex-col gap-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-4">Sensors</h2>
              <pre className="text-xs overflow-auto">
                {JSON.stringify(sensors, null, 2)}
              </pre>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-4">Log</h2>
              <div className="text-xs overflow-auto max-h-48 space-y-1">
                {log.map((entry, i) => (
                  <div key={i} className="font-mono">
                    <span className="text-gray-500">[{entry.time}]</span> {entry.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
