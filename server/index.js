const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// SQLite Database Setup
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.run(`CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      method TEXT,
      url TEXT,
      headers TEXT,
      body TEXT,
      auth TEXT,
      status INTEGER,
      time TEXT,
      response_data TEXT,
      response_headers TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (!err) {
        db.run(`ALTER TABLE history ADD COLUMN response_data TEXT`, () => {});
        db.run(`ALTER TABLE history ADD COLUMN response_headers TEXT`, () => {});
      }
    });

    db.run(`CREATE TABLE IF NOT EXISTS saved_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      project TEXT DEFAULT 'Default',
      method TEXT,
      url TEXT,
      headers TEXT,
      body TEXT,
      auth TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (!err) {
        db.run(`ALTER TABLE saved_requests ADD COLUMN project TEXT DEFAULT 'Default'`, () => {});
        db.run(`ALTER TABLE saved_requests ADD COLUMN body_type TEXT DEFAULT 'raw'`, () => {});
        db.run(`ALTER TABLE saved_requests ADD COLUMN form_params TEXT`, () => {});
        db.run(`ALTER TABLE saved_requests ADD COLUMN ignore_ssl INTEGER DEFAULT 0`, () => {});
        db.run(`ALTER TABLE saved_requests ADD COLUMN response_status INTEGER`, () => {});
        db.run(`ALTER TABLE saved_requests ADD COLUMN response_time TEXT`, () => {});
        db.run(`ALTER TABLE saved_requests ADD COLUMN response_data TEXT`, () => {});
        db.run(`ALTER TABLE saved_requests ADD COLUMN response_headers TEXT`, () => {});
        db.run(`ALTER TABLE saved_requests ADD COLUMN sort_order INTEGER DEFAULT 0`, () => {});
        
        // New table for project metadata
        db.run(`CREATE TABLE IF NOT EXISTS projects (
          name TEXT PRIMARY KEY,
          sort_order INTEGER DEFAULT 0
        )`, () => {
          // Sync projects table with existing projects in saved_requests
          db.run(`INSERT OR IGNORE INTO projects (name) SELECT DISTINCT project FROM saved_requests`);
        });

        // Create folders table for nested folder support
        db.run(`CREATE TABLE IF NOT EXISTS folders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project TEXT NOT NULL,
          parent_id INTEGER,
          name TEXT NOT NULL,
          sort_order INTEGER DEFAULT 0
        )`, () => {
          db.run(`ALTER TABLE saved_requests ADD COLUMN folder_id INTEGER`, () => {});
        });
      }
    });
  }
});

