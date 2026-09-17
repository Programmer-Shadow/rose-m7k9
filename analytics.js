(() => {
  'use strict';
  let endpoint;
  try {
    if (!window.ROSE_ANALYTICS_ENDPOINT) return;
    endpoint = new URL(window.ROSE_ANALYTICS_ENDPOINT, window.location?.href);
    const local = endpoint.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(endpoint.hostname);
    if ((!local && endpoint.protocol !== 'https:') || endpoint.pathname !== '/events') return;
  } catch { return; } // No configured collector means no collection.

  const PREFIX = 'rose-event-v1:';
  const WEEK = 7 * 86400000;
  const targets = { roseCanvas: 'rose', bloomButton: 'bloom', musicButton: 'music', selectMusicButton: 'select_music' };
  const memory = new Map();
  let timer = null;
  let busy = false;
  let retryDelay = 3000;
  let nextAllowedAt = 0;
  let pointer = null;
  let dragged = false;
  let lastClickAt = -Infinity;

  function remove(id) {
    memory.delete(id);
    try { localStorage.removeItem(PREFIX + id); } catch { /* Memory fallback. */ }
  }

  function pending() {
    try {
      const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
      for (const key of keys) {
        if (!key?.startsWith(PREFIX)) continue;
        try {
          const e = JSON.parse(localStorage.getItem(key));
          if (e && key === PREFIX + e.id) memory.set(e.id, e);
          else localStorage.removeItem(key);
        } catch { localStorage.removeItem(key); }
      }
    } catch { /* Storage may be blocked by the browser. */ }
    const now = Date.now();
    for (const e of memory.values()) {
      const time = Date.parse(e.at);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(e.id) ||
          !Number.isFinite(time) || time < now - WEEK || time > now + 600000 ||
          !((e.type === 'view' && e.target === 'page') || (e.type === 'click' && Object.values(targets).includes(e.target)))) remove(e.id);
    }
    const events = [...memory.values()].sort((a, b) => a.at.localeCompare(b.at));
    while (events.length > 200) remove(events.shift().id);
    return events;
  }

  function schedule(reset = false) {
    if (reset && timer !== null) { clearTimeout(timer); timer = null; }
    const wait = nextAllowedAt > Date.now() ? nextAllowedAt - Date.now() : retryDelay;
    if (timer === null) timer = setTimeout(() => { timer = null; return flush(); }, wait);
  }

  async function flush() {
    if (busy) return;
    if (Date.now() < nextAllowedAt) { schedule(true); return; }
    if (timer !== null) { clearTimeout(timer); timer = null; }
    const events = pending().slice(0, 20);
    if (!events.length) return;
    busy = true;
    let serverDelay = 0;
    try {
      const response = await fetch(endpoint.href, {
        method: 'POST', mode: 'cors', credentials: 'omit', keepalive: true,
        signal: typeof AbortSignal !== 'undefined' ? AbortSignal.timeout?.(30000) : undefined,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ events })
      });
      if (!response.ok) {
        serverDelay = Math.max(0, Number(response.headers?.get('Retry-After')) || 0) * 1000;
        throw new Error('Collection unavailable');
      }
      for (const e of events) remove(e.id);
      retryDelay = 3000;
      nextAllowedAt = 0;
    } catch {
      retryDelay = Math.max(Math.min(60000, retryDelay * 2), Math.min(86400000, serverDelay));
      nextAllowedAt = Date.now() + retryDelay;
    } finally {
      busy = false;
      if (pending().length) schedule(true);
    }
  }

  function uuid() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function track(type, target) {
    try {
      // Share one two-second window across all click targets on this page.
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (type === 'click' && now - lastClickAt < 2000) return;
      const e = { id: uuid(), at: new Date().toISOString(), type, target };
      memory.set(e.id, e);
      if (type === 'click') lastClickAt = now;
      try { localStorage.setItem(PREFIX + e.id, JSON.stringify(e)); } catch { /* Memory fallback. */ }
      pending();
      schedule();
    } catch { /* Tracking must never break the gift page. */ }
  }

  document.addEventListener('pointerdown', e => { pointer = { x: e.clientX, y: e.clientY }; dragged = false; }, { passive: true });
  document.addEventListener('pointermove', e => {
    if (pointer && Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) > 8) dragged = true;
  }, { passive: true });
  document.addEventListener('pointerup', () => { pointer = null; }, { passive: true });
  document.addEventListener('click', e => {
    const element = e.target.closest?.('#roseCanvas, #bloomButton, #musicButton, #selectMusicButton');
    const target = targets[element?.id];
    if (target && !(target === 'rose' && dragged)) track('click', target);
    dragged = false;
  }, true);
  window.addEventListener('online', () => { void flush(); });
  window.addEventListener('pagehide', () => { void flush(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
  track('view', 'page');
})();
