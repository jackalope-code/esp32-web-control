# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## WebSocket API Integration (Client)

The React client communicates with the backend and ESP32 device using a WebSocket API. This enables real-time updates for sensor data, settings, and pin control. Below is a detailed overview of how the client handles WebSocket communication:

### 1. WebSocket Connection
- The client establishes a WebSocket connection to the backend server on load.
- Connection status is tracked in state and shown in the UI (green dot for connected, red for disconnected).
- If the connection drops, the client automatically attempts to reconnect after a delay.
- On connection, the client sends a `{ cmd: 'status' }` message to request the latest data and settings.

### 2. Receiving Data
- The backend sends messages of various types, including:
  - `sensor_data`: Contains the latest sensor readings (temperature, humidity, pressure, air quality, altitude, light, etc.).
  - `settings_update`: Confirms a settings change (e.g., temperature unit, distance unit, air quality display).
  - `ack`: Acknowledges a command (e.g., pin change, status request).
  - `message`: General messages or notifications.
  - `error`: Error messages from the backend or device.
- The client updates its state and UI in response to these messages, ensuring the dashboard always reflects the latest device state.

### 3. Settings and Toggles
- The UI provides toggles for:
  - Temperature unit (Celsius/Fahrenheit)
  - Distance unit (Meters/Feet)
  - Air quality display (Percent/Ohms)
- When a toggle is changed, the client:
  1. Updates the UI optimistically.
  2. Sends a WebSocket command (e.g., `{ cmd: 'set_temp_unit', value: 'F' }`).
  3. Requests a status update to sync with the backend/device.
- The backend responds with a `settings_update` or updated `sensor_data` to confirm the change.

### 4. Pin and Output Control
- The UI allows control of digital and analog pins:
  - Digital Output: Select a pin and send ON/OFF commands.
  - Analog Output (PWM): Select a pin and set a value.
- When a control is used, the client sends a command such as:
  - `{ cmd: 'digital_write', pin: 'SDA', value: 1 }` (turn ON)
  - `{ cmd: 'analog_write', pin: 'A0', value: 32768 }` (set PWM)
- The backend/device processes the command and may respond with an `ack` or updated `sensor_data`.

### 5. Log and Message Handling
- All outgoing commands and incoming messages are logged in the UI for transparency and debugging.
- The log panel shows:
  - Outgoing commands (e.g., status requests, pin changes)
  - Incoming sensor data and settings updates
  - Connection events and errors

### 6. Error Handling
- If the WebSocket connection fails or an error message is received, the UI displays an error in the log and updates the connection status.
- The client will attempt to reconnect automatically if the connection is lost.

### 7. Data Flow Summary
```
[User Action] → [WebSocket Command Sent] → [Backend/Device] → [WebSocket Message Received] → [UI State Updated]
```

### 8. Extending the API
- To add new commands or data fields, update both the backend and the client message handlers.
- All WebSocket messages are JSON objects with a `type` or `cmd` field to distinguish their purpose.

### 9. Assigning Messages or Sensor Data to Displays (e.g., HT16K33)

The client supports sending either custom messages or live sensor data to external displays such as the HT16K33 alphanumeric or 7-segment display. This is handled via the WebSocket API as follows:

#### Sending a Custom Message to a Display
- The user can enter a custom message in the UI and select the target display (e.g., `ht16k33`).
- The client sends a command:
  - `{ cmd: 'display_message', display: 'ht16k33', value: 'Hello ESP32!' }`
- The backend/device receives this command and updates the display with the provided message.
- The log records the outgoing command and any backend acknowledgment or error.

#### Displaying Sensor Data on a Display
- The user can select a sensor (e.g., temperature, humidity) to be shown on the display.
- The client sends a command:
  - `{ cmd: 'display_sensor', display: 'ht16k33', sensor: 'temperature' }`
- The backend/device will update the display with the latest value of the selected sensor, refreshing as new data arrives.
- The log records the outgoing command and any backend acknowledgment or error.

#### Example Message Payloads
```
// Custom message
{
  "cmd": "display_message",
  "display": "ht16k33",
  "value": "System OK"
}

// Display sensor data
{
  "cmd": "display_sensor",
  "display": "ht16k33",
  "sensor": "humidity"
}
```

#### Backend/Device Response
- On success, the backend may reply with an `ack` or a `display_update` message.
- On error (e.g., invalid display or sensor), an `error` message is sent and shown in the log.

#### UI Integration
- The UI should provide controls to:
  - Enter a custom message and assign it to a display.
  - Select a sensor to be shown on a display.
  - View the status of the display assignment in the log/messages panel.

This mechanism allows flexible assignment of either static messages or live sensor data to any supported display device via the WebSocket API.

---

This architecture ensures the dashboard is always in sync with the device, provides real-time feedback, and allows for robust control and monitoring of the ESP32 system.
