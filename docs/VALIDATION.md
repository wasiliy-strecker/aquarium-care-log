# Prüfung AquariumLog

## Erinnerungskorrekturen vom 23. Oktober 2026

Ausgangsstand vor der Bearbeitung mit dem angeforderten leeren Commit `945b089`
gesichert. Die Arbeitskopie war bereits sauber.

`npm run check` erfolgreich mit 61 Tests in 14 Dateien. Formatprüfung, ESLint
und TypeScript bestanden. Neue Regressionstests prüfen die sichtbare Warnung nach
erfolgreicher Aquariumlöschung bei fehlgeschlagener Erinnerungsaktualisierung,
die Wiederholung beim Zurückkehren zur App und deren Reihenfolge nach wartenden
Datenbankänderungen. Ein Datenbankfehler lässt Aquarium und Erinnerungsplan bestehen.
Die Tests verwenden ausschließlich synthetische Daten und echte temporäre SQLite-Dateien.

Die Statusansicht reagiert auf native Änderungen ohne erneute Navigation und
entfernt ihre Listener beim Verlassen. Veraltete Antworten überschreiben weiterhin
keinen neueren Status. Tests prüfen außerdem acht Sekunden Anzeigezeit für eine
erfolgreiche Testmeldung und vier Sekunden für die Standard-Snackbar.

`npm run check:native` erfolgreich mit 51 JVM-Tests und Android-Lint ohne Fehler.
Die neuen Observer-Tests prüfen Registrierung, Abmeldung und erneute Registrierung
sowie den aktualisierten Status nach einer echten Receiver-Ausführung in Robolectric
auf API 24, 25 und 35. AndroidX-Signaturrechte werden aus dem zusammengeführten
Testmanifest geprüft und für Robolectric ausdrücklich freigegeben.

Eine tatsächliche Alarmzustellung, Ton und Banner auf physischer Hardware bleiben
separat zu prüfen. Die automatisierten Tests ändern keine Smartphone-Daten oder
Systemeinstellungen.

`npm run build:preview` erfolgreich in 57 Sekunden. Wegen der neuen nativen
Statusweiterleitung ist ein APK-Update erforderlich. Die vorhandene Dev-Preview
wurde über `npm run install:preview` datenbewahrend aktualisiert. Paket
`com.appfactory.aquarium_log.dev`, Version 1.0.0, Code 1, nicht debuggable,
Installer `null`. Die Signatur stimmte mit der installierten App überein.

MainActivity gestartet und laufender Prozess bestätigt. Im gefilterten
Prozessprotokoll keine AndroidRuntime-, ReactNativeJS- oder ExpoModulesCore-Fehler.
Android führt weiterhin zwei AquariumLog-Alarme. Das Gerät zeigte AOD/Sperrbildschirm,
deshalb keine visuelle Abnahme. Die genaue Alarmfreigabe bleibt gesperrt und
„Nicht stören“ aktiv. Diese Systemeinstellungen wurden nicht verändert.

## Frühere Abnahme vom 22. Oktober 2026

Stand: 22. Oktober 2026. Abgleich mit ModellbauLog und Datenschutz nach MaschinenLog,
ohne Mehrsprachigkeit. Anschließend die Dev-APK auf ausdrücklichen Auftrag gebaut
und auf dem angeschlossenen Smartphone installiert. Keine Store-AAB gebaut.

## Ausgeführte Prüfungen

`npm run check` erfolgreich. Prettier, ESLint ohne Warnungen, strikte TypeScript-
Prüfung und 51 Tests in 12 Dateien bestanden. Laufzeit der Tests etwa 13 Sekunden.

Die Tests verwenden echte SQLite-Dateien, synthetische Fotos und PDF-Dateien.
Geprüft sind insbesondere:

- Migration von Schema 1 ohne erfundene Erfassungsdaten und ohne Entwurfsverlust.
- Letztes bebildertes Pflegeereignis unabhängig vom neuesten Eintrag und der
  Zehner-Vorschau. Fotoauswahl folgt Sortierung, Bearbeitung und Löschung.
- Vollständiger PDF-Verlauf mit zwölf Einträgen, Messgröße, Wert, Einheit, Notizen
  und allen Fotos in gespeicherter Reihenfolge. Einzelprotokolle enthalten nur
  ihren Eintrag. Lange Notizen umbrechen, Fotos bleiben innerhalb der Seite.
- Getrennte Einzel-/Verlaufslisten, zehn beziehungsweise elf gespeicherte PDFs,
  Seitenwechsel und Löschen des letzten Dokuments einer Seite.
- Öffnen, Teilen und Drucken referenzieren die unveränderte gespeicherte PDF.
  Manipulierte Dateien werden vor dem Aufruf des nativen Ports abgewiesen.
- Ein echtes altes `.aqbackup` aus Commit `33058c7` bleibt lesbar. Die Expo-Crypto-
  Wrapper werden gegen unabhängige OpenSSL-Implementierungen geprüft.
  Jede Datei wird beim Export einmal gelesen und gehasht. Fortschrittsphasen,
  falsche Passwörter, Dateimanipulation und Schreibfehler sind abgedeckt.
- PDFs und Erfassungsangaben überstehen Backups. Neuere lokale Einträge und
  Entwürfe bleiben erhalten. Passende fehlende Entwurfsfotos werden repariert.
- Verzögertes Verschieben und Kopieren wird vor Folgeaktionen abgewartet.
- Feldfehler, optionale Werte, Nullmessung, mehr als 200 Fotos und eigene Aktivitäten.
- Platzierung der Vorschläge ober-/unterhalb des Felds bei geöffneter Tastatur.
- Erinnerungsarten, Systemziele, konkrete Aquarium-Testbenachrichtigung,
  Intervallgedächtnis und Abweisung veralteter Statusantworten.

