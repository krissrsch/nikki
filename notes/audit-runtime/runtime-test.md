# Nikki: Laufzeit-Test (Windows 11)

Stand: 2026-10-30, Commit `a2a48ca` (Release Nikki 1.0). Getestet von Agent 5 („Laufzeit-Test“). Am App-Code wurde nichts geändert.

## Umgebung und Methode

- Windows 11 Home 10.0.26200, zwei Monitore mit je 1920×1080 bei 100 % (Monitor 2 rechts, y-Versatz 3 px)
- Electron 45.0.0 (Dev-Start `electron .`), Claude Code CLI 2.1.312, Agent SDK 0.3.308, Cursor CLI eingeloggt, Gemini CLI nicht installiert
- Gesteuert per Playwright 1.56.1 `_electron.launch` aus einem Scratch-Ordner. Playwright wurde nicht installiert und nicht committet, `package-lock.json` ist zurückgesetzt.
- Mitgeschrieben wurden Hauptprozess-stdout/stderr, Hauptprozess-`console.*`, Renderer-Konsole, `pageerror` und ein `unhandledRejection`-Listener im Hauptprozess. Ein Spy auf `Notification.prototype.show` hat Toasts samt `show`/`failed`-Event protokolliert.
- Echte Betriebssystem-Eingaben (user32 `keybd_event`, `SetCursorPos`, `mouse_event`) für Hotkey, Mausklick, Klick-Durchgriff und OLE-Drag & Drop. Desktop-Screenshots per `CopyFromScreen`; fremde Fenster außerhalb der Insel sind unscharf gemacht.
- Die App lief ohne `CLAUDECODE`-, `CLAUDE_CODE_*`- und `ANTHROPIC_*`-Variablen, also so, als hätte der Nutzer sie gestartet.
- Stubs nur dort, wo ein echter Klick Nutzerdaten verändert oder nicht automatisierbar ist:
  - `dialog.showOpenDialog`, nur für die Ordner*auswahl*. Der echte Dialog wurde geöffnet und abgebrochen.
  - `shell.openExternal` und `clipboard.writeText` beim Git-/AI-Studio-Test.
  - Tray-Einträge über `MenuItem.click()` derselben Menü-Instanz. Das Tray-Icon liegt im Überlauf-Bereich, der echte Rechtsklick dort war per Automation nicht zuverlässig.
- Testordner: leerer Scratch-Ordner `…\scratchpad\testproj` außerhalb des Repos.

## Ergebnisübersicht

