#!/usr/bin/env python3
"""Create a new app-local upload identity outside the checkout. Never replace one."""

import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess


def main():
    private = Path.home() / '.local/share/app-factory/signing/aquariumlog'
    if private.exists():
        raise SystemExit('AquariumLog signing directory already exists. Reuse or recover it, never overwrite it.')
    java_home = os.environ.get('JAVA_HOME')
    candidate = Path(java_home) / 'bin/keytool' if java_home else Path.home() / '.local/jdk-21/bin/keytool'
    keytool = str(candidate) if candidate.is_file() else shutil.which('keytool')
    if not keytool:
        raise SystemExit('keytool is required. No private files were created.')
    os.umask(0o077)
    private.mkdir(parents=True, mode=0o700)
    password = secrets.token_urlsafe(48)
    environment = dict(os.environ, AQUARIUMLOG_UPLOAD_PASSWORD=password)
    keystore = private / 'upload-keystore.p12'
    # Persist recovery information before generating the key. A failed export
    # must not strand an existing key without its password.
    # JSON's backslash and UTF-16 escapes also work in a Properties value.
    escaped_path = json.dumps(str(keystore), ensure_ascii=True)[1:-1]
    with (private / 'key.properties').open('x', encoding='ascii') as handle:
        handle.write(f'storeFile={escaped_path}\nstorePassword={password}\nkeyAlias=upload\nkeyPassword={password}\n')
    subprocess.run([
        keytool, '-genkeypair', '-noprompt', '-storetype', 'PKCS12',
        '-keystore', str(keystore), '-alias', 'upload',
        '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000',
        '-dname', 'CN=AquariumLog Upload, O=AppFabrik AI, C=DE',
        '-storepass:env', 'AQUARIUMLOG_UPLOAD_PASSWORD',
        '-keypass:env', 'AQUARIUMLOG_UPLOAD_PASSWORD',
    ], env=environment, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    subprocess.run([
        keytool, '-exportcert', '-rfc', '-keystore', str(keystore),
        '-alias', 'upload', '-storepass:env', 'AQUARIUMLOG_UPLOAD_PASSWORD',
        '-file', str(private / 'upload-certificate.pem'),
    ], env=environment, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    for name in ['upload-keystore.p12', 'key.properties', 'upload-certificate.pem']:
        (private / name).chmod(0o600)
    print(f'AquariumLog upload key created in {private}. Back up this directory privately.')


if __name__ == '__main__':
    main()
