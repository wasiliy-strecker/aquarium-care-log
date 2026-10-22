import { gcm } from '@noble/ciphers/aes.js';
import { digest } from '../files/integrity';

export interface BackupCrypto {
  hash(bytes: Uint8Array): Promise<string>;
  encrypt(
    key: Uint8Array,
    nonce: Uint8Array,
    header: Uint8Array,
    plaintext: Uint8Array,
  ): Promise<Uint8Array>;
  decrypt(
    key: Uint8Array,
    nonce: Uint8Array,
    header: Uint8Array,
    ciphertextWithTag: Uint8Array,
  ): Promise<Uint8Array>;
}

// Independent implementation for non-native hosts and compatibility tests.
export const nobleBackupCrypto: BackupCrypto = {
  async hash(bytes) {
    return digest(bytes);
  },
  async encrypt(key, nonce, header, plaintext) {
    return gcm(key, nonce, header).encrypt(plaintext);
  },
  async decrypt(key, nonce, header, ciphertextWithTag) {
    return gcm(key, nonce, header).decrypt(ciphertextWithTag);
  },
};
