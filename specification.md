# API Client & Inventory System - Specification

## 1. Visión General

La aplicación es un **sistema integral de gestión de APIs** compuesto por tres módulos principales:

1. **API Client** — Cliente HTTP con pestañas estilo Chrome (funcionalidad existente)
2. **API Inventory** — Sistema de inventario, monitoreo y documentación de APIs
3. **Load Testing** — Módulo de pruebas de concurrencia y tiempos de respuesta

Los módulos son navegables desde una barra superior y comparten datos entre sí.

---

## 2. Arquitectura

### 2.1 Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Express 5 + SQLite |
| Gráficas | Recharts |
| Documentación | React Markdown |
| Persistencia | SQLite + localStorage (pestañas) |

### 2.2 Navegación Superior

```
┌─────────────────────────────────────────────────────┐
│  [ API Client ]  [ API Inventory ]  [ Load Testing ] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  (Contenido del módulo seleccionado)                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

Cada módulo es una vista independiente. El estado se comparte a través de la base de datos.

---

## 3. Módulo 1: API Client (Funcionalidad Existente)

### 3.1 Pestañas estilo Chrome

- Múltiples APIs abiertas simultáneamente en pestañas
- Scroll horizontal con mouse wheel
- Cada pestaña tiene: method badge, nombre, indicador de cambios sin guardar (•), botón cerrar (×)
- Botón + para nueva pestaña
- Persistencia en localStorage (se restauran al recargar)
- Confirmación al cerrar si hay cambios sin guardar

### 3.2 Configuración por pestaña

Cada pestaña contiene:
- Method selector (GET, POST, PUT, DELETE, PATCH)
- URL input
- SSL toggle
- Config tabs: Headers, Auth, Body
- Body modes: Raw (JSON/Text), x-www-form-urlencoded, multipart/form-data
- Multipart support: text fields + file attachments (base64-encoded)
- Botones: Send, Save, Curl

### 3.3 Integración con Inventario

- Al ejecutar un request, si la URL coincide con una API en inventario, se registra automáticamente en estadísticas
- Desde el inventario, se puede "Abrir en Cliente" (crea pestaña con configuración pre-cargada)

---

## 4. Módulo 2: API Inventory

### 4.1 Navegación del Módulo

```
Inventory → Dashboard → Detalle de API → Pestañas de detalle
                ↓
         Modal "Descubrir"
```

### 4.2 Dashboard (`InventoryDashboard`)

#### Acciones principales
- **+ New API**: Crear API manualmente (formulario)
- **Descubrir**: Explorar y descubrir APIs automáticamente (múltiples métodos)

#### Filtros
- Proyecto (dropdown)
- Estado (active/inactive/deprecated)
- Búsqueda por nombre

#### Métricas Resumen
- Total de APIs
- APIs activas
- APIs inactivas
- Total de endpoints

#### Tarjetas de API
Cada tarjeta muestra:
- Indicador de estado (🟢 activo, 🟡 inactivo, 🔴 deprecated)
- Nombre de la API
- Método y path del endpoint principal
- Número total de llamadas
- Tiempo promedio de respuesta
- Botones: Ver, Editar, Abrir en Cliente

### 4.3 Sistema de Descubrimiento de APIs (`ApiDiscovery`)

Modal accesible desde el botón "Descubrir" en el dashboard. Permite encontrar APIs automáticamente mediante diferentes métodos de exploración.

#### 4.3.1 Métodos de Descubrimiento

##### Método 1: Desde Historial del Cliente (Básico)
- **Fuente**: Tabla `history` del módulo API Client
- **Lógica**: Analiza URLs ejecutadas, agrupa por dominio/base URL, identifica patrones de paths
- **Proceso**:
  1. Consulta `SELECT DISTINCT url, method FROM history`
  2. Extrae base URL (dominio + puerto) de cada URL
  3. Agrupa endpoints por base URL
  4. Detecta versionado (`/v1/`, `/v2/`, `/api/`)
  5. Muestra resultados para que el usuario seleccione cuáles crear
- **Resultado**: Lista de APIs candidatas con sus endpoints detectados
- **Ventaja**: No requiere conexión externa, usa datos ya existentes

##### Método 2: Exploración Swagger/OpenAPI (Intermedio)
- **Fuente**: URL base del API a explorar
- **Lógica**: Intenta encontrar archivos de documentación OpenAPI/Swagger
- **Proceso**:
  1. Recibe URL base del usuario (ej: `https://api.example.com`)
  2. Intenta acceder a endpoints comunes de documentación:
     - `/swagger.json`, `/swagger/v1/swagger.json`
     - `/api-docs`, `/openapi.json`, `/openapi.yaml`
     - `/docs/swagger.json`, `/api/swagger.json`
     - `/-/openapi.json` (GitLab style)
  3. Si encuentra un archivo OpenAPI válido, lo parsea
  4. Extrae: nombre, base URL, endpoints (method, path, descripción, parámetros)
  5. Muestra resultados para confirmación del usuario
