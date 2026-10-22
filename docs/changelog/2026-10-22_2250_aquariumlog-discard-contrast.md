# Lesbarkeit der Verwerfen-Schaltfläche korrigieren

Den letzten AquariumLog-Screenshot vom Smartphone geprüft. Im Dunkelmodus
stand bei „Eingaben verwerfen“ dunkle Schrift auf einem dunkelroten Hintergrund.
Gefüllte Dialogaktionen und normale Löschbuttons verwenden jetzt die passenden
Farben `destructive` und `onDestructive`. Dadurch ist auch die
bisherige Kombination aus weißer Schrift und hellrotem Hintergrund im Hellmodus
korrigiert. Texte und Bedienabläufe bleiben gleich.

Rechnerischer Textkontrast: Hellmodus 6,46:1, Dunkelmodus 6,21:1.
`npm run check` erfolgreich mit Prettier, ESLint, TypeScript und 51 Tests.
Der private Screenshot bleibt im ignorierten Build-Verzeichnis.

Die installierte Dev-Release-Version enthält JavaScript fest in der APK.
Deshalb ARM64-APK neu gebaut und mit dem geprüften Helfer datenbewahrend
aktualisiert. Paket, Version und identische Signatur bestätigt. Build und
Installation erfolgreich. App gestartet, Prozess ohne gemeldeten Startfehler.
Das Smartphone war gesperrt, daher keine visuelle Nachprüfung am Gerät.
Keine Datenlöschung, kein Store-Build und kein Push.

Manuelle Nachprüfung: Bei geänderten Aquarium-Eingaben zurückgehen und
„Eingaben verwerfen“ im Hell- und Dunkelmodus auf Lesbarkeit prüfen.
„Weiter bearbeiten“ schließt den Dialog, ohne Eingaben zu verwerfen.
