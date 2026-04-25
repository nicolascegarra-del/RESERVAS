# Klyp – Estándares Globales de Desarrollo

> Este fichero aplica a **todos los proyectos de Klyp** como base común.
> Cada proyecto debe tener su propio `CLAUDE.local.md` en la raíz del repositorio
> que amplíe o sobreescriba secciones específicas. En caso de conflicto,
> el `CLAUDE.local.md` del proyecto tiene prioridad.

---

## 🏗️ Stack Tecnológico Estándar

### Backend
- **Framework:** FastAPI (Python 3.12+)
- **ORM:** SQLModel (combina SQLAlchemy + Pydantic)
- **Base de datos:** PostgreSQL 16
- **Caché / Cola de tareas:** Redis 7 + Celery
- **Autenticación:** JWT — access token en memoria, refresh token en HttpOnly cookie
- **Ficheros / Storage:** MinIO (S3-compatible)
- **Generación PDF:** WeasyPrint + matplotlib
- **Procesado Excel:** openpyxl + pandas
- **Servidor ASGI:** Uvicorn + Gunicorn

### Frontend
- **Framework:** Next.js 15 (App Router) + TypeScript estricto
- **Estilos:** Tailwind CSS v4
- **Componentes UI:** shadcn/ui (Radix UI + Tailwind)
- **Formularios:** React Hook Form + Zod
- **Estado global:** Zustand (ligero) o TanStack Query para datos remotos
- **PWA:** next-pwa si el proyecto requiere capacidades offline

### Infraestructura
- **Contenerización:** Docker + Docker Compose
- **Deploy:** Coolify sobre VPS Contabo
- **Proxy / SSL:** Nginx + Let's Encrypt
- **CI/CD:** GitHub Actions (lint → test → build → deploy)

### Proyectos legacy (no modificar stack)
- **KRONOS:** FastAPI + SQLModel + Next.js 14 + Tailwind + shadcn/ui
- **KRIA:** Django 5.1 + DRF + React 18 + Vite + TypeScript + PostgreSQL

---

## 🎨 Identidad Visual Klyp

### Paleta de colores

| Token            | HEX       | RGB              | Uso principal                        |
|------------------|-----------|------------------|--------------------------------------|
| `navy`           | `#051937` | 5 · 25 · 55      | Fondos principales, cabeceras, logo  |
| `navy-light`     | `#1A3A6B` | 26 · 58 · 107    | Variante secundaria navy             |
| `accent`         | `#2E6DB4` | 46 · 109 · 180   | CTAs, enlaces, elementos interactivos|
| `pale`           | `#E8EDF5` | 232 · 237 · 245  | Fondos secundarios, secciones        |
| `gray`           | `#6B7280` | 107 · 114 · 128  | Texto de cuerpo, subtítulos          |
| `white`          | `#FFFFFF` | 255 · 255 · 255  | Fondos limpios, texto sobre navy     |
| `text-dark`      | `#374151` | 55 · 65 · 81     | Texto general sobre fondo blanco     |

**Regla 70 / 20 / 10:**
- 70 % Navy `#051937` — fondos dominantes, headers
- 20 % Blanco `#FFFFFF` — espacio y respiro visual
- 10 % Colores de apoyo — accent blue para interacciones, pale blue para secciones

### Tailwind config (tokens globales)

```js
// tailwind.config.ts
colors: {
  klyp: {
    navy:         '#051937',
    'navy-light': '#1A3A6B',
    accent:       '#2E6DB4',
    pale:         '#E8EDF5',
    gray:         '#6B7280',
    'text-dark':  '#374151',
  }
}
```

### Tipografía

| Uso                    | Familia        | Peso         | Tamaño ref. |
|------------------------|----------------|--------------|-------------|
| Logo / marca           | Nunito         | SemiBold 600 | Solo logo   |
| Títulos H1             | Inter / Nunito | Bold 700     | 32–40px     |
| Subtítulos H2–H3       | Inter / Nunito | SemiBold 600 | 20–28px     |
| Cuerpo de texto        | Inter          | Regular 400  | 14–16px     |
| Labels / captions      | Inter          | Regular 400  | 12px        |
| Código / mono          | JetBrains Mono | Regular 400  | 13–14px     |

> Para documentos ofimáticos (Word, PowerPoint) usar Arial / Helvetica.

### Componentes UI

- Usar siempre **shadcn/ui** como base.
- Aplicar tokens de color Klyp vía CSS variables en `globals.css`.
- Dark mode: implementar **siempre** con `class` strategy de Tailwind.
- Border radius: `rounded-lg` (8px) para tarjetas, `rounded-md` para inputs.
- Sombras: `shadow-sm` y `shadow-md`. Evitar sombras muy pronunciadas.
- Iconos: **Lucide React** como librería estándar.

