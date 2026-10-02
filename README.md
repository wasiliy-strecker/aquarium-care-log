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

Die Übersicht bietet Suche und Sortierung. Das Aquariumdetail zeigt die zehn
neuesten Einträge. Der vollständige Pflegeverlauf hat Suche und Seitenwechsel.
Fotos lassen sich mit Kamera und Galerie kombinieren, öffnen, vergrößern,
ersetzen, entfernen und während der Bearbeitung sortieren. Bis zu 200 Fotos
je Eintrag. Neue Fotos werden angehängt, Ersetzen behält die Position.
Fotos werden auf 1920 Pixel verkleinert, als JPEG optimiert und ohne übernommene
Aufnahme- oder Standortmetadaten im privaten App-Speicher abgelegt.

Pflegeentwürfe werden lokal gesichert, auch vor Kamera- und Galerieaufrufen.
Eine unterbrochene Android-Fotoauswahl kann beim nächsten Start wieder aufgenommen
werden. Änderungen werden erst beim Speichern übernommen. Es gibt keine Revisionen.
Entfernte Fotos werden erst nach erfolgreichem Speichern und Prüfung aller
verbleibenden Datei- und Entwurfsreferenzen bereinigt.

Pro Aquarium lässt sich eine Pflegeerinnerung aktivieren. Es gibt stündliche,
tägliche, wöchentliche, monatliche und jährliche Intervalle mit normaler Zustellung
oder möglichst pünktlich mit Ton. Standardmäßig sind Erinnerungen aus.
Android-Berechtigungen, Zustellstatus und eine Test-Erinnerung sind erreichbar.
Eine Benachrichtigung öffnet das zugehörige Aquarium.

Verschlüsselte `.aqbackup`-Dateien sichern Aquarien, Pflegeeinträge, Aktivitäten,
Erinnerungspläne und Fotos. Formularentwürfe bleiben lokal. Wiederherstellen führt
Daten zusammen und behält neuere lokale Änderungen. Fremde App-Backups werden
abgewiesen. AES-256-GCM mit PBKDF2-HMAC-SHA256 und 600000 Runden stammt aus Hausakte.
Passwörter benötigen 6 bis 1024 Zeichen. Die Grenzen sind 128 MiB pro Backup,
16 MiB für Metadaten und 30000 Dateien. Ohne Passwort ist keine Wiederherstellung möglich.

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
Es wird nichts deinstalliert oder gelöscht. Der erste benötigte Build erzeugt
seinen eigenen ignorierten Dev-Schlüssel.

Dev: `com.appfactory.aquarium_log.dev`, Label `AquariumLog Dev`.
Store: `com.appfactory.aquarium_log`, Label `AquariumLog`.
Store-Debug ist deaktiviert. Store-Release bleibt bis zu einem gesonderten
Release-Auftrag unsigniert. Keine Veröffentlichung wurde eingerichtet.

## Architektur und Prüfung

Routen in `src/app`, Bildschirmzustand in Feature-Hooks, Fachregeln im
`AquariumService`. Repository, FileVault, PhotoValidator, MediaPort und ReminderPort
trennen Daten- und Gerätezugriff. Der Composition Root verdrahtet app-lokale
Implementierungen. SQLite-Schema 1 nutzt Fremdschlüssel, WAL, Indizes und Transaktionen.
Daten liegen in `aquariumlog.db`, Fotos im privaten Vault.

Das eigene Modul `modules/aquarium-native` enthält Erinnerungen, Backup-Dateiauswahl,
Passwortableitung und JPEG-Prüfung. Es enthält keine Scanner- oder PDF-Funktionen.
Android-Konfiguration liegt versioniert vor und wird zusätzlich im Expo-Plugin gepflegt.

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npx expo export --platform android --output-dir build/metro-check
npm run check:native
```

Die kleine Testsuite verwendet echte SQLite-Dateien und verschlüsselte Backups
mit synthetischen Fotos. Die native Bildprüfung und Erinnerungen haben JVM-Tests.
Kein automatisierter visueller Testlauf. Tatsächlich ausgeführte Prüfungen und
kurze manuelle Android-Schritte stehen in `docs/VALIDATION.md`.
Herkunft und fachliche Anpassungen stehen in `docs/PROCESSING_PARITY.md`.

## Datenschutz und Lizenz

Kein Konto, Cloud-Dienst, OCR, Scanner, PDF, Server-KI, Werbung oder eigene Telemetrie.
Die Datenschutzerklärung ist in der App offline lesbar und steht in `PRIVACY.md`.
Exporte gehen nur auf ausdrückliche Nutzeraktion an den System-Dateidialog oder
eine ausgewählte andere App. Deren Datenverarbeitung bestimmt der jeweilige Anbieter.
Quellcode unter Mozilla Public License 2.0. Hinweise in `THIRD_PARTY_NOTICES.md`.