| # | Testfall | Ergebnis | Details |
|---|---|---|---|
| 1a | Kaltstart: Intro/Spawn | ok | Lichtblitz → Nikki fällt → läuft zum Home-Platz → Karten blenden ein, ca. 3 s. Keine Fehler in den Konsolen. `01-boot-sequence.png` |
| 1b | Insel öffnen/schließen | ok | Pill-Klick (Playwright und echter Mausklick), Escape, Nav-Buttons. Klick-Durchgriff stimmt: über der Insel `through=false`, daneben `true`. `03-island-closed*.png`, `02-home-desktop.png` |
| 1c | Home-Menü | ok | Agenten-Grid (Claude, Cursor, Git, AI Studio), Projekt-Button, Chat-Wahl, Ton/Plan/Neu. Der zuletzt genutzte Chat wird geladen (siehe B2). |
| 2a | Hotkey Ctrl+Alt+Space | ok | Registriert (Fallback Ctrl+Alt+K nicht nötig). Öffnet die Insel, nochmal drücken lässt sie offen, holt sie aus „ausgeblendet“ und über Vollbild zurück. Folgt dem Mauszeiger auf Monitor 2. `05-hotkey-monitor2-desktop.png` |
| 2b | Tray: Menü | ok | Einträge und Häkchen stimmen. `06-tray-menu-desktop.png` (Menü-Template als Popup gerendert) |
| 2c | Tray: Töne | ok | Häkchen weg → Renderer `muted=true`, `state.json` `muted:true`, und zurück. Der Ton-Button in der Insel baut das Tray-Menü synchron neu. |
| 2d | Tray: Ein-/Ausblenden, Tray-Klick | ok | Fenster wird versteckt und wieder angezeigt. Tray-Klick öffnet die Insel aufgeklappt. |
| 2e | Tray: Autostart | nicht testbar | Im Dev-Modus absichtlich deaktiviert (`app.isPackaged=false`). Nur der Eintrag „ausgegraut“ wurde geprüft. |
| 2f | Tray: Hooks | siehe 8 | |
| 2g | Tray: Beenden | ok | Sauberer Exit. Electron-Prozesse, PowerShell-Vollbild-Wächter und claude.exe-Kinder sind weg, keine Fehler. |
| 3a | Projektordner wählen | ok | Nativer Dialog „Ordner auswählen“ öffnet modal über der Insel (`08-folder-dialog.png`). Abbrechen lässt das Projekt unverändert. Auswahl per Stub → Projekt aktiv, Backend pro Projekt (testproj → Claude). |
| 3b | Wechseln / letzte Ordner | ok | Neuer Ordner steht oben, der aktive ist markiert, maximal 8 Einträge. Wechsel über die Liste funktioniert. `07-`, `09-project-menu*.png` |
| 4a | Claude: einfacher Prompt | **Bug** (B2) | Erster Prompt nach dem Projektwechsel scheitert mit „No conversation found with session ID …“ (`12-bug-stale-session.png`). Nach „Neue Session“ ok: Antwort in ca. 5,5 s (Haiku). `12-chat-done.png` |
| 4b | Streaming | Bug, niedrig (B10) | Claude: kein Text-Streaming, nur Schritte („Nikki denkt…“), die ganze Antwort erscheint erst bei „fertig“. Cursor streamt sichtbar (Antwort wächst von 24 auf 258 Zeichen). |
| 4c | Stop | ok, mit **Bug** (B5) | Stop greift nach 216 ms, Status „Nikki stoppte.“. Im Chat bleibt aber „[ede_diagnostic] result_type=user …“ als Nikki-Antwort stehen und wird gespeichert. `13-`, `14-bug-stop-diagnostic.png` |
| 4d | Session fortsetzen | ok | „Was war meine allererste Frage?“ → „…fünf kurze Sätze über Katzen…“. `15-chat-resume.png` |
| 4e | Neue Session | ok, mit **Bug** (B4) | „+“ leert den Chat und setzt die Session zurück. Wird direkt nach „fertig“ gesendet, kommt etwa 2,5 s lang „Der Start ist fehlgeschlagen…“. |
| 5a | Berechtigung: Erlauben | ok | `node -e "console.log(6*7)"` → Karte „Bash ausführen?“ → Erlauben → 42. (`mkdir` löst in acceptEdits keine Karte aus, das ist erwartet.) `18-permission-card.png` |
| 5b | Berechtigung: Immer | ok | Regel `Bash(node -e "console.log\(2+3\)")` landet in `testproj\.claude\settings.local.json`, die Wiederholung fragt nicht mehr. |
| 5c | Berechtigung: Ablehnen | ok | `git init` abgelehnt → kein `.git`, Agent meldet die Ablehnung. `19-after-deny.png` |
| 5d | Agent-Frage | ok | AskUserQuestion-Karte mit Rot/Blau und eigenem Antwortfeld, Klick auf „Blau“ → Agent antwortet „Blau“. `20-agent-question.png` |
| 5e | Plan-Modus | teilweise, **Bug** (B7, B1) | Plan-Karte, Ablehnen mit Text und Annehmen funktionieren technisch. Der Änderungswunsch wurde aber vom Agenten verworfen (B7), und Dateinamen erscheinen als „notiz. txt“ (B1). `21-plan-card.png` |
| 6a | Ton „fertig“, Insel zugeklappt | ok | `chime('done')`, Status „Nikki fertig – tippen.“. Kein Toast: Toasts gibt es nur bei *ausgeblendeter* Insel, so ist es gebaut. `22-collapsed-done.png` |
| 6b | Ton + Toast „fertig“, Insel ausgeblendet | ok | Toast „Fertig in testproj.“ (`shown=true`) und Ton. Klick auf den Toast öffnet die Insel aufgeklappt. `23-toast-done-desktop.png` |
| 6c | „braucht dich“, Insel ausgeblendet | ok (Design-Hinweis) | Kein Toast: Die Insel wird wieder eingeblendet und der Ton spielt. Windows verhindert den Fokuswechsel (`isFocused=false`). `24-needsyou-while-hidden-desktop.png` |
| 6d | „braucht dich“ hinter Vollbild | teilweise | Toast „Der Agent braucht eine Erlaubnis.“ wird ausgelöst (`shown=true`), Windows zeigt ihn bei Vollbild aber nicht (automatisches „Nicht stören“). Hörbar bleibt nur der Ton. |
| 6e | Ton tatsächlich hörbar | nicht testbar | Nicht abgehört. Geprüft wurde `AudioContext.state = running` und der Aufruf von `chime()`. |
| 7a | Vollbild-Erkennung | ok | Randloses Vollbildfenster auf dem Hauptmonitor → Insel nach ≤ 0,5 s versteckt, nach dem Schließen wieder da. Hotkey zeigt sie über dem Vollbild. `26-`, `27-*.png` |
| 7b | Kaltstart über Vollbild | ok, mit **Bug** (B9) | Das Intro ist über dem Vollbild sichtbar, danach blendet sich die Insel aus (`40-boot-over-fullscreen-desktop.png`). Nikki nimmt dabei dem Vollbild-Fenster den Vordergrund. |
| 7c | Mehrere Monitore | ok | Hotkey mit Mauszeiger auf Monitor 2 → Insel oben mittig auf Monitor 2 (x=2500), zurück auf Monitor 1 (x=580). |
| 7d | DPI | nicht testbar | Beide Monitore laufen auf 100 %. Die Windows-Skalierung wurde nicht geändert (Nutzereinstellung). `--force-device-scale-factor=1.5` liefert verfälschte Display-Maße (853×480 DIP) und ist kein gültiger Ersatz. |
| 8a | Hooks einschalten | ok | Alle 8 Events in `~/.claude/settings.json` ergänzt, vorhandene Hooks (graphify, load-handoff) bleiben, alle anderen Schlüssel sind identisch. Laufende Claude-Code-Sessions erscheinen live als Pills. `29-`, `30-hooks-session-pills-*.png` |
| 8b | Hooks ausschalten | ok, mit Hinweisen (B8, B14) | Inhalt JSON-gleich zum Original, aber `hooks` steht danach am Dateiende. Beobachtete Sessions bleiben als eingefrorene Pills stehen. `31-bug-stale-session-pills-after-hooks-off.png` |
| 8c | Originalzustand | ok | Alle Nutzerdateien byte-genau wiederhergestellt, sha256 identisch (siehe unten). |
| 9a | Drag & Drop (offene Insel) | ok | Echter OLE-Drag aus einem Quellfenster → `"…\drop me.txt" ` steht im Prompt, Chat-Ansicht offen. Dateinamen mit Leerzeichen sind korrekt gequotet. `32-`, `33-os-drag-drop-desktop.png` |
| 9b | Drag & Drop (zugeklappte Insel) | sporadisch (B12) | 2 von 3 Versuchen ok (Insel öffnet, Pfad im Prompt), 1 Versuch ohne Wirkung (Drag-Ergebnis `None`). `34-drop-closed-island-*.png` |
| 9c | Markdown mit Code-Block | **Bug** (B1) | Überschrift, Liste, fett und kursiv ok. Code-Block, Inline-Code und Link werden verfälscht. `35-markdown-codeblock.png` |
| 10a | Cursor (kurz) | ok | Prompt in testproj streamt, Antwort korrekt. Modellmenü mit 270 Einträgen. `39-cursor-answer.png` |
| 10b | Gemini / AI Studio (kurz) | ok | Gemini CLI fehlt → Pill-Menü „Im Chat nutzen“ zeigt den Installationshinweis. Den Browser-Weg habe ich nicht geklickt (öffnet den Browser, überschreibt die Zwischenablage). `37-`, `38-*.png` |
| 10c | Git-Pill (kurz) | ok | Auf diesem Repo: „2 dirty“, Branch-Chip „agent-6-… · 2Δ“, Klick öffnet `https://github.com/krissrsch/nikki` (per Stub abgefangen). `36-git-pill.png` |
| 11 | Konsole Haupt/Renderer | ok | 0 Renderer-Fehler, 0 `pageerror`, 0 unhandled rejections. Nur Rauschen, siehe B15. |
| 12 | Zweitstart (Single-Instance) | ok | Zweites `electron .` endet nach 177 ms mit Code 0 und blendet die Insel der ersten Instanz ein. Auf stderr erscheinen nur harmlose Chromium-Cache-Meldungen. |

