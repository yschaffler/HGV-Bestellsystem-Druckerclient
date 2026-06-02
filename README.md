# HGV Bestellsystem – Druckerclient

Windows-Desktop-App die sich mit dem [HGV Bestellsystem](https://github.com/yschaffler/HGV-Bestellsystem) verbindet und eingehende Bestellungen automatisch auf einem Bondrucker ausgibt.

## Features

- Echtzeit-Empfang über WebSocket mit automatischem Reconnect
- ESC/POS RAW-Druck – native Druckerschriften, ~100 ms, gestochen scharf
- Druckerstatus-Überwachung – zeigt live ob der Drucker online ist
- Storno-Unterstützung
- Läuft als Tray-Icon im Hintergrund

## Voraussetzungen

- Windows 10 / 11
- [EPSON Advanced Printer Driver](https://www.epson.de) (für TM-T88V)
- Laufende Instanz des HGV Bestellsystem Backends

## Installation

Den Installer aus den [Releases](../../releases) herunterladen und ausführen.

## Entwicklung

```bash
npm install
npm run dev
```

## Build

```bash
# Windows Developer Mode aktivieren (einmalig, für Symlink-Rechte)
npm run build
```

Der fertige Installer liegt unter `dist/`.

## Technologien

Electron · React · Vite · ESC/POS · lucide-react

---

*Entwickelt von Yannik Schäffler*
