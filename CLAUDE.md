# SIGSEV — Contexto de desarrollo para Claude

## Qué es este proyecto
Sistema Inteligente de Gestión de Señalización Vial (SIGSEV).
Aplicación web fullstack para inventariar, inspeccionar y dar mantenimiento a señales de tránsito de un municipio colombiano.

## Stack técnico
- **Backend**: Node.js + Express + TypeScript (`ts-node-dev`), puerto 4000
- **Frontend**: Next.js 15 App Router + TypeScript + Tailwind CSS, puerto 3000
- **Base de datos**: Supabase (PostgreSQL) — acceso exclusivamente via `@supabase/supabase-js` (HTTP/443). **NO usar Prisma ni conexión directa TCP**, la red universitaria bloquea los puertos 5432 y 6543.
- **Auth**: JWT (jsonwebtoken + bcryptjs), token en localStorage + cookie para Next.js middleware
- **Mapas**: Leaflet + react-leaflet (carga dinámica `ssr: false`)
- **Validación**: Zod
- **Gráficas**: Recharts (dashboard)
- **Reportes**: exportación a Excel/PDF (`xlsx`, generación de PDF en backend)
- **Carga masiva**: `multer` + `xlsx` (CSV/Excel) en `signals/bulk-import` y `zones/bulk-import`

## Estructura de carpetas
```
sigsev-project/
├── backend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── supabase.ts          # Cliente Supabase con service role key
│   │   │   └── audit.ts             # logAudit(): inserta en audit_logs sin romper la operación principal si falla
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts   # verifyToken + declare global req.user
│   │   │   └── requireRole.middleware.ts  # requireRole('ADMIN', ...), cachea req.user.roleName
│   │   ├── modules/
│   │   │   ├── auth/                # login, register
│   │   │   ├── signals/             # CRUD señales (soft delete is_active) + carga masiva CSV/Excel
│   │   │   ├── inspections/         # CRUD inspecciones + actualiza status señal
│   │   │   ├── maintenances/        # CRUD mantenimientos + completed_at + job de vencidos
│   │   │   ├── zones/                # CRUD zonas/comunas/corregimientos por municipio (ADMIN/SUPERVISOR) + carga masiva CSV/Excel
│   │   │   ├── references/          # GET de catálogos: departamentos, municipios, zonas, categorías, tipos de señal
│   │   │   ├── users/               # CRUD usuarios (solo ADMIN)
│   │   │   ├── profile/             # cada usuario edita su propio nombre/teléfono/contraseña
│   │   │   ├── reports/             # generación de reportes Excel/PDF
│   │   │   ├── notifications/       # alertas de mantenimientos vencidos / señales en mal estado
│   │   │   ├── dashboard/           # estadísticas agregadas (señales por estado, inspecciones por mes)
│   │   │   └── audit/               # lectura de audit_logs (solo ADMIN)
│   │   ├── types/
│   │   │   └── express.d.ts         # Extensión de Request (puede estar vacío, la declaración está en los middlewares)
│   │   └── server.ts
│   ├── .env                         # Ver variables abajo
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── dashboard/
    │   │   │   ├── page.tsx           # Home con stats reales + gráficas (Recharts)
    │   │   │   ├── mapa/page.tsx      # Mapa GIS con Leaflet + filtros (estado, búsqueda, departamento/municipio/zona en cascada)
    │   │   │   ├── signals/
    │   │   │   │   ├── page.tsx       # Lista (editar/desactivar/crear/carga masiva solo ADMIN/SUPERVISOR)
    │   │   │   │   ├── new/page.tsx   # Crear señal (redirige si no es ADMIN/SUPERVISOR)
    │   │   │   │   └── [id]/edit/page.tsx  # (redirige si no es ADMIN/SUPERVISOR)
    │   │   │   ├── zonas/page.tsx          # CRUD de zonas (ADMIN/SUPERVISOR), selección en cascada Departamento→Municipio + carga masiva CSV/Excel
    │   │   │   ├── inspections/page.tsx    # Solo ADMIN/SUPERVISOR (redirige a /dashboard para TECNICO/CONSULTA); selector "Asignar a"
    │   │   │   ├── maintenances/page.tsx   # Solo ADMIN/SUPERVISOR (redirige a /dashboard para TECNICO/CONSULTA); selector "Asignar a"
    │   │   │   ├── mis-asignaciones/page.tsx  # Solo TECNICO: inspecciones/mantenimientos asignados a él (solo lectura)
    │   │   │   ├── reportes/page.tsx       # Solo ADMIN/SUPERVISOR; exporta reportes a Excel/PDF
    │   │   │   ├── profile/page.tsx        # Cada usuario edita su propio nombre/teléfono/contraseña
    │   │   │   └── admin/
    │   │   │       ├── users/page.tsx      # Página exclusiva de ADMIN (redirige a /dashboard si no lo es)
    │   │   │       └── audit/page.tsx      # Página exclusiva de ADMIN: registro de auditoría con filtros y detalle antes/después
    │   │   ├── login/page.tsx
    │   │   └── layout.tsx             # Wraps con <Providers>
    │   ├── components/
    │   │   ├── Sidebar.tsx            # Sidebar colapsable (hover para expandir), compartido por TODO el layout; nav filtrado por rol (CONSULTA: Dashboard+Mapa; TECNICO: +Señales+Mis asignaciones; ADMIN/SUPERVISOR: todo incl. Zonas); "Administración" (Usuarios, Auditoría) solo ADMIN
    │   │   ├── DashboardLayout.tsx    # Wrapper de header/main que renderiza <Sidebar />
    │   │   ├── MapView.tsx            # Componente Leaflet (no SSR)
    │   │   ├── NotificationBell.tsx   # Campanita de notificaciones (mantenimientos vencidos, señales en mal estado)
    │   │   ├── Modal.tsx              # Modal reutilizable (overlay + panel + ARIA), usa useModalA11y internamente; adoptado en señales, zonas, inspecciones, mantenimientos, mis-asignaciones, admin/users, admin/audit
    │   │   └── Pagination.tsx         # Paginación reutilizable ("Página X de Y" + Anterior/Siguiente), mismo conjunto de páginas que Modal
    │   ├── hooks/
    │   │   └── useModalA11y.ts        # Hook: focus trap (Tab), cierre con Escape, autofocus inicial y restauración de foco al cerrar — usado internamente por <Modal>
    │   ├── context/
    │   │   └── AuthContext.tsx        # user (incluye user.roles.name), token, login, logout
    │   ├── lib/
    │   │   └── api.ts                 # Helpers api.get/post/put/delete/patch con Bearer token
    │   └── middleware.ts              # Protege /dashboard/*, redirige si no hay cookie 'token'
    ├── .env.local
    └── tsconfig.json                  # paths: { "@/*": ["./src/*"] }
```