---

## 🔐 Seguridad (obligatorio en todos los proyectos)

### Backend
- Nunca exponer datos sensibles en logs ni en respuestas de error al cliente.
- Validar y sanitizar **toda** entrada del usuario con Pydantic.
- Usar variables de entorno para secretos — nunca hardcodear credenciales.
- Implementar rate limiting en endpoints públicos y de autenticación.
- CORS configurado de forma estricta — solo dominios autorizados.
- Contraseñas hasheadas con bcrypt (mínimo cost factor 12).
- Tokens JWT: access 15 min, refresh 7 días.
- Queries parametrizadas siempre — cero SQL string concatenation.
- Headers HTTP: `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`.

### Frontend
- Nunca almacenar tokens de acceso en `localStorage` — solo en memoria.
- Refresh token exclusivamente en HttpOnly cookie con `SameSite=Strict`.
- Validar datos tanto en cliente (UX) como en servidor (seguridad real).
- Implementar CSP en headers de Nginx.
- Sanitizar cualquier contenido renderizado desde el servidor.

### Infraestructura
- Secretos gestionados vía `.env` + Coolify — nunca en el repo.
- Imágenes Docker sin root: usuario no privilegiado.
- Backups automáticos de PostgreSQL antes de cada migración en producción.
- Acceso SSH solo por clave pública.

---

## ⚙️ Convenciones de Código

### Git y ramas (GitFlow)
```
main        → producción (protegida, solo merge desde staging)
develop     → integración de features
staging     → pre-producción (mirror de main para QA)
feature/*   → nuevas funcionalidades
fix/*       → correcciones de bugs
hotfix/*    → correcciones urgentes en producción
```

### Commits (Conventional Commits)
```
feat:     nueva funcionalidad
fix:      corrección de bug
chore:    tareas de mantenimiento, dependencias
docs:     documentación
style:    formato, sin cambio de lógica
refactor: refactorización sin nueva funcionalidad
test:     añadir o corregir tests
perf:     mejora de rendimiento
ci:       cambios en pipelines CI/CD
```

### Calidad de código

- **TypeScript:** modo estricto siempre (`"strict": true` en tsconfig).
- **ESLint + Prettier** en pre-commit (Husky + lint-staged).
- **Ruff** para linting de Python.
- **Tests obligatorios antes de merge** a `develop` o `main`.
  - Backend: pytest, cobertura mínima 70 %.
  - Frontend: Vitest + React Testing Library para componentes críticos.
- No mergear código con errores de TypeScript o linting.
- Preferir composición sobre herencia. Funciones puras siempre que sea posible.

### Escalabilidad y rendimiento
- Diseñar modelos de datos pensando en multi-tenancy desde el inicio.
- Paginación obligatoria en todos los endpoints de listado.
- Índices en columnas usadas en WHERE y JOIN frecuentes.
- Caché con Redis para consultas costosas y repetitivas.
- Lazy loading en frontend.
- Imágenes siempre optimizadas con `next/image`.

---

## 📁 Estructura de proyecto recomendada

### Backend (FastAPI)
```
backend/
├── app/
│   ├── api/          # Routers por módulo
│   ├── core/         # Config, seguridad, dependencias
│   ├── models/       # SQLModel models
│   ├── schemas/      # Pydantic schemas (request/response)
│   ├── services/     # Lógica de negocio
│   ├── tasks/        # Tareas Celery
│   └── main.py
├── tests/
├── alembic/
├── Dockerfile
└── pyproject.toml
```

### Frontend (Next.js)
```
frontend/
├── src/
│   ├── app/           # App Router
│   ├── components/
│   │   ├── ui/        # shadcn/ui components
│   │   └── [feature]/ # Componentes por feature
│   ├── lib/
│   ├── hooks/
│   ├── stores/        # Zustand
│   └── types/
├── public/
├── Dockerfile
└── package.json
```

---

## 🌍 Internacionalización

- Todos los proyectos Klyp son por defecto en **español (es-ES)**.
- Si un proyecto requiere multilingüe: `next-intl` en frontend, gettext en backend.
- Formatos de fecha: `DD/MM/YYYY` para UI, ISO 8601 para APIs.
- Zona horaria: almacenar siempre en UTC, convertir en el cliente.

---

## 📱 Responsive Design (obligatorio en todas las apps)

Diseño **mobile-first**: se diseña primero para móvil y se escala hacia arriba.

