# Guía de Ejecución y Pruebas - API Client

Sigue estos pasos para poner en marcha la aplicación y probar sus funcionalidades.

## 1. Instalación de Dependencias
Si aún no lo has hecho, asegúrate de instalar las dependencias en ambas carpetas:

```bash
# En la raíz del proyecto
cd server
npm install
cd ../client
npm install
```

## 2. Ejecución de los Servicios
Necesitas ejecutar el backend y el frontend simultáneamente en dos terminales diferentes:

### Terminal 1: Backend (Server)
```bash
cd server
node index.js
```
*El servidor correrá en http://localhost:3001*

### Terminal 2: Frontend (Client)
```bash
cd client
npm run dev
```
*Vite te dará una URL (usualmente http://localhost:5173)*

---

## 3. Pruebas Recomendadas

### A. Prueba de Conectividad Básica
1. Abre la URL del cliente en tu navegador.
2. En la barra de URL, ingresa: `https://jsonplaceholder.typicode.com/posts/1`
3. Haz clic en **Send**.
4. Deberías ver la respuesta JSON en el visor inferior y una nueva entrada en el **History** (izquierda/arriba).

### B. Prueba de Métodos y Body (POST)
1. Cambia el método a **POST**.
2. URL: `https://jsonplaceholder.typicode.com/posts`
3. Ve a la pestaña **Body** e ingresa:
   ```json
   {
     "title": "Prueba Gemini",
     "body": "Contenido de prueba",
     "userId": 1
   }
   ```
4. Haz clic en **Send**.

### C. Prueba de Responsividad
1. Abre las herramientas de desarrollador en tu navegador (F12).
2. Activa la "Vista de dispositivo" (icono de móvil/tablet).
3. Reduce el ancho de la pantalla:
   - Verás cómo el **Sidebar** (History) se mueve a la parte superior.
   - Los botones y campos de entrada mantienen un tamaño cómodo para el dedo (44px).
   - No debería aparecer scroll horizontal.

### D. Prueba de Visualización
1. Prueba con una URL que devuelva HTML (ej: `https://www.google.com`).
2. Observa cómo el visor de respuesta cambia automáticamente a la pestaña **HTML**.

---

## 4. Notas de Desarrollo
- **CORS:** El backend actúa como proxy, por lo que puedes llamar a cualquier API sin preocuparte por bloqueos de CORS del navegador.
- **SQLite:** Los datos se guardan en `server/database.sqlite`. Si quieres reiniciar el historial, puedes borrar ese archivo.

---

## 5. Pruebas de Guardado y Actualización

### E. Prueba de Guardado Completo
1. Configura una solicitud con método POST, URL, headers y body.
2. Activa "Ignore SSL" si está disponible.
3. Haz clic en **Send** para obtener una respuesta.
4. Haz clic en **Save**.
5. Ingresa un nombre (ej: "Mi API Test") y proyecto (ej: "Pruebas").
6. Verifica que aparece en la pestaña **Saved** con el nombre dado.

### F. Prueba de Recuperación y Actualización
1. Haz clic en la solicitud guardada en la pestaña **Saved**.
2. Verifica que se restauran todos los datos: método, URL, headers, body, tipo de body, y la respuesta anterior.
3. Modifica algún dato (ej: cambia el body o agrega un header).
4. Haz clic en **Save** nuevamente.
5. Observa que: se actualiza el mismo registro (no crea uno nuevo) y el toast dice "Request updated successfully".
6. Vuelve a hacer clic en la solicitud para verificar que los cambios se guardaron.

### G. Prueba de Diferentes Tipos de Body
1. Selecciona método POST y ve a la pestaña **Body**.
2. Prueba con **Raw (JSON/Text)** y guarda la solicitud.
3. Carga esa solicitud y verifica que se restaura el modo "Raw".
4. Luego prueba con **x-www-form-urlencoded**, agrega parámetros y guarda.
5. Al cargar, verifica que se restauran los parámetros del formulario.

---

## 6. Pruebas de Exportación e Importación

### H. Exportación Completa
1. Ve a la pestaña **Saved** en el sidebar.
2. Haz clic en el botón **📤 Export** en la cabecera del sidebar.
3. Se descargará un archivo `full-collection.json`.
4. Abre el archivo y verifica que contiene todos tus proyectos como carpetas y todos los requests con método, URL, headers, body y auth.

### I. Exportación por Proyecto y por Endpoint
1. En la lista **Saved**, pasa el mouse sobre el encabezado de un proyecto.
2. Haz clic en el botón **📤** junto al nombre del proyecto.
3. Se descargará un archivo JSON solo con ese proyecto.
4. También exporta un endpoint individual haciendo clic en el icono **📤** que aparece al hover sobre cada request.

### J. Importación de Colección
1. Consigue un archivo de colección Postman v2.1 (o usa el exportado antes).
2. Haz clic en el botón **📥 Import** en la cabecera del sidebar.
3. Selecciona el archivo JSON.
4. Si hay conflictos (mismo nombre + proyecto), aparecerá un modal preguntando:
   - **Overwrite Duplicates:** Actualiza los existentes.
   - **Skip Duplicates:** Omite los duplicados y solo importa los nuevos.
5. Verifica el toast con el resumen (importados, actualizados, omitidos).

---

## 7. Pruebas de Reordenamiento (Drag & Drop)

### K. Reordenar Endpoints Dentro de un Proyecto
1. En la pestaña **Saved**, expande un proyecto con varios requests.
2. Arrastra un endpoint y suéltalo sobre otro para cambiar su posición.
3. Verifica la línea azul de feedback visual al pasar sobre el destino.
4. Recarga la página y verifica que el orden se mantiene.

### L. Mover Endpoint Entre Proyectos
1. Arrastra un endpoint y suéltalo sobre el encabezado de **otro** proyecto.
2. El endpoint se moverá al final de ese proyecto.
3. Verifica que aparece en el proyecto destino y desaparece del origen.

### M. Reordenar Proyectos Completos
1. Arrastra un encabezado de proyecto (cursor **grab**) y suéltalo sobre otro proyecto.
2. Los proyectos intercambian posiciones.
3. Recarga la página para verificar que el orden persiste.