- **Resultado**: API completa con todos los endpoints documentados
- **Ventaja**: Información rica y estructurada

##### Método 3: Crawling de Aplicación Web (Avanzado)
- **Fuente**: URL de una aplicación web
- **Lógica**: Navega la aplicación interceptando llamadas API
- **Proceso**:
  1. Recibe URL inicial de la aplicación
  2. Realiza request GET a la URL
  3. Analiza la respuesta buscando:
     - Links (`<a href>`) para seguir navegando
     - Scripts JavaScript que contengan endpoints
     - Formularios con URLs de acción
     - Meta tags con URLs de API
  4. Sigue links internos (mismo dominio) hasta profundidad configurable
  5. Registra todas las URLs encontradas que parezcan APIs
- **Resultado**: Mapa de endpoints de la aplicación
- **Ventaja**: Descubre APIs que no están documentadas

##### Método 4: Sondeo de Endpoints Comunes (Brute Force)
- **Fuente**: URL base del dominio
- **Lógica**: Prueba paths comunes de APIs para verificar si existen
- **Proceso**:
  1. Recibe URL base
  2. Prueba paths comunes con HEAD/GET:
     - Prefijos: `/api/`, `/v1/`, `/v2/`, `/v3/`, `/rest/`
     - Recursos: `/users`, `/items`, `/products`, `/orders`, `/auth`, `/login`
     - Health: `/health`, `/healthz`, `/status`, `/ping`
  3. Registra los que respondan (status 200-499, no 404/405)
  4. Para los encontrados, intenta inferir estructura
- **Resultado**: Lista de endpoints activos en el dominio
- **Ventaja**: Encuentra APIs no documentadas, útil para auditorías

#### 4.3.2 Flujo del Modal "Descubrir"

```
┌─────────────────────────────────────────────────────┐
│  Discover APIs                                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Method: [Select ▼]                                 │
│    ○ From API Client History                        │
│    ○ Swagger/OpenAPI Scanner                        │
│    ○ Web Application Crawler                        │
│    ○ Common Endpoint Probing                        │
│                                                     │
│  ── If History ──                                   │
│  (shows detected APIs from history automatically)   │
│                                                     │
│  ── If Swagger/Crawler/Probing ──                   │
│  Base URL: [https://api.example.com     ]           │
│  Depth: [3] (for crawler)                           │
│                                                     │
│  [ Start Discovery ]                                │
│                                                     │
│  ── Results ──                                      │
│  ☑ Users API    (12 endpoints)  /v1/users           │
│  ☑ Orders API   (8 endpoints)   /v1/orders          │
│  ☐ Auth Service (2 endpoints)   /auth               │
│                                                     │
│  [ Import Selected (3) ]  [ Cancel ]                │
└─────────────────────────────────────────────────────┘
```

#### 4.3.3 Modal de Confirmación

Antes de importar, muestra los resultados para que el usuario:
- Seleccione/deseleccione APIs individuales
- Edite el nombre propuesto
- Asigne proyecto y estado
- Revise los endpoints detectados