`npm run check:native` erfolgreich. 45 JVM-Tests sowie Android-Lint des eigenen
Moduls bestanden. Geprüft sind Dateizugriff, vollständige JPEG-Dateien,
PDF-Zugriff, Erinnerungen auf API 24, 25 und 35, Einstellungen, eigene Farbe,
Kennungen und Aquarium-Navigation. Der Helfer überspringt C++-Builds, die für
JVM-Tests nicht benötigt werden, sowie wie in der Basis den Lint der beiden
betroffenen Abhängigkeiten. Der eigene Kotlin-Code wird kompiliert.

`npx expo export --platform android --output-dir build/metro-check` erfolgreich.
Metro löst 2210 Module und 36 Assets einschließlich Logo, Fotobeispielen und
PDF-Schriften auf. Das prüft JavaScript und Assets, nicht die tatsächliche Anzeige.

`npm run prebuild` erfolgreich. Zusätzlich die drei App-Manifeste zusammengeführt:
`:app:processDevDebugMainManifest`, `:app:processDevReleaseMainManifest` und
`:app:processStoreReleaseMainManifest`. Dev- und Store-Kennungen sind korrekt.
Nur Dev Debug enthält Internetzugriff. Store und Dev Release enthalten weder
Internet- noch Netzwerkstatusberechtigung. Alle drei Varianten schließen
Android-Cloud-Backup und Geräteübertragung aus. Die Gradle-Abhängigkeiten erzeugen
dabei auch JavaScript-Assets. Es wird keine APK/AAB paketiert oder signiert.

`npm run check:store` erfolgreich mit neun Tests für Netzwerkrechte und native
16-KB-Ausrichtung. Shellsyntax und Expo-Plugin-Syntax geprüft.
`:app:verifyStoreSigning` mit absichtlich fehlender Konfiguration bricht mit
dem erwarteten Hinweis auf private Store-Signierung ab. Kein Upload-Schlüssel
wurde erzeugt. Der Auslieferungshelfer ist vorbereitet, ein tatsächliches AAB
wird erst bei einem gesonderten Release-Auftrag geprüft.

Die Datenschutzseiten wurden gegen MaschinenLog verglichen. Relative Links
und lokale CSS-Datei sind gültig, keine externen Skripte oder Schriften.
Die Veröffentlichung auf GitHub Pages benötigt noch den ausdrücklichen
Push-Auftrag. Der App-Link zeigt bereits auf die eigene vorgesehene Adresse.

Die Referenz-Apps wurden nicht verändert. Keine allgemeinen Abhängigkeitsupdates.
Nur die benötigten PDF-Pakete und React-Test-Renderer wurden ergänzt.

## Kurze manuelle Android-Abnahme

Am 22. Oktober 2026 wurde Quellstand `a46cc8a` mit `npm run build:preview`
für ARM64 gebaut. Gradle erfolgreich in 2 Minuten 10 Sekunden. Die eigenständige
Dev-APK enthält JavaScript und läuft ohne Metro. Version 1.0.0, Code 1,
Paket `com.appfactory.aquarium_log.dev`, Label `AquariumLog Dev`, nicht debuggable.
Der eigene Dev-Schlüssel liegt im ignorierten `.local/dev.keystore`.

Installation auf HONOR BVL-N49 mit Android 16 über `npm run install:preview`
erfolgreich. Zuvor war keine AquariumLog-App installiert. Keine Deinstallation
oder Datenlöschung. Der Helfer prüft Paket und Build-Art und verwendet
`adb install -r -t -g --no-streaming`. Installer nach Installation: `null`.
Android bestätigt die gestartete MainActivity und einen laufenden Prozess.
Im gefilterten Prozessprotokoll keine AndroidRuntime-, ReactNative- oder
ReactNativeJS-Fehler. Der UI-Abzug zeigt den Sperrbildschirm. Die tatsächliche
App-Anzeige wurde deshalb nicht bestätigt.

Die folgenden fachlichen Geräteschritte stehen weiterhin aus. Der benötigte
aktuelle Dev-Build ist jetzt installiert.

1. Hell-/Dunkelmodus, Logoübergang, Kartenfotos und virtuelle Übersicht prüfen.
2. Ungültige Namen, Volumen und Messwerte speichern. Feldmarkierung und Scrollen
   zum ersten Fehler prüfen. Vorschläge bei geöffneter Tastatur scrollen und wählen.
3. Fotobeispiele öffnen. Mehrere eigene Fotos aufnehmen, auswählen, ersetzen,
   sortieren und entfernen. Entwurf nach unterbrochener Fotoauswahl fortsetzen.
4. Einzel- und Verlaufs-PDF mit und ohne Fotos erstellen. Native Vorschau zoomen,
   Seiten wechseln, teilen, drucken und gespeicherte Protokolle löschen.
5. Aquariumdaten ändern und ursprüngliche Erfassungsangaben kontrollieren.
   Backup im Systemdialog speichern, teilen und mit Passwort wiederherstellen.
6. Normal-/Ton-Erinnerungen mit App-/Kanalsperre, „Nicht stören“ und fehlenden
   genauen Alarmen prüfen. Testbenachrichtigung muss das konkrete Aquarium öffnen.
7. Nach Veröffentlichung den Datenschutzbutton im externen Browser öffnen.

Kamera, tatsächlicher Prozessverlust, Druckdienst und Benachrichtigungszustellung
auf physischer Hardware sind damit ausdrücklich noch nicht bestätigt.
Keine aufwendige visuelle Testreihe.
