/**
 * IndexedDB wrapper for persistent save storage.
 *
 * Why IDB over localStorage: mobile WKWebView / embedded WebView caps
 * `localStorage` at ~5 MB per origin. A full save with community-pack
 * players, fixtures, and free agents regularly lands north of that, so
 * localStorage `setItem` starts throwing `QuotaExceededError`. IDB has
 * effectively unbounded quota on mobile (governed by device free space)
 * and survives the same WebView reclamation lifecycle.
 *
 * This module is a thin promise-based key/value API that degrades
 * gracefully: when `indexedDB` is unavailable (jsdom tests, private
 * Safari on some iOS versions, disabled storage), every operation
 * resolves to a safe no-op value. Callers layer a synchronous in-memory
 * cache on top — IDB is for durability across sessions, the memory
 * cache is what serves reads during a single session.
 */

const DB_NAME = 'dynasty-manager';
const DB_VERSION = 1;
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined') {
    dbPromise = Promise.resolve(null);
    return dbPromise;
  }
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => {
        const db = req.result;
        // Gracefully handle forced closure (e.g. another tab upgraded).
        // Reset the cached promise so the NEXT operation re-opens a fresh
        // handle — otherwise every IDB op silently no-ops on the closed
        // connection for the rest of the session.
        db.onversionchange = () => {
          try { db.close(); } catch { /* ignore */ }
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => {
        // Blocked is transient (another tab holds an old connection). Don't
        // cache the failed attempt — let the next op retry.
        dbPromise = null;
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

/** Read a string value from IDB. Resolves to `null` when the key is absent
 *  or IDB is unavailable. Never throws. */
export async function idbGet(key: string): Promise<string | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.get(key);
      req.onsuccess = () => {
        const v = req.result;
        resolve(typeof v === 'string' ? v : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Write a string value to IDB. Resolves to `true` on success, `false`
 *  when the transaction aborts or IDB is unavailable. Never throws. */
export async function idbPut(key: string, value: string): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/** Delete a key from IDB. Never throws. No-op when IDB is unavailable. */
export async function idbDel(key: string): Promise<void> {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** List all keys matching an optional prefix. Used by
 *  `deleteAllDynastyData` for the Apple account-deletion flow. */
export async function idbKeys(prefix?: string): Promise<string[]> {
  const db = await openDB();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const keys = (req.result as IDBValidKey[])
          .filter((k): k is string => typeof k === 'string')
          .filter(k => !prefix || k.startsWith(prefix));
        resolve(keys);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/** Test helper — drops the cached DB handle so subsequent calls re-open.
 *  Not for production use. */
export function __resetIdbForTests(): void {
  dbPromise = null;
}

/** Ask the browser to mark this origin's storage as persistent so mobile
 *  WebViews won't evict IDB under storage pressure. This is a best-effort
 *  signal — browsers may grant automatically (PWAs with add-to-home-screen)
 *  or silently refuse. Never throws. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    const already = await navigator.storage.persisted?.();
    if (already) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
