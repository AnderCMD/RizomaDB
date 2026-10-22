<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Ayuda a probar RizomaDB

RizomaDB se ha probado con motores locales, contenedores y emuladores oficiales, por una sola persona. **No** se ha probado con cuentas reales en la nube ni por mucha gente en muchos sistemas, y ahí es donde más probablemente se esconden los errores. Si puedes probar algo de lo siguiente, un reporte breve es muy valioso, **funcione o no**.

## Lo más útil
1. **Nube y servicios gestionados**: Amazon DynamoDB en AWS, Google Cloud Firestore, MongoDB Atlas y PostgreSQL/MySQL gestionados (RDS, Aurora, Cloud SQL, Azure Database, Neon, Supabase, PlanetScale). Ver [Nube y servicios gestionados](../motores/README.md#nube-y-servicios-gestionados-sin-confirmar).
2. **Otros sistemas operativos y lectores de pantalla**: Windows y Linux con NVDA, JAWS u Orca; un recorrido solo con teclado por las pantallas ([Usar el teclado](teclado.md)).
3. **Tus propias bases de datos**: tablas más grandes, tipos de columna raros, redes lentas, túneles SSH y proxies.

## Cómo probar con seguridad
- Usa un **usuario de solo lectura** o una base de datos desechable. Activa primero el interruptor de solo lectura de la conexión.
- Recorre los pasos del formulario de reporte: conectar, explorar, ejecutar una consulta, cargar más, ordenar y filtrar. Edita datos solo en una tabla que puedas perder.
- RizomaDB no envía nada a ningún sitio: no hay telemetría. Un reporte solo existe si lo escribes tú.

## Cómo reportar
Abre un issue **Test report** en GitHub (el formulario lista los pasos para marcar). Indica el motor y la versión, dónde corre, tu sistema, qué funcionó y, si falló, el mensaje exacto. **Nunca pegues contraseñas, tokens, claves ni datos privados.** El canal de salida *RizomaDB policy* y la barra de estado muestran qué bloqueó una acción.

Un reporte que dice «funciona» es tan útil como un error: es la única forma de que un servicio pase de «sin confirmar» a «probado».
