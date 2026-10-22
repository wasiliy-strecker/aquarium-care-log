# AquariumLog mit den bestehenden Log-Abläufen abgleichen

AquariumLog übernimmt die beauftragten Ergänzungen aus ModellbauLog und die
Datenschutzformulierungen aus MaschinenLog. Keine Mehrsprachigkeit, OCR oder
Scanner. Die Referenz-Apps bleiben unverändert.

Virtualisierte Übersicht, letztes verfügbares Eintragsfoto, PDF-Einzel- und
vollständige Pflegeverlaufsprotokolle mit geordneten Fotos, paginierte PDF-Listen,
native Vorschau mit Zoom, Teilen, Drucken und Löschen ergänzt. SQLite-Schema 2
bewahrt Altbestände. Neue Einträge halten Aquariumangaben und UTC-Versatz fest.

Backups enthalten unveränderte PDFs und bleiben mit alten `.aqbackup`-Dateien
kompatibel. Native SHA-256-/AES-GCM-Verarbeitung, Fortschrittsphasen, erneute
Dateiprüfung vor Übernahme und Reparatur passender fehlender Entwurfsfotos.
Asynchrone Verschiebe- und Kopieroperationen werden abgewartet.

Erinnerungsstatus, Systemzugänge, Testnavigation und Intervallgedächtnis folgen
der Referenz. Feldfehler, Tastaturvorschläge, Logoübergang, Dialogkonturen,
runde Hauptaktionen und rote Löschaktionen im Dunkelmodus ergänzt.
Eigene generierte Fotobeispiele, keine feste 200-Foto-Grenze.

Offline-Manifest-Overlays und Ausschlüsse für Android-Sicherung ergänzt.
Dev-Schlüssel liegt künftig außerhalb des Prebuild-Ordners. ARM64 ist Standard
für Smartphone-Builds. Private Store-Signierung und AAB-Prüfhelfer vorbereitet.
Keine APK/AAB paketiert, kein Schlüssel erzeugt, keine Installation und kein Push.

Deutsche und englische Datenschutzseiten mit MaschinenLog-Wording vorbereitet.
GitHub Pages liefert derzeit 404. Für die Veröffentlichung wurde der erforderliche
ausdrückliche Push-Auftrag angefragt. Der App-Quellcode bleibt lokal.

Prüfung: `npm run check` mit 51 Tests, 45 native JVM-Tests plus eigenem Lint,
Android-Metro-Export, neun Release-Helfer-Tests, Prebuild, drei zusammengeführte
Varianten-Manifeste und erwartete Ablehnung fehlender Store-Signierung.
Manuelle Android-Grenzen stehen in `aquariumlog/docs/VALIDATION.md`.
Allgemeine Abhängigkeitsupdates und vorgemerkte Play-Optimierungen bleiben offen.
