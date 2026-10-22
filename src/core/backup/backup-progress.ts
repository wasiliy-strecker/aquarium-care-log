export type BackupProgress = {
  phase: 'preparing' | 'checking' | 'encrypting' | 'decrypting' | 'restoring';
  completedFiles?: number;
  totalFiles?: number;
};
export type OnBackupProgress = (progress: BackupProgress) => void;
export type ProgressReporter = (progress: BackupProgress) => Promise<void>;

export function progressReporter(
  onProgress?: OnBackupProgress,
): ProgressReporter {
  let phase: BackupProgress['phase'] | undefined;
  let lastReported = 0;
  return async (progress) => {
    if (!onProgress) return;
    const now = Date.now();
    if (
      progress.phase !== phase ||
      now - lastReported >= 100 ||
      (progress.completedFiles !== undefined &&
        progress.completedFiles === progress.totalFiles)
    ) {
      phase = progress.phase;
      lastReported = now;
      onProgress(progress);
      // Let React render before starting the next native call or file check.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  };
}
