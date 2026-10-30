# Phase 1: UI-Spezifikation (aus dem abgestimmten Canvas)

Quelle: Canvas https://claude.ai/artifact/94pCQafBMY4VtjbwaHKkom. Der Nutzer hat ihn am 2026-10-30 abgenommen, nach mehreren Runden. Maße in CSS-px. Farben aus `renderer/style.css` (`--black` #000, `--card` #141417, `--raised` #1f1f24, `--raised-hover` #2a2a31, `--text` #f4f4f2, `--muted` #a3a3ad, `--accent` #a9e7bd, `--bean-ink` #17271d, `--warn` #ffc861, `--bad` #ff8a8a). Schrift: Segoe UI Variable Text.

## Zugeklappte Notch

- **Form:** Höhe 36, Unterkante rund (`border-radius: 0 0 18px 18px`), Hintergrund #000.
- **Breite:** Im Leerlauf etwa 110. Mit Live-Info etwa 260, Innenabstand 0 28px, damit nichts auf den Schnurrhaaren liegt.
- **Aufbau mit Live-Info:** links die Info (flex 1, 11px), Mitte Augen (44×36), rechts die Info (flex 1, rechtsbündig).
- **Mitte nur Augen**, keine Nase, kein Mund.

### Augen (SVG 44×36, Augen bei x=15 und x=29)

| Stimmung | Form | Animation |
|---|---|---|
| `awake` | Pille 6×9, rx 3, #f4f4f2, Glow `drop-shadow(0 0 3px rgba(169,231,189,.6))` | Blinzeln: scaleY(.1) bei 95 % von 4,8 s |
| `work` | wie awake | schaut ±2,2px hin und her, 3,2 s |
| `need` | Kreis r 4,2, #f4f4f2, warmer Glow `rgba(255,200,97,.75)`, kleiner dunkler Glanzpunkt (opacity .35). **Keine** gelben Augen mit schwarzer Pupille, das wirkte gruselig | hüpft -1,6px, 0,8 s |
| `done` | ^ ^: Pfade `M11 19 Q15 13 19 19`, `M25 19 Q29 13 33 19`, Strich 2, round | Hüpfer alle 1,8 s |
| `music` | ^ ^ wie done | jedes Auge tanzt einzeln: rotate ±10° + translateY, 0,46 s alternate, rechtes Auge 0,23 s versetzt |
| `sleep` | ︶ ︶: `M11 17 Q15 20.5 19 17`, Strich #c9c9cf 1,8 | zwei „z“ steigen rechts auf (+5px, -9px, Fade), 2,6 s, versetzt |

Nikki schläft nach N Minuten ohne Aktivität (Settings, Standard 5). Fährt die Maus über die Notch, wacht sie auf (`awake`).

### Schnurrhaare
- Je drei pro Seite, fein gebogen (Quad-Kurven), Strich 1px, Farbverlauf #f4f4f2 von Deckkraft .9 an der Wurzel bis .2 an der Spitze.
- Die Wurzel liegt etwa 18px innerhalb der Notch, die Spitze ragt etwa 15px über den Rand hinaus.
- **Links:** SVG 34×20 bei `left:-16px; top:8px`, Pfade `M34 8 Q19 6.5 1 2`, `M34 10 Q19 10 1 10`, `M34 12 Q19 13.5 1 18`.
- **Rechts:** gespiegelt bei `right:-16px`.
- **Stimmungen:** Bei `need` zucken sie (rotate ±5° um die Wurzel, 0,5 s alternate). Bei `music` wippen sie (0,46 s). Bei `sleep` hängen sie tiefer (Spitzen +2px).

### Rangfolge (`lib/glance.js`)
1. Freigabe oder Frage nötig: links „npm test?“ in warn mit Punkt, rechts das Projekt, Augen `need`.
2. Kurzer Hinweis für 2 s (Lautstärke mit Balken, Datei abgelegt): Augen `awake`.
3. Agent arbeitet (Spinner und „arbeitet“ in accent) bzw. fertig (Haken und „fertig“): Augen `work` bzw. `done`.
4. Termin in weniger als 15 min: Kalender-Icon und Titel, rechts „in 12 min“ in warn.
5. Musik: Cover 18×18 (r 4) und Titel, rechts ein Visualizer mit 4 Balken (3px, accent), Augen `music`.
6. Leerlauf: schmale Notch, Augen `awake`, nach N min `sleep`.

Pro Seite steht höchstens eine Info. Die Stimmung der Augen bestimmt das ranghöchste Element.

## Aufgeklappte Insel

