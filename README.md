# Taskito

El desarrollo de Taskito se guio por principios SOLID y una arquitectura por capas (routers → servicios → repositorios/ORM → esquemas), priorizando seguridad, mantenibilidad y pruebas desde el inicio. Se optó por un enfoque iterativo: primero un “esqueleto” funcional end-to-end, luego endurecimiento de seguridad y validaciones, y finalmente observabilidad y experiencia de usuario.

En el frontend se usó Next.js (App Router) para (mayoritariamente client-side para velocidad de desarrollo) y una SPA fluida, con TailwindCSS para estilos utilitarios y shadcn/ui para componentes accesibles y consistentes. La gestión de estado global se resolvió con Redux Toolkit, y se alinearon las validaciones con el backend para evitar discrepancias (errores claros en formularios y reglas compartidas). Nginx actúa como reverse proxy y punto de terminación TLS, sirviendo estáticos y enrutando a la API.

El backend se implementó con FastAPI por su tipado, rendimiento y documentación automática. Pydantic define esquemas de entrada/salida y garantiza validación robusta. SQLAlchemy se emplea como ORM, aprovechando el binding de parámetros para mitigar inyecciones SQL y mantener una capa de persistencia limpia y testeable. La autenticación se basa en JWT con expiración configurable y control de permisos (roles), y se añadieron middlewares y políticas de seguridad (CORS, CSP estricta para reducir superficie de XSS y carga de recursos no confiables, y SSL en el proxy). Para protección en formularios se utilizó el patrón de doble envío (double submit) de CSRF en las interacciones que lo requieren. Redis apoya almacenamiento del rate limiting; SlowAPI impone límites diferenciados para endpoints de autenticación y generales.

Las pruebas: Pytest para unitarias y de servicios (incluyendo rutas críticas de error y seguridad), mientras que Cypress cubre flujos end-to-end y componentes del frontend (autenticación, CRUD de tareas, filtros y paginación). Se priorizó la trazabilidad de errores mediante respuestas HTTP consistentes y mensajes de validación comprensibles. En integración local, Docker Compose orquesta todos los contenedores (frontend, api, db, redis, nginx y observabilidad), garantizando reproducibilidad y un entorno cercano a producción.

En observabilidad, Grafana + Loki + Promtail permiten centralizar logs y paneles básicos para salud del sistema. La API expone healthchecks y métricas esenciales, y el proxy facilita diagnóstico con access logs. Finalmente, se mantuvo coherencia entre frontend y backend: mismas reglas de validación, manejo de errores uniforme y tipado estricto, lo que redujo defectos y aceleró la iteración.

Herramientas y tecnologías clave:

 - Frontend: Next.js, TailwindCSS, shadcn/ui, Redux Toolkit, Cypress.
 - Backend: FastAPI, SQLAlchemy, Pydantic, Pytest, SlowAPI (rate limiting).
 - Infra/observabilidad: Docker Compose, Nginx (SSL), Redis, Grafana, Loki, Promtail.
 - Seguridad: JWT, CSRF (double submit), CSP estricta, CORS, SQL parametrizado, TLS.

## Guía de instalación y puesta en marcha

Esta guía explica cómo instalar y ejecutar todo el proyecto Taskito en tu entorno local usando Docker Compose. Incluye frontend (Next.js), backend (FastAPI), base de datos (PostgreSQL), Redis, Nginx (con SSL autofirmado), Grafana y Loki/Promtail para logs.

### Resumen
- Frontend: Next.js (puerto interno 5173) servido tras Nginx.
- Backend: FastAPI (puerto interno 8000) tras Nginx con prefijo `/api`.
- DB: PostgreSQL 14 (volumen persistente).
- Cache/Queue: Redis 7 (volumen persistente).
- Observabilidad: Grafana + Loki + Promtail.
- Reverse proxy: Nginx (HTTP 80 / HTTPS 443) con certificado autofirmado.

Rutas rápidas:
- Frontend: https://localhost/
- API: https://localhost/api
- Healthcheck: https://localhost/api/health
- Grafana: https://localhost/grafana/ (user: `admin`, pass: `admin`)

