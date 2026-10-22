# Marca RizomaDB

[English](README.md) · Español

**Significado.** Un cilindro de base de datos del que brotan raíces (rizoma) hacia tres nodos: muchas bases de datos conectadas sin jerarquía. El nodo ámbar marca el "punto de origen" de la conexión.

**Concepto elegido** (de 3 evaluados): (1) cilindro con raíces, elegido por leerse como "base de datos" y "red" a 16 px; (2) red de nodos pura, descartado por parecer un grafo genérico; (3) monograma "R", descartado por no comunicar el concepto.

## Archivos
Todos se generan con `pnpm build:brand` (`scripts/build-brand.mjs`); no se editan a mano.
`logo-mark.svg`, `logo-mark-mono.svg`, `logo-horizontal-light.svg`, `logo-horizontal-dark.svg`, `favicon.svg`, `icon-128.png`, `icon-256.png`, `social-preview-1280x640.png`.
La hoja de legibilidad (16/32/64/128 px sobre claro y oscuro) se genera en `_proof/` y no se publica.

## Paleta y contraste (verificado por script en cada build)
Navy `#0F172A`, menta `#34D399`, blanco `#FFFFFF`, ámbar `#FBBF24`. Ver [_contrast.md](_contrast.md): gráficos ≥ 3:1, texto ≥ 4.5:1; el build falla si no se cumple.

## Tipografía
Wordmark en **Inter Bold** (licencia SIL OFL 1.1), convertido a trazados: los SVG no dependen de fuentes.

## Uso
- Espacio libre: al menos 1/4 del ancho del símbolo en todos los lados.
- Tamaño mínimo: símbolo 16 px; logotipo horizontal 96 px de ancho de texto.
- No: recolorear fuera de la paleta, estirar, rotar, añadir sombras, separar "Rizoma" y "DB" ni escribirlo en minúsculas ("RizomaDB" siempre).
- Licencia de los recursos: Apache-2.0, como el proyecto.

## Social preview
Subir `social-preview-1280x640.png` en GitHub → Settings → General → Social preview.
