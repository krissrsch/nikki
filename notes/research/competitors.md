# Wettbewerber: Notch-/Dynamic-Island-Tools und KI-Agent-Companions

Stand: 2026-10-30. Quellen sind offizielle Websites, GitHub-READMEs, Quelldateien, Release-Notes, Microsoft-Store- und App-Store-Seiten. Kein Tool wurde installiert oder ausgeführt. Sterne, Preise und Versionen ändern sich schnell und gelten für den Tag der Abfrage. **(unsicher)** markiert Angaben, die nur aus Sekundärquellen stammen oder sich widersprechen. „n. a.“ heißt: Die Quelle sagt dazu nichts.

Verwandte Dateien: [terminal-reply.md](terminal-reply.md) (Antworten in Terminal-Sessions), [home-layouts.md](home-layouts.md) (Aufbau der aufgeklappten Insel).

**Inhalt**

1. Gruppe A: klassische Notch-/Island-Tools (macOS, Windows, Flyout-Ersatz, Linux)
2. Gruppe B: KI-Agent-Companions
3. Feature-Matrix (Feature × Tool, mit „Nikki heute“)
4. Machbarkeit der Wunsch-Features unter Windows/Electron
5. Große Ideenliste
6. Priorisierung für Nikki

---

## 1. Gruppe A: klassische Notch-/Dynamic-Island-Tools

### 1.1 macOS