## Variables de entorno

### backend/.env
```
SUPABASE_URL="https://plcybowoivjkohnrmkcc.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<valor real solo en backend/.env local — NUNCA commitear>"
JWT_SECRET="<valor real solo en backend/.env local — NUNCA commitear>"
FRONTEND_URL="http://localhost:3000"
PORT=4000
```

### frontend/.env.local
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Endpoints del backend
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | /api/auth/login | ❌ | Login |
| POST | /api/auth/register | ❌ | Registro |
| GET | /api/signals | ✅ cualquier rol | Listar señales |
| GET | /api/signals/:id | ✅ cualquier rol | Ver señal |
| POST/PUT | /api/signals(/:id) | ✅ ADMIN, SUPERVISOR, TECNICO | Crear / editar señal (registro en campo); desactivar sigue exclusivo de ADMIN/SUPERVISOR vía toggle-active |
| DELETE | /api/signals/:id | ✅ ADMIN, SUPERVISOR | Eliminar señal |
| PATCH | /api/signals/:id/toggle-active | ✅ ADMIN, SUPERVISOR | Reactivar/desactivar señal |
| POST | /api/signals/bulk-import | ✅ ADMIN, SUPERVISOR | Carga masiva desde CSV/Excel (.csv, .xlsx, .xls) |
| GET | /api/inspections | ✅ cualquier rol | Listar inspecciones |
| GET | /api/inspections/:id | ✅ cualquier rol | Ver inspección |
| POST/PUT | /api/inspections(/:id) | ✅ ADMIN, SUPERVISOR | Crear / editar inspección (puede asignarse a un técnico vía `technician_id`; TECNICO ya no puede crear/editar) |
| POST | /api/inspections/:id/complete | ✅ ADMIN, SUPERVISOR, TECNICO (dueño) | El técnico asignado (o ADMIN/SUPERVISOR) marca la inspección como realizada: `multipart/form-data` con `status`, `observations` y `photo` (foto obligatoria); sube la foto a Supabase Storage (bucket `evidences`), inserta una fila en `evidences` y actualiza `signals.status` con el resultado |
| GET | /api/maintenances | ✅ cualquier rol | Listar mantenimientos |
| GET | /api/maintenances/:id | ✅ cualquier rol | Ver mantenimiento |
| POST/PUT | /api/maintenances(/:id) | ✅ ADMIN, SUPERVISOR | Crear / editar mantenimiento (descripción, costo, fecha, reasignar vía `assigned_to`; TECNICO ya no puede crear/editar). El `PUT` genérico **ya no acepta `status`** — el estado solo cambia vía `/complete` |
| POST | /api/maintenances/:id/complete | ✅ ADMIN, SUPERVISOR, TECNICO (dueño) | El técnico asignado (o ADMIN/SUPERVISOR) marca el mantenimiento como realizado: `multipart/form-data` con `status`, `observations`, `photo` (foto obligatoria) y, si `status=COMPLETADO`, `signal_status` obligatorio para propagar el estado a la señal asociada; sube la foto a Storage e inserta una fila en `evidences` |
| GET | /api/zones | ✅ cualquier rol | Listar zonas (paginado, filtra por `municipality_id`, búsqueda por `search`) |
| GET | /api/zones/:id | ✅ cualquier rol | Ver zona |
| POST/PUT/DELETE | /api/zones(/:id) | ✅ ADMIN, SUPERVISOR | Crear / editar / eliminar zona (eliminar falla con mensaje claro si hay señales asociadas) |
| POST | /api/zones/bulk-import | ✅ ADMIN, SUPERVISOR | Carga masiva de zonas desde CSV/Excel (.csv, .xlsx, .xls), mismo patrón todo-o-nada que señales |
| GET | /api/ref/departments | ✅ cualquier rol | Departamentos de Colombia |
| GET | /api/ref/municipalities | ✅ cualquier rol | Municipios (filtra por `department_id`) — catálogo completo, 1119 municipios |
| GET | /api/ref/zones | ✅ cualquier rol | Zonas (filtra por `municipality_id`) — usado por los formularios de señales para poblar selects simples |
| GET | /api/ref/categories | ✅ cualquier rol | Categorías de señales |
| GET | /api/ref/signal-types | ✅ cualquier rol | Tipos de señal (filtra por `category_id`) |
| GET | /api/users, /api/users/roles, /api/users/:id | ✅ ADMIN, SUPERVISOR | Listar/ver usuarios y roles (SUPERVISOR solo lo usa internamente para el selector "Asignar a" en inspecciones/mantenimientos; no tiene acceso a la página /dashboard/admin/users) |
| POST/PUT/PATCH/DELETE | /api/users(/:id) | ✅ ADMIN | Crear / editar / activar-desactivar / eliminar usuario |
| GET | /api/profile | ✅ cualquier rol | Ver/editar el propio perfil (nombre, teléfono, contraseña) |
| GET | /api/reports/... | ✅ ADMIN, SUPERVISOR | Generación de reportes (Excel/PDF): señales por estado, mantenimientos por período, etc. |
| GET | /api/notifications | ✅ cualquier rol | Notificaciones del usuario (mantenimientos vencidos, señales en mal estado) |
| PATCH | /api/notifications/read-all | ✅ cualquier rol | Marca como leídas todas las notificaciones visibles para el usuario |
| DELETE | /api/notifications/clear-all | ✅ cualquier rol | Vacía la bandeja: borra físicamente las notificaciones visibles para el usuario (en ADMIN/SUPERVISOR esto incluye las "broadcast" compartidas, igual que read-all) |
| GET | /api/dashboard/stats | ✅ cualquier rol | Estadísticas para gráficas del dashboard (señales por estado, inspecciones por mes) |
| GET | /api/audit-logs | ✅ ADMIN | Registro de auditoría (filtra por `table_name`, `action`, `user_id`, rango de fechas; paginado) |

