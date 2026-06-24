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

- [ ] Healthcheck endpoint (`/health`) que verifique conectividad real a Supabase.
- [ ] Graceful shutdown (`SIGTERM`/`SIGINT`) para no cortar requests en curso al desplegar.
- [ ] Logging estructurado (pino/winston) con request-id, en vez de `console.log`/`console.error`.
- [ ] Paginar/limitar las queries de `dashboard.service.ts` y `reports.service.ts`, que hoy cargan tablas completas en memoria.
- [ ] Agregar índices a las 11 foreign keys sin índice detectadas por Supabase (signals, inspections, maintenances, notifications, etc.) antes de que crezca el volumen de datos.
- [ ] Unificar manejo de errores en frontend: hoy se mezcla `alert()` nativo con paneles inline; definir un solo patrón (idealmente toasts).
- [ ] Verificación de dominio personalizado para envío de correos en producción (Resend) — pendiente histórico ya documentado en CLAUDE.md.

## Bajo

- [ ] Extraer a helpers compartidos la lógica de bulk-import duplicada entre `signals` y `zones` (`normalizeHeader`, `BulkImportError`, middleware de `multer`).
- [ ] Componentizar los patrones repetidos de tabla/modal/paginación del frontend (hoy copiados casi textual en cada página) en `<Table>`/`<Modal>` reutilizables.
- [ ] Accesibilidad básica: enlazar `<label htmlFor>` con sus inputs, agregar ARIA donde falte, focus trap + cierre con `Escape` en modales.
- [ ] Eliminar los 3 índices nunca usados detectados por Supabase (`idx_signals_geom`, `idx_notifications_user_id`, `idx_notifications_is_read`) o confirmar que se usarán pronto.
- [ ] Mover la extensión `postgis` fuera del esquema `public` (advisory de Supabase, bajo impacto real).

---
*Generado a partir de la auditoría de producción/UX del 2026-06-23. Ver CLAUDE.md para contexto de arquitectura.*
