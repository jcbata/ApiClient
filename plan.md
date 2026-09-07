# Plan de Implementación - API Client & Inventory System

## Resumen Ejecutivo

El proyecto se implementará en **9 fases** secuenciales, cada una con entregables claros y independientes. El orden está diseñado para construir la infraestructura primero, luego las funcionalidades principales, y finalmente las integraciones.

| Fase | Descripción | Dependencias | Archivos Principales |
|------|-------------|--------------|----------------------|
| 1 | Base de datos + Navegación superior | Ninguna | server/index.js, App.tsx |
| 2 | Dashboard del Inventario | Fase 1 | InventoryDashboard.tsx |
| 2B | Descubrimiento de APIs (History, Swagger, Crawler, Probe) | Fase 1, 2 | ApiDiscovery.tsx, server endpoints |
| 3 | Detalle de API + Endpoints | Fase 2 | ApiDetailView.tsx, ApiEndpoints.tsx |
| 4 | Sistema de Dependencias | Fase 3 | ApiDependencies.tsx |
| 5 | Estadísticas + Tracking | Fase 3 | ApiStatistics.tsx, server track endpoint |
| 6 | Documentación Markdown | Fase 3 | ApiDocumentation.tsx |
| 7 | Reportes Generales | Fase 5 | Reportes en Dashboard |
| 8 | Módulo de Pruebas de Carga | Fase 1 | LoadTest*.tsx |
| 9 | Integración Final + Export/Import | Todas | Flujo completo |

---

## Fase 1: Base de datos y Navegación Superior

### Objetivo
Establecer la infraestructura de base de datos y la navegación entre módulos.

### Archivos a Modificar
- `server/index.js`
- `client/src/App.tsx`
- `client/src/App.css`

### Tareas

#### 1.1 Base de datos (server/index.js)

**Crear tablas nuevas:**
```sql
CREATE TABLE IF NOT EXISTS api_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  base_url TEXT,
  auth_type TEXT DEFAULT 'none',
  status TEXT DEFAULT 'active',
  project TEXT DEFAULT 'Default',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_endpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_id INTEGER NOT NULL,
  name TEXT,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  description TEXT,
  request_example TEXT,
  response_example TEXT,
  error_codes TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (api_id) REFERENCES api_inventory(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_api_id INTEGER NOT NULL,
  target_api_id INTEGER NOT NULL,
  dependency_type TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_api_id) REFERENCES api_inventory(id) ON DELETE CASCADE,
  FOREIGN KEY (target_api_id) REFERENCES api_inventory(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_id INTEGER NOT NULL,
  endpoint_id INTEGER,
  call_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  avg_response_time REAL DEFAULT 0,
  min_response_time REAL DEFAULT 999999,
  max_response_time REAL DEFAULT 0,
  last_called_at DATETIME,
  last_status INTEGER,
  last_response_time REAL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (api_id) REFERENCES api_inventory(id) ON DELETE CASCADE,
  FOREIGN KEY (endpoint_id) REFERENCES api_endpoints(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_id INTEGER NOT NULL,
  endpoint_id INTEGER,
  action TEXT NOT NULL,
  status INTEGER,
  response_time REAL,
  details TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (api_id) REFERENCES api_inventory(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS load_test_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_id INTEGER NOT NULL,
  endpoint_id INTEGER,
  url TEXT NOT NULL,
  method TEXT NOT NULL,
  concurrency INTEGER NOT NULL,
  total_requests INTEGER NOT NULL,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  avg_response_time REAL,
  min_response_time REAL,
  max_response_time REAL,
  p50_response_time REAL,
  p90_response_time REAL,
  p95_response_time REAL,
  p99_response_time REAL,
  requests_per_second REAL,
  duration_seconds REAL,
  results_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (api_id) REFERENCES api_inventory(id) ON DELETE CASCADE
);
```

**Agregar columnas a saved_requests:**
```sql
ALTER TABLE saved_requests ADD COLUMN api_id INTEGER;
ALTER TABLE saved_requests ADD COLUMN endpoint_id INTEGER;
```

