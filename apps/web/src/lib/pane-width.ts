const STORAGE_KEY = "cycleforge-pane-width";
export const DEFAULT_PANE_WIDTH = 400;
const MIN = 280;
const MAX = 720;

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function clampPaneWidth(n: number): number {
  return Math.min(MAX, Math.max(MIN, n));
}

export function readPaneWidth(): number {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const n = Number(saved);
    if (Number.isFinite(n)) return clampPaneWidth(n);
  } catch {
    /* ignore */
  }
  return DEFAULT_PANE_WIDTH;
}

export function writePaneWidth(width: number): number {
  const next = clampPaneWidth(width);
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    /* ignore */
  }
  emit();
  return next;
}

export function subscribePaneWidth(onStoreChange: Listener): () => void {
  listeners.add(onStoreChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getServerPaneWidth(): number {
  return DEFAULT_PANE_WIDTH;
}