## Bugs nach Schwere

### Hoch

**B1: Markdown-Aufbereitung verfälscht Code, Inline-Code, Links und Dateinamen**
`softBreakSentences()` (`renderer/app.js:389`) setzt hinter jeden Punkt ein Leerzeichen, auch in Code-Blöcken, Inline-Code und URLs. Ergebnis im Test (gespeicherter Rohtext korrekt, nur die Anzeige ist falsch):
- Code-Block `console.log(fs.readFileSync("a.txt"))` → `console. log(fs. readFileSync("a. txt"))`, `user.profile.name` → `user. profile. name`
- Inline-Code `config.json` → `config. json`
- `https://example.com/docs` → Link zeigt auf `https://example`, Rest „. com/docs“ als Text
- Plan-Karte und Antworten: `notiz.txt` → `notiz. txt`, `console.log(9*9)` → `console. log(9*9)`

Wer Code aus der Insel kopiert, kopiert kaputten Code, und Links führen ins Leere.
Nachstellen: Claude-Prompt „Antworte exakt mit: ```js\nconsole.log(a.b)\n``` und https://example.com/docs“ → Code-Block und Link prüfen.

**B2: Wiederhergestellter Chat nimmt seine Session-ID in ein anderes Projekt oder Backend mit, und der alte Chat wird umgeschrieben**
Beim Start lädt die App den letzten Chat (hier: Projekt DesktopCompanion, Backend Cursor, Cursor-Session-ID). Nach einem Wechsel zu Projekt testproj und Backend Claude schickt `start()` weiter `chatSessionId` als Resume-ID (`renderer/app.js:1188`, gesetzt in `loadChat` `:681`). Folgen:
1. Claude-Lauf bricht sofort ab: „Claude Code returned an error result: No conversation found with session ID: 9b0e0f6b-…“ (auf Englisch, in Rot im Chat).
2. `persistChat()` speichert den alten Chat mit `cwd: current` und `backend` neu (`:454`): Der Cursor-Chat aus DesktopCompanion steht danach als Claude-Chat unter testproj, mit fremder Session-ID.

