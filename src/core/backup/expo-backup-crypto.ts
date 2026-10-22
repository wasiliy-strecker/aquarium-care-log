import {
  AESEncryptionKey,
  AESSealedData,
  aesEncryptAsync,
  aesDecryptAsync,
  CryptoDigestAlgorithm,
  digest,
} from 'expo-crypto';
import { bytesToHex } from '@noble/hashes/utils.js';
import type { BackupCrypto } from './backup-crypto';

export const expoBackupCrypto: BackupCrypto = {
  async hash(bytes) {
    // Expo's Android digest uses a direct byte buffer, not a base64 string.
    const input =
      bytes.buffer instanceof ArrayBuffer
        ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        : new Uint8Array(bytes);
    return bytesToHex(
      new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, input)),
    );
  },
  async encrypt(key, nonce, header, plaintext) {
    const nativeKey = await AESEncryptionKey.import(key);
    const sealed = await aesEncryptAsync(plaintext, nativeKey, {
      nonce: { bytes: nonce },
      additionalData: header,
      tagLength: 16,
    });
    // AQBACK01 already stores the nonce in its authenticated header.
    return sealed.ciphertext({ includeTag: true, encoding: 'bytes' });
  },
  async decrypt(key, nonce, header, ciphertextWithTag) {
    const nativeKey = await AESEncryptionKey.import(key);
    const sealed = AESSealedData.fromParts(nonce, ciphertextWithTag, 16);
    return aesDecryptAsync(sealed, nativeKey, {
      additionalData: header,
      output: 'bytes',
    });
  },
};
