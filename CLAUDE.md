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
    │   │   └── NotificationBell.tsx   # Campanita de notificaciones (mantenimientos vencidos, señales en mal estado)
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
| POST/PUT/DELETE | /api/signals(/:id) | ✅ ADMIN, SUPERVISOR | Crear / editar / desactivar señal |
| PATCH | /api/signals/:id/toggle-active | ✅ ADMIN, SUPERVISOR | Reactivar/desactivar señal |
| POST | /api/signals/bulk-import | ✅ ADMIN, SUPERVISOR | Carga masiva desde CSV/Excel (.csv, .xlsx, .xls) |
| GET | /api/inspections | ✅ cualquier rol | Listar inspecciones |
| GET | /api/inspections/:id | ✅ cualquier rol | Ver inspección |
| POST/PUT | /api/inspections(/:id) | ✅ ADMIN, SUPERVISOR | Crear / editar inspección (puede asignarse a un técnico vía `technician_id`; TECNICO ya no puede crear/editar) |
| GET | /api/maintenances | ✅ cualquier rol | Listar mantenimientos |
| GET | /api/maintenances/:id | ✅ cualquier rol | Ver mantenimiento |
| POST/PUT | /api/maintenances(/:id) | ✅ ADMIN, SUPERVISOR | Crear / editar mantenimiento (puede asignarse a un técnico vía `assigned_to`; TECNICO ya no puede crear/editar) |
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
| Crear/editar/desactivar señales (catálogo) | ✅ | ✅ | ❌ | ❌ |
| Carga masiva de señales (CSV/Excel) | ✅ | ✅ | ❌ | ❌ |
| Crear/editar/eliminar zonas | ✅ | ✅ | ❌ | ❌ |
| Carga masiva de zonas (CSV/Excel) | ✅ | ✅ | ❌ | ❌ |
| Ver "Mis asignaciones" (inspecciones/mantenimientos propios, solo lectura) | ❌ (no aplica) | ❌ (no aplica) | ✅ | ❌ |
| Crear/editar inspecciones | ✅ | ✅ | ❌ | ❌ |
| Crear/editar mantenimientos (y cambiar su estado) | ✅ | ✅ | ❌ | ❌ |
| **Asignar** una inspección/mantenimiento a un técnico | ✅ | ✅ | ❌ | ❌ |
| Ver listado de usuarios (para asignar trabajo) | ✅ | ✅ | ❌ | ❌ |
| Crear/editar/activar-desactivar/eliminar usuarios | ✅ | ❌ | ❌ | ❌ |
| Ver registro de auditoría | ✅ | ❌ | ❌ | ❌ |
| Ver módulo "Administración" en el sidebar | ✅ | ❌ | ❌ | ❌ |
| Editar su propio perfil (`/dashboard/profile`) | ✅ | ✅ | ✅ | ✅ |

Resumen por rol:
- **ADMIN**: acceso total. Único rol que gestiona usuarios y ve el registro de auditoría.
- **SUPERVISOR**: ve todos los módulos excepto Administración (Dashboard, Mapa GIS, Señales, Zonas, Inspecciones, Mantenimientos, Reportes). Gestiona el catálogo de señales y zonas, y puede **asignar** inspecciones/mantenimientos a técnicos vía `technician_id`/`assigned_to`. No tiene acceso a la página de Administración de usuarios (`/dashboard/admin/users`) ni a Auditoría (`/dashboard/admin/audit`), ni las ve en el sidebar — eso es exclusivo de ADMIN; el backend solo le deja consultar `/api/users` puntualmente para poblar el selector "Asignar a".
- **TECNICO**: en el sidebar ve **Dashboard**, **Mapa GIS**, **Señales** (de solo lectura, sin crear/editar) y **Mis asignaciones** (`/dashboard/mis-asignaciones`): lista de solo lectura de las inspecciones y mantenimientos que ADMIN/SUPERVISOR le hayan asignado, consultando `GET /api/inspections?technician_id=<su id>` y `GET /api/maintenances?assigned_to=<su id>` (ambos endpoints ya estaban abiertos a cualquier rol autenticado, no fue necesario tocar el backend). No tiene acceso a Zonas ni a las páginas de gestión de Inspecciones/Mantenimientos — ni en el frontend (redirige a `/dashboard` si entra por URL directa) ni en el backend (`requireRole` no incluye TECNICO en esas rutas de escritura).
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
- [x] "Mis asignaciones" (`/dashboard/mis-asignaciones`): pantalla de solo lectura para TECNICO con sus inspecciones y mantenimientos asignados
- [x] Notificaciones (campanita): mantenimientos vencidos y señales en mal estado, con disparo de email
- [x] Reportes (`/dashboard/reportes`): exportación a Excel/PDF — solo ADMIN/SUPERVISOR
- [x] Auditoría: log de cambios (quién editó qué, antes/después) sobre señales, zonas, inspecciones, mantenimientos y usuarios; lectura solo ADMIN en `/dashboard/admin/audit`
- [x] Permisos por rol aplicados en backend (`requireRole` por ruta) y reflejados en frontend (botones/acciones ocultos según rol)
- [x] Perfil de usuario (`/dashboard/profile`): cada usuario edita su propio nombre/teléfono/contraseña
- [x] Módulo admin de usuarios: lectura ADMIN+SUPERVISOR, escritura (crear/editar/toggle/eliminar) solo ADMIN
- [x] Catálogo de 1119 municipios de Colombia (DANE) cargado en Supabase

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
