## Checkpoint Studio

Dunkler SAP-Workflow-Schnittplatz für Bildschirmaufnahmen und Schulungsvideos.

Neu in 0.6.3: Audiozeilen entstehen nur für vorhandene Quellen und verschwinden beim Entfernen wieder. Die Arbeitsfläche passt sich an die Fensterhöhe an, ohne vertikales Scrollen der gesamten Seite. Der Windows-Wizard zeigt bestehende Installationen und ersetzt die alte Programmversion beim Update. Einstellungen und externe Projektordner bleiben erhalten.

- Video- und Audio-Import mit kompatiblen Arbeitskopien; Originale bleiben erhalten.
- Video schneiden, kürzen, umordnen, duplizieren und rückgängig machen.
- Dynamische Audiozeilen für vorhandene Quellen mit Wellenformen, Verschieben, Kürzen, Lautstärke, Stummschaltung und Ein-/Ausblenden.
- Durchgehende Vorschau, Rasierklinge, Einrasten und Tastenkürzel.
- MP4-Export in 720p/1080p mit 30/60 fps.
- Aufnahme-Pille mit Pause, Checkpoints, Neuansetzen und Live-Text.

### Installation und Updates

**Windows x64:** `Checkpoint-Studio-Windows-x64-Setup.exe` herunterladen und ausführen.
**macOS Apple Silicon:** `Checkpoint-Studio-macOS-arm64.dmg` öffnen und die App in Programme ziehen.

Für Updates die neue Version über die vorhandene installieren. Projektordner bleiben separat erhalten. Es gibt noch keinen automatischen Installer in der App.

Diese Entwicklungsbuilds sind nicht signiert bzw. notarisiert. Die genaue Liste der ausgeführten Prüfungen steht in `VALIDATION.md`; daraus folgt keine Zusicherung für ungetestete Betriebssysteme. Die mitgelieferten Drittanbieter-Lizenzen und Hinweise stehen in `THIRD_PARTY.md` und in den App-Ressourcen. Keine offizielle SAP- oder Adobe-Anwendung und keine SAP-Systemanbindung.

Die Spurhöhen bleiben konstant. Zusätzliche Spuren werden ausschliesslich innerhalb des Timeline-Bereichs nach oben/unten gescrollt; die übrige Arbeitsfläche bewegt sich dabei nicht.