## Roles del sistema y matriz de permisos

Hay **4 roles reales** en la base de datos (la opción "Por defecto" del formulario de creación de usuario no es un rol, es solo el placeholder que aplica CONSULTA si no se elige nada):

| Acción | ADMIN | SUPERVISOR | TECNICO | CONSULTA |
|---|---|---|---|---|
| Ver módulo Dashboard | ✅ | ✅ | ✅ | ✅ |
| Ver módulo Mapa GIS | ✅ | ✅ | ✅ | ✅ |
| Ver/usar módulo Señales | ✅ | ✅ | ✅ | ❌ |
| Ver/usar módulo Zonas | ✅ | ✅ | ❌ | ❌ |
| Ver/usar módulo Inspecciones | ✅ | ✅ | ❌ | ❌ |
| Ver/usar módulo Mantenimientos | ✅ | ✅ | ❌ | ❌ |
| Ver módulo Reportes | ✅ | ✅ | ❌ | ❌ |
| Crear/editar señales (registrar en campo) | ✅ | ✅ | ✅ | ❌ |
| Desactivar/eliminar señales | ✅ | ✅ | ❌ | ❌ |
| Carga masiva de señales (CSV/Excel) | ✅ | ✅ | ❌ | ❌ |
| Crear/editar/eliminar zonas | ✅ | ✅ | ❌ | ❌ |
| Carga masiva de zonas (CSV/Excel) | ✅ | ✅ | ❌ | ❌ |
| Ver "Mis asignaciones" (inspecciones/mantenimientos propios, solo lectura) | ❌ (no aplica) | ❌ (no aplica) | ✅ | ❌ |
| Crear/editar inspecciones | ✅ | ✅ | ❌ | ❌ |
| Crear/editar mantenimientos (descripción, costo, fecha, reasignar) | ✅ | ✅ | ❌ | ❌ |
| Cambiar el **estado** de un mantenimiento (vía `/complete`, con evidencia) | ❌ (no aplica) | ❌ (no aplica) | ✅ (dueño) | ❌ |
| **Asignar** una inspección/mantenimiento a un técnico | ✅ | ✅ | ❌ | ❌ |
| Ver listado de usuarios (para asignar trabajo) | ✅ | ✅ | ❌ | ❌ |
| Crear/editar/activar-desactivar/eliminar usuarios | ✅ | ❌ | ❌ | ❌ |
| Ver registro de auditoría | ✅ | ❌ | ❌ | ❌ |
| Ver módulo "Administración" en el sidebar | ✅ | ❌ | ❌ | ❌ |
| Editar su propio perfil (`/dashboard/profile`) | ✅ | ✅ | ✅ | ✅ |

