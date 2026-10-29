# Startansicht und aufgeklappte Insel: wie andere Notch-Apps den Platz aufteilen

Stand: 2026-10-30. Quellen sind offizielle Websites, Doku, Quellcode, Release-Notes und Store-Seiten. Kein Tool wurde installiert. Bilder- und Video-Links zeigen auf die jeweiligen Anbieter (Screenshots, GIFs, Demos). Was nur aus Sekundärquellen stammt, ist mit **(unsicher)** markiert.

Verwandt: [competitors.md](competitors.md) (Funktionen), [terminal-reply.md](terminal-reply.md) (Agent-Rückkanal).

## 1. Kurzfazit

Es gibt vier Grundmuster für die aufgeklappte Insel:

| Muster | Wie | Beispiele |
| :- | :- | :- |
| **Tabs** | Wenige feste Reiter, Klick wechselt | Boring.Notch (Home \| Shelf), Atoll (Media, Stats, Timers, Clipboard …), Oyenza (Music, Today, Shelf, Tasks, Focus, AI) |
| **Swipe-/Scroll-Seiten mit Punkten** | Mehrere Seiten nebeneinander, wechseln per Mausrad, Pfeiltasten oder Wischen | Nusa (5 Seiten), Windows Dynamic Island (4 Seiten), DynamicWin (Scrollen), Droppy (3 Seiten) |
| **Konfigurierbares Widget-Raster** | Eine Startseite, Nutzer zieht Widgets hinein | NotchNook Pro „Workspaces“, Droppy Home (bis 4 Widgets) |
| **Pills / Sessions** | Jede Quelle (Agent-Session, Musik, Integration) ist eine Pill, die Insel zeigt die gewählte | Coucou, Vibe Island (Session-Liste), Claude Island (Liste → Chat) |

Der **zugeklappte** Zustand ist fast überall eine **Prioritäts-Warteschlange von Live Activities**. Am klarsten steht das im Code von Boring.Notch: Akku/Laden, dann HUD, dann Musik, dann Leerlauf-Gesicht. Wechsel nach Kontext gibt es überall: Wer eine Datei über die Insel zieht, landet im Shelf (Boring.Notch, Droppy). Eine Freigabe-Anfrage öffnet die Insel (Claude Island, Vibe Island).

## 2. Pro Tool

### Klassische Notch-Apps (macOS)

