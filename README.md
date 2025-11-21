# Leistungsnachweis

Eine schlanke, statische SPA für Volleyball-Trainer. Die App verbindet sich direkt aus dem Browser mit Supabase – ohne Build-Schritt, ohne ENV-Variablen. Einfach das Repo klonen und `index.html` im Browser öffnen (oder per GitHub Pages hosten).

## Supabase
- Projekt: `leistungsnachweis`
- Direkt eingebundener Client unter `src/state/supabaseClient.js` mit Projekt-URL und `anon`-Key.
- Authentifizierung: E-Mail + Passwort via Supabase Auth.
- Tabellen, die genutzt werden:
  - `trainers`: `id`, `name`, `email`, `hourly_rate`, `is_active`, `created_at`, `created_by`
  - `performance_entries`: `id`, `trainer_id`, `date`, `start_time`, `end_time`, `duration_minutes`, `activity`, `location`, `notes`, `hourly_rate`, `cost`, `created_at`, `created_by`

## Funktionen
- **Login/Registrierung** per Supabase Auth (E-Mail + Passwort).
- **Erfassung**: Datum, Trainer, Aktivität, Ort, Start/Ende, Stundensatz und Notizen. Dauer und Kosten werden automatisch berechnet und gespeichert.
- **Übersicht**: Monats- und Trainerfilter, Summen (Minuten, Stunden, Kosten) sowie eine Tabelle mit allen Einträgen. Einträge können gelöscht werden.
- **Trainerverwaltung**: Trainer anlegen/ändern, Stundensatz pflegen und Trainer aktiv/inaktiv schalten. Aktive Trainer stehen im Erfassungsformular zur Auswahl.
- **PWA-ready**: Manifest & Service Worker sind enthalten, sodass die Seite als App installiert werden kann.

## Nutzung
1. Repo klonen oder als GitHub Pages hosten.
2. `index.html` im Browser öffnen. Es wird automatisch der Supabase-Client geladen.
3. Mit bestehendem Supabase-Account anmelden oder ein neues Konto erstellen.
4. Trainer anlegen und anschließend Leistungsnachweise erfassen.
5. Die Daten sind in Supabase gespeichert und für alle eingeloggten Nutzer sichtbar.

## Anpassungen
- Supabase-URL oder -Key anpassen? → `src/state/supabaseClient.js`
- Styling anpassen? → `assets/css/styles.css`
- Frontend-Logik erweitern? → `src/main.js`
