import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "nutrir-offline";
const DB_VERSION = 1;
const STORE = "outbox";

export interface OutboxItem {
  id: string;
  table: "collection_points" | "collection_routes";
  payload: Record<string, any>;
  created_at: string;
  attempts: number;
  last_error?: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const s = db.createObjectStore(STORE, { keyPath: "id" });
          s.createIndex("created_at", "created_at");
        }
      },
    });
  }
  return dbPromise;
};

export const enqueue = async (table: OutboxItem["table"], payload: Record<string, any>) => {
  const db = await getDB();
  const item: OutboxItem = {
    id: crypto.randomUUID(),
    table,
    payload,
    created_at: new Date().toISOString(),
    attempts: 0,
  };
  await db.put(STORE, item);
  return item;
};

export const listOutbox = async (): Promise<OutboxItem[]> => {
  const db = await getDB();
  return db.getAllFromIndex(STORE, "created_at");
};

export const removeFromOutbox = async (id: string) => {
  const db = await getDB();
  await db.delete(STORE, id);
};

export const updateOutboxItem = async (item: OutboxItem) => {
  const db = await getDB();
  await db.put(STORE, item);
};

export const countOutbox = async (): Promise<number> => {
  const db = await getDB();
  return db.count(STORE);
};

export const clearOutbox = async () => {
  const db = await getDB();
  await db.clear(STORE);
};
