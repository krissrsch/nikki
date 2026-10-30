# Nikki

Notch-App für Windows mit Claude-Code-Begleiter: die kleine Katze oben am Bildschirmrand. Sie startet und begleitet Claude-Code-Aufgaben in deinem Projektordner über deine lokal eingeloggte **Claude Code**-CLI, **ohne API-Key**, und bringt dazu Notch-Module wie Kalender, To-do, Notizen und Timer mit.

Die Insel sitzt oben mittig. Zugeklappt zeigt sie nur Nikkis Augen; was los ist, zeigt eine schmale Lichtkante um die Notch (gelb: braucht dich, grün: arbeitet oder fertig, rot: Fehler, blau: Musik), bei Musik wächst ein Spektrum aus echten Frequenzen unter der Notch. Aufgeklappt gibt es Home („Heute“: Claude, Musik, Wetter, Kalender), den Chat und die Module.

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
- Wetter auf Home von Open-Meteo (ohne Konto), Stadt in den Einstellungen
- Nikki, die weiß getigerte Katze: lebt in der Insel, hat 19 Ausdrücke, reagiert auf Claude und Musik, springt beim Tabwechsel mit und lässt sich an jeden Platz ziehen
- Eigenes Einstellungsfenster mit Seitenleiste (Zahnrad in der Insel oder Tray)
- Hotkey frei belegbar, Autostart, Töne, Leuchten an/aus und Stärke. Bei Spiel oder Video im Vollbild geht Nikki aus dem Weg

## Voraussetzung

- Windows 11
- Installiertes und eingeloggtes [Claude Code](https://claude.ai/code)
- Für Terminal-Sessions: Node.js

## Installieren

Installer von den [Releases](https://github.com/krissrsch/nikki/releases) laden: **Nikki-Setup.exe**.

Hotkey (Standard): `Ctrl+Alt+Space` (Fallback `Ctrl+Alt+K`), änderbar in den Einstellungen unter Tastenkürzel.

## Entwickeln

```bash
npm install
npm start
npm test
npm run e2e       # Playwright, isoliert (siehe e2e/README.md)
npm run dist      # baut Nikki-Setup.exe
npm run release   # Build + GitHub Release
```
