Gegrillt: ja

# Spracheingabe in Nikki (2026-10-30)

Ziel: Taste halten, sprechen, loslassen. Nikki versteht es lokal und erledigt es.

## Entscheidungen

- Erkennung lokal mit whisper.cpp. Programm und Modell lädt Nikki erst nach Einschalten durch den Nutzer, mit geprüften Hashes.
- Halten einer frei belegbaren Taste. Das Mikrofon läuft nur, solange sie gehalten wird.
- Feste Sprachmuster, keine KI: „Frag Claude, …“ schickt direkt an Claude, „Schreib an [Name], …“ schickt an den Webhook dieses Namens, alles andere landet unversendet im Chat-Feld.
- Webhooks: Liste aus Name und URL unter Discord, verschlüsselt. Gesendet wird nur an Namen aus der Liste und nur an Discord-Webhook-Adressen. Ein unbekannter Name landet im Chat-Feld.
- Claudes Antwort steht im Chat, kein Vorlesen. Ohne gewähltes Projekt meldet die Kapsel das und schickt nichts ab.
- Kapsel unten mittig nach dem Aufbau von Coucou (nachgebaut, keine Assets): Nikkis Kopf und neun Punkte für die Stimme, Welle beim Umwandeln, kurze Meldungen. Nur beim Sprechen, Umwandeln und für die Rückmeldung sichtbar.
- „Hey Nikki“ ohne Taste ist ein eigener späterer Schritt.