#### NotchNook (lo.cafe)
- macOS 14.6+, Pro nur Apple Silicon | Preise widersprüchlich: Die Website nennt „Purchase €15“ plus Monatsplan, Product Hunt 12 $ lifetime oder 2 $/Monat, Macworld 2024 25 $ für 5 Macs **(unsicher, welche Edition)** | [getnotchnook.com](https://getnotchnook.com/), [Changelog](https://getnotchnook.com/changelog)
- Die alten Adressen notchnook.app (HTTP 402) und lo.cafe (DNS-Fehler) waren am 2026-10-29 nicht erreichbar, getnotchnook.com dagegen schon.
- **Pro 2.0:**
  - „Workspaces“: Widgets per Drag in den Nook ziehen, verschieben oder herausziehen, Hotkey je Workspace
  - **Live Activities** für Musik, Timer, Meetings, Downloads, Akku, **AI Agents** und AirPods
  - „Pocket“: Maus beim Ziehen schütteln öffnet eine Tasche, beliebig viele
  - Video-Link kopieren lädt das Video direkt in den Tray
  - Quelle: [Changelog](https://getnotchnook.com/changelog)
- Medien für Apple Music und Spotify ohne Lautstärke. Kalender-Widget, Tag per Swipe. **File Tray** (rein kopieren, raus verschieben). Datei auf die Notch ziehen öffnet eine AirDrop-Box. „FaceTime Mirror“ als Webcam-Vorschau. Kurzbefehle. Öffnet bei Hover, Zwei-Finger-Swipe für den nächsten Titel, Widgets lassen sich umordnen und in der Größe ändern, halbe virtuelle Notch auf Macs ohne Notch ([Macworld](https://www.macworld.com/article/2406934/notfhnook-macbook-dynamic-island-widgets-files-tray.html))
- Notizen, To-dos, Timer ([AlternativeTo](https://alternativeto.net/software/notchnook/about))

#### The Boring Notch (TheBoredTeam)
- macOS 14+ | kostenlos, GPL-3.0, etwa 11,2k Sterne, v2.7.3 | [github.com/TheBoredTeam/boring.notch](https://github.com/TheBoredTeam/boring.notch)
- Alle Punkte laut [README](https://github.com/TheBoredTeam/boring.notch):
  - Musik-Live-Activity mit Visualizer und Steuerung (MediaRemoteAdapter ab macOS 15.4)
  - Kalender + Erinnerungen, Mirror (Webcam), Ladeanzeige und Akku-Prozent, Shelf mit AirDrop
  - **Ersatz der System-HUDs** für Lautstärke, Helligkeit und Tastaturlicht
  - Eigene Gesten, Hover zum Öffnen, Notch-Größe pro Display
  - Roadmap: Bluetooth, Wetter, eigene Layouts, Lockscreen-Widgets, Erweiterungssystem, Benachrichtigungen

#### Alcove
- macOS 15+ | 12,99 $ einmalig, 3 Geräte, 72 h Test | [tryalcove.com](https://tryalcove.com)
- „Fluid transitions“, „Instant Notifications“, „Live Activities“, „Swipe gestures“, „Customizable HUDs“, „Lock Screen Widgets“ ([tryalcove.com](https://tryalcove.com)). Nutzt private APIs, keine Datensammlung ([FAQ](https://tryalcove.com/faqs))
- Now Playing **(unsicher)** ([AlternativeTo](https://alternativeto.net/software/alcove/about))

#### DynamicLake Pro
- macOS 14+, Macs mit und ohne Notch | 13,99 $ einmalig über Gumroad, 3 Geräte | [dynamiclake.com](https://www.dynamiclake.com)
- Alle Punkte laut [Gumroad-Seite](https://avirok1.gumroad.com/l/nyyfw):
  - DynaKeys: HUD für Lautstärke, Helligkeit und Tastaturlicht
  - DynaMusic und „Slim Player“
  - DynaGlance: Kalender und Wetter
  - DynaClip/DynaDrop: **Shelf mit Komprimieren, Quick Look, AirDrop, Teilen-Links und Konvertierung** von Audio, Video und Dokumenten
  - DynaConnect: Bluetooth-Hinweise
  - DynaSwitcher: App-Switcher mit Live-Vorschau
  - **Benachrichtigungen** aus Messages, WhatsApp, Telegram, Slack und Mail
  - Anrufe
  - **Plugins mit Plugin-Markt**
  - Kompaktmodus „miniLake“
- Timer ([dynamiclake.com](https://www.dynamiclake.com))

#### MediaMate
- macOS 13+ | ab 6,99 € (Pay what you want) | [wouter01.github.io/MediaMate](https://wouter01.github.io/MediaMate/)
- Now-Playing-HUD in der Notch oder als Bubble, mit Scrubbing. **Ersetzt die HUDs für Lautstärke, Helligkeit und Tastaturlicht.** Themes, Symbol des Audio-Ausgangs, Focus-Filter (HUDs im Fokusmodus ausblenden) ([Gumroad](https://wouter01.gumroad.com/l/mediamate))

#### NotchDrop (Lakr233)
- macOS 13+ | kostenlos im App Store, MIT | [github.com/Lakr233/NotchDrop](https://github.com/Lakr233/NotchDrop)
- Dateien auf die Notch ziehen als **temporäres Shelf** (standardmäßig 1 Tag aufbewahrt), AirDrop, Öffnen mit einem Klick, Haptik ([README](https://github.com/Lakr233/NotchDrop), [App Store](https://apps.apple.com/app/notchdrop/id6529528324))

#### TopNotch
- macOS 11+ | kostenlos | [topnotch.app](https://topnotch.app)
- **Versteckt nur die Notch**, indem das Hintergrundbild oben geschwärzt wird. Keine Widgets ([topnotch.app](https://topnotch.app))

#### Atoll (Ebullioscopic)
- macOS 14+ | kostenlos, GPL-3.0, etwa 5,1k Sterne, v2.3.3 | [github.com/Ebullioscopic/Atoll](https://github.com/Ebullioscopic/Atoll)
- Alle Punkte laut [README](https://github.com/Ebullioscopic/Atoll):
  - Medien mit Gesten-Seek
  - Live Activities: Medien, Fokus, Bildschirmaufnahme, Privatsphäre-Indikatoren, Downloads, Akku
  - Lockscreen-Widgets
  - CPU/GPU/RAM/Netz/Disk, Timer, **Clipboard-Verlauf**, Farbwähler, Kalendervorschau
  - Shelf, auch per `open -a Atoll <file>`
  - **Terminal-Tab** (SwiftTerm)
  - **LLM-Usage-Tracking**
  - Basiert auf Boring.Notch-Code

#### Atoll (rutmehta), anderes Projekt mit gleichem Namen
- macOS 14+ | MIT, sehr klein | [github.com/rutmehta/Atoll](https://github.com/rutmehta/Atoll)
- Alle Punkte laut [README](https://github.com/rutmehta/Atoll):
  - NotchNook-Funktionsumfang: Shelf mit Quick Look, Medien, Kalender, HUD, Mirror, Timer, **Notizen, To-dos**
  - **Dazu Claude Code und Codex:** Status, Freigaben, `AskUserQuestion`, Sounds, Sprung ins Terminal, Usage, Kosten-Dashboard
  - Kommt einer Mischung aus klassischer Notch und Agent-Companion am nächsten, also Nikkis Zielbild.

#### Droppy
- macOS 14+, iPhone-Begleiter | 9,99 $ einmalig, 2 Macs | [getdroppy.app](https://getdroppy.app)
- Alle Punkte laut [getdroppy.app](https://getdroppy.app):
  - **Shelf mit Zip und Konvertierung**, Clipboard-Verlauf
  - Now Playing mit Up Next und Lyrics, Volume-/Helligkeits-HUD, AirPods-Akku
  - Kalender, Wetter, Pomodoro
  - **41 „Droplets“-Erweiterungen**, KI-Übergabe „DropClip“, Transkription auf dem Gerät
  - Action Ring per Hotkey, Themes

#### Isle (Setapp)
- macOS 26+ | ab 14,99 $ oder über Setapp | [setapp.com/apps/isle](https://setapp.com/apps/isle)
- Alle Punkte laut [Setapp-Seite](https://setapp.com/apps/isle):
  - **KI-Usage-Ringe (5 h/Woche/Monat) und Claude-Code-Freigaben** aus Terminal/iTerm
  - Wachhalten (auch zugeklappt), Musik mit Lyrics, Shelf (7 Tage) + AirDrop, Screenshot-Annotation, Pomodoro, Mikro-Stumm, Zubehör-Akku, Clipboard
  - Kalender, Wetter, **Notizen**, Systemmonitor

#### NotchThings
- macOS 15.6+ | kostenlos, Lifetime-Unlock 6,99 $ | [App Store](https://apps.apple.com/us/app/notchthings/id6762610441)
- Musik, Mixer pro App, Wechsel des Audio-Ausgangs, **Notizen, To-dos**, Clipboard (40 Einträge), AirDrop-Shelf, Kalender + Erinnerungen, Geräte-Akku, Stoppuhr/Timer/Pomodoro, **Teleprompter**, Systemmonitor, **KI-Usage für Claude- und Codex-Limits**, Radialmenü, Kamera-Spiegel, Wachhalten ([App Store](https://apps.apple.com/us/app/notchthings/id6762610441))

#### Mew Notch
- macOS 14+ | GPL-3.0 | [github.com/monuk7735/mew-notch](https://github.com/monuk7735/mew-notch)
- HUD für Helligkeit und Lautstärke (Ein- und Ausgang), unterdrückt das System-HUD. Now Playing, Mirror, Shelf mit AirDrop (bleibt über Neustarts), Akku-Restzeit, pro Display simulierte Notch, schwebende Insel oder HUD auf Abruf. **Bash-Script-Ansicht** (zeigt Befehlsausgaben) ([README](https://github.com/monuk7735/mew-notch))

#### DynamicNotch (jackson-storm)
- macOS 14.6+ | GPL-3.0 | [github.com/jackson-storm/DynamicNotch](https://github.com/jackson-storm/DynamicNotch)
- Now Playing mit Lyrics (LRCLIB, auch auf dem Lockscreen), Live Activities für Downloads, AirDrop, Timer, Fokus, Hotspot und Bildschirmaufnahme. Hinweise zu Akku, BT, WLAN und VPN. **„Universal notification interception“.** Gesten (wegwischen und wiederholen), 38+ Sprachen ([README](https://github.com/jackson-storm/DynamicNotch), [Website](https://dynamicnotch.evgeniy-petrukovich.workers.dev))

#### SuperIsland
- macOS 14+ | kostenlos, Quellcode offen (keine Lizenzangabe) | [dynamicisland.app](https://dynamicisland.app), [GitHub](https://github.com/shobhit99/SuperIsland)
- Now Playing (auch Chromium-Browser), Akku-Restzeit, Wetter, **Kalender mit Beitritts-Links für Zoom/Meet/Teams**, **Benachrichtigungen mit Aktionsknöpfen**, Shelf, HUD-Ersatz, **JavaScript-Erweiterungs-SDK** (Sandbox), Energiemodi ([dynamicisland.app](https://dynamicisland.app), [README](https://github.com/shobhit99/SuperIsland))

#### vaho
- macOS 13+ | Free + Pro 5,99 € | [tryvaho.com](https://tryvaho.com)
- Modi Media, Files, Alerts und Themes, Pro dazu Shortcuts, Reminders, Clipboard und Pomodoro. Lockscreen-Widgets, Theme- und Modus-Store, **Community-Modi in HTML/CSS/JS**, Launcher ([tryvaho.com](https://tryvaho.com))

#### Notch Pilot
- macOS 14+ | MIT | [github.com/devmegablaster/Notch-Pilot](https://github.com/devmegablaster/Notch-Pilot)
- Claude-Code-Sessions mit Timeline. Strukturierte Freigaben für Shell, Diffs und URLs mit Allow/Deny/Always. Usage. **Animierter „Buddy“ mit 6 Figuren und 7 Gesichtsausdrücken**. Optionale Sprachansagen, Haptik, Sprung zu Terminal/tmux, **24-h-Aktivitäts-Heatmap** ([README](https://github.com/devmegablaster/Notch-Pilot))

#### Weitere macOS-Tools (kurz)
- **ComfyNotch** (MIT, Beta): Musik, Kamera, Notizen, Clipboard, Datei-Tray, Kalender + Erinnerungen ([GitHub](https://github.com/AryanRogye/ComfyNotch))
- **DropNotch** (Junebytes, Free + Pro 15 $): Notch als Drop-Zone für AirDrop, Mail, Share-Extensions und Papierkorb. Pro: komprimieren, konvertieren, Aktionssets. **Verschiedene Aktionen je Seite der Notch** ([junebytes.com/dropnotch](https://junebytes.com/dropnotch))
- **Folder Hub** (IAP): Dateibrowser unter der Notch, Workspaces, Pins, Vorschau ([App Store](https://apps.apple.com/us/app/folder-hub-file-browser/id6473019059?mt=12))
- **DynamicHorizon** (12,99 $): Systemindikatoren, Spotify/Music mit Visualizer, WhatsApp-/Telegram-/iMessage-Benachrichtigungen ([Gumroad](https://dynamichorizon.gumroad.com/l/dynamic-horizon))
- **NotchFlow** (20 $ lifetime): Pomodoro, Kaffeepause, Fokusmusik ([notchflow.app](https://notchflow.app))
- **NotchBar** (AGPL): Widgets neben der Notch (Systemwerte, Medien, aktive App) ([GitHub](https://github.com/navtoj/NotchBar))
- **BetterTouchTool „Notch Bar“**: eigene Menüleiste mit Widgets und Script-Widgets ([MacStories](https://www.macstories.net/sponsored/bettertouchtool-introducing-the-notch-bar-sponsor/))
- **Notchy (kryz3)** (MIT): Kalender mit Anlegen/Löschen, Erinnerungen, **Markdown-Notizen und Zeichenfläche**, eingebautes zsh-Terminal ([GitHub](https://github.com/kryz3/Notchy))
- **Notchmeister** (Iconfactory, kostenlos): nur Spaß-Effekte bei Hover ([App Store](https://apps.apple.com/us/app/notchmeister/id1599169747?mt=12))
- **DynamicNotchKit** (Bibliothek, MIT): SwiftUI-Paket für Notch-Inhalte ([GitHub](https://github.com/MrKai77/DynamicNotchKit))
- Nur gefunden, nicht geprüft: uNotch, MacNotch, Islio, NotchDodo, Seam, Notch Pro, NotchPad, QuakeNotch, NotchNest, Crest, NotchPal, Notchlimits

### 1.2 Windows: allgemeine Island-/Notch-Apps

#### Nusa (rama2555 / „Nusa Labs“)
- **Windows 10 (1809+) / 11, 64 Bit**, nicht macOS. „NusaMac“ ist ein inoffizieller Nachbau ([GitHub](https://github.com/junanda24/nusa-mac)) | kostenlos, „Nusa Pro“ als Einmalkauf angekündigt (Preis n. a.) | [rama2555.github.io/nusa](https://rama2555.github.io/nusa/), [Microsoft Store](https://apps.microsoft.com/detail/9NQMSXF0N0WM), [Releases](https://github.com/rama2555/nusa/releases)
- **Shelf:** Dateien auf die Notch ziehen und „into a chat, an email or another folder“ wieder herausziehen. Klick öffnet die Datei. Karten mit **Thumbnail**, Name und Größe. Gespeichert werden Verweise, keine Kopien („remembers where your files live“) ([Website](https://rama2555.github.io/nusa/)). Eine große Quick-Look-Vorschau wird nicht erwähnt **(unsicher)**.
- v1.1: Mehrfachauswahl (Ctrl/Shift-Klick), gemeinsam herausziehen oder löschen. **Text-Karten**: Klick kopiert, Ziehen gibt Text. „Clear all“ mit Animation ([Releases](https://github.com/rama2555/nusa/releases))
- Seiten: Musik, Fokus-Timer, **Wasser (Trink-Erinnerung)**, Shelf, **To-do**. Lyrics-Modus, kurze „Peeks“ für Ladegerät, WLAN-Verlust und Kopfhörer. Overlays für Lautstärke/Helligkeit, Caps Lock und Tastatursprache. **Maskottchen-Augen im Leerlauf** (dösen, winken). „Minimal notch“ als dünne Linie, versteckt sich im Vollbild ([Website](https://rama2555.github.io/nusa/))
- Aufbau der Insel: [home-layouts.md](home-layouts.md)

#### DynamicWin (FlorianButz)
- Windows, C#/WPF + SkiaSharp | kostenlos, CC BY-SA 4.0, nur Releases, kein Quellcode im Repo | [github.com/FlorianButz/DynamicWin](https://github.com/FlorianButz/DynamicWin) | v2.0.3 vom 2025-10-22, 643 Sterne
- Medien mit Favoriten, ab v2.0.3 interaktive Zeitleiste ([Releases](https://github.com/FlorianButz/DynamicWin/releases))
- Kalender mit Google-Calendar-Anbindung, Datei-Tray („like a clipboard“, Doppelklick öffnet, Teilen über den Windows-Share-Dialog) ([README](https://github.com/FlorianButz/DynamicWin))
- Bluetooth-Gerät mit Akku, Hinweis „Mikrofon in Benutzung“, Lautstärke-/Helligkeits-Popups (abschaltbar), Themes, Erweiterungen, Monitorwahl, ziehbare Notch, Auto-Update ([Releases](https://github.com/FlorianButz/DynamicWin/releases))

#### WinIsland (WinIslandProject)
- Windows, Rust + Skia + D3D12 | kostenlos, GPL-3.0 | [github.com/WinIslandProject/WinIsland](https://github.com/WinIslandProject/WinIsland) | v2.0.0 vom 2026-10-26, sehr aktiv, 399 Sterne
- **LingoSoul**: Sprach- und Chat-Assistent mit **Wake Word** und Verlauf. Stellt Timer, öffnet Apps, steuert Medien, ruft Wetter ab, nutzt Plugin-Tools und MCP-Server, „hand tasks to Claude Code or Codex“, eigener API-Key nötig ([Releases](https://github.com/WinIslandProject/WinIsland/releases))
- Plugin-System mit Assistant-API. Kalender als Plugin (Feiertage) ([Releases](https://github.com/WinIslandProject/WinIsland/releases))
- Musik: synchronisierte Lyrics, Spektrum in Cover-Farben, Ausgabegerät-Wechsel, Lautstärke ([Releases](https://github.com/WinIslandProject/WinIsland/releases))
- Benachrichtigungen (holen die versteckte Insel hervor), Kamera-/Mikro-Indikator, Timer mit Kompakt-Countdown, CPU/GPU/RAM/Netz, Volume-/Helligkeits-Overlay, Fullscreen-Auto-Hide, Hotkey Ctrl+Alt+H, Glass-Styles (auf Wunsch unsichtbar in Screenshots), Touch, „kopierten Link öffnen?“ ([Releases](https://github.com/WinIslandProject/WinIsland/releases))

#### eIsland (JNTMTMTM)
- Windows, **Electron 35 + React 19** | GPL-3.0 mit Zusatzbedingungen, dazu Abo-Bedingungen (Preise n. a.) | [github.com/JNTMTMTM/eIsland](https://github.com/JNTMTMTM/eIsland) | v27.0.0 vom 2026-10-09, 323 Sterne
- Wetter, synchronisierte Lyrics, Timer/Countdown, Schnellstart, System-Toolbox ([README](https://github.com/JNTMTMTM/eIsland))
- „Built-in AI agent workspace“, Codex-Status-Service, Ollama, Spracheingabe mit Speech-to-Text ([Releases](https://github.com/JNTMTMTM/eIsland/releases))
- Native Plugins mit SDK, App-Launcher per Drag & Drop, WLAN, Rechner mit Plot, OCR/Bildübersetzung, Minispiele ([Releases](https://github.com/JNTMTMTM/eIsland/releases)), Abo-/Refund-Bedingungen ([BILLING_REFUND_POLICY.md](https://github.com/JNTMTMTM/eIsland/blob/main/docs/LEGAL/BILLING_REFUND_POLICY.md))

#### Notchify (Kingpindev)
- Windows 10/11, nativ („Not Electron“), bis 240 Hz | 3,49 $ im US-Store, Testversion | [Microsoft Store](https://apps.microsoft.com/detail/9P0JFN5L96VH), [notchify.app](https://notchify.app) | Store-Update 2026-10-27
- Medien mit Cover, Scrubbing, Shuffle/Repeat, Karaoke-Lyrics. Clipboard-Verlauf (Text, Links, Bilder, Dateien, Pins, Drag-out). Datei-Tray ([notchify.app](https://notchify.app))
- 20+ Widgets: Wetter, Kalender, **To-do, Notizen**, Timer, Pomodoro, Weltuhr, Audio-Ausgang, CPU/RAM/Disk/Netz-Graphen. Control Center mit Lautstärke und Helligkeit. Mikro/Kamera-Indikator, Bluetooth-Akku. 14 Themes mit Editor, 8 Positionen, Display wählbar oder dem Cursor folgend, Hover zum Zeigen ([notchify.app](https://notchify.app))
- Windows-Benachrichtigungen in der Insel, nach Chat gruppiert, wegwischbar. Bildschirmaufnahme, Discord-Voice-Steuerung, Handy-Dateitransfer per QR, Browser-Downloads über eine Erweiterung ([Microsoft Store](https://apps.microsoft.com/detail/9P0JFN5L96VH))

#### NotchPixel (KORE INDUSTRIES)
- Windows 10 2004+ / 11 | 9,99 $ einmalig, 7 Tage Test | [Microsoft Store](https://apps.microsoft.com/detail/9MXCRL0XBGPH), [notchpixel.com](https://notchpixel.com) | v0.5.88 vom 2026-10-21
- Alle Punkte laut [Store-Seite](https://apps.microsoft.com/detail/9MXCRL0XBGPH):
  - Now Playing aus jeder App mit Cover und Scrubbing, Lyrics über LRCLIB
  - **Ersetzt die Windows-Flyouts für Lautstärke, Helligkeit, Akku und Kopfhörer**
  - Datei-Ablage mit Drag rein und raus, Handy-Transfer per QR. Verschlüsselter Clipboard-Verlauf mit Pins, der Passwortmanager auslässt. Benachrichtigungen werden gespiegelt.
  - Widgets für Datum, nächste Termine, Wetter und Fokus-Timer. Schnellschalter für WLAN, Bluetooth, Nachtlicht, Fokus und Energiemodus.
  - Im Vollbild weicht sie aus oder wird zur FPS/CPU/GPU/RAM-Leiste. Ctrl+Alt+M schaltet das Mikro global stumm (mit Call-Timer), Ctrl+Alt+C ist ein Farbwähler.
  - **„Live tiles from your scripts“:** Beliebige Programme schreiben über eine lokale Adresse oder die CLI in die Notch.
  - OBS-REC/LIVE-Pill, Twitch-/YouTube-Chat, Regeln pro App. Etwa 13 MB, im Leerlauf 0 % CPU.

#### Isle Notch (Gökhan Aytekin)
- Windows 10/11 | kostenlos, Premium 2,99 $ einmalig | [Microsoft Store](https://apps.microsoft.com/detail/9P3RQFJ658C5), [isle.nxsapps.com](https://isle.nxsapps.com/) | Store-Update 2026-10-17
- Master-Lautstärke und Mixer pro App. Lautstärke und Helligkeit erscheinen in der kompakten Insel. Now Playing ([Store](https://apps.microsoft.com/detail/9P3RQFJ658C5))
- Clipboard-Verlauf, **Notizen und To-dos**, Timer, nächster Termin, Dateien/Verknüpfungen „parken“, Akku und Wetter in der geschlossenen Insel, Systemansicht mit Speedtest. Blendet sich bei Vollbild aus, optional auf allen Monitoren ([Store](https://apps.microsoft.com/detail/9P3RQFJ658C5))
- **Gesicht in der geschlossenen Insel, dessen Augen dem Mauszeiger folgen** und auf eine hereingezogene Datei schauen ([Store](https://apps.microsoft.com/detail/9P3RQFJ658C5))

#### Dynamic Edge (Eyuel Engida)
- Windows 10/11, WinUI 3 | kostenlos mit In-App-Käufen | [Microsoft Store](https://apps.microsoft.com/detail/9PF1587KSN2K) | v3.0.1 vom 2026-10-29
- Alle Punkte laut [Store-Seite](https://apps.microsoft.com/detail/9PF1587KSN2K):
  - **Medien über SMTC** mit Live-Seekbar, Cover, Session-Umschalter und 6-Balken-Visualizer. Lyrics-Fenster. „Music Radar“ erkennt Songs, die irgendwo auf dem PC laufen.
  - Master-Lautstärke mit Mausrad
  - Insel oben oder „Blade“ am linken/rechten Rand
  - „Quiet Feed Mode“ gegen Popup-Flut bei Shorts/Reels, Bluetooth-Akku
  - **„Island Companion (Virtual Pet)“**
  - Offline, keine Telemetrie

#### Nectar (kua8, Fork von Bloom)
- Windows 11, Rust + React (Tauri v2) | GPL-3.0 | [github.com/kua8/Nectar](https://github.com/kua8/Nectar) | v1.4.0 vom 2026-10-07
- Musik mit 5-Band-Visualizer, Command Center (WLAN, BT, Nicht stören, Lautstärke, Helligkeit), Akku, Wetter, Kalender mit Pomodoro, ersetzt die Taskleiste durch ein Dock, Monitorwahl, Sichtbarkeit „Fixed“ (über Vollbild) oder „Smart“ (weicht überlappenden Fenstern aus), Live-Reload von `settings.json` ([README](https://github.com/kua8/Nectar))

#### NetSpeed Dynamic (GEORGEWWWU)
- Windows 10/11, Tauri 2 + Vue 3 | MIT | [github.com/GEORGEWWWU/NetSpeed-Dynamic](https://github.com/GEORGEWWWU/NetSpeed-Dynamic) | nur noch Wartung, Nachfolger „NotchPeninsula“
- Netzgeschwindigkeit, SMTC-Medien mit Lyrics und FFT-Spektrum, fängt Windows-Toasts ab (Stumm-Modus), Aktivitäts-Pool für Downloads/Uploads/Druck, CPU/RAM, FPS-Plugin, Fullscreen-Auto-Hide ([README](https://github.com/GEORGEWWWU/NetSpeed-Dynamic))

#### fly-island (flyl1u)
- Windows 10/11, Tauri 2 + React 19 | MIT | [github.com/flyl1u/fly-island](https://github.com/flyl1u/fly-island) | v0.2.11 vom 2026-10-28
- QQ-/WeChat-/QQ-Mail-Benachrichtigungen, Clipboard mit Bildern, Übersetzungs-Hotkey Alt+C (DeepSeek), Medien mit Waveform, **To-dos und Notizen**, **KI-Statuslicht für Codex und Claude Code über Lifecycle-Hooks** (läuft/fertig/braucht dich) ([README](https://github.com/flyl1u/fly-island))

#### Ripple (TopMyster)
- Windows, macOS, Linux, **Electron 38** | MIT | [github.com/TopMyster/Ripple](https://github.com/TopMyster/Ripple) | v3.3.1 vom 2026-10-05
- Now Playing, Wetter, Akku/BT-Hinweise, Clipboard, **Aufgabenliste**, KI-„Ask“ über Groq, Multi-Monitor/-Desktop, Themes, Ctrl+Zahl-Shortcuts, 4 Schnell-Apps ([README](https://github.com/TopMyster/Ripple))

#### Windows Notch Overlay (Taxperia)
- Windows 10/11, **Electron 45** + Koffi + .NET-8-Helfer | Apache-2.0 (DynamicWin-Teile CC BY-SA) | [github.com/Taxperia/windows-notch-overlay](https://github.com/Taxperia/windows-notch-overlay) | v0.4.0 vom 2026-10-24
- Lautstärke-Mixer, Helligkeit inkl. DDC/CI, BT, Fokus-Assistent, Nachtlicht, Mikro/Kamera, Pomodoro, Wecker, Kalender, Wetter, Suche, Benachrichtigungscenter, SMTC-Medien, CPU/RAM/NVIDIA-GPU ([README](https://github.com/Taxperia/windows-notch-overlay)). Zeigt, wie man aus Electron an native Windows-APIs kommt (Koffi-FFI plus .NET-Helfer).

#### Oyenza Studio (lucacadalora)
- Windows 10/11 + macOS 14+, natives Rust | MIT | [github.com/lucacadalora/oyenza-studio](https://github.com/lucacadalora/oyenza-studio) | v0.2.20 vom 2026-10-29
- **Katzen-Maskottchen „Oyen“**: schaut über die Insel, folgt dem Zeiger, schläft von 0 bis 5 Uhr. **KI-Tab mit Restkontingent und Limits für Codex, Claude Code und OpenCode Go** samt Warnungen. Musik mit Lyrics, Pomodoro, Google Calendar (mit Login), Datei-Ablage, Lautstärke-/Akku-Popups, CPU/GPU/RAM, FPS-Overlay, Fullscreen ausblenden oder oben bleiben, Hotkeys, Ton-Schalter ([README](https://github.com/lucacadalora/oyenza-studio))

#### Weitere kleine Windows-Islands
- WinIsland (adityasrivastava5098), Electron: Medien-Kapsel mit Glow in Cover-Farbe, Monatskalender, Insel auf jedem Monitor ([GitHub](https://github.com/adityasrivastava5098/WinIsland))
- Dynamic Island for Windows (rajsriv), PyQt6 + winsdk: CPU/RAM, Medien mit Akzentfarbe aus dem Cover, Caps-/Num-Lock-Anzeige ([GitHub](https://github.com/rajsriv/dynamic-island-for-windows))
- Nur gefunden, nicht geprüft: Glance, winotch, Windowsland, Nimbus, Lumen, WinNotch, DeskNotch ([Peerlist](https://peerlist.io/yashsrivasta7a/project/desknotch)), WinIsland-X (Website und Repo am 2026-10-30 nicht erreichbar)

### 1.3 Windows: Flyout-Ersatz

#### FluentFlyout (unchihugo)
- Windows 11 x64/ARM64 | GitHub kostenlos (GPL-3.0), im Store kostenlos mit 2,99 € Unlock | [github.com/unchihugo/FluentFlyout](https://github.com/unchihugo/FluentFlyout), [Store](https://apps.microsoft.com/detail/9N45NSM4TNBP) | v2.16.1 vom 2026-10-27, 4,8k Sterne
- Medien-Flyout mit Cover und Steuerung, „Up Next“-Flyout, Lock-Keys-Flyout ([README](https://github.com/unchihugo/FluentFlyout)). **Ersetzt das Windows-Lautstärke-Flyout**, mit Mixer, Taskleisten-Medienwidget und Visualizer ([Store](https://apps.microsoft.com/detail/9N45NSM4TNBP)). Hotkey Ctrl+Alt+V, Session-Umschalter, Multi-Monitor/Mixed-DPI ([Releases](https://github.com/unchihugo/FluentFlyout/releases))

#### ModernFlyouts
- Windows 10/11 | MIT | [github.com/ModernFlyouts-Community/ModernFlyouts](https://github.com/ModernFlyouts-Community/ModernFlyouts) | **archiviert am 2025-11-15**
- Ersetzte die Flyouts für Lautstärke/Medien, Helligkeit und Flugmodus, dazu Lock-Keys- und Insert-Flyout, Timeline, Positionen, Monitorwahl ([README](https://github.com/ModernFlyouts-Community/ModernFlyouts))

#### Fluent Flyouts (FireCubeStudios) und Media Flyout
- Fluent Flyouts: Kalender-/Uhr-Flyout mit Sekunden und zweiter Zeitzone, keine Notch ([Store](https://apps.microsoft.com/detail/9PPCM05RW87X))
- Media Flyout (closed source): Steuerung, Sprung zur spielenden App, pausiert die vorherige Session ([Store](https://apps.microsoft.com/detail/9NBXBP78896Q))

### 1.4 Linux (nur zur Ideensammlung)

- **impasto** (Hyprland/Quickshell): Insel mit Medien, Benachrichtigungen mit Aktionen, Wetter, Kalender, Tasks, **Claude-Code-Usage** ([GitHub](https://github.com/andreumassanet/impasto))
- **ActivSpot** (Hyprland): Musik, Discord-Call mit Mute, **animierte Katze, die auf Musik und Benachrichtigungen reagiert**, Launcher, Clipboard ([GitHub](https://github.com/Devvvmn/ActivSpot))
- **k4** (Hyprland): **Plugin-API mit Plugin-Store**, „Ask Codex“-Hotkey ([GitHub](https://github.com/k4ditano/k4))
- **NexNotch** (GNOME): Google Calendar und Tasks, Pomodoro mit Statistik, Datei-Ablage mit Google-Drive-Upload ([GitHub](https://github.com/NexVar/NexNotch))

### 1.5 Datei-Ablage-/Shelf-Tools (Schwerpunkt Ablage und Vorschau)

| Tool | Plattform / Preis | Rein / raus | Vorschau | Besonderheiten | Quelle |
| :- | :- | :- | :- | :- | :- |
| **Nusa** | Windows, kostenlos | Drag rein, Drag raus in Chat, Mail oder Ordner | Thumbnail-Karten. Große Vorschau n. a. | Verweise statt Kopien, Mehrfachauswahl, Text-Karten | [Website](https://rama2555.github.io/nusa/), [Releases](https://github.com/rama2555/nusa/releases) |
| **Droppy** | macOS, 9,99 $ | Drag rein (auch per Schütteln), raus | Quick Look nur im Launcher (⌘Y) | Notch- und schwebende Trays, Tray-Switcher, **Pins überstehen Auto-Cleanup**, „Protect originals“ (immer kopieren), Zip, Konvertieren, Videos kürzen, GIF, PDF, Cloud-Links für 3 Tage. GitHub-Repo per DMCA gesperrt (Atoll/GPL) | [Doku Shelf](https://getdroppy.app/docs/shelf), [File Tray](https://getdroppy.app/features/file-tray), [DMCA](https://github.com/github/dmca/blob/master/2026/02/2026-02-10-atoll.md) |
| **Boring.Notch** | macOS, GPL | Drag auf die zugeklappte Notch öffnet den Shelf-Tab | **Quick Look** | Bild-Konvertierung, Hintergrund entfernen, PDF aus Bildern, Pfad kopieren, Datei/Link/Text-Einträge, bleibt erhalten, optional nach dem Herausziehen entfernen | [Shelf-Services](https://github.com/TheBoredTeam/boring.notch/tree/main/boringNotch/components/Shelf/Services), [Constants.swift](https://github.com/TheBoredTeam/boring.notch/blob/main/boringNotch/models/Constants.swift) |
| **Dropover** | macOS, Free + IAP | Schütteln, Hotkey, Menüleiste oder Notch | **Quick Look** | Mehrere benannte, farbige Shelves, Cloud-Links (OneDrive, Drive, S3 …), Text extrahieren, Instant Actions, überwachte Ordner, Clipboard ↔ Shelf | [dropoverapp.com](https://dropoverapp.com/), [App Store](https://apps.apple.com/us/app/dropover-easier-drag-drop/id1355679052) |
| **Yoink** | macOS, 9,99 € | Erscheint beim Ziehen am Rand | **Quick Look** | Hotkey lang drücken holt herausgezogene Dateien zurück, Doppeldruck legt das Clipboard ab | [eternalstorms.at/yoink](https://eternalstorms.at/yoink/mac/) |
| **Dropzone 5** | macOS, 35 $ | „Drop Bar“ plus Aktions-Raster | n. a. | Aktionen: AirDrop, Bilder verkleinern, SFTP/S3-Upload | [aptonic.com](https://aptonic.com/) |
| **Unclutter** | macOS, 19,99 $ | Maus oben + Scrollen öffnet | n. a. | Bereiche **Dateien + Clipboard + Notizen** nebeneinander, Cloud-Sync | [unclutterapp.com](https://unclutterapp.com/) |
| **NotchNook** | macOS | Files Tray, „Drop Area“, „Pocket“ per Schütteln | n. a. | AirDrop, Konvertieren, Video-Link in den Tray laden | [Changelog](https://getnotchnook.com/changelog) |
| **DynamicLake** (DynaClip/DynaDrop) | macOS, 13,99 $ | Rechtsklick oder Drag | „quick show“ **(unsicher, ob Quick Look)** | Offline-Konvertierung, Transkript, Finder-Kontextmenü | [DynaClip](https://dynamiclake.com/dynaclip), [DynaDrop](https://dynamiclake.com/dynadrop) |
| **NotchDrop** | macOS, MIT | Drag rein, Klick öffnet | n. a. | Auto-Leeren nach 1 Tag, AirDrop | [GitHub](https://github.com/Lakr233/NotchDrop) |
| **Dropshelf** | **Windows**, Free + Pro | Maus beim Ziehen schütteln öffnet ein Shelf | n. a. | Dateien, URLs, Web-Bilder, Text, Shelves speichern, im Vollbild aus | [Store](https://apps.microsoft.com/detail/9MZPC6P14L7N), [Changelog](https://www.softpedia.com/progChangelog/Dropshelf-Changelog-268977.html) |
| **Holdem** | **Windows**, MIT | Schütteln oder Hotkey | n. a. | Browser-Bilder, verschwindet, wenn leer | [GitHub](https://github.com/iamzubin/holdem) |
| **DropPoint** | Win/macOS/Linux, **Electron**, GPL | Drag rein und raus | n. a. | Shift+Caps Lock öffnet ein Shelf am Cursor | [GitHub](https://github.com/GameGodS3/DropPoint) |
| **DragStash** | **Windows**, kostenlos | Drag raus | n. a. | Optional Sync in einen lokalen Ordner | [Store](https://apps.microsoft.com/detail/9NG4X52DZ9TF) |
| **DynamicWin** | **Windows** | Datei-Tray | n. a. | Teilen über Windows-Share, Schütteln wurde aus Performance-Gründen entfernt | [README](https://github.com/FlorianButz/DynamicWin) |
| **Oyenza / Oyen Poni** | **Windows** + macOS, MIT | Drop, Klick öffnet, Drag raus | n. a. | „Phone drop“ per QR über WLAN | [GitHub](https://github.com/lucacadalora/poni) |

Unter Windows bieten nur Nusa und Notch-Apps wie NotchPixel ein Notch-Shelf mit Thumbnails. Eine echte große Vorschau à la Quick Look fand ich bei keinem Windows-Tool. Das wäre für Nikki eine Lücke, die sich besetzen lässt (Umsetzung siehe Abschnitt 4).

---

## 2. Gruppe B: KI-Agent-Companions

Wie diese Tools Freigaben, Fragen und Folge-Prompts technisch beantworten, steht in [terminal-reply.md](terminal-reply.md), Abschnitt 4.

### 2.1 Notch-/Menüleisten-Companions (vor allem macOS)

#### Coucou (Louis Raillé)
- macOS 15+ (Swift), **Windows 10/11 und Linux (Tauri 2)**, iPhone/Android-Begleiter | kostenlos, Code MIT. Name, Maskottchen „Mochi“ und Sounds sind © Louis Raillé | [github.com/Louis-CFM/coucou](https://github.com/Louis-CFM/coucou), [Website](https://louis-cfm.github.io/coucou/) | 6,7k Sterne
- Agents: Claude Code, Cursor, Codex, Gemini CLI, Antigravity, Copilot CLI, OpenCode, Amp und weitere ([README](https://github.com/Louis-CFM/coucou))
- Eine Pill pro Session mit Live-Ansicht, was gelesen, editiert und ausgeführt wird. Edits mit +N/−M und aufklappbarem Diff ([README](https://github.com/Louis-CFM/coucou))
- Freigaben Allow/Deny/Always (Codex nur Allow/Deny). `AskUserQuestion` in der Notch (Single/Multi-Select, bis 4 Fragen) mit Ersatzweg „Reply in terminal“. Sprung ins richtige Terminal (macOS) ([README](https://github.com/Louis-CFM/coucou))
- Maskottchen mit Animationen und 28 austauschbaren Sounds. Claude-Plan-Usage (5 h/Woche) und Codex-Usage. Chat mit eigenem API-Key oder über Claude Code. Datei-Drop, „OK Coucou“-Sprache, Integrationen (Stripe, GitHub, Vercel), Musik-Pills ([README](https://github.com/Louis-CFM/coucou))
- iPhone: Live Activity, Freigabe per Face ID, nächste Anweisung per Text oder Sprache ([Website](https://louis-cfm.github.io/coucou/))

#### Vibe Island
- macOS 14+, Apple Silicon | **19,99 $ einmalig** (1 Mac, 1 Jahr Updates), 2 Tage Test, closed source | [vibeisland.app](https://vibeisland.app), [Issues-Repo](https://github.com/vibeislandapp/vibe-island)
- Etwa 25–30 Agents. Live-Status pro Session (arbeitet/wartet/braucht Freigabe/fertig) ([GitHub](https://github.com/vibeislandapp/vibe-island))
- Allow/Deny-Karten mit ⌘Y/⌘N. Fragen mit einem Klick (⌘1–⌘3, Freitext). **Plan-Review** als Markdown mit Feedback ([vibeisland.app/claude-code](https://vibeisland.app/claude-code/))
- Sprung zum exakten Tab oder Pane in 20+ Terminals/IDEs inkl. tmux. 8-Bit-Sounds und Soundpacks. Usage-Kontingente (Claude, Codex u. a.). SSH-Remote ([vibeisland.app](https://vibeisland.app/))

#### Claude Island / Vibe Notch (Farouq Aldori)
- macOS 15.6+ | kostenlos, Apache-2.0 | [github.com/farouqaldori/vibe-notch](https://github.com/farouqaldori/vibe-notch) | 2,5k Sterne
- Nur Claude Code: mehrere Sessions, Freigabe/Ablehnung in der Notch, Chat-Verlauf mit Markdown, Hooks installieren sich selbst ([README](https://github.com/farouqaldori/vibe-notch))
- **Nachrichten senden nur, wenn Claude in tmux läuft** ([ChatView.swift](https://github.com/farouqaldori/vibe-notch/blob/main/ClaudeIsland/UI/Views/ChatView.swift))

#### Notchi (sk-ruban)
- macOS 15+ | kostenlos, GPL-3.0 | [github.com/sk-ruban/notchi](https://github.com/sk-ruban/notchi) | etwa 1k Sterne
- Pixel-Maskottchen pro Session, das auf Denken, Arbeiten, Freigabe, Kompaktierung, Fehler und Fertig reagiert. **Sounds, automatisch stumm, solange das Terminal den Fokus hat**. Usage plus 30-Tage-Kosten/Token. Optionale Emotionsanalyse mit eigenem API-Key ([README](https://github.com/sk-ruban/notchi))
- Freigabekarten „Yes“ / „Yes, and don't ask again“ / „No“, Antworten auf Fragen ([SessionStore.swift](https://github.com/sk-ruban/notchi/blob/main/notchi/notchi/Services/SessionStore.swift)). Sprung ins Terminal ([TerminalJumpService.swift](https://github.com/sk-ruban/notchi/blob/main/notchi/notchi/Services/TerminalJumpService.swift))

#### CodeIsland (wxtsky)
- macOS 14+, dazu iPhone/Watch-App und ESP32-Tischfigur | kostenlos, MIT | [github.com/wxtsky/CodeIsland](https://github.com/wxtsky/CodeIsland) | 2,5k Sterne
- Alle Punkte laut [README](https://github.com/wxtsky/CodeIsland):
  - 30+ Agents
  - Pro Session: aktuelles Tool, letzte Antwort als Markdown, Fortschrittsbalken, Git-Branch/Worktree, Gruppierung
  - Allow/Deny/Always, mehrere Fragen, **globale Hotkeys für Freigeben/Ablehnen/Überspringen/Springen**
  - Sprung zu Tab/IDE/tmux-Pane
  - Pixel-Maskottchen, 8-Bit-Sounds, **Ruhezeiten**, Unterdrückung, solange man auf die Session schaut
  - Usage, Push an Bark/ntfy/Slack/Telegram, Webhooks

#### Ping Island (erha19)
- macOS 14+ | kostenlos, Apache-2.0 | [github.com/erha19/ping-island](https://github.com/erha19/ping-island)
- Freigaben, Fragen, Kompaktierungs-Hinweise, Fertig-Popups, **Auto-Approve pro Session**, Sprung zu iTerm2/Ghostty/tmux/IDE, Themes, eigene Sounds, ablösbares Maskottchen, SSH-Remote ([README](https://github.com/erha19/ping-island))

#### Open Island (open-vibe-island)
- macOS | kostenlos, GPL-3.0 | [github.com/Octane0411/open-vibe-island](https://github.com/Octane0411/open-vibe-island) | 2,1k Sterne
- Sessions, Freigaben, Fragen-Karten, sehr genauer Terminal-Sprung (TTY, iTerm-Session, tmux-Pane, Warp, VS Code/Cursor-CLI, JetBrains), Sounds, Usage-Dashboard, findet Sessions auch aus Transcripts ([README](https://github.com/Octane0411/open-vibe-island), [docs/hooks.md](https://github.com/Octane0411/open-vibe-island/blob/main/docs/hooks.md))

#### ClaudeNotch (rawsun007)
- macOS 13+ | frei für private Nutzung, kommerziell nur mit Erlaubnis | [github.com/rawsun007/claude-notch](https://github.com/rawsun007/claude-notch)
- Alle Punkte laut [README](https://github.com/rawsun007/claude-notch):
  - Allow/Deny/Always mit **Diff-Vorschau** für Edit/Write, **Touch ID oder Gedrückthalten bei riskanten Befehlen**, Ablehnen mit Begründung
  - Fragen als Optionen plus Freitext
  - **„Reply“-Button auf der Fertig-Karte**, ⌥⌘N-Composer für neue Sessions, **Ordner auf die Notch ziehen startet Claude darin**
  - Kontext- und Kostenmeter, Budget-Grenzen, Plan-Limit-Prognose, Maskottchen, VoiceOver

#### Pushary Isle
- macOS 14+ plus Handy/Browser über Cloud-Konto | **9,99 $/Monat** | [Doku](https://pushary.com/docs/agents/mac-app)
- Freigeben, Ablehnen (mit Grund), nummerierte Optionen ⌘1–⌘9, Freitext, mehrere Fragen, Sprung zum Tab, Freigabemodi „Notch“ oder „Handy“. Aktivitätsdaten gehen an Pushary-Server ([Doku](https://pushary.com/docs/agents/mac-app))

#### Notchy (adamlyttleapps)
- macOS 26+ | MIT | [github.com/adamlyttleapps/notchy](https://github.com/adamlyttleapps/notchy)
- **Eingebettetes Terminal** mit Claude-Sessions in Tabs, Xcode-Projekterkennung, Status-Pill, Git-Checkpoints mit ⌘S ([README](https://github.com/adamlyttleapps/notchy))

#### Usage-/Status-Leisten ohne Steuerung
- **ClaudeBar** (tddworks, macOS, Apache-2.0): Kontingent-Ringe für etwa 30 Anbieter, Prognosen, Tageskosten, Notch-„Live Activity“ mit „Needs you / Done / Working“, keine Freigaben ([README](https://github.com/tddworks/ClaudeBar), [Notch-Doku](https://github.com/tddworks/ClaudeBar/blob/main/docs/features/activity/notch/README.md))
- **Claude Usage Tracker** (macOS, MIT, 3,7k Sterne): 5 h/Woche/pro Modell, Profile, Statusline, „Dynamic Island (Beta)“-HUD, passive HTTP-Hooks ([README](https://github.com/hamed-elfayome/Claude-Usage-Tracker))
- **CCSeva** (macOS, MIT): Usage in der Menüleiste, Burn-Rate, Kosten pro Modell/Projekt, Warnungen bei 70/90 % ([README](https://github.com/Iamshankhadeep/ccseva))
- **CCNotify** (macOS, MIT): Benachrichtigung bei „braucht Eingabe“/„fertig“, Dauer, Klick springt zu VS Code ([README](https://github.com/dazuiba/CCNotify))
- **Agent Island** (macOS + Windows WPF): Status aus JSONL-Transcripts, Limit-Balken, Auto-Resume nach Reset. Repo derzeit 404, Preis widersprüchlich **(unsicher)** ([agent-island.dev](https://agent-island.dev), [DEV-Artikel](https://dev.to/tristan666666/how-agent-island-detects-claude-code-and-codex-session-state-2p93))
- **NotchCode** (macOS, 19,99 $): Allow once/always/deny with reason, verlangt tmux ([notchcode.pages.dev](https://notchcode.pages.dev/))
- **VibeHub** (macOS, Apache-2.0): Weiterentwicklung von Claude Island mit SSH und 14 Sounds ([README](https://github.com/mtunique/VibeHub))
- **agentNotch** (macOS, Quellcode): Limit-Ringe, mehrere Konten, Allow/Always/Deny für Claude und Cursor ([README](https://github.com/Kumario1/agentNotch))

### 2.2 Windows mit Agent-Fokus (Nikkis direkte Nachbarn)

#### Developer Island (maximilian467)
- Windows 11, C#/.NET 10/WinUI 3 | MIT | [github.com/maximilian467/Developer-Island](https://github.com/maximilian467/Developer-Island) | v0.3.0 vom 2026-10-15
- Alle Punkte laut [README](https://github.com/maximilian467/Developer-Island):
  - Claude-Code-/Codex-Token-Usage, Claude 5 h/Woche, Kostenschätzung
  - **Live Activity, wenn Claude Code eine Freigabe braucht, auf Eingabe wartet oder fertig ist.** Freigeben aus der Insel ist nicht beschrieben.
  - Now Playing, Fokus-Timer, **Kalender per iCal**, Git-Status, GitHub-Benachrichtigungen/PRs/CI, Wachhalten, CPU/RAM/GPU/Akku, Mikro/Kamera
  - **Hotkey Ctrl+Alt+Space, derselbe wie bei Nikki.**

#### Smart Notch (Dev_avinash)
- Windows 10/11 | kostenlos, Pro einmalig (Preis n. a.) | [Microsoft Store](https://apps.microsoft.com/detail/9N1D46F5X565) | v7.1.2 vom 2026-10-25
- Alle Punkte laut [Store-Seite](https://apps.microsoft.com/detail/9N1D46F5X565):
  - Kostenlos: Musik, CPU/RAM/Netz, Bluetooth, Text-Verlauf, Fokus-Timer
  - **Pro „Notchy“**: Aktivität unterstützter KI-Agents, Fertig-Benachrichtigungen, Usage („Some Notchy integrations require installing hooks“)
  - Pro: Drop Shelf, Clipboard Pro, Mixer pro App, Download-Monitor, „Hide until hovered“, „Shake to cloak“

#### OpenNotch (Nicollasarcanjo)
- Windows (C#/WPF) + macOS | kostenlos, PolyForm Noncommercial | [github.com/Nicollasarcanjo/OpenNotch](https://github.com/Nicollasarcanjo/OpenNotch), [Store](https://apps.microsoft.com/detail/9NTZPN32VK6C)
- Claude-Code-Sessions, Projekt und Kontext. Codex mit Limits. Liest Dateien, die die Agents schreiben (keine Hooks). Öffnet sich mit Ton, wenn eine Aufgabe fertig ist. Musik mit Lyrics, Mixer pro App, Screenshots mit Annotation, **Notizen**, Clipboard, Datei-Tray, Downloads, Pomodoro, Systemwerte, alle Monitore. Unter Windows **zeigt der Kalender keine Termine** ([README](https://github.com/Nicollasarcanjo/OpenNotch))

#### BrimDeck (MoFeng2223)
- Windows 11, C#/WPF | Apache-2.0 | [github.com/MoFeng2223/BrimDeck](https://github.com/MoFeng2223/BrimDeck)
- Kontingente für Claude, Codex, Cursor, Antigravity (bis 7 Tools), Kosten heute/7 Tage, Warnungen bei 70/90 %, Medien mit Lyrics, Akku-Gesundheit, Hardware-Werte, blendet sich bei Vollbild aus ([README](https://github.com/MoFeng2223/BrimDeck))

#### Notchcode (billxby)
- macOS + Windows (Tauri 2) | MIT | [github.com/billxby/notchcode](https://github.com/billxby/notchcode)
- Claude-Code- und Codex-Sessions über einen Loopback-Server `127.0.0.1:9876` mit File-Watcher als Ersatzweg. **Keine Freigaben.** Antippen fokussiert das Terminal, Token-Budget ([README](https://github.com/billxby/notchcode))

#### Pester (BryanRonad)
- Windows 10/11, Tray + Topmost-Popup, Python 3.11+ | Lizenz n. a. | [github.com/BryanRonad/pester](https://github.com/BryanRonad/pester)
- **Freigabe-Popup für jeden Tool-Aufruf**: Allow (Y/Enter), Always (A), Deny (N/Esc). Auto-Approve- und Block-Listen, einstellbares Timeout-Verhalten, Notify-only-Modus ([README](https://github.com/BryanRonad/pester))

#### Nook (IAMichan) und weitere
- Nook (macOS, Windows-Build ungetestet): Approval-Karten „Allow / Always / Deny / In Terminal“, gleiches Modell wie Nikki, Windows-UI nur Niederländisch ([README](https://github.com/IAMichan/Nook))
- pi-island (WinForms + WebView2): Status-Kapsel nur für den „pi“-Agent, klickt durch, nimmt nie den Fokus ([README](https://cdn.jsdelivr.net/gh/phun333/pi-island@main/README.md))
- Glint (Tauri-Overlay): ein Punkt pro Session, Hover-Karte mit letztem Prompt und Diff-Summen, keine Freigaben ([README](https://github.com/anasm266/glint))
- Nur gefunden, nicht geprüft: AgentPeek, Chimlo, Runnock, Bezel, bnot, notch-so-good, Claude Guardian, AgentNotch-Windows, TokNotch-Windows, claude-notch-windows, UsageNotch-Windows

---

## 3. Feature-Matrix

Legende: ✓ = laut Quelle vorhanden, (✓) = teilweise, eingeschränkt, nur geplant oder **unsicher**, – = in der Quelle nicht genannt oder nicht vorhanden. Die Belege stehen in den Tool-Abschnitten oben (Abschnitt 1 und 2). Die Matrix fasst sie nur zusammen. Die Spalten sind eine Auswahl der vollständigsten oder für Nikki wichtigsten Tools. Kleinere Tools mit Alleinstellungsmerkmal stehen in der Spalte „Wer noch“.

**Spalte „Nikki heute“** (Commit `a2a48ca`), abgeleitet aus [README.md](../../README.md), [PRODUCT.md](../../PRODUCT.md) und dem Code:
- Fullscreen-Erkennung: `main.js:237-252`
- Anzeige auf dem Display unter dem Cursor: `main.js:226-227`
- Git-Glance: `main.js:273-333`
- Hook-Server (nur beobachten): `main.js:460-503`, `lib/hooks.js:18-22`
- Toast: `main.js:92-96`
- Tray: `main.js:584-627`
- Hotkey: `main.js:651`
- Freigaben, Fragen und Pläne für eigene Sessions: `backends/claude.js:24-31`

### 3.1 Klassische Notch-Features

Spalten: NN = NotchNook, BN = Boring.Notch, DL = DynamicLake Pro, AT = Atoll (Ebullioscopic), DR = Droppy, IS = Isle (macOS), NP = NotchPixel (Win), NF = Notchify (Win), WI = WinIsland (Win), DW = DynamicWin (Win), IN = Isle Notch (Win), FF = FluentFlyout (Win).

| Gruppe | Feature | NN | BN | DL | AT | DR | IS | NP | NF | WI | DW | IN | FF | **Nikki heute** | Wer noch |
| :- | :- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :- |
| Medien | Now Playing + Play/Pause/Skip | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | MediaMate, Dynamic Edge (SMTC), Nectar, OpenNotch, Ripple |
| Medien | Cover + Fortschritt/Scrubbing | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | (✓) | – | ✓ | – | MediaMate, Dynamic Edge |
| Medien | Synchronisierte Lyrics | – | – | – | – | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | – | – | DynamicNotch, OpenNotch, BrimDeck |
| Medien | Visualizer/Spektrum | – | ✓ | – | – | – | – | – | – | ✓ | – | – | ✓ | – | Dynamic Edge, Nectar, NSD |
| Medien | Lautstärke / Mixer pro App / Ausgabegerät | – | – | – | – | – | – | (✓) | ✓ | ✓ | – | ✓ | ✓ | – | NotchThings, Windows Notch Overlay, Smart Notch Pro |
| Medien | Song-Erkennung („Music Radar“) | – | – | – | – | – | – | – | – | – | – | – | – | – | Dynamic Edge |
| HUD/System | Ersatz der Lautstärke-/Helligkeits-HUD | – | ✓ | ✓ | – | ✓ | – | ✓ | (✓) | ✓ | ✓ | ✓ | ✓ | – | MediaMate, Mew Notch, ModernFlyouts (archiviert) |
| HUD/System | Akku / Laden (Gerät selbst) | – | ✓ | – | ✓ | – | – | ✓ | – | – | – | ✓ | – | – | SuperIsland, Nectar, Mew Notch |
| HUD/System | Bluetooth-/AirPods-Akku | – | (✓) | ✓ | ✓ | ✓ | ✓ | – | ✓ | – | ✓ | – | – | – | Dynamic Edge, Smart Notch |
| HUD/System | CPU/RAM/GPU/Netz | – | – | – | ✓ | – | ✓ | ✓ | ✓ | ✓ | – | ✓ | – | – | BrimDeck, Developer Island, NSD |
| HUD/System | Mikro-/Kamera-Indikator, Mikro global stumm | – | – | – | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | – | Developer Island |
| HUD/System | Schnellschalter (WLAN, BT, Nachtlicht, Fokus) | – | – | – | – | – | – | ✓ | ✓ | – | – | (✓) | – | – | Nectar, Windows Notch Overlay |
| HUD/System | Wachhalten (Keep awake) | – | – | – | – | – | ✓ | – | – | – | – | – | – | – | NotchThings, Developer Island |
| HUD/System | Webcam-Spiegel (Mirror) | ✓ | ✓ | – | – | – | – | – | – | – | – | – | – | – | Mew Notch, NotchThings |
| Kalender/Produktiv | Kalender / nächster Termin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | (✓) | ✓ | ✓ | – | – | SuperIsland (Meeting-Links), Developer Island (iCal), Oyenza (Google) |
| Kalender/Produktiv | Erinnerungen / To-do | ✓ | ✓ | – | – | – | – | – | ✓ | – | – | ✓ | – | – | NotchThings, fly-island, Ripple, Atoll (rutmehta) |
| Kalender/Produktiv | Notizblock | ✓ | – | – | – | – | ✓ | – | ✓ | – | – | ✓ | – | – | NotchThings, OpenNotch, Notchy (Markdown + Zeichnen) |
| Kalender/Produktiv | Timer / Pomodoro | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | – | – | NotchFlow, Oyenza |
| Kalender/Produktiv | Wetter | – | (✓) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | – | – | SuperIsland, Ripple |
| Kalender/Produktiv | Clipboard-Verlauf | – | (✓) | – | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | ✓ | – | – | NotchThings, fly-island |
| Kalender/Produktiv | Weltuhr, Teleprompter, Farbwähler, Rechner | – | – | – | ✓ | – | – | ✓ | ✓ | – | – | – | – | – | NotchThings (Teleprompter), eIsland (Rechner/OCR) |
| Dateien | Datei-Ablage (Shelf) rein/raus | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | – | (✓) Drop → Pfad in den Prompt | NotchDrop, DropNotch, Mew Notch, Smart Notch Pro, Oyenza, Nusa (1.2, 1.5) |
| Dateien | Vorschau (Quick Look / Thumbnails) | – | ✓ | (✓) | – | – | – | – | – | – | – | – | – | – | Atoll (rutmehta), Folder Hub, Dropover, Yoink, Nusa (Thumbnails) |
| Dateien | Komprimieren / Konvertieren | – | – | ✓ | – | ✓ | – | – | – | – | – | – | – | – | DropNotch Pro |
| Dateien | Teilen / AirDrop / Handy-Transfer (QR) | ✓ | ✓ | ✓ | – | – | ✓ | ✓ | ✓ | – | ✓ | – | – | – | NotchDrop, Oyenza |
| Dateien | Downloads-Fortschritt | – | (✓) | – | ✓ | – | – | – | ✓ | – | – | – | – | – | DynamicNotch, NSD, Smart Notch Pro |
| Benachrichtigungen | Benachrichtigungen spiegeln | – | (✓) | ✓ | – | – | – | ✓ | ✓ | ✓ | – | – | – | (✓) eigene Toasts | Alcove, DynamicNotch, SuperIsland (Aktionen), NSD |
| Bedienung | Öffnen bei Hover | ✓ | ✓ | – | ✓ | – | – | – | ✓ | – | – | – | – | – | Folder Hub, Smart Notch („Hide until hovered“) |
| Bedienung | Gesten (Swipe, Scroll) | ✓ | ✓ | – | ✓ | – | – | – | ✓ | – | – | – | – | – | Alcove, DynamicNotch |
| Bedienung | Globaler Hotkey | – | – | – | ✓ | ✓ | – | ✓ | – | ✓ | – | – | ✓ | ✓ | Developer Island (auch Ctrl+Alt+Space) |
| Bedienung | Vollbild: ausblenden/ausweichen | – | – | – | – | – | – | ✓ | (✓) | ✓ | – | ✓ | – | ✓ | BrimDeck, NSD, Nectar („Smart“) |
| Bedienung | Display wählen / Multi-Monitor | (✓) | ✓ | (✓) | – | ✓ | – | – | ✓ | – | ✓ | ✓ | ✓ | ✓ Display unter dem Cursor | Mew Notch, OpenNotch |
| Bedienung | Themes / Glass-Stile | – | – | ✓ | – | ✓ | – | ✓ | ✓ | ✓ | ✓ | (✓) | ✓ | – | Oyenza, Nectar |
| Bedienung | Lockscreen-Widgets | – | (✓) | – | ✓ | ✓ | – | – | – | – | – | – | – | – | Alcove, vaho (nur macOS) |
| Erweiterbar | Plugins / Erweiterungen | – | (✓) | ✓ | – | ✓ | – | – | – | ✓ | ✓ | – | – | – | SuperIsland (JS-SDK), vaho (HTML/CSS/JS), k4 (Plugin-Store), eIsland |
| Erweiterbar | Fremde Programme schreiben in die Notch (lokale API/CLI) | – | – | – | – | – | – | ✓ | – | – | – | – | – | (✓) nur Hooks | Atoll (`open -a`) |
| Charakter | Maskottchen / Gesicht | – | – | – | – | – | – | – | – | – | – | ✓ | – | ✓ Nikki | Oyenza (Katze), Dynamic Edge (Pet), ActivSpot (Katze) |
| Charakter | Eigene Sounds | – | – | – | – | – | – | – | – | – | – | – | – | ✓ | Oyenza (Schalter) |
| KI | Sprachassistent mit Wake Word | – | – | – | – | – | – | – | – | ✓ | – | – | – | – | Coucou („OK Coucou“), eIsland (STT) |
| KI | KI-Usage / Limits | – | – | – | ✓ | – | ✓ | – | – | – | – | – | – | – | NotchThings, Oyenza, BrimDeck |
| KI | Coding-Agent steuern | – | – | – | – | – | (✓) | – | – | (✓) | – | – | – | ✓ | Atoll (rutmehta), Isle, fly-island (nur Status) |
| Dev | Git-Status | – | – | – | – | – | – | – | – | – | – | – | – | ✓ | Developer Island, CodeIsland |

### 3.2 Agent-Companion-Features

Spalten: CO = Coucou, VI = Vibe Island, CI = Claude Island/Vibe Notch, NO = Notchi, CD = CodeIsland, CN = ClaudeNotch, NPi = Notch Pilot, AR = Atoll (rutmehta), DI = Developer Island (Win), PE = Pester (Win).

| Gruppe | Feature | CO | VI | CI | NO | CD | CN | NPi | AR | DI | PE | **Nikki heute** | Wer noch |
| :- | :- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :- |
| Plattform | Läuft unter Windows | ✓ | – | – | – | – | – | – | – | ✓ | ✓ | ✓ | Smart Notch, OpenNotch, BrimDeck, Notchcode, Glint |
| Status | Live-Status pro Session | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ eigene + bis 2 beobachtete | Open Island, Ping Island, ClaudeBar |
| Status | Mehrere Agent-CLIs | ✓ | ✓ | – | ✓ | ✓ | (✓) | – | ✓ | ✓ | – | ✓ Claude, Cursor, Gemini | Open Island, Ping Island |
| Status | Tool-Schritte / Diff (+N/−M) | ✓ | – | – | – | ✓ | ✓ | ✓ | – | – | – | (✓) Schrittliste, kein Diff | Glint (Diff-Summen) |
| Status | Antwort/Chat-Verlauf in der Insel | – | – | ✓ | – | ✓ | ✓ | – | – | – | – | ✓ nur eigene Sessions | VibeHub |
| Status | Session-Verlauf / Heatmap | – | – | – | – | – | – | ✓ | – | – | – | – | Notchcode (Historie) |
| Freigaben | Allow/Deny für Terminal-Sessions | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | – nur eigene | Ping Island, Open Island, Pushary, Isle (macOS) |
| Freigaben | „Immer erlauben“ | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | ✓ | ✓ eigene | Open Island (`updatedPermissions`) |
| Freigaben | Ablehnen mit Begründung | – | – | ✓ | – | – | ✓ | – | – | – | – | ✓ bei Plänen | Pushary |
| Freigaben | Diff-Vorschau vor dem Erlauben | – | – | – | – | – | ✓ | ✓ | – | – | – | – | – |
| Freigaben | Touch ID / Halten bei riskanten Befehlen | – | – | – | – | – | ✓ | – | – | – | – | – | – |
| Freigaben | Hotkeys für Erlauben/Ablehnen | – | ✓ | – | – | ✓ | – | – | – | – | ✓ | – | Pushary (⌘1–9), agentNotch |
| Freigaben | Auto-Approve-Regeln pro Session | (✓) | – | – | – | ✓ | – | – | – | – | ✓ | – | Ping Island |
| Fragen/Pläne | `AskUserQuestion` beantworten | ✓ | ✓ | – | ✓ | ✓ | ✓ | – | ✓ | – | – | ✓ eigene | Ping Island, Open Island |
| Fragen/Pläne | Plan-Review mit Feedback | – | ✓ | – | – | – | – | – | – | – | – | ✓ eigene | – |
| Steuerung | Neue Aufgabe aus der Notch starten | (✓) | – | – | – | – | ✓ | – | – | – | – | ✓ (Kernfunktion) | Notchy (eingebettetes Terminal) |
| Steuerung | Folge-Prompt in laufende Terminal-Session | (✓) `-p --resume` | – | (✓) nur tmux | – | – | ✓ Tastendruck | – | – | – | – | – (eigene: `resume`) | Ping Island (tmux) |
| Steuerung | Ordner auf die Notch ziehen → Session | – | – | – | – | – | ✓ | – | – | – | – | – | – |
| Steuerung | Sprung ins richtige Terminal/IDE | ✓ | ✓ | – | ✓ | ✓ | – | ✓ | ✓ | – | – | – | Open Island (sehr genau), Notchcode |
| Feedback | Maskottchen | ✓ | – | – | ✓ | ✓ | ✓ | ✓ | – | – | – | ✓ | Oyenza, Dynamic Edge |
| Feedback | Sounds | ✓ | ✓ | – | ✓ | ✓ | – | – | ✓ | – | – | ✓ synthetische Chimes | VibeHub (14), OpenNotch |
| Feedback | Stumm bei Terminal-Fokus / Ruhezeiten | – | – | – | ✓ | ✓ | – | – | – | – | – | – | – |
| Feedback | Desktop-Toast | – | – | – | – | – | – | – | ✓ | – | (✓) Popup | ✓ wenn die Insel versteckt ist | CCNotify, Agent Island |
| Feedback | Push aufs Handy | ✓ | – | – | – | ✓ | – | – | – | – | – | – | Pushary, Claude-Code-Channels (Telegram) |
| Feedback | Sprachansagen | – | – | – | – | – | – | ✓ | – | – | – | – | – |
| Usage | Plan-Limits 5 h/Woche | ✓ | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | ClaudeBar, CCSeva, BrimDeck, NotchThings |
| Usage | Kosten/Token-Dashboard | – | – | – | ✓ | – | ✓ | – | ✓ | ✓ | – | – | CCSeva, BrimDeck |
| Technik | Synchroner Hook mit Antwort | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | (✓) | – | ✓ | – (alles `async`) | Open Island, Ping Island |
| Technik | Ohne API-Key, nutzt das Abo | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (startet echte CLI) | – |

---

## 4. Machbarkeit der Wunsch-Features unter Windows/Electron

Rahmen: Nikki nutzt `electron ^45.0.0` (`package.json:55`), Node und ESM (`package.json:7`). Wichtig dafür: `File.path` gibt es seit Electron 32 nicht mehr, das Clipboard-Modul wurde in Electron 44 umgebaut ([Breaking Changes](https://www.electronjs.org/docs/latest/breaking-changes)). Kein Paket wurde installiert oder getestet. Die Absätze stützen sich auf Doku, READMEs und npm-Metadaten. Sätze, die mit **Einschätzung:** beginnen, sind Bewertung, kein Beleg.

### 4.1 Medien / Spotify (Cover, Fortschritt, Lautstärke, Steuerung)

**API:**
- **Windows SMTC** (`GlobalSystemMediaTransportControlsSessionManager`, ab Windows 10 1809). Das ist die einzige Quelle, die ohne Login für Spotify, Browser und die meisten Player gilt.
  - Daten: Titel, Artist, Album und Thumbnail über `TryGetMediaPropertiesAsync` ([MediaProperties](https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssessionmediaproperties))
  - Steuerung, Position und Events: `TimelineProperties`, Play/Pause/Skip, `TryChangePlaybackPosition`, Shuffle/Repeat, Change-Events ([Session](https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssession))
- **Wer SMTC meldet:**
  - Spotify: mit Thumbnail und Timeline
  - Chrome, Edge, Firefox: meist ohne Timeline
  - VLC, MusicBee, AIMP: nur mit Plugin
  - Quelle: [ModernFlyouts-Liste](https://github.com/ModernFlyouts-Community/ModernFlyouts/blob/main/docs/GSMTC-Support-And-Popular-Apps.md)
- **Lautstärke kommt nicht aus SMTC**, sondern aus Windows Core Audio (`IAudioSessionManager2` → `ISimpleAudioVolume`, pro App-Session, nur Shared Mode) ([IAudioSessionManager2](https://learn.microsoft.com/en-us/windows/win32/api/audiopolicy/nn-audiopolicy-iaudiosessionmanager2), [ISimpleAudioVolume](https://learn.microsoft.com/en-us/windows/win32/api/audioclient/nn-audioclient-isimpleaudiovolume))

**Aus Node/Electron:**
- **Kein offizielles Binding.** Gefunden, jeweils jung oder klein:
  - [`@coooookies/windows-smtc-monitor`](https://github.com/LeagueTavern/node-windows-smtc-monitor): napi-rs. Liefert Thumbnail und Timeline, README empfiehlt einen Worker. Steuerung nicht dokumentiert.
  - [`now-playing-media`](https://github.com/NikolaKaplin/now-playing-media): Steuerung und Seek, ohne Cover. Erstmals am 2026-10-24 veröffentlicht.
  - [`win-media-control-enhanced`](https://github.com/vC3sar/win-media-control-utf8): über PowerShell, Cover als Data-URL, pollt.
  - [`libspotifyctl`](https://www.npmjs.com/package/libspotifyctl): nur Spotify, mit App-Lautstärke.
  - [`native-sound-mixer`](https://github.com/m1dugh/native-sound-mixer): Lautstärke pro Session.
- **Vorbild mit gleicher Architektur:** windows-notch-overlay (**Electron 45**) startet einen eigenen **.NET-8-SMTC-Helper** als Prozess und nutzt Koffi für Win32 und Core Audio ([README](https://github.com/Taxperia/windows-notch-overlay)). FluentFlyout nutzt die .NET-Bibliothek [`Dubya.WindowsMediaController`](https://github.com/DubyaDude/WindowsMediaController) plus NAudio ([README](https://github.com/unchihugo/FluentFlyout)). Unpackaged WinRT aus .NET 5+ braucht ein Windows-TFM wie `net8.0-windows10.0.19041.0` ([Microsoft](https://learn.microsoft.com/en-us/dotnet/core/compatibility/interop/5.0/built-in-support-for-winrt-removed)).

**Spotify Web API (nur als Zusatz):**
- Lesen geht über `GET /me/player/currently-playing` ([Doku](https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track)).
- **Steuern nur mit Premium** ([Pause](https://developer.spotify.com/documentation/web-api/reference/pause-a-users-playback)).
- OAuth mit PKCE. Redirect nur als `http://127.0.0.1:PORT`, nicht `localhost` ([Redirect URIs](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)).
- **Development Mode seit Februar 2026:** Der App-Owner braucht Premium, höchstens 5 Nutzer pro App ([Spotify-Blog](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)). Extended Quota bekommen nur Firmen mit mindestens 250k MAU ([Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)).

**Notlösung:** Medientasten per `SendInput` (`VK_MEDIA_PLAY_PAUSE` 0xB3 u. a.) treffen nur die vom System gewählte Session ([Virtual-Key Codes](https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes)).

**Vorsicht:** Electron schaltet `HardwareMediaKeyHandling`/`MediaSessionService` standardmäßig ein und kann so selbst Medientasten abfangen. Wire hat das deshalb deaktiviert ([wire-desktop #7273](https://github.com/wireapp/wire-desktop/pull/7273)). Nikki spielt eigene Sounds (Chimes) und sollte das prüfen.

**Einschätzung:** Ein kleiner SMTC-Helper als Kindprozess (.NET oder ein napi-rs-Paket im `utilityProcess`), dazu Core Audio für die Lautstärke. Kein Spotify-OAuth, kein Premium nötig. Lyrics optional über LRCLIB (wie NotchPixel und OpenNotch). Voraussetzung: ein nativer Helper und Windows 10 1809+.

### 4.2 Kalender

**API-Optionen in empfohlener Reihenfolge:**

1. **ICS/iCal-Abo-Link** mit [`node-ical`](https://github.com/jens-maus/node-ical): löst Wiederholungen und Zeitzonen auf.
   - Google bietet eine „Secret address in iCal format“ ([Google-Hilfe](https://support.google.com/calendar/answer/37648?hl=en)), Outlook.com einen veröffentlichten ICS-Link ([Microsoft-Hilfe](https://support.microsoft.com/sv-se/outlook/share-your-calendar-in-outlook-com)).
   - Kein OAuth, nur Lesen.
   - Vorbilder: Developer Island (iCal, [README](https://github.com/maximilian467/Developer-Island)) und Rainmeter „sonder-nextup“ (Google-ICS, alle 5 min, [GitHub](https://github.com/gavinjudd/sonder-nextup-rainmeter)).
2. **Microsoft Graph** `GET /me/calendarView`:
   - Minimale Berechtigung `Calendars.ReadBasic`, gilt **auch für private Microsoft-Konten** ([Graph](https://learn.microsoft.com/en-us/graph/api/user-list-calendarview?view=graph-rest-1.0))
   - Anmeldung in Electron mit `@azure/msal-node` und `acquireTokenInteractive`, Redirect `http://localhost`, kostenlose Entra-App-Registrierung ([Quickstart](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-desktop-app-sign-in))
   - Token mit `safeStorage` speichern ([Electron](https://www.electronjs.org/docs/latest/api/safe-storage))
3. **Google Calendar API:**
   - OAuth mit Loopback und PKCE ([Google](https://developers.google.com/identity/protocols/oauth2/native-app))
   - Calendar-Scopes verlangen die App-Verifizierung ([Scopes](https://developers.google.com/workspace/calendar/api/auth))
   - Im Status „Testing“ höchstens 100 Test-Nutzer, Token laufen nach 7 Tagen ab ([Google Cloud-Hilfe](https://support.google.com/cloud/answer/15549945?hl=en))
   - DynamicWin nutzt Google Calendar ([README](https://github.com/FlorianButz/DynamicWin))
4. **Nicht geeignet:** WinRT `AppointmentStore`. Er braucht Capabilities und damit Package Identity ([RequestStoreAsync](https://learn.microsoft.com/en-us/uwp/api/windows.applicationmodel.appointments.appointmentmanager.requeststoreasync?view=winrt-26100)), in einer unpackaged Electron-App wahrscheinlich nicht nutzbar **(unsicher)**. Außerdem wird die Windows-Kalender-App seit 2024-12-31 nicht mehr unterstützt ([Microsoft](https://support.microsoft.com/topic/773ecb94-5b16-4155-96e1-bc9afdc08e31)). OpenNotch zeigt unter Windows deshalb keine Termine ([README](https://github.com/Nicollasarcanjo/OpenNotch)).

**Einschätzung:** Start mit einem ICS-Link: kein OAuth, deckt Google und Outlook ab. Danach optional Graph, wenn To Do ohnehin dazukommt (dieselbe Anmeldung). Google API zuletzt. Voraussetzungen: ICS braucht nichts, Graph braucht eine Entra-App-Registrierung, Google braucht eine Verifizierung.

### 4.3 Sprachsteuerung mit Wake Word („Hey Nikki …“)

**Vorbilder:**
- WinIsland „LingoSoul“ hat Wake Word und Chat-Assistent, übergibt an Claude Code/Codex und braucht einen eigenen API-Key ([Releases](https://github.com/WinIslandProject/WinIsland/releases)).
- Coucou: „OK Coucou“ ([README](https://github.com/Louis-CFM/coucou))
- eIsland: Spracheingabe mit STT ([Releases](https://github.com/JNTMTMTM/eIsland/releases))
- Wie diese Tools es intern lösen, wurde nicht geprüft.

**Lokale Optionen:**

| Option | Was | Voraussetzung / Haken | Quelle |
| :- | :- | :- | :- |
| **sherpa-onnx** (`sherpa-onnx-node`) | Keyword Spotting mit **offenem Vokabular**: „Hey Nikki“ ohne Training per Token-Liste. Dazu VAD und Streaming-Spracherkennung in einem Paket | Prebuilds für win-x64/ia32/arm64, Mikro z. B. über `node-cpal`. In Electron `enableExternalBuffer=false`. Ein deutsches KWS-Modell nicht gefunden **(unsicher)** | [KWS-Doku](https://k2-fsa.github.io/sherpa/onnx/kws/index.html), [Node-Beispiele](https://github.com/k2-fsa/sherpa-onnx/tree/master/nodejs-addon-examples) |
| **openWakeWord** | Eigene Wake Words mit synthetischer Sprache trainieren (unter 1 h in Colab, nur Englisch), sehr sparsam (15–20 Modelle auf einem Pi-3-Kern) | Python bzw. inoffizieller WASM-Port. **Vortrainierte Modelle CC BY-NC-SA** | [GitHub](https://github.com/dscripka/openWakeWord), [openwakeword-js](https://github.com/Firojpaudel/OpenWakeWord_npm_porting) |
| **Picovoice Porcupine** | Eigene `.ppn`-Wake-Words, Node-SDK | AccessKey nötig. Laut FAQ kein Gratis-Plan für private Nutzung, Free-Keys sollen seit 2026-06-30 nicht mehr gehen **(Forenbericht, unsicher)** | [npm](https://www.npmjs.com/package/@picovoice/porcupine-node), [FAQ](https://picovoice.ai/docs/faq/general/), [Forum](https://community.home-assistant.io/t/fyi-picovoice-confirmed-free-tier-accesskeys-will-stop-working-after-june-30-2026/1012744) |
| **Vosk** | Offline-STT, 20+ Sprachen **inkl. Deutsch**, Modelle etwa 50 MB, Grammatik zur Einschränkung | Node-Bindings alt (`vosk` 2022) oder klein (`vosk-koffi`) | [alphacephei.com/vosk](https://alphacephei.com/vosk/), [vosk-koffi](https://github.com/tocha688/vosk-koffi) |
| **whisper.cpp** | Gute Diktat-Qualität **nach** dem Wake Word, läuft „in Node.js and Electron“ | Zu schwer zum Dauerlauschen (**Einschätzung**). Prebuild `whisper-cpp-node` für win32-x64 | [addon.node](https://github.com/ggml-org/whisper.cpp/tree/master/examples/addon.node), [whisper-cpp-node](https://github.com/predict-woo/whisper.cpp) |
| Web Speech API in Electron | – | `webkitSpeechRecognition` liefert in Electron „network“-Fehler, **nicht praxistauglich** | [chromium-dev](https://groups.google.com/a/chromium.org/g/chromium-dev/c/RBZXqc0Zvmc) |
| Windows-Spracherkennung (WinRT) | Listen-/SRGS-Grammatiken laufen offline | Diktat geht über einen Webdienst. Die alte Desktop-Spracherkennung ist deprecated | [Microsoft](https://learn.microsoft.com/en-us/windows/apps/design/input/speech-recognition), [Deprecated features](https://learn.microsoft.com/en-us/windows/whats-new/deprecated-features) |

**Mikrofon:** `systemPreferences.getMediaAccessStatus('microphone')` liest unter Windows die globale Datenschutz-Einstellung ([Electron](https://www.electronjs.org/docs/latest/api/system-preferences)).

**Einschätzung:**
- Pipeline: sherpa-onnx-KWS dauerhaft in einem `utilityProcess`, dann VAD, dann whisper.cpp (oder sherpa-Streaming-ASR) für den Prompt, dann ab in Nikkis Composer.
- Zuerst **Push-to-talk** per Hotkey bauen (gleiche Pipeline ohne KWS) und das Wake Word als Opt-in nachziehen, mit sichtbarem Mikro-Indikator.
- Voraussetzungen: native Addons mit Prebuilds, Modelle 3–50+ MB, Mikrofon-Freigabe in Windows.
- Datenschutz: Alles bleibt lokal, kein API-Key. Das passt zu PRODUCT.md.

### 4.4 Datei-Ablage mit Vorschau (rein- und rausziehen)

**Bordmittel reichen für die Grundfunktion:**
- **Rein:** HTML5-Drop, Pfad über `webUtils.getPathForFile(file)` ([webUtils](https://www.electronjs.org/docs/latest/api/web-utils)). Nikki nimmt Drops heute schon an (Pfade in den Prompt).
- **Raus:** `webContents.startDrag({ file | files, icon })` aus dem `dragstart`-Handler über IPC ([Native File Drag & Drop](https://www.electronjs.org/docs/latest/tutorial/native-file-drag-drop), [webContents](https://www.electronjs.org/docs/latest/api/web-contents)).
- **Thumbnail:** `nativeImage.createThumbnailFromPath(path, size)` funktioniert unter Windows mit Shell-Thumbnails (Windows ignoriert die Höhe), `app.getFileIcon` als Ersatz ([nativeImage](https://www.electronjs.org/docs/latest/api/native-image), [app](https://www.electronjs.org/docs/latest/api/app)).

**Große Vorschau:**
- Bilder, Video, Audio, PDF und Text kann der Renderer selbst anzeigen (**Einschätzung**).
- Für alles andere die installierten Viewer aufrufen:
  - **PowerToys Peek:** `PowerToys.Peek.UI.exe <pfad>` ([Microsoft](https://learn.microsoft.com/en-us/windows/powertoys/peek))
  - **QuickLook** (QL-Win): `QuickLook.exe <pfad>`, ein zweiter Aufruf schließt ([GitHub](https://github.com/QL-Win/QuickLook), [Release 0.1.7](https://newreleases.io/project/github/QL-Win/QuickLook/release/0.1.7))
- Windows-Preview-Handler (`IPreviewHandler`) selbst zu hosten, braucht ein natives Fenster in `prevhost.exe` und lässt sich nicht ins DOM rendern ([Preview Handlers](https://learn.microsoft.com/en-us/windows/win32/shell/preview-handlers)). Nicht empfohlen.

**Clipboard:**
- Seit Electron 44 sind `readImage`/`writeImage`/`readBuffer` entfernt, stattdessen gibt es `read()`/`write()` mit MIME-Typen. Im Renderer gibt es kein Clipboard-Modul mehr ([Breaking Changes](https://www.electronjs.org/docs/latest/breaking-changes)).
- Dateilisten (CF_HDROP) kann Electron nicht nativ ([electron #9035](https://github.com/electron/electron/issues/9035)). Ausweg: [`clip-filepaths`](https://github.com/tktcorporation/clip-filepaths).

**Vorbilder:**
- Nusa speichert **Verweise statt Kopien** und zeigt Thumbnails ([Website](https://rama2555.github.io/nusa/)).
- Droppy: „Protect originals“ (kopieren), Pins überstehen das Auto-Leeren ([Doku](https://getdroppy.app/docs/shelf)).
- DynamicWin hat das Schütteln-zum-Öffnen wegen Performance wieder entfernt ([README](https://github.com/FlorianButz/DynamicWin)).

**Einschätzung:** Ohne native Helper machbar. Aufwand eher klein. Eine Lücke unter Windows-Notch-Tools (siehe 1.5).

### 4.5 To-do-Liste und Notizblock

**Lokal (empfohlen als Start):**
- To-dos als JSON in `userData`. Nikki hat schon einen eigenen Store, sonst [`electron-store`](https://www.npmjs.com/package/electron-store) (ESM, Electron 35+, „not a database“).
- Notizen als **Markdown-Dateien in einem gewählten Ordner**, Aufgaben als GFM-Tasklisten `- [ ]` ([GFM](https://github.github.com/gfm/#task-list-items-extension-)). Damit Obsidian-kompatibel, kein Lock-in.
- Vorbild: windows-notch-overlay speichert Notizen lokal im Renderer ([README](https://github.com/Taxperia/windows-notch-overlay)).

**Sync (später, optional):**
- **Todoist API v1** mit persönlichem Token, keine OAuth-App nötig. REST v2/Sync v9 sind seit 2026-02-10 abgeschaltet ([Todoist API](https://developer.todoist.com/api/v1/), [Ankündigung](https://groups.google.com/a/doist.com/g/todoist-api/c/brwENjfT_tk)).
- **Microsoft To Do** über Graph (`/me/todo/lists/{id}/tasks`, `Tasks.Read`/`Tasks.ReadWrite`, auch private Konten, Delta-Abfragen), dieselbe MSAL-Anmeldung wie beim Kalender ([Graph To Do](https://learn.microsoft.com/en-us/graph/api/resources/todo-overview?view=graph-rest-1.0)). Listen wie „My Day“ fehlen in v1.0 **(Forenbericht, unsicher)**.
- **Google Tasks** hat denselben Verifizierungsaufwand wie Google Calendar ([Tasks-Auth](https://developers.google.com/workspace/tasks/auth)).
- Apple Erinnerungen: unter Windows keine API.

**Einschätzung:** Kein nativer Helper, kein OAuth für den Start. Das Alleinstellungsmerkmal für Nikki ist die Agent-Verknüpfung: „To-do als Prompt senden“, „Notiz an Prompt hängen“ (Ideen 49, 50).

### 4.6 Übersicht

| Feature | Empfohlene API | Voraussetzung | Aufwand (Einschätzung) |
| :- | :- | :- | :- |
| Medien | SMTC + Core Audio über Helper | Nativer Helper (.NET oder napi-rs), Win 10 1809+ | mittel |
| Spotify-Extras | Web API | OAuth/PKCE, Premium fürs Steuern, max. 5 Nutzer im Dev Mode | hoch, nicht empfohlen |
| Kalender | ICS-Link → später Graph | ICS: nichts. Graph: Entra-Registrierung | klein → mittel |
| Wake Word | sherpa-onnx KWS + VAD + whisper.cpp | Native Addons, Modelle, Mikro-Freigabe | hoch |
| Push-to-talk | wie oben ohne KWS | dto. | mittel |
| Datei-Ablage | `getPathForFile`, `startDrag`, `createThumbnailFromPath`, Peek/QuickLook | nichts. Peek/QuickLook optional installiert | klein |
| To-do / Notizen | JSON + Markdown-Ordner | nichts | klein |
| To-do-Sync | Todoist-Token oder Graph | Token bzw. Entra-Registrierung | mittel |

---

## 5. Große Ideenliste

Jede Idee nennt ihr Vorbild. Die Belege stehen im jeweiligen Tool-Abschnitt oben. **(eigene Idee)** heißt: kein Vorbild gefunden, Vorschlag aus dieser Recherche. „Nikki: …“ beschreibt, was schon da ist.

### 5.1 Agent-Companion

1. Freigaben für **Terminal**-Sessions in der Insel beantworten (Coucou, Notchi, CodeIsland, Pester). Weg: [terminal-reply.md](terminal-reply.md). Nikki: nur eigene Sessions.
2. Fragen und Pläne aus Terminal-Sessions beantworten (Coucou, Vibe Island)
3. Diff-Vorschau vor dem Erlauben von Edit/Write (ClaudeNotch, Notch Pilot)
4. „+12 −3“-Zähler pro Session, aufklappbarer Diff (Coucou), Diff-Summen auf der Fertig-Karte (Glint)
5. Hotkeys für Erlauben/Ablehnen/Immer, auch bei zugeklappter Insel (Vibe Island ⌘Y/⌘N, CodeIsland, Pester Y/A/N)
6. Zifferntasten für Antwortoptionen (Vibe Island ⌘1–⌘3, Pushary ⌘1–⌘9)
7. Riskante Befehle (`rm -rf`, `git push --force`) nur per Gedrückthalten freigeben (ClaudeNotch: Halten oder Touch ID). Unter Windows wäre Windows Hello denkbar **(eigene Idee, unsicher)**.
8. Auto-Approve- und Block-Listen pro Projekt (Pester, Ping Island, CodeIsland)
9. Jede Ablehnung mit Begründung (ClaudeNotch, Pushary). Nikki: nur bei Plänen.
10. Knopf „Im Terminal antworten“, der die Karte schließt (Coucou „Reply in terminal“, Nook „In Terminal“)
11. Ins richtige Terminal-/IDE-Fenster springen (Coucou, Vibe Island, Open Island, Notchi)
12. Plan-Limits (5 h/Woche) als Ring in der Pill (Coucou, Vibe Island, ClaudeBar, BrimDeck, Developer Island)
13. Kosten und Token heute/7 Tage aus den lokalen JSONL-Dateien (CCSeva, BrimDeck, Notchi)
14. Warnung bei 70 und 90 % Limit (CCSeva, BrimDeck)
15. Kontext-Füllstand pro Session (ClaudeNotch, OpenNotch)
16. Letzte Antwort einer Terminal-Session in der Insel lesen, über `Stop.last_assistant_message` (CodeIsland, Claude Island)
17. Session-Timeline und 24-h-Aktivitäts-Heatmap (Notch Pilot)
18. Git-Branch und Worktree pro Session (CodeIsland). Nikki: Git-Glance fürs gewählte Projekt.
19. Ordner auf die Insel ziehen startet eine Session darin (ClaudeNotch)
20. „Antworten“-Knopf direkt auf der Fertig-Karte (ClaudeNotch)
21. Nachricht vormerken, die beim nächsten `Stop` zugestellt wird **(eigene Idee**, siehe terminal-reply.md 6**)**
22. Hinweis bei Kontext-Kompaktierung (Ping Island, `PreCompact`-Hook)
23. Weitermachen nach Usage-Reset anzeigen (Agent Island). Claude Code meldet `quota_auto_resume_*` als Notification ([Hooks: Notification](https://code.claude.com/docs/en/hooks#notification)).
24. Push aufs Handy über ntfy/Telegram (CodeIsland, Pushary) oder die offiziellen Telegram-/Discord-Channels ([Channels](https://code.claude.com/docs/en/channels))
25. Stumm, solange das Terminal der Session im Vordergrund ist (Notchi), Ruhezeiten (CodeIsland)
26. Sprachansage „Fertig in nikki“ (Notch Pilot)
27. Weitere Agent-Pills: Codex, Copilot CLI, OpenCode (Coucou, Vibe Island). Nikki: erweiterbare Registry laut PRODUCT.md.
28. Subagents einer Session anzeigen (`SubagentStart`/`SubagentStop`, Coucou installiert diese Events)
29. Laufende Hintergrund-Tasks und Crons einer Session zeigen (`Stop.background_tasks`, `session_crons`, [Stop input](https://code.claude.com/docs/en/hooks#stop-input))
30. Mehrere Konten/Profile (agentNotch, Claude Usage Tracker)
31. Rechner wach halten, solange ein Agent arbeitet (Isle, NotchThings, Developer Island „Keep-awake“). In Electron: `powerSaveBlocker` **(eigene Verknüpfung)**.

### 5.2 Medien

32. Now Playing mit Cover, Fortschritt, Play/Pause/Skip (fast alle, unter Windows über SMTC: Dynamic Edge, NSD, Windows Notch Overlay)
33. Insel-Glow in der Cover-Farbe (WinIsland, WinIsland/adityasrivastava, rajsriv)
34. Synchronisierte Lyrics über LRCLIB (NotchPixel, OpenNotch, DynamicNotch)
35. Mini-Visualizer in der zugeklappten Insel (Boring.Notch, Dynamic Edge, Nectar)
36. **Nikki wippt im Takt / tanzt, während Musik läuft** (Vorbild ActivSpot: Katze reagiert auf Musik)
37. Ausgabegerät wechseln, Mixer pro App (WinIsland, Isle Notch, FluentFlyout)
38. Mausrad über der Insel ändert die Lautstärke (Dynamic Edge)
39. Wischen für den nächsten Titel (NotchNook)
40. Umschalten zwischen mehreren Playern (Dynamic Edge, FluentFlyout)
41. Alten Player pausieren, wenn ein neuer startet (Media Flyout)
42. „Up Next“ anzeigen (FluentFlyout, Droppy)

### 5.3 Kalender, To-do, Notizen, Zeit

43. Nächster Termin mit Countdown in der zugeklappten Insel (NotchPixel, Isle Notch)
44. Meeting-Link (Zoom/Meet/Teams) mit einem Klick beitreten (SuperIsland)
45. Tag per Wischen wechseln (NotchNook)
46. Termine anlegen und löschen (Notchy/kryz3)
47. To-do-Liste (NotchNook, Notchify, Isle Notch, NotchThings)
48. Notizblock, gern Markdown (Notchy/kryz3 mit Zeichenfläche, Notchify, Isle)
49. **To-do mit einem Klick als Prompt an Claude oder Cursor schicken. Agent-Ergebnis als To-do abhaken (eigene Idee).**
50. **Notiz als Kontextdatei an den Prompt hängen (eigene Idee)**
51. Timer und Pomodoro, Fokus-Timer (sehr viele)
52. Timer per Sprache stellen (WinIsland LingoSoul)
53. Weltuhr (Notchify), Teleprompter (NotchThings), Stoppuhr (NotchThings)
54. Wetter (sehr viele)

### 5.4 Dateien

55. Shelf: Dateien parken, rein- und rausziehen (NotchDrop, NotchNook, Droppy, NotchPixel)
56. Vorschau der geparkten Datei (DynamicLake Quick Look, Atoll/rutmehta, Nusa siehe 1.2 und 1.5)
57. **Shelf-Datei per Klick an den nächsten Prompt hängen (eigene Idee).** Nikki: Drop auf die Insel ergibt heute einen Pfad im Prompt.
58. Automatisch leeren nach X Tagen (NotchDrop 1 Tag, Isle 7 Tage)
59. Komprimieren, Konvertieren (DynamicLake, Droppy, DropNotch Pro)
60. Teilen über den Windows-Share-Dialog (DynamicWin)
61. Handy-Transfer per QR-Code (NotchPixel, Notchify, Oyenza)
62. Andere Aktion je nach Seite der Insel, auf der man ablegt (DropNotch)
63. Screenshot mit Annotation und direkt an den Prompt (Isle, OpenNotch; Prompt-Anbindung als **eigene Idee**)
64. Downloads-Fortschritt (Atoll, Notchify, NSD)

### 5.5 Clipboard

65. Clipboard-Verlauf mit Pins (NotchPixel, Notchify, Atoll)
66. Passwortmanager auslassen (NotchPixel)
67. „Kopierten Link öffnen?“ (WinIsland)
68. **Kopierte Fehlermeldung oder Stacktrace mit einem Klick an Claude („Erklär/fix das“) (eigene Idee)**

### 5.6 System und HUD

69. Lautstärke-/Helligkeits-Flyout ersetzen (NotchPixel, FluentFlyout, ModernFlyouts)
70. Akku/Laden und Bluetooth-Kopfhörer-Akku (NotchPixel, DynamicWin, Dynamic Edge)
71. Mikro global stumm per Hotkey mit Call-Timer (NotchPixel)
72. Kamera-/Mikro-in-Benutzung-Anzeige (WinIsland, Developer Island)
73. CPU/RAM/GPU (sehr viele). **Nur einblenden, während ein Agent baut oder testet (eigene Idee)**
74. Netzwerk-Geschwindigkeit (NSD)
75. Caps-/Num-Lock-Anzeige (rajsriv, FluentFlyout, ModernFlyouts)
76. Schnellschalter für WLAN, BT, Nachtlicht und Fokus (NotchPixel, Nectar)

### 5.7 Benachrichtigungen und Integrationen

77. Windows-Benachrichtigungen in der Insel spiegeln (Notchify, NotchPixel, WinIsland, NSD)
78. Benachrichtigungen mit Aktionsknöpfen (SuperIsland)
79. Popup-Flut dämpfen („Quiet Feed Mode“, Dynamic Edge)
80. GitHub-PRs und CI-Status (Developer Island). Nikki: PR-Anzahl optional über `gh`.
81. **Lokale API/CLI, über die Skripte etwas in die Insel schreiben**, z. B. `nikki notify "Build grün"` (NotchPixel „Live tiles from your scripts“). Nikki hat dafür schon den Hook-Server.

### 5.8 Bedienung und Darstellung

82. Öffnen bei Hover mit Verzögerung (NotchNook, Boring.Notch, Mew Notch „hover delay“)
83. „Hide until hovered“, „Shake to cloak“ (Smart Notch)
84. Überlappenden Fenstern ausweichen (Nectar „Smart“-Modus)
85. Insel oben oder als „Blade“ am Bildschirmrand (Dynamic Edge)
86. Kompaktmodus (DynamicLake „miniLake“)
87. Insel auf allen Monitoren (Isle Notch, OpenNotch). Nikki: Display unter dem Cursor.
88. In Screenshots und Aufnahmen unsichtbar (WinIsland). In Electron: `setContentProtection` **(eigene Verknüpfung)**.
89. Regeln pro App, z. B. „in Teams-Calls nie aufklappen“ (NotchPixel)
90. Radialmenü / Action Ring per Hotkey (Droppy, NotchThings)
91. Launcher / Befehlspalette (vaho, ActivSpot)
92. Touch-Bedienung (WinIsland)
93. Live-Reload der Einstellungsdatei (Nectar)

### 5.9 Maskottchen und Charakter

94. Augen folgen dem Mauszeiger und schauen auf eine hereingezogene Datei (Isle Notch, Oyenza). Nikki: Cursor-Tracking ist da (`main.js:256-270`), der Datei-Blick fehlt.
95. Schläft nachts (Oyenza 0–5 Uhr). Nikki: schläft nach Leerlauf (`renderer/companion.js:11`).
96. Reagiert auf Musik und Benachrichtigungen (ActivSpot)
97. Mehrere Gesichtsausdrücke je Agent-Zustand (Notch Pilot: 6 Figuren × 7 Ausdrücke, Notchi)
98. Freudensprung bei „fertig“ (Coucou). Nikki hat Zustandsanimationen, ob ein Sprung dabei ist, wurde nicht geprüft.
99. Soundpacks (Vibe Island, Coucou mit austauschbaren Sounds)
100. Ein Maskottchen pro Session (Notchi), z. B. Nikki und ihre Geschwister für parallele Sessions **(Abwandlung)**

### 5.10 Sprache

101. Wake Word „Hey Nikki“, dann Prompt diktieren (WinIsland LingoSoul, Coucou „OK Coucou“)
102. Push-to-talk-Hotkey als sparsame Alternative zum Dauer-Mikro **(eigene Idee)**
103. Antwort oder Status vorlesen (Notch Pilot)

### 5.11 Erweiterbarkeit

104. Plugin-/Widget-System (DynamicLake, Droppy, SuperIsland JS-SDK, vaho HTML/CSS/JS, k4 mit Store)
105. Script-Widgets, die die Ausgabe eines Befehls zeigen (BetterTouchTool, Mew Notch)

---

## 6. Priorisierung für Nikki

Grundlage: Produktprinzipien aus [PRODUCT.md](../../PRODUCT.md):
- Glanceable first
- Nie den Fokus stehlen
- Das Maskottchen trägt die Emotion
- Echtes Claude-Code-/Cursor-Verhalten, keine zusätzlichen API-Keys

Dazu die Nutzer-Vorgabe (Agent 2, 2026-10-30): Kalender, Medien/Spotify, Sprachsteuerung mit Wake Word, Datei-Ablage mit Vorschau, To-do und Notizblock sind gesetzt. Die Machbarkeit steht in Abschnitt 4.

### Muss

| # | Feature | Warum |
| :- | :- | :- |
| 1 | **Freigaben, Fragen und Pläne für Terminal-Sessions** (Ideen 1, 2, 10) | Kern des Agent-Companions. Fast jedes Gruppe-B-Tool kann es. Bei Nikki fehlt es heute, weil alle Hooks `async` laufen. Weg: [terminal-reply.md](terminal-reply.md), Stufe 1. |
| 2 | **Medien** mit Cover, Fortschritt, Steuerung und Lautstärke (32, 37, 40) | Nutzer-Vorgabe. In praktisch jedem Notch-Tool vorhanden. Unter Windows über SMTC. |
| 3 | **Kalender**: nächster Termin in der zugeklappten Insel, Tagesliste aufgeklappt (43, 44) | Nutzer-Vorgabe. In fast jedem großen Tool. |
| 4 | **Datei-Ablage mit Vorschau**, rein und raus, plus „an Prompt hängen“ (55–58) | Nutzer-Vorgabe. Passt zu Nikkis vorhandenem Datei-Drop. |
| 5 | **To-do-Liste** und **Notizblock**, lokal, mit „als Prompt senden“ (47–50) | Nutzer-Vorgabe. Die Agent-Verknüpfung unterscheidet Nikki von reinen Notch-Tools. |
| 6 | **Sprachsteuerung mit Wake Word „Hey Nikki“**, Start mit Push-to-talk (101, 102) | Nutzer-Vorgabe. Größter technischer Aufwand, daher zuerst Push-to-talk, dann Wake Word. |
| 7 | **Letzte Antwort und Details von Terminal-Sessions** zeigen (16, PermissionRequest-Details) | Fast kostenlos, die Daten kommen schon über die Hooks. |
| 8 | **Hotkeys für Erlauben/Ablehnen** und Zifferntasten für Optionen (5, 6) | Klein, folgt dem Prinzip „ohne Fensterwechsel freigeben“. |

### Nice-to-have (grob nach Nutzen sortiert)

1. Plan-Limits und Usage-Ring (12, 14), Kosten/Token (13). Datenquelle laut ClaudeBar: `claude /usage` oder die OAuth-Usage-API mit dem lokalen Token ([ClaudeBar Claude-Provider](https://github.com/tddworks/ClaudeBar/blob/main/docs/providers/claude/README.md)). Die API ist **nicht offiziell dokumentiert (unsicher)**.
2. Ins richtige Terminal springen (11). „Nachricht vormerken“ (21). Nikki-Channel für Folge-Prompts (siehe terminal-reply.md, Stufe 2).
3. Diff-Vorschau und +N/−M (3, 4). Auto-Approve-/Block-Listen (8). Ablehnen mit Grund (9). Riskante Befehle halten (7).
4. Nikki tanzt zur Musik (36), Glow in Cover-Farbe (33), Lyrics (34), Visualizer (35)
5. Timer/Pomodoro (51), Wetter (54)
6. Clipboard-Verlauf mit „an Claude schicken“ (65, 66, 68)
7. Wachhalten, solange ein Agent arbeitet (31). Stumm bei Terminal-Fokus und Ruhezeiten (25).
8. Lokale `nikki notify`-API für Skripte (81). GitHub-CI-Status (80).
9. Mehr Agent-Pills: Codex, Copilot CLI (27). Subagents (28). Hinweis bei Kompaktierung (22).
10. Hover-Öffnen mit Verzögerung (82), Insel in Aufnahmen verstecken (88), Regeln pro App (89)
11. Mikro-Stumm-Hotkey, Kamera/Mikro-Anzeige, Akku/BT-Akku (70–72)
12. Mehr Gesichtsausdrücke, Freudensprung, Datei-Blick (94, 97, 98)

### Nein (vorerst)

| Feature | Grund |
| :- | :- |
| Windows-Lautstärke-/Helligkeits-OSD ersetzen (69) | Erfordert, das System-OSD zu unterdrücken. Dafür gibt es keine offizielle Windows-API **(unsicher, siehe Abschnitt 4)**. ModernFlyouts ist archiviert. Kollidiert mit „UI stays quiet“. |
| Alle Windows-Benachrichtigungen spiegeln (77) | Datenschutz, hoher Aufwand, nicht Nikkis Kern. Später als opt-in denkbar. |
| Chat mit eigenem API-Key, KI-Emotionsanalyse (Coucou-Chat, Notchi) | Widerspricht „no separate API keys“. |
| Tastendrücke ins Terminal (Claude-Island-tmux, ClaudeNotch-CGEvent) | Fragil, unter Windows ohne offizielle API (terminal-reply.md 3.8). |
| Eingebettetes Terminal (Notchy, Atoll) | Großer Umbau, Nikki startet Sessions schon über SDK/ACP. |
| Webcam-Spiegel, Bildschirmaufnahme, OBS/Twitch, Song-Erkennung, Minispiele, OCR, Taskleisten-Dock | Fern vom Zweck „Agent-Companion“. |
| Lockscreen-Widgets | macOS-Konzept, unter Windows für Dritt-Apps nicht vorgesehen **(unsicher)** |
| Plugin-Markt / Theme-Store | Verfrüht. Erst Kernfunktionen, später höchstens ein lokales Widget-API. |
| Coucou-Name, Mochi, Icon oder Sounds übernehmen | © Louis Raillé, ausgeschlossen laut [PRODUCT.md](../../PRODUCT.md) und [Coucou-README](https://github.com/Louis-CFM/coucou) |
