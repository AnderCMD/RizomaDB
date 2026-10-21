# Edición de datos

## Qué se puede editar
Un resultado es editable cuando viene de **abrir una tabla** cuyas filas RizomaDB sabe identificar:

| Motor | Las filas se identifican por |
|---|---|
| SQLite, PostgreSQL, MySQL/MariaDB, SQL Server, Oracle, DuckDB | la clave primaria |
| MongoDB | el `_id` del documento |

Las vistas, las consultas personalizadas, las líneas de consulta que editaste, las columnas enmascaradas, las conexiones de solo lectura y las tablas sin clave primaria **no** son editables; al intentarlo, la rejilla te dice por qué. Cualquier otro motor, incluidas las claves de Redis y Valkey, es de solo lectura en la rejilla (Redis tiene sus propios comandos para eliminar, renombrar y poner caducidad a las claves).

## Cómo
1. Haz **doble clic** en una celda (o selecciónala y pulsa **Enter** o **F2**, o usa el botón del lápiz). Se abre un cuadro con el valor.
2. Escribe y pulsa **Enter** para conservar, **Esc** para cancelar. **Supr** pone NULL; el menú de clic derecho tiene *Poner NULL* y *Poner texto vacío*.
3. **Agregar fila** añade una fila; las celdas sin definir muestran `DEFAULT`. El botón de la papelera marca las filas seleccionadas para eliminar (y las restaura). Deshacer (Ctrl/⌘+Z) descarta las filas agregadas.
4. La barra de edición cuenta los **cambios pendientes**. Las celdas editadas se resaltan y las filas eliminadas se tachan.

Los valores se comprueban contra el tipo de la columna al escribir: una columna entera rechaza `abc`, las columnas JSON deben tener JSON válido y las binarias no se pueden editar aquí.

## Revisar y aplicar
- **Revisar el SQL** abre las sentencias exactas que se ejecutarían (con sus parámetros), sin ejecutarlas.
- **Aplicar** envía todos los cambios **en una sola transacción** en los motores que tienen transacciones. En los que no (por ejemplo MongoDB) los cambios se aplican uno a uno, y el mensaje dice cuántos ya estaban aplicados si uno falla.
- Producción y staging piden confirmación antes de aplicar; `requireApproval` te pide escribir el nombre de la conexión. Las políticas, las conexiones de solo lectura y el registro de auditoría se aplican igual que en el editor.
- **Detección de conflictos.** Cada cambio comprueba que la fila aún tenga los valores que viste; si alguien más la cambió o la eliminó, no se aplica nada y se te avisa.
- **Descartar** tira todo lo pendiente.

## Guardar cada edición al instante
Activa `rizomadb.edit.applyImmediately` si no quieres un paso Aplicar aparte. Cada edición se aplica en cuanto la confirmas. Solo las conexiones `dev` omiten la pregunta; los demás entornos siguen preguntando, y las políticas y el solo lectura siempre se respetan. Desactivado por defecto.

## Cambiar la estructura
Renombrar, cambiar el tipo o eliminar una columna está en el menú de la columna (mira [La rejilla de resultados](rejilla-de-resultados.md#trabajar-con-columnas)). Las tablas nuevas y los cambios mayores usan **Diseñar tabla**, con una vista previa del DDL antes de ejecutar nada.
