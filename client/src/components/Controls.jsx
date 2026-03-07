import React, { useState, useEffect } from 'react';

// Sensor fields supported by the firmware
// TODO: This should be dynamic based on firmware capabilities
const SENSOR_FIELDS = [
  { value: 'temp',        label: 'Temperature' },
  { value: 'humidity',    label: 'Humidity' },
  { value: 'pressure',    label: 'Pressure' },
  { value: 'altitude',    label: 'Altitude' },
  { value: 'air_quality', label: 'Air Quality' },
  { value: 'lux',         label: 'Lux' },
  { value: 'visible',     label: 'Visible' },
  { value: 'ir',          label: 'IR' },
  { value: 'full',        label: 'Full Spectrum' },
];

function DisplayTargetSelect({ displayInfo, value, onChange }) {
  const isChained = displayInfo.display_mode === 'chained';
  const count = displayInfo.count || 0;
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="rounded px-2 py-1 text-black text-sm">
      <option value="all">All Displays</option>
      {!isChained && count > 0 && Array.from({ length: count }, (_, i) => (
        <option key={i} value={String(i)}>
          Display {i}{displayInfo.displays?.[i]?.address ? ` (${displayInfo.displays[i].address})` : ''}
        </option>
      ))}
    </select>
  );
}

function DisplayStateTag({ info }) {
  if (!info) return null;
  const mode = info.mode || 'idle';
  const color = mode === 'idle' ? 'bg-gray-600' : mode === 'message' ? 'bg-blue-600' : 'bg-green-700';
  const label = mode === 'message' ? `msg: "${info.message}"` : mode === 'sensor' ? `sensor: ${info.sensor_field}` : 'idle';
  return <span className={`text-xs px-2 py-0.5 rounded-full text-white ${color}`}>{label}</span>;
}

