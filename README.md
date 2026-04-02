# ClawNote

KI-gestützte Notiz- und Todo-Lösung für OpenClaw.

## Ziel

ClawNote kombiniert eine kleine Weboberfläche für Notizen und Aufgaben mit einer KI-Schicht über OpenClaw. Die App soll Notizen erfassen, strukturieren, kategorisieren, priorisieren und in Workspaces sowie Ordner einordnen.

## Geplante Architektur

- Frontend: React + Vite + TypeScript
- Backend: Fastify + TypeScript
- Datenhaltung: SQLite
- KI-Schicht: OpenClaw für Vorschläge und Strukturierung

## Grundprinzipien

- Checkboxen, Status und Persistenz bleiben deterministisch.
- OpenClaw macht Vorschläge, übernimmt aber nicht eigenmächtig die Datenhaltung.
- Workspaces und Ordner strukturieren den Kontext.
- Kategorien bleiben kontrolliert, Tags flexibel.
