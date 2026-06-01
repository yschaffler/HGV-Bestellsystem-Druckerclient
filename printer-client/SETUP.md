# Abiball Druckerclient – Setup

## Entwicklung starten

```bash
cd printer-client
npm install
npm run dev
```

## Produktions-Build erstellen (.exe)

```bash
npm run build
```
→ Installer liegt in `dist-electron/` als `.exe`

## Anforderungen

- Node.js 18+ (nur für Build, nicht für Endnutzer nötig)
- Windows 10/11
- Epson TM-T88IV: Windows-Treiber von epson.com installieren
- Epson TM-T88I: USB-Seriell-Adapter-Treiber installieren

## Erste Einrichtung auf Laptop

1. `.exe` Installer ausführen
2. App startet automatisch den Setup-Bildschirm
3. Eintragen:
   - **Server-URL**: `wss://abiball.example.com` (ohne Pfad)
   - **Secret**: vom Backend-Admin erhalten
   - **Bar-Name**: z.B. "Bar 1"
   - **Drucker**: aus Liste wählen
4. Testdruck durchführen
5. „Einrichtung abschließen" klicken
6. App läuft ab jetzt im Hintergrund (Tray-Icon)

## Fehlerdiagnose

| Problem | Lösung |
|---|---|
| Drucker nicht in Liste | Treiber installieren, dann „↺" klicken |
| Verbindung schlägt fehl | URL und Secret prüfen; Server läuft? |
| COM-Port nicht erkannt | Adapter-Treiber prüfen; richtigen Port wählen |
| Testdruck funktioniert nicht | Drucker einschalten, USB-Kabel prüfen |

## Go-Abhängigkeit

Das Backend benötigt gorilla/websocket:

```bash
go get github.com/gorilla/websocket
```
