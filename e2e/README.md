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
| | Module: in den Settings aus- und wieder einschalten ändert Tabs und Kacheln ohne Neustart; ein To-do landet in `userData/modules/todo.json`; „An Chat“ füllt nur das Eingabefeld |
| `relay.e2e.js` | Terminal-Rückkanal über das echte `hook.cjs`: Der Start schreibt den wartenden PermissionRequest-Hook (`--wait`, timeout 120), „Immer“ in der Insel geht als allow mit `updatedPermissions` zurück, ein Stop der Session räumt die Karte ab, eine vorgemerkte Nachricht kommt genau einmal per `--stop` als `block` zurück |
| `claude.e2e.js` (nur mit `NIKKI_E2E_CLAUDE=1`) | Prompt, Freigabe erlauben (`node -e`), Freigabe ablehnen (`git init`), B4: Senden direkt nach „fertig“, B5: Stop ohne Diagnose-Text |

Im Standardlauf ersetzt `fakeClaude()` (in `nikki.js`) die IPCs `start` und `stop` im Hauptprozess, und die Tests schicken Status und Freigaben selbst. Die Claude-Tests nutzen Haiku und kurze Prompts, also etwa sechs kleine Läufe über dein Abo.

## Nutzerdaten

- Jeder Start bekommt einen frischen Temp-Ordner als userData (`NIKKI_USER_DATA` und `--user-data-dir`). Fixtures werden dort als `state.json` abgelegt.
- Im Standardlauf zeigen `HOME` und `USERPROFILE` auf einen Temp-Ordner. Die Hooks sind in einem frischen Stand aus. Nur `relay.e2e.js` schaltet sie ein, und zwar in der `settings.json` dieses Temp-Homes. Die echte `~/.claude/settings.json` wird nie geschrieben.
- Der Claude-Lauf braucht das echte Home, weil dort der Login liegt. Er arbeitet in einem Temp-Projekt und löscht danach dessen Transkripte unter `~/.claude/projects/`.
- Alle Temp-Ordner (`%TEMP%\nikki-e2e-*`) werden nach jedem Test gelöscht.

## Gegenprobe

Jeder Bug-Test wurde gegen den Code mit wieder eingebautem Fehler laufen gelassen und ist dort rot geworden: B1 (`console. log(fs. readFileSync("a. txt"))`), B2 (`sessionId: "sess-A"` im Start), B6 (zwei Stops), B4 („Der Start ist fehlgeschlagen…“) und B5 („Nikki stolpert.“ statt „Nikki stoppte.“). Beim Relay werden ohne die „Immer“-Regeln bzw. ohne das Löschen der vorgemerkten Nachricht die passenden Tests rot.
