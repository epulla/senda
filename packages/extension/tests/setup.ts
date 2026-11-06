import { fakeBrowser } from 'wxt/testing/fake-browser';

// fake-browser has no tabs.onReplaced; give it a small in-memory event with trigger() like the others.
type Listener = (added: number, removed: number) => unknown;
const listeners = new Set<Listener>();
Object.assign(fakeBrowser.tabs.onReplaced, {
  addListener: (fn: Listener) => void listeners.add(fn),
  removeListener: (fn: Listener) => void listeners.delete(fn),
  hasListener: (fn: Listener) => listeners.has(fn),
  trigger: async (added: number, removed: number) => {
    for (const fn of [...listeners]) await fn(added, removed);
  },
});
