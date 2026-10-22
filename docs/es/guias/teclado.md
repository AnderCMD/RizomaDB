# Usar RizomaDB con el teclado

RizomaDB está pensado para usarse sin ratón. Si encuentras algo que lo necesite, es un error: por favor repórtalo.

## Moverse
- **Tab / Shift+Tab** mueven entre los controles de cada pantalla (Nueva conexión, Ajustes, Historial, la guía, la rejilla de resultados, el diseñador de tablas, el diagrama ER y el visor de planes). Cada pantalla es un único grupo de paradas de tabulación; en una prueba de 40 pulsaciones de Tab en la pantalla de Historial el foco nunca se quedó atascado.
- Un anillo visible indica siempre dónde estás. Los botones que solo tienen un icono tienen un nombre que leen los lectores de pantalla y un tooltip que también aparece cuando el botón recibe el foco del teclado.
- En las listas que se comportan como un árbol (el plan de ejecución, el explorador) Tab entra en la lista una vez y las **flechas** se mueven dentro.

## En el editor
| Teclas | Qué hace |
|---|---|
| Ctrl/⌘ + Enter | Ejecuta la sentencia bajo el cursor |
| Ctrl/⌘ + Shift + Enter | Ejecuta la selección |

## En la rejilla de resultados
Las teclas para moverse entre celdas, seleccionar filas, editar, deshacer y copiar están en [La rejilla de resultados](rejilla-de-resultados.md). El botón de teclado de la barra de la rejilla las muestra dentro de la aplicación.

## Cómo se comprobó
- Una auditoría automática (`test/a11y/keyboard.js`) se ejecuta en cada pantalla con los temas claro y oscuro: todo control que puede recibir el foco tiene nombre y un anillo de foco visible, no hay `tabindex` positivo y nada que parezca pulsable queda fuera del orden de tabulación. Encontró un problema real (los cuadros de búsqueda solo cambiaban 1 px de borde al recibir el foco), ya corregido. axe-core no reporta violaciones en las mismas pantallas.
- El responsable del proyecto recorrió las pantallas con un lector de pantalla en macOS, Windows y Linux sin encontrar problemas.
- No hecho: una auditoría de accesibilidad independiente. Si algo es difícil de alcanzar con el teclado, abre un issue.
