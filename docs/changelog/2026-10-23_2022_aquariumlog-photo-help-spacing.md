# Abstände der Fotohilfe angleichen

Letzten Screenshot vom Smartphone geprüft. „Fotohinweise“ und „Beispiele ansehen“
stehen nun in einer gemeinsamen Gruppe ohne zusätzlichen Zwischenraum.
Die Gruppe hat oben und unten jeweils 8 Punkte Innenabstand. Der zusätzliche
Innenabstand um „Beispiele ansehen“ entfällt. So entsprechen die sichtbaren
Abstände zwischen den Textaktionen den Abständen zur Hinweisbox und zum
Button „Ohne Foto erfassen“. Die vollständigen Tippflächen bleiben erhalten.

Manuelle Nachprüfung: „Eintrag erfassen“ öffnen und die drei sichtbaren
Zwischenräume vergleichen. Fotohinweise und Beispielgalerie öffnen und schließen.
Der private Screenshot bleibt im ignorierten Build-Ordner.

Prüfung: `npm run check` mit Formatprüfung, ESLint, TypeScript und 53 Tests
erfolgreich. Die eigenständige ARM64-Dev-APK mit eingebettetem JavaScript wurde
erfolgreich gebaut. Das Smartphone wurde während der Arbeit getrennt und ist
weiterhin nicht per ADB erreichbar. Installation und visuelle Nachprüfung am
Gerät stehen deshalb aus. Kein Store-Build und kein Push.
