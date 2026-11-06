# Prüfprotokoll – Checkpoint Studio

## Version 0.6.0 – Schnittarbeitsplatz (6. November 2026)

GitHub-Veröffentlichung abgeschlossen: [Release v0.6.0](https://github.com/xdmqxi/checkpoint-studio/releases/tag/v0.6.0). [Release-Workflow](https://github.com/xdmqxi/checkpoint-studio/actions/runs/42205759605) mit Mac-/Windows-Builds und Veröffentlichung sowie [Windows-CI](https://github.com/xdmqxi/checkpoint-studio/actions/runs/42205756210) erfolgreich. Native Windows-Editor-/Audio-/Exporttests sind damit ausgeführt; echte Windows-Bildschirmaufnahme bleibt gesondert offen. Anonyme Downloads beider stabiler Installer-Links geprüft; die veröffentlichten SHA-256-Dateien stimmen mit den Asset-Digests aus GitHub überein.

- Dunkler Schnittplatz mit Projektmedien/Suche, Programmmonitor, Eigenschaften und gemeinsamer V1/A1–A4-Timeline. Zusätzliche drei Audio-Lanes; echte Wellenformen aus decodierten Samples; Audio-Quellausschnitt, Lautstärke, Mute, Fades, Position und Lane sind gespeichert und rückgängig machbar.
- Auswahl-/Rasierklingenwerkzeug, Video-/Audio-Clipkanten, Video-Umordnen, Duplizieren/Löschen, Audio-Drag zwischen Lanes mit Einrasten/Alt-Override und Tastenkürzel. Original-Audio bleibt nach Entfernen in der Projektbibliothek. Legacy-Projekte werden ohne Versionsbruch geöffnet.
- Durchgehende Programmvorschau über Schnitte und Takes hinweg; Aufnahmeton und importierte Audios laufen zur Sequenzzeit. HTML-Mediaelemente der importierten Spuren werden im E2E-Test tatsächlich auf Wiedergabe, Quellzeit und Lautstärke kontrolliert.
- Native Importe erstellen WAV- bzw. H.264/AAC-MP4-Arbeitskopien und behalten Quelldateien im Projekt. Fehlerhafte Eingaben werden abgewiesen. Export mit 720/1080p, 30/60 fps und zwei Qualitätsstufen. Audio-Mischung erfolgt über die komplette Sequenz, damit Fades an Videoschnitten nicht neu starten.
- Build erfolgreich; 26 Tests bestanden, inklusive echten FFmpeg-Exports: Fades in decodierten Audiosamples, normalisierter AIFF-/MKV-Import, Ton aus importierten Videos und 720p60.
- UI-Smoke für Seiten/Theme und bestehender Checkpoint-/Editor-Smoke erfolgreich. Neuer Studio-E2E-Test gegen Quell-App und gepackte Mac-App bestanden: AIFF, Projektkopie, Wellenform, Position/Fades, echte Audiowiedergabe beim Video-Quellwechsel, Mute, Split/Undo, Audio-Lane-Drag/Trim, Video-Umordnen/Trim, Bibliotheks-Wiederverwendung, Rasierklinge, Tastatur-Undo und UI-ausgelöster 720p-Export. Screenshots visuell geprüft.
- Live-Aufnahme-Test gegen Quell-App und gepackte Mac-App bestanden: Aufnahme, minimiertes Hauptfenster, On-top-Pille (543 px nativ, 11 px leerer rechter Rand), Pause/Fortsetzen, Checkpoint/Retake, Text/Escape, gebrannte Textpixel und echter MP4-Export.
- Einschränkungen: eine Videospur, keine Video-Compositing-/Übergangs-/Farbkorrektur- oder KI-Funktionen. Systemton-Aufnahme weiterhin deaktiviert. Echte Windows-Aufnahme und Installer-Abnahme bleiben offen; die native Editor-/Export-Laufzeitprüfung auf Windows ist inzwischen erfolgreich (siehe nachfolgenden GitHub-Nachweis).


## Version 0.5.0 – SAP-Workflow-Design (6. November 2026)

Fiori-Horizon-inspirierte dunkle Oberflächen als Standard, optionale helle Variante, blauer Akzent, konsistente Timeline- und Pillenfarben, SAP-Schulungstexte sowie eigene blaue App-/Installer-Icons. TypeScript/Vite-Build erfolgreich. UI-Smoke-Test für Übersicht, Aufnahme, Editor und Theme-Wechsel ohne Rendererfehler. Editor-Smoke-Test einschließlich Audio-Import, Videoschnitt und Checkpoints bestanden. Echter Live-Aufnahme-Test bestätigt passende Pillenbreite (543 px nativ, 11 px rechter Innenabstand), Always-on-top bei minimiertem Hauptfenster, Pause/Fortsetzen, Checkpoint/Retake, Text und MP4-Export. Screenshots von Übersicht, Editor und Pille visuell geprüft. Mac-DMG und Windows-x64-Installer 0.5.0 mit dunklem Standarddesign erstellt und nach Downloads kopiert. Beide gepackten Frontends entsprechen dem aktuellen Build; NSIS-Inhalt geprüft. Windows-Laufzeit weiterhin nicht geprüft.


## Version 0.4.4 – Audio importieren

Separater Audio-Import mit lokaler Projektkopie, Vorschau-Synchronisierung, Position, Lautstärke und Entfernen/Rückgängig. Bestehende Projekte ohne Audiospuren bleiben kompatibel. 21 Tests bestanden; realer FFmpeg-Export prüft Stille vor dem Einsatz, hörbaren Import und Fortsetzung über einen Videoschnitt bei stummgeschaltetem Mikrofon. Editor-UI-Test gegen Quell-App und gepackte Mac-App prüft tatsächlichen WAV-Import, Dauer, Projektkopie und gespeicherte Position. Mac-DMG und Windows-Installer 0.4.4 gebaut; Windows-Payload geprüft, Windows-Laufzeit weiterhin ungetestet.


## Version 0.4.3 – Schnittwerkzeuge unten (23. Oktober 2026)

Start/Ende, Teilen, Duplizieren und Löschen & nachrücken stehen jetzt gemeinsam in der unteren Timeline-Werkzeugleiste. Die rechte Seitenleiste enthält nur noch den Audiomixer. TypeScript-/Vite-Build sowie Editor-UI-Test gegen Quell-App und gepackte macOS-App erfolgreich: verschobene Felder, Teilen, Duplizieren, Löschen und Rückgängig geprüft. Bestehendes Benutzerprojekt mit 2 Takes, 4 Clips und 2 Checkpoints in Version 0.4.3 wieder geöffnet. macOS-DMG und Windows-x64-Installer erfolgreich erstellt. Windows-Installerinhalt geprüft; Windows-Laufzeitprüfung weiterhin offen.


## Version 0.4.2 – Schere direkt an der Timeline (23. Oktober 2026)

Kleiner Scheren-Button links neben Rückgängig in der Timeline-Leiste. Er verwendet dieselbe Schnittfunktion wie die Seitenleiste und teilt den ausgewählten Clip am aktuellen Video-Abspielkopf. Wiedergabe wird dabei pausiert. Ohne Clip bzw. direkt an einer Clipgrenze ist der Button deaktiviert, damit keine Null-Längen-Clips entstehen.

TypeScript-/Vite-Build und vorhandener Editor-UI-Test mit echter Videodatei erfolgreich; die Teilung wird nun ausdrücklich über den neuen unteren Scheren-Button ausgelöst und erzeugt einen zusätzlichen Clip. Anschließender Sprung innerhalb derselben Quelle bleibt korrekt. Mac-DMG und Windows-Installer aktualisiert; Windows-Laufzeitprüfung weiterhin offen.

## Version 0.4.1 – Pille ohne leeren Nachlauf (23. Oktober 2026)

Die sichtbare Pille verwendet max-content. Ein ResizeObserver misst ihre tatsächliche Breite und lässt ausschließlich das eigene native Pillenfenster über eine validierte IPC-Methode passend verkleinern. Hintergrund und interaktive Fensterfläche haben damit keine feste unnötige Restbreite mehr.

Im gepackten macOS-App geprüft: native Fensterbreite 543 Pixel statt 650, sichtbare Pille 527 Pixel, rechter Innenabstand nach dem letzten Button 11 Pixel. Der Test kontrolliert sowohl die Inhaltsanpassung als auch den letzten Button. Anschließend kompletter Aufnahme-/Pause-/Checkpoint-/Retake-/Text-/Exporttest erfolgreich, keine Rendererfehler. DMG und Windows-x64-Installer neu gebaut; Windows-Laufzeittest bleibt unverändert offen.

## Version 0.4 – neue Pille, DMG und Windows-Installer (23. Oktober 2026)

- Pille neu gestaltet: dunkle abgestufte Fläche, grün hervorgehobener Checkpoint-Button mit Zähler, beschriftete Werkzeuge, klare Pause-/Aufnahmeanzeige, Fokusmarkierungen und Unterstützung für reduzierte Bewegung. Native Always-on-top-Nachführung bleibt erhalten.
- Eigene Flaggen-Icons als PNG/ICNS/ICO und DMG-Hintergrund lokal aus Vektorquellen gerendert. DMG-Inhalt mit App und Programme-Verknüpfung im Finder visuell geprüft.
- 21 automatisierte Tests bestanden. Der echte FFmpeg-Exporttest verwendet nun einen Projektpfad mit Leerzeichen, Umlaut und Apostroph. Verkettungslisten referenzieren ausschließlich kontrollierte relative Dateinamen.
- Zielplattformabhängige FFmpeg-Paketierung: macOS arm64 als Mach-O, Windows x64 als PE. Neue Tests lehnen falsche Plattform/Architektur ab.
- `npm run dist:mac`: `Checkpoint-Studio-0.4.0-macOS-arm64.dmg` erfolgreich erstellt. Image-Prüfsumme mit hdiutil gültig; read-only gemountet. App und Applications-Symlink vorhanden.
- App direkt aus der gemounteten DMG über `CHECKPOINT_APP_PATH` gestartet. Echte Fensteraufnahme, Pille bei minimiertem Hauptfenster, On-top-Wiederherstellung ohne Fokusübernahme, Pause/Fortsetzen, Live-Checkpoint, Retake, Textfeld, Escape und tatsächlicher MP4-Export erfolgreich. Originalaufnahme ca. 6,898 Sekunden; keine Rendererfehler. Die finale DMG enthält nach einer reinen Hintergrundkorrektur dieselbe getestete App: app.asar SHA-256 `42f3a0830a0db355a382b85350081601106097c1263292b9f35dffd4966762c0`.
- `electron-builder --win nsis --x64`: `Checkpoint-Studio-0.4.0-Windows-x64-Setup.exe` auf dem Mac erfolgreich cross-kompiliert, inklusive Deinstallation und eigenen Icons.
- Tatsächlichen NSIS-Inhalt mit `scripts/verify-windows-installer.cjs` extrahiert: App und Encoder als Windows-x64-PE geprüft, App-Version 0.4.0 und paketierter Encoderpfad bestätigt. Encoder-Hash gegen das eingebettete Manifest geprüft: `04e1307997530f9cf2fe35cba2ca7e8875ca91da02f89d6c7243df819c94ad00`.
- SHA-256-Prüfsummen der beiden fertigen Installationsdateien in `release/SHA256SUMS.txt` abgelegt.
- Bestehendes Benutzerprojekt nach dem Update wieder geöffnet: 2 Takes, 3 Clips, 2 Checkpoints in Version 0.4 sichtbar.

Wichtig: Kein Windows-Laufzeittest durchgeführt. Der erfolgreiche Windows-Build und die Inhaltsprüfung sind kein Beleg für Installation, Aufnahme oder Audio-/Videosynchronität unter Windows. Checkliste und vorbereiteter Windows-CI-Workflow: `WINDOWS-CHECK.md`. Beide Installationspakete sind unsignierte Entwicklungsreleases. Mac-Paket für Apple Silicon; Windows-Paket für x64. Intel-Mac und natives Windows ARM wurden in diesem Schritt nicht gebaut.

## Version 0.3 – Checkpoint-Übersicht und On-top-Nachführung (23. Oktober 2026)

- Produktionsbuild und macOS-arm64-App-Paket erfolgreich erstellt.
- 19 automatisierte Tests bestanden. Neu: Timeline-/Quellzeit-Umrechnung, Laden alter Checkpoints, Mitwandern beim Umsortieren und Ripple-Trimmen, erhaltene Marker in entfernten Bereichen, Retake-Quelllücken und duplizierte Clips.
- `node tests/editor-checkpoints-smoke.mjs --packaged`: echtes Projekt mit zwei Videoquellen geöffnet; Timeline-Marker und Liste geprüft; zwischen Takes gesprungen; Marker am Abspielkopf statt am Projektende erstellt; vorherigen Clip gekürzt und nachgerückte Markerposition geprüft; Marker umbenannt; Zoom; Entfernen/Undo; Sprung über das Zeitlineal und nach einer Teilung zwischen zwei Clips desselben Takes geprüft. Keine Rendererfehler.
- `node tests/live-controls-smoke.mjs --packaged`: die native Pille blieb bei minimiertem Hauptfenster sichtbar. Im Test wurden Always-on-top absichtlich deaktiviert und die Pille versteckt. Die native Nachführung stellte beide Eigenschaften wieder her, ohne der Pille Tastaturfokus zu geben. Anschließend Pause/Fortsetzen, Live-Checkpoint, Live-Retake, großes Live-Textfeld, Escape und tatsächlicher MP4-Export erfolgreich. Originalaufnahme ca. 6,525 Sekunden, zwei beibehaltene Quellbereiche, ein Live-Checkpoint. Keine Rendererfehler.
- Screenshots der echten Editor-UI mit synthetischen Testmedien: `test-results/editor-checkpoints.png`, `test-results/checkpoint-timeline.png`.

Grenzen: On-top-Nachführung auf diesem Mac mit eigenen Testfenstern geprüft. Keine Zusicherung gegenüber sicheren Betriebssystemdialogen; fremde native Vollbild-Anwendungen und Windows bleiben separat zu prüfen. Bestehende Projektdateien bleiben Version 1; neue Quellreferenzen sind zusätzliche optionale Markerfelder.

## Version 0.2 – schwebende Live-Steuerung (23. Oktober 2026)

Auf demselben macOS-arm64-Rechner geprüft:

- TypeScript-/Vite-Produktionsbuild erfolgreich.
- `npm test`: 13 Tests bestanden, einschließlich wiederholter Live-Retakes, Pausengrenzen und wortweisem Textumbruch sowie echtem Audio-/Videoexport.
- `node tests/live-controls-smoke.mjs`: echte Fensteraufnahme mit minimiertem Studio, sichtbarer Always-on-top-Pille, Pause/Fortsetzen, Checkpoint während Pause, Rücksprung bei weiterlaufendem Recorder, Live-Text und Escape erfolgreich.
- `npm run dist:mac`: aktualisiertes App-Paket Version 0.2.0 erstellt.
- `node tests/live-controls-smoke.mjs --packaged`: derselbe vollständige Ablauf mit dem gepackten App erfolgreich. Die Aufnahme blieb über Checkpoint und Rücksprung ein einziger Original-Take (5,4227 Sekunden), die Clipfolge enthielt zwei Bereiche mit einer verworfenen Quelllücke von ca. 0,75 Sekunden.
- Bei pausierter Aufnahme blieb die publizierte Zeit über 650 ms innerhalb einer Toleranz von 50 ms unverändert.
- Native Fenster geprüft: Hauptfenster minimiert, Pille sichtbar und Always-on-top; Textfenster mit 80 Prozent der Arbeitsflächenbreite. Escape blendete den Texteditor tatsächlich aus.
- Ein Frame wurde aus der gespeicherten Originalaufnahme dekodiert. Im Textbereich wurden 112665 Pixel der eingestellten Text-Hintergrundfarbe und 1969 helle Textpixel nachgewiesen. So wurde das eingebrannte Overlay geprüft, statt nur einen UI-Screenshot zu prüfen.
- Vorschau abgespielt und pausiert, ohne Fehlermeldung für nicht vorhandene Audiospuren. MP4-Export über die UI erfolgreich und exportiertes Video vollständig mit FFmpeg dekodiert.
- Keine Rendererfehler. Ergebnisse und Screenshots unter `test-results/live-controls-packaged.json`, `live-pill.png`, `live-text.png` und `live-text-recorded.png`.

Grenzen: Testaufnahme ohne Mikrofon-Hardware. Mikrofonexport zusätzlich mit synthetischem Audio getestet; Hardware-/Langzeit-Synchronität bleibt offen. Windows, fremde native Vollbild-Apps und mehrere Monitore wurden nicht geprüft. Die native Spaces-/Fullscreen-Konfiguration ist gesetzt, aber nicht als vollständige Plattformmatrix getestet. Text ist im Video eingebrannt; nachträgliche Textbearbeitung im Editor fehlt weiterhin. Laufende Aufnahmen sind weiterhin im Speicher und noch nicht gegen Absturz abgesichert.

## Historisch: Version 0.1

Die folgenden Angaben dokumentieren den ersten Stand vor der Live-Steuerung. Aussagen über damals fehlende Checkpoints/Steuerpille/Text-Overlays werden durch den Abschnitt zu 0.2 ersetzt.

Datum: 23. Oktober 2026. Lokal gemeldetes System: macOS 27.2 (26B118), arm64. Node.js 24.22.0, Electron 45.0.0. Keine Windows-Tests durchgeführt.

## Erfolgreich ausgeführt

- `npm run build`: TypeScript-Prüfung und Vite-Produktionsbuild.
- `npm test`: 6 bestandene Tests (5 Modelltests und ein FFmpeg-Integrationstest).
- `node tests/ui-smoke.mjs`: echte Electron-App gestartet, vier Ansichten geöffnet, Dark/Light umgestellt, Quellen über native desktopCapturer-Schnittstelle geladen. Keine Rendererfehler. Screenshots in `test-results/`.
- `node tests/recording-smoke.mjs`: eigenes App-Fenster real aufgenommen (ohne Mikrofon), gestoppt, automatische Projektdatei und Medien geprüft, Checkpoint über UI gesetzt, MP4-Export über UI ausgelöst und Originalvideo mit FFmpeg dekodiert. Laufzeit ca. 1,6 Sekunden.
- `npm run dist:mac`: Apple-Silicon-App erfolgreich unter `release/mac-arm64/Checkpoint Studio.app` gebaut.
- `node tests/recording-smoke.mjs --packaged`: derselbe Aufnahme-/Exportweg mit der tatsächlich gepackten App erfolgreich. Aufnahmedauer 1,6018 Sekunden; WebM-Datei 251158 Byte. FFmpeg wird aus dem App-Paket gestartet, der Exportdialog im Test automatisch auf einen temporären Ausgabeort gelenkt.
- `npm audit`: nach Aktualisierung auf Electron 45 keine bekannten Sicherheitslücken gemeldet; zusätzlich `npm audit --omit=dev` ohne Befund.

Der FFmpeg-Integrationstest erstellt ein reales Testvideo und eine separate synthetische Mikrofon-Testdatei. Zwei unterschiedliche Quellausschnitte werden auf 1080p30 skaliert, mit 50 Prozent Mikrofonlautstärke gemischt und zu einem 1,5 Sekunden langen MP4 mit H.264 und AAC verbunden. Der Test kontrolliert Codec, Auflösung, Dauer und Dekodierbarkeit, Projektspeicherung, Wiederöffnung und Pfadbegrenzung.

Die Modelltests prüfen Rücksprung mitten in einen Clip und zum Projektanfang, Erhalt aller Original-Takes, Teilung mit Quelloffsets und unveränderter Gesamtdauer, Ablehnung von Null-Längen und ein JSON-Projekt-Roundtrip mit relativen Medienpfaden.

## Nicht geprüft oder nicht fertig

- Echtes Mikrofon als Hardware-Eingang: nicht in den automatischen Aufnahmeversuch einbezogen. Die synthetische Export-Audiospur ist kein Beleg für Mikrofonberechtigungen oder Langzeitsynchronität.
- Langzeitaufnahme, Speicherdruck, 4K60, mehrere Monitore, unterschiedliche GPUs und Audiogeräte.
- Windows, Intel-Mac, Windows ARM und Installer-Installation.
- Signierung, Notarisierung und öffentlicher Vertrieb. Das App-Paket ist ein unsignierter lokaler Entwicklungsbuild.
- Wiederherstellung einer beim Absturz laufenden Aufnahme: nicht implementiert. Nur gestoppte Takes sind auf Datenträger gespeichert.
- Systemaudio, unterbrechungsfreie Checkpoints, schwebende Toolbar, Overlays, Webcam, erweiterte Timeline, Effekte und KI: offen, siehe README.

Die kurzen erfolgreichen Aufnahmen belegen den grundlegenden Betrieb auf diesem Rechner; sie belegen keine Produktionsstabilität für lange Tutorials.
