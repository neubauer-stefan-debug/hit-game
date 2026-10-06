HIT! V3.2 – Upload

1. Alle Web-Dateien direkt ins GitHub Repository hit-game hochladen und gleichnamige Dateien überschreiben.
2. FIRESTORE-RULES.txt gehört NICHT in GitHub. Inhalt nur in Firestore > Rules verwenden, falls dort noch nicht gesetzt.
3. Nach Commit GitHub Pages öffnen und einmal hart neu laden. Der neue Service Worker bevorzugt aktuelle HTML/JS-Dateien.
4. Wenn Highscore OFFLINE zeigt: Firebase Authentication > Settings > Authorized domains prüfen. Falls nötig neubauer-stefan-debug.github.io hinzufügen.

V3.2:
- 100-Level-Map in 10 Kapiteln, erreichte Level direkt anklickbar
- Sterne pro Level und gespeicherter Fortschritt
- 17 Button-Skins über lange Meilensteine
- vier deutlich unterschiedliche Theme-Welten
- fünf Uhr-Designs inklusive Manga/Digital/Analog
- Sound Assist: aus, 1s Beat, 0.5s Beat, beschleunigend zum Target
- App-Navigation unten, PWA-Icons, robustere Cache-Aktualisierung
- Firebase Online Highscore + lokaler Fallback