Resumen por rol:
- **ADMIN**: acceso total. Único rol que gestiona usuarios y ve el registro de auditoría.
- **SUPERVISOR**: ve todos los módulos excepto Administración (Dashboard, Mapa GIS, Señales, Zonas, Inspecciones, Mantenimientos, Reportes). Gestiona el catálogo de señales y zonas, y puede **asignar** inspecciones/mantenimientos a técnicos vía `technician_id`/`assigned_to`. No tiene acceso a la página de Administración de usuarios (`/dashboard/admin/users`) ni a Auditoría (`/dashboard/admin/audit`), ni las ve en el sidebar — eso es exclusivo de ADMIN; el backend solo le deja consultar `/api/users` puntualmente para poblar el selector "Asignar a".
- **TECNICO**: en el sidebar ve **Dashboard**, **Mapa GIS**, **Señales** y **Mis asignaciones** (`/dashboard/mis-asignaciones`). En Señales puede **registrar (crear) y editar** señales en campo (`POST`/`PUT /api/signals`), pero no puede desactivarlas/eliminarlas ni hacer carga masiva — eso sigue exclusivo de ADMIN/SUPERVISOR (`PATCH /toggle-active`, `DELETE`, `/bulk-import`). El flujo esperado es: TECNICO registra el inventario de señales en campo → ADMIN/SUPERVISOR asigna inspecciones/mantenimientos a los técnicos según el estado de cada señal vía `technician_id`/`assigned_to` → TECNICO consulta sus asignaciones en "Mis asignaciones" (`GET /api/inspections?technician_id=<su id>`, `GET /api/maintenances?assigned_to=<su id>`) y desde ahí **completa su propia asignación**: marca el checkbox "Tarea realizada", lo que abre un formulario obligatorio (estado, observaciones y foto de evidencia) y envía `POST /api/inspections/:id/complete` o `POST /api/maintenances/:id/complete`. Completar una inspección o un mantenimiento actualiza también el `status` de la señal asociada. No tiene acceso a Zonas ni a las páginas de gestión/creación de Inspecciones/Mantenimientos — ni en el frontend (redirige a `/dashboard` si entra por URL directa) ni en el backend (`requireRole` no incluye TECNICO en `POST`/`PUT`, solo en el `/complete` de su propia asignación, verificado por `technician_id`/`assigned_to` en el controller).
- **CONSULTA**: en el sidebar solo ve **Dashboard** y **Mapa GIS** (los demás módulos —Señales, Zonas, Inspecciones, Mantenimientos, Reportes, Administración— están ocultos). Si intenta entrar por URL directa a esos módulos, el frontend lo redirige a `/dashboard`. Nota: las APIs de lectura de señales/inspecciones (`GET /api/signals`, `GET /api/inspections`) siguen abiertas a cualquier rol autenticado porque el propio Dashboard y el Mapa GIS las consumen para sus estadísticas y marcadores; lo que se restringe para CONSULTA es la navegación/página dedicada de esos módulos, no la lectura de datos que ya usa el Dashboard. Es además el rol por defecto al crear un usuario sin especificar rol.

