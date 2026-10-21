# ADR 0005 — Editor SQL nativo y servidor de lenguaje
Estado: aceptada (2026-10-20)
- Editor nativo de VS Code con proveedores propios (no Monaco en webview): accesibilidad, atajos, temas y extensiones gratis.
- LSP en proceso hijo (`vscode-languageclient`) con caché de esquema indexada; así el host se mantiene ligero y el completado cumple <100 ms con 5 000 tablas.
- Monaco solo en webviews para celdas JSON/XML si hace falta.
Alternativa descartada: Monaco en webview (duplica funciones, peor accesibilidad).
