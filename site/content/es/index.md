---
layout: home
hero:
  name: RizomaDB
  text: Todas tus bases de datos, un solo lugar.
  tagline: Un cliente de bases de datos gratuito, de código abierto y sin telemetría para VS Code. 24 motores, una rejilla de resultados, seguro por defecto.
  image: { src: /logo.svg, alt: RizomaDB }
  actions:
    - { theme: brand, text: Primeros pasos, link: /es/guias/primeros-pasos }
    - { theme: alt, text: Motores, link: /es/referencia/matriz-de-motores }
    - { theme: alt, text: GitHub, link: "https://github.com/AnderCMD/RizomaDB" }
features:
  - { icon: "🔌", title: "Conecta desde una pantalla de logos", details: "Elige tu motor; el host, puerto y usuario ya vienen rellenados. Entornos con protección, túneles SSH, proxies y secretos solo en el almacén de VS Code.", link: /es/guias/conexiones }
  - { icon: "▶️", title: "Un botón Ejecutar sobre cada sentencia", details: "Ejecutar, Explicar, Ejecutar todo, parámetros, historial con buscador y notebooks, en el lenguaje de cada motor.", link: /es/guias/editor-de-consultas }
  - { icon: "🗂️", title: "Una rejilla hecha para explorar", details: "Ordena, filtra en las filas o en la base de datos, cambia anchos, oculta, panel de registro, copia como CSV/JSON/Markdown y Cargar más en todos los motores.", link: /es/guias/rejilla-de-resultados }
  - { icon: "✏️", title: "Edita en el sitio, con seguridad", details: "Doble clic en una celda. Los cambios esperan como pendientes; revisa el SQL y aplícalos en una transacción, con detección de conflictos.", link: /es/guias/edicion-de-datos }
  - { icon: "🛡️", title: "Seguro por defecto", details: "Políticas en capas donde gana la más estricta, un único punto de auditoría para toda escritura, producción de solo lectura, enmascarado de columnas.", link: /es/empresa/politicas }
  - { icon: "🌍", title: "Cuatro idiomas", details: "Español, inglés, portugués (Brasil) y francés. Cambia el idioma dentro de la extensión y sigue la guía integrada que te lleva de la mano.", link: /es/guias/idioma-y-ajustes }
---

::: warning Pre-lanzamiento
RizomaDB aún no está publicado en ningún marketplace y la v1.0 no está lista. La [lista de aceptación](/es/release/v1-checklist) y la [comparación honesta](/es/mercado/comparacion-honesta) dicen exactamente qué está y qué no está verificado.

**Los servicios en la nube no están confirmados.** RizomaDB solo se ha probado con motores locales y emuladores oficiales, nunca con una cuenta real en la nube (AWS, Google Cloud, MongoDB Atlas, PostgreSQL/MySQL gestionados). Pruébalo con un usuario de solo lectura o una base de datos desechable antes de depender de él: ver [Nube y servicios gestionados](/es/motores/#nube-y-servicios-gestionados-sin-confirmar).
:::

## Por dónde empezar
- Si eres nuevo: [Primeros pasos](/es/guias/primeros-pasos) y luego [Conexiones](/es/guias/conexiones).
- Si buscas un motor: la [matriz de capacidades](/es/referencia/matriz-de-motores) y las [páginas de motores](/es/motores/README).
- Si lo vas a desplegar en un equipo: [Políticas](/es/empresa/politicas), [Despliegue](/es/empresa/despliegue) y [Cumplimiento](/es/empresa/cumplimiento).
- Si algo falla: [Solución de problemas](/es/guias/solucion-de-problemas).
