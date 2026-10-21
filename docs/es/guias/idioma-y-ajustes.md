# Idioma y ajustes

## La pantalla de ajustes
**RizomaDB: Abrir configuración** (el engranaje de la vista de conexiones) muestra cada ajuste como una tarjeta con un botón de restablecer por tarjeta, un buscador y **Restablecer todo**. Los cambios se guardan en tu configuración de usuario al hacerlos. La lista completa con sus valores por defecto está en la [Referencia de ajustes](../referencia/ajustes.md); los grupos más interesantes son:

| Grupo | Qué puedes cambiar |
|---|---|
| Idioma | El idioma de la extensión (mira abajo) |
| Resultados | Dónde se abren los resultados (mitad inferior, toda el área, al lado) |
| Entornos | Entornos adicionales y su protección |
| Consultas | Filas por página, máximo de filas, tiempo límite |
| Editor de consultas | Lentes de ejecutar y resaltado de la sentencia |
| Edición | Guardar cada edición al instante |
| Árbol de conexiones | Agrupar conexiones por tipo de motor |
| Seguridad | Confirmaciones, producción de solo lectura |
| Historial, Auditoría, MCP, IA | Retención y qué se registra, el servidor MCP de solo lectura opcional, el asistente de IA opcional |

## Idioma
RizomaDB habla **inglés y español**. Por defecto sigue el idioma de VS Code. Para cambiar solo la extensión, pon `rizomadb.language` en `en` o `es`; las pantallas que ya tienes abiertas conservan el idioma anterior hasta que las reabras.

Los nombres de comandos, de ajustes y los títulos de vistas se entregan a VS Code por su propio mecanismo, así que siempre siguen el idioma de **VS Code**. La pantalla de ajustes tiene un botón que abre el selector de idioma de VS Code. Los mensajes del servidor de la base de datos (por ejemplo un error de sintaxis) se muestran como los escribió el servidor; los mensajes que escribe RizomaDB se traducen.

## La guía
**RizomaDB: Abrir la guía** abre un recorrido paso a paso con botones que hacen cada paso por ti. También aparece una vez, la primera vez que corre la extensión. Hay un recorrido *Empieza con RizomaDB* equivalente en la página de bienvenida de VS Code.