La aplicación del lado del backend vive en `requireRole(...)` por ruta (ver `backend/src/middlewares/requireRole.middleware.ts`); ese middleware también deja `req.user.roleName` cacheado para que los controladores de inspecciones/mantenimientos sepan si quien crea puede asignar a otro técnico. El frontend oculta/redirige según `user.roles.name` (de `AuthContext`) como UX, pero la autorización real siempre es la del backend.

## Decisiones técnicas importantes
1. **Supabase JS en lugar de Prisma**: red universitaria bloquea TCP 5432/6543. Supabase JS usa HTTPS (443).
2. **Cookie + localStorage**: el token se guarda en ambos. LocalStorage para el cliente, cookie para el middleware de Next.js (SSR no puede leer localStorage).
3. **`req.user` tipado**: se declara con `declare global { namespace Express { interface Request { user?: JwtPayload } } }` tanto en `auth.middleware.ts` como en `requireRole.middleware.ts` (este último importa `JwtPayload` de auth).
4. **Soft delete en señales**: en lugar de borrar, se pone `is_active = false`. **Zonas y usuarios sí se eliminan físicamente** (hard delete); en zonas, el borrado falla con un mensaje claro (`No se puede eliminar: hay señales asociadas a esta zona`) si existe una FK activa, en vez de un error genérico de Postgres.
5. **Leaflet sin SSR**: `dynamic(() => import('@/components/MapView'), { ssr: false })` para evitar errores de `window is not defined`.
6. **Cast `req.params.id as string`**: necesario porque @types/express v5 tipifica params como `string | string[]`.
7. **`req.user.roleName`**: `requireRole` consulta el rol en Supabase para autorizar la ruta y, de paso, cachea el nombre (`req.user.roleName`) para que el controlador no tenga que volver a consultarlo (usado para decidir si ADMIN/SUPERVISOR puede asignar una inspección/mantenimiento a otro técnico).
8. **Auditoría no bloqueante**: `logAudit()` (en `lib/audit.ts`) envuelve el insert en `audit_logs` en un try/catch; si falla, solo hace `console.error` y nunca interrumpe la operación principal (mismo patrón que el envío de notificaciones).
9. **Catálogos de referencia vs. filtros del mapa**: los departamentos/municipios (1119 filas, dataset DANE) se cargan completos vía `/api/ref/departments` y `/api/ref/municipalities` solo para poder mapear "a qué departamento pertenece cada municipio". Las *opciones* visibles en los selects de filtro del mapa y de zonas se derivan de las señales/zonas ya cargadas, no del catálogo completo — así solo se muestran ubicaciones que realmente tienen datos.
10. **Zonas no tienen dataset oficial**: a diferencia de los municipios (DANE), las zonas/comunas/corregimientos son específicas de cada municipio y se cargan manualmente desde `/dashboard/zonas` (no hay archivo nacional para importarlas masivamente).
11. **`spatial_ref_sys` (PostGIS) con RLS deshabilitado**: advisory de seguridad conocido y no corregible desde el proyecto — la tabla la crea y posee la extensión `postgis`, no el rol del proyecto, así que ni siquiera el acceso de administración de Supabase puede alterarla (`42501: must be owner of table`). Solo contiene SRIDs públicos, no datos de la aplicación; se documenta como excepción aceptada.
12. **Evidencias fotográficas en Storage**: bucket público `evidences` en Supabase Storage. `lib/imageUpload.ts` (multer en memoria, solo jpg/png/webp, máx. 5MB) + `lib/storage.ts` (`uploadEvidenceImage`, sube el buffer y devuelve `getPublicUrl()`). Es público porque el contenido (fotos de señales en vía pública) no es sensible; simplifica no tener que firmar URLs.
13. **Completar inspecciones/mantenimientos (`POST .../:id/complete`)**: ownership check en el controller (`technician_id`/`assigned_to === req.user.userId`, o rol ADMIN/SUPERVISOR) además del `requireRole` de la ruta — un TECNICO solo puede completar su propia asignación. La foto es obligatoria (sin `req.file` → 422 antes de validar el resto del body). Al completar, se actualiza el registro (estado + observaciones), se propaga el resultado a `signals.status` (en mantenimientos solo si `status=COMPLETADO`, usando el campo adicional `signal_status`) y se inserta una fila en `evidences` con la URL de la foto. No es atómico (llamadas secuenciales a Supabase, igual que el resto del proyecto fuera de la RPC de creación de inspecciones), consistente con el patrón ya usado en zonas/mantenimientos.
14. **`inspections.needs_maintenance` (booleano, default `false`)**: el técnico lo marca al completar una inspección (`POST /api/inspections/:id/complete`, viene como string `'true'`/`'false'` en el `multipart/form-data` y se coacciona a boolean en `completeInspectionSchema`). Si queda en `true`, se dispara una notificación broadcast (`type: 'MAINTENANCE_NEEDED'`, `target_user_id: null`) visible solo para ADMIN/SUPERVISOR — mismo patrón que `SIGNAL_BAD_STATUS`. El tipo `MAINTENANCE_NEEDED` se agregó tanto al union `NotificationType` (`notifications.service.ts`) como al `CHECK` constraint de la columna `notifications.type` en Postgres (ambos debían actualizarse; el constraint vive en la BD, no en el código). En el frontend, `/dashboard/inspections` (ADMIN/SUPERVISOR) muestra un badge "Necesita · Asignar" en las filas con `needs_maintenance = true`, que al hacer click navega a `/dashboard/maintenances?signal_id=<id>` y esa página lee el query param para abrir el formulario de creación con la señal ya preseleccionada — desde ahí el supervisor asigna el mantenimiento al técnico de su elección (`assigned_to`), reutilizando el flujo de creación ya existente sin cambios adicionales.
15. **El estado de un mantenimiento solo lo cambia el técnico que lo está realizando**: se eliminó el selector "Cambiar estado" que ADMIN/SUPERVISOR tenían en `/dashboard/maintenances` (llamaba a `PUT /api/maintenances/:id` con `{ status }`, sin observaciones ni foto). `updateMaintenanceSchema` ya no acepta el campo `status` — el `PUT` genérico solo edita descripción/costo/fecha/`assigned_to`. El único camino para cambiar el estado sigue siendo `POST /api/maintenances/:id/complete` (observaciones + foto obligatorias), que ya tenía el ownership check del técnico asignado (con ADMIN/SUPERVISOR como respaldo en el backend por si necesitan corregir algo, aunque la UI ya no expone esa opción).
16. **Roles permitidos como asignado en inspecciones/mantenimientos**: un mantenimiento es trabajo de campo y solo se puede asignar (`assigned_to`) a un usuario con rol `TECNICO`; una inspección se puede asignar (`technician_id`) a `SUPERVISOR` o `TECNICO`. En ningún caso se puede asignar a un `ADMIN` — el ADMIN gestiona pero nunca ejecuta estas tareas. Se valida en dos capas: `lib/assignment.ts` (`assertAssigneeRole`) lo verifica en el backend en `create`/`update` de ambos módulos (lanza error 400 con el nombre y rol real del usuario si no cumple), y en el frontend los selects "Asignar a" de `/dashboard/maintenances` y `/dashboard/inspections` ya filtran la lista de `/api/users` por `roles.name` antes de mostrarla, así que un ADMIN ni siquiera aparece como opción.
17. **`inspections.completed_at` (timestamptz, nullable)**: igual que `maintenances.completed_at`, marca cuándo el técnico completó la asignación, independiente del campo `status` (que es el estado *observado* de la señal: `BUENO`/`REGULAR`/`DETERIORADO`/`CAIDO`/`DESAPARECIDO`, no un indicador de si la tarea ya se hizo). Antes, `mis-asignaciones/page.tsx` inferí­a "tarea realizada" con `status === 'BUENO' || status === 'REGULAR'`, lo que dejaba para siempre en "Marcar" (no realizada) cualquier inspección completada legítimamente con un estado de mal estado (`DETERIORADO`/`CAIDO`/`DESAPARECIDO`) — el técnico veía su envío como fallido y lo repetía sin necesidad, aunque el backend ya había guardado todo correctamente. `completeInspection()` ahora hace `completed_at: new Date().toISOString()` al completar, se expone en `INSPECTION_SELECT`, y `isInspectionDone()` en el frontend usa `insp.completed_at != null` en vez de adivinar por `status`.
18. **`backend/src/lib/bulkImport.ts`**: helpers de carga masiva (`normalizeHeader`, `BulkImportError`/`BulkImportRowError`, `rawToText`, `createBulkImportUpload`, `parseSpreadsheetRows`) extraídos aquí porque estaban duplicados casi al pie de la letra en `signals.service.ts`/`signals.controller.ts` y `zones.service.ts`/`zones.controller.ts`. `signals.service.ts` re-exporta `BulkImportError` por compatibilidad con `signals.service.bulkImport.test.ts`, que ya lo importaba desde ahí. Un cambio futuro (nueva extensión permitida, fix de seguridad en el parseo de XLSX) ahora se aplica una sola vez para ambos módulos.
19. **Índices "unused" del advisor de Supabase no se eliminan**: de los 14 que reporta, 11 son los índices de soporte de FK agregados en la decisión de índices (señales, inspecciones, mantenimientos, notificaciones, etc.) — están "sin uso" porque el volumen de datos/consultas actual es bajo, no porque sean innecesarios; se espera que el optimizador empiece a usarlos a medida que crezcan las tablas y los joins. `idx_notifications_is_read` soporta una columna que sí se filtra activamente (`notifications.service.ts`), también pendiente de más volumen. `idx_signals_geom` soporta `signals.geom` (columna `geography`, mantenida automáticamente por el trigger `trg_update_signal_geom` a partir de `latitude`/`longitude`) — no se usa hoy porque ninguna consulta del backend hace búsquedas espaciales todavía, pero se deja preparado para una futura función de "señales cercanas"/radio de búsqueda. Se documenta la decisión de mantenerlos en vez de borrarlos.
20. **Extensión `postgis` no se puede mover fuera de `public`**: se intentó `ALTER EXTENSION postgis SET SCHEMA extensions` (advisory de bajo impacto de Supabase) y falló con `0A000: extension "postgis" does not support SET SCHEMA` — es una limitación de la propia extensión en Postgres, no un problema de permisos. Migrarla de verdad implicaría dropearla y recrearla en otro esquema, lo que rompería la columna `signals.geom` y su trigger (`trg_update_signal_geom`) y exigiría un backfill; el riesgo para una tabla con datos reales no se justifica por un advisory de bajo impacto sin consecuencia funcional. Se documenta como excepción aceptada, en la misma línea que `spatial_ref_sys` (decisión 11).
21. **`<Modal>`/`<Pagination>` reutilizables (frontend)**: los patrones de overlay `fixed inset-0` + panel de diálogo, y de "Página X de Y" + Anterior/Siguiente, estaban duplicados casi al pie de la letra en cada página con modales/paginación. `components/Modal.tsx` centraliza overlay, `role="dialog"`/`aria-modal`/`aria-labelledby`, botón de cierre opcional (`showCloseButton`), ancho configurable (`maxWidthClassName`) y llama internamente a `useModalA11y` (focus trap, cierre con Escape, autofocus, restauración de foco) para que cada página no tenga que volver a aplicar esa lógica. `components/Pagination.tsx` centraliza el control de paginación y no renderiza nada si `totalPages <= 1`. Adoptados en las 7 páginas con modales/paginación: `signals`, `zonas`, `inspections`, `maintenances`, `mis-asignaciones`, `admin/users`, `admin/audit`. La componentización de una `<Table>` genérica se evaluó y se descartó deliberadamente: los esquemas de columnas difieren demasiado entre páginas (señales, zonas, usuarios, auditoría) para que la abstracción resultante fuera más simple que el HTML que reemplazaría.

