import {
  entrySchema,
  aquariumSchema,
  aquariumAtCaptureSchema,
  snapshotFiles,
  entryForm,
  parseDecimal,
  type Attachment,
  type EntryDraft,
  type CareEntry,
  type Aquarium,
} from '../../core/domain/models';
import {
  SerialQueue,
  type Environment,
  type FileVault,
  type Repository,
  type ReminderPort,
  type PhotoValidator,
} from '../../core/ports';
import { digest, verifiedFile } from '../../core/files/integrity';
import { MAX_FILE_BYTES } from '../../core/files/limits';
export class AquariumService {
  readonly queue = new SerialQueue();
  constructor(
    readonly repository: Repository,
    readonly vault: FileVault,
    readonly env: Environment,
    readonly reminders: ReminderPort,
    readonly inspector: PhotoValidator,
  ) {}
  async cleanup(candidates: string[]): Promise<void> {
    try {
      const used = new Set(snapshotFiles(await this.repository.snapshot()));
      for (const draft of await this.repository.drafts())
        for (const photo of draft.form.attachments) used.add(photo.file);
      for (const file of new Set(candidates))
        if (!used.has(file))
          await this.vault.remove(file).catch(() => undefined);
    } catch {
      // Retain an orphan if reference lookup fails.
    }
  }
  async syncReminders(): Promise<string[]> {
    try {
      const data = await this.repository.snapshot();
      return await this.reminders.sync(data.aquariums, data.entries);
    } catch {
      return [
        'Gespeichert. Erinnerungen konnten nicht aktualisiert werden. Bitte die Berechtigungen in den Einstellungen prüfen.',
      ];
    }
  }
  saveAquarium(aquarium: Aquarium) {
    return this.queue.run(async () => {
      await this.repository.saveAquarium(
        aquariumSchema.parse({ ...aquarium, updatedAt: this.env.now() }),
      );
      return this.syncReminders();
    });
  }
  async draft(aquariumId: string, entry?: CareEntry): Promise<EntryDraft> {
    const existing = (await this.repository.drafts()).find(
      (d) => d.aquariumId === aquariumId && d.entryId === (entry?.id ?? null),
    );
    if (existing) return existing;
    const now = this.env.now();
    const draft: EntryDraft = {
      id: this.env.id(),
      aquariumId,
      entryId: entry?.id ?? null,
      createdAt: entry?.createdAt ?? now,
      updatedAt: now,
      external: null,
      form: entry
        ? entryForm(entry)
        : {
            activity: '',
            occurredAt: now,
            timezoneOffsetMinutes: -new Date(now).getTimezoneOffset(),
            measurementLabel: '',
            value: '',
            unit: '',
            note: '',
            attachments: [],
          },
    };
    await this.repository.saveDraft(draft);
    return draft;
  }
  persistDraft(draft: EntryDraft): Promise<void> {
    return this.queue.run(async () => {
      const previous = (await this.repository.drafts()).find(
        (d) => d.id === draft.id,
      );
      await this.repository.saveDraft({ ...draft, updatedAt: this.env.now() });
      await this.cleanup(previous?.form.attachments.map((a) => a.file) ?? []);
    });
  }
  async importPhoto(bytes: Uint8Array, name: string): Promise<Attachment> {
    if (!bytes.length || bytes.length > MAX_FILE_BYTES)
      throw new Error('Das Foto ist leer oder größer als 50 MB.');
    await this.inspector.validate(bytes);
    const file = await this.vault.put(bytes, 'jpg');
    return {
      id: this.env.id(),
      kind: 'photo',
      name: name.slice(0, 500) || 'Foto.jpg',
      file,
      sha256: digest(bytes),
      size: bytes.length,
    };
  }
  saveEntry(
    draft: EntryDraft,
  ): Promise<{ entry: CareEntry; warnings: string[] }> {
    return this.queue.run(async () => {
      const form = draft.form;
      const value = parseDecimal(form.value);
      const before = draft.entryId
        ? await this.repository.entry(draft.entryId)
        : null;
      if (draft.entryId && !before)
        throw new Error('Der Pflegeeintrag wurde inzwischen gelöscht.');
      const aquarium = (await this.repository.aquariums()).find(
        (a) => a.id === draft.aquariumId,
      );
      if (!aquarium) throw new Error('Aquarium nicht gefunden.');
      const entry = entrySchema.parse({
        id: draft.entryId ?? this.env.id(),
        aquariumId: draft.aquariumId,
        aquariumAtCapture: before
          ? (before.aquariumAtCapture ?? null)
          : aquariumAtCaptureSchema.parse({
              name: aquarium.name,
              volumeLiters: aquarium.volumeLiters,
              dimensions: aquarium.dimensions,
              location: aquarium.location,
            }),
        timezoneOffsetMinutes:
          before &&
          Date.parse(before.occurredAt) === Date.parse(form.occurredAt)
            ? (before.timezoneOffsetMinutes ?? null)
            : (form.timezoneOffsetMinutes ??
              -new Date(form.occurredAt).getTimezoneOffset()),
        activity: form.activity,
        occurredAt: new Date(form.occurredAt).toISOString(),
        measurement:
          value === null
            ? null
            : { label: form.measurementLabel, value, unit: form.unit },
        note: form.note,
        attachments: form.attachments,
        createdAt: draft.createdAt,
        updatedAt: this.env.now(),
      });
      for (const photo of entry.attachments)
        await verifiedFile(this.vault, photo);
      await this.repository.saveEntry(entry, draft.id);
      await this.cleanup(before?.attachments.map((a) => a.file) ?? []);
      return { entry, warnings: await this.syncReminders() };
    });
  }
  discard(draft: EntryDraft): Promise<void> {
    return this.queue.run(async () => {
      await this.repository.removeDraft(draft.id);
      await this.cleanup(draft.form.attachments.map((a) => a.file));
    });
  }
  delete(kind: 'aquarium' | 'entry' | 'report', id: string): Promise<string[]> {
    return this.queue.run(async () => {
      const candidates = snapshotFiles(await this.repository.snapshot());
      candidates.push(
        ...(await this.repository.drafts()).flatMap((d) =>
          d.form.attachments.map((a) => a.file),
        ),
      );
      if (kind === 'aquarium') await this.repository.deleteAquarium(id);
      else if (kind === 'entry') await this.repository.deleteEntry(id);
      else await this.repository.deleteReport(id);
      await this.cleanup(candidates);
      return this.syncReminders();
    });
  }
}
