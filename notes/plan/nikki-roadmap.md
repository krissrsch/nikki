# Nikki: was noch dazukommen könnte (Stand 2026-10-30)

Reihenfolge nach meiner Empfehlung. Aufwand: S = bis ein paar Stunden, M = etwa ein Tag, L = mehrere Tage.

## 1. Sauber abschließen und veröffentlichen (Version 1.2)

Alles Neue seit 1.1.0 ist nur lokal: Katze, Sprung, Glas-Dashboard mit Lichtkante, Einstellungsfenster, Intro.

| Was | Warum | Aufwand |
|---|---|---|
| App-Icon Variante A und einfarbiges Tray-Symbol einbauen | im Canvas entschieden, in der App noch das alte Icon | S |
| Offene Tests: Zwischenablage-E2E, Gerätewechsel beim Spektrum, Installer einmal echt | waren bisher nicht möglich oder fehlen | S |
| Katze bei vollen Seiten prüfen (viele Termine, volle Ablage, langer Musiktitel) | sie kann dort Inhalt überdecken | S |
| Mehrere Bildschirme prüfen | das Fenster ist jetzt so breit wie die Anzeige | S |
| README und PRODUCT.md aktualisieren (Katze ist weiß-getigert, Einstellungsfenster) | stimmt nicht mehr | S |
| Release 1.2 | nur mit deiner Freigabe | S |

## 2. Töne

| Was | Warum | Aufwand |
|---|---|---|
| Sounds-Ordner: eigene Dateien je Ereignis, Knopf „Ordner öffnen“ | wie bei Coucou, du bestimmst den Klang selbst | M |
| Frei nutzbare echte Aufnahmen (CC0) als Standard | klingt natürlicher als alles Erzeugte | M |
| Ruhezeiten, und still, solange das Terminal im Vordergrund ist | man hört nichts, was man gerade selbst sieht | S |

Coucous eigene Sounds fallen aus, sie stehen unter Urheberrecht von Louis Raillé.

## 3. Claude-Begleiter: der eigentliche Nutzen

| Was | Warum | Aufwand |
|---|---|---|
| Usage-Ring: 5-Stunden- und Wochenlimit im Dashboard, Warnung nahe am Limit | stand schon in Phase 3, haben viele Konkurrenten | M |
| Session-Diff: welche Dateien Claude geändert hat, direkt in der Insel | schneller Überblick, bevor man freigibt | L |
| Sprung ins Terminal: Klick auf die Session holt das richtige Fenster nach vorn | spart Suchen bei mehreren Sessions | M |
| Fragen-Karten für Rückfragen von Terminal-Sessions in der Insel prüfen und ausbauen | antworten ohne Fensterwechsel | M |
| Plan-Modus: Plan in der Insel lesen und annehmen, Auto-Freigabe je Session | weniger Klicks bei langen Läufen | M |
| Mehrere Projekte: Sessions gruppiert, Ordner auf die Notch ziehen startet Claude dort | natürlicher Einstieg | M |
| „Frag Claude zu dieser Datei“ an der Ablage und in der Kiste | stand auf der Liste, verbindet Katze und Claude | S |

## 4. Einstellungen und Bedienung

| Was | Warum | Aufwand |
|---|---|---|
| Öffnen beim Drüberfahren (mit Verzögerung einstellbar) | Notch-Tools fühlen sich so an | S |
| Frei belegbare Kürzel: Freigabe anspringen, Tabs vor/zurück, stumm, Strg+1–9, Strg+K, Strg+Enter | Bedienung ohne Maus | M |
| Tray: Pause, Update-Status, schnelle Schalter | wie bei Coucou | S |
| Tastatur-Tabwechsel ohne Sprung der Katze | bei Tastatur stört jede Wartezeit | S |
| Seite „Über“: Version, Update, Daten-Ordner | fehlt noch im Einstellungsfenster | S |
| Erster Start: kurze Einführung (Projekt wählen, Hooks erklären, Kürzel) | Neue wissen sonst nicht, was geht | M |

## 5. Katze und Charakter

| Was | Warum | Aufwand |
|---|---|---|
| Augen folgen der Maus | kleiner Effekt, macht sie deutlich lebendiger | S |
| Kleine Katze lugt beim Drüberfahren aus der geschlossenen Notch | stand auf der Liste | M |
| Mehr Reaktionen: Tageszeit (nachts müde), lange Claude-Läufe, Timer fertig | „als ob sie lebt“ | S |
| Kleiderschrank: Mützen, saisonale Outfits, frei schaltbar | Bindung, macht Spaß | M |
| Desktop-Haustier: läuft auf Wunsch über die Taskleiste | Überraschung, optional | L |
| Wochenrückblick: was Claude und du geschafft habt, mit Nikki | Grund, wiederzukommen | M |

## 6. Module

| Was | Warum | Aufwand |
|---|---|---|
| Sprache: Push-to-Talk, später lokal „Hey Nikki“ | in Phase 3 geplant, noch nicht gebaut | L |
| Discord: wer im eigenen Sprachkanal ist, als eigener Bereich, über lokales RPC (eigene App im Developer Portal, ohne Discord-Freigabe bis 50 Tester). Webhooks später mit der Spracheingabe | gebaut am 2026-10-30, Plan in `discord.plan.md`, mit echter App noch nicht geprüft | M |
| Liedtexte im Musik-Reiter | geplant, Quelle und Lizenz müssen geklärt werden | M |
| Kalender mit Google oder Outlook verbinden | heute nur lokal, viele haben ihre Termine dort | L |
| Heute anpassbar: Kacheln wählen und sortieren | jeder nutzt anderes | M |

## Meine Empfehlung

1. Block 1, damit das Neue wirklich bei dir und anderen ankommt.
2. Usage-Ring und Sprung ins Terminal: höchster Alltagsnutzen.
3. Sounds-Ordner: löst die Klangfrage endgültig.
4. Augen folgen der Maus und Öffnen beim Drüberfahren: wenig Aufwand, viel Wirkung.
