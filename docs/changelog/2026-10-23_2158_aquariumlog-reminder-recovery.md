# AquariumLog-Erinnerungen zuverlässig rückmelden

Ausgangsstand auf ausdrücklichen Wunsch mit leerem Commit `945b089` gesichert.
Die Arbeitskopie war vor der Bearbeitung sauber.

Löschwarnungen werden nach dem Entfernen eines Aquariums angezeigt. Beim
Zurückkehren zur App werden Erinnerungen erneut aus SQLite synchronisiert,
nach Abschluss laufender Speicher- und Löschvorgänge. Damit können nach einem
vorübergehenden Schnittstellenfehler zurückgebliebene Pläne entfernt werden.

Native Statusänderungen nach Zustellung, Planung und Bestätigung erreichen die
geöffnete Ansicht über ein Expo-Ereignis. Der interne Android-Empfänger wird
mit dem ersten Listener registriert und beim letzten Listener oder Modulende
abgemeldet. Die Rückmeldung zu erfolgreichen Test-Erinnerungen bleibt acht
Sekunden lesbar. Andere Standardmeldungen behalten vier Sekunden.

Prüfung: `npm run check` mit 61 Tests bestanden. `npm run check:native` mit
51 JVM-Tests und Android-Lint ohne Fehler bestanden. Neue Regressionstests
decken Löschfehler, Wiederholung nach App-Rückkehr, Reihenfolge mit Schreibvorgängen,
Live-Status, Listener-Lebensdauer und Anzeigedauer ab. README und VALIDATION ergänzt.

Wegen der nativen Änderung Dev-Preview gebaut und nach Paket- und Signaturprüfung
mit `adb install -r -t -g --no-streaming` aktualisiert. Paket
`com.appfactory.aquarium_log.dev`, Version 1.0.0, Code 1, nicht debuggable.
App-Prozess läuft ohne Fehler im gefilterten Startprotokoll. Zwei Alarme bei Android
vorhanden. Gerät gesperrt, deshalb keine visuelle Abnahme oder physische Alarmzustellung.
Genaue Alarme bleiben gesperrt und „Nicht stören“ aktiv. Keine Systemeinstellungen
geändert. MaschinenLog bleibt unverändert. Kein Push oder Store-Build.
