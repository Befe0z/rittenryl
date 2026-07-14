import { describe, it, expect } from 'vitest';
import {
  exportJSON,
  importJSON,
  exportMarkdown,
  importMarkdown,
} from '../lib/serialize.js';
import { seedData } from '../lib/seed.js';

describe('JSON export → import round-trip', () => {
  it('produces identical data', () => {
    const doc = seedData();
    const restored = importJSON(exportJSON(doc));
    expect(restored).toEqual(doc);
  });
});

describe('Markdown export → import round-trip', () => {
  it('produces identical data for the full seed document', () => {
    const doc = seedData();
    const md = exportMarkdown(doc);
    const restored = importMarkdown(md);
    expect(restored).toEqual(doc);
  });

  it('round-trips a document with multi-line textarea fields intact', () => {
    const doc = seedData();
    // Inject internal newlines into a couple of block fields.
    doc.tickets[0].preMortem = 'Line one.\nLine two.\nLine three.';
    doc.dailies[0].reflection = 'First paragraph.\n\nSecond paragraph after a blank line.';
    const restored = importMarkdown(exportMarkdown(doc));
    expect(restored.tickets[0].preMortem).toBe('Line one.\nLine two.\nLine three.');
    expect(restored.dailies[0].reflection).toBe(
      'First paragraph.\n\nSecond paragraph after a blank line.'
    );
    expect(restored).toEqual(doc);
  });

  it('preserves the boolean confluence checkboxes', () => {
    const doc = seedData();
    const restored = importMarkdown(exportMarkdown(doc));
    expect(restored.tickets[0].confluence.fundamental.checked).toBe(true);
    expect(restored.tickets[1].confluence.tape.checked).toBe(false);
    expect(restored.tickets[0].gradeCommitted).toBe(true);
  });
});
