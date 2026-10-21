# Primeros pasos

Esta página te lleva de cero a editar un valor en una tabla. El mismo recorrido está dentro de la extensión: ejecuta **RizomaDB: Abrir la guía** (el icono del libro en la vista de conexiones) y te guía paso a paso, con botones que hacen cada paso por ti.

## 1. Instalar
RizomaDB aún no está publicado en ningún marketplace. Construye la extensión e instala el archivo:

```bash
pnpm install
pnpm --filter rizomadb package          # crea apps/extension/rizomadb-<versión>.vsix
code --install-extension apps/extension/rizomadb-0.0.1.vsix
```

También se instala en VSCodium, Cursor y Windsurf (con su propio `--install-extension`). Recarga la ventana después.

## 2. Crear una conexión
1. Haz clic en el icono de RizomaDB de la barra de actividad y luego en el botón **+** (o ejecuta **RizomaDB: Nueva conexión**).
2. Elige tu motor por su logo. Usa el buscador si la lista es larga.
3. El formulario ya trae los valores habituales de ese motor (host `localhost`, el puerto por defecto, el usuario típico). Cambia solo lo que difiera y agrega la contraseña.
4. Elige el **entorno**: `dev`, `staging`, `prod` o **Nuevo entorno…** para uno propio (por ejemplo `qa`). Producción pregunta antes de escribir; mira [Conexiones](conexiones.md).
5. **Probar conexión** comprueba sin guardar. **Guardar conexión** la almacena. Si no puede conectar, aún puedes elegir **Guardar sin conectar**.

## 3. Explorar
El árbol de conexiones las agrupa por tipo (relacional, documentos, clave-valor…) y muestra el logo de cada motor. Expande una para ver sus tablas (o colecciones, claves, índices…) y vistas. La barra de estado inferior muestra la conexión en uso y su base de datos.

## 4. Abrir una tabla
Haz clic en una tabla. Las filas se abren en la mitad inferior de la ventana. Las pestañas sobre la rejilla muestran **Datos**, **Propiedades** (columnas, tipos, índices), **Relaciones** (claves foráneas en ambos sentidos) y **DDL** (el script CREATE). Mira [La rejilla de resultados](rejilla-de-resultados.md).

## 5. Ejecutar una consulta
Ejecuta **RizomaDB: Nueva consulta**, escribe una sentencia y pulsa **Ctrl+Enter** (⌘+Enter en Mac). Cada sentencia también tiene un botón **Ejecutar** encima. Mira [El editor de consultas](editor-de-consultas.md).

## 6. Editar un valor
En una tabla con clave primaria, haz doble clic en una celda (o pulsa Enter o F2), escribe y pulsa Enter. El cambio queda como *cambio pendiente*: revisa el SQL y pulsa **Aplicar**. Producción y staging piden confirmación antes. Mira [Edición de datos](edicion-de-datos.md).

## 7. Hazlo tuyo
Ejecuta **RizomaDB: Abrir configuración** para la pantalla de ajustes: idioma, dónde se abren los resultados, filas por página, entornos y más. Mira [Idioma y ajustes](idioma-y-ajustes.md).

## Conviene saber
- No se envía nada a ningún sitio. No hay telemetría ni cuentas. Las contraseñas y tokens viven en el almacén de secretos de VS Code, nunca en un archivo de configuración.
- Si algo no funciona como esperas, mira [Solución de problemas](solucion-de-problemas.md).