**Endpoints CRUD básicos para api_inventory:**
- `GET /api/inventory` — Listar APIs
- `POST /api/inventory` — Crear API
- `PUT /api/inventory/:id` — Actualizar API
- `DELETE /api/inventory/:id` — Eliminar API

#### 1.2 Navegación superior (App.tsx)

**Agregar estado:**
```typescript
const [appMode, setAppMode] = useState<'client' | 'inventory' | 'loadtest'>('client');
```

**Agregar barra de navegación:**
```tsx
<nav className="app-nav">
  <button className={appMode === 'client' ? 'active' : ''} onClick={() => setAppMode('client')}>
    API Client
  </button>
  <button className={appMode === 'inventory' ? 'active' : ''} onClick={() => setAppMode('inventory')}>
    API Inventory
  </button>
  <button className={appMode === 'loadtest' ? 'active' : ''} onClick={() => setAppMode('loadtest')}>
    Load Testing
  </button>
</nav>
```

**Renderizado condicional:**
```tsx
{appMode === 'client' && <ApiClientView />}
{appMode === 'inventory' && <InventoryView />}
{appMode === 'loadtest' && <LoadTestView />}
```

#### 1.3 Estilos (App.css)

```css
.app-nav {
  display: flex;
  background: var(--bg-sidebar);
  border-bottom: 1px solid var(--border-color);
  padding: 0;
}

.app-nav button {
  flex: 1;
  padding: 0.8rem 1.5rem;
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 0.9rem;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.app-nav button:hover {
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.03);
}

.app-nav button.active {
  color: var(--accent-blue);
  border-bottom-color: var(--accent-blue);
}
```

### Entregables de Fase 1
- [ ] 6 tablas nuevas creadas en SQLite
- [ ] Columnas api_id y endpoint_id en saved_requests
- [ ] CRUD básico para api_inventory
- [ ] Navegación superior funcional
- [ ] Separación del código en componentes base

---

## Fase 2: Dashboard del Inventario

### Objetivo
Crear la vista principal del inventario con métricas resumen y tarjetas de APIs.

### Archivos a Crear
- `client/src/components/inventory/InventoryDashboard.tsx`

### Archivos a Modificar
- `client/src/App.tsx` (agregar routing al dashboard)
- `client/src/App.css` (estilos del dashboard)

### Tareas

#### 2.1 Filtros
- Dropdown de proyecto (carga de projects existentes)
- Dropdown de estado (active/inactive/deprecated/todos)
- Campo de búsqueda por nombre

#### 2.2 Métricas Resumen
- Tarjetas con: Total APIs, Activas, Inactivas, Total Endpoints
- Datos calculados desde `/api/inventory/stats/overview`

#### 2.3 Tarjetas de API
- Grid responsive de tarjetas
- Cada tarjeta muestra:
  - Indicador de estado (círculo de color)
  - Nombre
  - Método + path del endpoint principal
  - Número de llamadas
  - Tiempo promedio
  - Botones: Ver, Editar, Abrir en Cliente

#### 2.4 Botón "Nueva API"
- Modal/formulario para crear nueva API
- Campos: nombre, descripción, URL base, estado, proyecto

#### 2.5 Endpoints del servidor
- `GET /api/inventory/stats/overview` — Métricas resumen

### Entregables de Fase 2
- [ ] Dashboard con métricas resumen
- [ ] Tarjetas de API con información básica
- [ ] Filtros funcionales
- [ ] Modal de creación de API
- [ ] Botón "Descubrir" visible en el dashboard

---

## Fase 2B: Sistema de Ambientes + Descubrimiento de APIs

### Objetivo
Implementar el sistema de ambientes (Dev/QA/Prod) con agrupación por host, y el descubrimiento automático de APIs con importación interactiva.

