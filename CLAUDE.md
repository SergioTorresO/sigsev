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

## Estructura de carpetas
```
sigsev-project/
├── backend/
│   ├── src/
│   │   ├── lib/
│   │   │   └── supabase.ts          # Cliente Supabase con service role key
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts   # verifyToken + declare global req.user
│   │   │   └── requireRole.middleware.ts  # requireRole('ADMIN', ...)
│   │   ├── modules/
│   │   │   ├── auth/                # login, register
│   │   │   ├── signals/             # CRUD señales (soft delete is_active)
│   │   │   ├── inspections/         # CRUD inspecciones + actualiza status señal
│   │   │   ├── maintenances/        # CRUD mantenimientos + completed_at
│   │   │   ├── references/          # municipios, zonas, categorías, tipos de señal
│   │   │   └── users/               # CRUD usuarios (solo ADMIN)
│   │   ├── types/
│   │   │   └── express.d.ts         # Extensión de Request (puede estar vacío, la declaración está en los middlewares)
│   │   └── server.ts
│   ├── .env                         # Ver variables abajo
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── dashboard/
    │   │   │   ├── page.tsx           # Home con stats reales (botón "Nueva señal" solo ADMIN/SUPERVISOR)
    │   │   │   ├── mapa/page.tsx      # Mapa GIS con Leaflet (usa <Sidebar /> directamente, layout propio)
    │   │   │   ├── signals/
    │   │   │   │   ├── page.tsx       # Lista (editar/desactivar/crear solo ADMIN/SUPERVISOR)
    │   │   │   │   ├── new/page.tsx   # Crear señal (redirige si no es ADMIN/SUPERVISOR)
    │   │   │   │   └── [id]/edit/page.tsx  # (redirige si no es ADMIN/SUPERVISOR)
    │   │   │   ├── inspections/page.tsx    # Solo ADMIN/SUPERVISOR (redirige a /dashboard para TECNICO/CONSULTA); selector "Asignar a"
    │   │   │   ├── maintenances/page.tsx   # Solo ADMIN/SUPERVISOR (redirige a /dashboard para TECNICO/CONSULTA); selector "Asignar a"
    │   │   │   ├── profile/page.tsx        # Cada usuario edita su propio nombre/teléfono/contraseña
    │   │   │   └── admin/users/page.tsx    # Página exclusiva de ADMIN (redirige a /dashboard si no lo es)
    │   │   ├── login/page.tsx
    │   │   └── layout.tsx             # Wraps con <Providers>
    │   ├── components/
    │   │   ├── Sidebar.tsx            # Sidebar colapsable (hover para expandir), compartido por TODO el layout; nav filtrado por rol (CONSULTA: Dashboard+Mapa; TECNICO: +Señales; ADMIN/SUPERVISOR: todo); "Administración" solo ADMIN
    │   │   ├── DashboardLayout.tsx    # Wrapper de header/main que renderiza <Sidebar />
    │   │   └── MapView.tsx            # Componente Leaflet (no SSR)
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
| GET | /api/inspections | ✅ cualquier rol | Listar inspecciones |
| GET | /api/inspections/:id | ✅ cualquier rol | Ver inspección |
| POST/PUT | /api/inspections(/:id) | ✅ ADMIN, SUPERVISOR | Crear / editar inspección (puede asignarse a un técnico vía `technician_id`; TECNICO ya no puede crear/editar) |
| GET | /api/maintenances | ✅ cualquier rol | Listar mantenimientos |
| GET | /api/maintenances/:id | ✅ cualquier rol | Ver mantenimiento |
| POST/PUT | /api/maintenances(/:id) | ✅ ADMIN, SUPERVISOR | Crear / editar mantenimiento (puede asignarse a un técnico vía `assigned_to`; TECNICO ya no puede crear/editar) |
| GET | /api/ref/categories | ✅ cualquier rol | Categorías de señales |
| GET | /api/ref/signal-types | ✅ cualquier rol | Tipos de señal (filtra por category_id) |
| GET | /api/ref/municipalities | ✅ cualquier rol | Municipios |
| GET | /api/ref/zones | ✅ cualquier rol | Zonas (filtra por municipality_id) |
| GET | /api/users, /api/users/roles, /api/users/:id | ✅ ADMIN, SUPERVISOR | Listar/ver usuarios y roles (SUPERVISOR solo lo usa internamente para el selector "Asignar a" en inspecciones/mantenimientos; no tiene acceso a la página /dashboard/admin/users) |
| POST/PUT/PATCH/DELETE | /api/users(/:id) | ✅ ADMIN | Crear / editar / activar-desactivar / eliminar usuario |

## Roles del sistema y matriz de permisos

Hay **4 roles reales** en la base de datos (la opción "Por defecto" del formulario de creación de usuario no es un rol, es solo el placeholder que aplica CONSULTA si no se elige nada):

| Acción | ADMIN | SUPERVISOR | TECNICO | CONSULTA |
|---|---|---|---|---|
| Ver módulo Dashboard | ✅ | ✅ | ✅ | ✅ |
| Ver módulo Mapa GIS | ✅ | ✅ | ✅ | ✅ |
| Ver/usar módulo Señales | ✅ | ✅ | ✅ | ❌ |
| Ver/usar módulo Inspecciones | ✅ | ✅ | ❌ | ❌ |
| Ver/usar módulo Mantenimientos | ✅ | ✅ | ❌ | ❌ |
| Ver módulo Reportes | ✅ | ✅ | ❌ | ❌ |
| Crear/editar/desactivar señales (catálogo) | ✅ | ✅ | ❌ | ❌ |
| Crear/editar inspecciones | ✅ | ✅ | ❌ | ❌ |
| Crear/editar mantenimientos (y cambiar su estado) | ✅ | ✅ | ❌ | ❌ |
| **Asignar** una inspección/mantenimiento a un técnico | ✅ | ✅ | ❌ | ❌ |
| Ver listado de usuarios (para asignar trabajo) | ✅ | ✅ | ❌ | ❌ |
| Crear/editar/activar-desactivar/eliminar usuarios | ✅ | ❌ | ❌ | ❌ |
| Ver módulo "Administración" en el sidebar | ✅ | ❌ | ❌ | ❌ |
| Editar su propio perfil (`/dashboard/profile`) | ✅ | ✅ | ✅ | ✅ |

Resumen por rol:
- **ADMIN**: acceso total. Único rol que gestiona usuarios.
- **SUPERVISOR**: ve todos los módulos excepto Administración (Dashboard, Mapa GIS, Señales, Inspecciones, Mantenimientos, Reportes). Gestiona el catálogo de señales y puede **asignar** inspecciones/mantenimientos a técnicos vía `technician_id`/`assigned_to`. No tiene acceso a la página de Administración de usuarios (`/dashboard/admin/users`) ni la ve en el sidebar — eso es exclusivo de ADMIN; el backend solo le deja consultar `/api/users` puntualmente para poblar el selector "Asignar a".
- **TECNICO**: en el sidebar solo ve **Dashboard**, **Mapa GIS** y **Señales** (de solo lectura, sin crear/editar). Ya no tiene acceso a Inspecciones ni Mantenimientos — ni en el frontend (redirige a `/dashboard` si entra por URL directa) ni en el backend (`requireRole` ya no incluye TECNICO en esas rutas de escritura). Las inspecciones/mantenimientos que ADMIN/SUPERVISOR le asignen quedan registradas en la base de datos a su nombre, pero hoy no tiene una pantalla propia para verlas.
- **CONSULTA**: en el sidebar solo ve **Dashboard** y **Mapa GIS** (los demás módulos —Señales, Inspecciones, Mantenimientos, Administración— están ocultos). Si intenta entrar por URL directa a esos módulos, el frontend lo redirige a `/dashboard`. Nota: las APIs de lectura de señales/inspecciones (`GET /api/signals`, `GET /api/inspections`) siguen abiertas a cualquier rol autenticado porque el propio Dashboard y el Mapa GIS las consumen para sus estadísticas y marcadores; lo que se restringe para CONSULTA es la navegación/página dedicada de esos módulos, no la lectura de datos que ya usa el Dashboard. Es además el rol por defecto al crear un usuario sin especificar rol.

La aplicación del lado del backend vive en `requireRole(...)` por ruta (ver `backend/src/middlewares/requireRole.middleware.ts`); ese middleware también deja `req.user.roleName` cacheado para que los controladores de inspecciones/mantenimientos sepan si quien crea puede asignar a otro técnico. El frontend oculta/redirige según `user.roles.name` (de `AuthContext`) como UX, pero la autorización real siempre es la del backend.

## Decisiones técnicas importantes
1. **Supabase JS en lugar de Prisma**: red universitaria bloquea TCP 5432/6543. Supabase JS usa HTTPS (443).
2. **Cookie + localStorage**: el token se guarda en ambos. LocalStorage para el cliente, cookie para el middleware de Next.js (SSR no puede leer localStorage).
3. **`req.user` tipado**: se declara con `declare global { namespace Express { interface Request { user?: JwtPayload } } }` tanto en `auth.middleware.ts` como en `requireRole.middleware.ts` (este último importa `JwtPayload` de auth).
4. **Soft delete en señales**: en lugar de borrar, se pone `is_active = false`.
5. **Leaflet sin SSR**: `dynamic(() => import('@/components/MapView'), { ssr: false })` para evitar errores de `window is not defined`.
6. **Cast `req.params.id as string`**: necesario porque @types/express v5 tipifica params como `string | string[]`.
7. **`req.user.roleName`**: `requireRole` consulta el rol en Supabase para autorizar la ruta y, de paso, cachea el nombre (`req.user.roleName`) para que el controlador no tenga que volver a consultarlo (usado para decidir si ADMIN/SUPERVISOR puede asignar una inspección/mantenimiento a otro técnico).

## Lo que está implementado (completo)
- [x] Autenticación JWT (login/register/logout)
- [x] Protección de rutas (middleware Next.js + requireRole backend)
- [x] Dashboard con estadísticas reales
- [x] Mapa GIS con Leaflet (marcadores por estado, filtros, popups)
- [x] Sidebar colapsable (icon rail → expande con hover), compartido por toda la app vía `<Sidebar />`
- [x] CRUD completo de señales (lista, crear, editar, desactivar) — restringido a ADMIN/SUPERVISOR
- [x] Inspecciones (lista + crear inline, actualiza estado de señal) — solo ADMIN/SUPERVISOR (módulo oculto/bloqueado para TECNICO y CONSULTA)
- [x] Mantenimientos (lista + crear inline, cambio de estado en tabla) — solo ADMIN/SUPERVISOR (módulo oculto/bloqueado para TECNICO y CONSULTA)
- [x] Asignación de inspecciones/mantenimientos a un técnico específico (ADMIN/SUPERVISOR)
- [x] Permisos por rol aplicados en backend (`requireRole` por ruta) y reflejados en frontend (botones/acciones ocultos según rol)
- [x] Perfil de usuario (`/dashboard/profile`): cada usuario edita su propio nombre/teléfono/contraseña
- [x] Módulo admin de usuarios: lectura ADMIN+SUPERVISOR, escritura (crear/editar/toggle/eliminar) solo ADMIN

## Próximos pasos sugeridos
- [ ] **Reportes**: página `/dashboard/reportes` con exportación a PDF/Excel (señales por estado, mantenimientos por período, etc.)
- [ ] **Notificaciones**: alertas de mantenimientos pendientes o señales en mal estado
- [ ] **Dashboard mejorado**: gráficas (Chart.js o Recharts) de señales por estado, inspecciones por mes
- [ ] **Auditoría**: log de cambios (quién editó qué y cuándo)
- [ ] **Búsqueda en mapa**: filtrar señales por municipio/zona directamente en el mapa
- [ ] **Carga masiva**: importar señales desde CSV/Excel

## Cómo correr el proyecto
```bash
# Backend
cd backend
npm run dev   # ts-node-dev src/server.ts en puerto 4000

# Frontend (otra terminal)
cd frontend
npm run dev   # Next.js en puerto 3000
```
