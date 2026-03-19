require('dotenv').config();
const express = require('express');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const path = require('path');
const passport = require('passport');
const session = require('express-session');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { Strategy: GitHubStrategy } = require('passport-github2');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const JWT_ALGORITHM = 'HS256';
const SESSION_SECRET = process.env.SESSION_SECRET || 'your_session_secret_key';
const SERVER_IP = process.env.SERVER_IP || 'localhost';
const NO_AUTH = process.env.NO_AUTH === 'true';

// Allowed devices (comma-separated device IDs)
const ALLOWED_DEVICES = (process.env.ALLOWED_DEVICES || '').split(',').map(d => d.trim()).filter(d => d);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_ID_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const AUTHORIZED_USERS = (process.env.AUTHORIZED_USERS || '').split(',').map(u => u.trim()).filter(u => u);

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, 
    maxAge: 24 * 60 * 60 * 1000 
  }
}));

app.use(passport.initialize());
app.use(passport.session());

const users = new Map();

function isAuthorized(user) {
  if (AUTHORIZED_USERS.length === 0) return true;
  const identifier = user.email || user.username;
  return AUTHORIZED_USERS.some(auth => auth.toLowerCase() === identifier?.toLowerCase());
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = users.get(id);
  done(null, user);
});

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: `http://${SERVER_IP}:${PORT}/auth/google/callback`
  }, (accessToken, refreshToken, profile, done) => {
    const user = {
      id: uuidv4(),
      provider: 'google',
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
      picture: profile.photos?.[0]?.value,
      role: isAuthorized({ email: profile.emails?.[0]?.value }) ? 'user' : 'unauthorized'
    };
    users.set(user.id, user);
    return done(null, user);
  }));
}

if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    callbackURL: `http://${SERVER_IP}:${PORT}/auth/github/callback`
  }, (accessToken, refreshToken, profile, done) => {
    const user = {
      id: uuidv4(),
      provider: 'github',
      username: profile.username,
      name: profile.displayName || profile.username,
      picture: profile.photos?.[0]?.value,
      role: isAuthorized({ username: profile.username }) ? 'user' : 'unauthorized'
    };
    users.set(user.id, user);
    return done(null, user);
  }));
}

function generateUserToken(user) {
  return jwt.sign(
    { 
      user_id: user.id, 
      email: user.email,
      username: user.username,
      role: user.role,
      provider: user.provider 
    },
    JWT_SECRET,
    { algorithm: JWT_ALGORITHM, expiresIn: '24h' }
  );
}

const DIST_PATH = path.join(__dirname, 'client', 'dist');
//app.use(express.static(DIST_PATH));

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/?auth=error' }),
  (req, res) => {
    const token = generateUserToken(req.user);
    res.redirect(`/?auth=success&token=${token}`);
  }
);

app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));
app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/?auth=error' }),
  (req, res) => {
    const token = generateUserToken(req.user);
    res.redirect(`/?auth=success&token=${token}`);
  }
);

app.post('/auth/token', (req, res) => {
  if (!req.user || req.user.role === 'unauthorized') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = generateUserToken(req.user);
  res.json({ token, user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role } });
});

app.get('/auth/user', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ 
    user: { 
      id: req.user.id, 
      name: req.user.name, 
      email: req.user.email, 
      username: req.user.username,
      picture: req.user.picture,
      role: req.user.role,
      provider: req.user.provider
    } 
  });
});

app.post('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    req.session.destroy();
    res.json({ success: true });
  });
});

app.get('/auth/status', (req, res) => {
  res.json({ 
    authenticated: !!req.user,
    user: req.user ? {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    } : null
  });
});

const wss = new WebSocket.Server({ server });

app.use((req, res, next) => {
  console.log(`HTTP ${req.method} ${req.url}`);
  next();
});

app.get('*', (req, res) => {
  const indexPath = path.join(DIST_PATH, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Client not built — run: npm run build');
  }
});