#### 4.3.4 Endpoints del Servidor

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/inventory/discover/history` | Descubrir desde historial del cliente |
| `POST` | `/api/inventory/discover/swagger` | Explorar Swagger/OpenAPI en URL |
| `POST` | `/api/inventory/discover/crawl` | Crawlear aplicación web |
| `POST` | `/api/inventory/discover/probe` | Sondear endpoints comunes |
| `POST` | `/api/inventory/discover/import` | Importar APIs descubiertas al inventario |

#### 4.3.5 Respuesta del Descubrimiento

```json
{
  "discovered": [
    {
      "name": "Users API",
      "base_url": "https://api.example.com",
      "endpoints": [
        { "method": "GET", "path": "/v1/users", "description": "List users" },
        { "method": "POST", "path": "/v1/users", "description": "Create user" }
      ],
      "source": "swagger",
      "confidence": "high"
    }
  ]
}
```

#### 4.3.6 Seguridad y Límites

- **Timeout máximo**: 30 segundos por exploración
- **Profundidad máxima de crawl**: 5 niveles
- **Rate limiting**: 1 request por segundo al explorar
- **Solo métodos safe**: GET/HEAD para probing (nunca POST/PUT/DELETE)
- **No envía credenciales** a endpoints descubiertos
- **Advertencia al usuario** antes de explorar URLs externas

### 4.4 Detalle de API (`ApiDetailView`)

Vista de detalle con pestañas:

#### Pestaña: Resumen (`ApiSummary`)
- Nombre, descripción, URL base, estado
- Estadísticas rápidas (llamadas totales, tasa de éxito, tiempo promedio)
- Últimas 10 actividades recientes
- Botón "Abrir en Cliente"

#### Pestaña: Endpoints (`ApiEndpoints`)
- Lista de endpoints registrados
- CRUD: crear, editar, eliminar endpoints
- Formulario por endpoint:
  - Method (GET, POST, PUT, DELETE, PATCH)
  - Path (ej: /users/:id)
  - Descripción
  - Request example (JSON)
  - Response example (JSON)
  - Error codes (JSON array: [{code, description}])
  - Notes (Markdown)

#### Pestaña: Dependencias (`ApiDependencies`)
- Visualización tipo grafo (SVG)
- Tipos de dependencia:
  - 📊 Datos (data): necesita resultado de otra API
  - 🔐 Auth (auth): comparte credenciales
  - 📁 Jerárquica (hierarchical): subrecurso
- CRUD para agregar/quitar dependencias

#### Pestaña: Documentación (`ApiDocumentation`)
- Editor Markdown con preview en vivo
- Renderizado de documentación formateada
- Versión de documentación
- Botones: Guardar, Exportar, Importar

#### Pestaña: Estadísticas (`ApiStatistics`)
- Gráfica de tiempos de respuesta (Recharts LineChart)
- Gráfica de tasa de éxito (Recharts BarChart)
- Tabla de resumen por endpoint
- Filtros de tiempo: 24h, 7 días, 30 días

### 4.4 Endpoints del Servidor

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/inventory` | Listar APIs (?project=&status=) |
| `POST` | `/api/inventory` | Crear API |
| `PUT` | `/api/inventory/:id` | Actualizar API |
| `DELETE` | `/api/inventory/:id` | Eliminar API |
| `GET` | `/api/inventory/:id/endpoints` | Listar endpoints |
| `POST` | `/api/inventory/:id/endpoints` | Crear endpoint |
| `PUT` | `/api/inventory/endpoints/:id` | Actualizar endpoint |
| `DELETE` | `/api/inventory/endpoints/:id` | Eliminar endpoint |
| `GET` | `/api/inventory/dependencies` | Listar dependencias |
| `POST` | `/api/inventory/dependencies` | Crear dependencia |
| `DELETE` | `/api/inventory/dependencies/:id` | Eliminar dependencia |
| `GET` | `/api/inventory/:id/stats` | Estadísticas de API |
| `GET` | `/api/inventory/stats/overview` | Resumen general |
| `GET` | `/api/inventory/activity` | Log de actividad |
| `POST` | `/api/inventory/track` | Registrar invocación |
| `GET` | `/api/inventory/export` | Exportar inventario completo |
| `POST` | `/api/inventory/import` | Importar inventario |

### 4.5 Integración con API Client

1. **Desde Inventario → Cliente**: Botón "Abrir en Cliente" crea pestaña con configuración pre-cargada
2. **Desde Cliente → Inventario**: Al guardar un request, opción "Agregar al Inventario"
3. **Tracking automático**: Al ejecutar un request, si la URL coincide con una API en inventario, se registra en estadísticas

---

## 5. Módulo 3: Load Testing

### 5.1 Configuración de Prueba

