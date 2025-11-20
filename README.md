# Leistungsnachweis Volleyball

Eine schlanke Web-App/PWA für Volleyball-Trainer, um Trainings- und Einsatzzeiten zu erfassen, Monatsübersichten zu erstellen und Daten als CSV zu exportieren. Alle Daten bleiben ausschließlich im Browser (localStorage) – kein Login und kein Server notwendig.

## Features
- **Erfassung**: Datum, Start-/Endzeit, Trainer, Mannschaft, Art (Training/Spiel/Turnier/Sonstiges) und Notizen.
- **Übersicht**: Monatsfilter mit Summenansicht und Aufschlüsselung pro Trainer.
- **CSV-Export**: Gefilterte Monatsdaten als Excel-lesbare CSV-Datei herunterladen.
- **Einstellungen**: Trainer- und Mannschaftslisten verwalten (Hinzufügen/Löschen).
- **Offline & PWA**: Manifest und Service Worker für Installation und Offline-Start.

## Nutzung
1. **Trainer und Mannschaften anlegen**: Unter „Einstellungen“ neue Trainer/Mannschaften hinzufügen (Demo-Daten sind initial vorhanden).
2. **Einträge erfassen**: In „Erfassung“ Datum, Zeiten, Trainer, Mannschaft und Art auswählen, optional Notizen hinzufügen und speichern.
3. **Monatsübersicht prüfen**: In „Übersicht“ Monat/Jahr sowie Trainer- und Mannschaftsfilter wählen. Tabelle und Summen aktualisieren sich automatisch.
4. **CSV exportieren**: Über „Export als Datei“ die gefilterten Einträge als `leistungsnachweis_YYYY-MM.csv` herunterladen.
5. **PWA installieren**: Seite im Browser öffnen und „Zum Startbildschirm hinzufügen“ nutzen, um die App zu installieren.

## Entwicklung & Hinweise
- Technologie: Reines HTML/CSS/JavaScript, keine Frameworks; Datenpersistenz in `localStorage`.
- PWA: Service Worker cached die Kern-Assets (cache-first), sodass die App offline starten kann. Eingaben bleiben lokal verfügbar.
- Icons: Platzhalter-SVGs liegen unter `assets/icons/` und sind im Manifest referenziert.

Viel Erfolg beim Erfassen der Trainingszeiten!
