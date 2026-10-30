# Code-Review Nikki (Stand a2a48ca, 2026-10-30)

Geprüft: main.js, preload.cjs, hook.cjs, renderer/*, lib/*, backends/*, updater/*.
Schwerpunkte: das Claude-Backend, die Hooks, die Status-Ableitung, IPC und Sicherheit, Fenster und Vollbild, den Updater sowie Töne und Toasts.
Cursor, Gemini, der Agent-Tab und die Git-Pill werden entfernt. Ihre Befunde stehen deshalb nur kurz am Ende.
Am App-Code wurde nichts geändert. Neu ist nur `lib/audit.test.js` mit 5 Tests, die Bugs belegen. Die Tests sind als `todo` markiert: Sie schlagen heute fehl, ohne dass `npm test` rot wird. Ist ein Fix drin, entfernt man das `todo`.

Kennzeichnung: **[Test]** heißt, der Bug ist in `lib/audit.test.js` belegt. **[plausibel]** heißt, der Befund ist aus dem Code abgeleitet, aber nicht live reproduziert.

## npm test

Vor dem Review:

```
ℹ tests 23 · pass 23 · fail 0 · todo 0   → grün
```

Nach dem Hinzufügen von `lib/audit.test.js`. Exit-Code 0, also weiterhin grün:

```
⚠ M1: PostToolUse of a parallel tool must not hide an open permission prompt # M1
⚠ M2: PermissionRequest for AskUserQuestion keeps the question text # M2
⚠ M3: idle_prompt clears a needsYou left over from a prompt denied in the terminal # M3
⚠ N1: error result with empty errors[] still says why # N1
⚠ M7: hooks stay recognisable when the install path no longer says "desktopcompanion" # M7
✔ … 23 bestehende Tests grün
ℹ tests 28 · pass 23 · fail 0 · todo 5
M1: actual 'working', expected 'needsYou'
M2: actual 'Nikki will OK!', expected 'Nikki: Tee oder Kaffee? (Tee / Kaffee)'
M3: actual 'needsYou' (bleibt stehen)
N1: answer is ""
M7: every app start appends 8 more hooks (2 !== 1)
```

## Kritisch

Im Schwerpunktbereich gibt es keinen kritischen Befund. Der einzige kritische Punkt betrifft Gemini (`--yolo`), siehe „Bereiche, die entfernt werden“.

## Hoch

### H1 Updater.exe funktioniert mit der echten Installation nicht
`updater/Updater.cs:21-24`, `:27-28`, `:43`
- Der Updater sucht `%LOCALAPPDATA%\Programs\Nikki\Nikki.exe` oder `Programs\DesktopCompanion\DesktopCompanion.exe`. Der NSIS-Installer legt die App aber unter dem Paketnamen ab. Auf diesem Rechner ist das `Programs\desktopcompanion\Nikki.exe`. Beide Prüfungen schlagen deshalb fehl, und der Updater meldet immer „Nikki ist nicht installiert“.
- Die Quelle der Kopie ist `dist\win-unpacked`. In `package.json` steht aber `build.directories.output: "."`, also landet `npm run pack` in `.\win-unpacked`. Im Hauptprojekt gibt es tatsächlich nur `win-unpacked\` und kein `dist\`.
- Selbst wenn die Prüfung auf die Installation durchginge: Die App wird in Schritt 2 beendet, robocopy scheitert in Schritt 3 mit Code 16, weil die Quelle fehlt, und `Fail()` startet die App danach nicht neu. Liegt noch ein alter `dist\win-unpacked` herum, spiegelt `/MIR` stattdessen den **alten** Stand über die Installation, also ein stilles Downgrade.
- Auch der Desktop-Shortcut und der Hinweis „Setup aus dist\\“ zeigen auf falsche Pfade.

**Fix:** Den Installationsordner aus der Registry lesen (`HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\<appId-GUID>\InstallLocation`) oder den Prozesspfad von `Nikki.exe` nehmen. Die Quelle sollte `Path.Combine(project, "win-unpacked")` sein, oder man liest sie aus `directories.output`. Erst prüfen, ob die Quelle existiert, und **danach** die App beenden. Schlägt das Kopieren fehl, die App trotzdem neu starten.

### H2 state.json: Ein Absturz beim Speichern löscht still alle Chats
`main.js:48-58`
- `save()` überschreibt `state.json` mit `fs.writeFileSync` nicht atomar. Die Datei enthält Projekte, Sessions, Favoriten und bis zu 40 Chats mit je 80 Nachrichten zu je 20 000 Zeichen, kann also mehrere MB groß werden. Gespeichert wird bei jedem Turn, bei jedem Session-Event, bei jedem Chat-Wechsel und bei jeder Modellwahl.
- Szenario: Der Updater beendet die App nach 5 s hart (`KillAll`, Updater.cs:39), oder Windows fährt herunter, während gerade geschrieben wird. Zurück bleibt abgeschnittenes JSON. Beim nächsten Start wirft `JSON.parse`, und `catch {}` schluckt den Fehler ohne Meldung. Die App läuft mit leerem Zustand weiter, und der nächste `save()` überschreibt die beschädigte Datei. **Alle Chats und Projekte sind dann endgültig weg.**

**Fix:** Atomar schreiben: in `state.json.tmp` schreiben und anschließend mit `fs.renameSync` über die alte Datei. Lässt sich die Datei beim Laden nicht parsen, sie zuerst nach `state.json.corrupt-<ts>` verschieben und erst dann mit den Standardwerten starten. Mittelfristig sollten die Chats in eigene Dateien.

### H3 ~/.claude/settings.json wird nicht atomar geschrieben, und das Backup ist wertlos
`main.js:529-541`, `:643`
- `fs.writeFileSync(file, …)` schneidet die globale Claude-Code-Konfiguration erst ab und schreibt sie dann neu. Bei einem Absturz oder einer vollen Platte ist sie danach leer oder abgeschnitten. Dann sind Berechtigungen, Modell, fremde Hooks und `env` weg. Claude Code beobachtet die Datei außerdem und kann eine halb geschriebene Fassung lesen.
- `copyFileSync(file, file + '.desktopcompanion-backup')` läuft bei **jedem** Schreiben, also auch bei jedem App-Start (`if (store.hooks) writeHooks(true)`). Ab dem zweiten Start enthält das Backup bereits Nikkis Hooks. Der Zustand vor Nikki ist dann verloren, und eine Wiederherstellung über den Code gibt es auch nicht.
- Read-modify-write ohne Prüfung: Ändert Claude Code die Datei zur selben Zeit (`/model`, `/permissions`, „always allow“ mit dem Ziel userSettings), geht dessen Änderung verloren. Das Zeitfenster ist klein.

**Fix:** In eine Temp-Datei im selben Ordner schreiben und dann `renameSync`. Ist `settings.json` ein Symlink (Dotfiles), vorher `fs.realpathSync` auflösen. Das Backup nur einmal anlegen, nämlich wenn noch keins existiert und die Datei noch keine Nikki-Hooks enthält. Vor dem Schreiben die mtime vergleichen und bei einer Änderung neu einlesen.

### H4 Die Oberfläche kann dauerhaft auf „läuft“ hängen bleiben (nur ein Neustart hilft)
`backends/claude.js:34-48`, `renderer/app.js:1184-1194`, `main.js:430-453` **[plausibel]**
Der Renderer verlässt `busy` nur über einen Status `done`, `error` oder `idle`. Drei Wege führen dahin, dass keiner davon ankommt:
1. **Der Stream endet ohne `result`.** Endet die `for await`-Schleife normal, ohne `result`-Nachricht und ohne Exception, ruft `start()` kein `onStatus` auf. Beispiele sind ein CLI-Exit oder ein Interrupt, je nach CLI-Version. Das SDK 0.3.308 kennt `terminal_reason: 'aborted_streaming' | 'aborted_tools'`, Interrupts haben also eigene Abschlussformen.
2. **`api.start` wird abgelehnt.** Der IPC-Handler `start` ruft `addProject()`/`save()` auf, das ist `writeFileSync` auf state.json. Wirft das (EPERM/EBUSY durch Virenscanner oder OneDrive, volle Platte), wird `invoke` abgelehnt. In `start()` im Renderer steht `await api.start(...)` ohne try/catch, und `setBusy(true)` ist da schon gesetzt. Der Stop-Knopf ruft dann `stop()` für einen Agenten auf, der gar nicht läuft.
3. **`query()` wirft synchron.** Dann wird die async-Funktion abgelehnt, bevor der `try`-Block erreicht ist. Es kommt zu einer unhandled rejection, und kein Status geht raus.

**Fix:** In `claude.js` merken, ob ein Abschluss-Status gesendet wurde. Im `finally` gilt dann: `if (!finished) onStatus(stopped ? idle : { state: 'error', text: 'Nikki stolpert.', answer: 'Agent beendet ohne Ergebnis.' })`. `query()` gehört in den `try`. Im Renderer `await api.start` in try/catch packen und im `catch` `setBusy(false)` aufrufen. Im Main-Prozess `save()` absichern.

## Mittel

### M1 Ein verspätetes PostToolUse eines anderen Tools verdeckt eine offene Berechtigungsabfrage [Test]
`lib/status.js:99-107`
Claude bündelt oft `[Read, Read, Bash]`. Die Reads enden, und Millisekunden später öffnet Bash die Abfrage. Weil die Hooks `async` laufen, startet jedes Event einen eigenen Node-Prozess, und die Reihenfolge der POSTs ist zufällig. Kommt `PostToolUse(Read)` nach `PermissionRequest(Bash)` an, liefert `hookToStatus` den Zustand `working`. Die Insel zeigt dann „Nikki liest a.js…“, obwohl Claude im Terminal auf die Antwort wartet. Der Code unterdrückt nur `PreToolUse`, nicht aber `PostToolUse` fremder Tools.
**Fix:** Bei `needsYou` das wartende Tool mitspeichern (`tool_name`, besser `tool_use_id`, falls es im Payload steht). `needsYou` nur durch ein `PostToolUse` desselben Tools, durch `Stop` oder durch `UserPromptSubmit` auflösen.

### M2 PermissionRequest überschreibt den Fragetext bzw. „Plan“ [Test, plausibel]
`lib/status.js:84-85`, `:105`
`AskUserQuestion` und `ExitPlanMode` laufen über den Permission-Pfad. Im SDK beantwortet Nikki sie selbst über `canUseTool`. Im Terminal kommt deshalb neben `PreToolUse` sehr wahrscheinlich auch ein `PermissionRequest`. Der liefert immer „Nikki will OK!“ und ersetzt damit „Nikki: Tee oder Kaffee? (Tee / Kaffee)“. Welcher Text am Ende stehen bleibt, hängt davon ab, welcher Hook zuerst ankommt.
**Fix:** In `eventStatus` beim Fall `PermissionRequest` nach `tool_name` unterscheiden: Für AskUserQuestion `question(e.tool_input)`, für ExitPlanMode „Nikki zeigt Plan!“, sonst „Nikki will OK: <describeTool>“.

### M3 „Nikki will OK!“ bleibt stehen, wenn im Terminal abgelehnt wurde [Test, plausibel]
`lib/status.js:88-89`, `main.js:478`
Lehnt man im Terminal ab („No, tell Claude…“), bricht der Turn ab. Dann kommen weder `PostToolUse` noch `Stop`, denn Stop feuert nicht bei einem Abbruch durch den Nutzer. Die Insel zeigt weiter `needsYou` mit dem höchsten Rang, bis man im Terminal den nächsten Prompt schreibt. Die Benachrichtigung `idle_prompt`, die Claude nach 60 s Leerlauf am Prompt schickt, wird ignoriert (`null`).
**Fix:** `idle_prompt` auf `{ state: 'done' }` oder einen eigenen ruhigen Zustand abbilden, damit ein liegengebliebenes `needsYou` verschwindet.

### M4 Beobachtete Sessions verschwinden nie, und „fertig“ bzw. „schaut zu“ bleibt ewig stehen
`main.js:465-483` (Aufräumen nur in Zeile 478), `lib/status.js:75-77`, `renderer/app.js:208-219`
- Veraltete Sessions werden nur aufgeräumt, wenn ein **neues** Hook-Event ankommt. Wird ein Terminal ohne `SessionEnd` geschlossen (Fenster-X, Absturz), bleibt die Pill mit dem letzten Zustand stehen, zum Beispiel `working`. Die Insel zeigt dann „arbeitet“, bis irgendwann wieder ein Event kommt. `get-state` gibt solche Leichen auch nach einem Neustart des Renderers weiter.
- `Stop` setzt `done`. Laut Kommentar soll „done briefly own the island“, aber es gibt keinen Timer. „Nikki ist fertig.“ bleibt bis zu `SessionEnd` stehen. Ein frisch geöffnetes, untätiges `claude` steht dauerhaft auf `thinking`/„Nikki schaut zu…“ mit Rang 2, und die Katze wirkt beschäftigt.
**Fix:** Ein `setInterval` (z. B. 60 s) im Main-Prozess räumt veraltete Sessions auf und sendet `terminal`. `done` nach etwa 2 Minuten auf einen ruhigen Zustand ohne Rang zurückstufen. `SessionStart` auf diesen ruhigen Zustand legen statt auf `thinking`.

### M5 Stop, Interrupt und Beenden haben keinen harten Abbruch
`backends/claude.js:43-55`, `main.js:659-666` **[plausibel]**
- `stop()` ruft nur `interrupt()` auf, und Fehler verschwinden in `.catch(() => {})`. Hängt die CLI, kommt kein Abschluss, und die Oberfläche bleibt auf „läuft“ (siehe H4). Es wird kein `abortController` übergeben, deshalb gibt es keinen Fallback, der den Prozess beendet.
- Das Flag `stopped` wird nur im `catch` ausgewertet. Liefert die CLI nach dem Interrupt eine `result`-Nachricht (`error_during_execution` mit `terminal_reason: aborted_*`), zeigt `toStatus` „Nikki stolpert.“ (Fehlerzustand und Fehler-Toast) statt „Nikki stoppte.“.
- `will-quit` ruft `stop()` auf, ohne zu warten. Bei einem harten Kill (Updater) läuft `claude.exe` womöglich verwaist weiter, im Modus `acceptEdits`.
**Fix:** `abortController` an `query()` übergeben. `stop()` ruft `interrupt()` auf und nach etwa 3 s `abortController.abort()`. In der Schleife bei `stopped && m.type === 'result'` den Status idle „Nikki stoppte.“ senden. In `will-quit` `abort()` aufrufen.

### M6 Die Hooks bleiben nach der Deinstallation stehen, und ein manuelles Entfernen wird beim nächsten Start zurückgedreht
`main.js:643-644`, keine Uninstall-Logik in `package.json` (nsis)
- Nach der Deinstallation zeigen 8 Hook-Einträge in `~/.claude/settings.json` (und gegebenenfalls in `~/.cursor/hooks.json`) auf ein `hook.cjs`, das es nicht mehr gibt. Jedes Claude-Event in jeder Session startet dann `node` mit MODULE_NOT_FOUND.
- Solange `store.hooks` true ist, schreibt jeder App-Start die Hooks neu. Wer sie in Claude über `/hooks` entfernt hat, bekommt sie beim nächsten Start ungefragt zurück. Außerdem wird jedes Mal das Backup überschrieben (H3).
**Fix:** Ein Flag `Nikki.exe --remove-hooks` einbauen, das `withoutHooks`/`withoutCursorHooks` schreibt, und es über ein NSIS-`customUnInstall`-Makro aufrufen. Beim Start nur dann neu schreiben, wenn der Befehl veraltet ist **und** unsere Hooks noch vorhanden sind.

### M7 Die Hook-Erkennung hängt am Zufallsstring „desktopcompanion“ [Test]
`lib/hooks.js:4`
`ours()` erkennt Nikkis Hooks nur, wenn im Befehl „desktopcompanion“ und „hook.cjs“ vorkommen. Das klappt heute nur, weil das Feld `name` in `package.json` den Installationsordner (`Programs\desktopcompanion`) und userData (`Roaming\desktopcompanion`) bestimmt. Nach einer naheliegenden Umbenennung zu `nikki` passiert Folgendes: Jeder Start hängt **8 weitere** Hooks an (der Test belegt das), Ausschalten entfernt nichts mehr, und die alten Einträge bleiben für immer.
**Fix:** Eine feste Markierung im Befehl verwenden, zum Beispiel ein zusätzliches Argument `--nikki-hook`, oder den Dateinamen auf `nikki-hook.cjs` ändern, und `ours()` darauf prüfen lassen. Für die Migration die alte Regex zusätzlich weiter erkennen.

### M8 Schreibfehler an den Settings brechen den Rest des App-Starts ab
`main.js:537-539`, `:643-653`, `:550-562`
`copyFileSync`, `mkdirSync` und `writeFileSync` in `writeJsonSettings` sind nicht abgesichert. Ein EPERM/EBUSY beim Start, etwa weil ein Virenscanner oder ein Sync-Tool die Datei sperrt, wirft innerhalb von `whenReady().then`. Dadurch laufen weder die Display-Listener noch die Registrierung des Hotkeys noch der Tray-Tooltip: **kein Hotkey, ohne jede Meldung**. Beim Umschalten im Tray wird `setHooks` abgelehnt (unhandled rejection), und `store.hooks` und die Häkchen im Tray passen nicht mehr zusammen.
**Fix:** In `writeJsonSettings` try/catch einbauen, `showErrorBox` zeigen und `false` zurückgeben. Den Hotkey vor dem Schreiben der Hooks registrieren.

### M9 Vollbild-Watcher: Stirbt PowerShell, bleibt die Insel unsichtbar
`main.js:239-251`
Es gibt keinen Handler für `error` oder `exit`. Wird PowerShell blockiert (AppLocker, Constrained Language Mode, `Add-Type` schlägt fehl), beendet sich der Prozess oder wird gekillt, während `fullscreen === true` ist, dann bleibt `fullscreen` für immer true. Jeder Aufruf von `applyVisibility()` hält das Fenster dann versteckt, auch eine Berechtigungsanfrage. Nur der Hotkey zeigt es noch. Fehlt `powershell.exe` ganz, landet das `error`-Event im globalen `uncaughtException`-Logger.
Kleiner: QUNS `7` (Store-/UWP-App im Vollbild) wird nicht erkannt. Außerdem gilt der Zustand für alle Monitore: Ein Vollbildvideo auf Monitor 2 versteckt Nikki auch auf Monitor 1.
**Fix:** Bei `exit` und `error` `fullscreen = false` setzen, `applyVisibility()` aufrufen und mit Backoff neu starten. `7` in die Liste aufnehmen.

### M10 Der Hook schickt komplette Tool-Ausgaben, und große Events gehen still verloren
`hook.cjs:67`, `main.js:490-493`
`normalize()` verteilt das gesamte Roh-Payload weiter, inklusive `tool_response` (Dateiinhalt, Bash-Ausgabe, Edit-Patch mit `originalFile`) und `tool_input.content` bei Write. Bei mehr als 1e6 Zeichen ruft der Server `req.destroy()` auf, und das Event verschwindet ohne Spur. Ist das ausgerechnet das `PostToolUse` nach einer Berechtigungsabfrage, bleibt `needsYou` stehen (siehe M1 und M3). Abgesehen davon wird bei jedem Event unnötig viel übertragen.
**Fix:** In `hook.cjs` nur die Felder weitergeben, die gebraucht werden: `hook_event_name`, `session_id`, `cwd`, `tool_name`, `notification_type`, gekürzte Teile aus `tool_input` (`file_path`, `command` bis 200 Zeichen, `questions`), `source`.

### M11 Der Claude-Pfad ist fest verdrahtet
`main.js:26`
`claudePath` zeigt fest auf `~/.local/bin/claude.exe`, also auf den nativen Installer. Wer Claude Code per npm (`%APPDATA%\npm\claude.cmd`) oder WinGet installiert hat, bekommt „Nikki findet Claude nicht“, obwohl `claude` funktioniert.
**Fix:** Zuerst den nativen Pfad prüfen, dann `where.exe claude` (asynchron) und optional eine Einstellung. Wird ein `.cmd` gefunden, `pathToClaudeCodeExecutable` weglassen und die SDK-eigene Auflösung nutzen.

### M12 Git-Polling alle 4 s: 6 Prozesse und ein GitHub-API-Aufruf
`renderer/app.js:778`, `main.js:290-327`
Solange die Insel sichtbar ist (also fast immer), startet `refreshBranch()` alle 4 s bis zu fünf `git`-Prozesse und ein `gh pr list`. Letzteres ist ein Netzwerkaufruf mit bis zu 5 s Timeout. Dauert ein Aufruf länger als das Intervall, überlappen sich die Aufrufe, und ältere Ergebnisse können neuere überschreiben, zum Beispiel nach einem Projektwechsel. Die Git-Pill fällt weg, aber das Branch-Label in der Leiste (`#branch`, `#cardBranch`) hängt am selben Polling.
**Fix:** Nach dem Entfernen der Pill nur noch `git branch --show-current` abfragen, ausgelöst durch Projektwechsel und Turn-Ende statt durch ein Intervall. `gh` streichen.

## Niedrig

- **N1** `lib/status.js:51`: `m.result ?? m.errors?.join('\n') ?? m.subtype`. Ein leeres `errors: []` ergibt `''`, und `??` greift dann nicht mehr auf `subtype` zurück. Bei `error_max_turns` sieht man nur „Nikki stolpert.“ ohne Grund. **[Test]** Fix: `m.result || m.errors?.join('\n') || m.subtype`.
- **N2** `renderer/app.js:351-353` und `backends/claude.js:45`: Fehlertexte (`e.message`, `errors`) landen per `finalizeAssistant` als **Assistant-Nachricht** im gespeicherten Chatverlauf. Der Kommentar „never poison chat history“ gilt nur, wenn nicht `busy` ist. Fix: Bei `error` keine Nachricht in den Verlauf schreiben, nur `setAnswer(…, 'error')`.
- **N3** `main.js:532`: Eine `settings.json` mit UTF-8-BOM (ältere Editoren) gilt als „kein gültiges JSON“, und die Hooks lassen sich nicht einschalten. Fix: `.replace(/^﻿/, '')` vor `JSON.parse`.
- **N4** `lib/hooks.js:10-15`: `withoutHooks` löscht auch **eigene leere** Gruppen des Nutzers (`{ matcher, hooks: [] }`) und ein leeres `"hooks": {}`. Das widerspricht „leaving every other hook alone“. Fix: Nur Gruppen entfernen, die durch unser Filtern leer geworden sind.
- **N5** `main.js:95-97`: Das `Notification`-Objekt wird nicht festgehalten. Wird es vom Garbage Collector abgeräumt, kann der Klick auf den Toast ins Leere gehen (bekanntes Electron-Verhalten). Fix: In einem Set halten und bei `close`/`click` entfernen.
- **N6** `main.js:595-599`: „Ein-/Ausblenden“ im Tray zeigt keine sichtbare Wirkung, wenn das Fenster wegen Vollbild versteckt ist. `userHidden` wird dann `false`, aber das Fenster bleibt unsichtbar.
- **N7** `main.js:401-408`, `renderer/app.js:463-474`: Chats werden ohne Hinweis gekürzt (80 Nachrichten, 20 000 Zeichen pro Nachricht, 40 Chats). Umbenennen speichert über `chats-save` und setzt damit `lastChatId` und `updatedAt`, sodass der umbenannte Chat beim nächsten Start geöffnet wird.
- **N8** `renderer/app.js:650-665`: Umbenennen speichert doppelt. Enter ruft `finish(true)` auf, danach entfernt `openChatsMenu()` das Eingabefeld, `blur` feuert und ruft `finish(true)` ein zweites Mal auf.
- **N9** `main.js:450`: Bricht der erste Turn eines neuen Chats vor `init` ab (also ohne Session), nimmt der nächste Prompt `getSession(cwd)` und setzt damit stillschweigend die **vorige** Projekt-Session fort.
- **N10** `main.js:31`: Nur `ANTHROPIC_API_KEY` wird entfernt. `ANTHROPIC_AUTH_TOKEN` und `ANTHROPIC_BASE_URL` können die Nutzung ebenfalls vom Abo weglenken. Das widerspricht dem Kommentar.
- **N11** `main.js:174-202`: Es gibt keinen Handler für `render-process-gone`. Stürzt der Renderer ab (GPU), bleibt ein leeres, unsichtbares Fenster, und offene `askPermission`-Promises warten ewig, also hängt auch der Agent. Fix: `win.reload()` und offene Anfragen mit deny beantworten.
- **N12** `package.json` `build.files: ["**/*", …]`: `notes/`, `PRODUCT.md` und `release-notes.md` landen in der installierten App.

