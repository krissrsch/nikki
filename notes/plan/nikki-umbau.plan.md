Gegrillt: ja

# Plan: Nikki-Umbau zur Notch-App mit Claude-Begleiter

**Quellen**: Grilling-Runden Q1–Q29 (2026-10-30), `notes/research/competitors.md`, `notes/research/terminal-reply.md`, `notes/research/home-layouts.md`, `notes/audit/code-review.md`, `notes/audit-runtime/runtime-test.md`
**Design-Referenz**: Canvas https://claude.ai/artifact/94pCQafBMY4VtjbwaHKkom (zugeklappt: Augen + Schnurrhaare, aufgeklappt: Dashboard, Chat-Tab, Module, Notizblock)
**Komplexität**: Groß (5 Phasen, jede endet mit Tests und einem Release)

## Stand (2026-10-30, nachts)

| Phase | Stand |
|---|---|
| 0 | **Fertig.** Cursor, Gemini, AI Studio und Git-Pill sind entfernt. B1–B16, H1–H4, M1–M12 und N1–N12 sind behoben, bis auf die rohen englischen CLI-Fehlertexte. `npm test` und `npm run e2e` (Playwright, isoliert) sind grün. Kein Release: Der Nutzer muss `npm run release` freigeben. |
| 1 | Teil 1 **fertig**: Notch mit Augen und Schnurrhaaren, Glance-Rangfolge, Tabs, Chat-Status-Punkt, Höhen-Animation, Settings, schlanker Tray, frei belegbarer Hotkey. Teil 2 **läuft**: Modul-Registry, Dashboard, Notizblock, To-do, Timer, Kalender. Abweichung: Renderer-Logik liegt als klassisches Skript mit vm-Test in `renderer/` statt in `lib/`; ES-Module kommen später. |
| 2 | 2.1 und 2.3a **fertig**: Freigaben, Fragen und Pläne aus Terminal-Sessions lassen sich in der Insel beantworten (`hook.cjs --wait`, `lib/relay.js`, fail-open, #15433 abgefangen). Nachrichten lassen sich für arbeitende Sessions vormerken (`hook.cjs --stop`). Den Schalter „Freigaben in Nikki beantworten“ gibt es in den Settings. Offen: 2.2-Details (letzte Antwort aus `Stop`, Hotkeys für Erlauben/Ablehnen) und 2.3b, der Nikki-Channel. |
| 3 | Der Spike für den C#-Helfer läuft (SMTC + Lautstärke). Die Module folgen nach Phase 1, Teil 2. |
| 4 | Das Referenzfoto ist da (privat, außerhalb des Repos), beschrieben in `gedaechtnis/nikki-aussehen.md`. |

## Zusammenfassung

Nikki wird eine Mischung aus Notch-App und Begleiter für Claude Code. Cursor, Gemini, AI Studio, die Agenten-Tabs und die Git-Pill fliegen raus. Nikki chattet weiter selbst mit Claude Code und kann zusätzlich Freigaben, Fragen und Pläne aus Claude-Code-Sessions im Terminal beantworten. Dazu kommen Module wie bei Nusa, NotchNook und Boring.Notch: Musik, Kalender, Ablage, To-do, Notizblock, Timer, Clipboard, Sprache. Jedes Modul lässt sich in den Settings ein- und ausschalten. Alles bleibt lokal.

## Festgelegte Entscheidungen

| # | Entscheidung |
|---|---|
| Q2/Q9 | Cursor, Gemini, AI Studio, Agenten-Tabs und Git-Pill komplett aus dem Code entfernen. Branch und Änderungszähler bleiben klein im Chat. Git/GitHub wird später über die Settings verbunden. |
| Q8 | Settings als eigene Ansicht in der Insel, geöffnet über das Zahnrad. Der Tray bietet nur noch Ein-/Ausblenden, Settings und Beenden. |
| Q10 | Jede Notch-Funktion ist ein Modul, das sich in den Settings ein- und ausschalten lässt. Ab Werk sind nur wenige an. |
| Q11/Q12 | Alle Claude-Code-Sessions im Terminal sind sichtbar. Die Session des gewählten Projekts hat Vorrang. Aus der Insel lassen sich Freigaben erteilen, Fragen beantworten und Folge-Prompts schicken. |
| Q14 | Medien über die Windows-Mediensteuerung (SMTC). Die Spotify-API kommt höchstens später als optionales Modul. |
| Q15 | Eigener lokaler Kalender, keine Synchronisierung. |
| Q16/Q29 | Sprache nur lokal. Push-to-Talk ist immer verfügbar, das Wake Word „Hey Nikki“ ist ab Werk aus. Diktat wirkt zuerst nur in Nikki. |
| Q17/Q27 | Die Ablage speichert Kopien, die einen Neustart überstehen. Von Nusa übernommen: Mehrfachauswahl, Text-Karten, „Alles leeren“, und ein abgebrochenes Ziehen verliert nichts. |
| Q18 | To-dos und Notizen gibt es global und pro Projekt, mit „An Chat“. Niedrige Priorität. |
| Q19 | Ein C#-Helfer für Windows-APIs nach dem Muster von `updater/Updater.cs`. |
| Q20/Q22/Q23 | Zugeklappt sind nur Augen in der Mitte zu sehen. Die Schnurrhaare reichen etwa 18 px in die Notch und ragen etwa 15 px hinaus. Die Augen zeigen die Stimmung: schläft, wach, schaut, hüpft, ^ ^, tanzt zur Musik. Bei Aktivität wird die Notch breiter. Nikki als Figur gibt es nur an wenigen Stellen, nach Referenzfotos der echten Katze. Coucous Mochi wird nicht kopiert. |
| Q21 | Reihenfolge: Phase 0 Bugs und Entfernen, 1 Gerüst und Settings, 2 Terminal-Rückkanal, 3 Module, 4 Design. |
| Q24 | Folge-Prompts an Terminal-Sessions: (a) Nikki-Channel als Opt-in mit Preview-Hinweis, dazu (b) „Nachricht vormerken“ über den Stop-Hook. Kein Tippen per Tastendruck ins Terminal. |
| Q25 | Aufgeklappt: Tab-Leiste mit Home (Dashboard „Heute“), Chat (Sprechblase und Status-Punkt: gelb heißt braucht dich, grün fertig, rot Fehler), Modul-Tabs und Zahnrad. Der Chat existiert nur im Chat-Tab. Die Höhe ändert sich mit einer weichen Animation. |
| Q26 | Die Muss-Liste der Recherche plus Timer, Clipboard mit „An Chat“, Usage-Ring, Wachhalten während Agent-Arbeit, Lyrics und Nikki, die zur Musik tanzt. Die übrigen Ideen kommen in einen Backlog. |
| Q28 | Der Hotkey ist in den Settings frei belegbar. Developer Island nutzt ebenfalls `Ctrl+Alt+Space`. |

## Muster, die übernommen werden

| Kategorie | Quelle | Muster |
|---|---|---|
| Reine Logik + Tests | `lib/status.js`, `lib/status.test.js:1-20` | ESM-Funktionen in `lib/`, Test daneben als `*.test.js`, `node:test` + `assert/strict`, Aufruf mit `npm test` |
| IPC | `preload.cjs:5-40`, `main.js:329-456` | Schmale `companion`-API: `invoke` für Anfragen, `send` für Befehle, `on(channel)` für Events. Im Main-Prozess `ipcMain.handle` bzw. `ipcMain.on` |
| Texte für Nutzer | `lib/status.js` | Deutsche Statussätze in Nikkis Stimme („Nikki liest App.tsx…“, „Nikki stolpert.“) |
| Fehler | `main.js:48-58` | **Nicht übernehmen**: `catch {}` verschluckt Fehler still (H2). Neu: atomar schreiben, bei Defekt sichern und Bescheid geben |
| Renderer | `renderer/app.js`, `renderer/index.html:168-172` | Vanilla JS als klassische Skripte, Markdown über `marked` + `DOMPurify`, GSAP ist installiert |
| Design-Tokens | `renderer/style.css:1-27` | Farben (`--black`, `--card`, `--raised`, `--accent` #a9e7bd, `--warn`, `--bad`), Easing-Tokens, Segoe UI Variable |
| Natives Hilfsprogramm | `updater/Updater.cs`, `updater/build.cmd` | C# mit `csc`, ohne NuGet |

## Phase 0: Aufräumen und Bugs (Release 1.1)

Zwei Coder arbeiten parallel. Coder A übernimmt `main.js`, `lib/`, `backends/`, `hook.cjs`, `updater/` und `package.json`, Coder B übernimmt `renderer/`.

### 0.1 Cursor, Gemini, AI Studio, Agenten-Tabs und Git-Pill entfernen (A + B)
- **Zuerst migrieren**: Ist `store.cursorHooks` gesetzt, beim Start einmal `writeCursorHooks(false)` aufrufen und das Flag löschen. Erst danach den Cursor-Zweig in `hook.cjs` entfernen.
- **Löschen**: `backends/cursor.js`, `backends/gemini.js`, `backends/acp-client.js`, `lib/cursor-models.js`, `lib/cursor-path.js`, `lib/gemini-path.js`, `lib/hooks-cursor.js` samt Test, `lib/status-cursor.js` samt Test, `assets/brands/cursor.svg` und `assets/brands/googlegemini.svg`. Dazu die IPCs `cursor-models`, `open-aistudio`, `git-status`, `git-open-remote` und `toggle-favorite`, soweit sie nur Cursor betreffen.
- **Renderer**: Agenten-Tablist, Agent-Raster, Git-Pill und AI-Studio-Pill raus. Branch nur noch per `git branch --show-current`, ausgelöst durch Projektwechsel und Turn-Ende (M12). `gh` entfällt.
- **Prüfen**: `npm test` ist grün, `grep -ri "cursor\|gemini\|aistudio" --include=*.js .` findet nur noch die Migration.

### 0.2 Daten sicher schreiben (A): H2, H3, B14, N3, M8, N4
- Neu: `lib/json-file.js` mit `readJson` (entfernt BOM; eine defekte Datei wird nach `*.corrupt-<ts>` verschoben, dazu ein Hinweis) und `writeJsonAtomic` (erst Temp-Datei, dann `rename`; ein Symlink wird aufgelöst).
- `state.json` und `~/.claude/settings.json` laufen darüber. Das Backup wird nur einmal angelegt, nämlich wenn noch keins existiert und die Datei keine Nikki-Hooks enthält. Vor dem Schreiben die mtime vergleichen.
- Die Schlüsselreihenfolge in `settings.json` bleibt erhalten (B14). `withoutHooks` entfernt nur Gruppen, die durch unser Filtern leer geworden sind (N4).
- Schreibfehler zeigen eine Meldung und brechen den Start nicht ab (M8).
- **Prüfen**: `lib/json-file.test.js` deckt Abbruch mitten im Schreiben, BOM, kaputtes JSON und „Backup nur einmal“ ab.

### 0.3 Claude-Backend robust machen (A): H4, M5, B4, B5, N1, N2, N9, N10
- `query()` steckt im `try`. Nikki merkt sich, ob ein Abschluss-Status gesendet wurde, und im `finally` kommt immer `idle` oder `error`.
- Stop ruft `interrupt()` auf, nach 3 s zusätzlich `abortController.abort()`. In `will-quit` wird abgebrochen.
- „Fertig“ gibt den Start sofort frei. Ein Prompt, der kommt, solange der alte Prozess noch ausläuft, wird in eine Warteschlange gestellt statt abgelehnt (B4).
- Fehler- und Diagnosetexte wie `[ede_diagnostic]` landen nicht im Chatverlauf (B5, N2). Bei einem Fehler-Result `||` statt `??` (N1).
- `ANTHROPIC_AUTH_TOKEN` und `ANTHROPIC_BASE_URL` werden ebenfalls entfernt (N10).
- **Prüfen**: `query` wird injizierbar, und `backends/claude.test.js` deckt mit einem Fake-Stream ab: Stream ohne Result, Stop, synchroner Throw.

### 0.4 Renderer-Bugs (B): B1, B2, B6, B7, N7, N8, B16
- `softBreakSentences` wirkt nur noch auf Fließtext. Code-Blöcke, Inline-Code und URLs bleiben unangetastet. Die Funktion kommt dafür als reine Funktion nach `lib/markdown-text.js` und bekommt einen Test (B1).
- Die Session-ID eines Chats gilt nur für sein eigenes Projekt. Bei einem Projektwechsel wird ein neuer Chat angelegt, der alte bleibt unverändert (B2, N9).
- Enter im leeren Feld stoppt nichts mehr. Stoppen geht nur über den Stop-Knopf, und solange eine Freigabe-Karte offen ist, ist Stoppen gesperrt (B6).
- Plan ablehnen mit Begründung: Die Begründung kommt zusätzlich als Nutzer-Nachricht in den nächsten Turn, nicht nur als Tool-Fehler (B7).
- Doppeltes Speichern beim Umbenennen entfällt (N8). Statustexte ohne doppeltes „…“ (B16).

### 0.5 Hooks und Beobachtung (A): M1–M4, M6, M7, M10, B8, B11
- Neu: `lib/terminal.js` als reine Funktion `onHook(sessions, event, now)`. Darin: alte Sessions aufräumen (alle 60 s), `done` nach 2 Minuten auf „ruhig“ zurückstufen und die Rennen aus M1–M3 vermeiden. Die Tests aus `lib/audit.test.js` werden von todo auf aktiv umgestellt.
- Eine feste Kennung `--nikki-hook` im Befehl; die alte Regex wird weiter erkannt (M7).
- `hook.cjs` schickt nur die nötigen Felder, gekürzt (M10).
- Hooks aus leert die beobachteten Sessions (B8). Beim Deinstallieren entfernt `Nikki.exe --remove-hooks` sie über ein NSIS-Makro `customUnInstall` (M6).
- Der Toast kommt, bevor die Insel eingeblendet wird (B11).

### 0.6 Fenster und System (A): B3, B9, M9, M11, N5, N6, N11, N12, B15
- Beim Entwickeln eigener userData-Ordner (`Nikki-dev`), damit Dev-Starts die Daten der installierten App nicht anfassen (B3).
- Startet Nikki über einer Vollbild-App, holt sie sich keinen Fokus; sie bleibt versteckt, bis das Vollbild endet (B9).
- Der Vollbild-Watcher startet nach `exit` neu und setzt danach die Sichtbarkeit zurück (M9).
- Den Claude-Pfad zuerst nativ prüfen, dann asynchron mit `where.exe` suchen (M11).
- Toasts festhalten (N5), den Tray-Zustand bei Vollbild korrigieren (N6) und `render-process-gone` behandeln, damit offene Freigaben abgelehnt werden (N11).
- `notes/` und `*.md` aus dem Build ausschließen (N12). Kein `where.exe` mehr bei jedem `get-state` (B15).

### 0.7 Updater (A): H1
- Den Installationsordner aus der Registry (`InstallLocation`) oder aus dem Prozesspfad lesen. Die Quelle ist `.\win-unpacked`. Erst prüfen, dann die App beenden. Schlägt das Kopieren fehl, die App trotzdem neu starten. Dazu ein Trockenlauf mit `--dry-run`.

**Abschluss Phase 0**: `npm test` ist grün, der Laufzeit-Test aus `notes/audit-runtime/runtime-test.md` läuft erneut (B1–B9 müssen weg sein), Release 1.1.

## Phase 1: Gerüst, Settings, Insel und Notch (Release 1.2)

### 1.1 Modul-System
- Der Renderer wird auf ES-Module umgestellt (`<script type="module">`; die CSP `script-src 'self'` erlaubt das). `app.js` wird aufgeteilt in `renderer/shell/` (Notch, Insel, Tabs, Settings) und `renderer/chat/`.
- Jedes Modul liegt in `renderer/modules/<id>/index.js` und exportiert `{ id, title, icon, page(el, ctx), tile(el, ctx)?, glance(ctx)? }`. Eine Registry lädt nur eingeschaltete Module.
- Daten pro Modul liegen in `userData/modules/<id>.json` über `lib/json-file.js`, per IPC `module-get` / `module-set`.
- **Prüfen**: Ein Modul ein- und auszuschalten ändert die Tabs ohne Neustart.

### 1.2 Aufgeklappte Insel
- Tab-Leiste: Home, Chat (Sprechblase mit Status-Punkt), eingeschaltete Module, dazu das Zahnrad rechts.
- Die Höhe passt sich per ResizeObserver an und gleitet mit `var(--ease-drawer)` und etwa 420 ms auf die neue Größe. Seitenwechsel blenden ein. Bei `prefers-reduced-motion` gibt es keine Bewegung.
- Home ist das Dashboard „Heute“: Begrüßung mit Nikki und Kacheln der eingeschalteten Module, alle gleich hoch.
- Chat: der bisherige Chat, mit Session-Chips (eigene und Terminal-Sessions), Branch, Änderungszähler und Modellwahl.
- Kontext springt automatisch: Eine Freigabe öffnet den Chat, eine Datei, die auf die Insel gezogen wird, öffnet die Ablage.

### 1.3 Zugeklappte Notch
- `lib/glance.js` ist eine reine Funktion, die die Rangfolge festlegt: Freigabe, dann Hinweis, Agent, Termin unter 15 Minuten, Musik, Leerlauf. Höchstens eine Info pro Seite. Dazu ein Test.
- Das Gesicht als SVG-Komponente mit den Stimmungen `sleep`, `awake`, `work`, `need`, `done` und `music`, genau wie auf dem Canvas: Blinzeln, Umherschauen, Hüpfen, Tanzen, aufsteigende z. Die Schnurrhaare liegen innen etwa 18 px und außen etwa 15 px, mit Farbverlauf, und zucken bzw. wippen je nach Stimmung.
- Nach N Minuten ohne Aktivität schläft Nikki ein. Fährt die Maus über die Notch, wacht sie auf.

### 1.4 Settings-Ansicht
- Abschnitte: Allgemein (Autostart, Hotkey frei belegbar mit Konfliktprüfung, Töne, Notch-Größe), Claude (Terminal-Sessions beobachten, Rückkanal, Channel-Opt-in ab Phase 2, Claude-Pfad), Module (ein/aus, Reihenfolge), Git/GitHub (vorerst nur Branch-Anzeige an/aus).
- Der Tray zeigt nur noch Ein-/Ausblenden, Settings und Beenden.

**Abschluss Phase 1**: Tests für glance und Modul-Registry, Laufzeit-Test per Playwright-Electron (siehe Validierung), Release 1.2.

## Phase 2: Terminal-Rückkanal (Release 1.3)

Grundlage: `notes/research/terminal-reply.md`, Abschnitt 6.

### 2.1 Synchroner PermissionRequest-Hook
- `lib/hooks.js`: Die asynchronen Beobachter bleiben. Dazu kommt ein synchroner Eintrag `PermissionRequest`, der `hook.cjs --wait` aufruft (timeout 120 s, `statusMessage` „Nikki fragt dich…“).
- `hook.cjs --wait` wartet per Long-Poll an `/hook/wait` mit Token. Antworten sind allow, always (`updatedPermissions`), deny mit `message`, Fragen per `updatedInput.answers` sowie Plan annehmen und ablehnen. Ist Nikki aus, tritt ein Fehler oder Timeout auf oder wählt man „Im Terminal antworten“, gibt der Hook nichts aus und endet mit Exit 0. Kein `onFailure: block`.
- Veraltete Karten (#15433): Kommt für dieselbe `session_id` ein `PostToolUse`, `Stop`, `UserPromptSubmit` oder ein neuer `PermissionRequest`, löst Nikki die wartende Anfrage selbst auf.
- Eigene SDK-Sessions bleiben ausgenommen (`DESKTOPCOMPANION_AGENT`). `claude -p`-Läufe werden erkannt und nicht festgehalten (Lösung unter Windows vorher prüfen).
- **Prüfen**: `lib/permission-relay.test.js` (Antwort-JSON für jeden Fall), dazu ein manueller Test mit echtem `claude` im Terminal.

### 2.2 Mehr Inhalt aus Terminal-Sessions
- `last_assistant_message` aus `Stop` erscheint im Chat-Tab unter der Session.
- Freigabe-Details (Tool, Befehl, Datei) stehen in der Notch und auf der Karte.
- `Notification` `idle_prompt` gilt als ruhiger Hinweis, `permission_prompt` als Eskalation.
- Hotkeys für Erlauben/Ablehnen und Zifferntasten für die Optionen.

### 2.3 Folge-Prompts
- „Nachricht vormerken“: Ein synchroner, nicht blockierender `Stop`-Hook fragt bei Nikki nach, ob eine Nachricht wartet, und gibt sie als `additionalContext` bzw. `decision: block` mit `reason` mit.
- Nikki-Channel als Opt-in (Settings, mit Preview-Hinweis): ein kleiner MCP-Server mit `claude/channel` und Permission-Relay. „Nikki-Terminal starten“ öffnet `claude --dangerously-load-development-channels server:nikki`. Nur für so gestartete Sessions kann man auch nach „fertig“ antworten.

**Abschluss Phase 2**: Tests sind grün, ein manueller End-to-End-Test im Terminal läuft, Release 1.3.

## Phase 3: Module (Releases 1.4 und folgende, parallel)

Ein Coder pro Modul. Bereich ist jeweils `renderer/modules/<id>/` plus die zugehörige Main-Logik in `lib/modules/<id>.js`. Den Helfer baut ein eigener Coder unter `helper/`.

| # | Modul | Umsetzung | Abhängigkeit |
|---|---|---|---|
| 3.1 | **C#-Helfer** `helper/NikkiHelper.cs` | Läuft lange und spricht JSON-Zeilen über stdio. SMTC (Titel, Interpret, Cover, Position, Play/Pause/Skip), Systemlautstärke (Core Audio). Start, Neustart und Abbau übernimmt der Main-Prozess | Spike zuerst: WinRT mit `csc` + `Windows.winmd` oder .NET-8-SDK |
| 3.2 | **Musik** | Seite, Kachel und Glance (Cover und Visualizer). Nikki tanzt. Lyrics zuletzt (LRCLIB o. ä., erst prüfen, ob online erlaubt ist) | 3.1 |
| 3.3 | **Kalender** | Lokale Termine (JSON): Monat mit „+“, Tagesliste, Glance 15 Minuten vorher, Erinnerungs-Toast | – |
| 3.4 | **Ablage** | Kopien in `userData/shelf/` mit Größenlimit, Vorschau per `nativeImage.createThumbnailFromPath`, Herausziehen per `webContents.startDrag`, Mehrfachauswahl, Text-Karten, „Alles leeren“, „An Chat anhängen“. Ein abgebrochenes Ziehen verliert nichts | – |
| 3.5 | **To-do** | Global und pro Projekt, „An Chat“ macht daraus einen Prompt im Projekt | – |
| 3.6 | **Notizblock** | Blätter als Markdown-Dateien, Blättern per ‹ › und Mausrad, Rausreißen löscht mit Animation, wie auf dem Canvas | – |
| 3.7 | **Timer** | Pomodoro 5/15/25 min, Countdown als Glance, Ton am Ende | – |
| 3.8 | **Clipboard** | Opt-in. Verlauf der letzten N Einträge nur im Speicher (oder lokal, je nach Einstellung), „An Chat“ | – |
| 3.9 | **Wachhalten** | `powerSaveBlocker` von Electron, solange ein Agent arbeitet, oder manuell | – |
| 3.10 | **Usage-Ring** | Plan-Limit von Claude. Die Datenquelle ist inoffiziell (Recherche, Nice-to-have 1), also erst prüfen, dann bauen oder streichen | Spike |
| 3.11 | **Sprache** | Push-to-Talk mit lokaler Spracherkennung (sherpa-onnx + whisper), danach Befehle („Timer 10 Minuten“, „nächster Song“, „notier …“) und Diktat in den Chat. Wake Word „Hey Nikki“ per sherpa-onnx-KWS als Opt-in | Größter Brocken, Modelle 50–150 MB |

Den Backlog mit den übrigen Ideen aus `notes/research/competitors.md` §5 pflegen wir in `notes/plan/backlog.md`.

## Phase 4: Design und Maskottchen (Release 2.0)

- Die Referenzfotos der echten Nikki liegen außerhalb des Repos, weil sie privat sind: `%APPDATA%\AgentOS\projekte\notch-nikki\referenz\nikki\`. Die Beschreibung steht in `gedaechtnis/nikki-aussehen.md`: weiß mit grau-braunen Tabby-Flecken, Tabby-Kappe mit weißer Blesse, bernsteinfarbene Augen, rosa Nase, geringelter Schwanz. Der Design-Agent baut daraus eine Nikki im Stil der Notch-Maskottchen: weich und minimal, kein Mochi-Klon. Einsatzorte sind die Dashboard-Begrüßung, Ein-Ausblenden beim Chat und der Start.
- Die Augen werden final abgestimmt, eigene Töne kommen dazu.
- Skills: `impeccable` (audit/polish) und `accessibility`.
- `PRODUCT.md` und `README.md` werden auf den neuen Stand gebracht.

## Validierung

```bash
npm test                      # Unit-Tests (node --test), muss in jeder Phase grün sein
npm start                     # Entwicklung, ab 0.6 mit eigenem userData-Ordner
npm run pack && updater\Updater.exe --dry-run
```
Vorschlag: Das Playwright-Electron-Skript des Laufzeit-Testers wird als `npm run e2e` ins Repo übernommen. Dafür kommt `playwright` neu als devDependency hinzu, das braucht deine Zustimmung.

## Risiken

| Risiko | Wahrscheinlichkeit | Gegenmaßnahme |
|---|---|---|
| SMTC/WinRT aus C# ohne NuGet ist zickig | **erledigt** (2026-10-30) | Spike `helper/NikkiHelper.cs` + `helper/build.cmd` läuft mit dem Windows-eigenen `csc` (C# 5): WinRT kommt aus `System32\WinMetadata\*.winmd`, auf asynchrone Aufrufe wird direkt gewartet (Status-Polling, weil die `await`-Brücke nicht bindet). `NikkiHelper.exe --once` liefert Titel, Interpret, Status, Position und Länge. Offen sind Lautstärke (Core-Audio-COM) und ob das Cover bei Spotify ankommt |
| `app.js` mit 1600 Zeilen aufzuteilen erzeugt Regressionen | hoch | Phase 0 vor Phase 1, Logik in `lib/` mit Tests, nach jedem Schritt der Laufzeit-Test |
| Ein synchroner PermissionRequest-Hook blockiert Claude-Sessions oder `-p`-Läufe | mittel | Fail-open, timeout 120 s, `-p`-Erkennung, Bug #15433 selbst auflösen |
| Der Channel ist ein Research Preview, das Protokoll kann sich ändern | mittel | Nur als Opt-in, hinter einem Settings-Schalter, klar beschriftet |
| Sprachmodelle machen den Installer groß | hoch | Modelle beim ersten Einschalten herunterladen (eigene Rückfrage), Push-to-Talk vor dem Wake Word |
| Doppelte Hotkey-Belegung mit anderen Notch-Tools | mittel | Frei belegbar, Prüfung beim Registrieren, Hinweis in den Settings |
| Nähe zu Coucou (Stil, Funktionen) | niedrig | Nichts von Name, Mochi, Icon oder Tönen übernehmen, eigene Nikki nach echten Fotos |
| Mehrere Agenten bearbeiten `main.js` gleichzeitig | hoch | Bereiche je Phase festlegen, `main.js` hat immer nur einen Besitzer, Module bekommen eigene `lib/modules/*` |

## Abnahme
- [ ] Jede Phase: Tasks erledigt, `npm test` grün, Laufzeit-Test ohne neue Bugs, Release erstellt
- [ ] Keine Stelle mehr mit Cursor, Gemini oder AI Studio im Code
- [ ] Notch und Insel sehen aus wie der Canvas, auch mit `prefers-reduced-motion`
- [ ] Terminal-Freigaben gehen aus der Insel, und Claude bleibt nie hängen, wenn Nikki aus ist
- [ ] Alle Daten liegen lokal und werden atomar geschrieben