function Controls({ sendCommand, displayInfo = { count: 0, display_mode: 'chained', chained_capacity: 4, displays: [] }, rgbColor = null, setRgbColor = null }) {
  const [dispTarget, setDispTarget] = useState('all');
  const [customMessage, setCustomMessage] = useState('');
  const [msgAlign, setMsgAlign] = useState('left');
  const [msgScroll, setMsgScroll] = useState(false);
  const [msgScrollDelay, setMsgScrollDelay] = useState(0.3);
  const [msgScrollLoop, setMsgScrollLoop] = useState(true);
  const [sensorField, setSensorField] = useState('');
  const [sensorAlign, setSensorAlign] = useState('left');
  const [showLabel, setShowLabel] = useState(false);
  const [showUnits, setShowUnits] = useState(false);
  const [brightness, setBrightness] = useState(1.0);
  const [rgbR, setRgbR] = useState(0);
  const [rgbG, setRgbG] = useState(255);
  const [rgbB, setRgbB] = useState(0);

  // Sync slider state whenever the parent receives confirmed device color
  useEffect(() => {
    if (rgbColor && rgbColor.r != null) {
      setRgbR(rgbColor.r);
      setRgbG(rgbColor.g);
      setRgbB(rgbColor.b);
    }
  }, [rgbColor]);

  const handleSendRgb = () => {
    sendCommand({ cmd: 'rgb_led', r: rgbR, g: rgbG, b: rgbB });
    if (setRgbColor) setRgbColor({ r: rgbR, g: rgbG, b: rgbB });
  };

  const handleRgbColorPicker = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    setRgbR(r);
    setRgbG(g);
    setRgbB(b);
  };

  const rgbHex = `#${rgbR.toString(16).padStart(2, '0')}${rgbG.toString(16).padStart(2, '0')}${rgbB.toString(16).padStart(2, '0')}`;

  const isChained = displayInfo.display_mode === 'chained';
  const hasDisplays = displayInfo.count > 0;
  // Chained + targeting all → full combined capacity; otherwise single display = 4 chars
  const maxChars = (isChained && dispTarget === 'all')
    ? (displayInfo.chained_capacity || displayInfo.count * 4 || 4)
    : 4;

  const resolveTarget = (t) => (t === 'all' ? null : parseInt(t, 10));

  const handleSendMessage = () => {
    const val = customMessage.slice(0, maxChars);
    if (!val.trim()) return;
    const cmd = { cmd: 'display_message', value: val, display: resolveTarget(dispTarget), align: msgAlign };
    if (msgScroll) {
      cmd.scroll = true;
      cmd.scroll_delay = msgScrollDelay;
      cmd.loop = msgScrollLoop;
    }
    sendCommand(cmd);
    setCustomMessage('');
  };

  // Clamp message when target or capacity changes
  const handleTargetChange = (t) => {
    setDispTarget(t);
    const newMax = (isChained && t === 'all') ? (displayInfo.chained_capacity || 4) : 4;
    setCustomMessage(prev => prev.slice(0, newMax));
  };

  const handleSendSensor = () => {
    if (!sensorField) return;
    sendCommand({ cmd: 'display_sensor', field: sensorField, display: resolveTarget(dispTarget), showLabel, showUnits, align: sensorAlign });
  };

  const handleClear = () => sendCommand({ cmd: 'clear_display', display: resolveTarget(dispTarget) });
  const handleBrightness = () => sendCommand({ cmd: 'display_set_brightness', value: brightness, display: resolveTarget(dispTarget) });
  const handleRefreshList = () => sendCommand({ cmd: 'display_list' });


  return (
    <section className="controls">
      <div>
        {/* ── Digital Output ── */}
        <div className="bg-blue-900/80 rounded-xl shadow-lg p-6 mb-2">
          <h3>Digital Output</h3>
          <div className="control-group">
            <select id="digitalPin">
              <option value="SDA">SDA</option>
              <option value="SCL">SCL</option>
              <option value="SCK">SCK</option>
              <option value="MI">MI</option>
              <option value="MO">MO</option>
            </select>
            <button className="success" onClick={() => sendCommand({ cmd: 'digital_write', pin: document.getElementById('digitalPin').value, value: 1 })}>ON</button>
            <button className="danger" onClick={() => sendCommand({ cmd: 'digital_write', pin: document.getElementById('digitalPin').value, value: 0 })}>OFF</button>
          </div>
        </div>

        {/* ── RGB LED ── */}
        <div className="bg-blue-900/80 rounded-xl shadow-lg p-6 mb-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="mb-0">RGB LED</h3>
            {rgbColor && (
              <span className="text-xs text-blue-300 flex items-center gap-1">
                <span
                  className="inline-block w-3 h-3 rounded-sm border border-blue-500"
                  style={{ backgroundColor: `rgb(${rgbColor.r},${rgbColor.g},${rgbColor.b})` }}
                />
                {`#${rgbColor.r.toString(16).padStart(2,'0')}${rgbColor.g.toString(16).padStart(2,'0')}${rgbColor.b.toString(16).padStart(2,'0')}`.toUpperCase()}
                {' (device)'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mb-3">
            {/* Color preview swatch */}
            <div
              className="w-10 h-10 rounded-lg border border-blue-600 flex-shrink-0"
              style={{ backgroundColor: rgbHex }}
            />
            {/* Native color picker — syncs sliders */}
            <input
              type="color"
              value={rgbHex}
              onChange={e => handleRgbColorPicker(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
              title="Pick a color"
            />
            <span className="font-mono text-xs text-blue-300">{rgbHex.toUpperCase()}</span>
          </div>
          <div className="flex flex-col gap-2 mb-3">
            {[
              { label: 'R', val: rgbR, set: setRgbR, color: 'accent-red-500' },
              { label: 'G', val: rgbG, set: setRgbG, color: 'accent-green-500' },
              { label: 'B', val: rgbB, set: setRgbB, color: 'accent-blue-400' },
            ].map(({ label, val, set, color }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-sm font-bold w-4 text-blue-200">{label}</span>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={val}
                  onChange={e => set(parseInt(e.target.value, 10))}
                  className={`flex-1 ${color}`}
                />
                <span className="font-mono text-xs text-blue-300 w-8 text-right">{val}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="success flex-1" onClick={handleSendRgb}>Set Color</button>
            <button
              className="text-xs px-3 py-1 rounded bg-blue-700 hover:bg-blue-600"
              onClick={() => sendCommand({ cmd: 'rgb_led_get' })}
              title="Fetch current color from device"
            >↺ Sync</button>
          </div>
        </div>

        {/* ── Analog Output (PWM) ── */}
        <div className="bg-blue-900/80 rounded-xl shadow-lg p-6 mb-2">
          <h3>Analog Output (PWM)</h3>
          <div className="control-group">
            <select id="analogPin">
              <option value="A0">A0</option>
              <option value="A1">A1</option>
              <option value="A2">A2</option>
              <option value="A3">A3</option>
            </select>
            <input type="range" id="pwmValue" min="0" max="65535" defaultValue="32768" />
            <button onClick={() => sendCommand({ cmd: 'analog_write', pin: document.getElementById('analogPin').value, value: parseInt(document.getElementById('pwmValue').value) })}>Set</button>
          </div>
        </div>

        {/* ── HT16K33 Display Control ── */}
        <div className="bg-blue-900/80 rounded-xl shadow-lg p-6 mb-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="mb-0">HT16K33 Display</h3>
            <div className="flex items-center gap-2">
              {hasDisplays ? (
                <span className="text-xs text-blue-300">
                  {displayInfo.count} display{displayInfo.count !== 1 ? 's' : ''} · {isChained ? 'chained' : 'independent'}
                </span>
              ) : (
                <span className="text-xs text-yellow-400">no display info</span>
              )}
              <button
                className="text-xs px-2 py-0.5 rounded bg-blue-700 hover:bg-blue-600"
                onClick={handleRefreshList}
                title="Refresh display list"
              >↺</button>
            </div>
          </div>

          {/* Per-display live state badges */}
          {hasDisplays && !isChained && (
            <div className="flex flex-wrap gap-2 mb-3">
              {displayInfo.displays.map((d) => (
                <div key={d.index} className="flex items-center gap-1 text-xs text-blue-200">
                  <span>D{d.index}:</span>
                  <DisplayStateTag info={d} />
                </div>
              ))}
            </div>
          )}
          {hasDisplays && isChained && displayInfo.displays[0] && (
            <div className="flex items-center gap-2 mb-3 text-xs text-blue-200">
              <span>All:</span>
              <DisplayStateTag info={displayInfo.displays[0]} />
            </div>
          )}

          {/* Target selector */}
          <div className="flex items-center gap-2 mb-3">
            <label className="text-sm text-blue-200 whitespace-nowrap">Target:</label>
            <DisplayTargetSelect displayInfo={displayInfo} value={dispTarget} onChange={handleTargetChange} />
          </div>

          {/* Custom message */}
          <div className="mb-3">
            <div className="text-xs text-blue-300 mb-1">
              Custom message{' '}
              <span className="text-blue-500">
                (max {maxChars} char{maxChars !== 1 ? 's' : ''}{isChained && maxChars > 4 ? `, ${maxChars / 4} display${maxChars / 4 !== 1 ? 's' : ''}` : ''})
              </span>
            </div>
            <div className="flex gap-2 items-center mb-2">
              <input
                type="text"
                placeholder={`up to ${maxChars} chars`}
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value.slice(0, maxChars))}
                maxLength={maxChars}
                className="rounded px-2 py-1 text-black text-sm font-mono"
                style={{ width: `${Math.max(6, maxChars) * 0.65 + 1.5}rem` }}
              />
              <span className={`text-xs ${customMessage.length >= maxChars ? 'text-yellow-400' : 'text-blue-400'}`}>
                {customMessage.length}/{maxChars}
              </span>
              <button className="success" onClick={handleSendMessage} disabled={!customMessage.trim()}>
                Send
              </button>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              {/* Alignment */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-blue-300">Align:</span>
                {['left', 'center', 'right'].map(a => (
                  <button
                    key={a}
                    onClick={() => setMsgAlign(a)}
                    className={`px-2 py-0.5 rounded text-xs ${
                      msgAlign === a ? 'bg-blue-500 text-white' : 'bg-blue-800 text-blue-200 hover:bg-blue-700'
                    }`}
                  >
                    {a.charAt(0).toUpperCase() + a.slice(1)}
                  </button>
                ))}
              </div>
              {/* Scroll toggle */}
              <label className="flex items-center gap-1 text-xs text-blue-200 cursor-pointer">
                <input type="checkbox" checked={msgScroll} onChange={e => setMsgScroll(e.target.checked)} />
                Scroll
              </label>
              {msgScroll && (
                <>
                  <label className="flex items-center gap-1 text-xs text-blue-200">
                    Speed:
                    <input
                      type="number"
                      min="0.05" max="2" step="0.05"
                      value={msgScrollDelay}
                      onChange={e => setMsgScrollDelay(parseFloat(e.target.value) || 0.3)}
                      className="w-14 rounded px-1 py-0.5 text-black text-xs"
                    />
                    <span className="text-blue-400">s/step</span>
                  </label>
                  <label className="flex items-center gap-1 text-xs text-blue-200 cursor-pointer">
                    <input type="checkbox" checked={msgScrollLoop} onChange={e => setMsgScrollLoop(e.target.checked)} />
                    Loop
                  </label>
                </>
              )}
            </div>
          </div>

          {/* Assign sensor */}
          <div className="mb-3">
            <div className="text-xs text-blue-300 mb-1">Show sensor value</div>
            <div className="flex gap-2 items-center flex-wrap">
              <select
                value={sensorField}
                onChange={e => setSensorField(e.target.value)}
                className="rounded px-2 py-1 text-black text-sm"
              >
                <option value="">-- field --</option>
                {SENSOR_FIELDS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-xs text-blue-200 cursor-pointer">
                <input type="checkbox" checked={showLabel} onChange={e => setShowLabel(e.target.checked)} />
                Label
              </label>
              <label className="flex items-center gap-1 text-xs text-blue-200 cursor-pointer">
                <input type="checkbox" checked={showUnits} onChange={e => setShowUnits(e.target.checked)} />
                Units
              </label>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-blue-300">Align:</span>
              {['left', 'center', 'right'].map(a => (
                <button
                  key={a}
                  onClick={() => setSensorAlign(a)}
                  className={`px-2 py-0.5 rounded text-xs ${
                    sensorAlign === a ? 'bg-blue-500 text-white' : 'bg-blue-800 text-blue-200 hover:bg-blue-700'
                  }`}
                >
                  {a.charAt(0).toUpperCase() + a.slice(1)}
                </button>
              ))}
              <button className="success" onClick={handleSendSensor} disabled={!sensorField}>
                Show
              </button>
            </div>
          </div>

          {/* Brightness */}
          <div className="mb-3">
            <div className="text-xs text-blue-300 mb-1">
              Brightness: <span className="font-mono text-white">{Math.round(brightness * 100)}%</span>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="range"
                min="1"
                max="100"
                value={Math.round(brightness * 100)}
                onChange={e => setBrightness(parseInt(e.target.value, 10) / 100)}
                className="flex-1"
              />
              <button onClick={handleBrightness} className="text-sm px-3 py-1 rounded bg-blue-600 hover:bg-blue-500">
                Set
              </button>
            </div>
          </div>

          {/* Clear */}
          <button className="danger w-full" onClick={handleClear}>Clear Display</button>
        </div>

        {/* ── System ── */}
        <div className="bg-blue-900/80 rounded-xl shadow-lg p-6 mb-2">
          <h3>System</h3>
          <div className="control-group">
            <button onClick={() => sendCommand({ cmd: 'status' })}>Get Status</button>
            <button className="danger" onClick={() => sendCommand({ cmd: 'restart' })}>Restart</button>
          </div>
        </div>

      </div>
    </section>
  );
}

export default Controls;