### 1) Requisitos previos (Windows)
- Docker Desktop (con WSL2 habilitado)
- Git
- Puertos libres: 80, 443, 5173, 8000, 3000, 3100, 5432, 6379
- Nota SSL: el certificado es autofirmado (desarrollo). El navegador mostrará advertencia la primera vez: acepta la excepción para continuar.

Opcional (solo si quieres correr sin Docker):
- Python 3.11
- Node.js 18+ y npm 9+

### 2) Clonar el repositorio
```powershell
git clone https://github.com/ReylanLugo/taskito.git
cd taskito
```

### 3) Crear archivo de entorno `.env.local` (raíz)
Docker Compose utiliza este archivo para configurar `api`, `postgres` y `frontend`.
Crea `./.env.local` con el contenido:

```env
# Database configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=dev_password
POSTGRES_DB=taskito
POSTGRES_PORT=5432

# Redis configuration
REDIS_HOST=redis
REDIS_PORT=6379

# API configuration
API_PORT=8000

# Additional app settings
DEBUG=True
SECRET_KEY=taskito_dev_secret_key

# Authentication settings
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_SECRET="anything"
REFRESH_TOKEN_EXPIRE_MINUTES=3600

RATE_LIMIT_ENABLED=True
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW="minutes"
RATE_LIMIT_AUTH_REQUESTS=100
RATE_LIMIT_AUTH_WINDOW="minutes"

CORS_ALLOW_ORIGINS=["http://localhost:3000", "http://localhost:5173", "https://localhost"]

## Frontend
AUTH_SECRET="sF7of/9pD2Hsq7MeCgI2x1qyAxABTpPxCPEKCM1VnYQ="
AUTH_TRUST_HOST=true
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET="sF7of/9pD2Hsq7MeCgI2x1qyAxABTpPxCPEKCM1VnYQ="

NEXT_PUBLIC_BACKEND_URL=http://api:8000
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Notas:
- El backend (`backend/app/config.py`) ya define CORS para `http(s)://localhost` y `:3000`.
- El `docker-compose.yml` exporta al frontend: `NEXT_PUBLIC_API_URL=https://localhost/api` y `NODE_TLS_REJECT_UNAUTHORIZED=0` (permite SSL autofirmado en dev).

### 4) Levantar todo con Docker
(Pydantic necesita tener instalado rust y su compilador)
Desde la raíz del proyecto:
```powershell
docker compose up -d --build
Si algo sale mal para un hard reset y limpieza de todos los contenedores:
docker compose down -v --rmi all --remove-orphans; docker compose build --no-cache; docker compose up -d
```

Servicios que se levantarán (según `docker-compose.yml`):
- `nginx`: reverse proxy, puertos 80/443.
- `api`: FastAPI en 8000 (volumen `./backend:/app`). Ejecuta `startup.sh` (espera DB, aplica migraciones, inicia Uvicorn).
- `postgres`: 14 (volumen persistente `postgres-data`).
- `redis`: 7 (volumen persistente `redis-data`).
- `loki` y `promtail`: recolección de logs.
- `grafana`: dashboards (puerto interno 3000), accesible por Nginx en `/grafana`.
- `frontend`: Next.js (puerto interno 5173), accesible por Nginx en `/`.

### 5) Verificar estado
- Ver contenedores:
```powershell
docker compose ps
```

- Revisar logs (Grafana):
```
(user: `admin`, pass: `admin`)
http://localhost:3000/d/taskito-logs/taskito-logs?orgId=1&from=now-1h&to=now&timezone=browser
```

- Probar en el navegador:
  - Frontend: https://localhost/
  - API root: https://localhost/api/docs 
  (Debido a las politicas CSP con cada actualizacion se debe actualizar el hash en el middleware para permitir la insertacion de js en el dom por parte de swagger)

Si el navegador advierte por certificado, acepta la excepción (SSL autofirmado de desarrollo).

### 6) Comandos rápidos

#### Migraciones Alembic (autogenerar)
```powershell
docker compose exec api alembic revision --autogenerate -m "Initial migration"
```

#### Aplicar migraciones
```powershell
docker compose exec api alembic upgrade head
```

#### Tests backend con cobertura (local)
```powershell
cd backend
winget install -e --id Python.Python.3.11 (3.11.9)
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pytest --cov=app --cov-report=term-missing --cov-report=html
```

