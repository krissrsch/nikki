# Nikki 1.6

Nikki can now answer questions about your earlier Claude Code chats: the new Paw tab asks Pawprint, a local search over all your sessions, and shows the answer with the passages it came from.

## New

- **Paw tab.** Ask something like "Why did we pick SQLite?" and get the answer from your past Claude Code sessions, across all projects, with clickable `[Quelle n]` markers that open the passage. It needs [Pawprint](https://github.com/krissrsch/pawprint) installed. Nikki finds it once Pawprint has indexed at least once; otherwise pick `pawprint.exe` on the tab. Nikki starts Pawprint in the background with the first question and stops it after ten minutes without a question, because its search models take a few GB of memory.

## Changed

- In Settings › Voice the mouse buttons are called M3 (wheel), M4 (back side button) and M5 (forward side button).

## Fixed

- Settings › Modules listed neither Notifications nor Paw, and switching any module removed both from your saved list: notifications that were on went off. All modules are listed now and none gets lost.
- With many modules on, the cat no longer sits on the last tab.
- Long answers in the Paw tab scroll inside the page, so the last sources stay reachable.

---

## Deutsch

Nikki beantwortet jetzt Fragen zu deinen früheren Claude-Code-Chats: Der neue Reiter Paw fragt Pawprint, eine lokale Suche über alle deine Sitzungen, und zeigt die Antwort mit den Stellen, aus denen sie stammt.

### Neu

- **Reiter Paw.** Frag zum Beispiel „Warum haben wir SQLite genommen?“ und bekomm die Antwort aus deinen bisherigen Claude-Code-Sitzungen, über alle Projekte, mit anklickbaren `[Quelle n]`, die die Fundstelle aufklappen. Dafür muss [Pawprint](https://github.com/krissrsch/pawprint) installiert sein. Nikki findet es, sobald Pawprint einmal indexiert hat; sonst wählst du `pawprint.exe` im Reiter aus. Nikki startet Pawprint mit der ersten Frage im Hintergrund und beendet es nach zehn Minuten ohne Frage, weil seine Suchmodelle einige GB Speicher brauchen.

### Geändert

- Unter Einstellungen › Sprache heißen die Maustasten jetzt M3 (Mausrad), M4 (hintere Seitentaste, Zurück) und M5 (vordere Seitentaste, Vor).

### Behoben

- Einstellungen › Module zeigte weder Mitteilungen noch Paw, und jedes Umschalten eines Moduls warf beide aus der gespeicherten Liste: eingeschaltete Mitteilungen gingen aus. Jetzt stehen alle Module in der Liste, und keins geht verloren.
- Sind viele Module an, sitzt die Katze nicht mehr auf dem letzten Reiter.
- Lange Antworten im Reiter Paw scrollen in der Seite, die unteren Quellen bleiben erreichbar.
