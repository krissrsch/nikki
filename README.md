# Nikki

Notch-Companion für Windows: die kleine Katze oben am Bildschirmrand, die Agent-Aufgaben in deinem Projektordner startet und begleitet — über deine lokal eingeloggte **Claude Code**- oder **Cursor**-CLI, **ohne API-Key**.

Die Insel sitzt oben mittig. Beim Start öffnet sie sich, Nikki spawnt mit kurzem Miau, setzt sich ins Home-Menü, und die Agenten-Auswahl erscheint. Zugeklappt siehst du auf einen Blick, was läuft; aufgeklappt promptest du, wählst Agent und Modell, genehmigst Tools und liest die Antwort.

## Was sie kann

- **Claude Code**, **Cursor** (ACP) und optional **Gemini CLI / AI Studio** ansteuern
- Live-Status, Schritte und Streaming-Antworten in der Insel
- Berechtigungen, Agent-Fragen und Pläne direkt beantworten (Allow / Always / Deny)
- Projektordner merken, Chats fortsetzen, Dateien per Drag & Drop anhängen
- Modelle und Favoriten pro Backend wählen
- Optional Terminal-/IDE-Sessions nur beobachten (Hooks), ohne deren Freigaben zu übernehmen
- Tray, Hotkey und Fullscreen-Erkennung: aus dem Weg, wenn ein Spiel oder Video den Screen nimmt — beim Start bleibt das Intro trotzdem sichtbar

## Voraussetzung

- Windows 11
- Installiertes und eingeloggtes [Claude Code](https://claude.ai/code) und/oder [Cursor](https://cursor.com) CLI (`agent login`)

## Installieren

Installer von den [Releases](https://github.com/krissrsch/nikki/releases) laden: **Nikki-Setup.exe**.

Hotkey (Standard): `Ctrl+Alt+Space` (Fallback `Ctrl+Alt+K`). Weitere Optionen im Tray-Menü (Töne, Hooks, Ein-/Ausblenden).

## Entwickeln

```bash
npm install
npm start
npm test
npm run dist      # baut Nikki-Setup.exe
npm run release   # Build + GitHub Release
```
