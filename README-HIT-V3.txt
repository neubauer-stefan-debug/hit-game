HIT! V3 – Hinweise

Warum du noch 'lokale Highscores löschen' gesehen hast:
Sehr wahrscheinlich lief bei dir noch eine alte, gecachte Version (Service Worker / PWA Cache)
oder die V2.1-Dateien wurden nicht vollständig überschrieben.

In V3 ist dieser Button entfernt.
Außerdem ist der Cache-Key erneut geändert worden.

Wichtig nach dem Upload:
1. Alle Dateien aus dieser ZIP ins Repository hochladen und alte überschreiben.
2. Im Browser die Seite einmal hart neu laden.
3. Falls auf dem Handy noch alt: App schließen und neu öffnen.
4. Notfalls Website-Daten/Cache für die HIT!-Seite löschen.

Firebase:
- Authentication > Anonymous aktiv
- Firestore Database vorhanden
- Firestore Rules veröffentlicht

Die Highscores speichern nur Ergebnisse aus HIT! ROUND.
