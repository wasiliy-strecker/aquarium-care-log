#!/usr/bin/env python3
"""Verify the actual Store artifact before creating an immutable delivery."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import struct
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import zipfile


ANDROID = "{http://schemas.android.com/apk/res/android}"
PACKAGE = "com.appfactory.aquarium_log"
TOOL_PACKAGES = ("shell-quote", "source-map-js", "node-forge", "braces", "vite")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def run(*args, data=None):
    return subprocess.run(
        args, input=data, check=True, capture_output=True
    ).stdout


def verify_elf(data, name):
    require(data[:6] == b"\x7fELF\x02\x01", f"Expected a 64-bit LE ELF: {name}")
    offset = struct.unpack_from("<Q", data, 32)[0]
    size, count = struct.unpack_from("<HH", data, 54)
    loads = 0
    for index in range(count):
        kind, _, file_offset, address, _, _, _, alignment = struct.unpack_from(
            "<IIQQQQQQ", data, offset + index * size
        )
        if kind == 1:
            loads += 1
            require(
                alignment >= 16384
                and alignment & (alignment - 1) == 0
                and file_offset % alignment == address % alignment,
                f"Native library lacks 16 KB PT_LOAD alignment: {name}",
            )
    require(loads > 0, f"ELF has no load segments: {name}")


def verify_network_permissions(manifest):
    permissions = {
        item.get(ANDROID + "name")
        for tag in ("uses-permission", "uses-permission-sdk-23")
        for item in manifest.findall(tag)
    }
    require(
        not permissions & {
            "android.permission.INTERNET",
            "android.permission.ACCESS_NETWORK_STATE",
        },
        "Store bundle must not request network permissions",
    )
    return permissions


def verify(bundle, version_name, version_code, certificate):
    bundletool = Path(
        os.environ.get(
            "BUNDLETOOL_JAR",
            Path.home() / ".local/share/app-factory/tools/bundletool-all-1.18.3.jar",
        )
    )

    def bt(*args):
        return run(
            "java", "-jar", str(bundletool), *args, f"--bundle={bundle}"
        ).decode()

    bt("validate")
    manifest = ET.fromstring(bt("dump", "manifest"))
    require(manifest.get("package") == PACKAGE, "Wrong Store package")
    require(
        manifest.get(ANDROID + "versionName") == version_name,
        "Wrong version name",
    )
    require(
        manifest.get(ANDROID + "versionCode") == str(version_code),
        "Wrong version code",
    )
    sdk = manifest.find("uses-sdk")
    require(
        sdk is not None and sdk.get(ANDROID + "targetSdkVersion") == "36",
        "Expected target API 36",
    )
    app = manifest.find("application")
    require(app is not None, "Application missing")
    require(app.get(ANDROID + "debuggable", "false") == "false", "Store is debuggable")
    require(app.get(ANDROID + "testOnly", "false") == "false", "Store is test-only")
    require(
        app.get(ANDROID + "allowBackup") == "false",
        "System backup must stay disabled",
    )
    require(sdk.get(ANDROID + "minSdkVersion") == "24", "Expected minimum API 24")
    require(
        app.get(ANDROID + "fullBackupContent") == "false"
        and app.get(ANDROID + "dataExtractionRules", "").startswith("@"),
        "Explicit backup and transfer exclusions missing",
    )
    label = app.get(ANDROID + "label", "")
    if label.startswith("@"):
        values = bt("dump", "resources", f"--resource={label[1:]}", "--values")
        require(
            '"AquariumLog"' in values and '"AquariumLog Dev"' not in values,
            "Wrong Store label",
        )
    else:
        require(label == "AquariumLog", "Wrong Store label")
    permissions = verify_network_permissions(manifest)
    require(
        not permissions & {
            "android.permission.RECORD_AUDIO",
            "android.permission.SYSTEM_ALERT_WINDOW",
            "android.permission.READ_MEDIA_IMAGES",
            "android.permission.READ_MEDIA_VIDEO",
        },
        "Unexpected development or microphone permission",
    )
    require(
        "PAGE_ALIGNMENT_16K" in bt("dump", "config"),
        "Bundle does not request 16 KB ZIP alignment",
    )
    signature_output = run(
        "jarsigner", "-J-Duser.language=en", "-J-Duser.country=US",
        "-verify", str(bundle),
    ).decode()
    require("jar verified." in signature_output, "JAR signature not verified")
    require(
        "unsigned entries" not in signature_output,
        "Bundle contains unsigned entries",
    )
    expected_der = run(
        "openssl", "x509", "-in", str(certificate), "-outform", "DER"
    )
    native_libraries = []
    with zipfile.ZipFile(bundle) as archive:
        names = archive.namelist()
        signatures = [
            name for name in names
            if re.fullmatch(r"META-INF/[^/]+\.RSA", name)
        ]
        require(len(signatures) == 1, "Expected one RSA upload signer")
        certs = run(
            "openssl", "pkcs7", "-inform", "DER", "-print_certs",
            data=archive.read(signatures[0]),
        )
        actual_der = run("openssl", "x509", "-outform", "DER", data=certs)
        require(
            actual_der == expected_der,
            "Signer differs from the app's public upload certificate",
        )
        require(
            "base/assets/index.android.bundle" in names,
            "Embedded JavaScript missing",
        )
        for name in names:
            if name.startswith("base/lib/") and name.endswith(".so"):
                verify_elf(archive.read(name), name)
                native_libraries.append(name)
        require(
            {name.split("/")[2] for name in native_libraries}
            == {"arm64-v8a", "x86_64"},
            "Unexpected native ABIs",
        )
    source_map = Path(
        "android/app/build/intermediates/sourcemaps/react/storeRelease/"
        "index.android.bundle.packager.map"
    )
    sources = json.loads(source_map.read_text())["sources"]
    for package in TOOL_PACKAGES:
        require(
            not any(f"node_modules/{package}/" in source for source in sources),
            f"Build tool bundled: {package}",
        )
    return {
        "package": PACKAGE,
        "label": "AquariumLog",
        "versionName": version_name,
        "versionCode": version_code,
        "minSdk": int(sdk.get(ANDROID + "minSdkVersion")),
        "targetSdk": 36,
        "debuggable": False,
        "networkPermissions": [],
        "permissions": sorted(permissions),
        "systemBackupEnabled": False,
        "uploadCertificateSha256": hashlib.sha256(actual_der).hexdigest(),
        "sha256": hashlib.sha256(bundle.read_bytes()).hexdigest(),
        "abis": ["arm64-v8a", "x86_64"],
        "nativeLibraries16KbAligned": len(native_libraries),
        "sourceMapSources": len(sources),
        "excludedBuildToolPackages": list(TOOL_PACKAGES),
        "embeddedJavaScript": True,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--version-name", required=True)
    parser.add_argument("--version-code", type=int, required=True)
    parser.add_argument(
        "--certificate", type=Path,
        default=Path.home() / (
            ".local/share/app-factory/signing/aquariumlog/upload-certificate.pem"
        ),
    )
    parser.add_argument("--deliver", type=Path)
    args = parser.parse_args()
    if args.deliver:
        require(
            not args.deliver.exists()
            and not args.deliver.with_suffix(".json").exists(),
            "Delivery already exists. Increase the version code.",
        )
    report = verify(
        args.bundle, args.version_name, args.version_code, args.certificate
    )
    if args.deliver:
        args.deliver.parent.mkdir(parents=True, exist_ok=True)
        # Publish a complete, verified copy atomically without replacing a file.
        with tempfile.NamedTemporaryFile(dir=args.deliver.parent) as staging:
            with args.bundle.open("rb") as source:
                shutil.copyfileobj(source, staging)
            staging.flush()
            require(
                hashlib.sha256(Path(staging.name).read_bytes()).hexdigest()
                == report["sha256"],
                "Delivery checksum differs from the verified bundle",
            )
            os.link(staging.name, args.deliver)
        with args.deliver.with_suffix(".json").open("x") as metadata:
            metadata.write(json.dumps(report, indent=2) + "\n")
        print(f"Verified Store delivery: {args.deliver.resolve()}")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