```
┌──────────────────────────────────────────────────────────┐
│ Prueba de Carga                                          │
├──────────────────────────────────────────────────────────┤
│ API: [Seleccionar API ▼]                                 │
│ Endpoint: [Seleccionar Endpoint ▼]                       │
│ URL: [https://api.example.com/users]                     │
│ Method: [GET ▼]                                          │
│ Headers: [Editor]                                         │
│ Body: [Editor]                                            │
├──────────────────────────────────────────────────────────┤
│ Configuración:                                           │
│ Concurrencia: [10] requests simultáneos                  │
│ Duración: [30] segundos                                  │
│ Ramp-up: [5] segundos (incremento gradual)               │
│ Intervalo: [0] ms entre requests (0 = sin delay)         │
├──────────────────────────────────────────────────────────┤
│                    [ Iniciar Prueba ]                     │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Ejecución en Tiempo Real

Durante la ejecución:

```
┌──────────────────────────────────────────────────────────┐
│ Ejecutando... ████████████░░░░░░░░ 60%   18s / 30s       │
├──────────────────────────────────────────────────────────┤
│ Requests: 1,245 / 2,000    Exito: 98.2%   RPM: 2,490    │
│ Tiempo promedio: 145ms     Actual: 132ms                 │
└──────────────────────────────────────────────────────────┘
```

### 5.3 Resultados

#### Resumen
- Total de requests, exitosos, fallidos
- Tiempos: promedio, min, max, P50, P90, P95, P99
- Requests por segundo
- Duración total

#### Gráficas
- **Distribución de tiempos** (histograma): Cuántos requests cayeron en cada rango
- **Línea de tiempo**: Tiempo de respuesta a lo largo de la prueba
- **Throughput**: Requests por segundo a lo largo de la prueba

#### Tabla de Errores
- Códigos de error y sus frecuencias

### 5.4 Historial de Pruebas

- Lista de pruebas anteriores
- Comparativa entre pruebas (¿mejoró o empeoró?)
- Botón "Repetir prueba" con la misma configuración

### 5.5 Integración con Inventario

- Los resultados se guardan y se asocian a la API en el inventario
- Las estadísticas del inventario se actualizan con los datos de las pruebas
- Se puede ver el historial de pruebas en la pestaña de estadísticas

### 5.6 Endpoints del Servidor

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/loadtest/run` | Ejecutar prueba de carga |
| `GET` | `/api/loadtest/results` | Historial de pruebas (?api_id=) |
| `GET` | `/api/loadtest/results/:id` | Detalle de una prueba |
| `DELETE` | `/api/loadtest/results/:id` | Eliminar resultado |

---

## 6. Base de Datos

### 6.1 Tablas Existentes (sin cambios)

- `history` — Historial de requests ejecutados
- `saved_requests` — Requests guardados
- `projects` — Proyectos (agrupación)
- `folders` — Carpetas (jerarquía dentro de proyectos)

### 6.2 Nuevas Tablas

#### `api_inventory`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER PK | ID autoincremental |
| `name` | TEXT NOT NULL | Nombre de la API |
| `description` | TEXT | Descripción |
| `base_url` | TEXT | URL base |
| `auth_type` | TEXT DEFAULT 'none' | Tipo de autenticación |
| `status` | TEXT DEFAULT 'active' | Estado: active, inactive, deprecated |
| `project` | TEXT DEFAULT 'Default' | Proyecto al que pertenece |
| `created_at` | DATETIME | Fecha de creación |
| `updated_at` | DATETIME | Última actualización |

#### `api_endpoints`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER PK | ID autoincremental |
| `api_id` | INTEGER FK | Referencia a api_inventory.id |
| `name` | TEXT | Nombre del endpoint |
| `method` | TEXT NOT NULL | Método HTTP |
| `path` | TEXT NOT NULL | Ruta (ej: /users/:id) |
| `description` | TEXT | Descripción |
| `request_example` | TEXT | Ejemplo de request (JSON) |
| `response_example` | TEXT | Ejemplo de respuesta (JSON) |
| `error_codes` | TEXT | Códigos de error (JSON array) |
| `notes` | TEXT | Notas en Markdown |
| `sort_order` | INTEGER DEFAULT 0 | Orden |
| `created_at` | DATETIME | Fecha de creación |
| `updated_at` | DATETIME | Última actualización |

