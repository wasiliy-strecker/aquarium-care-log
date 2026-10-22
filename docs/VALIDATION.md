# Prüfung AquariumLog

Stand: 22. Oktober 2026. Abgleich mit ModellbauLog und Datenschutz nach MaschinenLog,
ohne Mehrsprachigkeit. Keine APK oder AAB gebaut und keine Geräteinstallation.

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

Diese Geräteschritte stehen noch aus. Wegen des neuen nativen PDF-Moduls und
der Android-Konfiguration wird dafür ein aktualisierter Dev-Build benötigt.

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
