# Nikki

Notch-Companion für Windows: startet und begleitet Agent-Aufgaben in einem Projektordner — über deine lokal eingeloggte **Claude Code**- oder **Cursor**-CLI, ohne API-Key.

Die Insel sitzt oben mittig auf dem Bildschirm. Beim Start begrüßt Nikki dich kurz (Insel weitet sich, sie springt rein und winkt). Zugeklappt siehst du auf einen Blick, was läuft; aufgeklappt promptest du, wählst Agent und Modell, genehmigst Tools und liest die Antwort.

## Was sie kann

- Aufgaben starten (Claude Code via Agent SDK, Cursor via ACP, optional Gemini CLI / AI Studio)
- Live-Status und Schritte aus Tool-Aufrufen
- Berechtigungen und Agent-Fragen direkt in der Insel beantworten
- Projektordner merken, Session fortsetzen, Dateien per Drop anhängen
- Optional: Terminal-/IDE-Sessions nur beobachten (Hooks), ohne deren Freigaben zu übernehmen

## Voraussetzung

- Windows 11
- Installiertes und eingeloggtes [Claude Code](https://claude.ai/code) und/oder [Cursor](https://cursor.com) CLI (`agent login`)

## Installieren

Installer von den [Releases](https://github.com/krissrsch/nikki/releases) laden: **Nikki-Setup.exe**.

Hotkey (Standard): `Ctrl+Alt+Space` (Fallback `Ctrl+Alt+K`). Weitere Optionen im Tray-Menü.

## Entwickeln

```bash
npm install
npm start
npm test
npm run dist      # baut Nikki-Setup.exe
npm run release   # Build + GitHub Release
```
