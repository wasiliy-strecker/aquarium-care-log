# Android-Builds für AquariumLog

Dev verwendet `com.appfactory.aquarium_log.dev` mit dem Label `AquariumLog Dev`.
Store verwendet `com.appfactory.aquarium_log` mit dem Label `AquariumLog`.
Nur `storeRelease` ist für Store verfügbar. Dev und Store behalten getrennte Daten.

## Development

`npm run build:dev` erzeugt Dev Debug. `npm run build:preview` erzeugt Dev Release
mit eingebettetem JavaScript. Beide verwenden `.local/dev.keystore`. Ein bestehender
Schlüssel aus `android/app/debug.keystore` wird vor Prebuild dorthin übernommen.
Der Helfer erzeugt nur dann einen neuen Dev-Schlüssel, wenn beide Dateien fehlen.
Die private Datei bleibt bei erneutem Prebuild außerhalb des Android-Verzeichnisses.

Standardziel ist `arm64-v8a`. Für ein anderes Gerät zuerst dessen Architektur mit
`adb -s DEVICE shell getprop ro.product.cpu.abi` prüfen und beispielsweise
`AQUARIUMLOG_ANDROID_ARCHITECTURES=x86_64 npm run build:dev` verwenden.
Die Installationshelfer prüfen Identität, Version, Installer und Signatur.
Sie verwenden ausschließlich `adb install -r -t -g --no-streaming`.

## Späterer Store-Auftrag

Es wurde für diese Umsetzung kein Upload-Schlüssel erzeugt und kein Store-Build
gestartet. Vor einem neuen Upload vorhandene Play-Version prüfen und `versionCode`
in `app.config.ts` erhöhen. Die Marketingversion nur bei Bedarf ändern.

Nur wenn noch keine AquariumLog-Upload-Identität existiert, erzeugt
`python3 scripts/prepare-store-key.py` eine private PKCS12-Datei, ein öffentliches
Zertifikat und `key.properties` unter
`~/.local/share/app-factory/signing/aquariumlog/`.
Einen vorhandenen Schlüssel wiederverwenden oder wiederherstellen.
Das Verzeichnis privat sichern. Keine Schlüssel oder Passwörter einchecken.

`npm run prebuild` verknüpft vorhandene private Eigenschaften nach
`android/key.properties` und erzeugt die app-lokale Android-Konfiguration.
`plugins/key.properties.example` enthält nur das Format.
Der Gradle-Guard `:app:verifyStoreSigning` verhindert fehlende, unzugängliche
oder mit Dev identische Store-Signierung vor der Paketierung.

Nach `npm run check`, `npm run check:native` und `npm run check:store`:

```bash
npm run build:store
```

Der Helfer benötigt JDK 21, Android SDK, OpenSSL und Bundletool 1.18.3 unter
`~/.local/share/app-factory/tools/bundletool-all-1.18.3.jar` oder `BUNDLETOOL_JAR`.
Er baut ARM64 und x86_64 für Store und prüft das tatsächliche AAB auf Paket,
Version, Label, Berechtigungen, ausgeschaltete Systemsicherung, eigenen
Upload-Signierer, eingebettetes JavaScript und 16-KB-Ausrichtung.

Die unveränderliche Auslieferung liegt unter
`build/releases/production/aquariumlog-VERSION-build-CODE-production.aab`.
Daneben steht ein JSON-Prüfbericht mit SHA-256. Vorhandene Auslieferungen
werden nicht überschrieben. Derselbe Store-Build dient internen Play-Tests
und Produktion. Der Helfer installiert, lädt hoch oder veröffentlicht nichts.
Die Dev-Installation bleibt unberührt.
