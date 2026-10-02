# AquariumLog als eigenständige React-Native-App

AquariumLog unter `aquariumlog/` mit React Native, TypeScript, Expo und SQLite
angelegt. Hausakte `dfd6fc8` liefert die app-lokal kopierte Architektur und
Gerätebausteine. Mein Pflanzenbuch `7deef38` liefert Aufbau und Bedienabläufe.
Beide Vorlagen bleiben unverändert. Keine gemeinsame Laufzeitbibliothek.

Aquarien mit Name, optionalem Volumen, Maßen und Standort. Pflegeeinträge mit
Aktivität, Datum, Notiz, optionalem frei benanntem Messwert und mehreren Fotos.
Chronologischer Verlauf mit Suche, Bearbeitung und lokal gesicherten Entwürfen.
Persönliche Erinnerungen und eigene verschlüsselte `.aqbackup`-Sicherungen.
Fotoersetzung behält ihre Position, auch bei wiederaufgenommenen Entwürfen.
Sichere Dateibereinigung nach erfolgreichen Datenbankänderungen.

Eigener Petrol- und Türkisstil, Hell/Dunkelmodus, Aquarium-Motive und deutsche Texte.
Offline-Datenschutzerklärung und Herkunftsdokumentation. Scanner, OCR und PDF
sowie deren native Klassen, Routen, Abhängigkeiten und Beispieldateien entfernt.

Getrennte Datenbank `aquariumlog.db`, Metro-Port 8086, eigene Erinnerungskennungen.
Dev `com.appfactory.aquarium_log.dev` und Store `com.appfactory.aquarium_log`.
Store-Debug deaktiviert. Eigene Dev-Schlüssel werden erst bei einem Build erzeugt.
Datenbewahrende Installationshelfer und app-lokale Build-Konfiguration vorbereitet.

Prüfung erfolgreich: Prettier, ESLint, TypeScript, 13 gezielte Tests mit echter
SQLite und verschlüsselten Backups, Android-Metro-Export sowie 34 native JVM-Tests
und Lint des eigenen Moduls. JVM-Prüfung ohne unnötige C++-Builds und mit den
beiden geerbten Abhängigkeits-Lintausnahmen. Grenzen und kurze noch ausstehende
Geräteabnahme stehen in `aquariumlog/docs/VALIDATION.md`.

Nur neu erzeugte AquariumLog-Prüfdateien bei knappem Speicherplatz bereinigt.
Keine Nutzerdaten, Vorlagen oder fremden Projekt-Caches verändert.
Keine APK/AAB, Geräteinstallation, Store-Veröffentlichung oder Push.
Eigenständiges AquariumLog-Git-Repository mit lokalem Commit. Eine Kopie dieses
Changelogs liegt dort unter `docs/changelog/`, da der Workspace kein Git-Repository ist.