#### `api_dependencies`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER PK | ID autoincremental |
| `source_api_id` | INTEGER FK | API que depende |
| `target_api_id` | INTEGER FK | API de la que depende |
| `dependency_type` | TEXT NOT NULL | Tipo: data, auth, hierarchical |
| `description` | TEXT | Descripción de la dependencia |
| `created_at` | DATETIME | Fecha de creación |

#### `api_statistics`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER PK | ID autoincremental |
| `api_id` | INTEGER FK | Referencia a api_inventory.id |
| `endpoint_id` | INTEGER FK | Referencia a api_endpoints.id (nullable) |
| `call_count` | INTEGER DEFAULT 0 | Total de llamadas |
| `success_count` | INTEGER DEFAULT 0 | Llamadas exitosas |
| `error_count` | INTEGER DEFAULT 0 | Llamadas con error |
| `avg_response_time` | REAL DEFAULT 0 | Tiempo promedio |
| `min_response_time` | REAL DEFAULT 999999 | Tiempo mínimo |
| `max_response_time` | REAL DEFAULT 0 | Tiempo máximo |
| `last_called_at` | DATETIME | Última llamada |
| `last_status` | INTEGER | Último código de estado |
| `last_response_time` | REAL | Último tiempo de respuesta |
| `updated_at` | DATETIME | Última actualización |

#### `api_activity_log`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER PK | ID autoincremental |
| `api_id` | INTEGER FK | Referencia a api_inventory.id |
| `endpoint_id` | INTEGER FK | Referencia a api_endpoints.id (nullable) |
| `action` | TEXT NOT NULL | Acción: call, save, edit, test |
| `status` | INTEGER | Código de estado HTTP |
| `response_time` | REAL | Tiempo de respuesta |
| `details` | TEXT | Detalles adicionales |
| `timestamp` | DATETIME | Fecha/hora |

#### `load_test_results`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER PK | ID autoincremental |
| `api_id` | INTEGER FK | Referencia a api_inventory.id |
| `endpoint_id` | INTEGER FK | Referencia a api_endpoints.id (nullable) |
| `url` | TEXT NOT NULL | URL probada |
| `method` | TEXT NOT NULL | Método HTTP |
| `concurrency` | INTEGER NOT NULL | Nivel de concurrencia |
| `total_requests` | INTEGER NOT NULL | Total de requests |
| `successful_requests` | INTEGER DEFAULT 0 | Requests exitosos |
| `failed_requests` | INTEGER DEFAULT 0 | Requests fallidos |
| `avg_response_time` | REAL | Tiempo promedio |
| `min_response_time` | REAL | Tiempo mínimo |
| `max_response_time` | REAL | Tiempo máximo |
| `p50_response_time` | REAL | Percentil 50 |
| `p90_response_time` | REAL | Percentil 90 |
| `p95_response_time` | REAL | Percentil 95 |
| `p99_response_time` | REAL | Percentil 99 |
| `requests_per_second` | REAL | Throughput |
| `duration_seconds` | REAL | Duración |
| `results_json` | TEXT | Detalle por request |
| `created_at` | DATETIME | Fecha de creación |

### 6.3 Columnas Nuevas en `saved_requests`

```sql
ALTER TABLE saved_requests ADD COLUMN api_id INTEGER;
ALTER TABLE saved_requests ADD COLUMN endpoint_id INTEGER;
```

---

## 7. Dependencias

### 7.1 Dependencias Existentes (sin cambios)

**Cliente:**
- react ^19.2.5
- react-dom ^19.2.5

**Servidor:**
- axios ^1.16.0
- better-sqlite3 ^12.9.0
- cors ^2.8.6
- dotenv ^17.4.2
- express ^5.2.1
- form-data ^4.0.1
- sqlite3 ^6.0.1

### 7.2 Nuevas Dependencias

**Cliente:**
- `recharts` — Gráficas para estadísticas y reportes
- `react-markdown` — Renderizado de documentación Markdown

**Servidor:**
- Sin dependencias nuevas

---

## 8. Diagrama de Componentes

