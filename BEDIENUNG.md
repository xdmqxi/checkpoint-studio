# Checkpoint Studio 0.6.2 – Schnittplatz

Nach dem Stoppen einer Aufnahme öffnet sich der Editor. Er arbeitet nicht-destruktiv: Clips verweisen auf Ausschnitte aus Originaldateien. Löschen eines Timeline-Clips entfernt keine Originaldatei.

## Medien und Vorschau

- **Video importieren** übernimmt MP4, MOV, WEBM, MKV, AVI und M4V. Die App behält die Originaldatei und erzeugt eine MP4-Arbeitskopie mit kompatiblem Video und Ton.
- **Audio importieren** übernimmt WAV, MP3, M4A, FLAC, OGG, AAC, AIFF/AIF, WMA und OPUS. Die App behält das Original und erstellt eine WAV-Arbeitskopie. Ein beschädigtes oder nicht decodierbares Medium führt zu einer Fehlermeldung.
- Importiertes Video wird hinten an V1 angehängt. Importiertes Audio wird am Abspielkopf auf einer freien Audiospur eingefügt. Projektmedien lassen sich durchsuchen. Audio kann dort separat vorgehört und erneut eingefügt werden.
- **Leertaste** oder der Wiedergabeknopf spielt die gesamte Videosequenz ab, über Schnitte und verschiedene Takes hinweg. Die Musik läuft zur Sequenzzeit synchron. Anfang/Ende springen an die Grenzen der Videosequenz. ←/→ geht einen Frame bei 30 fps weiter; mit Umschalt einen Sekunden-Schritt.

## Video schneiden

1. In der Timeline auf einen Video-Clip klicken.
2. Die Clipkanten ziehen oder unten **Start/Ende (Sekunden)** ändern. Weggekürzte Stellen lassen sich bis zu den ursprünglichen Quellgrenzen wieder aufziehen.
3. **Teilen** schneidet am Abspielkopf. Alternativ **C** drücken und mit der Rasierklinge direkt in den Clip klicken. **V** aktiviert wieder das Auswahlwerkzeug.
4. Video-Clips zum Umordnen auf andere Clips ziehen. Ein Take aus den Projektmedien kann auch erneut auf V1 gezogen werden.
5. **Duplizieren** fügt eine Kopie hinter dem Clip ein. **Löschen & nachrücken** schließt die entstandene Videolücke. Musikclips behalten beim Videoschnitt ihre absolute Sequenzposition.
6. Im Eigenschaftenbereich kann der Ton eines Video-Clips leiser gestellt oder stummgeschaltet werden. Der Aufnahmemixer regelt Mikrofon und System-/Videoton für alle Clips.

## Musik und Sprache bearbeiten

- Es werden nur vorhandene Audioquellen angezeigt: Mikrofon und PC-/Videoton, wenn die verwendeten Videoclips diese Quellen enthalten, sowie eine eigene Zeile je importiertem Audio-Clip. Leere Reserve-Spuren gibt es nicht. Überlappende Audioclips werden zusammen gemischt.
- Die Wellenform wird aus echten Audiosamples berechnet. Den Körper eines Audio-Clips horizontal verschieben; jeder importierte Audio-Clip behält seine eigene Zeile. Die Kanten kürzen den Quellausschnitt.
- Mit eingeschaltetem **Einrasten (S)** rasten verschobene Audioclips an Videoschnitten, Checkpoints und dem Abspielkopf ein. **Alt** beim Ziehen umgeht es vorübergehend.
- Nach Auswahl eines Audio-Clips zeigt der Eigenschaftenbereich Position, Quell-Start/-Ende, Lautstärke, Einblenden und Ausblenden. Fades werden in Sekunden eingestellt und in Vorschau sowie Export angewendet.
- **Teilen**, **Duplizieren** und **Audio entfernen** wirken auf den ausgewählten Audio-Clip. Die Rasierklinge funktioniert auch hier. Entfernte Audio-Clips bleiben als Original in den Projektmedien verfügbar.
- **Stummschalten** nimmt den jeweiligen Audio-Clip aus Vorschau und Export.

## Checkpoints, Speichern und Export

- **M** oder **Checkpoint** setzt eine Markierung am Abspielkopf. Markierungen lassen sich benennen, anspringen und entfernen. Sie bleiben an ihren Video-Quellstellen verankert, wenn Videoclips umgeordnet oder gekürzt werden.
- Änderungen werden automatisch im geöffneten Projektordner gespeichert. Für einen anderen Rechner den ganzen Projektordner einschließlich `media/` kopieren.
- **⌘/Strg+Z**: Rückgängig; **⌘/Strg+Umschalt+Z** bzw. **⌘/Strg+Y**: Wiederholen; **⌘/Strg+D**: Duplizieren; **⌘/Strg+K**: Teilen; **Entf/Backspace**: ausgewählten Clip entfernen.
- **MP4 exportieren** öffnet Einstellungen für 720p/1080p, 30/60 fps und Standard/hohe Qualität. Die Ausgabe enthält die gesamte Videosequenz mit allen aktiven Audiospuren und Fades. Der Export zeigt den Fortschritt an. Audioclips nach dem Videoende werden abgeschnitten; sie verlängern die Videosequenz nicht.

## Umfang

Ein Schnittplatz im Stil professioneller Videoeditoren mit eigenem dunklem SAP-Workflow-Design. Enthalten sind eine Videospur und dynamische Audiobereiche, keine übereinanderliegenden Videospuren, Videoübergänge, Farbkorrektur, Untertitel- oder KI-Funktionen. Die Aufnahme enthält Bildschirm und optional Mikrofon; Systemton-Aufnahme bleibt in dieser Version deaktiviert. Importierter Videoton wird unterstützt. Eine Windows-x64-Version wird gebaut. Editor, Audioimporte und Export sind auf einem Windows-Runner geprüft; echte Windows-Bildschirm-/Mikrofonaufnahme bleibt gesondert zu prüfen.

## Fenster und Programm-Updates

Der Editor teilt die verfügbare Fensterhöhe zwischen Vorschau und Timeline auf; alle Spuren bleiben auf der Arbeitsfläche sichtbar. Bei langen Medienlisten und Eigenschaften bleibt die Navigation im jeweiligen Panel.

Windows: Im Installations-Wizard wird eine erkannte Vorgängerversion angezeigt. Die neue Installation ersetzt die vorherigen Programmdateien; Einstellungen und extern gespeicherte Projektordner bleiben erhalten. Auf dem Mac die App erneut in Programme ziehen und die vorhandene App ersetzen. Bereits heruntergeladene EXE-/DMG-Dateien im Downloads-Ordner werden nicht automatisch gelöscht.

Die X-Taste an der Mikrofon-/PC-Zeile entfernt diese Quelle aus der Sequenz und dem Export. Die Originaldateien bleiben erhalten. Im Aufnahmemixer kann sie wieder hinzugefügt werden. Beim Entfernen eines importierten Audio-Clips verschwindet dessen komplette Zeile; die Originaldatei bleibt in den Projektmedien.
