import React, { useState } from 'react';

const WRITE_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'url',  label: 'URL / URI' },
  { value: 'raw',  label: 'Raw' },
];

function TagBadge({ addr, selected, onClick }) {
  return (
    <button
      onClick={() => onClick(addr)}
      className={`text-xs px-2 py-0.5 rounded-full font-mono border transition-colors ${
        selected
          ? 'bg-blue-500 border-blue-400 text-white'
          : 'bg-blue-950/60 border-blue-700 text-blue-300 hover:bg-blue-800'
      }`}
    >
      {addr}
    </button>
  );
}

function NFC({ sendCommand, nfcInfo = { tags: [], lastRead: null } }) {
  const [selectedTag, setSelectedTag] = useState(null);
  const [writeType, setWriteType] = useState('text');
  const [writeValue, setWriteValue] = useState('');

  const hasTags = nfcInfo.tags && nfcInfo.tags.length > 0;
  const activeTag = selectedTag ?? nfcInfo.tags?.[0] ?? null;

  const handleRefresh = () => sendCommand({ cmd: 'nfc_list' });

  const handleRead = () => {
    if (!activeTag) return;
    sendCommand({ cmd: 'nfc_read', tag: activeTag });
  };

  const handleWrite = () => {
    if (!activeTag || !writeValue.trim()) return;
    sendCommand({ cmd: 'nfc_write', tag: activeTag, type: writeType, value: writeValue });
    setWriteValue('');
  };

  const lastRead = nfcInfo.lastRead;

  return (
    <section className="nfc">
      <div className="bg-blue-900/80 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="mb-0">ST25DV16 NFC</h3>
          <div className="flex items-center gap-2">
            {hasTags ? (
              <span className="text-xs text-blue-300">{nfcInfo.tags.length} tag{nfcInfo.tags.length !== 1 ? 's' : ''}</span>
            ) : (
              <span className="text-xs text-yellow-400">no tags detected</span>
            )}
            <button
              className="text-xs px-2 py-0.5 rounded bg-blue-700 hover:bg-blue-600"
              onClick={handleRefresh}
              title="Refresh tag list"
            >↺</button>
          </div>
        </div>

        {/* Tag selector */}
        {hasTags && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-sm text-blue-200">Tag:</span>
            {nfcInfo.tags.map(t => (
              <TagBadge key={t} addr={t} selected={activeTag === t} onClick={setSelectedTag} />
            ))}
          </div>
        )}

        {/* Last read result */}
        {lastRead && (
          <div className="mb-4 p-3 rounded-lg bg-blue-950/60 border border-blue-700">
            <div className="text-xs text-blue-400 mb-1">
              Last read · tag <span className="font-mono">{lastRead.tag}</span>
            </div>
            {lastRead.value != null ? (
              <div className="flex items-start gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                  lastRead.type === 'url' ? 'bg-green-800 text-green-200' :
                  lastRead.type === 'text' ? 'bg-blue-700 text-blue-100' :
                  'bg-gray-700 text-gray-200'
                }`}>{lastRead.type}</span>
                <span className="text-sm text-white break-all">{lastRead.value}</span>
              </div>
            ) : (
              <span className="text-sm text-blue-400 italic">empty / no NDEF record</span>
            )}
          </div>
        )}

        {/* Read */}
        <div className="mb-4">
          <button
            className="w-full py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-sm text-white disabled:opacity-40"
            onClick={handleRead}
            disabled={!activeTag}
          >
            Read Tag
          </button>
        </div>

        {/* Write */}
        <div className="border-t border-blue-700/50 pt-4">
          <div className="text-xs text-blue-300 mb-2">Write to tag</div>

          {/* Type selector */}
          <div className="flex gap-1 mb-3">
            {WRITE_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setWriteType(t.value)}
                className={`flex-1 text-xs py-1 rounded transition-colors ${
                  writeType === t.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-950/60 text-blue-300 hover:bg-blue-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Value input */}
          <div className="flex gap-2 items-start">
            {writeType === 'raw' ? (
              <textarea
                rows={2}
                placeholder="Raw data string..."
                value={writeValue}
                onChange={e => setWriteValue(e.target.value)}
                className="flex-1 rounded px-2 py-1 text-black text-sm font-mono resize-none"
              />
            ) : (
              <input
                type={writeType === 'url' ? 'url' : 'text'}
                placeholder={writeType === 'url' ? 'https://example.com' : 'Plain text...'}
                value={writeValue}
                onChange={e => setWriteValue(e.target.value)}
                className="flex-1 rounded px-2 py-1 text-black text-sm"
              />
            )}
            <button
              className="success shrink-0"
              onClick={handleWrite}
              disabled={!activeTag || !writeValue.trim()}
            >
              Write
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default NFC;
