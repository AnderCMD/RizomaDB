# ADR 0013 — Política en capas y conexión protegida
Estado: aceptada (2026-10-21)
Decisión: toda característica recibe una `Connection` envuelta por `guardConnection`, que aplica una única función de decisión (`decideEffective`) y registra la auditoría. Las capas de política se combinan con "gana la más estricta" (OR de restricciones, mínimo de límites, unión de denegaciones, intersección de permitidos), de modo que ninguna capa inferior puede relajar una superior. Un archivo ilegible deja todo en solo lectura.
Alternativas descartadas: comprobar la política en cada comando (propenso a olvidos: ya había rutas de escritura sin comprobar), o delegarlo solo a permisos de base de datos (no disponible en todos los motores).
Consecuencia: la clasificación de sentencias es estática y por defecto-denegar; no ve efectos secundarios de funciones. Se documenta y se recomienda un usuario de solo lectura para garantías duras.
