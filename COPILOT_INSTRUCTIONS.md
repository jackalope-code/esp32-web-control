# Tailwind CSS Setup and Usage

- Use Tailwind CSS v4 with the vite-plugin-tailwindcss for Vite projects.
- Do not set up or modify any Tailwind config files unless absolutely necessary.
- Install with:
	```sh
	npm install tailwindcss@latest vite-plugin-tailwindcss --save-dev
	```
- Import Tailwind globally in `client/src/index.css` using `@import 'tailwindcss';`.
- Add the plugin to your `vite.config.js`:
	```js
	import tailwindcss from 'vite-plugin-tailwindcss';
	// ...
	export default defineConfig({
		plugins: [react(), tailwindcss()],
	});
	```
- Use Tailwind utility classes directly in React components and JSX.
- Do not use or reference custom Tailwind configuration, plugins, or advanced features unless explicitly required.
- All layout and style changes should use Tailwind utility classes inline or in component files.
# Project Progress Summary (as of 2026-02-28)

## Key Features Implemented
- Live sensor data via WebSocket (Node.js backend, React frontend)
- Robust WebSocket reconnect and connection status indicator
- Unit toggling for temperature (C/F), distance (m/ft), and air quality (percent/ohms) with backend conversion and optimistic UI
- Air quality display supports both percent and raw (ohms) modes, always shows air quality text
- Log panel records all relevant events: outgoing commands, incoming responses, sensor data, errors, and connection events
- UI and backend ensure all expected sensor fields are present and consistent

## Recent Fixes
- Fixed log: now records both outgoing status commands and incoming responses
- Fixed connection flicker: only one WebSocket connection is created per mount/unmount
- Improved frontend rendering for air quality, matching new backend payload structure

## Outstanding/Next Steps
- Ensure device/firmware always sends all required sensor fields
- Further UI/UX polish as needed

# Copilot Instructions

## Project Architecture

This repository contains the server and front-end code for an ESP32 IoT project. The ESP32 device's firmware codebase is located at the project root on the D:/ drive. Treat D:/ as the source for all firmware-related code, while this repository (esp32webcontrol) contains the web server and client application for interacting with the ESP32 device.

- **This folder:** Node.js/Express server and Vite/React front-end for ESP32 IoT control and monitoring.
- **D:/ :** ESP32 firmware codebase (not included here).

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                    NETWORK                                  │
│                                                                             │
│   ┌──────────────┐                        ┌────────────────────────────┐   │
│   │   ESP32-S3   │                        │      Your Computer         │   │
│   │   Device     │◄────── WiFi ──────────►│                            │   │
│   │              │   (ws://10.0.0.x)      │   ┌──────────────────┐   │   │
│   │ - Sensors    │                        │   │  Node.js Server  │   │   │
│   │ - Actuators  │                        │   │                  │   │   │
│   │ - WebSocket  │◄──────────────────────►│   │  ┌────────────┐ │   │   │
│   │   Client     │    Port 8080           │   │  │  Express   │ │   │   │
│   └──────────────┘                        │   │  │   HTTP    │ │   │   │
│                                            │   │  └────────────┘ │   │   │
│                                            │   │                  │   │   │
│                                            │   │  ┌────────────┐ │   │   │
│                                            │   │  │    WS     │ │   │   │
│                                            │   │  │  Server   │ │   │   │
│                                            │   │  └────────────┘ │   │   │
│                                            │   └──────────────────┘   │   │
│                                            │                            │   │
│                                            │   ┌──────────────────┐   │   │
│                                            │   │   React Client   │   │   │
│                                            │   │  (Browser/UI)   │
│                                            │   │  - Dashboard    │   │   │
│                                            │   │  - Controls     │   │   │
│                                            │   │  - Log Display  │   │   │
│                                            │   └──────────────────┘   │   │
│                                            └────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

- **ESP32-S3** runs firmware (see D:/) and connects to the server via WebSocket, sending sensor data and receiving commands.
- **Node.js/Express/WS server** (this repo) relays messages between ESP32 and browser clients, handles authentication, and serves the React UI.
- **React/Vite client** (this repo) connects to the server (HTTP for UI, WebSocket for real-time data/commands), displays sensor data, and allows user control.

#### Typical Flows

- **Sensor Data:** ESP32 → Server → Browser (via WebSocket broadcast)
- **Commands:** Browser → Server → ESP32 (via WebSocket)

#### Key Endpoints

- `/api/status` and `/api/sensors` (optional REST endpoints for polling)
- `/ws` (WebSocket endpoint for real-time communication)

#### Authentication

- Supports Google and GitHub OAuth (if enabled in .env)
- Can run in NO_AUTH mode for open access

#### File Structure

- `server.js`: Main server, WebSocket, and API logic
- `client/`: Vite/React front-end
- `public/`, `client/public/`: Static assets

---

When working on this project, keep the separation between the web control interface (this repo) and the device firmware (D:/) in mind. See README.md for diagrams and more details.

---

## Pin Mapping — Safety Rule

**Never change pin names, pin assignments, or pin-to-peripheral mappings without first confirming with the user.**

Pin wiring is determined by the physical PCB traces, not by convention or assumption. Wrong pin assignments cause silent hardware failures — the firmware runs without errors but the wrong physical pins are toggled.

Known physical wiring (as of 2026-03-18, confirmed working):

| Purpose | Firmware symbol | Physical pad | Notes |
|---------|----------------|--------------|-------|
| RGB LED Red | `board.MOSI` | MO | Common-anode LED, PWM |
| RGB LED Green | `board.MISO` | MI | Common-anode LED, PWM |
| RGB LED Blue | `board.SCK` | SCK | Common-anode LED, PWM |
| Analog/PWM | `board.A0`–`board.A3` | A0–A3 | Free for general use |
| Digital | `board.SDA`, `board.SCL` | SDA, SCL | Free for general use |

SCK/MI/MO must **not** be reassigned to any other purpose. They are blocked in `pin_controller.py` (`setup_pin` guard) and absent from `DIGITAL_PINS` in `config.py`.