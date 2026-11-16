# Nikki 1.7

A security release: approvals in the island now show everything you approve, and tasks started in Nikki ask again before they change files.

## Changed

- **Confirm file changes.** Tasks you start in Nikki now ask before every change to a file, like any other tool call. Before, file edits in the project folder were allowed without asking, so a prompt injection hidden in a project (a README, an issue, a web page) could rewrite build scripts unasked. If you prefer the old behaviour, switch off Settings › Claude › **Confirm file changes**.
- **"Always" shows what it allows.** The card now lists the rules "Always" would add from then on, for example `Bash(npm test:*)`. Without such rules there is no "Always" button.

## Fixed

- **Long terminal commands were cut on the approval card.** A command from a terminal session showed only its first 200 characters, without a hint that it was cut. A command could start harmlessly and hide something else after the cut. The card now shows the whole command (up to 8,000 characters, the box scrolls). Longer commands are not sent to Nikki at all, so the terminal asks with the full text.

---

## Deutsch

Ein Sicherheits-Update: Freigaben in der Insel zeigen jetzt alles, was du erlaubst, und Aufgaben aus Nikki fragen wieder, bevor sie Dateien ändern.

### Geändert

- **Dateiänderungen bestätigen.** Aufgaben, die du in Nikki startest, fragen jetzt vor jeder Änderung an einer Datei, wie bei jedem anderen Werkzeug. Bisher waren Änderungen im Projektordner ohne Nachfrage erlaubt; eine in einem Projekt versteckte Prompt Injection (README, Issue, Webseite) hätte so Build-Skripte unbemerkt umschreiben können. Wer das alte Verhalten möchte, schaltet Einstellungen › Claude › **Dateiänderungen bestätigen** aus.
- **„Immer“ zeigt, was es erlaubt.** Die Karte listet die Regeln, die „Immer“ ab dann zulassen würde, zum Beispiel `Bash(npm test:*)`. Ohne solche Regeln gibt es keinen „Immer“-Knopf.

### Behoben

- **Lange Terminal-Befehle wurden auf der Freigabe-Karte abgeschnitten.** Ein Befehl aus einer Terminal-Session zeigte nur seine ersten 200 Zeichen, ohne Hinweis auf die Kürzung. Ein Befehl konnte harmlos beginnen und nach der Kürzung etwas anderes enthalten. Die Karte zeigt jetzt den ganzen Befehl (bis 8.000 Zeichen, das Feld scrollt). Längere Befehle schickt Nikki gar nicht erst in die Insel, dann fragt das Terminal mit dem vollen Text.