function authenticateWS(req, isDevice = false) {
  if (NO_AUTH && !isDevice) {
    return { authenticated: true, payload: { user_id: 'anonymous', role: 'guest', noAuth: true } };
  }
  
  const url = new URL(req.url || '', `ws://${SERVER_IP}:${PORT}`);
  const token = url.searchParams.get('token');
  
  if (!token) {
    return { authenticated: false, error: 'No token provided' };
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    
    // Check if this is a device connection
    if (decoded.device_id) {
      // Device authentication - check against allowed devices list
      if (ALLOWED_DEVICES.length > 0 && !ALLOWED_DEVICES.includes(decoded.device_id)) {
        return { authenticated: false, error: 'Device not authorized' };
      }
      return { authenticated: true, payload: decoded, isDevice: true };
    }
    
    // User authentication - check against authorized users list
    if (decoded.role === 'unauthorized') {
      return { authenticated: false, error: 'User not authorized' };
    }
    
    if (AUTHORIZED_USERS.length > 0) {
      const identifier = decoded.email || decoded.username;
      if (!AUTHORIZED_USERS.some(auth => auth.toLowerCase() === identifier?.toLowerCase())) {
        return { authenticated: false, error: 'User not in allowed list' };
      }
    }
    
    return { authenticated: true, payload: decoded, isDevice: false };
  } catch (err) {
    return { authenticated: false, error: err.message };
  }
}

wss.on('connection', (ws, req) => {
  console.log('WebSocket connection received!');
  console.log('Headers:', req.headers);
  console.log('URL:', req.url);
  
  const authResult = authenticateWS(req);
  
  if (!authResult.authenticated) {
    console.log(`WebSocket auth failed: ${authResult.error}`);
    ws.send(JSON.stringify({
      type: 'error',
      message: `Authentication failed: ${authResult.error}`
    }));
    ws.close(4001, 'Unauthorized');
    return;
  }
  
  ws._userInfo = authResult.payload;
  ws._isDevice = authResult.isDevice;
  ws._remoteAddress = req.socket.remoteAddress;
  
  if (authResult.isDevice) {
    console.log(`Device connected: ${authResult.payload.device_id} (${req.socket.remoteAddress})`);
  } else if (NO_AUTH) {
    console.log(`Client connected (no auth): ${req.socket.remoteAddress}`);
  } else {
    console.log(`User connected: ${authResult.payload.email || authResult.payload.username}`);
  }
  
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Successfully connected to server',
    user: {
      id: authResult.payload.user_id || authResult.payload.device_id,
      email: authResult.payload.email,
      role: authResult.payload.role,
      device_id: authResult.payload.device_id,
      noAuth: NO_AUTH && !authResult.isDevice
    },
    rgb: lastRgbColor,
    timestamp: Date.now()
  }));
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(ws, message);
    } catch (err) {
      console.error('Failed to parse message:', err);
    }
  });
  
  ws.on('close', () => {
    console.log(`User disconnected: ${ws._userInfo?.email || 'unknown'}`);
  });
  
  ws.on('error', (err) => {
    console.error('WebSocket error:', err)
  });
});


// Track user preferences (e.g., temperature unit) by userId
let userPreferences = new Map();
let connectedDevices = new Map();
// Track last sensor data timestamp for device connection status
let lastDeviceData = { timestamp: 0 };
const DEVICE_TIMEOUT_MS = 15000; // 15 seconds without data = disconnected
// Cache last known RGB LED color from firmware acks so new browser clients can sync
let lastRgbColor = null; // { r, g, b } or null if never reported
// Deduplication: track last time each poll command was forwarded to the device.
// Multiple browser tabs each send these on connect; only forward once per 500 ms.
const POLL_CMDS = new Set(['status', 'display_list', 'nfc_list', 'rgb_led_get']);
const lastForwarded = new Map(); // cmd -> timestamp (ms)
const FORWARD_DEBOUNCE_MS = 500;