### Breakpoints estándar (Tailwind)

| Nombre | Breakpoint | Dispositivo típico        |
|--------|------------|---------------------------|
| `xs`   | < 640px    | Móvil pequeño             |
| `sm`   | ≥ 640px    | Móvil grande / landscape  |
| `md`   | ≥ 768px    | Tablet portrait           |
| `lg`   | ≥ 1024px   | Tablet landscape / laptop |
| `xl`   | ≥ 1280px   | Escritorio                |
| `2xl`  | ≥ 1536px   | Pantalla grande           |

### Reglas
- Mobile-first siempre: estilos base para móvil, prefijos `md:`, `lg:` para escalar.
- Touch targets: mínimo 44×44px en móvil.
- Tablas anchas: en móvil convertir a cards o scroll horizontal.
- Nunca anchos/alturas fijos en px para layouts.

### Testing responsive obligatorio
- [ ] 375px y 390px (móvil)
- [ ] 768px y 1024px (tablet)
- [ ] 1280px y 1440px (desktop)

---

## 🧪 Plan de Pruebas

### Niveles de testing

| Nivel         | Backend              | Frontend                    | Cobertura mínima |
|---------------|----------------------|-----------------------------|------------------|
| Unitario      | pytest + mocks       | Vitest                      | 70 % / 60 %      |
| Integración   | pytest + httpx       | Testing Library + MSW       | Endpoints críticos |
| E2E           | —                    | Playwright                  | Happy + error path |
| Smoke (post-deploy) | —            | Playwright / curl           | Rutas principales |

### Cuándo generar plan de pruebas
- Feature nueva → plan completo (unitario + integración + E2E).
- Bug fix → test que reproduzca el bug antes de corregirlo.
- Refactor → verificar que los tests existentes siguen pasando.
- Deploy a producción → smoke test obligatorio.

---

## 🚨 Gestión de Errores y Logging

### Niveles de log

| Nivel    | Cuándo usarlo                                  |
|----------|------------------------------------------------|
| DEBUG    | Solo en desarrollo, nunca en producción        |
| INFO     | Eventos normales del sistema                   |
| WARNING  | Situaciones inesperadas pero recuperables      |
| ERROR    | Errores que impiden una operación concreta     |
| CRITICAL | Fallos graves que afectan al sistema completo  |

### Qué NUNCA loguear
- Contraseñas, tokens, API keys, secrets.
- Números de tarjeta, datos bancarios.
- DNI, NIF, datos médicos o datos sensibles personales.
- Stack traces completos en respuestas al cliente.

### Respuesta de error estándar Klyp (API)
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El campo email no es válido.",
    "field": "email",
    "request_id": "req_abc"
  }
}
```

---

## 📝 Estándares de Documentación

### README obligatorio en todo repositorio
```markdown
# Nombre del proyecto
Descripción breve (1-2 líneas).

## Requisitos previos
## Instalación y arranque local
## Variables de entorno necesarias
## Estructura del proyecto
## Comandos útiles (test, lint, build, migrate)
## Deploy
## Contacto / equipo
```

### Docstrings

**Python:**
```python
def calcular_precio_final(precio_base: float, descuento: float) -> float:
    """
    Calcula el precio final aplicando el descuento.

    Args:
        precio_base: Precio sin descuento en euros.
        descuento: Porcentaje de descuento (0-100).

    Returns:
        Precio final redondeado a 2 decimales.

    Raises:
        ValueError: Si el descuento está fuera del rango 0-100.
    """
```

**TypeScript:**
```typescript
/**
 * Formatea un número como precio en euros.
 * @param amount - Cantidad en euros.
 * @param locale - Locale para el formato (default: 'es-ES').
 * @returns String formateado, ej: "1.234,56 €"
 */
```

---

## 🔧 Variables de Entorno

```
proyecto/
├── .env.example      # ✅ Committed — plantilla sin valores reales
├── .env.local        # ❌ Nunca committed — desarrollo local
├── .env.staging      # ❌ Nunca committed — gestionado en Coolify
└── .env.production   # ❌ Nunca committed — gestionado en Coolify
```

### Estructura `.env.example` estándar
```bash
# ─── App ───────────────────────────────────────────
APP_NAME=mi-proyecto
APP_ENV=development
APP_SECRET_KEY=              # openssl rand -hex 32
DEBUG=true

# ─── Base de datos ─────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
DATABASE_POOL_SIZE=10

# ─── Redis ─────────────────────────────────────────
REDIS_URL=redis://localhost:6379/0

