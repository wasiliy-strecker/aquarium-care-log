# Prüfung AquariumLog

Stand: 2. Oktober 2026. Die erste Umsetzung wurde ohne APK- oder Store-Build,
Geräteinstallation und automatisierte visuelle Testreihe geprüft.

## Ausgeführte Prüfungen

`npm run check` war erfolgreich. Prettier, ESLint und die strikte TypeScript-Prüfung
sowie alle 13 gezielten Tests in drei Dateien sind durchgelaufen.

- `domain.test.ts`: erforderlicher Name, optionale Größenangaben, Dezimalwerte,
  Nullwert, einheitenlose Messung, vergleichbare Messgrößen und Übersichtssuche.
- `workflows.test.ts`: echte SQLite-Dateien mit erneutem Öffnen, frei benannte
  Aktivitäten, chronologischer Verlauf mit Suche und Seitenwechsel,
  Wiederaufnahme von Entwürfen und Fotoersetzung an derselben Position,
  Bearbeiten ohne Revisionen und sichere Dateibereinigung bei Fehlern und Abbruch.
- `backup.test.ts`: verschlüsselte Wiederherstellung mit Fotos, Messwerten und
  Erinnerungen, falsches Passwort, manipulierte und fremde Backups,
  Zusammenführen neuerer lokaler Daten und Rückabwicklung bei einem SQLite-Fehler.

`npx expo export --platform android --output-dir build/metro-check` war erfolgreich.
Metro hat 1995 Module verarbeitet und ein Android-Hermes-Bundle mit den benötigten
Assets erstellt. Das ist eine Prüfung der JavaScript- und Asset-Auflösung.

`npm run check:native` war erfolgreich. Das eigene Kotlin-Modul wurde kompiliert.
Alle 34 JVM-Tests und der Android-Lint des eigenen Moduls sind durchgelaufen.

- `PrivateFilesTest`: drei Tests für private Dateipfade, echte JPEG-Dekodierung,
  abgewiesene unvollständige oder fremde Bilder und Erinnerungsplanung.
- `ReminderAndroidTest`: 28 Tests für Android-Erinnerungen einschließlich
  Zustellstatus, Test-Benachrichtigungen und Navigation mit eigener App-Kennung.
- `ReminderSettingsTest`: drei Tests für die System-Einstellungsziele.

Die native Prüfung verwendet Robolectric und synthetische Bilder. Ihr Helfer
überspringt die für JVM-Tests unnötigen C++-Builds von Expo Modules Core und
React Native Worklets. Wie in der Hausakte-Basis werden die beiden betroffenen
Abhängigkeits-Lintanalysen ausgelassen. Der Lint des eigenen Aquarium-Moduls
bleibt aktiv. Diese Prüfung ersetzt keinen vollständigen Development Build.
Der tatsächliche Build-Helfer verwendet diese Test-Ausschlüsse nicht.

Die überlappenden Paketversionen im Lockfile entsprechen der Hausakte-Basis
`dfd6fc8`. Scanner- und PDF-Abhängigkeiten wurden entfernt. Die Git-Arbeitsstände
von Hausakte und Pflanzenbuch blieben unverändert.

## Kurze manuelle Android-Abnahme

Diese Geräteschritte wurden noch nicht ausgeführt. Sie sind für den ersten
Development Build vorgesehen.

1. Ein Aquarium mit Namen, 180 Litern, Maßen und Standort anlegen und bearbeiten.
   Nach einem erneuten Start die gespeicherten Angaben und Suche prüfen.
2. Die drei vorgeschlagenen und eine eigene Aktivität speichern. Einträge mit
   Notiz, Temperatur, pH ohne Einheit, Nullwert und ohne Messung prüfen.
   Mehr als zehn Einträge über den vollständigen Verlauf und dessen Suche öffnen.
3. Mehrere Kamera- und Galeriefotos hinzufügen, öffnen, vergrößern, ersetzen,
   sortieren und entfernen. Änderungen speichern oder verwerfen. Einen Entwurf
   erneut öffnen und die Wiederaufnahme nach unterbrochener Fotoauswahl prüfen.
4. Eine Erinnerung aktivieren, bearbeiten und testen. Systemfreigaben,
   Benachrichtigungston, Öffnen des Aquariums und Verhalten nach Neustart prüfen.
5. Eine Sicherung über den Android-Dateidialog speichern und wiederherstellen.
   Fotos, Messungen und Erinnerungspläne prüfen. Ein falsches Passwort muss
   die Wiederherstellung ohne Änderung bestehender Daten abbrechen.

Kamera, System-Dateidialoge, tatsächlicher Prozessverlust und Zustellung auf
physischer Android-Hardware sind damit die verbleibenden manuellen Grenzen.
Es wurde keine APK oder AAB erzeugt, installiert, hochgeladen oder gepusht.
