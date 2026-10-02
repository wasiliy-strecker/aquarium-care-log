import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import type { FileVault } from '../ports';
export const digest = (bytes: Uint8Array): string => bytesToHex(sha256(bytes));
export async function verifiedFile(
  vault: FileVault,
  item: { file: string; sha256: string; size?: number },
): Promise<Uint8Array> {
  let bytes: Uint8Array;
  try {
    bytes = await vault.read(item.file);
  } catch {
    throw new Error(
      'Ein Anhang fehlt. Bitte die Datei ersetzen oder aus einem Backup wiederherstellen.',
    );
  }
  if (
    digest(bytes) !== item.sha256 ||
    (item.size !== undefined && bytes.length !== item.size)
  )
    throw new Error(
      'Ein Anhang wurde unerwartet verändert. Das Backup wurde nicht erstellt.',
    );
  return bytes;
}
