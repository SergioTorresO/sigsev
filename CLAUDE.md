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
    │   │   │   ├── page.tsx           # Home con stats reales
    │   │   │   ├── mapa/page.tsx      # Mapa GIS con Leaflet
    │   │   │   ├── signals/
    │   │   │   │   ├── page.tsx       # Lista + desactivar
    │   │   │   │   ├── new/page.tsx   # Crear señal
    │   │   │   │   └── [id]/edit/page.tsx
    │   │   │   ├── inspections/page.tsx
    │   │   │   ├── maintenances/page.tsx
    │   │   │   └── admin/users/page.tsx  # Solo ADMIN
    │   │   ├── login/page.tsx
    │   │   └── layout.tsx             # Wraps con <Providers>
    │   ├── components/
    │   │   ├── DashboardLayout.tsx    # Sidebar (muestra "Administración" solo a ADMIN)
    │   │   └── MapView.tsx            # Componente Leaflet (no SSR)
    │   ├── context/
    │   │   └── AuthContext.tsx        # user, token, login, logout
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
| GET/POST | /api/signals | ✅ | Listar / crear señales |
| GET/PUT/DELETE | /api/signals/:id | ✅ | Ver / editar / desactivar |
| GET/POST | /api/inspections | ✅ | Listar / crear inspecciones |
| GET/PUT | /api/inspections/:id | ✅ | Ver / editar inspección |
| GET/POST | /api/maintenances | ✅ | Listar / crear mantenimientos |
| GET/PUT | /api/maintenances/:id | ✅ | Ver / editar mantenimiento |
| GET | /api/ref/categories | ✅ | Categorías de señales |
| GET | /api/ref/signal-types | ✅ | Tipos de señal (filtra por category_id) |
| GET | /api/ref/municipalities | ✅ | Municipios |
| GET | /api/ref/zones | ✅ | Zonas (filtra por municipality_id) |
| GET/POST | /api/users | ✅ ADMIN | Listar / crear usuarios |
| GET | /api/users/roles | ✅ ADMIN | Listar roles |
| GET/PUT | /api/users/:id | ✅ ADMIN | Ver / editar usuario |
| PATCH | /api/users/:id/toggle-active | ✅ ADMIN | Activar/desactivar usuario |
| DELETE | /api/users/:id | ✅ ADMIN | Eliminar usuario |

## Roles del sistema
- **ADMIN**: acceso total, ve módulo de administración de usuarios
- **TECNICO**: puede crear inspecciones y mantenimientos
- **CONSULTA**: solo lectura (rol por defecto al crear usuario)

## Decisiones técnicas importantes
1. **Supabase JS en lugar de Prisma**: red universitaria bloquea TCP 5432/6543. Supabase JS usa HTTPS (443).
2. **Cookie + localStorage**: el token se guarda en ambos. LocalStorage para el cliente, cookie para el middleware de Next.js (SSR no puede leer localStorage).
3. **`req.user` tipado**: se declara con `declare global { namespace Express { interface Request { user?: JwtPayload } } }` tanto en `auth.middleware.ts` como en `requireRole.middleware.ts` (este último importa `JwtPayload` de auth).
4. **Soft delete en señales**: en lugar de borrar, se pone `is_active = false`.
5. **Leaflet sin SSR**: `dynamic(() => import('@/components/MapView'), { ssr: false })` para evitar errores de `window is not defined`.
6. **Cast `req.params.id as string`**: necesario porque @types/express v5 tipifica params como `string | string[]`.

## Lo que está implementado (completo)
- [x] Autenticación JWT (login/register/logout)
- [x] Protección de rutas (middleware Next.js + requireRole backend)
- [x] Dashboard con estadísticas reales
- [x] Mapa GIS con Leaflet (marcadores por estado, filtros, popups)
- [x] CRUD completo de señales (lista, crear, editar, desactivar)
- [x] Inspecciones (lista + crear inline, actualiza estado de señal)
- [x] Mantenimientos (lista + crear inline, cambio de estado en tabla)
- [x] Módulo admin de usuarios (solo ADMIN): crear, editar, toggle activo/inactivo, cambiar rol, eliminar

## Próximos pasos sugeridos
- [ ] **Reportes**: página `/dashboard/reportes` con exportación a PDF/Excel (señales por estado, mantenimientos por período, etc.)
- [ ] **Perfil de usuario**: página para que cada usuario edite su propio nombre/teléfono/contraseña
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
