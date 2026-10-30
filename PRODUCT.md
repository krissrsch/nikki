# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primarily the author: a developer on Windows 11 who runs Claude Code tasks all day and wants a glanceable companion at the top-center of the screen instead of a terminal window. Possibly shared with friends, who then sign in with their own Claude Code / Cursor login.

## Product Purpose

A notch-style companion (Electron overlay) that starts and watches agent tasks in a project folder through the locally logged-in Claude Code CLI or Cursor CLI (ACP), with no API key. Success: start a task in seconds, see at a glance what it is doing, approve tool requests without switching windows, read the answer.

## Positioning

Unlike Coucou (which monitors many agents as notch pills and often needs an API key for chat), this companion *starts* real Claude Code tasks on the user's subscription from the notch. Agent choice uses Coucou-like **pills in the island bar** (Claude | Cursor), always visible when collapsed. Optional read-only monitoring of terminal/IDE sessions appears as secondary session pills (observe only — no approvals for those).

## Operating Context

- Sits at the top-center of the primary display, always visible over normal windows, hidden while a fullscreen app (games, video) runs.
- Opened by clicking the island, the tray icon, or the global hotkey (Ctrl+Alt+Space, fallback Ctrl+Alt+K).
- Shows the git branch of the selected project; Home **Git** pill glances dirty/ahead/behind (optional open PR count via local `gh`) and opens the remote in the browser — no GitHub OAuth.
- Home **AI Studio** pill offers **Chat** (Gemini CLI via Google login / optional user `GEMINI_API_KEY`) or **Browser** (aistudio.google.com; composer text copied to clipboard).
- Updated locally via Updater.exe; installed via the NSIS setup in dist/.

## Capabilities and Constraints

- Project folder picker with recent folders; prompt input (Enter sends); new session vs. resume last session per project and backend; stop.
- Live status and a step list derived from tool calls; final answer text. Collapsed status prefixes the active agent when idle.
- Observed hook sessions: up to two session pills in the chat; tap focuses that session’s status.
- Permission requests: Erlauben / Immer / Ablehnen. Agent questions as option buttons; plan mode ("erst planen") with plan review (Annehmen / Ablehnen with reason).
- Model per project (Standard / Opus / Sonnet / Haiku).
- Soft synthesized sounds for "fertig" / "braucht dich" and for Nikki (settings: Töne), Windows toast while the island is hidden; autostart (packaged app only).
- Optional (settings: Claude): terminal sessions of Claude Code through hooks in `~/.claude/settings.json`, with permissions answered in the island.
- The island opens on the display under the cursor.
- Claude: uses installed `claude.exe`; Agent SDK version must match the CLI.
- UI language: German.

## Brand Commitments

- Own mascot **Nikki**: a white cat with black spots, 19 expressions. She lives in the open island, reacts to Claude and music, jumps along with the tabs and can be dragged to any place.
- The user likes Coucou's look and motion (soft, minimal mascot; clean black notch UI) as a style reference, not a template.

## Product Principles

1. Glanceable first: the collapsed island answers "what is it doing?" without opening.
2. Never steal focus or block the screen; appear when needed, recede otherwise.
3. The mascot carries the emotion; the UI stays quiet.
4. Real Claude Code behavior, no invented capabilities; no separate API keys.