## Lo que está implementado (completo)
- [x] Autenticación JWT (login/register/logout)
- [x] Protección de rutas (middleware Next.js + requireRole backend)
- [x] Dashboard con estadísticas reales y gráficas (Recharts): señales por estado, inspecciones por mes
- [x] Mapa GIS con Leaflet (marcadores por estado, búsqueda, filtros en cascada Departamento → Municipio → Zona, popups)
- [x] Sidebar colapsable (icon rail → expande con hover), compartido por toda la app vía `<Sidebar />`
- [x] CRUD completo de señales (lista, crear, editar, desactivar) — restringido a ADMIN/SUPERVISOR
- [x] Carga masiva de señales desde CSV/Excel (`signals/bulk-import`), validación fila por fila, todo-o-nada
- [x] CRUD completo de zonas/comunas/corregimientos por municipio — restringido a ADMIN/SUPERVISOR
- [x] Carga masiva de zonas desde CSV/Excel (`zones/bulk-import`), mismo patrón de validación todo-o-nada que señales
- [x] Inspecciones (lista + crear inline, actualiza estado de señal) — solo ADMIN/SUPERVISOR (módulo oculto/bloqueado para TECNICO y CONSULTA)
- [x] Mantenimientos (lista + crear inline, cambio de estado en tabla, job de vencidos) — solo ADMIN/SUPERVISOR (módulo oculto/bloqueado para TECNICO y CONSULTA)
- [x] Asignación de inspecciones/mantenimientos a un técnico específico (ADMIN/SUPERVISOR)
- [x] "Mis asignaciones" (`/dashboard/mis-asignaciones`): TECNICO ve sus inspecciones y mantenimientos asignados, y puede **completarlos** (checkbox "Tarea realizada" → formulario con estado, observaciones y foto obligatoria); actualiza el registro y propaga el resultado a `signals.status`
- [x] Al completar una inspección, el TECNICO puede marcar "La señal necesita mantenimiento" (`inspections.needs_maintenance`); esto notifica a ADMIN/SUPERVISOR (`MAINTENANCE_NEEDED`) y les muestra un acceso directo en `/dashboard/inspections` para crear y asignar el mantenimiento al técnico que elijan
- [x] Notificaciones (campanita): mantenimientos vencidos y señales en mal estado, con disparo de email
- [x] Reportes (`/dashboard/reportes`): exportación a Excel/PDF — solo ADMIN/SUPERVISOR
- [x] Auditoría: log de cambios (quién editó qué, antes/después) sobre señales, zonas, inspecciones, mantenimientos y usuarios; lectura solo ADMIN en `/dashboard/admin/audit`
- [x] Permisos por rol aplicados en backend (`requireRole` por ruta) y reflejados en frontend (botones/acciones ocultos según rol)
- [x] Perfil de usuario (`/dashboard/profile`): cada usuario edita su propio nombre/teléfono/contraseña
- [x] Módulo admin de usuarios: lectura ADMIN+SUPERVISOR, escritura (crear/editar/toggle/eliminar) solo ADMIN
- [x] Catálogo de 1119 municipios de Colombia (DANE) cargado en Supabase
- [x] Componentes reutilizables `<Modal>` y `<Pagination>` (ver decisión 21), adoptados en señales, zonas, inspecciones, mantenimientos, mis-asignaciones, admin/users y admin/audit
- [x] Accesibilidad básica en modales/formularios: `useModalA11y` (focus trap, cierre con Escape, ARIA `role="dialog"`/`aria-modal`/`aria-labelledby`) encapsulado dentro de `<Modal>`; `<label htmlFor>` enlazado con sus inputs en los formularios restantes
- [x] Helpers compartidos de carga masiva (`backend/src/lib/bulkImport.ts`) usados por `signals` y `zones` en vez de lógica duplicada (ver decisión 18)

## Próximos pasos sugeridos
- [ ] **Verificación de dominio personalizado** para el envío de correos de notificación en producción (Resend) — pendiente de retomar

## Cómo correr el proyecto
```bash
# Backend
cd backend
npm run dev   # ts-node-dev src/server.ts en puerto 4000

# Frontend (otra terminal)
cd frontend
npm run dev   # Next.js en puerto 3000
```
