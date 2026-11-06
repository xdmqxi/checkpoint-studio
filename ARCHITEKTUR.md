# Architektur und nächste Phasen

## Entscheidung

Electron bietet für die erste Version auf beiden Zielplattformen dieselbe Chromium-Medienpipeline, lokale Dateidialoge, eine isolierte React-Oberfläche und paketierbare Desktop-Fenster. Das ist hier gegenüber Tauri zweckmäßig, weil ein eigener nativer Capture-/Codec-Stack für jede Plattform den ersten verifizierbaren Aufnahmeweg deutlich vergrößert hätte. Der Preis sind ein größeres App-Paket und höherer Grundspeicherverbrauch. Ein Rust-/Swift-/C++-Capture-Backend bleibt als späterer Adapter möglich; es ist noch nicht vorhanden.

Die aktuelle Anwendung benötigt keine Cloud und kontaktiert zur Laufzeit keine KI- oder Telemetrieserver. Die CSP verhindert ausgehende Verbindungen des Renderers. Die Entwicklungsinstallation lädt npm-Pakete, Electron und FFmpeg aus dem Internet.

## Datenfluss

```text
Native Bildschirm-/Fensterquellen (Electron/Chromium)
  → MediaStream → Canvas-Compositor (Live-Text) → MediaRecorder → Video-WebM
Mikrofon (getUserMedia)
  → eigener MediaRecorder → Audio-WebM
  → Dateien im Projektordner
  → versioniertes Projekt mit unveränderten Takes und editierbarer Clipfolge
  → FFmpeg-Unterprozess → tatsächliche MP4-Ausgabe
```

Das UI hat keinen Node.js-Zugriff. Der Preload stellt explizite IPC-Methoden bereit. Dateizugriffe auf Medien bleiben im ausgewählten Projektordner. Der Export arbeitet aus den Originalen mit Quelloffsets; Änderungen schreiben keine Originalmedien um. FFmpeg-Argumente werden als Argumentliste und ohne Shell gestartet.

## Datenmodell

- Take: ID, relativer Videopfad, optionaler Mikrofon-/Systemaudiopfad, Dauer.
- Clip: eigene ID, Take-ID, In-/Out-Zeit in Sekunden.
- Checkpoint: ID, editierbarer Name, Timelinezeit; seit 0.3 zusätzlich optionale Take-ID, Quellzeit und Clip-ID. Vorhandene version-1-Projekte bleiben lesbar.
- Projekt: Versionsnummer, Name, Takes, Clips, Checkpoints, Audiolautstärken.

Retake kürzt oder entfernt Clipreferenzen nach dem Checkpoint. Während einer Aufnahme verwaltet LiveTimeline beibehaltene Quellbereiche und startet nach einem Rücksprung sofort einen neuen Quellbereich, ohne die Medienquelle zu stoppen. Beim Stop werden diese Bereiche zu Clipreferenzen desselben Original-Takes. Takes und Dateien bleiben erhalten. Undo/Redo speichert Projektzustände im laufenden Prozess. Beim Wiederöffnen ist die gespeicherte Clipfolge verfügbar, nicht die Undo-Historie.

## Geplante Erweiterungen in Prioritätsreihenfolge

