# Herkunft und Bedienabläufe AquariumLog

Technische Basis: Hausakte, Commit `dfd6fc8`.
Fachliche und visuelle Bedienreferenz: Mein Pflanzenbuch im Workspace-Verzeichnis
`pflanzenbuch`, Commit `7deef38`. Beide Quell-Repositories bleiben unverändert.

Die Übersicht, Detailseite, zehn Einträge als Verlaufsvorschau, vollständiger
Pflegeverlauf, Erfassungswahl, Bearbeitung, Fotoansicht, Sortierung, Dialoge und
Erinnerungsstatus folgen den vorhandenen Abläufen. Der Stil verwendet eigene
Petrol- und Türkistöne, passende Texte, ein Aquarium-Icon und System-Hell/Dunkelmodus.

Stammdaten sind Name, optionales Liter-Volumen, freie Maße und Standort.
Die bisherige optionale Pflanzenhöhe wird zu einer frei benannten Dezimalmessung
mit optionaler Einheit. Es gibt keine Zwangseinheit und keinen erfundenen Nullwert.
Messvergleiche benötigen unmittelbar benachbarte Einträge gleicher Messgröße und Einheit.
Hausfelder, Kosten, Dienstleister und Pflanzenkategorien entfallen.

Die SQLite- und Fotoverarbeitung stammen aus Hausakte. Formularentwürfe schützen
Foto- und Messfelder vor externen Aufrufen. Ersetzen hält seine Position auch nach
einem unterbrochenen Galerieaufruf. Abbruch und Speicherfehler dürfen bereits
referenzierte Dateien nicht entfernen. Keine neuen Revisionen.

Eine optionale allgemeine Pflegeerinnerung je Aquarium mit den vorhandenen
Intervallen und Zustellarten. Keine Empfehlungen und keine automatische Bewertung
von Wasserwerten. Backups erhalten die Verschlüsselung und Zusammenführungslogik
mit eigenen App-Kennungen. Formularentwürfe gehören nicht zum Backup.

Der Abgleich vom 22. Oktober 2026 übernimmt die app-lokalen PDF-, Backup-,
Erinnerungs- und Oberflächenbausteine aus ModellbauLog, Stand `f996c87`.
Die Aquarium-Fachregeln, eigenen Kennungen, Benachrichtigungskanäle und
Petrol-/Türkisfarben bleiben erhalten. Dokumentenscanner, OCR, Modelltypen
und Mehrsprachigkeit werden nicht übernommen.

Die Datenschutztexte folgen MaschinenLog. Nur App-Name, Felder und tatsächlich
vorhandene Funktionen wurden angepasst. Die Fotobeispiele sind eigene generierte
Aquarienbilder. Sie gehören weder zu Nutzerdaten noch zu Backups.

Keine Datenmigration aus Hausakte oder Pflanzenbuch. AquariumLog beginnt mit eigener
Datenbank und eigenen Android-Kennungen. Das bisherige AquariumLog-Schema 1
wird auf Schema 2 mit gespeicherten PDF-Protokollen migriert.
Vorhandene Einträge und Entwürfe bleiben erhalten. Unbekannte frühere
Aquariumangaben und UTC-Versätze werden nicht rückwirkend ergänzt.
