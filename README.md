# AquariumLog

Eigenständige lokale Android-App mit React Native, TypeScript, Expo und SQLite.
AquariumLog dokumentiert Pflege, Fotos und Wasserwerte für mehrere Aquarien.
Hausakte liefert die technische Basis. Mein Pflanzenbuch liefert Bildschirmaufbau
und Bedienabläufe. Es gibt keine Laufzeitabhängigkeit zu diesen Apps.

## Funktionen

Aquarien erhalten einen Namen und optional Volumen in Litern, freie Maße und Standort.
Die Maße berechnen kein Volumen. Nur der Name ist erforderlich.
Pflegeeinträge enthalten eine Aktivität, Datum und Uhrzeit sowie optionale Notizen.
Wasserwechsel, Filterreinigung und Fütterung sind Vorschläge. Eigene Aktivitäten
werden nach dem Speichern wieder angeboten. Neue Einträge beginnen mit leerer Aktivität.

Ein optionaler Messwert enthält Bezeichnung, Dezimalwert und gegebenenfalls Einheit.
Temperatur und pH-Wert sind Vorschläge. Eine pH-Messung braucht keine Einheit.
Punkt und Komma werden als Dezimaltrennzeichen akzeptiert. Null ist ein echter
Messwert. Ein leeres Wertfeld speichert keine Messung. Differenzen erscheinen nur
bei unmittelbar aufeinanderfolgenden Einträgen derselben Messgröße und Einheit.

Die virtualisierte Übersicht bietet Suche und Sortierung. Die Vorschau verwendet
das erste Foto des letzten bebilderten Pflegeeintrags, unabhängig vom neuesten
Pflegezustand. Das Aquariumdetail zeigt die zehn
neuesten Einträge. Der vollständige Pflegeverlauf hat Suche und Seitenwechsel.
Fotos lassen sich mit Kamera und Galerie kombinieren, öffnen, vergrößern,
ersetzen, entfernen und während der Bearbeitung sortieren. Es gibt keine feste
Fotoanzahl pro Eintrag. Neue Fotos werden angehängt, Ersetzen behält die Position.
Fotos werden auf 1920 Pixel verkleinert, als JPEG optimiert und ohne übernommene
Aufnahme- oder Standortmetadaten im privaten App-Speicher abgelegt.

Pflegeentwürfe werden lokal gesichert, auch vor Kamera- und Galerieaufrufen.
Eine unterbrochene Android-Fotoauswahl kann beim nächsten Start wieder aufgenommen
werden. Änderungen werden erst beim Speichern übernommen. Es gibt keine Revisionen.
Entfernte Fotos werden erst nach erfolgreichem Speichern und Prüfung aller
verbleibenden Datei- und Entwurfsreferenzen bereinigt.

Neue Einträge bewahren Name, Volumen, Maße und Standort des Aquariums bei der
Erfassung sowie den UTC-Versatz des Zeitpunkts. Bearbeitungen der Stammdaten
ändern diese Angaben nicht. Altbestände erhalten keine erfundenen historischen Werte.

Einzel- und vollständige Pflegeverlaufsprotokolle lassen sich als PDF mit allen
aktuellen Fotos in gespeicherter Reihenfolge oder ohne Fotos erstellen.
Gespeicherte Protokolle haben getrennte Listen mit zehn Dokumenten je Seite.
Öffnen, Zoomen, Teilen, Drucken und Löschen verwenden die gespeicherte PDF-Datei.
Lange Inhalte erhalten Seitenumbrüche. Ab 101 Seiten entstehen nummerierte Teile.
Die technischen Grenzen bleiben 50 MB je Datei, 64 MB Fotos je Protokoll und
2000 Seiten einschließlich Teildeckblättern. Es gibt keinen PDF-Import.

Pro Aquarium lässt sich eine Pflegeerinnerung aktivieren. Es gibt stündliche,
tägliche, wöchentliche, monatliche und jährliche Intervalle mit normaler Zustellung
oder möglichst pünktlich mit Ton. Standardmäßig sind Erinnerungen aus.
Android-Berechtigungen, Zustellstatus und eine Test-Erinnerung sind erreichbar.
Eine Benachrichtigung öffnet das zugehörige Aquarium.
App- und Kanalsperren, „Nicht stören“, genaue Alarme und unbekannter Status
werden getrennt erklärt. Zeiten bleiben beim Intervallwechsel und Aus-/Einschalten erhalten.

Verschlüsselte `.aqbackup`-Dateien sichern Aquarien, Pflegeeinträge, Aktivitäten,
Erinnerungspläne, Fotos und unveränderte PDFs mit Zuordnungen und Prüfsummen.
Formularentwürfe bleiben lokal. Wiederherstellen führt Daten zusammen, behält
neuere lokale Änderungen und repariert passende fehlende Entwurfsfotos.
Fremde App-Backups werden
abgewiesen. AES-256-GCM mit PBKDF2-HMAC-SHA256 und 600000 Runden stammt aus Hausakte.
Passwörter benötigen 6 bis 1024 Zeichen. Die Grenzen sind 128 MiB pro Backup,
16 MiB für Metadaten und 30000 Dateien. Ohne Passwort ist keine Wiederherstellung möglich.
Die Android-App verwendet native Passwortableitung, SHA-256 und AES-GCM.
Der Fortschritt zeigt Phase und Dateizähler. Bestehende `.aqbackup`-Dateien bleiben lesbar.