function handleMessage(ws, message) {
  console.log('Received:', message);
  const userId = ws._userInfo?.user_id || 'unknown';
  // Tag firmware device immediately on identify (before first sensor_data)
  if (message.type === 'identify') {
    ws._isDevice = true;
    console.log(`[WS] Device identified: firmware_version=${message.firmware_version} (${ws._remoteAddress})`);
    return;
  }
  if (message.type === 'sensor_data') {
    ws._isDevice = true; // tag this connection as the firmware device
    lastDeviceData.timestamp = Date.now();
    console.log(`Sensor data from user ${userId}:`, JSON.stringify(message.sensors, null, 2));
    if (message.wifi) {
      console.log(`[WiFi Info] from user ${userId}:`, JSON.stringify(message.wifi, null, 2));
    }
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        let sensorsOut = JSON.parse(JSON.stringify(message.sensors)); // deep copy
        // Ensure BME680 fields are always present
        if (!sensorsOut.BME680) sensorsOut.BME680 = {};
        if (sensorsOut.BME680.air_quality_text === undefined) sensorsOut.BME680.air_quality_text = '';
        // Ensure air_quality is always a {value, unit, text} object
        if (sensorsOut.BME680.air_quality === undefined || sensorsOut.BME680.air_quality === null) {
          sensorsOut.BME680.air_quality = { value: null, unit: '%', text: sensorsOut.BME680.air_quality_text || '' };
        } else if (typeof sensorsOut.BME680.air_quality === 'number') {
          sensorsOut.BME680.air_quality = { value: sensorsOut.BME680.air_quality, unit: '%', text: sensorsOut.BME680.air_quality_text || '' };
        }
        // Accept gas or gas_resistance from device, but always send as gas_resistance
        if (sensorsOut.BME680.gas_resistance === undefined) {
          if (sensorsOut.BME680.gas !== undefined) {
            sensorsOut.BME680.gas_resistance = sensorsOut.BME680.gas;
          } else {
            sensorsOut.BME680.gas_resistance = null;
          }
        }
        // temp, pressure, altitude are now {value, unit} objects from firmware.
        // Firmware handles all unit conversions — pass through as-is.
        // Ensure the nested shape is present even if firmware sends a legacy flat number (graceful fallback).
        if (typeof sensorsOut.BME680.temp === 'number') {
          sensorsOut.BME680.temp = { value: sensorsOut.BME680.temp, unit: sensorsOut.BME680.temp_unit || 'F' };
          delete sensorsOut.BME680.temp_unit;
        }
        if (typeof sensorsOut.BME680.altitude === 'number') {
          sensorsOut.BME680.altitude = { value: sensorsOut.BME680.altitude, unit: sensorsOut.BME680.altitude_unit || 'ft' };
          delete sensorsOut.BME680.altitude_unit;
        }
        if (typeof sensorsOut.BME680.pressure === 'number') {
          sensorsOut.BME680.pressure = { value: sensorsOut.BME680.pressure, unit: 'hPa' };
        }
        // Ensure GPS fields are always present with proper shape
        if (!sensorsOut.GPS) {
          sensorsOut.GPS = {
            fix: false, fix_quality: 0, satellites: null,
            latitude: { value: null, unit: '°' },
            longitude: { value: null, unit: '°' },
            altitude: { value: null, unit: 'ft' },
            speed: { value: null, unit: 'mph' },
            course: { value: null, unit: '°' },
            timestamp_utc: null
          };
        }
        client.send(JSON.stringify({ ...message, sensors: sensorsOut }));
      }
    });
    return;
  }
  if (message.type === 'ack') {
    console.log(`Ack from user ${userId}:`, message);
    // Cache RGB color whenever the firmware confirms a successful rgb_led set or get
    if ((message.cmd === 'rgb_led' || message.cmd === 'rgb_led_get') && message.success) {
      lastRgbColor = { r: message.r, g: message.g, b: message.b };
    }
    // Cache RGB color reported inside a status ack
    if (message.cmd === 'status' && message.rgb) {
      lastRgbColor = { r: message.rgb.r, g: message.rgb.g, b: message.rgb.b };
    }
    const data = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client !== ws) {
        client.send(data);
      }
    });
  }
  else if (message.cmd) {
    // Handle settings and display commands
    if ([
      'set_temp_unit',
      'set_air_quality_display',
      'set_distance_unit',
      'set_display_message',
      'display_message',
      'display_sensor'
    ].includes(message.cmd)) {
      // Store user preferences for temperature unit
      if (message.cmd === 'set_temp_unit' && message.value) {
        userPreferences.set(userId, {
          ...(userPreferences.get(userId) || {}),
          tempUnit: message.value
        });
      }
      if (message.cmd === 'set_distance_unit' && message.value) {
        userPreferences.set(userId, {
          ...(userPreferences.get(userId) || {}),
          distanceUnit: message.value
        });
      }
      if (message.cmd === 'set_air_quality_display' && message.value) {
        userPreferences.set(userId, {
          ...(userPreferences.get(userId) || {}),
          aqDisplay: message.value
        });
      }
      console.log(`Settings/Display command from ${userId}: ${JSON.stringify(message)}`);
      // Broadcast: raw command to device, wrapped display_update to browsers
      wss.clients.forEach((client) => {
        if (client.readyState !== WebSocket.OPEN) return;
        if (client._isDevice) {
          console.log(`[Broadcast] Sending command to DEVICE: ${JSON.stringify(message)}`);
          client.send(JSON.stringify(message));
        } else {
          client.send(JSON.stringify({
            type: 'display_update',
            user: userId,
            ...message
          }));
        }
      });


    } else {
      console.log(`Command from ${userId}: ${JSON.stringify(message)}`);
      const data = JSON.stringify(message);
      // NFC and device-only commands: send only to the firmware device
      // Note: rgb_led / rgb_led_get are intentionally NOT here — they use the
      // broadcast path below so they reach the firmware regardless of _isDevice timing.
      const deviceOnlyCmds = ['nfc_write', 'nfc_read', 'nfc_list', 'display_list',
        'digital_write', 'digital_read', 'analog_write', 'analog_read', 'pin_mode',
        'eeprom_write', 'eeprom_read', 'st25dv_write', 'st25dv_read', 'restart', 'status'];
      if (deviceOnlyCmds.includes(message.cmd)) {
        if (ws._isDevice) {
          // Response FROM device — forward to browser clients as an ack
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN && !client._isDevice) {
              client.send(data);
            }
          });
        } else {
          // Command FROM browser — route to device only.
          // Deduplicate poll/init commands so simultaneous sends from multiple
          // browser tabs don't flood the firmware.
          if (POLL_CMDS.has(message.cmd)) {
            const now = Date.now();
            const last = lastForwarded.get(message.cmd) || 0;
            if (now - last < FORWARD_DEBOUNCE_MS) {
              return; // duplicate within debounce window — drop
            }
            lastForwarded.set(message.cmd, now);
          }
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN && client._isDevice) {
              client.send(data);
            }
          });
          // Optimistically cache RGB so new browser clients see the last-set color
          if (message.cmd === 'rgb_led' && message.r != null) {
            lastRgbColor = { r: message.r, g: message.g, b: message.b };
            const deviceClients = [...wss.clients].filter(c => c._isDevice && c.readyState === WebSocket.OPEN);
            console.log(`[RGB LED] Routing rgb_led r=${message.r} g=${message.g} b=${message.b} → ${deviceClients.length} device client(s)`);
          }
          if (message.cmd === 'rgb_led_get') {
            const deviceClients = [...wss.clients].filter(c => c._isDevice && c.readyState === WebSocket.OPEN);
            console.log(`[RGB LED] Routing rgb_led_get → ${deviceClients.length} device client(s)`);
          }        }
      } else {
        // Broadcast to all other clients (includes firmware — works regardless of _isDevice)
        if (message.cmd === 'rgb_led' && message.r != null) {
          lastRgbColor = { r: message.r, g: message.g, b: message.b };
          const devs = [...wss.clients].filter(c => c._isDevice && c.readyState === WebSocket.OPEN).length;
          console.log(`[RGB LED] Broadcasting rgb_led r=${message.r} g=${message.g} b=${message.b} (${devs} tagged device(s) in pool)`);
        }
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN && client !== ws) {
            client.send(data);
          }
        });
      }
    }
  }
}