1. Die Aufnahme-Engine ist seit 0.2 in `src/recording.ts` ausgelagert. Als Nächstes fortlaufend auf Datenträger geschriebene Segmente mit Manifest, gemeinsamem Zeitursprung und Absturzwiederherstellung. Checkpoint setzt Segmentgrenze, ohne Quellen neu zu öffnen.
2. Live-Checkpoints und Retakes sind seit 0.2 verfügbar. Als Nächstes Vorschaubild, Take-Vergleich, Wiederherstellungsdialog und Suche.
3. Separate Systemaudio-Capture-Adapter und native Berechtigungsdiagnose; auf Mac CoreAudio-/ScreenCaptureKit-Funktionen, auf Windows Loopback. Auf beiden Plattformen mit echter Hardware testen.
4. Schwebende Steuerpille und eingebrannter Live-Text sind seit 0.2 vorhanden. Als Nächstes Webcam und globale Hotkeys; nachträglich editierbare Overlays über einen gemeinsamen Compositor in Vorschau und Export rendern. Shortcut-Anzeige nur mit expliziter Aktivierung und ohne Textaufzeichnung.
5. Allgemeines Spurmodell mit unabhängigen Video-/Audio-Clips, Wellenformen, Thumbnails, Audioimport, Drag/Trim/Snap und durchgängiger Mehrspurvorschau.
6. Gemeinsamer Effektgraph für Vorschau und Export: Transformationen, Text, Keyframes, Übergänge und Audioeffekte. Golden-frame-/Referenzaudio-Tests gegen FFmpeg-Ausgabe.
7. Optionale lokale Whisper-Transkription, Stilleanalyse und rückgängig machbare Schnittvorschläge. Kein KI-Ergebnis ohne Modell als erkannt darstellen.
8. Windows-/Intel-Tests, Langzeittests, Performancebudgets, Hardware-Encoding, signierte/notarisierte Distribution und vollständige Lizenzunterlagen.

Referenz für die Capture-Schnittstelle und plattformspezifische Einschränkungen: https://www.electronjs.org/docs/latest/api/desktop-capturer

## Live-Steuerung seit 0.2

`electron/floating.cjs` erstellt unabhängige, immer oben liegende BrowserWindow-Fenster. Die Hauptoberfläche publiziert den Aufnahmezustand; die Pille sendet ausschließlich bekannte Steueraktionen an den Aufnahmebesitzer. Der Texteditor sendet begrenzte, validierte Text-/Stilwerte. Die Hauptoberfläche ist auch bei Minimierung ohne Hintergrunddrosselung aktiv. Das native Textfenster bearbeitet den Inhalt; der Canvas-Compositor rendert ihn unabhängig von der ausgewählten Bildschirm-/Fensterquelle in die Videoaufnahme.

`RecordingSession` verwaltet die aktive Aufnahmezeit anhand von performance.now mit exakten Pause-/Fortsetzen-Zeitpunkten. `LiveTimeline` speichert Quellbereiche, sodass ein Retake Video und Mikrofon ohne Neustart oder destruktives Löschen umschneidet. Textänderungen werden zusätzlich mit Quellzeitstempeln im Take gespeichert. Die Originalbilder enthalten den Text bereits.

## Editor-Checkpoints und native Pille seit 0.3

`src/checkpoints.mjs` verknüpft Checkpoints mit ihren Quellstellen und berechnet nach Timelineänderungen ihre neue Projektzeit. Die Originalreferenz bleibt auch erhalten, wenn die Stelle entfernt wurde. `locateTime` löst eine Projektzeit in Clip und Quellzeit auf; die Vorschau übernimmt ausstehende Sprünge auch über asynchron geladene Takes hinweg.

`EditorTimeline` zeichnet Lineal, Marker, Videoclips, Audiodatei-Zuordnung und Abspielkopf mit derselben Zeit-/Pixel-Skala. Ein ResizeObserver passt die Grundbreite ans Fenster an. Zoom vergrößert die komplette Skala einschließlich der Checkpoints. Eine eigene Checkpoint-Liste erlaubt präzise Navigation und Umbenennung.

Die native Pille behält ihren Always-on-top-/All-Spaces-Status und wird bei Wiederanzeige/Fokuswechseln sowie alle 750 ms mit moveTop neu einsortiert. showInactive verhindert Fokusübernahme beim Wiedererscheinen. Das Intervall endet bei Stop und wird beim Schließen des Besitzers bereinigt. Monitoränderungen begrenzen die Position auf eine sichtbare Arbeitsfläche. Diese Maßnahmen sind keine Zusicherung einer Überlagerung sicherer Betriebssystemdialoge.
