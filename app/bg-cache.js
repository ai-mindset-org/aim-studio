const STORAGE_KEY = 'aim-studio-bg-cache-v1';
const MAX_ENTRIES = 50;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { keys: [], values: {} };
  } catch { return { keys: [], values: {} }; }
}

function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // Likely quota exceeded; evict half and retry once
    state.keys = state.keys.slice(state.keys.length / 2);
    const newValues = {};
    state.keys.forEach(k => { newValues[k] = state.values[k]; });
    state.values = newValues;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }
}

export function get(key) {
  const s = load();
  if (!(key in s.values)) return null;
  // bump LRU: move to end
  s.keys = s.keys.filter(k => k !== key);
  s.keys.push(key);
  save(s);
  return s.values[key];
}

export function set(key, value) {
  const s = load();
  if (key in s.values) {
    s.keys = s.keys.filter(k => k !== key);
  }
  s.keys.push(key);
  s.values[key] = value;
  // evict oldest while over capacity
  while (s.keys.length > MAX_ENTRIES) {
    const oldest = s.keys.shift();
    delete s.values[oldest];
  }
  save(s);
}

export function clear() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

export function size() {
  return load().keys.length;
}
