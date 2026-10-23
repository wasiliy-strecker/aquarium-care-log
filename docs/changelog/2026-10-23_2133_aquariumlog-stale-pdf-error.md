# Veraltete PDF-Fehlermeldung zurücksetzen

Der letzte Smartphone-Screenshot zeigt einen gespeicherten Pflegeeintrag und
darunter weiterhin die Fehlermeldung eines früheren PDF-Versuchs ohne Einträge.
Die PDF-Ansicht aktualisierte ihre Daten, behielt aber den alten Aktionsfehler.

Vorherige PDF-Aktionsfehler werden bei geänderten Daten und beim erneuten Öffnen
der Ansicht zurückgesetzt. Das gilt für Einzel- und Verlaufsprotokolle.
Neue Fehler bleiben sichtbar. Das Zurücksetzen ist unabhängig vom Laden und
Blättern der gespeicherten PDF-Liste.

Zwei gezielte Regressionstests reproduzieren den Fehler ohne die Korrektur.
Sie halten die Ansicht geöffnet, speichern den ersten Eintrag, simulieren
Datenaktualisierung beziehungsweise Rückkehr und prüfen anschließend auch
die erfolgreiche Erstellung eines PDF-Protokolls mit echter SQLite-Datenbank.
Der private Screenshot bleibt im ignorierten Build-Ordner.

Prüfung: `npm run check` erfolgreich mit Formatprüfung, ESLint ohne Warnungen,
TypeScript und 55 Tests. ARM64-Dev-APK erfolgreich gebaut und nach Prüfung von
Paket, Version, Debug-Flag, Installer und identischer Signatur datenbewahrend
auf dem HONOR aktualisiert. App gestartet, keine gemeldeten Startfehler.
Das Update enthält auch die bereits vorbereiteten Abstände der Fotohilfe.
Kein Store-Build und kein Push.