Nachstellen: Einen Chat in Projekt A mit Cursor führen → App neu starten → Projekt B wählen, Claude wählen → Prompt senden.
Umgehung: Vor dem ersten Prompt „+ Neue Session“ drücken.

### Mittel

**B3: Dev-Start schreibt die globalen Cursor-Hooks auf den Dev-Checkout um (gemeinsamer userData-Ordner)**
Dev (`npm start`, Name `desktopcompanion`) und die installierte App (`%LOCALAPPDATA%\Programs\desktopcompanion`) nutzen dieselbe Datei `%APPDATA%\desktopcompanion\state.json`. Ist dort `cursorHooks: true`, schreibt schon der Dev-Start `~/.cursor/hooks.json` auf `…\<Dev-Checkout>\hook.cjs` um (`main.js:644`). Im Test zeigten 5 Cursor-Hooks danach auf einen AgentOS-Worktree, der später gelöscht wird. Die Cursor-Hooks laufen dann ins Leere, bis die installierte App wieder startet. Außerdem landen Dev-Projekte und Dev-Chats in der echten App (und umgekehrt).
Nachstellen: Installierte App mit „Cursor-Sessions beobachten“ an → beenden → im Repo `npm start` → `~/.cursor/hooks.json` ansehen.

**B4: Senden direkt nach „fertig“ schlägt etwa 2,5 s lang fehl**
Der Renderer meldet „fertig“ schon bei der Result-Nachricht. Der Hauptprozess hält `agents.claude.busy()` aber, bis der SDK-Iterator samt CLI-Prozess beendet ist (`backends/claude.js:47`). Bis dahin lehnt `ipcMain.handle('start')` ab (`main.js:432`), und der Nutzer sieht „Nikki kommt nicht los. Der Start ist fehlgeschlagen. Läuft schon eine Aufgabe, oder existiert der Ordner nicht mehr?“. Gemessen: 20 Fehlversuche, erster Erfolg nach 2492 ms. Der Prompt-Text bleibt immerhin stehen.
Nachstellen: Kurzen Prompt senden, sofort nach „Nikki ist fertig.“ den nächsten Prompt mit Enter senden.