```
App.tsx
├── Navegación Superior
│   ├── [API Client]
│   ├── [API Inventory]
│   └── [Load Testing]
│
├── API Client (funcionalidad existente)
│   ├── Sidebar
│   │   ├── History
│   │   └── Saved Requests
│   ├── Tab Bar (Chrome-style)
│   ├── Request Config
│   │   ├── Headers
│   │   ├── Auth
│   │   └── Body
│   └── Response Section
│
├── API Inventory
│   ├── InventoryDashboard
│   │   ├── Métricas Resumen
│   │   ├── Filtros
│   │   └── Tarjetas de API
│   └── ApiDetailView
│       ├── ApiSummary
│       ├── ApiEndpoints
│       ├── ApiDependencies
│       ├── ApiDocumentation
│       └── ApiStatistics
│
└── Load Testing
    ├── LoadTestConfig
    ├── LoadTestExecution
    ├── LoadTestResults
    └── LoadTestHistory
```

---

## 9. Casos de Uso

### CU-01: Registrar una nueva API en el inventario
1. Usuario navega a API Inventory
2. Hace clic en "+ Nueva API"
3. Completa: nombre, descripción, URL base, estado, proyecto
4. Guarda
5. La API aparece en el dashboard

### CU-02: Agregar endpoints a una API
1. Usuario selecciona una API del dashboard
2. Navega a pestaña "Endpoints"
3. Hace clic en "Agregar Endpoint"
4. Completa: method, path, descripción, ejemplos
5. Guarda

### CU-03: Definir dependencias entre APIs
1. Usuario selecciona una API
2. Navega a pestaña "Dependencias"
3. Hace clic en "Agregar Dependencia"
4. Selecciona API destino y tipo de dependencia
5. Guarda

### CU-04: Ejecutar request y registrar estadísticas
1. Usuario abre API Client
2. Selecciona o crea una pestaña
3. Ejecuta un request (Send)
4. El servidor:
   - Ejecuta el request
   - Guarda en historial
   - Si la URL coincide con una API en inventario, registra en api_statistics y api_activity_log
5. El cliente muestra la respuesta

### CU-05: Documentar una API
1. Usuario selecciona una API
2. Navega a pestaña "Documentación"
3. Escribe documentación en Markdown
4. Preview se actualiza en tiempo real
5. Guarda

### CU-06: Ver reportes de una API
1. Usuario selecciona una API
2. Navega a pestaña "Estadísticas"
3. Ve gráficas de tiempos de respuesta y tasas de éxito
4. Puede filtrar por rango de tiempo

### CU-07: Ejecutar prueba de carga
1. Usuario navega a Load Testing
2. Selecciona API y endpoint
3. Configura: concurrencia, duración, ramp-up
4. Hace clic en "Iniciar Prueba"
5. Ve progreso en tiempo real
6. Ve resultados al finalizar

### CU-08: Comparar pruebas de carga
1. Usuario navega a Load Testing
2. Ve historial de pruebas
3. Selecciona dos o más pruebas
4. Compara métricas

### CU-09: Exportar/Importar inventario
1. Usuario hace clic en "Exportar"
2. Se descarga JSON con todo el inventario
3. En otra instancia, hace clic en "Importar"
4. Selecciona el archivo JSON
5. El inventario se restaura

### CU-10: Abrir API desde inventario en el cliente
1. Usuario selecciona una API en el inventario
2. Hace clic en "Abrir en Cliente"
3. Se crea una pestaña en el módulo cliente con la configuración pre-cargada

---

## 10. Requisitos No Funcionales

- **Rendimiento**: El dashboard debe cargar en menos de 2 segundos
- **Usabilidad**: La navegación debe ser intuitiva sin documentación
- **Compatibilidad**: Chrome, Firefox, Edge (últimas 2 versiones)
- **Datos**: Persistencia en SQLite (servidor) + localStorage (pestañas del cliente)
- **Seguridad**: Sin autenticación en esta versión (próxima versión)

---

## 11. Restricciones

- No se requiere autenticación en esta versión
- Las estadísticas de uso son solo desde esta plataforma (no consumo externo)
- El servidor es un solo archivo (index.js)
- No se usan frameworks de componentes (todo es CSS custom)

---

## 12. Entregables

1. `specification.md` — Este documento
2. `plan.md` — Plan de implementación detallado
3. Código fuente del servidor (`server/index.js`)
4. Código fuente del cliente (`client/src/`)
5. Estilos CSS (`client/src/App.css`)
