<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Guía de diseño

[English](../../design/design-guide.md)

Cómo se ven y se comportan las pantallas de RizomaDB. Describe lo que hace el código hoy; cuando cambies una pantalla, cambia también esta página. Para agentes: esta es la lista a seguir antes de añadir interfaz.

## Principios
1. **Mínimo y calmado.** Pocos colores, espaciado generoso, esquinas redondeadas, ninguna decoración que no aporte información.
2. **Primero iconos, con etiqueta.** Los controles son iconos; cada icono tiene un nombre accesible y un tooltip al pasar el ratón y al recibir el foco del teclado. Los botones de texto son para la única acción principal de una pantalla.
3. **El tema del usuario es la paleta.** Los colores salen de las variables del tema de VS Code (`--vscode-*`), así que claro, oscuro y alto contraste funcionan sin código extra.
4. **Todo es una pantalla.** Conexiones, ajustes, historial, la guía y los resultados son pantallas completas de webview, no pilas de quick-picks. Los quick-picks y los cuadros de entrada son solo para preguntas puntuales.
5. **Di qué pasó, en el idioma de la persona.** Los estados y errores son frases sencillas, traducidas, nunca solo color.
6. **Seguro por defecto.** Todo lo que escribe muestra la sentencia exacta y pregunta, en proporción al riesgo del entorno.

## Tokens (`apps/extension/src/ui/webview/webview.css`)
| Token | Significado | Valor |
|---|---|---|
| `--rz-radius` | radio base de las esquinas | 8px; tarjetas 12–18px, chips y campos 999px, botones 6–8px |
| `--rz-border` | líneas finas | `--vscode-panel-border` |
| `--rz-surface` | tarjetas, barras, cabeceras | `--vscode-editorWidget-background` |
| `--rz-muted` | texto secundario | `--vscode-descriptionForeground` |
| foco | cualquier elemento enfocable | `2px solid --vscode-focusBorder`, desplazamiento 1–2px; nunca se quita |

El espaciado son múltiplos de 2: las barras usan 6–8px de relleno vertical y 12–14px horizontal; las tarjetas 18–24px; las rejillas 10–22px de separación. La tipografía es la del editor/interfaz de VS Code; los títulos tienen peso 600–700; el código usa `--vscode-editor-font-family`.

## Piezas (`src/ui/webview/ui.ts`)
| Pieza | Uso |
|---|---|
| `el(tag, attrs, text)` | Construir DOM con seguridad (sin `innerHTML`) |
| `icon(name)` / `ICONS` | Iconos de línea propios en una cuadrícula de 24px, `currentColor`; añade los nuevos a `icons.ts` |
| `iconButton(icon, label, onClick, {text, primary, danger, pressed})` | La única forma de hacer un botón. La etiqueta es el tooltip; con texto visible, el texto es el nombre accesible |
| `openMenu(anchor, items)` | Menú emergente: flechas, Inicio/Fin, Enter, Esc; el foco vuelve a quien lo abrió |
| `enableTips()` | Tooltips que se quedan en pantalla y se cierran con Esc (WCAG 1.4.13) |
| `engineLogo(engine, size)` | Marca del motor sin recuadro; los colores sólidos se adaptan a claro/oscuro; si falta, un monograma |
| `.chip`, `.tb` (barra de herramientas), `.field-icon`, `.card2`, `.tab`, `.toast`, `.dialog` | Clases CSS compartidas |

## Patrones de composición
- **Pantalla**: barra superior (título, chip de estado, herramientas), contenido en una columna centrada (máx. 820–1100px) o mosaico de tarjetas (ajustes).
- **Resultados**: cabecera → pestañas (píldoras) → línea de consulta → barra de filtro → barra de herramientas → barra de edición → rejilla → pie. Las barras se parten en líneas en vez de desbordar.
- **Tarjetas**: recuadros de motores en una rejilla que se rellena sola (mín. 190px); tarjetas de conexión con logo, insignias y acciones; tarjetas de ajuste con cabecera, una línea de acento de 2px y un botón de restablecer.
- **Pestañas** son píldoras redondeadas, `role=tablist`; las flechas se mueven entre ellas.
- **El scroll de la página está desactivado** dentro de los resultados; solo se desplaza la rejilla.

## Color y estado
- Seleccionado / activo: borde de acento o tinte de `--vscode-focusBorder` más una pista de texto o icono (● Activa), nunca solo color.
- Chips de entorno: `prod` con borde rojo, `staging` con borde ámbar; el texto siempre dice el nombre.
- Cambio pendiente: subrayado amarillento en la celda; fila eliminada tachada; fila insertada con tinte.
- Booleanos ✓/✗ con color; NULL y DEFAULT en cursiva y atenuados, pero al menos 4,5:1.
- Las acciones destructivas usan el color de error y se confirman.

## Logos
Las marcas de los motores vienen de conjuntos de iconos CC0/MIT mediante `scripts/gen-logos.mjs`, dibujadas **sin recuadro**, de 16px en árboles y pestañas y 40px en tarjetas. Identifican el producto; no las recolorees más allá de la adaptación a claro/oscuro y no las uses de ninguna forma que sugiera aval.

## Accesibilidad (obligatoria)
- WCAG 2.2 AA: contraste ≥ 4,5:1 para el texto, 3:1 para la interfaz; destinos alcanzables con el teclado en un orden lógico; `prefers-reduced-motion` desactiva las transiciones.
- Regiones: exactamente un `main` por página; las barras de herramientas tienen `role=toolbar` y una etiqueta; las rejillas usan `role=grid` con `aria-rowcount/colcount`; el estado de orden en `aria-sort`; los cambios en vivo se anuncian en una región `aria-live` educada.
- Los controles solo de icono deben tener `aria-label`. Los marcadores de posición no son etiquetas.
- Verifica con axe en ambos temas (`test/a11y`) y haz una pasada manual con lector de pantalla tras cambios grandes de interfaz (la última no encontró problemas en macOS, Windows y Linux).

## Redacción
- Mayúscula solo al inicio, sin punto final en las etiquetas, una idea por frase. Di lo que hace un control («Ejecutar esta sentencia»), no lo que es.
- Los números usan la configuración regional; los tiempos muestran unidades («12 ms»).
- Cada texto tiene una fuente en inglés y una traducción al español; conserva los marcadores (`{0}`).
- Sé honesto con los límites: di «no soportado» o «experimental» en vez de esconderlo.

## Añadir una pantalla: lista de comprobación
1. Script de webview en `src/ui/webview/<nombre>.ts` (+ entrada en `esbuild.mjs`), host en `src/ui/<nombre>Panel.ts` con CSP, nonce y `localResourceRoots`.
2. Esquemas de mensajes en `src/<nombre>Messages.ts`, validados en ambos extremos.
3. Usa `iconButton`/`openMenu`/los tokens de arriba; sin colores nuevos.
4. Textos en `webviewStrings.ts` y en el paquete en español; comando en `package.json` + ambos archivos nls.
5. Página de prueba en `test/a11y`, axe limpio en ambos temas, captura revisada.
6. Documéntala en las guías de usuario (en y es) y regenera las referencias.