### Archivos a Crear
- `client/src/components/inventory/ApiDiscovery.tsx` (modal principal)
- `client/src/components/inventory/DiscoveryHistory.tsx` (método desde historial)
- `client/src/components/inventory/DiscoverySwagger.tsx` (método Swagger/OpenAPI)
- `client/src/components/inventory/DiscoveryResults.tsx` (resultados, selección y ambientes)

### Archivos a Modificar
- `client/src/App.tsx` (estado de ambientes y descubrimiento)
- `client/src/App.css` (estilos de ambientes y modal)
- `server/index.js` (endpoints de ambientes y descubrimiento)

### Tareas

#### 2B.1 Tabla environments en SQLite
```sql
CREATE TABLE IF NOT EXISTS environments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'development',
  base_url TEXT,
  host TEXT,
  project TEXT DEFAULT 'Default',
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 2B.2 Columna environment_id en api_inventory
```sql
ALTER TABLE api_inventory ADD COLUMN environment_id INTEGER;
ALTER TABLE api_inventory ADD COLUMN detected_schema TEXT DEFAULT 'unknown';
```

#### 2B.3 Detección Automática de Ambiente
- Función server: `detectEnvironment(url)` retorna { type, host }
- Patrones de detección:
  - `localhost`, `127.0.0.1`, `*.local`, `*.dev` → development
  - `*.qa.*`, `*.staging.*`, `qa-*`, `staging-*` → qa
  - Cualquier otro → production
- Retorna host extraído (dominio + puerto)

#### 2B.4 CRUD de Ambientes (Server)
- `GET /api/environments` — Listar (filtro por project)
- `POST /api/environments` — Crear
- `PUT /api/environments/:id` — Actualizar
- `DELETE /api/environments/:id` — Eliminar
- `GET /api/environments/hosts` — Listar hosts únicos con su ambiente detectado

#### 2B.5 Filtro de Ambiente en Dashboard (Cliente)
- Selector de ambiente en la barra de filtros (All / Dev / QA / Prod)
- Agrupación visual de APIs por host/ambiente
- Badge de ambiente en cada API card (color: azul=naranja=verde)
- Al cambiar filtro, se filtra la lista de APIs

#### 2B.6 Endpoint: Descubrimiento desde Historial
- `POST /api/inventory/discover/history`
- Consulta tabla `history`, agrupa URLs por host
- Para cada host, detecta ambiente automáticamente
- Retorna APIs agrupadas por host con ambiente asignado

#### 2B.7 Endpoint: Explorador Swagger/OpenAPI
- `POST /api/inventory/discover/swagger`
- Recibe URL base, intenta documentos OpenAPI
- Parsea y extrae endpoints
- Detecta ambiente del host

#### 2B.8 Endpoint: Crawling de Aplicación Web
- `POST /api/inventory/discover/crawl`
- Recibe URL y profundidad (max 5)
- Sigue links internos, extrae endpoints API
- Detecta ambiente del host

#### 2B.9 Endpoint: Sondeo de Endpoints
- `POST /api/inventory/discover/probe`
- Recibe URL base, prueba paths comunes
- Retorna endpoints activos
- Detecta ambiente del host

#### 2B.10 Importación Interactiva con Ambientes
- `POST /api/inventory/discover/import`
- Recibe APIs seleccionadas + información de ambientes
- Para cada host nuevo:
  1. Verificar si ya existe ambiente con ese host
  2. Si no existe, crear con datos proporcionados por el usuario
- Crear APIs en `api_inventory` con `environment_id` y `detected_schema`
- Crear endpoints en `api_endpoints`

#### 2B.11 Modal de Descubrimiento (Cliente)
- Paso 1: Selector de método (History, Swagger, Crawler, Probe)
- Paso 2: Formulario dinámico según método
- Paso 3: Resultados con:
  - Agrupación por host
  - Selector de ambiente por host (existente o "New...")
  - Checkboxes para selección de APIs
  - Badge de esquema detectado
- Paso 4: Si hay hosts nuevos → modal de creación de ambiente
- Paso 5: Confirmación e importación

#### 2B.12 Flujo de Usuario

```
Dashboard
  │
  ├─ Filtro de ambiente (All | Dev | QA | Prod)
  │   └─ Filtra APIs mostradas
  │
  └─ Click "Descubrir"
      │
      ├─ Seleccionar método
      │
      ├─ [If History] → Resultados automáticos
      │   └─ Muestra APIs agrupadas por host
      │
      ├─ [If URL method] → Ingresar URL → Start
      │   └─ Progreso → Resultados
      │
      ├─ Resultados:
      │   ├─ api.example.com → Environment: [Production ▼]
      │   ├─ localhost:3000  → Environment: [Development ▼]
      │   └─ qa.company.com  → Environment: [New... → QA]
      │
      ├─ Si host nuevo → Modal:
      │   "Nuevo ambiente detectado: api.example.com"
      │   Nombre: [________]
      │   Tipo: [Production ▼]
      │   Proyecto: [Default ▼]
      │   [Crear]
      │
      └─ Click "Import Selected"
          └─ APIs creadas con ambiente y esquema
