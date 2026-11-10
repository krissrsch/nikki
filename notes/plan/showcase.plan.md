Gegrillt: ja

# Nikki fürs Portfolio (2026-11-10)

Ziel: Nikki als öffentliches Vorzeige-Repo. Erst das Repo sauber, dann drei Features, die man im Demo-Video sieht.

## Entscheidungen

1. Reihenfolge: Repo-Hygiene, Albumfarben, Songtexte, Benachrichtigungen. Schnell-Aktionen später, eigene Runde.
2. Repo: MIT-Lizenz, GitHub Action mit `npm test` bei jedem Push, Beschreibung und Topics. README auf Englisch mit deutschem Abschnitt, Feature-Tabelle, Architekturskizze, Screenshots.
3. Screenshots mit Demodaten in einem isolierten Datenordner (wie `npm run e2e`). Das Demo-GIF nimmt der Nutzer selbst auf.
4. Albumfarben: Die Lichtkante und das Spektrum nehmen bei Musik die Farbe des Covers. Ohne Cover bleibt das bisherige Blau. Die Musik-Kachel bekommt einen leichten Verlauf hinter dem Cover. Sonst bleibt die UI unverändert.
5. Songtexte von LRCLIB (ohne Konto), nur wenn eingeschaltet (Standard: aus), mit Hinweis, dass Titel und Interpret an lrclib.net gehen. Die aktuelle Zeile steht unter dem Titel, synchron zur Position. Texte werden zwischengespeichert.
6. Benachrichtigungen: `UserNotificationListener` im Helper. Test am 10.11.: ungepackt geht es ("Allowed", Benachrichtigungen lesbar). Abfrage per Polling, weil das Ereignis Paketidentität braucht. Nur wenn eingeschaltet (Standard: aus), der Inhalt bleibt lokal.
7. Commits kurz und menschlich, direkt auf `main`, ohne Co-Authored-By-Zeilen. Release 1.4.0 nur auf Zeichen des Nutzers.

## Schritte

- [x] LICENSE, CI, Repo-Beschreibung und Topics
- [x] Albumfarben: `lib/cover-color.js` (rein, getestet), Farbe in `mediaNow`, CSS-Variable an `#glow` und Musik-Kachel
- [x] Songtexte: `lib/lyrics.js` (LRC parsen, Zeile zur Position, URL), Abruf und Cache in main, Zeile in Musik-Seite und Kachel, Schalter in den Einstellungen
- [x] Benachrichtigungen: Helper pollt, main reicht neue weiter, Anzeige in der Insel, Schalter in den Einstellungen
- [x] README neu, Screenshots mit Demodaten
