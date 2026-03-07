# ESP32 WebSocket Dashboard

A real-time dashboard for an ESP32-S3 QTPy sensor node, built with Node.js/Express/WebSocket backend and React/Vite frontend.

## Hardware

| Component | Description |
|-----------|-------------|
| **ESP32-S3 QTPy** | CircuitPython firmware, WiFi WebSocket client |
| **BME680** | Temperature, humidity, pressure, altitude, air quality (gas resistance) |
| **TSL2591** | Lux, visible light, infrared, full-spectrum |
| **HT16K33** | 14-segment alphanumeric display(s), chainable, 4 chars each |
| **ST25DV16** | NFC I²C EEPROM tag (NDEF read/write over WebSocket) |

---

## Architecture

```
 ESP32-S3 (CircuitPython)          Node.js Server :8080          Browser (React)
 ────────────────────────          ──────────────────────          ───────────────
  BME680 / TSL2591
  HT16K33 / ST25DV16
        │
        │  ws://server-ip:8080/ws
        ▼
  WebSocket client  ◄──────────────────────────────► WebSocket server ◄──► WebSocket client
  (firmware)              routes messages                               (React UI)
        │                 based on direction                                  │
        │                 and ws._isDevice flag                               │
        └──── sensor_data ──────────────────────────────────────────────────► broadcast to all
        └──── cmd responses ────────────────────────────────────────────────► forward to browsers
                                                                              │
                                              browser cmds ◄─────────────────┘
                                              (nfc/display/pin) ────────────► route to device only
```

### Device Identification

The server identifies the firmware connection by the first `type: "sensor_data"` message it receives, setting `ws._isDevice = true` on that socket. This flag governs all subsequent routing.

---

## Message Routing

### Browser → Server (commands)

| Command category | Routing |
|-----------------|---------|
| `nfc_*`, `display_list`, `digital_*`, `analog_*`, `pin_mode`, `status`, `restart` | **Device only** (`_isDevice === true`) |
| `display_message`, `display_sensor` | Raw command to device; `display_update` wrapper to all browsers |
| `set_temp_unit`, `set_distance_unit`, `set_air_quality_display` | Stored in server user preferences; broadcast to all clients |

### Device → Server (responses / sensor data)

| Message | Routing |
|---------|---------|
| `type: "sensor_data"` | Broadcast to **all** clients (with per-user unit conversions applied) |
| `cmd: "nfc_read"` / `cmd: "nfc_write"` / `cmd: "nfc_list"` (device response) | Forward to **browsers only** |
| `type: "ack"` | Forward to all clients except sender |

> **Note:** Firmware responses use `type` for the NDEF data type (`"url"`, `"text"`, `"raw"`), not `"ack"`. The client handles these by matching on `msg.cmd` rather than `msg.type`.

---

## WebSocket API Reference

### Connecting

```
ws://<server-ip>:8080/ws
```

In `NO_AUTH=true` mode (default for local dev), no token is required. In auth mode, append `?token=<jwt>`.

On connect the server sends:
```json
{
  "type": "connected",
  "message": "Successfully connected to server",
  "user": { "id": "anonymous", "role": "guest", "noAuth": true },
  "timestamp": 1234567890
}
```

---

### Sensor Data (ESP32 → Server → Browser)

The firmware sends this every ~5 seconds. The server broadcasts it to all connected clients, applying user-specific unit conversions.

```json
{
  "type": "sensor_data",
  "firmware_version": "2026.02.28-1",
  "timestamp": 946685501,
  "wifi": {
    "ssid": "MyNetwork",
    "ip": "10.0.0.42",
    "rssi": -58,
    "mac": "AA:BB:CC:DD:EE:FF",
    "channel": 6
  },
  "sensors": {
    "BME680": {
      "temp": 22.74,
      "temp_unit": "C",
      "humidity": 18.29,
      "pressure": 798.16,
      "altitude": 1967.9,
      "air_quality": 264736,
      "air_quality_raw": 264736,
      "air_quality_percent": 74,
      "air_quality_text": "Good",
      "gas_resistance": 264736
    },
    "TSL2591": {
      "lux": 16.48,
      "visible": 204,
      "full": 365,
      "ir": 161
    }
  }
}
```

**Unit conversions applied by server (per browser client preferences):**
- `BME680.temp` → converted to `C` or `F`
- `BME680.altitude` → converted to `m` or `ft`

---

### Settings Commands (Browser → Server)

These update server-side preferences and are broadcast to all browsers as `type: "settings_update"`.

```json
{ "cmd": "set_temp_unit", "value": "C" }
{ "cmd": "set_temp_unit", "value": "F" }

{ "cmd": "set_distance_unit", "value": "m" }
{ "cmd": "set_distance_unit", "value": "ft" }

{ "cmd": "set_air_quality_display", "value": "percent" }
{ "cmd": "set_air_quality_display", "value": "ohms" }
```

**Settings update broadcast to browsers:**
```json
{ "type": "settings_update", "cmd": "set_temp_unit", "value": "F" }
```

---

### Pin Control Commands (Browser → Device)

```json
{ "cmd": "digital_write", "pin": "SDA", "value": 1 }
{ "cmd": "digital_write", "pin": "SCL", "value": 0 }

{ "cmd": "analog_write", "pin": "A0", "value": 32768 }

{ "cmd": "digital_read", "pin": "MI" }
{ "cmd": "analog_read", "pin": "A1" }

{ "cmd": "pin_mode", "pin": "SCL", "mode": "output" }
```

