import React from 'react';

function Settings({ tempUnit, setTempUnit, distanceUnit, setDistanceUnit, aqDisplay, setAqDisplay }) {
  return (
    <section className="settings">
      <div className="bg-blue-900/80 rounded-xl shadow-lg p-6 mb-2">
        <h2>Settings</h2>
        <div className="settings-grid">
          <div className="setting-row">
            <span>Temperature Unit</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={tempUnit === 'F'}
                onChange={() => setTempUnit(tempUnit === 'F' ? 'C' : 'F')}
              />
              <span className="slider"></span>
            </label>
            <span>{tempUnit === 'F' ? 'Fahrenheit' : 'Celsius'}</span>
          </div>
          <div className="setting-row">
            <span>Distance Unit</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={distanceUnit === 'ft'}
                onChange={() => setDistanceUnit(distanceUnit === 'ft' ? 'm' : 'ft')}
              />
              <span className="slider"></span>
            </label>
            <span>{distanceUnit === 'ft' ? 'Feet' : 'Meters'}</span>
          </div>
          <div className="setting-row">
            <span>Air Quality</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={aqDisplay === 'percent'}
                onChange={() => setAqDisplay(aqDisplay === 'percent' ? 'ohms' : 'percent')}
              />
              <span className="slider"></span>
            </label>
            <span>{aqDisplay === 'percent' ? 'Percent' : 'Ohms'}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Settings;
