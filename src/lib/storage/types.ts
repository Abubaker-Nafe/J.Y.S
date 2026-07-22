export type StoredImage = {
  storageKey: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
};

export interface ImageStorage {
  save(file: File): Promise<StoredImage>;
  remove(storageKey: string): Promise<void>;
}