**B5: Stop schreibt einen internen Diagnose-Text als Nikki-Antwort in den Chat**
Nach Stop endet der SDK-Stream mit einem Fehler-Result. `toStatus` reicht `m.errors` als `answer` durch (`lib/status.js:51`), der Renderer übernimmt das per `finalizeAssistant` in den Verlauf. Im Chat steht dann `[ede_diagnostic] result_type=user last_content_type=n/a stop_reason=null` (bei Stop während einer Freigabe: `stop_reason=tool_use`), und das wird gespeichert.
Nachstellen: Langen Prompt senden („1500 Wörter…“), nach 3 s Stop drücken.

**B6: Enter im leeren Eingabefeld bricht die laufende Aufgabe ohne Rückfrage ab, auch bei offener Freigabe-Karte**
`promptEl` keydown: `if (busy) api.stop()` (`renderer/app.js:1437`). Während eine Freigabe-Karte wartet, hat das Eingabefeld den Fokus. Wer zum „Bestätigen“ Enter drückt, stoppt die ganze Aufgabe (Status „Nikki stoppte.“, dazu B5).
Nachstellen: Prompt mit Bash-Befehl → Karte „Bash ausführen?“ erscheint → ins Eingabefeld klicken → Enter.

**B7: Änderungswunsch beim Ablehnen des Plans kommt beim Agenten nicht als Nutzerwunsch an**
Plan „notiz.txt anlegen“ abgelehnt mit Text „Nenne die Datei bitte notiz2.txt.“. Der überarbeitete Plan nannte notiz2.txt und wurde angenommen. Der Agent legte trotzdem `notiz.txt` an und schrieb: „Der genehmigte Plan nannte notiz2.txt. Das kam aus einer Fehlermeldung des Plan-Tools, nicht von dir.“ Der Text geht als `deny`-`message` an das Tool zurück (`backends/claude.js:26`) und wird offenbar als Tool-Fehler und nicht als Nutzer-Feedback gelesen. 1 von 1 Versuch, das Verhalten ist modellabhängig.
Nachstellen: Plan-Modus an → „Lege notiz.txt mit Inhalt hallo an“ → Ablehnen mit „Nenne die Datei notiz2.txt“ → neuen Plan annehmen → Dateiname prüfen.

**B8: Beobachtete Sessions bleiben nach dem Ausschalten der Claude-Hooks eingefroren stehen und kapern die Insel**
Beim Ausschalten wird `terminal` nur geleert, wenn auch die Cursor-Hooks aus sind (`main.js:557`). Veraltete Einträge fliegen nur beim nächsten eingehenden Hook-Event raus (`main.js:478`, 30 min). Im Test blieben zwei Pills auf „working“ stehen. Die Insel zeigte dauerhaft „Nikki googelt…“, Home zeigte den Ordnernamen einer fremden Session statt „Claude“, auch nach dem Ende eigener Aufgaben und nach einem Toast-Klick.
Nachstellen: Cursor-Hooks an, Claude-Hooks an → in einem Terminal Claude Code etwas tun lassen → Claude-Hooks im Tray aus → Insel ansehen.

**B9: Kaltstart über einer Vollbild-App nimmt ihr den Vordergrund**
`runBootIntro` → `setOpen(true)` → `api.focus()` → `win.focus()` (`renderer/app.js:1532`, `:740`). Fokus-Messung beim Start über einem randlosen Vollbildfenster: 12 ms „Vollbild-Test“ → 1819 ms „desktopcompanion“ → 2085 ms „Nikki“. Ein Spiel im exklusiven Vollbild würde dabei minimiert oder verlieren den Fokus, etwa wenn Updater.exe Nikki während eines Spiels neu startet. Beim späteren Einblenden durch eine Freigabe hat Windows den Fokuswechsel verhindert, das betrifft also vor allem den Start.
Nachstellen: Vollbild-Spiel oder randloses Vollbildfenster im Vordergrund → Nikki starten → prüfen, welches Fenster den Vordergrund hat.

### Niedrig

**B10: Claude-Antworten werden nicht gestreamt.** `lib/status.js` liefert `answer` nur beim Result, Partial-Messages sind im SDK nicht aktiv. Die README verspricht „Streaming-Antworten“. Cursor streamt.

**B11: Kein Toast bei „braucht dich“, wenn die Insel ausgeblendet ist.** `askPermission` setzt `userHidden=false` und blendet die Insel ein, bevor `notify()` prüft, ob sie sichtbar ist. Der Toast entfällt also immer, außer bei Vollbild. Dort unterdrückt ihn aber Windows (automatisches „Nicht stören“), sodass nur der Ton bleibt. Wenn das Absicht ist, gehört es dokumentiert.

