# AquariumLog auf dem Smartphone installieren

Auf ausdrücklichen Auftrag Quellstand `a46cc8a` als eigenständige ARM64-Dev-APK
gebaut und auf dem angeschlossenen HONOR BVL-N49 mit Android 16 installiert.
Version 1.0.0, Code 1, `com.appfactory.aquarium_log.dev`, `AquariumLog Dev`.
JavaScript ist eingebettet, Metro wird nicht benötigt. Kein Store-Build oder Push.

`npm run build:preview` erfolgreich in 2 Minuten 10 Sekunden.
`npm run install:preview` erfolgreich mit geprüfter Kennung und Build-Art,
über `adb install -r -t -g --no-streaming`. Zuvor war keine AquariumLog-App
installiert. Keine Daten gelöscht. Eigener Dev-Schlüssel im ignorierten
`.local/dev.keystore` dauerhaft außerhalb des Prebuild-Ordners abgelegt.

Paket, Version, ARM64, nicht debuggable und Installer `null` bestätigt.
MainActivity gestartet, Prozess läuft ohne Fehler im gefilterten Startprotokoll.
Der Sperrbildschirm verhindert eine Bestätigung der App-Anzeige. Keine
aufwendige visuelle Testreihe. `docs/VALIDATION.md` entsprechend aktualisiert.
Nur Dokumentation geändert, Format und Diff geprüft.

APK: `aquariumlog/android/app/build/outputs/apk/dev/release/app-dev-release.apk`

SHA-256: `8b33da282454851225128949eaff625b05574065f9fe943e2abb464252401568`
