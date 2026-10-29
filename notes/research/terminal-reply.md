# Aus der Notch antworten: Freigaben, Fragen und Folge-Prompts für Claude-Code-Terminal-Sessions

Stand: 2026-10-29. Grundlage ist die offizielle Claude-Code-Doku, abgerufen am 2026-10-29: [Hooks-Referenz](https://code.claude.com/docs/en/hooks), [Hooks-Guide](https://code.claude.com/docs/en/hooks-guide), [Channels](https://code.claude.com/docs/en/channels), [Channels-Referenz](https://code.claude.com/docs/en/channels-reference) und [Remote Control](https://code.claude.com/docs/en/remote-control). Die Doku nennt Versionen bis v2.1.295+; Nikki ist gegen CLI 2.1.308 getestet (`backends/claude.js:6`). Code-Stellen beziehen sich auf den Commit `a2a48ca`.

## 1. Kurzfazit

- **Freigaben (Allow/Deny/Always)** kann eine Notch für eine Terminal-Session offiziell beantworten. Nötig ist ein **synchroner** `PermissionRequest`-Hook, der wartet, bis die Notch antwortet, und dann `hookSpecificOutput.decision` ausgibt ([Hooks: PermissionRequest decision control](https://code.claude.com/docs/en/hooks#permissionrequest-decision-control)).
- **Fragen (`AskUserQuestion`) und Plan-Freigabe (`ExitPlanMode`)** gehen offiziell über `allow` plus `updatedInput`, bei Fragen inklusive `answers` ([Hooks: Tools that require user interaction](https://code.claude.com/docs/en/hooks#tools-that-require-user-interaction)). Die Doku zeigt das für `PreToolUse`. Coucou und Vibe Island machen es über `PermissionRequest`, dort bleibt der Terminal-Dialog parallel bedienbar (Abschnitt 4).
- **Folge-Prompts** sind der schwierige Fall. Hooks können keinen neuen User-Prompt in eine untätige Session schreiben. Ein `Stop`-Hook kann das Beenden nur verhindern und Claude mit `decision: "block"` und `reason` weiterarbeiten lassen ([Hooks: Stop decision control](https://code.claude.com/docs/en/hooks#stop-decision-control)). Der offizielle Weg, Nachrichten von außen in eine *laufende* Session zu schieben, sind **Channels**. Für eigene Channels ist das ein Research Preview mit Entwickler-Flag ([Channels-Referenz](https://code.claude.com/docs/en/channels-reference#test-during-the-research-preview)).
- **Nikki heute:** Alle Claude-Hooks sind mit `async: true` registriert (`lib/hooks.js:18-22`). Laut Doku können async Hooks grundsätzlich nichts entscheiden ([Hooks: Run hooks in the background](https://code.claude.com/docs/en/hooks#run-hooks-in-the-background)). Nikki kann Terminal-Sessions deshalb heute nur beobachten.
- **Empfehlung:** Als Stufe 1 **ein** zusätzlicher synchroner `PermissionRequest`-Hook, der per Long-Poll an Nikkis vorhandenem lokalem Server wartet. Er beantwortet Freigaben, Fragen und Pläne. Bei App aus oder Timeout fällt er still auf den Terminal-Dialog zurück. Alle anderen Hooks bleiben async. Für Folge-Prompts in Stufe 2 gibt es zwei Optionen: „Nachricht vormerken“ (Zustellung am nächsten `Stop`) und optional einen Nikki-Channel (opt-in, Start mit Flag). Tastendruck-Injection ins Terminal ist nicht empfohlen. Details stehen in Abschnitt 6.

## 2. Was Nikki heute macht

| Stelle | Verhalten |
| :- | :- |
| `lib/hooks.js:2` | Registriert `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `Notification`, `Stop` und `SessionEnd` in `~/.claude/settings.json`. |
| `lib/hooks.js:18-22` | Jeder Eintrag ist `{ type: 'command', command, async: true }`. Kommentar: „the terminal session never waits for the app“. |
| `hook.cjs:79-114` | Liest den Hook-JSON von stdin, normalisiert ihn und schickt ihn per `POST /hook` (Timeout 1 s) an `127.0.0.1:<port>` mit `x-token`. Für Claude gibt es keine Antwort auf stdout, nur Cursor bekommt ein festes `allow` (`hook.cjs:36-49`, `85-90`). |
| `hook.cjs:7-16` | Läuft der Hook in einer von Nikki selbst gestarteten Session (`DESKTOPCOMPANION_AGENT`), antwortet er sofort und schickt nichts. Diese Sessions melden sich über das SDK. |
| `main.js:465-483` | `onHook` macht daraus pro `session_id` einen Status (`hookToStatus`) und zeigt Session-Pills, Ton und Toast bei `needsYou`/`done`. |
| `main.js:485-503` | HTTP-Server auf zufälligem Port mit Token pro Start. Port und Token stehen in `userData/hook.json`. Die Antwort ist sofort leer (`res.end()`). |
| `lib/status.js:84-89` | `PermissionRequest` → „Nikki will OK!“, `Notification` mit `permission_prompt`/`elicitation_dialog`/`agent_needs_input` → `needsYou`. |
| `backends/claude.js:24-31` | Nur für **eigene** Sessions (Agent SDK) beantwortet Nikki Freigaben, Fragen (`answers` über `toAnswers`) und Pläne über `canUseTool`. |

Fazit: Der Transport (Hook → lokaler HTTP-Server mit Token) gibt es schon. Es fehlen der Rückkanal (die Hook-Antwort) und synchrone Hook-Einträge.

## 3. Hook-Mechanismen laut offizieller Doku

### 3.1 Übersicht: Ziel → Mechanismus

| Ziel aus der Notch | Event | Ausgabe | Gilt im interaktiven Terminal? | Quelle |
| :- | :- | :- | :- | :- |
| Tool erlauben/ablehnen | `PermissionRequest` | `hookSpecificOutput.decision.behavior: "allow" \| "deny"` | ja | [PermissionRequest decision control](https://code.claude.com/docs/en/hooks#permissionrequest-decision-control) |
| „Immer erlauben“ | `PermissionRequest` | `decision.updatedPermissions` (z. B. `addRules`, `setMode`), Vorschläge kommen als `permission_suggestions` | ja | [Permission update entries](https://code.claude.com/docs/en/hooks#permission-update-entries), [PermissionRequest input](https://code.claude.com/docs/en/hooks#permissionrequest-input) |
| Ablehnen und Claude stoppen | `PermissionRequest` | `decision.behavior: "deny"`, `message`, `interrupt: true` | ja | [PermissionRequest decision control](https://code.claude.com/docs/en/hooks#permissionrequest-decision-control) |
| Tool vorab erlauben/ablehnen/nachfragen | `PreToolUse` | `hookSpecificOutput.permissionDecision: "allow" \| "deny" \| "ask" \| "defer"` | ja, außer `defer` | [PreToolUse decision control](https://code.claude.com/docs/en/hooks#pretooluse-decision-control) |
| Frage beantworten (`AskUserQuestion`) | `PreToolUse` (Doku) oder `PermissionRequest` (Praxis bei Coucou und Vibe Island, siehe Abschnitt 4) | `permissionDecision: "allow"` + `updatedInput: { questions, answers: { "<Frage>": "<Label>" } }` bzw. `decision: { behavior: "allow", updatedInput }` | ja | [Tools that require user interaction](https://code.claude.com/docs/en/hooks#tools-that-require-user-interaction) |
| Plan annehmen (`ExitPlanMode`) | `PreToolUse` oder `PermissionRequest` | `allow` + `updatedInput` (PreToolUse) bzw. `decision.behavior: "allow"` (PermissionRequest, Beispiel im Guide) | ja | [Tools that require user interaction](https://code.claude.com/docs/en/hooks#tools-that-require-user-interaction), [Hooks-Guide: Auto-approve](https://code.claude.com/docs/en/hooks-guide) |
| Claude nach „fertig“ weiterarbeiten lassen | `Stop` | `decision: "block"` + `reason`, oder `hookSpecificOutput.additionalContext` | ja | [Stop decision control](https://code.claude.com/docs/en/hooks#stop-decision-control) |
| Session aus dem Leerlauf wecken | beliebig, `asyncRewake: true` | Exit-Code 2, stderr wird Claude als System-Reminder gezeigt | ja | [Command hook fields](https://code.claude.com/docs/en/hooks#command-hook-fields), [Limitations](https://code.claude.com/docs/en/hooks#limitations) |
| Neuen Prompt in eine untätige Session tippen | – | **per Hook nicht möglich** (siehe 3.5) | – | [UserPromptSubmit decision control](https://code.claude.com/docs/en/hooks#userpromptsubmit-decision-control) |
| Nur Signal „wartet auf dich“ | `Notification` | keine Entscheidung möglich | ja | [Notification](https://code.claude.com/docs/en/hooks#notification) |
| MCP-Formular beantworten | `Elicitation` | `action: accept/decline/cancel` + `content` | ja | [Elicitation output](https://code.claude.com/docs/en/hooks#elicitation-output) |

### 3.2 PermissionRequest: das Freigabe-Event

- Feuert, „when Claude Code is about to ask you for permission to use a tool“. Matcher ist der Tool-Name ([PermissionRequest](https://code.claude.com/docs/en/hooks#permissionrequest)).
- Der Input hat `tool_name`, `tool_input`, optional `permission_suggestions` und keine `tool_use_id` ([PermissionRequest input](https://code.claude.com/docs/en/hooks#permissionrequest-input)).
- Ausgabe:

  ```json
  { "hookSpecificOutput": { "hookEventName": "PermissionRequest",
      "decision": { "behavior": "allow", "updatedPermissions": [ /* aus permission_suggestions */ ] } } }
  ```

  Deny- und Ask-Regeln werden trotzdem geprüft, ein Hook-`allow` hebelt eine Deny-Regel also nicht aus. Exit-Code 2 *ohne* `decision` ändert nichts ([PermissionRequest decision control](https://code.claude.com/docs/en/hooks#permissionrequest-decision-control)).
- **Dialog und Hook laufen parallel.** Die offizielle Doku sagt „whichever decides first applies“ ausdrücklich nur für `--permission-prompt-tool` und SDK-`canUseTool` ([PermissionRequest](https://code.claude.com/docs/en/hooks#permissionrequest)). Für das interaktive Terminal belegen es Drittquellen:
  - Issue #12176: „PermissionRequest hooks execute asynchronously **in parallel** with permission dialogs being displayed“. Geschlossen als `COMPLETED` am 2025-11-23 ([GitHub #12176](https://github.com/anthropics/claude-code/issues/12176)).
  - Pushary: „`PermissionRequest` sends the phone question while the terminal prompt is open … The first answer wins. Answer in the terminal and the phone question closes.“ ([Pushary: Claude Code hooks explained](https://pushary.com/blog/claude-code-hooks-explained)).
  - Coucou: Ohne Entscheidung schweigt der Hook, „the agent asks in its own terminal“ ([coucou/windows/hook/src/reply.rs](https://github.com/Louis-CFM/coucou/blob/main/windows/hook/src/reply.rs)).

  Der Nutzer kann also jederzeit im Terminal antworten. Die Notch ist ein zweiter, gleichwertiger Weg.
- **Offene Lücke:** Antwortet der Nutzer im Terminal, beendet Claude Code den wartenden Hook-Prozess nicht. Es gibt kein Signal und kein stdin-EOF. Issue #15433 („This is still occurring“) wurde am 2026-03-05 wegen Inaktivität geschlossen, nicht behoben ([GitHub #15433](https://github.com/anthropics/claude-code/issues/15433)). Ein Notch-Hook muss selbst erkennen, dass die Frage erledigt ist, z. B. am nächsten `PostToolUse`/`Stop`/`UserPromptSubmit` derselben Session, und sich dann ohne Ausgabe beenden. Sonst bleibt eine veraltete Freigabe-Karte in der Notch stehen.
- Der Hooks-Guide zeigt bei Hook-Allow „Allowed by PermissionRequest hook“ an der Stelle, „where the dialog would have appeared“ ([Hooks-Guide](https://code.claude.com/docs/en/hooks-guide)).
- **Timing:** Das Event `Notification` mit `permission_prompt` kommt erst, nachdem der Prompt „about six seconds“ gewartet hat. `PermissionRequest` kommt sofort ([PermissionRequest](https://code.claude.com/docs/en/hooks#permissionrequest), [Notification](https://code.claude.com/docs/en/hooks#notification)).
- Sandbox-Netzwerk-Prompts lösen kein `PermissionRequest` aus, nur `Notification` mit `permission_prompt` ([PermissionRequest](https://code.claude.com/docs/en/hooks#permissionrequest)).

### 3.3 PreToolUse: Fragen und Pläne

- `permissionDecision`: `allow` überspringt den Prompt, `deny` blockiert, `ask` zeigt den Prompt mit Herkunfts-Label, `defer` gilt **nur in `-p`** und wird interaktiv mit einer Warnung ignoriert ([PreToolUse decision control](https://code.claude.com/docs/en/hooks#pretooluse-decision-control)).
- Bei `AskUserQuestion` und `ExitPlanMode` reicht `allow` allein nicht. Der Hook muss die Antwort sammeln und in `updatedInput` zurückgeben. Für Fragen heißt das: `questions` zurückspiegeln und `answers` (Fragetext → Label) ergänzen. Beispiel aus der Doku ([Tools that require user interaction](https://code.claude.com/docs/en/hooks#tools-that-require-user-interaction)):

  ```json
  { "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "allow",
      "updatedInput": { "questions": [ … ], "answers": { "Which framework?": "React" } } } }
  ```

  Das ist dasselbe Format, das Nikki für eigene Sessions schon baut (`lib/status.js` `toAnswers`, `backends/claude.js:27`).
- `defer` ist für Apps gedacht, die `claude -p` als Subprozess fahren: Die Runde endet mit `stop_reason: "tool_deferred"`, danach `claude -p --resume <id>` ([Defer a tool call for later](https://code.claude.com/docs/en/hooks#defer-a-tool-call-for-later)). Für interaktive Terminal-Sessions bringt das nichts.
- Timeout: Ein `PreToolUse`-Hook, der in den Timeout läuft, blockiert nicht. Der Aufruf geht dann in den normalen Permission-Flow, außer bei `onFailure: "block"` ([Timeouts](https://code.claude.com/docs/en/hooks#timeouts)). Für Nikki ist das der gewünschte Rückfall.

### 3.4 Stop: Weiterarbeiten statt Folge-Prompt

- Der Input enthält `stop_hook_active`, `last_assistant_message`, `background_tasks` und `session_crons` ([Stop input](https://code.claude.com/docs/en/hooks#stop-input)). Mit `last_assistant_message` kann die Notch die Antwort anzeigen, ohne das Transcript zu parsen. Das ist schon im asynchronen Beobachtungsmodus nutzbar.
- `decision: "block"` mit Pflichtfeld `reason` verhindert das Stoppen. `reason` „Tells Claude why it should continue“. `additionalContext` wirkt genauso, wird aber als „Stop hook feedback“ statt als Fehler gezeigt ([Stop decision control](https://code.claude.com/docs/en/hooks#stop-decision-control)).
- Schutz gegen Endlosschleifen: Nach 8 Fortsetzungen in Folge endet die Runde (`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`) ([Stop input](https://code.claude.com/docs/en/hooks#stop-input)).
- Für einen Notch-Folge-Prompt heißt das: Ein **synchroner** Stop-Hook müsste warten, bis der Nutzer in der Notch etwas tippt, und es dann als `reason` zurückgeben. So lange gilt die Session als „läuft noch“ (Spinner, Hook-Timeout Standard 600 s, [Common fields](https://code.claude.com/docs/en/hooks#common-fields)). Ob man im Terminal währenddessen tippen kann, ist nicht dokumentiert (**unsicher**). Der Text kommt bei Claude als Begründung eines Stop-Hooks an, nicht als Nutzer-Nachricht.

### 3.5 Kein Prompt-Injection-Kanal per Hook

- `UserPromptSubmit` „can't replace the prompt; it only injects `additionalContext`“ und kann blockieren ([UserPromptSubmit decision control](https://code.claude.com/docs/en/hooks#userpromptsubmit-decision-control)). Ein Prompt muss also schon abgeschickt sein.
- Hooks haben kein Terminal. Schreiben nach `/dev/tty` schlägt fehl, `terminalSequence` erlaubt nur OSC 0/1/2/9/99/777 und BEL, also Titel, Desktop-Benachrichtigung und Glocke, aber keine Eingabe ([JSON output](https://code.claude.com/docs/en/hooks#json-output), [Emit terminal notifications](https://code.claude.com/docs/en/hooks#emit-terminal-notifications)).
- `asyncRewake` ist die einzige dokumentierte Hook-Möglichkeit, eine *untätige* Session zu wecken: „an `asyncRewake` hook that exits with code 2 wakes Claude immediately even when the session is idle“. stderr wird als System-Reminder gezeigt ([Limitations](https://code.claude.com/docs/en/hooks#limitations), [Command hook fields](https://code.claude.com/docs/en/hooks#command-hook-fields)). Gedacht ist das für Fehler aus Hintergrundprozessen. Als Kanal für Folge-Prompts wäre es eine Zweckentfremdung (**unsicher**, ob Claude den Text als Auftrag behandelt). Für `asyncRewake` gilt der `timeout` weiterhin ([Configure an async hook](https://code.claude.com/docs/en/hooks#configure-an-async-hook)).

### 3.6 Async gegen sync

- „Async hooks can't block or control Claude's behavior: response fields like `decision`, `permissionDecision`, and `continue` have no effect“ ([Run hooks in the background](https://code.claude.com/docs/en/hooks#run-hooks-in-the-background)). Das ist genau Nikkis heutiger Modus.
- Synchrone Hooks blockieren, bis sie fertig sind. Das Standard-Timeout ist 600 s für `command`/`http` und 30 s auf `UserPromptSubmit` ([Common fields](https://code.claude.com/docs/en/hooks#common-fields)). `statusMessage` setzt einen eigenen Spinner-Text, der im Terminal z. B. „Warte auf Nikki…“ zeigen könnte ([Common fields](https://code.claude.com/docs/en/hooks#common-fields)).
- Startet ein synchroner Hook einen Hintergrundprozess, muss er die Entscheidung *vorher* ausgeben und dessen stdout/stderr umleiten ([Hooks that start a background process](https://code.claude.com/docs/en/hooks#hooks-that-start-a-background-process)).

### 3.7 Transport: `command` oder `http`

- `type: "http"` schickt den Event-JSON als POST an `url`. Eine 2xx-Antwort mit JSON-Objekt wird wie Command-Output ausgewertet. Leerer Body heißt Erfolg ohne Entscheidung. Verbindungsfehler oder Nicht-2xx sind ein nicht blockierender Fehler ([HTTP hook fields](https://code.claude.com/docs/en/hooks#http-hook-fields), [HTTP response handling](https://code.claude.com/docs/en/hooks#http-response-handling)).
- `headers` dürfen nur Umgebungsvariablen aus `allowedEnvVars` einsetzen ([HTTP hook fields](https://code.claude.com/docs/en/hooks#http-hook-fields)). Nikkis Token und Port ändern sich bei jedem Start (`main.js:464`, `main.js:502`). Ein HTTP-Hook müsste beides bei jedem Start neu in `settings.json` schreiben. Das passiert heute schon beim Start (`main.js:643`).
- `onFailure: "block"` (ab v2.1.295) würde eine Freigabe bei totem Nikki *verweigern* ([Block the action when a hook fails](https://code.claude.com/docs/en/hooks#block-the-action-when-a-hook-fails)). Für Nikki ist das falsch, Standard `continue` ist richtig.
- Sicherheit: Hooks laufen mit vollen Nutzerrechten. Im interaktiven Modus laufen sie erst nach dem Workspace-Trust-Dialog ([Security considerations](https://code.claude.com/docs/en/hooks#security-considerations)). Ein Freigabe-Rückkanal heißt: Wer Nikkis Port und Token kennt, kann Tools freigeben. Der Token bleibt deshalb Pflicht.
- Windows: Command-Hooks laufen über Git Bash oder, falls nicht vorhanden, über PowerShell (`shell`-Feld). Nikki nutzt einen absoluten `node`-Pfad (`main.js:526-527`) ([Command hook fields](https://code.claude.com/docs/en/hooks#command-hook-fields)).

### 3.8 Wege außerhalb der Hooks

| Weg | Was er kann | Haken | Quelle |
| :- | :- | :- | :- |
| **Channels** (MCP-Server mit `claude/channel`) | Schiebt Nachrichten als `<channel>`-Event in die **laufende** Session, auch im Leerlauf. Mit `claude/channel/permission` werden Freigaben **parallel** zum Terminal-Dialog weitergereicht: „Both stay live … Claude Code applies whichever answer arrives first“. | Research Preview. Eigene Channels stehen nicht auf der Allowlist und brauchen `claude --dangerously-load-development-channels server:<name>` (nur interaktiv). Login über claude.ai oder Console nötig. Das Relay deckt nur Tool-Freigaben ab, keine Trust-Dialoge. Das Verdict gilt nur für diesen einen Aufruf (kein „Immer“). | [Channels-Referenz: Relay permission prompts](https://code.claude.com/docs/en/channels-reference#relay-permission-prompts), [Test during the research preview](https://code.claude.com/docs/en/channels-reference#test-during-the-research-preview), [Channels: Research preview](https://code.claude.com/docs/en/channels#research-preview) |
| **Remote Control** | Lokale Session aus claude.ai/code oder der Claude-App weiterführen, Nachrichten von Terminal, Browser und Handy im Wechsel | Nur über Anthropic-Oberflächen, keine dokumentierte lokale API für Drittanbieter-Apps | [Remote Control](https://code.claude.com/docs/en/remote-control) |
| **Agent SDK / `canUseTool`** | Volle Kontrolle (Freigaben, Fragen, Pläne, Folge-Prompts per `resume`) | Gilt nur für Sessions, die Nikki selbst startet. Das macht Nikki schon (`backends/claude.js`). | [Hooks: PermissionRequest](https://code.claude.com/docs/en/hooks#permissionrequest) |
| **`-p` + `defer`** | Frage parken, später mit `--resume` beantworten | Nur nicht-interaktiv | [Defer a tool call for later](https://code.claude.com/docs/en/hooks#defer-a-tool-call-for-later) |
| **Tastendruck-Injection** (AppleScript, `tmux send-keys`, Win32 `WriteConsoleInput`/`SendInput`) | Tippt Text oder eine Dialog-Taste ins Terminal | Nicht offiziell, fragil (Fokus, Terminal-Typ, Dialog-Layout). Unter Windows Terminal gibt es keine dokumentierte API dafür (**unsicher**). | (siehe Abschnitt 4: welche Tools das tun) |

## 4. Wie Agent-Tools aus Gruppe B das lösen

Gelesen wurden READMEs, Websites, Issues und Quelldateien, kein Tool wurde installiert. Stand 2026-10-30.

| Tool | Transport Hook → App | Freigaben | Fragen / Plan | Folge-Prompt in die Terminal-Session | Quelle |
| :- | :- | :- | :- | :- | :- |
| **Coucou** (macOS, Win, Linux) | Hook-Binary → Unix-Socket bzw. Named Pipe unter Windows (`coucou-hook.exe`). „For approvals it waits for your click, then answers the hook. If Coucou isn't running, the hook exits immediately.“ | `PermissionRequest` mit 120 s Timeout, Antwort `decision.behavior` `allow`/`deny` (`message: "Denied from Coucou"`). „Always“ antwortet nur `allow`, die Insel merkt sich die Wahl selbst. Andere Events haben 10 s Timeout. | `AskUserQuestion` per `behavior: "allow"` + `updatedInput` mit `answers`, geprüft gegen die Option-Labels. Bei „Reply in terminal“ kommt keine Entscheidung, und der Agent fragt im Terminal. | Nicht ins Terminal. Vom iPhone (opt-in) startet der Mac `claude -p <text> --resume <id>` im Hintergrund. | [README](https://github.com/Louis-CFM/coucou), [hooks.rs](https://github.com/Louis-CFM/coucou/blob/main/windows/src-tauri/src/hooks.rs), [reply.rs](https://github.com/Louis-CFM/coucou/blob/main/windows/hook/src/reply.rs), [InstructionRunner.swift](https://github.com/Louis-CFM/coucou/blob/main/NotchBuddy/Sources/App/PhoneLink/InstructionRunner.swift) |
| **Vibe Island** (macOS, closed source) | `vibe-island-hook` / `vibe-island-bridge`, richtet sich selbst ein | `PermissionRequest`, `matcher=*`, `timeout=86400` | `AskUserQuestion` läuft laut Issue über den `PermissionRequest`-Hook („Allowed by PermissionRequest hook“). Plan-Review mit Feedback steht auf der Website. | Nicht angegeben. Der Stop-Hook blockiert das Beenden 15–21 s (Bug-Report). | [Issue #245](https://github.com/vibeislandapp/vibe-island/issues/245), [#105](https://github.com/vibeislandapp/vibe-island/issues/105), [#159](https://github.com/vibeislandapp/vibe-island/issues/159), [vibeisland.app/claude-code](https://vibeisland.app/claude-code/) |
| **Claude Island / Vibe Notch** (macOS) | Python-Hook → `/tmp/claude-island.sock`, `TIMEOUT_SECONDS = 300` | `PermissionRequest` → `decision.behavior`. Ersatzweg über tmux: `send-keys` `1⏎` (einmal), `2⏎` (immer), `n⏎` (ablehnen) | – | **Nur in tmux:** `tmux send-keys -t <target> -l <text>` + Enter. Ohne tmux: „Open Claude Code in tmux to enable messaging“. | [claude-island-state.py](https://github.com/farouqaldori/vibe-notch/blob/main/ClaudeIsland/Resources/claude-island-state.py), [ToolApprovalHandler.swift](https://github.com/farouqaldori/vibe-notch/blob/main/ClaudeIsland/Services/Tmux/ToolApprovalHandler.swift), [ChatView.swift](https://github.com/farouqaldori/vibe-notch/blob/main/ClaudeIsland/UI/Views/ChatView.swift) |
| **Notchi** (macOS) | bash+python → Unix-Socket. Wartet **nur** bei `PermissionRequest` und nur in interaktiven Sessions (nicht `claude -p`), 290 s | „Yes“ / „Yes, and don't ask again“ / „No“ | `answers`-Map | – | [notchi-hook.sh](https://github.com/sk-ruban/notchi/blob/main/notchi/notchi/Resources/notchi-hook.sh), [SessionStore.swift](https://github.com/sk-ruban/notchi/blob/main/notchi/notchi/Services/SessionStore.swift) |
| **CodeIsland** (macOS) | `codeisland-bridge` → Unix-Socket. „For events that wait on you, the answer travels back the same way.“ | `PermissionRequest` mit Timeout 86400, `decision.behavior` | Eigene QuestionBar für `AskUserQuestion` | – (springt zu tmux-Pane oder Terminal-Tab) | [README](https://github.com/wxtsky/CodeIsland), [ConfigInstaller.swift](https://github.com/wxtsky/CodeIsland/blob/main/Sources/CodeIsland/ConfigInstaller.swift), [HookServer.swift](https://github.com/wxtsky/CodeIsland/blob/main/Sources/CodeIsland/HookServer.swift) |
| **Ping Island** (macOS) | Hook-Dateien + `PingIslandBridge`. Codex auch über `codex app-server` (WebSocket) | `PermissionRequest` `allow`/`deny` | `PreToolUse` `permissionDecision: "allow"` + `updatedInput` | tmux-`send-keys`-Handler aus Claude Island übernommen | [HookPayloadMapper.swift](https://github.com/erha19/ping-island/blob/main/Prototype/Sources/IslandShared/HookPayloadMapper.swift), [ToolApprovalHandler.swift](https://github.com/erha19/ping-island/blob/main/PingIsland/Services/Tmux/ToolApprovalHandler.swift) |
| **Open Island** (macOS) | `OpenIslandHooks`-CLI → Unix-Socket, fail-open. `OPEN_ISLAND_SKIP_HOOKS=1` für eigene Läufe | `PermissionRequest` mit 24 h Timeout, `decision.behavior` + `updatedInput` + `updatedPermissions` | `PreToolUse` allow/deny/ask + `updatedInput` | – | [docs/hooks.md](https://github.com/Octane0411/open-vibe-island/blob/main/docs/hooks.md) |
| **ClaudeNotch** (macOS) | `PreToolUse`-Hook → `POST /permission`, hält die HTTP-Verbindung offen, bei Fehler Rückfall auf den Claude-Prompt | Allow / Deny / Always, Diff-Vorschau, Touch ID bei riskanten Befehlen | Optionen + Freitext | **Drei Wege:** synthetische `CGEvent`-Tastendrücke ins laufende Terminal (braucht Accessibility), `claude --resume <id> "<msg>"` für Hintergrund-Agenten, sonst neues Terminal | [README](https://github.com/rawsun007/claude-notch), [TerminalAutomator.swift](https://github.com/rawsun007/claude-notch/blob/main/Sources/ClaudeNotch/TerminalAutomator.swift), [AppState+Compose.swift](https://github.com/rawsun007/claude-notch/blob/main/Sources/ClaudeNotch/AppState%2BCompose.swift) |
| **Pushary Isle** (macOS + Handy, Cloud) | `PreToolUse` prüft gegen eine Policy und gibt `ask` zurück. `PermissionRequest` schickt die Frage ans Handy, „The first answer wins“ | ja | ja (nummerierte Optionen, Freitext) | nicht angegeben | [Pushary-Blog](https://pushary.com/blog/claude-code-hooks-explained), [Mac-App-Doku](https://pushary.com/docs/agents/mac-app) |
| **Pester** (Windows, Python) | `pre_tool_use` und `permission_request` → localhost-HTTP, pollt bis zur Entscheidung, gibt `allow`/`deny` als JSON zurück. Läuft die App nicht, fällt der Hook durch. | Allow (Y/Enter) / Always (A) / Deny (N/Esc), Timeout-Verhalten einstellbar | – | – | [README](https://github.com/BryanRonad/pester), [permission_request.py](https://github.com/BryanRonad/pester/blob/main/src/hooks/permission_request.py) |
| **Notchy** (macOS) | Keine Hooks. Die App hostet das PTY selbst (SwiftTerm). | Tippt direkt ins eingebettete Terminal | dto. | **Direkt**, weil die App das Terminal ist. Status kommt aus Text-Scraping („Esc to cancel“). | [TerminalManager.swift](https://github.com/adamlyttleapps/notchy/blob/main/Notchy/TerminalManager.swift), [TerminalSession.swift](https://github.com/adamlyttleapps/notchy/blob/main/Notchy/TerminalSession.swift) |
| **Agent Island** (macOS, Windows WPF) | Keine Hooks. Scannt alle 6 s JSONL-Transcripts. | – | – | Nur Auto-Resume nach Usage-Reset per Resume-Befehl | [DEV-Artikel](https://dev.to/tristan666666/how-agent-island-detects-claude-code-and-codex-session-state-2p93) |
| **Claude Usage Tracker** (macOS) | `"type": "http"`-Hooks auf einen lokalen Server, `/hook/<token>/<event>`, 3 s Timeout | „Deliberately excludes PermissionRequest“, also passiv | – | – | [NotchHookInstaller.swift](https://github.com/hamed-elfayome/Claude-Usage-Tracker/blob/main/Claude%20Usage/Shared/Services/NotchHUD/NotchHookInstaller.swift) |
| **ClaudeBar**, **Glint** (Win), **CCNotify** | Fire-and-forget (`curl … &` bzw. `overlay-hook.exe` mit 200 ms und Ausgabe `{}`) | – | – | – | [ClaudeBar session hooks](https://github.com/tddworks/ClaudeBar/blob/main/docs/features/activity/session-hooks/README.md), [Glint](https://github.com/anasm266/glint), [CCNotify](https://github.com/dazuiba/CCNotify) |

**Muster, das sich durchzieht:**

1. **Freigaben:** Fast alle setzen einen **synchronen `PermissionRequest`-Hook** ein, der auf Socket oder HTTP wartet (120 s bis 24 h). Bei toter App oder Timeout gibt es keine Ausgabe, der Terminal-Dialog bleibt gültig (fail-open). ClaudeNotch und Pester haken zusätzlich `PreToolUse` ein.
2. **Fragen:** `AskUserQuestion` per `allow` + `updatedInput.answers`, entweder über `PreToolUse` (Ping Island, Open Island) oder über `PermissionRequest` (Coucou, Vibe Island).
3. **Folge-Prompts in die laufende Terminal-Session** gibt es nur mit Tastatur-Injection: tmux `send-keys` (Claude Island, Ping Island, NotchCode verlangt tmux) oder macOS-`CGEvent` (ClaudeNotch). Alternativ hostet die App selbst das Terminal (Notchy). Wer das nicht will, startet eine **neue** Runde per `claude -p … --resume <id>` (Coucou, ClaudeNotch). Das ist dann ein zweiter Prozess auf derselben Session, nicht das offene Terminal. **Kein** untersuchtes Tool nutzt Stop-`block` oder Channels für Folge-Prompts.
4. **Windows:** Coucou (Named Pipe, Rust-Hook-Binary) und Pester (Python, localhost-HTTP) beantworten Freigaben unter Windows. Folge-Prompts in ein Windows-Terminal fand ich bei keinem Tool.

## 5. Nikki heute gegen das Mögliche

| Fähigkeit für Terminal-Sessions | Nikki heute | Technisch möglich mit | Vorbild |
| :- | :- | :- | :- |
| Status, Schritte, „braucht dich“, „fertig“ | ✓ async Hooks (`lib/hooks.js:2`) | – | alle |
| Antworttext nach „fertig“ anzeigen | – (`Stop` wird nur zu „Nikki ist fertig.“, `lib/status.js`) | `last_assistant_message` im `Stop`-Input, auch async | Claude Island, CodeIsland (letzte Antwort) |
| Freigabe Erlauben / Ablehnen | – | synchroner `PermissionRequest` → `decision.behavior` | Coucou, Notchi, CodeIsland, Pester (Windows) |
| „Immer erlauben“ | – | `decision.updatedPermissions` aus `permission_suggestions` | Open Island |
| Ablehnen mit Grund / stoppen | – | `decision.message`, `decision.interrupt: true` | ClaudeNotch, Pushary |
| Frage (`AskUserQuestion`) beantworten | – | `allow` + `updatedInput.answers` (über `PermissionRequest` oder `PreToolUse`) | Coucou, Vibe Island (PermissionRequest), Ping Island, Open Island (PreToolUse) |
| Plan (`ExitPlanMode`) annehmen | – | `PermissionRequest` allow (Doku-Beispiel), Ablehnen mit `message` | Vibe Island |
| Folge-Prompt, solange Claude noch arbeitet | – | Vormerken, dann am nächsten `Stop` `decision: "block"` + `reason` bzw. `additionalContext` | kein Tool gefunden |
| Folge-Prompt in eine untätige Session | – | Channel (`notifications/claude/channel`), experimentell `asyncRewake` | Telegram/Discord-Channels (offiziell), Claude Island (tmux) |
| Ins richtige Terminal springen | – | Fenster über die Prozesskette des Hooks finden (`process.ppid` → `claude` → Shell → Terminal) und fokussieren (eigene Idee, **unsicher** wegen Windows-Fokusregeln) | Coucou, Vibe Island, Open Island (macOS) |

## 6. Empfehlung für Nikki

### Stufe 1 (Muss): Freigaben, Fragen und Pläne über einen synchronen `PermissionRequest`-Hook

**Warum dieser Weg:**
- Offiziell dokumentiert.
- Wird von fast allen Gruppe-B-Tools so gemacht, auch unter Windows (Coucou, Pester).
- Der Terminal-Dialog bleibt parallel gültig, wer zuerst antwortet, gilt.
- Nikkis Bausteine sind schon da: Hook-Server mit Token, Permission-UI mit Erlauben/Immer/Ablehnen, Fragen-Buttons, Plan-Review und `toAnswers`.

**Warum `PermissionRequest` und nicht `PreToolUse` für Fragen und Pläne:** `PreToolUse` läuft *vor* dem Tool. Ein dort wartender Hook hält auch den Frage-Dialog im Terminal zurück (eigene Ableitung aus der Reihenfolge PreToolUse → Tool, **unsicher**). `PermissionRequest` läuft parallel zum Dialog (Abschnitt 3.2). Coucou und Vibe Island beantworten `AskUserQuestion` deshalb über `PermissionRequest` ([reply.rs](https://github.com/Louis-CFM/coucou/blob/main/windows/hook/src/reply.rs), [Vibe Island #105](https://github.com/vibeislandapp/vibe-island/issues/105)). Für `ExitPlanMode` zeigt die offizielle Doku genau dieses Muster ([Hooks-Guide](https://code.claude.com/docs/en/hooks-guide)).

**Skizze** (nur zur Orientierung, kein Code in diesem Auftrag):

1. `lib/hooks.js`: Die async Beobachtungs-Einträge bleiben. **Zusätzlich** ein synchroner Eintrag `PermissionRequest` → `hook.cjs <cfg> --wait` mit eigenem `timeout` (Doku-Standard 600 s; Coucou nimmt 120 s, Notchi 290 s, Vibe Island 86400 s) und `statusMessage` wie „Nikki fragt dich…“.
2. `hook.cjs --wait`: schickt den Event an z. B. `POST /hook/wait` und hält die Verbindung offen (Long-Poll). Antwortet Nikki, gibt der Hook das JSON aus und endet mit Exit 0. Bei App aus, Fehler, Timeout oder „Im Terminal antworten“ gibt er **nichts** aus und endet mit Exit 0, der Terminal-Dialog bleibt (fail-open, wie Coucou, Pester, ClaudeNotch). **Kein** `onFailure: "block"`.
3. Antworten:
   - Erlauben: `{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}`
   - Immer: zusätzlich `updatedPermissions` aus `permission_suggestions`, analog zu den SDK-`suggestions` in `backends/claude.js:30`
   - Ablehnen: `behavior: "deny"` mit `message`
   - Frage: `allow` + `updatedInput: { ...tool_input, answers }`
   - Plan annehmen: `allow`. Plan ablehnen: `deny` + `message` (Begründung)
4. **Veraltete Karten aufräumen:** Weil Claude Code den Hook nach einer Terminal-Antwort nicht beendet ([#15433](https://github.com/anthropics/claude-code/issues/15433)), löst Nikki den wartenden Request selbst auf, sobald für dieselbe `session_id` ein `PostToolUse`, `Stop`, `UserPromptSubmit` oder ein neuer `PermissionRequest` eintrifft. Diese Events kommen schon über die async Hooks.
5. Eigene SDK-Sessions bleiben ausgenommen (`DESKTOPCOMPANION_AGENT`, `hook.cjs:7-16`). Dort entscheidet `canUseTool`. Hooks laufen laut Doku parallel zum Host, „whichever decides first applies“ ([PermissionRequest](https://code.claude.com/docs/en/hooks#permissionrequest)), deshalb muss der Hook dort sofort leer antworten. Das tut er heute schon.
6. Offener Punkt: `claude -p`-Läufe anderer Tools lösen ebenfalls `PermissionRequest` aus und werden ohne Entscheidung abgelehnt ([PermissionRequest](https://code.claude.com/docs/en/hooks#permissionrequest)). Notchi wartet deshalb nur in interaktiven Sessions ([notchi-hook.sh](https://github.com/sk-ruban/notchi/blob/main/notchi/notchi/Resources/notchi-hook.sh)). Wie man das unter Windows sauber erkennt, ist noch zu klären.
7. Optional: `type: "http"`-Hook direkt auf Nikkis Server, ohne Node-Prozess. Dafür müssten Port und Token bei jedem Start in `settings.json` geschrieben werden, oder Nikki nimmt einen festen Port. Der Node-Weg ist näher an der heutigen Lösung und braucht keinen festen Port.

### Stufe 2 (Nice-to-have): Folge-Prompts

In der Reihenfolge von Aufwand und Robustheit:

1. **„Nachricht vormerken“, solange Claude arbeitet:** Ein synchroner `Stop`-Hook fragt Nikki ohne Warten, ob für diese Session eine Nachricht ansteht. Wenn ja, gibt er `hookSpecificOutput.additionalContext` zurück (oder `decision: "block"` + `reason`), und Claude arbeitet damit weiter ([Stop decision control](https://code.claude.com/docs/en/hooks#stop-decision-control)). Wenn nein, kommt sofort eine leere Antwort. Der Hook blockiert also nie. Grenze: Das klappt nur, bevor die Session stoppt, und der Text kommt als Hook-Feedback an, nicht als Nutzer-Nachricht. Für untätige Sessions taugt es nicht.
2. **Nikki-Channel (opt-in):** ein kleiner MCP-Server (Node reicht, Bun ist nicht nötig, [Channels-Referenz: What you need](https://code.claude.com/docs/en/channels-reference#what-you-need)), der mit Nikkis lokalem Server spricht. Er bringt Folge-Prompts in die **laufende, auch untätige** Session und Permission-Relay parallel zum Terminal. Haken:
   - Research Preview, Protokoll kann sich ändern
   - Start nur mit `claude --dangerously-load-development-channels server:nikki` plus Bestätigung
   - Gilt nur für so gestartete Sessions
   - Login über claude.ai oder Console nötig
   - Das Relay kennt kein „Immer“

   Quellen: [Channels-Referenz](https://code.claude.com/docs/en/channels-reference), [Channels: Research preview](https://code.claude.com/docs/en/channels#research-preview). Sinnvoll als Tray-Option „Nikki-Terminal starten“, die so eine Session öffnet.
3. **Nicht empfohlen:**
   - Tastendrücke ins Windows-Terminal: Es gibt keine offizielle API, das wäre fragil (Fokus, Terminal-Typ, Dialog-Layout), und kein untersuchtes Tool macht es unter Windows.
   - `claude -p --resume <id>` parallel zur offenen Terminal-Session (Coucou-Handy-Weg): Das Terminal sähe diese Runde nicht, beide Prozesse schreiben in dieselbe Session (**unsicher**, wie Claude Code das zusammenführt).
   - `asyncRewake` als Prompt-Kanal: Zweckentfremdung, der Text kommt nur als System-Reminder an.

### Was Nikki zusätzlich sofort tun kann (ohne Rückkanal)

- Die Antwort einer Terminal-Session anzeigen: `last_assistant_message` aus `Stop` übernehmen ([Stop input](https://code.claude.com/docs/en/hooks#stop-input)).
- `PermissionRequest`-Details (Tool, Befehl, Datei) in der Session-Pill zeigen statt nur „Nikki will OK!“ (`lib/status.js:84-85`).
- `Notification` `idle_prompt` (etwa 60 s nach Ende) als ruhigeren Hinweis nutzen und `permission_prompt` (nach etwa 6 s) als Eskalation ([Notification](https://code.claude.com/docs/en/hooks#notification)).
