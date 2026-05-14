# API Client Web Application Specification

## 1. Project Overview
A web-based API client (similar to Postman) that allows users to test and interact with REST APIs directly from their local environment. The application will support standard HTTP methods, various authentication mechanisms, and provide rich response visualization.

## 2. Core Features

### 2.1 Request Builder
- **HTTP Methods:** Support for `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`.
- **URL Entry:** Input field for the target endpoint.
- **Headers:** Key-value pair editor for custom request headers.
- **Body:**
  - Support for `raw` content.
  - Built-in `JSON` editor with syntax highlighting.
- **Authorization Modes:**
  - **No Auth:** Default mode.
  - **Bearer Token:** Input for JWT/Tokens.
  - **API Key:** Key-value pairs with placement options (Header or Query Params).
  - **Basic Auth:** Username and Password fields (Base64 encoded automatically).

### 2.2 Response Viewer
- **Status Codes:** Display of HTTP status codes (e.g., 200 OK, 404 Not Found).
- **Execution Time:** Duration of the request.
- **Visualization Modes:**
  - **JSON:** Formatted and syntax-highlighted.
  - **XML:** Formatted and syntax-highlighted.
  - **HTML:** Rendered view or source code.
  - **Text:** Raw response body.
- **Headers:** View returned response headers.

### 2.3 History & Collections (Persistence)
- **Local Storage/Database:** Integration with **SQLite** to persist request history.
- **Save Invocations:** Ability to name and save specific requests for future reuse.
- **Enhanced Save Feature:** When saving, stores complete request configuration:
  - Method, URL, headers, body
  - Body type (raw/form-urlencoded) and form parameters
  - Ignore SSL flag
  - Last response data (status, time, response data, response headers)
- **Update Behavior:** Loading a saved request and clicking "Save" again updates the existing record instead of creating a duplicate.
- **History Sidebar:** Quickly access and re-run previous calls.

### 2.4 Export / Import (Postman Collection v2.1)
- **Export:**
  - Export all requests to a **Postman Collection v2.1** JSON file.
  - Export a single project group as a Postman Collection.
  - Export a single endpoint by ID.
- **Import:**
  - Import Postman Collection v2.1 JSON files.
  - Supports nested folders (converted to projects).
  - **Duplicate Detection:** If a request with the same `name + project` already exists, a modal allows choosing:
    - **Overwrite** — update the existing record.
    - **Skip** — leave the existing record untouched.
  - Full mapping of: method, URL, headers, body (raw & urlencoded), auth (bearer, basic, API key).

### 2.5 Drag & Drop Reordering
- **Endpoint Reordering:** Drag and drop individual saved requests to reorder them within a project or move them to another project.
- **Project Reordering:** Drag and drop project headers to reorder entire project groups.
- **Persistence:** Sort order is persisted in SQLite via `sort_order` column and `projects` table.

### 2.6 UI/UX Improvements
- **Sidebar Toggle:** Collapsed by default. Toggle button positioned inside the sidebar header (open) or fixed top-left (closed).
- **Sidebar Actions:** Import (📥) and Export (📤) buttons in sidebar header.
- **Visual Feedback:** Blue highlight line when dragging over a drop target (item or project).
- **Grab Cursor:** Project headers show grab/grabbing cursor during drag.

## 3. Technical Stack
- **Frontend:** React (TypeScript) for a modern, responsive UI.
- **Styling:** Vanilla CSS with a dark-themed, professional aesthetic (gradients, high-contrast interactive elements).
- **Backend/Proxy:** Node.js (Express) to handle cross-origin (CORS) requests and interact with SQLite.
- **Database:** SQLite for lightweight local persistence.

---

## 4. Implementation Plan (Sprints)

### Sprint 1: Foundation & UI Skeleton
- **Goal:** Set up the project structure and the basic layout.
- **Tasks:**
  - Initialize React + Express project.
  - Create the main layout (Sidebar for history, Header for URL, Main area for Request/Response).
  - Implement the Method Selector and URL bar.
  - Style with Vanilla CSS (Dark mode, interactive transitions).

### Sprint 2: Request Execution & Authentication
- **Goal:** Enable the ability to send real API requests.
- **Tasks:**
  - Implement the Express proxy to bypass CORS issues for local development.
  - Build the Header and Auth configuration panels.
  - Implement Bearer Token, API Key, and Basic Auth logic.
  - Connect the "Send" button to the backend executor.

### Sprint 3: Body Editor & Response Visualization
- **Goal:** Handle complex data and display results clearly.
- **Tasks:**
  - Integrate a JSON editor/viewer (or custom implementation with syntax highlighting).
  - Implement the Response Viewer tabs (Text, JSON, HTML, XML).
  - Add logic to auto-detect response types.
  - Implement timing and status code display.

### Sprint 4: Persistence (SQLite) & History
- **Goal:** Save and retrieve previous work.
- **Tasks:**
  - Set up SQLite database schema (Requests table).
  - Implement CRUD operations in the backend for saved requests.
  - Build the History Sidebar with "Click to Load" functionality.
  - Final UI polish and error handling (toast notifications for failed requests).

### Sprint 5: Testing & Final Polish
- **Goal:** Ensure stability and visual excellence.
- **Tasks:**
  - Unit testing for request transformation logic.
  - Integration testing for the proxy layer.
  - Final visual review (consistency in spacing, hover states, and accessibility).
