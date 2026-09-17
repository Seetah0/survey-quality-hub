import type { Dataset } from './portal-model';
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sqh-private-workspace', 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore('analyses', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('LOCAL_STORAGE_FAILED'));
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (s: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction('analyses', mode);
    const request = action(tx.objectStore('analyses'));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(new Error('LOCAL_STORAGE_FAILED'));
    };
  });
}
export const listDatasets = () =>
  transaction('readonly', (s) => s.getAll()) as Promise<Dataset[]>;
export const saveDataset = (d: Dataset) =>
  transaction('readwrite', (s) => s.put(d));
export const deleteDataset = (id: string) =>
  transaction('readwrite', (s) => s.delete(id));