// Proxy endpoint to execute requests
app.post('/api/execute', async (req, res) => {
  const { method, url, headers, data, auth, ignoreSSL } = req.body;
  const startTime = Date.now();

  try {
    const config = {
      method,
      url,
      headers: headers || {},
      data: data || undefined,
      validateStatus: () => true, // Don't throw on 4xx/5xx
      httpsAgent: ignoreSSL ? new https.Agent({ rejectUnauthorized: false }) : undefined,
    };

    // Handle Auth
    if (auth) {
      if (auth.type === 'bearer') {
        config.headers['Authorization'] = `Bearer ${auth.token}`;
      } else if (auth.type === 'basic') {
        const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
        config.headers['Authorization'] = `Basic ${credentials}`;
      } else if (auth.type === 'apikey') {
        if (auth.addTo === 'header') {
          config.headers[auth.key] = auth.value;
        } else {
          const urlObj = new URL(url);
          urlObj.searchParams.append(auth.key, auth.value);
          config.url = urlObj.toString();
        }
      }
    }

    const response = await axios(config);
    const duration = Date.now() - startTime;

    // Save to history
    db.run(
      `INSERT INTO history (method, url, headers, body, auth, status, time, response_data, response_headers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        method, 
        url, 
        JSON.stringify(headers), 
        typeof data === 'string' ? data : JSON.stringify(data), 
        JSON.stringify(auth), 
        response.status, 
        `${duration}ms`,
        JSON.stringify(response.data),
        JSON.stringify(response.headers)
      ]
    );

    res.json({
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
      time: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    res.status(500).json({
      error: error.message,
      time: `${duration}ms`,
    });
  }
});

app.get('/api/history', (req, res) => {
  db.all(`SELECT * FROM history ORDER BY timestamp DESC LIMIT 50`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.delete('/api/history', (req, res) => {
  db.run(`DELETE FROM history`, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'History cleared' });
  });
});

app.delete('/api/history/:id', (req, res) => {
  db.run(`DELETE FROM history WHERE id = ?`, [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'History item deleted' });
  });
});

app.get('/api/requests', (req, res) => {
  const sql = `
    SELECT r.*, IFNULL(p.sort_order, 999) as project_sort 
    FROM saved_requests r
    LEFT JOIN projects p ON r.project = p.name
    ORDER BY project_sort ASC, r.sort_order ASC, r.timestamp DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/requests', (req, res) => {
  const { name, project, method, url, headers, body, auth, bodyType, formParams, ignoreSSL, response, folderId } = req.body;
  db.run(
    `INSERT INTO saved_requests (name, project, method, url, headers, body, auth, body_type, form_params, ignore_ssl, response_status, response_time, response_data, response_headers, folder_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      project || 'Default',
      method,
      url,
      JSON.stringify(headers),
      typeof body === 'string' ? body : JSON.stringify(body),
      JSON.stringify(auth),
      bodyType || 'raw',
      formParams ? JSON.stringify(formParams) : null,
      ignoreSSL ? 1 : 0,
      response?.status ?? null,
      response?.time ?? null,
      response?.data ? JSON.stringify(response.data) : null,
      response?.headers ? JSON.stringify(response.headers) : null,
      folderId || null
    ],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: 'Request saved' });
    }
  );
});

app.put('/api/requests/:id', (req, res) => {
  const { name, project, method, url, headers, body, auth, bodyType, formParams, ignoreSSL, response, folderId } = req.body;
  db.run(
    `UPDATE saved_requests SET name=?, project=?, method=?, url=?, headers=?, body=?, auth=?, body_type=?, form_params=?, ignore_ssl=?, response_status=?, response_time=?, response_data=?, response_headers=?, folder_id=?, timestamp=CURRENT_TIMESTAMP WHERE id=?`,
    [
      name,
      project || 'Default',
      method,
      url,
      JSON.stringify(headers),
      typeof body === 'string' ? body : JSON.stringify(body),
      JSON.stringify(auth),
      bodyType || 'raw',
      formParams ? JSON.stringify(formParams) : null,
      ignoreSSL ? 1 : 0,
      response?.status ?? null,
      response?.time ?? null,
      response?.data ? JSON.stringify(response.data) : null,
      response?.headers ? JSON.stringify(response.headers) : null,
      folderId || null,
      req.params.id
    ],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: parseInt(req.params.id), message: 'Request updated' });
    }
  );
});

app.delete('/api/requests/:id', (req, res) => {
  db.run(`DELETE FROM saved_requests WHERE id = ?`, [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Saved request deleted' });
  });
});

app.post('/api/projects/reorder', (req, res) => {
  const { items } = req.body; // [{ name, sort_order }]
  if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Invalid items' });

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    const stmt = db.prepare(`INSERT OR REPLACE INTO projects (name, sort_order) VALUES (?, ?)`);
    items.forEach(item => {
      stmt.run(item.name, item.sort_order);
    });
    stmt.finalize();
    db.run('COMMIT', (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Projects reordered' });
    });
  });
});

app.post('/api/requests/reorder', (req, res) => {
  const { items } = req.body; // [{ id, sort_order }]
  if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Invalid items' });

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    const stmt = db.prepare(`UPDATE saved_requests SET sort_order = ? WHERE id = ?`);
    items.forEach(item => {
      stmt.run(item.sort_order, item.id);
    });
    stmt.finalize();
    db.run('COMMIT', (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Reordered' });
    });
  });
});

app.post('/api/requests/move', (req, res) => {
  const { id, project, targetId, folderId } = req.body;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    const updates = ['project = ?'];
    const params = [project];

    if (folderId !== undefined) {
      updates.push('folder_id = ?');
      params.push(folderId || null);
    }

    params.push(id);
    db.run(`UPDATE saved_requests SET ${updates.join(', ')} WHERE id = ?`, params, (err) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }

      // Get all items in target project (and folder if specified)
      let itemSql = `SELECT id FROM saved_requests WHERE project = ?`;
      const itemParams = [project];
      if (folderId !== undefined) {
        itemSql += ` AND (folder_id = ? OR (folder_id IS NULL AND ? IS NULL))`;
        itemParams.push(folderId, folderId);
      }
      itemSql += ` ORDER BY sort_order ASC, timestamp DESC`;

      db.all(itemSql, itemParams, (err, rows) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }

        let ids = rows.map(r => r.id);
        ids = ids.filter(i => i !== parseInt(id));

        if (targetId) {
          const idx = ids.indexOf(parseInt(targetId));
          if (idx !== -1) {
            ids.splice(idx, 0, parseInt(id));
          } else {
            ids.push(parseInt(id));
          }
        } else {
          ids.push(parseInt(id));
        }

        const stmt = db.prepare(`UPDATE saved_requests SET sort_order = ? WHERE id = ?`);
        ids.forEach((itemId, index) => {
          stmt.run(index, itemId);
        });
        stmt.finalize();

        db.run('COMMIT', (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'Moved and reordered' });
        });
      });
    });
  });
});

app.patch('/api/projects/rename', (req, res) => {
  const { oldName, newName } = req.body;
  if (!oldName || !newName) return res.status(400).json({ error: 'Missing names' });
  
  db.run(`UPDATE saved_requests SET project = ? WHERE project = ?`, [newName, oldName], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Project renamed' });
  });
});

app.delete('/api/projects/:name', (req, res) => {
  const projectName = req.params.name;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    db.run(`DELETE FROM saved_requests WHERE project = ?`, [projectName], (err) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }

      db.run(`DELETE FROM folders WHERE project = ?`, [projectName], (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }

        db.run(`DELETE FROM projects WHERE name = ?`, [projectName], (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }

          db.run('COMMIT', (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Project deleted' });
          });
        });
      });
    });
  });
});

app.patch('/api/requests/:id/project', (req, res) => {
  const { project } = req.body;
  db.run(`UPDATE saved_requests SET project = ? WHERE id = ?`, [project, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Request moved' });
  });
});

// Folder CRUD endpoints
app.get('/api/folders', (req, res) => {
  const { project } = req.query;
  let sql = `SELECT * FROM folders`;
  const params = [];
  if (project) {
    sql += ` WHERE project = ?`;
    params.push(project);
  }
  sql += ` ORDER BY sort_order ASC`;
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/folders', (req, res) => {
  const { project, parent_id, name } = req.body;
  if (!project || !name) return res.status(400).json({ error: 'project and name are required' });

  db.run(
    `INSERT INTO folders (project, parent_id, name) VALUES (?, ?, ?)`,
    [project, parent_id || null, name],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: 'Folder created' });
    }
  );
});

app.put('/api/folders/:id', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  db.run(`UPDATE folders SET name = ? WHERE id = ?`, [name, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Folder not found' });
    res.json({ message: 'Folder renamed' });
  });
});

app.delete('/api/folders/:id', (req, res) => {
  const folderId = req.params.id;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Move requests in this folder to the parent folder or project root
    db.get(`SELECT parent_id, project FROM folders WHERE id = ?`, [folderId], (err, folder) => {
      if (err || !folder) {
        db.run('ROLLBACK');
        return res.status(404).json({ error: 'Folder not found' });
      }

      // Move subfolders up one level
      db.run(`UPDATE folders SET parent_id = ? WHERE parent_id = ?`, [folder.parent_id, folderId]);

      // Move requests to parent folder (or null if root)
      db.run(`UPDATE saved_requests SET folder_id = ? WHERE folder_id = ?`, [folder.parent_id, folderId]);

      // Delete the folder
      db.run(`DELETE FROM folders WHERE id = ?`, [folderId], (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        db.run('COMMIT', (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'Folder deleted' });
        });
      });
    });
  });
});

app.post('/api/folders/reorder', (req, res) => {
  const { items } = req.body; // [{ id, sort_order }]
  if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Invalid items' });

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    const stmt = db.prepare(`UPDATE folders SET sort_order = ? WHERE id = ?`);
    items.forEach(item => {
      stmt.run(item.sort_order, item.id);
    });
    stmt.finalize();
    db.run('COMMIT', (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Folders reordered' });
    });
  });
});


// Build nested folder items for Postman export
const buildFolderItems = (folders, requests, parentId) => {
  const items = [];

  // Get child folders
  const childFolders = folders.filter(f => f.parent_id === parentId);
  childFolders.forEach(folder => {
    const folderItem = {
      name: folder.name,
      item: buildFolderItems(folders, requests, folder.id)
    };
    items.push(folderItem);
  });

  // Get requests in this folder level
  const folderRequests = requests.filter(r => r.folder_id === parentId);
  folderRequests.forEach(row => {
    items.push(toPostmanItem(row));
  });

  return items;
};

// Helper to transform SQLite row to Postman Item
const toPostmanItem = (row) => {
  const authObj = JSON.parse(row.auth || 'null');
  const headerObj = JSON.parse(row.headers || '{}');
  
  return {
    name: row.name,
    request: {
      method: row.method,
      url: { raw: row.url },
      header: Object.entries(headerObj).map(([key, value]) => ({ key, value, type: 'text' })),
      body: row.body ? {
        mode: row.body_type === 'form-urlencoded' ? 'urlencoded' : 'raw',
        raw: row.body_type === 'raw' ? row.body : undefined,
        urlencoded: row.body_type === 'form-urlencoded' ? JSON.parse(row.form_params || '[]').map(p => ({ key: p.key, value: p.value, type: 'text' })) : undefined
      } : undefined,
      auth: authObj ? {
        type: authObj.type,
        bearer: authObj.type === 'bearer' ? [{ key: 'token', value: authObj.token, type: 'string' }] : undefined,
        basic: authObj.type === 'basic' ? [
          { key: 'username', value: authObj.username, type: 'string' },
          { key: 'password', value: authObj.password, type: 'string' }
        ] : undefined,
        apikey: authObj.type === 'apikey' ? [
          { key: 'key', value: authObj.key, type: 'string' },
          { key: 'value', value: authObj.value, type: 'string' }
        ] : undefined
      } : undefined
    },
    response: row.response_data ? [{
      name: 'Last Response',
      originalRequest: { url: { raw: row.url }, method: row.method },
      status: 'OK',
      code: row.response_status,
      header: Object.entries(JSON.parse(row.response_headers || '{}')).map(([key, value]) => ({ key, value })),
      body: row.response_data
    }] : []
  };
};

app.get('/api/export', (req, res) => {
  db.all(`SELECT * FROM saved_requests ORDER BY project, sort_order ASC, timestamp DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(`SELECT * FROM folders ORDER BY sort_order ASC`, [], (err, folderRows) => {
      if (err) return res.status(500).json({ error: err.message });

      const projects = {};
      rows.forEach(row => {
        const proj = row.project || 'Default';
        if (!projects[proj]) projects[proj] = [];
        projects[proj].push(row);
      });

      const collection = {
        info: {
          name: 'API Client Export',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
        },
        item: Object.entries(projects).map(([projectName, requests]) => {
          const projectFolders = folderRows.filter(f => f.project === projectName);
          // Root-level requests (no folder) and root-level folders
          const rootRequests = requests.filter(r => !r.folder_id);
          const items = buildFolderItems(projectFolders, requests, null);
          // Prepend root requests before folder items
          return {
            name: projectName,
            item: [...rootRequests.map(toPostmanItem), ...items]
          };
        })
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=full-collection.json');
      res.send(JSON.stringify(collection, null, 2));
    });
  });
});

app.get('/api/export/:id', (req, res) => {
  db.get(`SELECT * FROM saved_requests WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Request not found' });

    const collection = {
      info: {
        name: row.name,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      item: [toPostmanItem(row)]
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${row.name}.json"`);
    res.send(JSON.stringify(collection, null, 2));
  });
});