#### Boring.Notch
- Die offene Notch hat eine Kapsel-Tab-Leiste **Home** und **Shelf**. Klick wechselt mit matchedGeometry-Animation ([TabSelectionView.swift](https://github.com/TheBoredTeam/boring.notch/blob/main/boringNotch/components/Tabs/TabSelectionView.swift)).
- **Home = Musik-Player** (Cover 90×90, Steuerung, Slider, optional Lyrics). Kalender und Webcam-Spiegel stehen daneben, beide standardmäßig aus. Offene Größe 640×190 ([NotchHomeView.swift](https://github.com/TheBoredTeam/boring.notch/blob/main/boringNotch/components/Notch/NotchHomeView.swift), [matters.swift](https://github.com/TheBoredTeam/boring.notch/blob/main/boringNotch/sizing/matters.swift))
- **Zugeklappte Priorität:** Akku/Laden, dann HUD-„Sneak Peek“ (Lautstärke/Helligkeit), dann Musik-Live-Activity (Cover + Spektrum), dann optional ein Leerlauf-„Gesicht“ ([ContentView.swift](https://github.com/TheBoredTeam/boring.notch/blob/main/boringNotch/ContentView.swift))
- Hover öffnet (an, mindestens 0,3 s). Gesten an. Datei darüberziehen wechselt zum Shelf. „Customizable layout options“ steht noch auf der Roadmap ([Constants.swift](https://github.com/TheBoredTeam/boring.notch/blob/main/boringNotch/models/Constants.swift), [README](https://github.com/TheBoredTeam/boring.notch))
- Bild/Video: [README-GIF](https://github.com/user-attachments/assets/2d5f69c1-6e7b-4bc2-a6f1-bb9e27cf88a8)

#### NotchNook
- Hover vergrößert die Notch leicht. Klick oder Zwei-Finger-Wisch nach unten öffnet den „Nook“ ([Digital Trends](https://www.digitaltrends.com/?p=3656463))
- Classic: „Nook“ (Medien + Widgets: Media Player, Kalender, Shortcuts, Mirror) und ein eigener **Tray-Tab** für Dateien **(unsicher**, aus Launch-Reviews**)**. Zugeklappt mit Musik: Cover auf der einen Seite der Notch, Waveform auf der anderen ([MacStories](https://www.macstories.net/reviews/notchnook-and-mediamate-two-apps-to-add-a-dynamic-island-to-the-mac/))
- Pro 2.0, **„Workspaces“**: Rechtsklick → „Edit Workspace“, Widgets in den Nook ziehen, verschieben oder herausziehen. Hotkey je Workspace ([Changelog](https://getnotchnook.com/changelog))
- Live Activities rund um die Notch: Musik, Timer, Meetings, Downloads, Akku, **AI Agents**, AirPods. Bei zwei Playern wählt man, welchem der Nook folgt ([Changelog](https://getnotchnook.com/changelog), [FAQ](https://getnotchnook.com/faq))
- Bild/Video: [Nook](https://cdn.macstories.net/notchnook-1-1722870800201.png), [Tray](https://cdn.macstories.net/notchnook-tray-1722870793693.png), [Live Activity](https://cdn.macstories.net/notchnook-live-activity-1722870794152.png), interaktive Demo auf [getnotchnook.com](https://getnotchnook.com/)

#### Droppy
- Drei Seiten: **Home** (Widgets), **Tray** (Dateien), **Widgets** (Raster aller Widget-Symbole). Seitenknöpfe sitzen unter der Notch, ausgeblendet wechselt man per Zwei-Finger-Wisch. Der Tray-Knopf kann nur erscheinen, wenn Dateien warten ([Doku Notch](https://getdroppy.app/docs/notch))
- Home: **bis 4 Widgets**, einzeln oder nebeneinander (Kalender, Notizen, Pomodoro, System, **Agents**, Clipboard …). „Favorites“: bis 4 Widgets, Apps oder Shortcuts neben der Navigation ([Doku Notch](https://getdroppy.app/docs/notch))
- Hover öffnet (Verzögerung pro Display), Ziehen öffnet, Klickaktion einstellbar, Rechtsklick → Einstellungen. Offene Größe und Animationstempo einstellbar ([Doku Notch](https://getdroppy.app/docs/notch))
- Zugeklappt: Live Activities neben der Notch (Musik, Meetings, AirPods, Downloads, **Coding-Agents**), die „step aside when they're done“. Heutiger Kalender neben der Kamera. Im Island-Modus bis zu 2 Glances pro Seite ([getdroppy.app](https://getdroppy.app/))
- Bild/Video: [Island-Bild](https://getdroppy.app/assets/dynamic-island/island-20261018b.webp), [Product-Hunt-Galerie](https://www.producthunt.com/products/droppy-4?launch=droppy-4)

#### Alcove
- Mehrere Live Activities gleichzeitig (seit 1.5). **„Swipe to cycle“** zwischen den Aktivitäten im aufgeklappten Zustand. Opt-Klick wechselt die Aktion einer Aktivität ([Changelog-JSON](https://api.tryalcove.com/changelog))
- Öffnet bei Hover (Verzögerung einstellbar) oder Klick. Erweitertes Now Playing, erweiterter Kalender (1.6), Kalender-Live-Activity (1.4), „Duo mode“ (1.7, Bedeutung **unsicher**), Pill-Form ohne Notch, Kompaktmodus. Tray für 1.8 angekündigt ([Changelog-JSON](https://api.tryalcove.com/changelog))
- Bild/Video: interaktive Demo auf [tryalcove.com](https://tryalcove.com/), [Screenshot](https://macsources.com/wp-content/uploads/2025/01/001-Alcove-MacApp-Jan25.jpg), [Product Hunt](https://ph-files.imgix.net/190d4afa-60a5-4255-b74c-d98a08cbd6f2.png)

#### Atoll (Ebullioscopic)
- Hover nahe der Notch vergrößert, Klick führt zu den Bedienelementen. **Tabs** Media, Stats, Timers, Clipboard „and more“. „Minimalistic Mode“ ist ein kompaktes Layout nach Alcove-Vorbild ([README](https://github.com/Ebullioscopic/Atoll))
- Live Activities: Medien, Fokus, Bildschirmaufnahme, Privatsphäre, Downloads, Akku. Wischen auf der Musik-Fläche springt Titel oder ±10 s. Layout, Animationen, Hover und Shortcuts einstellbar ([README](https://github.com/Ebullioscopic/Atoll))
- Bild/Video: [Screenshot 1](https://i.postimg.cc/HkLGn6yH/846F86A4_A2F9_4CD6_BC84_1D720D377728_1_201_a.jpg), [Screenshot 2](https://i.postimg.cc/t49mW5yN/Screenshot-2026-03-02-at-6-00-22-PM.png)

#### DynamicLake Pro
- Modulare „Lakes“: DynaMusic (mit „Sneak Peek“), DynaGlance (Kalender + Wetter), Anrufe, Benachrichtigungen, DynaDrop, DynaClip, Timer, DynaConnect. „minLake“ als Mini-Format ([dynamiclake.com](https://dynamiclake.com/), [DynaMusic](https://dynamiclake.com/dynamusic))
- Hover oder Klick, Einstellungen pro Lake. Tabs, Seiten und Prioritätsregeln n. a. ([Review](https://thesweetbits.com/tools/dynamiclake-review/))
- Bild/Video: [DynaClip](https://dynamiclake.com/dynaclip), [DynaDrop](https://dynamiclake.com/dynadrop)

#### MediaMate
- Kein Widget-Hub: ersetzt die HUDs und zeigt Now Playing „tucked away in the notch“. Im Notch-Stil verbreitert sich die Notch für den Slider. Regeln legen fest, was aufklappt (Titelwechsel, Play/Pause, Lautstärke) ([MediaMate](https://wouter01.github.io/MediaMate/), [MacStories](https://www.macstories.net/reviews/notchnook-and-mediamate-two-apps-to-add-a-dynamic-island-to-the-mac/))
- Bild/Video: [Screenshot](https://cdn.macstories.net/mediamate-1722870801070.png), [GIF](https://cdn.macstories.net/cleanshot-2024-08-05-17-27-1722871717636.gif)

#### NotchDrop, TopNotch
- NotchDrop: aufgeklappt nur Drop-Zone plus AirDrop-Fläche ([GitHub](https://github.com/Lakr233/NotchDrop), [Screenshot](https://github.com/Lakr233/NotchDrop/raw/main/Resources/%E6%88%AA%E5%B1%8F2024-07-08%2003.14.34.png))
- TopNotch: keine aufgeklappte Ansicht, versteckt nur die Notch ([topnotch.app](https://topnotch.app/))

### Windows

#### Nusa
- **Hover öffnet, Wegfahren schließt.** „Nothing to arrange, nothing to pin“, also keine Widget-Anpassung. **Fünf Seiten nebeneinander:** Musik, Fokus-Timer, Wasser, Shelf, To-do, mit Seitenpunkten unten ([Website](https://rama2555.github.io/nusa/))
- Navigation: Hover über die Punkte zeigt eine Symbolleiste zum Springen. Mausrad und ←/→ wechseln Seiten. Zahnrad am Ende der Leiste ([Releases](https://github.com/rama2555/nusa/releases))
- Kontext: Im Leerlauf blendet die Uhr aus und **Maskottchen-Augen** erscheinen (dösen, winken). Kurze „Peeks“ für Ladegerät, WLAN-Verlust und Kopfhörer. Overlays für Lautstärke/Helligkeit, Caps Lock und Tastatursprache. Der Lyrics-Modus teilt die Notch in zwei Hälften. „Minimal notch“ ist eine dünne Linie ([Website](https://rama2555.github.io/nusa/))
- Größen aus dem Website-Mockup (nicht unbedingt die App): zu 150×30, Seiten 420×140, Lyrics 520×140, Peek 310×60. Feder-Easing `cubic-bezier(0.34,1.32,0.5,1)` über 0,62 s ([Website](https://rama2555.github.io/nusa/))
- Bild/Video: [Microsoft Store](https://apps.microsoft.com/detail/9NQMSXF0N0WM), Mockup auf der [Website](https://rama2555.github.io/nusa/), [TikTok-Videos](https://www.tiktok.com/discover/nusa-notch-windows)

#### Oyenza Studio / Oyen Poni
- Zugeklappte Live Activities: Cover + Equalizer, Timer-Countdown, Popups für Lautstärke, Laden und Bluetooth-Akku. Hover oder Klick öffnet. **Scrollen über dem Kopf wechselt Seiten.** **Tabs: Music, Today, Shelf, Tasks, Focus, AI, Oyenza**, die ersten fünf abschaltbar. Themes Classic, Oyen, Glass, Pill ([GitHub](https://github.com/lucacadalora/poni))
- Bild/Video: Seitenübersicht im Repo unter `docs/brand/readme/pages.webp` ([GitHub](https://github.com/lucacadalora/poni))

#### DynamicWin
- Ansichten Medien, Kalender (Google), Datei-Tray, Bluetooth, **gewechselt per Scrollen**. Ein „activity system“ fügt „spring notches“ hinzu, die eine Aktion außerhalb der aktuellen Ansicht zeigen oder öffnen ([README](https://github.com/FlorianButz/DynamicWin))
- Bild/Video: [preview.gif](https://github.com/FlorianButz/DynamicWin/blob/V2/ReadmeFiles/preview.gif)

#### Windows Dynamic Island (shaxboz-rakhmonov)
- **Vier Seiten:** All-in-one, Musik, Kalender, System. Wechsel per Mausrad, Ziehen links/rechts oder Punkte. Hover öffnet, Klick daneben schließt. In den Einstellungen wählt man Inhalte und Seiten, mit den Presets „Everything“, „Music only“ und „Clock only“ ([GitHub](https://github.com/shaxboz-rakhmonov/windows-dynamic-island))
- Bild/Video: [pages.png](https://github.com/shaxboz-rakhmonov/windows-dynamic-island/blob/main/docs/pages.png)

#### FluentFlyout, ModernFlyouts
- Keine Insel, sondern Flyouts bei Medien- oder Lautstärke-Eingabe (Medien mit Cover und Seek, Lautstärke mit Mixer, „Up Next“, Lock Keys), jedes abschaltbar ([fluentflyout.com](https://fluentflyout.com/), [GitHub](https://github.com/unchihugo/FluentFlyout)). Bild/Video: [1](https://github.com/user-attachments/assets/a7c7e2db-e21b-4435-9acc-0b2c5f38eb7d), [2](https://github.com/user-attachments/assets/bfc7666f-1d59-4cbf-8d15-3855671cb147)
- ModernFlyouts: Flyouts für Lautstärke+Medien, Helligkeit, Flugmodus und Lock Keys. Platzierung, Stapelrichtung und TopBar einstellbar ([GitHub](https://github.com/ModernFlyouts-Community/ModernFlyouts#screenshots--))

### Agent-Companions

#### Coucou
- Maskottchen Mochi wohnt in der Notch, im Leerlauf unsichtbar, schaut bei Hover heraus ([README](https://github.com/Louis-CFM/coucou))
- **Inhalt in Pills:** pro Agent/Session, Spotify/Apple Music, Integrationen. Man wählt ein Haupt-Tool plus bis zu 4 Pills (Settings → Active pills), Shortcuts wechseln. Kopfzeile mit Plan-Usage-Pill ([README](https://github.com/Louis-CFM/coucou))
- Agent-Ansicht: Ticker der Datei-Edits mit +N −M (Tippen zeigt den Diff), Freigaben inline (Allow/Deny/Always), bis zu 4 Fragen als Auswahl, Chat-Box unter dem Modellnamen. Datei auf die Notch: Mochi wird zur Kiste ([README](https://github.com/Louis-CFM/coucou))
- Bild/Video: [demo.gif](https://github.com/Louis-CFM/coucou/blob/main/docs/media/demo.gif)

#### Vibe Island
- Zugeklappt (Website-Mockup): Titel der aktiven Aufgabe, Session-Anzahl, Plan-Kontingent „5h 11% · 7d 2%“ ([vibeisland.app](https://vibeisland.app/))
- Aufgeklappt: **Session-Liste** (Titel, Agent, Terminal, Laufzeit). Freigaben als Karten mit Diff und ⌘N/⌘Y. Fragen mit ⌘1–⌘3. Plan-Review als Markdown. Klick springt zum Terminal-Tab ([vibeisland.app](https://vibeisland.app/), [GitHub](https://github.com/vibeislandapp/vibe-island))
- Bild/Video: [YouTube-Demo](https://www.youtube.com/watch?v=_nh_OE5aSwI)

#### Claude Island / Vibe Notch
- Zustände closed, opened und „popping“. Öffnet bei Klick, Hover, Benachrichtigung oder Start. Drei Inhalte: **Instanzen-Liste** (bis 40 % Breite, max. 480×320), Menü (480×540), **Chat pro Session** (bis 50 % Breite, max. 600×580) ([NotchViewModel.swift](https://github.com/farouqaldori/vibe-notch/blob/main/ClaudeIsland/Core/NotchViewModel.swift))
- Bei Freigaben klappt die Notch mit Approve/Deny auf ([README](https://github.com/farouqaldori/vibe-notch))
- Bild/Video: keine im README, nur das [Repo](https://github.com/farouqaldori/vibe-notch)

#### Notchi
- Zugeklappt: **ein animiertes Sprite pro Session auf einer „Grasinsel“**, reagiert auf Denken, Arbeiten, Freigabe, Kompaktierung, Fehler, Fertig und Schlaf ([README](https://github.com/sk-ruban/notchi))
- Klick: Live-Feed, Session-Infos, Usage. Klick auf die Usage-Leiste öffnet ein Dashboard mit Kostenkurve ([README](https://github.com/sk-ruban/notchi))
- Bild/Video: [Video](https://github.com/user-attachments/assets/e417bd40-cae8-47c0-998a-905166cf3513), [Usage-Dashboard](https://github.com/sk-ruban/notchi/blob/main/assets/usage-dashboard.png)

## 3. Wie sich Musik, Kalender, Shelf und Agent-Status den Platz teilen

| Situation | Was andere tun | Beleg |
| :- | :- | :- |
| Mehrere Dinge gleichzeitig aktiv, Insel zu | Feste Priorität (Boring.Notch). Bis zu 2 Glances pro Seite (Droppy). Durchwischen (Alcove) | [ContentView.swift](https://github.com/TheBoredTeam/boring.notch/blob/main/boringNotch/ContentView.swift), [Droppy](https://getdroppy.app/), [Alcove-Changelog](https://api.tryalcove.com/changelog) |
| Ereignis kommt herein (Laden, Kopfhörer, Lautstärke) | Kurzer „Peek“ oder „Sneak Peek“, danach zurück | Nusa, Boring.Notch, DynamicLake |
| Datei wird über die Insel gezogen | Insel öffnet direkt auf dem Shelf | Boring.Notch, Droppy „Open tray after drop“ |
| Agent braucht Freigabe | Insel öffnet bzw. „poppt“ mit Karte | Claude Island, Vibe Island |
| Leerlauf | Maskottchen oder Gesicht statt Inhalt | Nusa (Augen), Boring.Notch (Gesicht optional), Coucou (Mochi lugt raus), Notchi (Sprites schlafen) |
| Aufgeklappt, Startseite | Musik als Home (Boring.Notch). Widget-Raster (Droppy, NotchNook Pro). Seitenreihe (Nusa). Session-Liste (Vibe Island, Claude Island) | siehe Abschnitt 2 |
| Konfigurierbarkeit | Seiten an/aus (Oyenza, Windows Dynamic Island), Widgets ziehen (NotchNook Pro), nichts (Nusa: „Nothing to arrange“) | siehe Abschnitt 2 |

## 4. Folgerungen für Nikki

**Nikki heute** (`renderer/index.html`):
- Leiste `#bar` mit Agent-Tabs (`#nav`), Status-Pill (`#pill`), Session-Pills (`#sessionPills`), Branch und Aktionen
- Zwei Ansichten: **Home** (`#viewHome`: Maskottchen, Projekt, Branch-Karte, Agent-Raster) und **Chat** (`#viewChat`: Schrittzeile, Ausgabe, Freigabe-Karte, Composer)

Vorschlag, abgeleitet aus den Mustern oben (Bewertung, kein Beleg):

1. **Zugeklappt eine Prioritäts-Warteschlange** wie bei Boring.Notch, nur agent-zentriert:
   1. Freigabe/Frage („braucht dich“)
   2. Kurzer Peek (Lautstärke, Laden, Datei-Drop)
   3. Laufender Agent
   4. Nächster Termin in weniger als 15 min
   5. Musik (Cover + Mini-Visualizer, Nikki wippt)
   6. Leerlauf: Nikki schläft

   Höchstens ein Glance pro Seite der Insel, wie bei Droppy.
2. **Aufgeklappt Home als „Heute“-Seite mit festen Kacheln**, nicht frei konfigurierbar wie bei Nusa (ruhig, nichts zu ordnen):
   - Agent-Status und Projekt (wie heute)
   - Musik-Kachel
   - Nächster Termin
   - Mini-To-do
   - Shelf-Zähler

   Ein Klick auf eine Kachel öffnet deren Seite.
3. **Seitenwechsel per Mausrad, ←/→ und Seitenpunkte** (Nusa, Windows Dynamic Island, DynamicWin). Mögliche Reihe: Home | Chat | Musik | Kalender | Shelf | Notizen/To-do. Seiten abschaltbar (Oyenza). Chat bleibt die Agent-Seite.
4. **Kontext springt automatisch:** Datei über die Insel ziehen öffnet das Shelf. Freigabe öffnet Chat mit der Karte. Kopfhörer oder Laden zeigt nur einen Peek.
5. **Agent-Inhalte als Pills** bleiben in der Leiste (wie heute, Coucou-ähnlich). Musik kann dort als eigene Pill erscheinen (Coucou „music pills“), statt eine Seite zu erzwingen.
