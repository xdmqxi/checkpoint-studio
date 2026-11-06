# Drittanbieter

Die eigene Implementierung steht unter MIT (siehe LICENSE). Abhängigkeiten behalten ihre eigenen Lizenzen.

- Electron: MIT; enthält Chromium, Node.js und weitere Komponenten mit eigenen Hinweisen.
- React: MIT.
- Lucide: ISC.
- ffmpeg-static: GPL-3.0-or-later (Paket); das gelieferte FFmpeg enthält GPL-Komponenten einschließlich libx264. Die Anwendung verwendet FFmpeg als separaten ausführbaren Prozess. Dies ist keine Zusicherung, dass jede geplante Vertriebsform damit automatisch lizenzkonform ist.

Vor einer Veröffentlichung sind die konkreten Lizenzen des plattformspezifischen FFmpeg-Binaries, zugehörige Notices und die Bereitstellung des korrespondierenden Quellcodes samt Buildkonfiguration sicherzustellen. Das lokale App-Paket ist ein Entwicklungsbuild, keine zur öffentlichen Weiterverteilung vorbereitete Veröffentlichung. Für H.264/HEVC können je nach Vertrieb und Einsatz weitere Patentfragen relevant sein.

Paketlizenzen stehen in node_modules/*/LICENSE. Electron bringt zusätzliche LICENSE- und LICENSES.chromium.html-Dateien mit. Lockfile und Binaryversionen müssen beim Erstellen einer Veröffentlichung festgehalten werden.

Seit 0.4 enthält jedes Paket eine zum Zielsystem passende FFmpeg-Datei mit README, Lizenz und SHA-256-Manifest in `resources/ffmpeg` bzw. `Contents/Resources/ffmpeg`. Bezug: https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1. Die konkreten Buildinformationen stehen in der mitgelieferten README. Diese Unterlagen ersetzen keine vollständige Vorbereitung einer öffentlichen GPL-konformen Distribution.

Das eigene Flaggen-Icon und der DMG-Hintergrund werden lokal aus Vektorgeometrie gerendert. Das nur bei der Entwicklung eingesetzte @resvg/resvg-js verwendet seine eigene Lizenz; es wird nicht als Laufzeitkomponente der App ausgeliefert.