app.get('/api/projects/:projectName/export', (req, res) => {
  db.all(`SELECT * FROM saved_requests WHERE project = ? ORDER BY sort_order ASC`, [req.params.projectName], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(`SELECT * FROM folders WHERE project = ? ORDER BY sort_order ASC`, [req.params.projectName], (err, folderRows) => {
      if (err) return res.status(500).json({ error: err.message });

      const rootRequests = rows.filter(r => !r.folder_id);
      const items = buildFolderItems(folderRows, rows, null);

      const collection = {
        info: {
          name: req.params.projectName,
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
        },
        item: [...rootRequests.map(toPostmanItem), ...items]
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.projectName}.json"`);
      res.send(JSON.stringify(collection, null, 2));
    });
  });
});

app.post('/api/import/check', (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Invalid items' });

  const placeholders = items.map(() => '(?, ?)').join(', ');
  const values = items.flatMap(item => [item.name, item.project]);

  db.all(
    `SELECT name, project FROM saved_requests WHERE (name, project) IN (${placeholders})`,
    values,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ conflicts: rows });
    }
  );
});

// Recursively create folders from import tree, calls onComplete when all done
const createImportFolders = (folders, project, parentId, parentPath, folderMap, onComplete) => {
  if (!folders || folders.length === 0) {
    if (onComplete) onComplete();
    return;
  }

  let pending = folders.length;
  let hasError = false;

  folders.forEach(f => {
    const currentPath = parentPath ? `${parentPath}/${f.name}` : f.name;
    db.run(`INSERT INTO folders (project, parent_id, name, sort_order) VALUES (?, ?, ?, ?)`,
      [project, parentId, f.name, f.sort_order || 0],
      function(err) {
        if (err) {
          hasError = true;
          pending--;
          if (pending === 0 && onComplete) onComplete();
          return;
        }
        const folderId = this.lastID;
        folderMap[currentPath] = folderId;
        if (f.children && f.children.length > 0) {
          createImportFolders(f.children, project, folderId, currentPath, folderMap, () => {
            pending--;
            if (pending === 0 && onComplete) onComplete();
          });
        } else {
          pending--;
          if (pending === 0 && onComplete) onComplete();
        }
      }
    );
  });
};

