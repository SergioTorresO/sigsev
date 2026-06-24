# SIGSEV — Sistema Inteligente de Gestión de Señalización Vial

Aplicación web fullstack para inventariar, inspeccionar y dar mantenimiento a las señales de tránsito de un municipio colombiano.

## Características

- **Inventario de señales**: catálogo georreferenciado con categoría, tipo, estado y municipio/zona, incluyendo carga masiva desde CSV/Excel.
- **Mapa GIS interactivo** (Leaflet): señales geolocalizadas con filtros por estado, búsqueda y ubicación (departamento → municipio → zona).
- **Gestión de zonas**: comunas, barrios y corregimientos por municipio.
- **Inspecciones y mantenimientos**: registro, asignación a técnicos y seguimiento de estado.
- **Notificaciones**: alertas de mantenimientos vencidos y señales en mal estado.
- **Dashboard con gráficas**: señales por estado, inspecciones por mes.
- **Reportes**: exportación a Excel y PDF.
- **Auditoría**: historial de quién creó/editó/eliminó cada registro, con detalle antes/después.
- **Roles y permisos**: ADMIN, SUPERVISOR, TECNICO y CONSULTA, con accesos diferenciados en frontend y backend.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Backend | Node.js + Express + TypeScript |
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| Base de datos | Supabase (PostgreSQL), acceso vía `@supabase/supabase-js` (HTTPS, sin conexión TCP directa) |
| Autenticación | JWT (jsonwebtoken + bcryptjs) |
| Mapas | Leaflet + react-leaflet |
| Gráficas | Recharts |
| Validación | Zod |

## Requisitos previos

- Node.js 18 o superior
- Un proyecto de Supabase ya creado (URL + service role key)

## Instalación

```bash
git clone <url-del-repositorio>
cd sigsev-project
```

### 1. Backend

```bash
cd backend
npm install
```

Crea `backend/.env` con:

```
SUPABASE_URL="https://<tu-proyecto>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<tu-service-role-key>"
JWT_SECRET="<una-clave-secreta-larga-y-aleatoria>"
FRONTEND_URL="http://localhost:3000"
PORT=4000
```

```bash
npm run dev   # http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
npm install
```

Crea `frontend/.env.local` con:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

```bash
npm run dev   # http://localhost:3000
```

## Roles del sistema

| Rol | Acceso |
|---|---|
| **ADMIN** | Acceso total: todos los módulos, gestión de usuarios y auditoría. |
| **SUPERVISOR** | Todos los módulos excepto Administración (usuarios y auditoría). Gestiona señales, zonas, inspecciones y mantenimientos, y puede asignarlos a técnicos. |
| **TECNICO** | Dashboard, Mapa GIS y Señales (solo lectura). |
| **CONSULTA** | Dashboard y Mapa GIS únicamente. Rol por defecto al crear un usuario sin especificar rol. |

El primer usuario ADMIN se crea registrándose normalmente y actualizando su rol a `ADMIN` directamente en la tabla `users` de Supabase (no hay un usuario admin precargado).

## Notas

- La base de datos se accede exclusivamente vía HTTPS (Supabase JS), no por conexión TCP directa a Postgres.
- Las señales se desactivan (`is_active = false`) en lugar de borrarse; zonas y usuarios sí se eliminan físicamente.
- Para detalles internos de arquitectura, decisiones técnicas y estructura de carpetas, ver `CLAUDE.md`.
