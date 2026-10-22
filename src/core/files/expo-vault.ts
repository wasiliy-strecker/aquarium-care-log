import { Directory, File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import type { FileVault } from '../ports';
import { fileKey } from '../domain/models';
export class ExpoVault implements FileVault {
  private directory: Directory;
  constructor(scope?: string) {
    this.directory = scope
      ? new Directory(Paths.document, 'vault', scope)
      : new Directory(Paths.document, 'vault');
    this.directory.create({ idempotent: true, intermediates: true });
  }
  private file(key: string) {
    return new File(this.directory, fileKey.parse(key));
  }
  async read(key: string) {
    return this.file(key).bytes();
  }
  uri(key: string) {
    return this.file(key).uri;
  }
  async put(bytes: Uint8Array, kind: 'jpg' | 'pdf' = 'jpg'): Promise<string> {
    const name = `${randomUUID()}.${kind}`;
    const temp = new File(this.directory, `${randomUUID()}.tmp`);
    try {
      temp.write(bytes);
      await temp.move(this.file(name));
      return name;
    } catch (error) {
      if (temp.exists) temp.delete();
      throw error;
    }
  }
  async remove(key: string) {
    const file = this.file(key);
    if (file.exists) file.delete();
  }
  async list() {
    return this.directory
      .list()
      .filter((f) => f instanceof File && fileKey.safeParse(f.name).success)
      .map((f) => f.name);
  }
}
