# AquariumLog

Eigenständige Android-App mit React Native, TypeScript, Expo und SQLite.
Root-Regeln gelten mit der beauftragten React-Native-Ausnahme.
Hausakte ist die technische Herkunft. Pflanzenbuch ist die Bedienreferenz.
Keine Runtime-Abhängigkeit auf Nachbar-Apps. Beide Vorlagen bleiben unverändert.

## Architektur und Entwicklung

Schlanke Routen in `src/app`, View-Model-Hooks in Features, Fachregeln in Services.
SQLite, Dateien, Fotos und Erinnerungen hinter Ports. Keine gemeinsame Bibliothek.
Kein OCR, Scanner, PDF, Cloud, Konto, KI oder eigene Telemetrie.
Dateien erst nach erfolgreicher Datenbankänderung und Prüfung aller Referenzen löschen.
Entwürfe berücksichtigen. Bearbeiten erzeugt keine Revisionen.

`npm ci`, `npm run check`, `npm start`. Metro verwendet Port 8086.
Fast Refresh für normale TypeScript- und UI-Änderungen nutzen.
Native Änderungen benötigen einen Development Build. Optionaler `devRelease`
enthält eingebettetes JavaScript und benötigt für Änderungen ein APK-Update.
Native Konfiguration zusätzlich im Plugin `plugins/with-aquarium-android.js` pflegen.

Dev: `com.appfactory.aquarium_log.dev`, Label `AquariumLog Dev`.
Store: `com.appfactory.aquarium_log`, Label `AquariumLog`.
Store-Debug ist deaktiviert. Ohne Release-Auftrag keine Store-Signierung oder Builds.
Keine fremden Signierschlüssel übernehmen. Installation ausschließlich datenbewahrend
über den geprüften Helfer mit `adb install -r -t -g --no-streaming`.
Keine Deinstallation oder Datenlöschung ohne ausdrücklichen Auftrag.

## Prüfung und Abschluss

Formatprüfung, ESLint, TypeScript und die kleine gezielte Testsuite vor Commits.
Bei nativen Änderungen die betroffenen JVM-Tests ausführen.
Manuelle Android-Grenzen dokumentieren. Keine aufwendigen visuellen Testreihen.
Pro Aufgabe einen Changelog unter Workspace `CODEX/changelog/` und eine Kopie
unter `docs/changelog/` anlegen, da der Workspace kein Git-Repository ist.
Nur AquariumLog lokal committen. Ohne Auftrag nicht pushen.
Keine privaten Fotos, Backups, Geheimnisse oder generierten Caches einchecken.
Keine Semikolons in Nutzertexten und Dokumentation.
