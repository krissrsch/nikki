# Nikki

Notch-App für Windows mit Claude-Code-Begleiter: die kleine Katze oben am Bildschirmrand. Sie startet und begleitet Claude-Code-Aufgaben in deinem Projektordner über deine lokal eingeloggte **Claude Code**-CLI, **ohne API-Key**, und bringt dazu Notch-Module wie Kalender, To-do, Notizen und Timer mit.

Die Insel sitzt oben mittig. Zugeklappt zeigen Nikkis Augen, was los ist, und links und rechts steht das Wichtigste. Aufgeklappt gibt es Home („Heute“ mit Kacheln), den Chat und die Module.

## Was sie kann

- Claude Code starten, mit Live-Status, Schritten und Antworten in der Insel
- Berechtigungen, Fragen und Pläne beantworten (Erlauben / Immer / Ablehnen), auch für Claude-Code-Sessions im Terminal. Antwortest du nicht, entscheidet das Terminal
- Nachrichten an eine laufende Terminal-Session vormerken
- Projekte, Chats und Modelle pro Projekt; Dateien per Drag & Drop anhängen
- Module, in den Einstellungen einzeln schaltbar:
  - **Kalender:** lokal, mit Hinweis 15 Minuten vorher
  - **To-do:** mit „An Chat“
  - **Notizen:** Abreißblock
  - **Timer:** Pomodoro
- Hotkey frei belegbar, Autostart, Töne. Bei Spiel oder Video im Vollbild geht Nikki aus dem Weg

## Voraussetzung

- Windows 11
- Installiertes und eingeloggtes [Claude Code](https://claude.ai/code)
- Für Terminal-Sessions: Node.js

## Installieren

Installer von den [Releases](https://github.com/krissrsch/nikki/releases) laden: **Nikki-Setup.exe**.

Hotkey (Standard): `Ctrl+Alt+Space` (Fallback `Ctrl+Alt+K`), änderbar in den Einstellungen (Zahnrad in der Insel).

## Entwickeln

```bash
npm install
npm start
npm test
npm run e2e       # Playwright, isoliert (siehe e2e/README.md)
npm run dist      # baut Nikki-Setup.exe
npm run release   # Build + GitHub Release
```
