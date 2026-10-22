import { StartupError, StartupPending } from './startup/startup';
import { androidPasswordKey } from './backup/password-key';
import { expoBackupCrypto } from './backup/expo-backup-crypto';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { PdfService, type ReportFontBytes } from './pdf/pdf-service';
import { PdfViewerService } from './pdf/viewer-service';
import { ReportService } from '../features/pdf/report-service';
import {
  DeviceExternalLinks,
  type ExternalLinks,
} from './links/external-links';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { migrate, SqlRepository } from './database/repository';
import { mergePhotos } from '../features/media/photo-selection';
import { ExpoVault } from './files/expo-vault';
import { AquariumService } from '../features/entries/entry-service';
import { BackupCodec, BackupService } from './backup/backup-service';
import {
  ExpoMedia,
  AndroidPhotoValidator,
  type MediaPort,
} from './media/media-service';
import { aquariumNative, type AquariumNative } from './native/aquarium-native';
import type { Environment } from './ports';
export type Services = {
  aquariumService: AquariumService;
  backup: BackupService;
  media: MediaPort;
  native: AquariumNative;
  reports: ReportService;
  viewer: PdfViewerService;
  links: ExternalLinks;
};
const Context = createContext<
  (Services & { revision: number; refresh(): void }) | null
>(null);
let boot: Promise<Services> | undefined;
async function createServices(): Promise<Services> {
  const connection = await SQLite.openDatabaseAsync('aquariumlog.db');
  const db = {
    exec: (sql: string) => connection.execAsync(sql),
    run: async (sql: string, ...params: (string | number | null)[]) => {
      await connection.runAsync(sql, ...params);
    },
    all: <T,>(sql: string, ...params: (string | number | null)[]) =>
      connection.getAllAsync<T>(sql, ...params),
  };
  await migrate(db);
  const repository = new SqlRepository(db);
  const vault = new ExpoVault();
  const env: Environment = {
    id: Crypto.randomUUID,
    now: () => new Date().toISOString(),
    random: Crypto.getRandomBytes,
  };
  const inspector = new AndroidPhotoValidator();
  const aquariumService = new AquariumService(
    repository,
    vault,
    env,
    {
      async sync(aquariums, entries) {
        return aquariumNative.syncReminders(
          JSON.stringify(
            aquariums
              .filter((r) => r.reminder)
              .map((r) => {
                const latest = entries
                  .filter((e) => e.aquariumId === r.id)
                  .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
                return {
                  ...r.reminder,
                  aquariumId: r.id,
                  label: r.name,
                  category: 'aquarium',
                  categoryLabel: 'Aquarium',
                  latestValue: latest?.activity ?? null,
                  latestUnit: null,
                };
              }),
          ),
        );
      },
    },
    inspector,
  );
  const media = new ExpoMedia(aquariumService);
  // Only clean startup orphans after SQLite and persistent drafts are available.
  await aquariumService.cleanup(await vault.list());
  const interrupted = (await repository.drafts()).find(
    (d) => d.external === 'camera' || d.external === 'gallery',
  );
  if (interrupted) {
    const recovered = await media.recoverPhotos();
    try {
      interrupted.form.attachments = mergePhotos(
        interrupted.form.attachments,
        recovered.attachments,
        interrupted.externalReplaceId,
      );
      interrupted.external = null;
      interrupted.externalReplaceId = undefined;
      interrupted.recoveryNotice =
        recovered.failures.join('\n') ||
        'Dein Pflegeentwurf wurde wiederhergestellt.';
      await repository.saveDraft(interrupted);
    } catch (error) {
      await aquariumService.cleanup(
        recovered.attachments.map((photo) => photo.file),
      );
      throw error;
    }
  }
  await aquariumService.syncReminders();
  return {
    aquariumService,
    backup: new BackupService(
      aquariumService,
      new BackupCodec(env, inspector, androidPasswordKey, expoBackupCrypto),
    ),
    media,
    native: aquariumNative,
    reports: new ReportService(
      aquariumService,
      new PdfService(vault, reportFonts),
    ),
    viewer: new PdfViewerService(aquariumService, aquariumNative),
    links: new DeviceExternalLinks(),
  };
}
let fonts: Promise<ReportFontBytes> | undefined;
function reportFonts(): Promise<ReportFontBytes> {
  return (fonts ??= (async () => {
    const load = async (module: number) => {
      const asset = await Asset.fromModule(module).downloadAsync();
      if (!asset.localUri)
        throw new Error('Die PDF-Schrift konnte nicht geladen werden.');
      return new File(asset.localUri).bytes();
    };
    return {
      regular: await load(require('../../assets/ui/Roboto-Regular.ttf')),
      bold: await load(require('../../assets/ui/Roboto-Bold.ttf')),
    };
  })().catch((error) => {
    fonts = undefined;
    throw error;
  }));
}
export function ServicesProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<Services>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    boot ??= createServices();
    boot.then(setServices).catch((e) => {
      boot = undefined;
      setError(
        e instanceof Error
          ? e.message
          : 'Lokale Daten konnten nicht geladen werden.',
      );
    });
  }, [attempt]);
  if (!services)
    return error ? (
      <StartupError
        message={error}
        retry={() => {
          setError('');
          setAttempt((n) => n + 1);
        }}
      />
    ) : (
      <StartupPending />
    );
  return (
    <Context.Provider
      value={{
        ...services,
        revision,
        refresh: () => setRevision((n) => n + 1),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useServices() {
  const value = useContext(Context);
  if (!value) throw new Error('Composition Root fehlt.');
  return value;
}