Available pins: `SDA`, `SCL`, `SCK`, `MI`, `MO`, `A0`, `A1`, `A2`, `A3`

PWM range: `0` – `65535`

---

### Status / Restart (Browser → Device)

```json
{ "cmd": "status" }
{ "cmd": "restart" }
```

**Status ack from device:**
```json
{
  "type": "ack",
  "cmd": "status",
  "success": true,
  "pins": { "SDA": 0, "SCL": 0 },
  "wifi": { "ssid": "MyNetwork", "ip": "10.0.0.42", "rssi": -58 }
}
```

---

### HT16K33 Display Commands (Browser → Device)

The display chain is addressed in chained mode. Each physical display holds 4 characters; `chained_capacity = 4 × n` for n displays.

#### List displays

```json
{ "cmd": "display_list" }
```

**Device ack:**
```json
{
  "type": "ack",
  "cmd": "display_list",
  "count": 2,
  "display_mode": "chained",
  "chained_capacity": 8,
  "displays": [
    { "index": 0, "address": "0x70" },
    { "index": 1, "address": "0x71" }
  ]
}
```

#### Show a custom message

```json
{ "cmd": "display_message", "value": "Hi  ", "display": null }
```

- `display`: `null` = all (chained), or integer index `0`, `1`, … for a specific display
- `value` is truncated to `chained_capacity` chars (all displays) or `4` chars (single display)

#### Show a live sensor field

```json
{
  "cmd": "display_sensor",
  "field": "temp",
  "display": null,
  "showLabel": false,
  "showUnits": true
}
```

Available `field` values: `temp`, `humidity`, `pressure`, `altitude`, `air_quality`, `air_quality_percent`, `lux`, `visible`, `ir`

#### Set brightness

```json
{ "cmd": "display_set_brightness", "value": 0.5, "display": null }
```

`value`: `0.0` – `1.0`

#### Clear display

```json
{ "cmd": "clear_display", "display": null }
```

**Browser notification for display commands** (server broadcasts to all browsers):
```json
{
  "type": "display_update",
  "user": "anonymous",
  "cmd": "display_message",
  "value": "Hi  ",
  "display": null
}
```

---

### NFC / ST25DV16 Commands (Browser → Device)

The ST25DV16 is an I²C EEPROM NFC tag. Tags are identified by their I²C address (e.g. `"0x57"`).

#### List detected tags

```json
{ "cmd": "nfc_list" }
```

**Device response:**
```json
{
  "cmd": "nfc_list",
  "tags": ["0x57"],
  "timestamp": 946685501
}
```

#### Read a tag

```json
{ "cmd": "nfc_read", "tag": "0x57" }
```

**Device response** (`type` is the NDEF record type, not `"ack"`):
```json
{
  "cmd": "nfc_read",
  "tag": "0x57",
  "type": "url",
  "value": "https://seanphelan.dev",
  "url": "https://seanphelan.dev",
  "success": true,
  "timestamp": 946685501
}
```

Possible `type` values: `"url"`, `"text"`, `"raw"`, or absent/null if tag is empty.

#### Write to a tag

```json
{ "cmd": "nfc_write", "tag": "0x57", "type": "url", "value": "https://example.com" }
{ "cmd": "nfc_write", "tag": "0x57", "type": "text", "value": "Hello world" }
{ "cmd": "nfc_write", "tag": "0x57", "type": "raw", "value": "deadbeef" }
```

**Device response:**
```json
{
  "cmd": "nfc_write",
  "tag": "0x57",
  "type": "url",
  "value": "https://example.com",
  "success": true,
  "timestamp": 946685502
}
```

> **Important:** NFC device responses use `type` to indicate the NDEF record type (`"url"`, `"text"`, `"raw"`), **not** `"ack"`. The server and client both key on `msg.cmd` to handle them, not `msg.type`.

---

### Device Status Polling

The server polls device connection status every 5 seconds and broadcasts to all browsers:

```json
{ "type": "device_status", "connected": true }
```

A device is considered disconnected if no `sensor_data` has been received in the last **15 seconds**.

---

## Frontend Environment Variables

Create `client/.env.local`:

```env
VITE_WS_HOST=10.0.0.42     # Server IP (defaults to window.location.hostname)
VITE_WS_PORT=8080          # Server WS port (default 8080)
VITE_NO_AUTH=true          # Skip JWT auth UI
```

---

## Backend Environment Variables

Create `.env` in the project root:

```env
PORT=8080
NO_AUTH=true
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret_key
SERVER_IP=localhost

# OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
AUTHORIZED_USERS=user@example.com,otherguy
```

---

## Running

```bash
# Install server deps
npm install

# Install frontend deps
cd client && npm install

# Start backend (from root)
npm run dev

# Start frontend dev server (from client/)
cd client && npm run dev
```

---

## Tailwind CSS Setup (Vite)

```sh
npm install tailwindcss@latest vite-plugin-tailwindcss --save-dev
```

`src/index.css`:
```css
@import 'tailwindcss';
```

`vite.config.js`:
```js
import tailwindcss from 'vite-plugin-tailwindcss';
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```
