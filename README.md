# API Client

A web-based API client (similar to Postman) to test and interact with REST APIs directly from your browser. Built with React, TypeScript, and Node.js.

## Features

- **HTTP Methods**: GET, POST, PUT, DELETE, PATCH
- **Request Builder**: URL, headers, body (raw / form-urlencoded), auth (Bearer Token, Basic Auth, API Key)
- **Response Viewer**: JSON, XML, HTML, Text with syntax highlighting
- **History**: Auto-saves every request with response
- **Saved Requests**: Name and persist requests organized by projects
- **Import/Export**: Full compatibility with Postman Collection v2.1 format
- **Drag & Drop**: Reorder endpoints within projects and rearrange projects
- **SSL Bypass**: Ignore SSL certificate errors for local/dev APIs
- **Dark Theme**: Professional dark UI with responsive design

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Backend | Node.js, Express |
| Database | SQLite |
| Styling | Vanilla CSS (dark theme) |

## Quick Start

```bash
# Install dependencies
cd server && npm install
cd ../client && npm install

# Terminal 1: Start backend (port 3001)
cd server && node index.js

# Terminal 2: Start frontend (port 5173)
cd client && npm run dev
```

Open `http://localhost:5173` in your browser.

## Usage

1. Enter a URL and select HTTP method
2. Configure headers, body, or auth in the tabs below
3. Click **Send** to execute the request
4. View the response with status code, timing, and formatted body
5. Click **Save** to persist the request configuration
6. Access history in the **History** tab, saved requests in **Saved**

## Import / Export

This tool uses the **Postman Collection v2.1** format for interchange:

- **Export**: Click 📤 in the sidebar header (all), project header, or individual item
- **Import**: Click 📥 and select a `.json` Postman Collection file
- **Duplicate handling**: When importing existing requests, choose to **Overwrite** or **Skip**

## Project Structure

```
apiClient/
├── client/          # React + Vite frontend
│   └── src/
│       ├── App.tsx  # Main application component
│       └── App.css  # Styles
├── server/          # Express + SQLite backend
│   └── index.js     # API server (port 3001)
├── specification.md # Full project specification
└── HOW_TO_TEST.md   # Testing guide (Spanish)
```
