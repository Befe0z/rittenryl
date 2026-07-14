import { useCallback, useEffect, useState } from 'react';
import { storage } from './lib/storage.js';

// Thin React binding over the storage seam. Every mutation persists immediately.
export function useJournal() {
  const [doc, setDoc] = useState(() => storage.load());

  useEffect(() => {
    storage.save(doc);
  }, [doc]);

  const upsertTicket = useCallback((ticket) => {
    setDoc((d) => {
      const exists = d.tickets.some((t) => t.id === ticket.id);
      return {
        ...d,
        tickets: exists
          ? d.tickets.map((t) => (t.id === ticket.id ? ticket : t))
          : [...d.tickets, ticket],
      };
    });
  }, []);

  const deleteTicket = useCallback((id) => {
    setDoc((d) => ({ ...d, tickets: d.tickets.filter((t) => t.id !== id) }));
  }, []);

  const upsertDaily = useCallback((daily) => {
    setDoc((d) => {
      const exists = d.dailies.some((x) => x.id === daily.id);
      return {
        ...d,
        dailies: exists
          ? d.dailies.map((x) => (x.id === daily.id ? daily : x))
          : [...d.dailies, daily],
      };
    });
  }, []);

  const deleteDaily = useCallback((id) => {
    setDoc((d) => ({ ...d, dailies: d.dailies.filter((x) => x.id !== id) }));
  }, []);

  const setPrinciples = useCallback((principles) => {
    setDoc((d) => ({ ...d, principles }));
  }, []);

  const replaceDoc = useCallback((next) => {
    const saved = storage.replace(next);
    setDoc(saved);
  }, []);

  return {
    doc,
    upsertTicket,
    deleteTicket,
    upsertDaily,
    deleteDaily,
    setPrinciples,
    replaceDoc,
  };
}