## Entwicklung

Node 22.23 oder neuer innerhalb der Node-22-Linie, npm, JDK 21 und Android SDK.
Die geprüften Paketstände sind über `package-lock.json` festgelegt.

```bash
npm ci
npm run check
npm start
```

Metro verwendet Port 8086. Expo Go genügt wegen des app-lokalen nativen Moduls nicht.
Für die erste Development-Installation und eine laufende Metro-Sitzung:

```bash
npm run android -- DEVICE
```

Dieser Helfer erzeugt einen `devDebug`-Build und verwendet den datenbewahrenden
Installationshelfer. Normale TypeScript- und UI-Änderungen danach über Fast Refresh.

Explizite getrennte Schritte und die optionale Testversion ohne Metro:

```bash
npm run build:dev
bash scripts/install-dev.sh DEVICE
npm run build:preview
npm run install:preview -- DEVICE
```

Die Preview ist `devRelease` mit eingebettetem JavaScript. Änderungen erfordern
bei diesem Modus ein APK-Update. Der Helfer prüft Paket, Version, Debug-Flag,
Installer und bei vorhandener Installation die Signatur. Er verwendet ausschließlich
`adb install -r -t -g --no-streaming`. Signaturkonflikte führen zum Abbruch.
Es wird nichts deinstalliert oder gelöscht. Der Dev-Schlüssel liegt dauerhaft
unter `.local/dev.keystore`, außerhalb des generierten Android-Ordners.
Der Helfer übernimmt einen vorhandenen Dev-Schlüssel. Nur wenn keiner vorhanden
ist, erzeugt er beim ersten Build einen eigenen. Smartphone-Builds verwenden
standardmäßig ARM64. Andere Ziele lassen sich mit `AQUARIUMLOG_ANDROID_ARCHITECTURES`
auswählen.

Dev: `com.appfactory.aquarium_log.dev`, Label `AquariumLog Dev`.
Store: `com.appfactory.aquarium_log`, Label `AquariumLog`.
Store-Debug ist deaktiviert. Private Upload-Signierung und geprüfte AAB-Auslieferung
sind für einen späteren Release-Auftrag vorbereitet. Ohne privaten Schlüssel
bricht ein Store-Build ab. Anleitung: [Android-Releases](docs/ANDROID_RELEASES.md).

## Architektur und Prüfung

Routen in `src/app`, Bildschirmzustand in Feature-Hooks, Fachregeln im
`AquariumService`. Repository, FileVault, PhotoValidator, MediaPort und ReminderPort
trennen Daten- und Gerätezugriff. Der Composition Root verdrahtet app-lokale
Implementierungen. SQLite-Schema 2 migriert Schema 1 ohne Umschreiben alter Einträge.
Fremdschlüssel, WAL, Indizes und Transaktionen sichern die Zuordnungen.
Daten liegen in `aquariumlog.db`, Fotos und PDFs im privaten Vault.

Das eigene Modul `modules/aquarium-native` enthält Erinnerungen, Backup-Dateiauswahl,
Passwortableitung, JPEG-Prüfung, PDF-Vorschau, Teilen und Drucken.
Android-Konfiguration liegt versioniert vor und wird zusätzlich im Expo-Plugin gepflegt.

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npx expo export --platform android --output-dir build/metro-check
npm run check:native
npm run check:store
```

Die kleine Testsuite verwendet echte SQLite-Dateien und verschlüsselte Backups
mit synthetischen Fotos. Die native Bildprüfung und Erinnerungen haben JVM-Tests.
Kein automatisierter visueller Testlauf. Tatsächlich ausgeführte Prüfungen und
kurze manuelle Android-Schritte stehen in `docs/VALIDATION.md`.
Herkunft und fachliche Anpassungen stehen in `docs/PROCESSING_PARITY.md`.

## Datenschutz und Lizenz

Kein Konto, Cloud-Dienst, OCR, Scanner, Server-KI, Werbung oder eigene Telemetrie.
Die App enthält den kurzen Datenschutzhinweis nach MaschinenLog und verlinkt
die eigene [öffentliche Datenschutzerklärung](https://wasiliy-strecker.github.io/aquarium-care-log/datenschutz/).
Die deutschen und englischen Seiten liegen in `docs/`. Die App bleibt deutschsprachig.
Store und Dev-Preview haben keine Internet- oder Netzwerkstatusberechtigung.
Android-Cloud-Backup und Geräteübertragung sind ausdrücklich ausgeschlossen.
Exporte gehen nur auf ausdrückliche Nutzeraktion an den System-Dateidialog oder
eine ausgewählte andere App. Deren Datenverarbeitung bestimmt der jeweilige Anbieter.
Quellcode unter Mozilla Public License 2.0. Hinweise in `THIRD_PARTY_NOTICES.md`.