## Bereiche, die entfernt werden (Cursor, Gemini, Agent-Tab, Git-Pill), nur kurz

- **Gemini `--yolo`** (`backends/gemini.js:59`), **kritisch, solange es benutzt wird:** Jeder Tool-Aufruf läuft ohne Rückfrage, einschließlich Shell. Ein präpariertes Repo (Prompt Injection) kann damit Befehle ausführen.
- **Gemini über `cmd.exe /c`** (`backends/gemini.js:23-32`): Der Kommentar sagt „not reinterpreted by cmd.exe“, tatsächlich geht der Prompt-Text als Argument durch `cmd /d /s /c gemini.cmd …`. Node maskiert `"` als `\"`, was cmd nicht kennt, und `%VAR%` wird auch in Anführungszeichen ersetzt. Ein Prompt mit `"` und anschließendem `&` kann so Befehle einschleusen.
- **Synchrones `execFileSync` im Main-Thread:** `findCursorAgent()`/`findGemini()` (`where.exe`) in `get-state` und `start` (`main.js:359-361`, `:434-435`), außerdem `peekCursorModels`/`listCursorModels` (`main.js:360`, `:364`). Das blockiert die ganze App, auch den Cursor-Feed, beim Start und bei jedem Senden.
- **Session-Wechsel zwischen Backends:** `chatSessionId` aus einem Cursor-Chat wird nach einem Wechsel auf Claude als `resume` übergeben (`renderer/app.js:1188`, `main.js:450`). Das Ergebnis ist der Fehler „No conversation found“.
- **Agent-Tab:** `<button class="modelChip">` steckt per `innerHTML` in einem `<button>` (`renderer/app.js:943`). Das ist ungültiges HTML, und Screenreader und Fokus verhalten sich unklar.
- **Git-Pill:** `gh` wird mit `cwd: <Projektordner>` gestartet (`main.js:314`). Unter Windows sucht libuv die ausführbare Datei zuerst im cwd, ein `gh.exe` im Projektordner würde also ausgeführt **[zu prüfen]**. Außerdem gibt es das Polling-Problem aus M12, und `git status` führt in fremden Repos deren `core.fsmonitor` aus.
- **Beim Entfernen von Cursor beachten:** Hat ein Nutzer die Cursor-Hooks aktiviert, stehen sie in `~/.cursor/hooks.json`. Wird `withoutCursorHooks` samt Tray-Eintrag einfach gelöscht, bleiben diese Hooks dort **für immer** und zeigen auf `hook.cjs`. Deshalb vorher einmalig migrieren: Ist `store.cursorHooks` true, beim Start `writeCursorHooks(false)` aufrufen und danach `store.cursorHooks` entfernen. Den Cursor-Zweig in `hook.cjs` (`EVENT_MAP`, `cursorReply`, die stdout-Antwort) erst danach entfernen.