function broadcastToAll(message) {
  const data = JSON.stringify(message);
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

function sendToUser(userId, message) {
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN && (ws._userInfo?.user_id === userId || ws._userInfo?.device_id === userId)) {
      ws.send(JSON.stringify(message));
    }
  });
}

function sendCommand(userId, command) {
  sendToUser(userId, command);
}

console.log(`Server running on port ${PORT}`);
console.log(`JWT Secret: ${JWT_SECRET.substring(0, 8)}...${JWT_SECRET.substring(JWT_SECRET.length - 4)}`);
console.log(`NO_AUTH mode: ${NO_AUTH}`);
console.log(`Allowed devices: ${ALLOWED_DEVICES.length > 0 ? ALLOWED_DEVICES.join(', ') : 'Any device with valid JWT'}`);
console.log(`Authorized users: ${AUTHORIZED_USERS.length > 0 ? AUTHORIZED_USERS.join(', ') : 'All users'}`);
console.log(`Serving static files from: ${DIST_PATH}`);

console.log(`
Available commands:
  - sendCommand(userId, {cmd: 'digital_write', pin: 'SDA', value: 1})
  - sendCommand(userId, {cmd: 'status'})
  - broadcastToAll({cmd: 'restart'})
`);

server.listen(PORT, () => {
  console.log(`HTTP server and WebSocket running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});

module.exports = { sendCommand, broadcastToAll };
