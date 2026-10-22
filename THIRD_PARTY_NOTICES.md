# Herkunft und Lizenzen

AquariumLog ist eine eigenständige app-lokale Umsetzung von Wasiliy Strecker.
Architektur und geeignete Bausteine stammen aus Hausakte, Stand
`dfd6fc8`. Bildschirmaufbau und Pflegeabläufe orientieren sich an Mein Pflanzenbuch,
Stand `7deef38`. Beide Vorlagen wurden nicht verändert. Es gibt keine gemeinsame
Runtime-Bibliothek und keine Übernahme fremder Signierschlüssel oder Nutzerdaten.
Die Ergänzungen vom 22. Oktober 2026 verwenden app-lokale Bausteine aus
ModellbauLog, Stand `f996c87`. Datenschutztexte folgen MaschinenLog.

React Native, React, Expo, Expo Router und ihre Abhängigkeiten werden in den
Versionen des Lockfiles eingebunden. Die jeweiligen Lizenzen liegen in den
installierten Paketen. Noble Ciphers und Noble Hashes liefern die kryptografischen
Primitive für Kompatibilitätstests. Die App verwendet die nativen Expo-Crypto-
Funktionen für SHA-256 und AES-GCM sowie native PBKDF2-Ableitung.
Es wird keine eigene Verschlüsselungsprimitive implementiert.
PDF-lib und PDF-lib Fontkit erzeugen PDF-Protokolle und binden die lokalen
Schriftdateien ein. Beide Pakete verwenden die MIT-Lizenz.

Roboto und MaterialIcons werden app-lokal aus der Hausakte-Basis übernommen.
Die Schriftlizenzen stehen unter `assets/ui/`. Die Aquarium-Vektormotive sind
app-eigene Zeichnungen. Das synthetische Foto enthält keine personenbezogenen Daten.
Die mit OpenAI Imagegen erstellten Fotobeispiele und ihre Prompts sind in
`assets/photo-examples/README.md` dokumentiert.
