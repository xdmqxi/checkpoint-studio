# Windows-Prüfstand – 0.6.0

## Bereits geprüft, auf macOS

- Windows-x64-Paket aus demselben React-/Electron-Code erfolgreich gebaut.
- NSIS-Installer inklusive Deinstallation und eigener Icons erstellt.
- Zielplattformabhängiges FFmpeg: `win32/x64`, FFmpeg b6.1.1. Die Mac-Datei wird nicht als Windows-Encoder verwendet.
- PE-Headerprüfung für App und FFmpeg. Der Prüfhelfer kann den tatsächlichen NSIS-Nutzinhalt extrahieren und dessen FFmpeg-Hash gegen das Build-Manifest prüfen.
- Nicht-destruktive Timeline, Live-Retakes, Projektformat und echter Video-/Audioexport automatisiert auf macOS geprüft. Exporttest verwendet einen Projektpfad mit Leerzeichen, Umlaut und Apostroph.

## Noch nicht auf Windows geprüft

Installation, Programmstart, echte Bildschirm-/Fensteraufnahme, Mikrofon, On-top-Verhalten, Audio-/Videosynchronität und Videoexport wurden in dieser Sitzung nicht auf einem Windows-System ausgeführt. Ein gebauter Installer ist dafür kein Nachweis. Auf diesem Rechner stehen weder Windows noch eine Windows-VM zur Verfügung.

Ziel ist Windows 10/11 x64. Ein natives Windows-ARM64-Paket wird bewusst nicht angeboten, weil der gewählte FFmpeg-Build hierfür nicht vorbereitet ist. Betrieb im x64-Emulationsmodus von Windows ARM ist nicht validiert.

## Abnahme auf einem Windows-PC

1. `Checkpoint-Studio-0.6.0-Windows-x64-Setup.exe` als normaler Benutzer installieren. Installation im Benutzerkonto und frei wählbarer Zielordner sind vorgesehen. Installer und App sind nicht signiert.
2. App starten. Quellen laden und ein Testfenster auswählen. Mikrofon nur mit erteiltem Zugriff aktivieren.
3. Aufnahme starten. Mit Alt+Tab zu einem anderen Programm wechseln. Pille muss im Vordergrund bleiben und verschiebbar sein.
4. Über die Pille pausieren. Aufnahmezeit muss stehen bleiben. Checkpoint während der Pause setzen, fortsetzen, einige Sekunden aufnehmen und zum Checkpoint zurückspringen. Der Recorder muss weiterlaufen.
5. T öffnen, Testtext schreiben, Schriftgröße/Farbe ändern. Escape blendet den Text aus. Danach Stop.
6. Projektordner prüfen: Projektdatei, Video-WebM und bei aktiviertem Mikrofon eigene Audio-WebM. Originalabschnitte müssen erhalten bleiben; Timeline muss den verworfenen Bereich auslassen.
7. Checkpoint im Editor anklicken, Clip teilen/trimmen, Markerposition prüfen, Undo/Redo ausführen. MP4 in einen Ordner mit Leerzeichen/Umlauten exportieren und Video einschließlich Ton und Live-Text extern abspielen.
8. Projekt schließen, neu öffnen. Optional den ganzen Projektordner vom Mac übernehmen und die gleichen Clips und Marker prüfen. App deinstallieren; selbst gespeicherte Projekte müssen erhalten bleiben.

Erst nach diesem Ablauf kann Windows-Laufzeitkompatibilität als geprüft bezeichnet werden.

## Wiederholbarer Windows-Build

Auf Windows mit Node.js 24 x64:

```powershell
npm ci
npm test
npm run build
npm run test:ui
npm run dist:win
```

`.github/workflows/windows.yml` bereitet diesen Ablauf für GitHub Actions vor. Die Workflow-Datei wurde lokal angelegt; es wurde hier kein GitHub-Lauf gestartet. Die funktionale Aufnahmeabnahme oben bleibt zusätzlich erforderlich.

Für 0.6 zusätzlich auf Windows prüfen: `npm run test:studio` (normalisierter AIFF-Import, Mehrspur-Audio, Wellenform, Clipkanten/Drag, Quellwechsel und MP4-Export). Diese CI-Aufgabe ist vorbereitet, wurde hier aber nicht auf einem Windows-PC ausgeführt.