```

### Entregables de Fase 2B
- [ ] Tabla environments creada
- [ ] Columnas environment_id y detected_schema en api_inventory
- [ ] CRUD de ambientes
- [ ] Detección automática de ambiente por URL
- [ ] Filtro de ambiente en dashboard
- [ ] Agrupación visual por host
- [ ] Badge de ambiente en API cards
- [ ] Descubrimiento desde historial
- [ ] Explorador Swagger/OpenAPI
- [ ] Crawler de aplicaciones web
- [ ] Sondeo de endpoints comunes
- [ ] Modal de descubrimiento con pasos
- [ ] Importación interactiva con creación de ambientes
- [ ] Detección de esquema API (REST, GraphQL, etc.)

---

## Fase 3: Detalle de API + Endpoints

### Objetivo
Crear la vista de detalle de cada API con gestión de endpoints.

### Archivos a Crear
- `client/src/components/inventory/ApiDetailView.tsx`
- `client/src/components/inventory/ApiEndpoints.tsx`
- `client/src/components/inventory/ApiSummary.tsx`

### Archivos a Modificar
- `client/src/App.tsx`
- `client/src/App.css`

### Tareas

#### 3.1 ApiDetailView
- Cabecera con nombre, estado, botón "Volver"
- Pestañas: Resumen, Endpoints, Dependencias, Documentación, Estadísticas
- Botón "Abrir en Cliente"

#### 3.2 ApiSummary
- Información general de la API
- Estadísticas rápidas
- Últimas 10 actividades

#### 3.3 ApiEndpoints
- Lista de endpoints
- Formulario CRUD para endpoints
- Campos: method, path, descripción, request_example, response_example, error_codes, notes

#### 3.4 Endpoints del servidor
- `GET /api/inventory/:id/endpoints`
- `POST /api/inventory/:id/endpoints`
- `PUT /api/inventory/endpoints/:id`
- `DELETE /api/inventory/endpoints/:id`
- `GET /api/inventory/:id/stats`
- `GET /api/inventory/activity`

### Entregables de Fase 3
- [ ] Vista de detalle con pestañas
- [ ] Resumen de API
- [ ] CRUD completo de endpoints
- [ ] Actividad reciente

---

## Fase 4: Sistema de Dependencias

### Objetivo
Implementar la gestión y visualización de dependencias entre APIs.

### Archivos a Crear
- `client/src/components/inventory/ApiDependencies.tsx`

### Archivos a Modificar
- `client/src/App.css` (estilos del grafo)

### Tareas

#### 4.1 Grafo de Dependencias
- Visualización SVG con nodos y flechas
- Nodos: APIs (rectángulos con nombre y estado)
- Flechas: dependencias (con tipo: data, auth, hierarchical)
- Layout automático (jerárquico o force-directed simple)

#### 4.2 CRUD de Dependencias
- Formulario para agregar dependencia:
  - API destino (dropdown)
  - Tipo de dependencia (data/auth/hierarchical)
  - Descripción
- Botón eliminar en cada dependencia

#### 4.3 Leyenda de Tipos
- 📊 Datos (color azul)
- 🔐 Auth (color verde)
- 📁 Jerárquica (color naranja)

#### 4.4 Endpoints del servidor
- `GET /api/inventory/dependencies`
- `POST /api/inventory/dependencies`
- `DELETE /api/inventory/dependencies/:id`

### Entregables de Fase 4
- [ ] Grafo de dependencias visual
- [ ] CRUD de dependencias
- [ ] Leyenda de tipos

---

## Fase 5: Estadísticas y Tracking

### Objetivo
Implementar el sistema de estadísticas y tracking automático de invocaciones.

### Archivos a Crear
- `client/src/components/inventory/ApiStatistics.tsx`
- `client/src/components/common/StatusBadge.tsx`
- `client/src/components/common/MethodBadge.tsx`

### Archivos a Modificar
- `server/index.js` (endpoint track)
- `client/src/App.css`

### Tareas

#### 5.1 Tracking Automático
- Modificar endpoint `/api/execute` para:
  - Buscar si la URL coincide con una API en inventario
  - Si coincide, registrar en `api_statistics` (incrementar contadores, actualizar promedios)
  - Registrar en `api_activity_log`
  - Actualizar `last_called_at`, `last_status`, `last_response_time`

#### 5.2 ApiStatistics
- Gráfica de tiempos de respuesta (Recharts LineChart)
- Gráfica de tasa de éxito (Recharts BarChart)
- Tabla de resumen por endpoint
- Filtros de tiempo: 24h, 7 días, 30 días

#### 5.3 Endpoint de Estadísticas
- `GET /api/inventory/:id/stats` — Retorna estadísticas calculadas

#### 5.4 Endpoint de Tracking
- `POST /api/inventory/track` — Registra una invocación

### Entregables de Fase 5
- [ ] Tracking automático al ejecutar requests
- [ ] Gráficas de tiempos de respuesta
- [ ] Gráficas de tasas de éxito
- [ ] Tabla de resumen por endpoint

---

## Fase 6: Documentación Markdown

### Objetivo
Implementar el sistema de documentación con editor Markdown.

### Archivos a Crear
- `client/src/components/inventory/ApiDocumentation.tsx`

### Archivos a Modificar
- `client/src/App.css`

### Tareas

#### 6.1 Editor Markdown
- Textarea para escribir Markdown
- Preview en tiempo real (react-markdown)
- Layout split: editor a la izquierda, preview a la derecha

#### 6.2 Guardado de Documentación
- Guardar contenido Markdown en la tabla `api_endpoints` (campo `notes`)
- O crear tabla separada `api_documentation` si se necesita versionado

#### 6.3 Exportación de Documentación
- Botón "Exportar Documentación" → descarga archivo .md
- Botón "Importar Documentación" → carga archivo .md

#### 6.4 Dependencia
- Instalar `react-markdown` en el cliente

### Entregables de Fase 6
- [ ] Editor Markdown funcional
- [ ] Preview en tiempo real
- [ ] Guardado de documentación
- [ ] Export/Import de documentación

---

## Fase 7: Reportes Generales

### Objetivo
Crear reportes comparativos y generales del inventario.

### Archivos a Modificar
- `client/src/components/inventory/InventoryDashboard.tsx`
- `client/src/App.css`

### Tareas

#### 7.1 Reporte de Comparativa entre APIs
- Gráfico de barras comparando tiempos promedio
- Ranking de APIs más lentas/más rápidas
- Tasa de disponibilidad por API

#### 7.2 Reporte de Actividad Reciente
- Timeline de las últimas 50 acciones
- Filtros por API, tipo de acción, rango de fechas

#### 7.3 Reporte de Uso por Proyecto
- Gráfico de torta: distribución de llamadas por proyecto
- Tabla: APIs por proyecto con estadísticas

#### 7.4 Nueva Pestaña en Dashboard
- Agregar pestaña "Reportes" al lado de "Dashboard"

### Entregables de Fase 7
- [ ] Reporte comparativo de APIs
- [ ] Reporte de actividad reciente
- [ ] Reporte por proyecto

---

## Fase 8: Módulo de Pruebas de Carga

### Objetivo
Implementar el módulo de pruebas de concurrencia y tiempos de respuesta.

### Archivos a Crear
- `client/src/components/loadtest/LoadTestConfig.tsx`
- `client/src/components/loadtest/LoadTestExecution.tsx`
- `client/src/components/loadtest/LoadTestResults.tsx`
- `client/src/components/loadtest/LoadTestHistory.tsx`

### Archivos a Modificar
- `server/index.js` (endpoint de ejecución)
- `client/src/App.css`

### Tareas

#### 8.1 LoadTestConfig
- Formulario de configuración:
  - API (dropdown del inventario)
  - Endpoint (dropdown de endpoints de la API)
  - URL (auto-completada)
  - Method
  - Headers (editor key-value)
  - Body (textarea)
  - Concurrencia (number input)
  - Duración (number input, segundos)
  - Ramp-up (number input, segundos)
  - Intervalo (number input, ms)

#### 8.2 LoadTestExecution
- Barra de progreso
- Métricas en tiempo real:
  - Requests completados / total
  - Tasa de éxito
  - RPM (requests per minute)
  - Tiempo promedio actual
  - Tiempo transcurrido / total

#### 8.3 LoadTestResults
- Resumen de la prueba:
  - Total requests, exitosos, fallidos
  - Tiempos: avg, min, max, P50, P90, P95, P99
  - Requests per second
  - Duración
- Gráficas:
  - Histograma de distribución de tiempos
  - Línea de tiempo de respuestas
  - Throughput a lo largo de la prueba
- Tabla de errores

#### 8.4 LoadTestHistory
- Lista de pruebas anteriores
- Botón "Repetir prueba"
- Botón "Comparar" (seleccionar 2+ pruebas)

#### 8.5 Endpoints del servidor
- `POST /api/loadtest/run` — Ejecutar prueba
  - Recibe: url, method, headers, body, concurrency, duration, rampUp, interval
  - Ejecuta las requests en paralelo
  - Calcula métricas
  - Guarda en `load_test_results`
  - Retorna resultado
- `GET /api/loadtest/results` — Historial
- `GET /api/loadtest/results/:id` — Detalle
- `DELETE /api/loadtest/results/:id` — Eliminar

#### 8.6 Lógica de Ejecución (server)
```javascript
// Pseudocódigo para /api/loadtest/run
async function runLoadTest(config) {
  const results = [];
  const startTime = Date.now();
  const endTime = startTime + (config.duration * 1000);
  
  while (Date.now() < endTime) {
    const batch = [];
    for (let i = 0; i < config.concurrency; i++) {
      batch.push(executeRequest(config));
    }
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
  }
  
  // Calcular métricas
  const metrics = calculateMetrics(results);
  
  // Guardar en base de datos
  saveTestResult(config, metrics, results);
  
  return metrics;
}
```

### Entregables de Fase 8
- [ ] Formulario de configuración
- [ ] Ejecución en tiempo real
- [ ] Resultados con gráficas
- [ ] Historial de pruebas
- [ ] Repetición de pruebas

---

## Fase 9: Integración Final + Export/Import

### Objetivo
Integrar todos los módulos y agregar exportación/importación del inventario.

### Archivos a Modificar
- `client/src/App.tsx`
- `server/index.js`

### Tareas

#### 9.1 Flujo Inventario → Cliente
- Botón "Abrir en Cliente" en ApiDetailView
- Al hacer clic:
  1. Obtener endpoints de la API
  2. Seleccionar el endpoint principal (o el primero)
  3. Crear pestaña en el módulo cliente con:
     - Method del endpoint
     - URL = base_url + path
     - Headers pre-cargados si existen
     - Body pre-cargado si existe
  4. Cambiar a modo cliente

#### 9.2 Flujo Cliente → Inventario
- Al guardar un request, opción "Agregar al Inventario"
- Modal que pide:
  - Nombre de la API (si es nueva) o seleccionar API existente
  - Descripción del endpoint
  - Path del endpoint
- Crear/actualizar API y endpoint en inventario

#### 9.3 Export/Import del Inventario
- `GET /api/inventory/export` — Exporta todo el inventario como JSON:
  - APIs
  - Endpoints
  - Dependencias
  - Estadísticas
  - Documentación
- `POST /api/inventory/import` — Importa desde JSON:
  - Opciones: sobrescribir, omitir duplicados, fusionar
  - Manejo de conflictos (como el import de Postman actual)

#### 9.4 Integración de Pruebas de Carga con Inventario
- Al ejecutar una prueba de carga:
  1. Guardar resultado en `load_test_results`
  2. Actualizar estadísticas de la API en `api_statistics`
  3. Registrar en `api_activity_log` con action='test'

#### 9.5 Sincronización con Requests Guardados
- Cuando se crea una API en inventario, ofrecer vincular requests guardados existentes
- Cuando se vincula un request, actualizar `api_id` y `endpoint_id` en `saved_requests`

### Entregables de Fase 9
- [ ] "Abrir en Cliente" funcional
- [ ] "Agregar al Inventario" desde el cliente
- [ ] Export/Import del inventario completo
- [ ] Integración de pruebas de carga con inventario
- [ ] Sincronización con requests guardados

---

## Instalación de Dependencias

### Fase 1 (Navegación)
No requiere dependencias nuevas.

### Fase 5 (Estadísticas - Recharts)
```bash
cd client && npm install recharts
```

### Fase 6 (Documentación - React Markdown)
```bash
cd client && npm install react-markdown
```

---

## Estructura Final de Archivos

```
apiClient/
├── specification.md
├── plan.md
├── server/
│   ├── index.js                    (modificado - ~400 líneas nuevas)
│   ├── package.json
│   └── database.sqlite
├── client/
│   ├── package.json                (modificado - +2 dependencias)
│   ├── src/
│   │   ├── App.tsx                 (modificado - navegación + routing)
│   │   ├── App.css                 (modificado - +~500 líneas de estilos)
│   │   ├── main.tsx
│   │   └── components/
│   │       ├── inventory/
│   │       │   ├── InventoryDashboard.tsx    (nuevo)
│   │       │   ├── ApiDetailView.tsx         (nuevo)
│   │       │   ├── ApiSummary.tsx            (nuevo)
│   │       │   ├── ApiEndpoints.tsx          (nuevo)
│   │       │   ├── ApiDependencies.tsx       (nuevo)
│   │       │   ├── ApiDocumentation.tsx      (nuevo)
│   │       │   └── ApiStatistics.tsx         (nuevo)
│   │       ├── loadtest/
│   │       │   ├── LoadTestConfig.tsx        (nuevo)
│   │       │   ├── LoadTestExecution.tsx     (nuevo)
│   │       │   ├── LoadTestResults.tsx       (nuevo)
│   │       │   └── LoadTestHistory.tsx       (nuevo)
│   │       └── common/
│   │           ├── StatusBadge.tsx           (nuevo)
│   │           └── MethodBadge.tsx           (nuevo)
│   └── dist/                       (build de producción)
```

---

## Estimación de Esfuerzo

| Fase | Complejidad | Líneas de Código (aprox) |
|------|-------------|--------------------------|
| 1 | Media | ~300 (server) + ~100 (client) |
| 2 | Baja | ~200 |
| 2B | Alta | ~400 (server) + ~350 (client) |
| 3 | Media | ~400 |
| 4 | Alta | ~350 (incluye SVG) |
| 5 | Media | ~250 + ~100 (server) |
| 6 | Baja | ~150 |
| 7 | Media | ~200 |
| 8 | Alta | ~500 + ~200 (server) |
| 9 | Media | ~300 |
| **Total** | | **~3,600 líneas** |

---

## Criterios de Aceptación

### Fase 1
- [ ] Las 6 tablas nuevas existen en SQLite
- [ ] La navegación superior cambia entre módulos
- [ ] No se rompe la funcionalidad existente del cliente

### Fase 2
- [ ] El dashboard muestra métricas correctas
- [ ] Las tarjetas muestran información de cada API
- [ ] Los filtros funcionan correctamente
- [ ] Se puede crear una nueva API
- [ ] El botón "Descubrir" está visible en el dashboard

### Fase 2B
- [ ] La tabla environments existe y tiene datos de ejemplo
- [ ] El filtro de ambiente cambia las APIs mostradas en el dashboard
- [ ] Las APIs muestran badge de ambiente con color correcto
- [ ] Las APIs se agrupan visualmente por host/ambiente
- [ ] La detección automática de ambiente identifica Dev/QA/Prod correctamente
- [ ] El modal de descubrimiento muestra los 4 métodos
- [ ] Descubrimiento desde historial retorna APIs agrupadas por host
- [ ] Explorador Swagger encuentra y parsea documentos OpenAPI
- [ ] Crawler sigue links internos y extrae endpoints
- [ ] Sondeo prueba paths comunes y retorna los activos
- [ ] Los resultados muestran ambiente detectado por host
- [ ] Se pueden seleccionar APIs para importar
- [ ] La importación crea ambientes nuevos interactivamente
- [ ] Las APIs importadas tienen environment_id y detected_schema
- [ ] Se muestran errores y timeouts correctamente

### Fase 3
- [ ] La vista de detalle muestra toda la información de una API
- [ ] Se pueden crear, editar y eliminar endpoints
- [ ] La actividad reciente se muestra correctamente

### Fase 4
- [ ] El grafo de dependencias se renderiza correctamente
- [ ] Se pueden agregar y eliminar dependencias
- [ ] Los tipos de dependencia se muestran con colores diferentes

### Fase 5
- [ ] Al ejecutar un request, se registra en estadísticas (si la URL coincide)
- [ ] Las gráficas muestran datos correctos
- [ ] Los filtros de tiempo funcionan

### Fase 6
- [ ] El editor Markdown funciona
- [ ] El preview se actualiza en tiempo real
- [ ] Se puede exportar e importar documentación

### Fase 7
- [ ] Los reportes muestran datos correctos
- [ ] Las gráficas son interactivas
- [ ] Los filtros funcionan

### Fase 8
- [ ] Se puede configurar y ejecutar una prueba de carga
- [ ] Los resultados se muestran en tiempo real
- [ ] El historial保存 correctamente
- [ ] Se puede repetir una prueba

### Fase 9
- [ ] "Abrir en Cliente" crea una pestaña con configuración pre-cargada
- [ ] "Agregar al Inventario" crea/actualiza entrada
- [ ] Export/Import funciona correctamente
- [ ] Todo el flujo está integrado

---

## Notas de Implementación

### Convenciones de Código
- Mantener el estilo existente del proyecto
- Usar TypeScript para todos los componentes nuevos
- CSS inline solo para estilos dinámicos, lo demás en App.css
- Funciones del servidor en español (nombres de endpoints)
- Nombres de componentes en inglés (Convención React)

### Manejo de Errores
- Todos los endpoints del servidor deben retornar errores consistentes
- El cliente debe mostrar toast de error cuando algo falla
- La UI debe manejar estados de carga y vacío

### Performance
- Lazy loading de módulos (import dinámico)
- Paginación en listas grandes (>50 items)
- Debounce en búsquedas
- Memoización de componentes pesados

### Testing
- Cada fase debe ser verificable manualmente
- Los endpoints del servidor deben probarse con curl antes de integrar al cliente
- Las gráficas deben probarse con datos de ejemplo