# ─── Auth / JWT ────────────────────────────────────
JWT_SECRET_KEY=              # openssl rand -hex 32
JWT_ACCESS_EXPIRE_MINUTES=15
JWT_REFRESH_EXPIRE_DAYS=7

# ─── Storage (MinIO) ───────────────────────────────
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_BUCKET_NAME=

# ─── Frontend (Next.js) ────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=Mi Proyecto
```

---

## 🔍 Revisión de Código (Pull Requests)

### Reglas de PR
- Máximo 400 líneas cambiadas por PR.
- Una responsabilidad por PR: no mezclar features con refactors no relacionados.
- Título: formato Conventional Commits.
- Descripción obligatoria: qué cambia, por qué, cómo probar, screenshots si hay UI.

### PR Checklist
- [ ] Compila sin errores TypeScript ni Python.
- [ ] ESLint y Ruff sin warnings.
- [ ] Tests nuevos escritos para los cambios.
- [ ] Tests existentes siguen pasando.
- [ ] Sin `console.log`, `print()` ni `debugger` olvidados.
- [ ] Sin credenciales ni datos sensibles.
- [ ] `.env.example` actualizado si hay variables nuevas.
- [ ] Migraciones de BD incluidas si hay cambios en modelos.
- [ ] README actualizado si hay cambios en instalación.
- [ ] Responsive verificado si hay cambios de UI.

---

## 🤖 Agentes de Desarrollo Klyp

Los proyectos Klyp usan un sistema de agentes especializados en secuencia.
Todos los agentes leen este CLAUDE.md como contexto base.
El `CLAUDE.local.md` de cada proyecto aporta el contexto específico.

### Flujo estándar

```
Orquestador
    │
    ├─→ Agente Diseño/UX       → specs de componentes + tokens
    │
    ├─→ Agente Implementación  → código funcional + tipos + tests básicos
    │
    ├─→ Agente QA              → plan de pruebas + bugs reportados
    │
    ├─→ Agente Buenas Prácticas → revisión de código + informe [BUG/WARN/INFO]
    │
    ├─→ Agente Optimización    → refactor de rendimiento + métricas
    │
    └─→ Agente Documentación   → README + docstrings + changelog
```

### Formato de handoff entre agentes

**Diseño → Implementación**
- Tokens mapeados a clases Tailwind/Klyp
- Specs de componentes por breakpoint (tabla propiedad/valor/dispositivo)
- Árbol de componentes (nombre, props, variantes)
- Estados de UI: loading, error, empty, success

**Implementación → QA**
- Código completo con rutas de archivo
- Lista de endpoints nuevos o modificados
- Cambios en modelos/esquemas de BD
- Edge cases manejados y los que quedan fuera de scope

**QA → Buenas Prácticas**
- Lista de bugs encontrados con severidad
- Flujos verificados y flujos pendientes
- Cobertura de tests actual

**Buenas Prácticas → Optimización**
- Informe de revisión con etiquetas [BUG] [PERF] [SECURITY] [STYLE]
- Código corregido o candidatos a refactor

**Optimización → Documentación**
- Código final con mejoras aplicadas
- Decisiones técnicas tomadas durante la optimización
- Métricas antes/después si las hay

### Definition of Done por agente

| Agente            | Criterio de salida                                          |
|-------------------|-------------------------------------------------------------|
| Diseño/UX         | Specs completas, tokens mapeados, responsive verificado     |
| Implementación    | Compila sin errores, tests escritos, sin credenciales       |
| QA                | 0 bugs BLOCKER, plan de pruebas completado, smoke test OK   |
| Buenas Prácticas  | 0 issues [BUG] o [SECURITY] sin resolver                    |
| Optimización      | Core Web Vitals OK, sin N+1 queries, sin memory leaks       |
| Documentación     | README completo, docstrings en funciones públicas, CHANGELOG|

---

## 📋 Checklist antes de cualquier deploy a producción

- [ ] Tests pasando al 100 %.
- [ ] PR Checklist completado.
- [ ] Variables de entorno verificadas en Coolify.
- [ ] Backup de base de datos realizado.
- [ ] Migraciones probadas en staging primero.
- [ ] Sin credenciales ni secretos en el código.
- [ ] Headers de seguridad HTTP configurados en Nginx.
- [ ] Smoke test ejecutado en staging.
- [ ] Logs de errores revisados post-deploy.
- [ ] Responsive verificado en vistas principales.
- [ ] Performance smoke test ejecutado.

---

*Klyp Dev Standards v2.0 · 2025*
*Para contexto específico de proyecto, crear `CLAUDE.local.md` en la raíz del repositorio.*
