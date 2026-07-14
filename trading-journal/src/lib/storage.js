// Persistence seam.
//
// The rest of the app talks ONLY to the `storage` object exported here, never
// to localStorage directly. To swap in a local SQLite service later, implement
// the same async-friendly interface (load/save) in a new adapter and export it
// from this module. The shape it persists is a single JSON document:
//
//   { version, tickets: [...], dailies: [...], principles: [...] }

import { seedData } from './seed.js';

const STORAGE_KEY = 'rittenryl.journal.v1';
export const DOC_VERSION = 1;

export function emptyDoc() {
  return { version: DOC_VERSION, tickets: [], dailies: [], principles: [] };
}

function normalize(doc) {
  const base = emptyDoc();
  if (!doc || typeof doc !== 'object') return base;
  return {
    version: doc.version || DOC_VERSION,
    tickets: Array.isArray(doc.tickets) ? doc.tickets : [],
    dailies: Array.isArray(doc.dailies) ? doc.dailies : [],
    principles: Array.isArray(doc.principles) ? doc.principles : [],
  };
}

// --- localStorage adapter ----------------------------------------------------

function hasLocalStorage() {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

// In-memory fallback so tests / SSR don't explode.
let memoryDoc = null;

export const storage = {
  // Load the full document. Seeds on first run so all charts render.
  load() {
    if (hasLocalStorage()) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw == null) {
        const seeded = seedData();
        this.save(seeded);
        return seeded;
      }
      try {
        return normalize(JSON.parse(raw));
      } catch {
        return emptyDoc();
      }
    }
    if (memoryDoc == null) memoryDoc = seedData();
    return memoryDoc;
  },

  save(doc) {
    const norm = normalize(doc);
    if (hasLocalStorage()) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(norm));
    } else {
      memoryDoc = norm;
    }
    return norm;
  },

  // Replace the entire document (used by import).
  replace(doc) {
    return this.save(normalize(doc));
  },

  reset() {
    if (hasLocalStorage()) window.localStorage.removeItem(STORAGE_KEY);
    memoryDoc = null;
  },
};

export { STORAGE_KEY };
