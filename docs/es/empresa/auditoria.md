# Registro de auditoría

Cada sentencia ejecutada mediante RizomaDB se añade a un archivo JSONL local (por defecto, la carpeta de almacenamiento de la extensión; `rizomadb.audit.path` lo cambia). No se envía nada a ningún lado.

Campos: `ts`, `user` (usuario del sistema operativo), `connection`, `environment`, `engine`, `kind` (SELECT/UPDATE/…), `statement`, `status` (`ok`, `error`, `blocked`, `cancelled`), `rows`, `durationMs`, `detail`.

* **Sin datos por defecto:** los literales de texto, numéricos y hexadecimales se sustituyen por `?` (`rizomadb.audit.includeValues` los conserva). Las sentencias bloqueadas por la política también se registran.
* **Rotación:** al llegar a 5 MB el archivo se renombra `audit-<marca de tiempo>.jsonl`; se conservan los últimos 5.
* **Visor:** *RizomaDB: Open Audit Log* (filtra todo / bloqueadas / errores / correctas). *Export Audit Log…* escribe un archivo JSONL para tu SIEM.
* El archivo se crea con modo 0600. Es evidencia local, no es a prueba de manipulación: reenvíalo a un sistema de confianza si lo necesitas.
