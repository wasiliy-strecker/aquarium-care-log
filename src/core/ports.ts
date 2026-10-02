import type {
  Aquarium,
  CareEntry,
  Snapshot,
  EntryDraft,
} from './domain/models';
export interface SqlConnection {
  exec(sql: string): Promise<void>;
  run(sql: string, ...params: (string | number | null)[]): Promise<void>;
  all<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>;
}
export interface Repository {
  snapshot(): Promise<Snapshot>;
  aquariums(): Promise<Aquarium[]>;
  entry(id: string): Promise<CareEntry | null>;
  dashboard(): Promise<
    { aquarium: Aquarium; latest: CareEntry | null; lastEdited: string }[]
  >;
  entries(
    aquariumId: string,
    search?: string,
    offset?: number,
    limit?: number,
  ): Promise<{ rows: CareEntry[]; total: number }>;
  previousEntry(entry: CareEntry): Promise<CareEntry | null>;
  drafts(): Promise<EntryDraft[]>;
  saveDraft(draft: EntryDraft): Promise<void>;
  removeDraft(id: string): Promise<void>;
  saveAquarium(aquarium: Aquarium): Promise<void>;
  saveEntry(entry: CareEntry, draftId: string): Promise<void>;
  deleteAquarium(id: string): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  replace(data: Snapshot): Promise<void>;
}
export interface FileVault {
  read(key: string): Promise<Uint8Array>;
  put(bytes: Uint8Array, extension: 'jpg'): Promise<string>;
  remove(key: string): Promise<void>;
  list(): Promise<string[]>;
  uri(key: string): string;
}
export interface PhotoValidator {
  validate(bytes: Uint8Array): Promise<void>;
}
export interface ReminderPort {
  sync(aquariums: Aquarium[], entries: CareEntry[]): Promise<string[]>;
}
export type Environment = {
  id(): string;
  now(): string;
  random(length: number): Uint8Array;
};
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(work: () => Promise<T>): Promise<T> {
    const next = this.tail.then(work, work);
    this.tail = next.catch(() => undefined);
    return next;
  }
}
