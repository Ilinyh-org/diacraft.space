import { useState, useCallback } from 'react';

type History<T> = {
  past: T[];
  present: T;
  future: T[];
};

const MAX_HISTORY = 100;

export function useHistory<T>(initial: T) {
  const [history, setHistory] = useState<History<T>>({
    past: [],
    present: initial,
    future: [],
  });

  const commit = useCallback((updater: (prev: T) => T) => {
    setHistory((h) => {
      const next = updater(h.present);
      if (next === h.present) return h;
      const past = [...h.past, h.present];
      if (past.length > MAX_HISTORY) past.shift();
      return { past, present: next, future: [] };
    });
  }, []);

  /** Update present without pushing history — for live drag frames. */
  const commitLive = useCallback((updater: (prev: T) => T) => {
    setHistory((h) => {
      const next = updater(h.present);
      if (next === h.present) return h;
      return { ...h, present: next };
    });
  }, []);

  /**
   * Push a "before" snapshot onto past and mark the current present as the
   * timeline tip. Called once at the end of a live drag.
   */
  const commitCheckpoint = useCallback((before: T) => {
    setHistory((h) => {
      if (before === h.present) return h;
      const past = [...h.past, before];
      if (past.length > MAX_HISTORY) past.shift();
      return { past, present: h.present, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h;
      const prev = h.past[h.past.length - 1];
      return {
        past: h.past.slice(0, -1),
        present: prev,
        future: [h.present, ...h.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h;
      const next = h.future[0];
      return {
        past: [...h.past, h.present],
        present: next,
        future: h.future.slice(1),
      };
    });
  }, []);

  return {
    state: history.present,
    commit,
    commitLive,
    commitCheckpoint,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