#### Tests de componentes (Cypress)
```powershell
cd frontend
npm install
npx cypress run --component
```

### 7) Puertos y rutas expuestas
- Nginx: 80 y 443
- API: 8000 (interno), accesible vía Nginx en `https://localhost/api`
- API Docs: 8000 (interno), accesible vía Nginx en `https://localhost/api/docs`
- Frontend: 5173 (interno), accesible vía Nginx en `https://localhost/`
- Grafana: 3000 (interno), accesible vía Nginx en `https://localhost/grafana/`
- Loki: 3100 (interno)
- Postgres: 5432 (mapeado)
- Redis: 6379 (mapeado)

### 8) Problemas comunes
- SSL autofirmado: el navegador mostrará advertencia; acepta la excepción para `https://localhost`.
- Conflicto de puertos: libera el puerto o ajusta mapeos en `docker-compose.yml`.
- `.env.local` faltante o variables incorrectas: el `api` no conectará a Postgres/Redis. En Docker, usa `postgres` y `redis` como hosts.
- Fin de línea en `startup.sh` (Windows): si ves `/bin/bash^M`, convierte a LF y reconstruye.
- Migraciones: si el modelo cambió, crea migración autogenerada y aplica `alembic upgrade head`.

### 9) Parar y limpiar
```powershell
docker compose down           # Parar
docker compose down -v       # Parar y borrar volúmenes (pierdes datos de Postgres/Redis)
```

---

## Créditos y notas
- Backend: FastAPI + SQLAlchemy + Alembic + Redis + SlowAPI (rate limiting) + middlewares de seguridad, CORS, CSP y CSRF.
- Frontend: Next.js + Redux Toolkit + Cypress.
- Observabilidad: Grafana + Loki + Promtail.

## Diagrama de arquitectura
                                   ┌──────────────────────────┐
                                   │        Usuario           │
                                   │   Navegador(NextJs/Redux)│
                                   └───────────┬──────────────┘
                                               │ HTTP(S)
                                               │
┌──────────────────────────┐        ┌──────────▼───────────┐
│   Contenedor: nginx      │        │  Contenedor: frontend │
│ Reverse Proxy / Static   │        │  (App Router)         │
│ - TLS/terminación (HTTPS)│        │ - Sirve UI            │
│ - Rutas /gzip /caché     │        │ - Habla con API       │
└──────────┬───────────────┘        └──────────┬────────────┘
           │                                      HTTP(S)
           │
           ▼
┌───────────────────────────────────────────────────────────────┐
│                  Contenedor: api (FastAPI)                    │
│  App: Taskito                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Routers:                                                │  │
│  │  - /auth (login, register, perfil, roles)               │  │
│  │  - /tasks (CRUD, filtros, stats, comentarios)           │  │
│  │  - /users (CRUD propositos admin)                       │  │
│  │  - /ws (websocket)                                      │  │
│  │  - /health, /                                           │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Servicios (SOLID):                                      │  │
│  │  - UserService (hash, JWT, roles, activación)           │  │
│  │  - TaskService (CRUD, filtros, paginación, orden)       │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Schemas (Pydantic): User*, Task*, Filters, Token*       │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Middleware/Seguridad:                                   │  │
│  │  - Rate limiting (slowapi: auth vs general)             │  │
│  │  - JWT auth                                             │  │
│  │  - Validaciones coherentes front/back                   │  │
│  └─────────────────────────────────────────────────────────┘  │
│      │                                │                       │
│      │SQLAlchemy                      │Rate limit store       │
└──────┼───────────────┬────────────────┼───────────────┬───────┘
       │               │                                │
       ▼               │                                ▼
┌──────────────────┐   │                    ┌──────────────────────┐
│ Contenedor: db   │   │                    │ Contenedor: redis    │
│ PostgreSQL       │   │                    │ (opcional)           │
│ - Datos de users │   │                    │ - Store para limiter │
│   y tasks        │   │                    └──────────────────────┘
└──────────────────┘   │                    
                       │
                       │ (logs, métricas opcionales)
                       ▼
            ┌──────────────────────────────┐
            │ Contenedor: monitoring/logs  │
            │ (Loki/Grafana)               │
            └──────────────────────────────┘