## Sicherheit: geprüft, ohne Befund

- **Electron 45:** Die Standardwerte gelten, also `contextIsolation: true`, `nodeIntegration: false` und `sandbox: true`. Die Preload-Datei gibt nur eine schmale API frei und kein `ipcRenderer`. Empfehlung: die Werte trotzdem ausdrücklich in `webPreferences` setzen.
- **CSP:** `script-src 'self'` ohne Inline-Skripte. `img-src` blockiert Bilder von außen, also auch Tracking-Pixel in Antworten.
- **Markdown:** Überall gilt `marked` → `DOMPurify.sanitize` (`renderer/app.js:401`, `:499`, `:1332`). Details zu Berechtigungen, Fragen und Titeln werden per `textContent` gesetzt.
- **ID-Clobbering:** Ein Element mit `id="permBody"` in einer Antwort greift nicht, weil `#permission`/`#perm*` in `index.html` **vor** `#thread`/`#answer` stehen. Zur Härtung trotzdem `DOMPurify.sanitize(html, { SANITIZE_NAMED_PROPS: true })`.
- **Links und Navigation:** `openExternal` nimmt nur `http(s)` an (`main.js:454`). `will-navigate` ist blockiert, `window.open` wird abgelehnt. `serveApp` verhindert Path Traversal (`normalize` und Prüfung des Präfixes).
- **Prozesse:** `execFile` läuft für git, node und where.exe mit Argument-Arrays, also ohne Shell. Ausnahme ist Gemini (siehe oben).
- **Hook-Server:** Er lauscht nur auf 127.0.0.1, prüft ein zufälliges Token pro Start und nimmt nur POST an, mit einem Limit von 1 MB. Browser-CSRF scheitert am Preflight, den der eigene Header auslöst.
- **SDK-Sessions:** `settingSources` ist nicht gesetzt, laut `sdk.d.ts` werden dann alle Quellen geladen. SDK-Sessions laden also auch Nikkis User-Hooks. Der Guard `DESKTOPCOMPANION_AGENT` in `hook.cjs:7` ist deshalb nötig und funktioniert.

## Fehlende Tests

- **main.js** lässt sich wegen Electron nicht importieren. Dadurch sind `writeJsonSettings`, das Laden und Speichern des Stores, `onHook` (Aufräumen alter Sessions, Ermittlung von `changed`) und `askPermission` (Abort/Cancel) ungetestet. Vorschlag: reine Funktionen auslagern, etwa `lib/json-file.js` (atomares Schreiben, BOM, Backup) und `lib/terminal.js` (onHook-Logik), und dafür Tests schreiben.
- **backends/claude.js:** Es gibt keinen Test mit einem gefälschten `query`. Vorschlag: `query` per Parameter injizierbar machen und damit Stop/Interrupt, „Stream endet ohne result“ (H4) und die Abbildung von `canUseTool` (deny, always, AskUserQuestion, ExitPlanMode) testen.
- **hook.cjs:** `normalize()` ist ungetestet, also die Erkennung der Quelle (Claude oder Cursor) und das Abbilden der Felder.
- **Updater.cs:** Es gibt gar keinen Test. Mindestens ein Trockenlauf, der die Pfade ausgibt, ohne zu kopieren, würde H1 sofort zeigen.