- **Maße:** Breite 720, Innenabstand 14px 16px 16px, Unterkante `border-radius 0 0 28px 28px`, Schatten `0 16px 40px rgba(0,0,0,.5)`.
- **Höhe:** passt sich dem Inhalt an. Ein ResizeObserver misst den Inhalt, die Insel hat eine explizite px-Höhe mit `transition: height .42s cubic-bezier(.32,.72,0,1)` (`--ease-drawer`). Jede Seite blendet beim Wechsel ein (`opacity 0→1`, `translateY(-6px)→0`, .32s, `--ease-out`). Bei `prefers-reduced-motion` gibt es keine Transition.
- **Tab-Leiste:** Höhe 34, Abstand 4. Reihenfolge: **Home** (Raster-Icon), **Chat** (Sprechblase, direkt neben Home), dann die eingeschalteten Module (Musik, Kalender, Ablage, To-do, Notizen, Timer usw.), Platzhalter, **Zahnrad** ganz rechts.
- **Icon-Buttons:** 34×34, r 10. Aktiv: Hintergrund `--raised`, Farbe `--text`. Inaktiv: transparent, Farbe `--muted`. Kein Text, nur `aria-label` und `title`.
- **Status-Punkt am Chat-Icon:** 8×8 oben rechts (top 5, right 5), Ring 2px in der Tab-Hintergrundfarbe. Gelb `--warn` heißt braucht dich, grün `--accent` heißt fertig oder neue Antwort, rot `--bad` heißt Fehler. Ohne Ereignis gibt es keinen Punkt.

### Home („Heute“)
- Kopfzeile: Nikki-Figur 48 (Phase 4, bis dahin Platzhalter), „Guten Morgen“ (15/600) und das Datum (12, muted).
- Raster mit 3 Spalten, Abstand 10. Jede Kachel ist 140 hoch, Innenabstand 14, r 16, Hintergrund `--card`, `justify-content: space-between`, aufgebaut aus Kopf (12, muted, Meta rechts), Inhalt und Aktion. Es gibt keine leeren Flächen.
- Die Claude-Kachel zeigt nur den Status (Sessions mit Punkt) und einen Knopf „Zum Chat“, aber kein Eingabefeld. Der Chat existiert nur im Chat-Tab.

### Chat
- Kopfzeile: Session-Chips (Höhe 30, r 9, Punkt in der Statusfarbe; aktiv `--raised`, sonst transparent), darauf folgend ein Platzhalter, Branch und Änderungen in Cascadia Code 11 muted, dann der Modell-Chip.
- Verlauf in einer `--card`-Fläche, r 16, Innenabstand 14. Nutzer-Blasen rechts in `--raised`, r 14 14 4 14. Freigabe-Karte inline in #000, r 12: Tool, Befehl (mono), Erlauben (accent / bean-ink, 600), Immer, Ablehnen (bad).
- Eingabe: Höhe 40, r 12, dazu Push-to-Talk und Senden (accent) mit je 40×40.

### Modul-Seiten (Vorlage für Phase 3)
- **Musik:** Cover 124 (r 16) links. Rechts Titel 18/600, Interpret · App, Fortschritt (4px) mit Zeiten, Bedienknöpfe 36/44/36 rund, rechts ein Lautstärke-Slider (140).
- **Kalender:** Monatskarte 260 breit mit einem „+“-Knopf (28×28) **rechts neben dem Monatsnamen**. Rechts „Heute“ und darunter die Termine **einfach untereinander** (Zeilen 38 hoch, Farbstreifen 3px, Zeit, Titel), kein Knopf unter der Liste.
- **Ablage:** kleine Kacheln, 8 pro Reihe, Vorschau 44×44 (r 8), Name 11px gekürzt. Name und Größe stehen im Tooltip. Auswahl als 2px-Rahmen in accent. Dazu „An Chat anhängen“ und „Alles leeren“ (bad).
- **To-do:** Filter „Alle | Projekt“. Zeilen 40 hoch mit Checkbox, Scope und „An Chat“.
- **Notizblock:** dunkler Abreißblock. Oben eine Lochleiste (20px, #26262c, 16 Löcher), darunter eine gepunktete Perforationslinie. Das Blatt ist #1c1c21 mit Linien alle 28px (#2c2c33) und einem roten Rand bei 22px (rgba(255,138,138,.3)). Die übrigen Blätter schauen unten als Kanten hervor.
  - **Blättern** mit ‹ › oder dem Mausrad: Das Blatt klappt nach oben weg (rotateX 80°, .2s), das nächste rückt nach (.24s). Zurück klappt es von oben herunter (.3s).
  - **Rausreißen** löscht das Blatt: Es kippt kurz an und fällt dann rotierend aus der Insel (.52s).
  - **Neues Blatt** kommt von oben.
- **Timer:** Ring 140 (Strich 8, accent), dazu die Vorgaben 5/15/25 und Pause/Zurücksetzen.

## Settings (Zahnrad)
Eine eigene Seite in der Insel, gleiche Tab-Leiste, Zahnrad aktiv. Abschnitte:
- **Allgemein:** Autostart, Hotkey frei belegbar mit Konfliktprüfung, Töne, Notch-Größe, Minuten bis zum Einschlafen.
- **Claude:** Terminal-Sessions beobachten, Rückkanal ab Phase 2, Channel-Opt-in ab Phase 2, Claude-Pfad.
- **Module:** ein/aus und Reihenfolge.
- **Git/GitHub:** vorerst nur Branch-Anzeige an/aus.
