import { useRef, useState } from 'react';
import {
  exportJSON,
  importJSON,
  exportMarkdown,
  importMarkdown,
} from '../lib/serialize.js';
import { storage } from '../lib/storage.js';
import { seedData } from '../lib/seed.js';

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DataMenu({ doc, replaceDoc }) {
  const jsonRef = useRef(null);
  const mdRef = useRef(null);
  const [status, setStatus] = useState('');

  const stamp = () => new Date().toISOString().slice(0, 10);

  const readFile = (file, cb) => {
    const r = new FileReader();
    r.onload = () => cb(String(r.result));
    r.readAsText(file);
  };

  const onImportJSON = (file) =>
    readFile(file, (text) => {
      try {
        replaceDoc(importJSON(text));
        setStatus('JSON imported — data replaced.');
      } catch (e) {
        setStatus('JSON import failed: ' + e.message);
      }
    });

  const onImportMD = (file) =>
    readFile(file, (text) => {
      try {
        replaceDoc(importMarkdown(text));
        setStatus('Markdown imported — data replaced.');
      } catch (e) {
        setStatus('Markdown import failed: ' + e.message);
      }
    });

  return (
    <div>
      <div className="view-head">
        <h1>Data — Export / Import</h1>
        <span className="sub">localStorage · JSON + Markdown round-trip</span>
      </div>

      <div className="panel">
        <h2>Export</h2>
        <p className="muted">
          JSON is the byte-exact backup path. Markdown is a clean, heading-per-field
          representation that also round-trips (export → re-import → identical data).
        </p>
        <div className="btn-row">
          <button
            className="btn primary"
            onClick={() => download(`journal-${stamp()}.json`, exportJSON(doc), 'application/json')}
          >
            ⭳ Export JSON
          </button>
          <button
            className="btn"
            onClick={() => download(`journal-${stamp()}.md`, exportMarkdown(doc), 'text/markdown')}
          >
            ⭳ Export Markdown
          </button>
        </div>
      </div>

      <div className="panel">
        <h2>Import (replaces current data)</h2>
        <div className="btn-row">
          <button className="btn" onClick={() => jsonRef.current.click()}>
            ⭱ Import JSON
          </button>
          <input
            ref={jsonRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files[0] && onImportJSON(e.target.files[0])}
          />
          <button className="btn" onClick={() => mdRef.current.click()}>
            ⭱ Import Markdown
          </button>
          <input
            ref={mdRef}
            type="file"
            accept=".md,.markdown,text/markdown"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files[0] && onImportMD(e.target.files[0])}
          />
        </div>
        {status && <div className="danger-banner" style={{ marginTop: 12, color: '#2dd4bf', borderColor: '#1a8a7d' }}>{status}</div>}
      </div>

      <div className="panel">
        <h2>Danger Zone</h2>
        <div className="btn-row">
          <button
            className="btn"
            onClick={() => {
              replaceDoc(seedData());
              setStatus('Re-seeded with sample data.');
            }}
          >
            Reset to sample data
          </button>
          <button
            className="btn danger"
            onClick={() => {
              storage.reset();
              replaceDoc({ version: 1, tickets: [], dailies: [], principles: [] });
              setStatus('All data cleared.');
            }}
          >
            Clear everything
          </button>
        </div>
      </div>
    </div>
  );
}
