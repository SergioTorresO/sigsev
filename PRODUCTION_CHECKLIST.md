# SIGSEV — Checklist para producción

Basado en la auditoría completa del proyecto (backend, frontend, base de datos). Ordenado por prioridad.

## Crítico — antes de exponer a usuarios reales

- [x] Rotar la credencial admin (`Sato@gmail.com` / `checho2002`) que quedó en el historial de Git del README — confirmado que ya no es válida en la base real.
- [x] Revalidar `is_active` del usuario en cada request (no solo la firma del JWT) — `auth.middleware.ts` ahora consulta `is_active` en Supabase en cada request y corta con 401 si el usuario fue desactivado.
- [x] Arreglar la navegación en móvil/tablet — el Sidebar ahora muestra una barra superior (<1024px) con botón de menú que abre un drawer a pantalla completa con las mismas opciones, sin depender de hover.
- [x] Interceptor global de 401 en `frontend/src/lib/api.ts` — limpia la sesión (localStorage + cookie) y redirige a `/login?expired=1` con aviso visible cuando el JWT expira o el usuario es desactivado.

## Alto

- [x] Definir script de build/start de producción en `backend/package.json` (hoy solo existe `dev` con `ts-node-dev`; falta `build` con `tsc` + `start` con `node dist/...`).
- [x] Agregar transacción real (función RPC de Postgres) o al menos verificación/log de error en el paso de actualizar `signals.status` dentro de `createInspection` — ahora usa la función RPC `create_inspection_with_signal_update`, que inserta la inspección y actualiza el estado de la señal en una sola transacción atómica de Postgres.
- [x] Tests automatizados mínimos sobre lo más riesgoso: permisos por rol (`requireRole`), carga masiva todo-o-nada (signals/zones), login/auth — ver `backend/src/middlewares/requireRole.middleware.test.ts`, `backend/src/modules/auth/auth.service.test.ts` y `backend/src/modules/signals/signals.service.bulkImport.test.ts`. Nota: no se pudo ejecutar `npm test` en este entorno (limitaciones del sandbox con `node_modules`); se verificó la lógica manualmente contra el código real — correr `cd backend && npm install && npm test` localmente para confirmar.
- [x] Corregir la búsqueda de señales para que filtre en el servidor (como ya hacen zonas/usuarios), no solo la página actual cargada en el cliente — `getSignals` ahora acepta `search` y filtra con `.or()` ilike sobre `signal_code`/`address`, con debounce en el frontend.
- [x] Agregar confirmación antes de acciones irreversibles que hoy no la tienen: desactivar señal, marcar mantenimiento como completado — `window.confirm(...)` antes de desactivar (en la lista y en el detalle de señal) y antes de cambiar un mantenimiento a `COMPLETADO`.
- [x] Definir políticas RLS mínimas en Supabase (hoy todas las tablas tienen RLS activado pero sin políticas — funciona porque el backend usa `service_role_key`, pero queda "desnudo" si algo en el futuro expone la `anon key` directamente al cliente) — se agregó una política explícita `deny_all_anon_authenticated` (`USING (false)`) en las 13 tablas de `public` para los roles `anon`/`authenticated`; el backend sigue funcionando sin cambios porque `service_role` ignora RLS. `spatial_ref_sys` queda como excepción documentada (la posee la extensión `postgis`, no se puede alterar).

## Medio

- [x] Healthcheck endpoint (`/health`) que verifique conectividad real a Supabase — hace un `select` mínimo contra `roles` y responde 503 si Supabase no contesta.
- [x] Graceful shutdown (`SIGTERM`/`SIGINT`) para no cortar requests en curso al desplegar — `server.close()` + timeout de seguridad de 10s en `server.ts`.
- [x] Logging estructurado (pino/winston) con request-id, en vez de `console.log`/`console.error` — `pino-http` con `genReqId` y header `X-Request-Id` por respuesta.
- [x] Paginar/limitar las queries de `dashboard.service.ts` y `reports.service.ts`, que hoy cargan tablas completas en memoria — dashboard usa `count: 'exact', head: true` (no descarga filas); reports pagina internamente con `.range()` en lotes de 1000.
- [x] Agregar índices a las 11 foreign keys sin índice detectadas por Supabase (signals, inspections, maintenances, notifications, etc.) antes de que crezca el volumen de datos — confirmado vía advisor de performance de Supabase: ya no aparece ninguna alerta de FK sin índice, solo quedan índices "unused" de baja prioridad (ver sección Bajo).
- [x] Unificar manejo de errores en frontend: hoy se mezcla `alert()` nativo con paneles inline; definir un solo patrón (idealmente toasts) — `ToastContext.tsx` + `providers.tsx`, adoptado en señales, mis-asignaciones, usuarios y registro.
- [ ] Verificación de dominio personalizado para envío de correos en producción (Resend) — pendiente histórico ya documentado en CLAUDE.md.

## Bajo

- [x] Extraer a helpers compartidos la lógica de bulk-import duplicada entre `signals` y `zones` (`normalizeHeader`, `BulkImportError`, middleware de `multer`) — todo vive ahora en `backend/src/lib/bulkImport.ts` (ver CLAUDE.md, decisión 18); `signals.service.ts` re-exporta `BulkImportError` para no romper el test existente.
- [x] Componentizar los patrones repetidos de modal/paginación del frontend (hoy copiados casi textual en cada página) en `<Modal>`/`<Pagination>` reutilizables — `frontend/src/components/Modal.tsx` (overlay + panel + ARIA, usa `useModalA11y` internamente) y `frontend/src/components/Pagination.tsx` ("Página X de Y" + Anterior/Siguiente), adoptados en las 7 páginas con modales/paginación: `signals`, `zonas`, `inspections`, `maintenances`, `mis-asignaciones`, `admin/users`, `admin/audit`. La componentización de `<Table>` se evaluó y se descartó deliberadamente: los esquemas de columnas difieren demasiado entre páginas para una abstracción que no termine siendo más compleja que el HTML que reemplaza.
- [x] Accesibilidad básica: enlazar `<label htmlFor>` con sus inputs, agregar ARIA donde falte, focus trap + cierre con `Escape` en modales — `useModalA11y` (hook en `frontend/src/hooks/useModalA11y.ts`) centraliza foco inicial/restauración, focus trap con Tab y cierre con Escape; ahora vive encapsulado dentro de `<Modal>` en vez de llamarse por separado en cada página.
- [x] Eliminar los índices nunca usados detectados por Supabase o confirmar que se usarán pronto — se confirma su uso futuro en vez de eliminarlos (ver CLAUDE.md, decisión 19): 11 son soporte de FK recién agregadas (esperan más volumen de datos/joins), `idx_notifications_is_read` soporta un filtro ya activo en el código, e `idx_signals_geom` soporta `signals.geom` (mantenida por trigger) preparada para una futura búsqueda espacial.
- [x] Mover la extensión `postgis` fuera del esquema `public` (advisory de Supabase, bajo impacto real) — intentado y descartado: Postgres rechaza `ALTER EXTENSION postgis SET SCHEMA` (`0A000: extension "postgis" does not support SET SCHEMA`), y una migración real (drop/recrear) pondría en riesgo la columna `signals.geom` y su trigger sin beneficio funcional. Documentado como excepción aceptada (CLAUDE.md, decisión 20), igual que `spatial_ref_sys`.

---
*Generado a partir de la auditoría de producción/UX del 2026-06-23. Ver CLAUDE.md para contexto de arquitectura.*
