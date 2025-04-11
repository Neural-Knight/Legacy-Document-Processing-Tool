import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'uploadFilesDB';
const STORE_NAME = 'files';

interface StoredFile {
  id: string;
  file: File;
  previewUrl?: string;
  lastModified: number;
}

class FileStorage {
  private db: IDBPDatabase | null = null;

  async init() {
    this.db = await openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }

  async storeFiles(files: File[]) {
    if (!this.db) await this.init();
    
    const tx = this.db!.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    for (const file of files) {
      const storedFile: StoredFile = {
        id: `${file.name}-${file.lastModified}`,
        file,
        lastModified: Date.now()
      };
      await store.put(storedFile);
    }
  }

  async getFiles(): Promise<File[]> {
    if (!this.db) await this.init();
    
    const tx = this.db!.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const storedFiles = await store.getAll();
    
    return storedFiles.map(sf => sf.file);
  }

  async clearFiles() {
    if (!this.db) await this.init();
    
    const tx = this.db!.transaction(STORE_NAME, 'readwrite');
    await tx.objectStore(STORE_NAME).clear();
  }

  async removeFile(file: File) {
    if (!this.db) await this.init();
    
    const tx = this.db!.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const fileId = `${file.name}-${file.lastModified}`;
    await store.delete(fileId);
  }
}

export const fileStorage = new FileStorage();