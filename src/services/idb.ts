/**
 * Minimal promise wrapper over IndexedDB.
 *
 * Deliberately dependency-free and tiny: we only need keyed CRUD plus index
 * range queries. Everything the app persists goes through `services/repository`,
 * which is the only consumer of this file.
 */

export const DB_NAME = 'fittrack'
export const DB_VERSION = 1

export const STORES = {
  profile: 'profile',
  meals: 'meals',
  workouts: 'workouts',
  weights: 'weights',
  water: 'water',
  steps: 'steps',
  customFoods: 'customFoods',
  customMeals: 'customMeals',
  routines: 'routines',
  reminders: 'reminders',
  settings: 'settings',
} as const

export type StoreName = (typeof STORES)[keyof typeof STORES]

/** Stores keyed by `date`, each with a `by-date` index for range queries. */
const DATE_INDEXED: StoreName[] = ['meals', 'workouts', 'weights', 'water']

let dbPromise: Promise<IDBDatabase> | null = null

export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result
      for (const name of Object.values(STORES)) {
        if (db.objectStoreNames.contains(name)) continue
        // `steps` is keyed by date directly; `settings`/`profile` are singletons
        // keyed by a fixed string. Everything else uses a generated id.
        const store = db.createObjectStore(name, {
          keyPath: name === 'steps' ? 'date' : 'id',
        })
        if (DATE_INDEXED.includes(name)) {
          store.createIndex('by-date', 'date', { unique: false })
        }
      }
    }

    req.onsuccess = () => {
      const db = req.result
      // Another tab upgrading the schema would otherwise block indefinitely.
      db.onversionchange = () => db.close()
      resolve(db)
    }
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'))
    req.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'))
  })

  // A failed open must not be cached, or every later call reuses the rejection.
  dbPromise.catch(() => { dbPromise = null })
  return dbPromise
}

function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode)
        const req = fn(tx.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

export const idb = {
  get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
    return run<T | undefined>(store, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>)
  },

  getAll<T>(store: StoreName): Promise<T[]> {
    return run<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>)
  },

  /** Inclusive range query over the `by-date` index. */
  getByDateRange<T>(store: StoreName, from: string, to: string): Promise<T[]> {
    return run<T[]>(store, 'readonly', (s) =>
      s.index('by-date').getAll(IDBKeyRange.bound(from, to)) as IDBRequest<T[]>)
  },

  put<T>(store: StoreName, value: T): Promise<IDBValidKey> {
    return run<IDBValidKey>(store, 'readwrite', (s) => s.put(value as unknown as object))
  },

  /** Writes many records in a single transaction so a failure rolls all back. */
  putMany<T>(store: StoreName, values: T[]): Promise<void> {
    if (values.length === 0) return Promise.resolve()
    return openDB().then(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(store, 'readwrite')
          const os = tx.objectStore(store)
          for (const v of values) os.put(v as unknown as object)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
          tx.onabort = () => reject(tx.error)
        }),
    )
  },

  delete(store: StoreName, key: IDBValidKey): Promise<void> {
    return run<undefined>(store, 'readwrite', (s) => s.delete(key)).then(() => undefined)
  },

  clear(store: StoreName): Promise<void> {
    return run<undefined>(store, 'readwrite', (s) => s.clear()).then(() => undefined)
  },

  async clearAll(): Promise<void> {
    for (const name of Object.values(STORES)) await idb.clear(name)
  },
}
