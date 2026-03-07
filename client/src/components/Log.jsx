import React from 'react';

function Log({ log }) {
  return (
    <section className="log">
      <div className="bg-blue-900/80 rounded-xl shadow-lg p-6 mb-2 log-card">
        <h2>Log</h2>
        <div className="log-list">
          {log.map((entry, i) => (
            <div key={i} className="log-entry">
              <span className="timestamp">[{entry.time}]</span> {entry.text}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Log;
