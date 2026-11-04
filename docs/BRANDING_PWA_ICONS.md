# Branding und PWA-Symbole

`brand-mark.svg` ist die maßgebliche Logoquelle. `scripts/generate-brand-assets.py` generiert daraus `brand-icon-192.png`, `brand-icon-512.png` und die Open-Graph-Grafik `brand-social-preview.png`.

Cloud nutzt weiterhin `cloud-manifest.webmanifest` (Start `cloud-app.html`), die Offline-PWA nutzt `manifest.webmanifest` (Start `./`). Die alte Offline-Service-Worker-Cache-ID bleibt bewusst stabil; der aktualisierte Installationsdurchlauf lädt die neuen Bilddateien und das Manifest in denselben Cache. Der markenübergreifende Wechsel ändert keine Installationsidentität, Accountdaten oder Clanplanung. Bestehende Startbildschirm-Icons werden vom Betriebssystem teilweise dauerhaft zwischengespeichert und müssen dann bewusst entfernt und neu hinzugefügt werden. Geteilte Linkvorschauen können ebenfalls bei Messengern gecacht sein.

Nach jeder Logoänderung: Generator ausführen, Bildmaße und Verweise testen, dann Cloud- und Offline-Installation auf iOS/Android sowie Linkvorschauen real prüfen.
