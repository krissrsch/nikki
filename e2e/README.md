# E2E-Tests

Startet die echte App mit Playwright (`_electron.launch`) und bedient die Insel wie ein Nutzer.

```bash
npm ci                          # einmal: Electron und Playwright
npm run e2e                     # Standardlauf: ohne Netz, ohne Login, ca. 10 s
NIKKI_E2E_CLAUDE=1 npm run e2e  # zusätzlich mit echtem Claude (PowerShell: $env:NIKKI_E2E_CLAUDE=1; npm run e2e)
```

Während des Laufs erscheint die Insel kurz oben am Bildschirm. Läuft eine Vollbild-App, bleibt Nikki versteckt und der Test bricht mit „Nikki kam nicht hoch“ ab.

## Was geprüft wird

| Datei | Test |
|---|---|
| `app.e2e.js` | Kaltstart ohne Fehler in Haupt- und Renderer-Konsole, Insel öffnen/schließen, Projekt wählen und wechseln |
| | B1: Code-Block, Inline-Code und Link aus einer gespeicherten Chat-Fixture bleiben unverfälscht |
| | B2: Nach einem Projektwechsel geht keine fremde Session-ID an Claude, der alte Chat bleibt unverändert |
| | B6: Enter im leeren Feld stoppt nichts, auch nicht bei offener Freigabe-Karte; der Stop-Knopf stoppt |
| | Karten-Hotkeys: Tasten-Badges A/I/D und 1–9; A erlaubt, D lehnt ab, eine Ziffer wählt die Option. Im Composer bleiben Tasten Text, Enter stoppt nichts, Esc schließt die Insel nicht; Enter auf der Karte erlaubt, danach ist der Composer wieder dran |
| | Module: in den Settings aus- und wieder einschalten ändert Tabs und Kacheln ohne Neustart; ein To-do landet in `userData/modules/todo.json`; „An Chat“ füllt nur das Eingabefeld |
| `modules.e2e.js` | Musik ohne Helfer: Leerzustand ohne Knöpfe; Wiedergabe (vom Test als Event aus main geschickt) füllt Seite und Kachel, Knöpfe und Slider schicken nur erlaubte Befehle, die zugeklappte Notch tanzt mit Cover und Visualizer, eine Lautstärke-Änderung von außen zeigt sich 2 s |
| | Ablage: ein Text-Drop auf Home öffnet die Ablage mit Text-Karte, dieselbe Datei zweimal landet als `notiz.txt` und `notiz (2).txt` in `userData/shelf`, Auswahl + „An Chat anhängen“ füllt nur das Eingabefeld, ein Drop im Chat-Tab bleibt draußen, „Alles leeren“ mit Rückfrage leert Ordner und Liste |
| | Wachhalten: der Schalter in den Settings startet und beendet den powerSaveBlocker (im Test nur aufgezeichnet) |
| `relay.e2e.js` | Terminal-Rückkanal über das echte `hook.cjs`: Der Start schreibt den wartenden PermissionRequest-Hook (`--wait`, timeout 120), „Immer“ in der Insel geht als allow mit `updatedPermissions` zurück, ein Stop der Session räumt die Karte ab, ein Stop mit `last_assistant_message` erscheint als Markdown unter dem angepinnten Session-Chip („aus dem Terminal“), eine vorgemerkte Nachricht kommt genau einmal per `--stop` als `block` zurück |
| `errors.e2e.js` | Das leere `claude.exe` im Temp-Home lässt den echten Start scheitern: Die Insel zeigt einen deutschen Satz, das Original steht eingeklappt unter „Details“ |
| `clipboard.e2e.js` | Zwischenablage-Modul gegen die echte Windows-Zwischenablage: ab Werk aus; eingeschaltet erscheint kopierter Text auf Seite und Kachel, eine vom Passwort-Manager markierte Kopie nicht; Klick kopiert (aufgezeichnet), „Verlauf merken“ schreibt und löscht `clipboard.json`, „An Chat“ füllt nur das Eingabefeld, Löschen einzeln und alles |
| `claude.e2e.js` (nur mit `NIKKI_E2E_CLAUDE=1`) | Prompt, Freigabe erlauben (`node -e`), Freigabe ablehnen (`git init`), B4: Senden direkt nach „fertig“, B5: Stop ohne Diagnose-Text |

Im Standardlauf ersetzt `fakeClaude()` (in `nikki.js`) die IPCs `start` und `stop` im Hauptprozess, und die Tests schicken Status und Freigaben selbst. Die Claude-Tests nutzen Haiku und kurze Prompts, also etwa sechs kleine Läufe über dein Abo.

## Nutzerdaten

- Jeder Start bekommt einen frischen Temp-Ordner als userData (`NIKKI_USER_DATA` und `--user-data-dir`). Fixtures werden dort als `state.json` abgelegt.
- Im Standardlauf zeigen `HOME` und `USERPROFILE` auf einen Temp-Ordner. Die Hooks sind in einem frischen Stand aus. Nur `relay.e2e.js` schaltet sie ein, und zwar in der `settings.json` dieses Temp-Homes. Die echte `~/.claude/settings.json` wird nie geschrieben.
- Der Claude-Lauf braucht das echte Home, weil dort der Login liegt. Er arbeitet in einem Temp-Projekt und löscht danach dessen Transkripte unter `~/.claude/projects/`.
- `NikkiHelper.exe` startet in keinem Lauf (`NIKKI_NO_HELPER`): Die echte Wiedergabe und die Lautstärke bleiben unberührt.
- Alle Temp-Ordner (`%TEMP%\nikki-e2e-*`) werden nach jedem Test gelöscht.
- `clipboard.e2e.js` braucht die echte Zwischenablage. Vorher sichert `win-clipboard.js` jedes Format (Win32 über PowerShell), danach kommt alles byte-gleich zurück, aber nur, solange noch ein Testtext drinsteht: Was du währenddessen kopierst, bleibt. Testtexte und Wiederherstellung tragen die Windows-Marker `CanIncludeInClipboardHistory` und `CanUploadToCloudClipboard` (= 0), landen also weder im Verlauf (Win+V) noch in der Cloud. Nikkis eigenes „Klick kopiert“ wird im Test nur aufgezeichnet. Die OLE-Hilfsformate „DataObject“ und „Ole Private Data“ (ein Fensterhandle der kopierenden App, kein Inhalt) werden nicht gesichert; OLE baut sie aus den übrigen Formaten neu.

## Gegenprobe

Jeder Bug-Test wurde gegen den Code mit wieder eingebautem Fehler laufen gelassen und ist dort rot geworden: B1 (`console. log(fs. readFileSync("a. txt"))`), B2 (`sessionId: "sess-A"` im Start), B6 (zwei Stops), B4 („Der Start ist fehlgeschlagen…“) und B5 („Nikki stolpert.“ statt „Nikki stoppte.“). Beim Relay werden ohne die „Immer“-Regeln bzw. ohne das Löschen der vorgemerkten Nachricht die passenden Tests rot.
