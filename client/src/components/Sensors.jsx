import React from 'react';

function Sensors({ sensors, tempUnit, aqDisplay, distanceUnit }) {
  const bme = sensors.BME680 || {};
  const tsl = sensors.TSL2591 || {};
  const gps = sensors.GPS || {};
  // air_quality is now {value, unit, text}; fall back gracefully for legacy flat values
  const aq = bme.air_quality;
  const aqVal  = aq?.value  ?? (typeof aq === 'number' ? aq : null);
  const aqUnit = aq?.unit   ?? '%';
  const aqText = aq?.text   ?? bme.air_quality_text ?? '';
  const airQualityRaw = bme.air_quality_raw;
  const airQualityPercent = bme.air_quality_percent;

  // temp, pressure, altitude are now {value, unit} objects; fall back gracefully if flat
  const tempVal   = bme.temp?.value   ?? (typeof bme.temp   === 'number' ? bme.temp   : null);
  const tempUnitDisplay = bme.temp?.unit ?? bme.temp_unit ?? tempUnit;
  const pressVal  = bme.pressure?.value  ?? (typeof bme.pressure  === 'number' ? bme.pressure  : null);
  const pressUnit = bme.pressure?.unit   ?? 'hPa';
  const altVal    = bme.altitude?.value  ?? (typeof bme.altitude  === 'number' ? bme.altitude  : null);
  const altUnit   = bme.altitude?.unit   ?? (distanceUnit === 'ft' ? 'ft' : 'm');

  return (
    <section className="sensors">
      <div className="bg-blue-900/80 rounded-xl shadow-lg p-6 mb-2 sensor-card">
        <h2>BME680 Sensors</h2>
        <div className="sensor-grid">
          <div className="sensor-row">
            <span>Temperature</span>
            <span className="value">{tempVal ?? '--'} °{tempUnitDisplay}</span>
          </div>
          <div className="sensor-row">
            <span>Humidity</span>
            <span className="value">{bme.humidity ?? '--'} %</span>
          </div>
          <div className="sensor-row">
            <span>Pressure</span>
            <span className="value">{pressVal ?? '--'} {pressUnit}</span>
          </div>
          <div className="sensor-row">
            <span>Air Quality</span>
            <span className="value">
              {aqDisplay === 'ohms'
                ? (airQualityRaw != null
                  ? `${airQualityRaw.toLocaleString()} Ω${aqText ? ` (${aqText})` : ''}`
                  : (aqText && aqText !== 'Unknown' ? aqText : <span className="text-yellow-400 text-xs">warming up…</span>))
                : (aqVal != null
                  ? `${aqVal}${aqUnit}${aqText ? ` (${aqText})` : ''}`
                  : (aqText && aqText !== 'Unknown' ? aqText : <span className="text-yellow-400 text-xs">warming up…</span>))}
            </span>
          </div>
          <div className="sensor-row">
            <span>Altitude</span>
            <span className="value">{altVal ?? '--'} {altUnit}</span>
          </div>
        </div>
      </div>
      <div className="bg-blue-900/80 rounded-xl shadow-lg p-6 mb-2 sensor-card">
        <h2>TSL2591 Light Sensor</h2>
        <div className="sensor-grid">
          <div className="sensor-row">
            <span>Lux</span>
            <span className="value">{tsl.lux ?? '--'}</span>
          </div>
          <div className="sensor-row">
            <span>Visible</span>
            <span className="value">{tsl.visible ?? '--'}</span>
          </div>
          <div className="sensor-row">
            <span>IR</span>
            <span className="value">{tsl.ir ?? '--'}</span>
          </div>
          <div className="sensor-row">
            <span>Full Spectrum</span>
            <span className="value">{tsl.full ?? '--'}</span>
          </div>
        </div>
      </div>
      <div className="bg-blue-900/80 rounded-xl shadow-lg p-6 mb-2 sensor-card">
        <h2>GPS</h2>
        <div className="sensor-grid">
          <div className="sensor-row">
            <span>Fix</span>
            <span className="value">
              {gps.fix
                ? <span className="text-green-400">Yes (Q{gps.fix_quality})</span>
                : <span className="text-red-400">No Fix</span>}
            </span>
          </div>
          <div className="sensor-row">
            <span>Satellites</span>
            <span className="value">{gps.satellites ?? '--'}</span>
          </div>
          <div className="sensor-row">
            <span>Latitude</span>
            <span className="value">
              {gps.latitude?.value != null ? `${gps.latitude.value}°` : '--'}
            </span>
          </div>
          <div className="sensor-row">
            <span>Longitude</span>
            <span className="value">
              {gps.longitude?.value != null ? `${gps.longitude.value}°` : '--'}
            </span>
          </div>
          <div className="sensor-row">
            <span>Altitude</span>
            <span className="value">
              {gps.altitude?.value != null ? `${gps.altitude.value} ${gps.altitude.unit}` : '--'}
            </span>
          </div>
          <div className="sensor-row">
            <span>Speed</span>
            <span className="value">
              {gps.speed?.value != null ? `${gps.speed.value} ${gps.speed.unit}` : '--'}
            </span>
          </div>
          <div className="sensor-row">
            <span>Course</span>
            <span className="value">
              {gps.course?.value != null ? `${gps.course.value}°` : '--'}
            </span>
          </div>
          <div className="sensor-row">
            <span>Time (UTC)</span>
            <span className="value">{gps.timestamp_utc ?? '--'}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Sensors;
