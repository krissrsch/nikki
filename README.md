# Nikki

[![test](https://github.com/krissrsch/nikki/actions/workflows/test.yml/badge.svg)](https://github.com/krissrsch/nikki/actions/workflows/test.yml)
![Windows 11](https://img.shields.io/badge/Windows-11-0078D4)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

A notch for Windows 11 that runs Claude Code. Nikki sits at the top center of the screen, starts Claude Code tasks in a project folder through your logged-in Claude Code CLI (no API key), and lets you approve its tool calls without switching windows. Around that she has the usual notch things: music, calendar, to-dos, notes, a timer, a file shelf and your Windows notifications.

The cat is drawn after my real cat Nikki.

**[Download Nikki-Setup.exe](https://github.com/krissrsch/nikki/releases)** · The UI is in German.

![Home with Claude, music with the current lyric line, weather and calendar](docs/screenshots/home.png)

## What it does

| | |
|---|---|
| **Claude Code** | Start tasks per project, see live status and steps, answer permission requests (Allow / Always / Deny), questions and plans. Works for Claude Code sessions in your terminal too, through hooks. Plan limits shown as two rings. |
| **Closed notch** | Only Nikki's eyes. A thin light edge says what is going on: yellow needs you, green works or is done, red error, the cover's colour for music, a white sweep for a new notification. A spectrum from the real audio grows under the notch. |
| **Music** | Whatever Windows plays (Spotify, browser, …): cover, controls, volume, and the line being sung (synced lyrics from [LRCLIB](https://lrclib.net), off by default). |
| **Mitteilungen** | Notifications from other apps, collected in the island. Off by default, kept in memory only. |
| **Modules** | Calendar with reminders, to-do, notes, Pomodoro timer, file shelf, clipboard history, Discord voice channel. Each one can be switched off. |
| **Voice** | Hold a key and speak, recognised locally with whisper.cpp. "Hey Nikki, …" sends it to Claude. |

<p>
  <img src="docs/screenshots/permission.png" alt="Claude asks to run npm test; Allow, Always, Deny" width="49%" />
  <img src="docs/screenshots/notifications.png" alt="Two notifications from Outlook and Teams in the island" width="49%" />
</p>

![Music page with cover, the current lyric line and volume](docs/screenshots/music.png)

## How it works

```
 ┌───────────────────────── Electron ─────────────────────────┐
 │  renderer/ (island, modules)  ⇄  preload.cjs  ⇄  main.js   │
 └──────────────────────────────────────┬──────────┬──────────┘
                                        │          │
             Claude Agent SDK ──────────┘          └──── helper/NikkiHelper.exe (C#)
             └ logged-in claude.exe                     JSON lines over stdin/stdout:
                                                        media (SMTC), volume, audio spectrum
 Claude Code in a terminal                              (WASAPI loopback), notifications,
   └ hook.cjs ── local HTTP ──► main.js                 push-to-talk, window focus
```

- **main.js** owns all state, files and network. The renderer only gets what it needs through `preload.cjs`; module ids are checked before they turn into file names.
- **backends/claude.js** runs one task at a time through `@anthropic-ai/claude-agent-sdk` and turns its stream into a status and a step list (`lib/status.js`).
- **helper/NikkiHelper.cs** is a small C# program built with the compiler that ships with Windows (`helper/build.cmd`), for the Windows APIs Node cannot reach.
- **hook.cjs** is what Claude Code calls for terminal sessions. It posts the event to Nikki and, for permissions, waits for the answer from the island.
- Pure logic lives in `lib/` and the top of each renderer module, with unit tests next to it. `e2e/` drives the real app with Playwright in a temp profile, offline.

## Build

Needs Windows 11, Node.js 24 and an installed, logged-in [Claude Code](https://claude.ai/code).

```bash
npm install
npm start
npm test                 # unit tests, also run in CI
npm run e2e              # Playwright against the real app, isolated (see e2e/README.md)
node e2e/screenshots.js  # the screenshots above, with demo data
npm run dist             # builds Nikki-Setup.exe
```

Default hotkey: `Ctrl+Alt+Space` (fallback `Ctrl+Alt+K`), changeable in the settings.

---

## Deutsch

Notch-App für Windows mit Claude-Code-Begleiter: die kleine Katze oben am Bildschirmrand. Sie startet und begleitet Claude-Code-Aufgaben in deinem Projektordner über deine lokal eingeloggte **Claude Code**-CLI, **ohne API-Key**, und bringt dazu Notch-Module wie Kalender, To-do, Notizen und Timer mit.

Zugeklappt zeigt die Insel nur Nikkis Augen. Was los ist, zeigt eine schmale Lichtkante um die Notch: gelb braucht dich, grün arbeitet oder ist fertig, rot ist ein Fehler, bei Musik leuchtet sie in der Farbe des Covers, und eine neue Mitteilung streift einmal weiß darüber. Aufgeklappt gibt es Home („Heute“: Claude, Musik, Wetter, Kalender), den Chat und die Module.

- Claude Code starten, mit Live-Status, Schritten und Antworten in der Insel
- Berechtigungen, Fragen und Pläne beantworten (Erlauben / Immer / Ablehnen), auch für Claude-Code-Sessions im Terminal
- Claude-Kachel mit 5-Stunden- und Wochenlimit als Ringe
- Musik mit Cover, Steuerung, Lautstärke und der gerade gesungenen Zeile (Songtexte von lrclib.net, standardmäßig aus)
- Mitteilungen anderer Apps in der Insel (standardmäßig aus, nur im Speicher)
- Module: Kalender, To-do, Notizen, Timer, Ablage, Zwischenablage, Discord, einzeln schaltbar
- Spracheingabe, lokal erkannt. Befehle beginnen mit „Hey Nikki“
- Bei Spiel oder Video im Vollbild geht Nikki aus dem Weg

Voraussetzung: Windows 11 und ein installiertes, eingeloggtes Claude Code. Installer: **Nikki-Setup.exe** unter [Releases](https://github.com/krissrsch/nikki/releases).

## License

[MIT](LICENSE)
