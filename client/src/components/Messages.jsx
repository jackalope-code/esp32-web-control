import React from 'react';

function WifiRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-blue-300 text-sm">{label}</span>
      <span className="font-mono text-white text-sm">{value ?? '--'}</span>
    </div>
  );
}

function Messages({ messages, wifi, deviceConnected }) {
  return (
    <section className="messages flex flex-col gap-4">
      {/* Device & WiFi Info Card */}
      <div className="bg-blue-900/80 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Device Status</h2>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${deviceConnected ? 'bg-green-700 text-green-100' : 'bg-red-700 text-red-100'}`}>
            {deviceConnected ? 'Online' : 'Offline'}
          </span>
        </div>
        {wifi ? (
          <div className="divide-y divide-blue-800">
            <WifiRow label="SSID" value={wifi.ssid} />
            <WifiRow label="IP Address" value={wifi.ip} />
            <WifiRow label="RSSI" value={wifi.rssi != null ? `${wifi.rssi} dBm` : null} />
            <WifiRow label="MAC" value={wifi.mac} />
            {wifi.channel != null && <WifiRow label="Channel" value={wifi.channel} />}
          </div>
        ) : (
          <p className="text-blue-400 text-sm">No WiFi data received yet.</p>
        )}
      </div>

      {/* Messages feed */}
      {messages.length > 0 && (
        <div className="bg-blue-900/80 rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold mb-2">Messages</h2>
          <div className="messages-list">
            {messages.map((msg, i) => (
              <div key={i} className="message">
                <span className="timestamp">[{msg.time}]</span> {msg.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default Messages;
