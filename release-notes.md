# Nikki 1.1

Nikki wird zur Notch-App mit Claude-Code-Begleiter: neues Gesicht, Module und ein Rückkanal zu deinen Terminal-Sessions.

## Neu

- **Neue Notch.** Zugeklappt sitzen in der Mitte Nikkis Augen, an den Seiten die Schnurrhaare. Nikki schaut zu, während Claude arbeitet, und hüpft, wenn sie dich braucht. Ist eine Aufgabe fertig, macht sie ^ ^. Läuft Musik, tanzt sie, und wenn nichts los ist, schläft sie ein. Bei Aktivität wird die Notch breiter und zeigt links und rechts das Wichtigste.
- **Neue Insel.** Oben sitzen Tabs für Home („Heute“ mit Kacheln), Chat und die Module, rechts das Zahnrad. Am Chat-Icon zeigt ein Punkt den Stand: gelb heißt Nikki braucht dich, grün heißt fertig, rot heißt Fehler. Die Höhe ändert sich mit einer weichen Animation.
- **Module**, einzeln in den Einstellungen schaltbar:
  - **Kalender:** lokale Termine, mit Hinweis 15 Minuten vorher.
  - **To-do:** global und pro Projekt, mit „An Chat“.
  - **Notizen:** ein Abreißblock zum Blättern. Blätter reißt du heraus.
  - **Timer:** Pomodoro, der Countdown läuft in der Notch mit.
- **Antworten aus der Insel an Terminal-Sessions.** Freigaben, Fragen und Pläne von Claude Code im Terminal beantwortest du direkt in Nikki. Antwortest du nicht, entscheidet wie gewohnt das Terminal. Solange Claude arbeitet, kannst du ihm eine Nachricht vormerken.
- **Einstellungen in der Insel.** Dort findest du Autostart, einen frei belegbaren Hotkey, Töne, die Zeit bis zum Einschlafen, Terminal-Sessions, Module und die Branch-Anzeige. Der Tray ist dafür schlank geworden.

## Verbessert und behoben

- Code, Links und Dateinamen in Antworten werden nicht mehr verfälscht.
- Chats bleiben in ihrem Projekt. Stop funktioniert zuverlässig und ohne internen Diagnose-Text, und direkt nach „fertig“ kannst du wieder senden.
- Enter im leeren Feld bricht keine Aufgabe mehr ab.
- Chats und `~/.claude/settings.json` werden absturzsicher geschrieben. Vom Zustand vor Nikki bleibt einmalig ein Backup.
- Beim Deinstallieren entfernt Nikki ihre Hooks. Hast du sie von Hand entfernt, trägt Nikki sie nicht wieder ein.
- Startet Nikki über einem Spiel oder Video im Vollbild, nimmt sie ihm den Fokus nicht weg.
- Der Updater findet die echte Installation.

## Entfernt

- Die Backends Cursor, Gemini und AI Studio, die Agenten-Auswahl und die Git-Pill. Nikki konzentriert sich auf Claude Code. Die Branch-Anzeige steht jetzt klein im Chat.

## Installieren

**Nikki-Setup.exe** laden und installieren. Claude Code muss lokal installiert und eingeloggt sein. Für Terminal-Sessions brauchst du außerdem Node.js.
