import {
  libraryName,
  libraryVersion,
  maxLibraryBytes,
  maxRecipes,
  maxSessions,
  dayMs,
  isSummary,
  isRecipe,
  isStoredDataset,
  snapshotSummary,
  plainSnapshot,
  snapshotBytes,
  type CleanupDays,
  type Recipe,
  type SavedSession,
  type SessionSummary,
} from "../core/library/contracts";
import type { Dataset } from "../core/extraction/contracts";

const stores = {
  history: "sessions",
  payload: "snapshots",
  recipes: "recipes",
} as const;
function req<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Local storage request failed."));
  });
}
function finished(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(
        tx.error ?? new Error("Local storage transaction was interrupted."),
      );
  });
}
function upgrade(db: IDBDatabase, tx: IDBTransaction, previous: number) {
  const sessions = db.objectStoreNames.contains(stores.history)
    ? tx.objectStore(stores.history)
    : db.createObjectStore(stores.history, { keyPath: "id" });
  const snapshots = db.createObjectStore(stores.payload, { keyPath: "id" });
  if (!db.objectStoreNames.contains(stores.recipes))
    db.createObjectStore(stores.recipes, { keyPath: "id" });
  sessions.createIndex("savedAt", "savedAt");
  if (previous !== 1) return;
  let count = 0,
    bytes = 0;
  const cursor = sessions.openCursor();
  cursor.onsuccess = () => {
    const step = cursor.result;
    if (!step) return;
    try {
      const legacy = step.value as {
        id: unknown;
        name: unknown;
        savedAt: unknown;
        partial?: unknown;
        dataset?: unknown;
      };
      if (
        typeof legacy.id !== "string" ||
        typeof legacy.name !== "string" ||
        typeof legacy.savedAt !== "number" ||
        (legacy.partial !== undefined && typeof legacy.partial !== "boolean") ||
        !isStoredDataset(legacy.dataset)
      )
        throw new Error("Unsupported legacy snapshot");
      const snapshot = plainSnapshot(legacy.dataset);
      const summary = snapshotSummary(
        legacy.id,
        legacy.name,
        legacy.savedAt,
        legacy.partial === true,
        snapshot,
      );
      count++;
      bytes += summary.byteCount;
      if (count > maxSessions || bytes > maxLibraryBytes)
        throw new Error("Legacy snapshots exceed capacity");
      snapshots.add({ id: summary.id, dataset: snapshot });
      step.update(summary);
      step.continue();
    } catch {
      tx.abort();
    }
  };
}
export function createLibrary(
  factory: IDBFactory = globalThis.indexedDB,
  name = libraryName,
) {
  function open() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      if (!factory) {
        reject(new Error("IndexedDB is unavailable in this browser context."));
        return;
      }
      const request = factory.open(name, libraryVersion);
      let abandoned = false;
      request.onupgradeneeded = (event) => {
        if (request.transaction)
          upgrade(request.result, request.transaction, event.oldVersion);
      };
      request.onsuccess = () => {
        const db = request.result;
        if (abandoned) {
          db.close();
          return;
        }
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () =>
        reject(
          new Error(
            "Could not open the local library. Existing snapshots were not overwritten.",
            { cause: request.error },
          ),
        );
      request.onblocked = () => {
        abandoned = true;
        reject(
          new Error(
            "Close other extension panels or browser windows using the local library, then retry.",
          ),
        );
      };
    });
  }
  async function transaction<T>(
    names: string[],
    mode: IDBTransactionMode,
    work: (tx: IDBTransaction) => Promise<T>,
  ) {
    const db = await open();
    try {
      const tx = db.transaction(
        names,
        mode,
        mode === "readwrite" ? { durability: "strict" } : undefined,
      );
      const done = finished(tx);
      // Listen immediately, even if an IDB request rejects before the transaction abort event.
      void done.catch(() => {});
      try {
        const value = await work(tx);
        await done;
        return value;
      } catch (problem) {
        try {
          tx.abort();
        } catch {
          /* transaction may already be finished */
        }
        await done.catch(() => {});
        throw problem;
      }
    } finally {
      db.close();
    }
  }
  async function listHistory(tx: IDBTransaction) {
    const values: unknown[] = await req(
      tx.objectStore(stores.history).getAll(null, maxSessions + 1),
    );
    if (values.length > maxSessions || !values.every(isSummary))
      throw new Error("Some local history entries could not be read.");
    return values.sort(
      (a, b) => b.savedAt - a.savedAt || a.id.localeCompare(b.id),
    );
  }
  async function listRecipes(tx: IDBTransaction) {
    const values: unknown[] = await req(
      tx.objectStore(stores.recipes).getAll(null, maxRecipes + 1),
    );
    if (values.length > maxRecipes || !values.every(isRecipe))
      throw new Error("Some saved configurations could not be read.");
    return values.sort(
      (a, b) => b.savedAt - a.savedAt || a.id.localeCompare(b.id),
    );
  }
  const sum = (list: SessionSummary[]) =>
    list.reduce((total, row) => total + row.byteCount, 0);
  async function deleteOne(tx: IDBTransaction, id: string) {
    await Promise.all([
      req(tx.objectStore(stores.history).delete(id)),
      req(tx.objectStore(stores.payload).delete(id)),
    ]);
  }
  return {
    readLibrary: () =>
      transaction([stores.history, stores.recipes], "readonly", async (tx) => {
        const [sessions, recipes] = await Promise.all([
          listHistory(tx),
          listRecipes(tx),
        ]);
        return { sessions, recipes, bytes: sum(sessions) };
      }),
    save(name: string, dataset: Dataset, partial: boolean) {
      const snapshot = plainSnapshot(dataset);
      const summary = snapshotSummary(
        crypto.randomUUID(),
        name,
        Date.now(),
        partial,
        snapshot,
      );
      return transaction(
        [stores.history, stores.payload],
        "readwrite",
        async (tx) => {
          const entries = await listHistory(tx);
          if (
            entries.length >= maxSessions ||
            sum(entries) + summary.byteCount > maxLibraryBytes
          )
            throw new Error(
              "Local snapshot capacity reached. Delete an older snapshot and try again.",
            );
          await Promise.all([
            req(tx.objectStore(stores.history).add(summary)),
            req(
              tx
                .objectStore(stores.payload)
                .add({ id: summary.id, dataset: snapshot }),
            ),
          ]);
          return summary;
        },
      );
    },
    restore: (id: string) =>
      transaction(
        [stores.history, stores.payload],
        "readonly",
        async (tx): Promise<SavedSession> => {
          const [meta, payload] = await Promise.all([
            req<unknown>(tx.objectStore(stores.history).get(id)),
            req<unknown>(tx.objectStore(stores.payload).get(id)),
          ]);
          if (meta === undefined || payload === undefined)
            throw new Error("This snapshot is no longer available.");
          if (
            !isSummary(meta) ||
            !payload ||
            typeof payload !== "object" ||
            !("dataset" in payload) ||
            !isStoredDataset(payload.dataset) ||
            payload.dataset.rows.length !== meta.rows ||
            payload.dataset.columns.length !== meta.columns
          )
            throw new Error("This snapshot could not be restored safely.");
          const snapshot = plainSnapshot(payload.dataset);
          if (snapshotBytes(snapshot) !== meta.byteCount)
            throw new Error("This snapshot could not be restored safely.");
          return { ...meta, dataset: snapshot };
        },
      ),
    remove: (id: string) =>
      transaction([stores.history, stores.payload], "readwrite", (tx) =>
        deleteOne(tx, id),
      ),
    cleanup: (days: CleanupDays, now = Date.now()) =>
      transaction([stores.history, stores.payload], "readwrite", async (tx) => {
        const old = (await listHistory(tx)).filter(
          (entry) => entry.savedAt < now - days * dayMs,
        );
        await Promise.all(old.map((entry) => deleteOne(tx, entry.id)));
        return old.length;
      }),
    clearHistory: () =>
      transaction([stores.history, stores.payload], "readwrite", async (tx) => {
        await Promise.all([
          req(tx.objectStore(stores.history).clear()),
          req(tx.objectStore(stores.payload).clear()),
        ]);
      }),
    addRecipe: (recipe: Recipe) =>
      transaction([stores.recipes], "readwrite", async (tx) => {
        if (!isRecipe(recipe))
          throw new Error("This configuration is invalid.");
        if ((await req(tx.objectStore(stores.recipes).count())) >= maxRecipes)
          throw new Error(
            "Saved configuration capacity reached. Delete a configuration first.",
          );
        await req(tx.objectStore(stores.recipes).add(recipe));
      }),
    removeRecipe: (id: string) =>
      transaction([stores.recipes], "readwrite", async (tx) => {
        await req(tx.objectStore(stores.recipes).delete(id));
      }),
    clearRecipes: () =>
      transaction([stores.recipes], "readwrite", async (tx) => {
        await req(tx.objectStore(stores.recipes).clear());
      }),
  };
}
