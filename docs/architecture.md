# ClawNote Architektur

## Zielbild

ClawNote ist eine lokale, KI-gestützte Notiz- und Todo-Lösung mit klarer Trennung zwischen deterministischer Datenhaltung und KI-Vorschlagslogik.

## Komponenten

### Frontend
- React
- Vite
- TypeScript
- Sidebar mit Workspaces, Ordnern und Ansichten
- Taskliste mit Checkboxen
- Inbox-Schnellerfassung

### Backend
- Fastify
- TypeScript
- REST-API für Workspaces, Ordner, Kategorien und Tasks
- Vermittlung zwischen UI, SQLite und OpenClaw

### Datenhaltung
- SQLite
- strukturierte Tabellen für Workspaces, Ordner, Kategorien, Tasks, Tags

### KI-Schicht
- OpenClaw für Strukturierung, Kategorisierung, Priorisierung und Vorschläge
- keine direkte Hoheit über Status, Checkboxen oder Löschvorgänge

## Grundregeln

- Workspaces sind manuell und stabil.
- Ordner können vorgeschlagen, aber nicht beliebig automatisch erzeugt werden.
- Kategorien bleiben kontrolliert.
- Tags dürfen flexibel sein.
- Die Datenbank ist die Quelle der Wahrheit.
- OpenClaw liefert nur Vorschläge oder strukturierte Rückgaben.
