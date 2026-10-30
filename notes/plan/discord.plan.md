Gegrillt: ja

# Discord in Nikki (2026-10-30)

Ziel: Nikki zeigt, wer mit dem Nutzer im aktuellen Sprachkanal ist. Webhooks kommen später mit der Spracheingabe.

## Entscheidungen

- Eigene App des Nutzers im Developer Portal. Client-ID und Secret stehen in den Einstellungen, Secret und Tokens sind mit safeStorage verschlüsselt und gehen nie an einen Renderer.
- Nur der eigene Sprachkanal über lokales RPC, kein Bot. Ein Bot nur, falls die Server-Übersicht gewünscht wird.
- Modul „Discord“ mit Reiter, ab Werk aus, dazu eine Kachel auf Heute. Die zugeklappte Notch ändert sich nicht.
- Pro Person: Avatar, Name, Ring beim Sprechen, stumm oder taub. Darüber Kanal und Server.
- Hinweis bei Beitritt ist ein Schalter, ab Werk aus.
- Ohne Discord verbindet Nikki sich im Hintergrund neu (5 s bis 60 s) und zeigt den Zustand im Reiter. Der Dialog in Discord kommt nur nach einem Klick, nie von selbst.

## Umsetzung

- `lib/discord.js`: Rahmen, Liste, Client (reine Logik, testbar gegen ein nachgestelltes Discord).
- `main.js`: Pipe, Tokens, Avatare als data-URL, Einstellungen.
- `renderer/modules/discord.js`: Reiter und Kachel. Einstellungsseite „Discord“.

## Offenes Risiko

Die Doku nennt die Scopes `rpc` und `rpc.voice.read` „nur für freigegebene Partner“. Dass der Besitzer einer App sie nutzen darf, gilt als üblich, ist aber erst mit einer echten App geprüft, wenn der Nutzer sie anlegt. Die Redirect-URL `http://127.0.0.1` muss in der App eingetragen sein.
