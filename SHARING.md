# Mit Freunden teilen und neue Versionen veröffentlichen

## Empfohlener Weg: GitHub Releases

Ein öffentliches Repository `checkpoint-studio` enthält den Quellcode. Fertige Windows-/Mac-Installer werden als **Release-Dateien** veröffentlicht, nicht in Git eingecheckt.

Der dauerhafte Link ist nach dem ersten Upload:

`https://github.com/xdmqxi/checkpoint-studio/releases/latest`

Unter diesem Link wird immer die neueste veröffentlichte Version angezeigt. Die Download-Dateien haben feste Namen:

- `https://github.com/xdmqxi/checkpoint-studio/releases/latest/download/Checkpoint-Studio-Windows-x64-Setup.exe`
- `https://github.com/xdmqxi/checkpoint-studio/releases/latest/download/Checkpoint-Studio-macOS-arm64.dmg`

Deine Freunde schließen die App, laden den aktuellen Installer und installieren ihn über die bisherige Version. Ihre Projektordner liegen separat und bleiben erhalten. Die aktuelle Anwendung lädt und installiert Updates noch nicht selbständig.

## Künftige Versionen

1. Änderungen vornehmen und lokal mit `npm test`, `npm run build`, `npm run test:editor` und `npm run test:studio` prüfen. Bei Änderungen an der Aufnahme zusätzlich `npm run test:live` auf einem geeigneten Mac ausführen.
2. Versionsnummer in `package.json`, `package-lock.json` und der angezeigten Versionszeile aktualisieren.
3. Änderungen committen und auf `main` pushen.
4. Passenden Tag erstellen und pushen, beispielsweise `git tag v0.6.1` und `git push origin v0.6.1`.
5. `.github/workflows/release.yml` prüft die Version, baut auf Mac/Windows und veröffentlicht die Installer erst, wenn beide Build-Jobs erfolgreich waren. Der erste vollständige Release-Lauf für v0.6.0 ist [erfolgreich](https://github.com/xdmqxi/checkpoint-studio/actions/runs/42205759605): native Mac-/Windows-Tests, beide Installer und Veröffentlichung.

Für den ersten Upload bereits lokal getesteter Installer bereitet `node scripts/prepare-release.cjs` die stabilen Dateinamen und Prüfsummen in `release-upload/` vor. Anschließend können diese Dateien zu einer GitHub-Release hochgeladen werden.

## Automatisches Updaten direkt in der App

Dafür muss später ein Updater in der App ergänzt und mit dem veröffentlichten Repository verbunden werden. Insbesondere unter macOS erfordert Electrons automatischer Updater eine signierte App. Die derzeitigen lokalen Entwicklungsbuilds sind nicht signiert/notarisiert. Die Release-Seite mit manueller Installation ist deshalb der bereits vorbereitete Weg.

## Welche Dateien werden veröffentlicht?

Nur App-Quellcode, eigene Icons, Buildskripte, Tests, Dokumentation und Installer. `node_modules/`, `dist/`, `vendor/`, `test-results/`, Aufnahmen, `.checkpoint`-Projekte, lokale Konfiguration und Schlüssel sind von Git ausgeschlossen. Projektmedien werden nicht ins Repository aufgenommen.