app.post('/api/import', (req, res) => {
  const { items, mode, folders } = req.body; // mode: 'overwrite' or 'skip'
  if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Invalid items' });

  const folderMap = {};

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let processed = 0;

  const runImport = () => {
    if (processed === items.length) {
      return res.json({ imported, updated, skipped });
    }

    const item = items[processed];
    processed++;

    const folderId = item.folderId || (item.folderPath ? folderMap[item.folderPath] : null) || null;

    db.get(`SELECT id FROM saved_requests WHERE name = ? AND project = ?`, [item.name, item.project], (err, row) => {
      if (err) return runImport();

      if (row) {
        if (mode === 'skip') {
          skipped++;
          runImport();
        } else {
          db.run(
            `UPDATE saved_requests SET method=?, url=?, headers=?, body=?, auth=?, body_type=?, form_params=?, ignore_ssl=?, response_status=?, response_time=?, response_data=?, response_headers=?, folder_id=?, timestamp=CURRENT_TIMESTAMP WHERE id=?`,
            [
              item.method, item.url, JSON.stringify(item.headers),
              typeof item.body === 'string' ? item.body : JSON.stringify(item.body),
              JSON.stringify(item.auth), item.bodyType || 'raw',
              item.formParams ? JSON.stringify(item.formParams) : null,
              item.ignoreSSL ? 1 : 0, item.response?.status ?? null,
              item.response?.time ?? null, item.response?.data ? JSON.stringify(item.response.data) : null,
              item.response?.headers ? JSON.stringify(item.response.headers) : null,
              folderId,
              row.id
            ],
            () => { updated++; runImport(); }
          );
        }
      } else {
        db.run(
          `INSERT INTO saved_requests (name, project, method, url, headers, body, auth, body_type, form_params, ignore_ssl, response_status, response_time, response_data, response_headers, folder_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.name, item.project, item.method, item.url, JSON.stringify(item.headers),
            typeof item.body === 'string' ? item.body : JSON.stringify(item.body),
            JSON.stringify(item.auth), item.bodyType || 'raw',
            item.formParams ? JSON.stringify(item.formParams) : null,
            item.ignoreSSL ? 1 : 0, item.response?.status ?? null,
            item.response?.time ?? null, item.response?.data ? JSON.stringify(item.response.data) : null,
            item.response?.headers ? JSON.stringify(item.response.headers) : null,
            folderId
          ],
          () => { imported++; runImport(); }
        );
      }
    });
  };

  if (folders && folders.length > 0) {
    const projects = [...new Set(items.map(i => i.project))];
    let pendingProjects = projects.length;

    projects.forEach(proj => {
      const projFolders = folders.filter(f => !f.project || f.project === proj);
      createImportFolders(projFolders, proj, null, null, folderMap, () => {
        pendingProjects--;
        if (pendingProjects === 0) {
          runImport();
        }
      });
    });
  } else {
    runImport();
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