**B12: Drop auf die zugeklappte Insel greift sporadisch nicht.** Der Klick-Durchgriff wird während eines OS-Drags nur über den 100-ms-Cursor-Poll abgeschaltet. 1 von 3 echten Drags endete mit `DragDropEffects.None`. Wer kurz über der Insel verweilt, hat es zuverlässig.

**B13: Tray-Icon liegt standardmäßig im Überlauf-Bereich** (Windows-11-Standard für neue Icons). `tray.getBounds()` liefert dann die Position des Überlauf-Pfeils. Für Nutzer heißt das: Das Menü mit Hooks und Tönen ist erst nach dem Anheften sichtbar. Ein Hinweis im README wäre hilfreich.

**B14: Hooks aus stellt den Inhalt wieder her, aber nicht die Datei.** `withoutHooks`/`withHooks` (`lib/hooks.js:14`) nehmen `hooks` heraus und hängen es hinten wieder an. Dadurch wandert der Schlüssel in `settings.json` ans Ende. Außerdem wird `settings.json.desktopcompanion-backup` bei jedem Umschalten überschrieben, das Backup enthält nach „aus“ die Version *mit* Hooks.

**B15: Konsolenrauschen.** stderr „INFORMATION: Es konnten keine Dateien mit dem angegebenen Muster gefunden werden.“ (`where.exe`, Gemini fehlt) bei jedem `get-state` und Projektwechsel (6× im Lauf). Bei jedem Claude-Lauf außerdem `claude 2.1.312 ungetestet (getestet: 2.1.308)` doppelt (stderr und console.warn).

**B16: Kosmetik.**
- Statustext mit doppelten Auslassungspunkten „Nikki: S="C:/Users/kri……“ (`lib/status.js:21`: `short()` hängt „…“ an, das Template noch einmal).
- Toast zeigt „Nikki“ zweimal (App-Name und Titel).
- „zzz“ der schlafenden Katze ist in der zugeklappten Insel oben angeschnitten.
- Cursor-Modellmenü mit 270 Einträgen.
- Fehlertexte aus der CLI kommen ungefiltert auf Englisch in die Insel.

## Nutzerdaten: gesichert und wiederhergestellt

Vor dem ersten Start ins Scratch-Verzeichnis gesichert, nach dem Test byte-genau zurückkopiert und per sha256 verglichen. Alle Hashes sind identisch mit dem Stand vor dem Test:

| Datei | sha256 vorher = nachher |
|---|---|
| `~/.claude/settings.json` | `e4b10855…66ced7f` |
| `~/.claude/settings.json.desktopcompanion-backup` | `967fe402…ecf1b2cc` |
| `~/.cursor/hooks.json` (vom Dev-Start umgeschrieben, B3) | `becd0613…251a04` |
| `~/.cursor/hooks.json.desktopcompanion-backup` | `becd0613…251a04` |
| `%APPDATA%\desktopcompanion\state.json` (Projekte/Chats vom Test) | `908c17d5…4245a1` |
| `%APPDATA%\desktopcompanion\hook.json` | `f8a3c2cc…5253f5` |

Außerdem entfernt: die Claude-Transkripte der Test-Chats unter `~/.claude/projects/…-scratchpad-testproj`.
Nicht entfernt: der Cursor-Test-Chat (bei Cursor gespeichert) und der Chromium-Cache im gemeinsamen userData-Ordner.
Während Test 8 (etwa eine Minute) haben auch andere laufende Claude-Code-Sessions auf diesem Rechner ihre Hook-Events an die Test-Instanz geschickt. Das läuft asynchron und blockiert nicht.
Die Claude- und Cursor-Läufe liefen über die Abos des Nutzers: ca. 20 kurze Haiku-Läufe und 1 Cursor-Lauf.

## Screenshots

`notes/audit-runtime/screens/`, nummeriert nach Testablauf. `*-desktop.png` sind echte Bildschirmaufnahmen, alles außerhalb der Insel ist unscharf. Die übrigen Bilder sind Fensteraufnahmen per Playwright mit transparentem Hintergrund. Bug-Bilder heißen `*-bug-*.png`. `17-bug-start-too-soon.png` zeigt den Moment, in dem der Start nach ca. 2,5 s endlich klappt; der Fehlertext steht unter B4.
