import { useState, useEffect, useRef } from 'react';
import './App.css';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
type ResponseTab = 'JSON' | 'Text' | 'HTML' | 'XML' | 'Headers';

interface KeyValue {
  key: string;
  value: string;
}

const commonHeaders: Record<string, string[]> = {
  'Content-Type': ['application/json', 'application/xml', 'text/plain', 'text/html', 'application/x-www-form-urlencoded', 'multipart/form-data'],
  'Accept': ['application/json', 'application/xml', 'text/plain', 'text/html', '*/*'],
  'Authorization': ['Bearer ', 'Basic ', ''],
  'Cache-Control': ['no-cache', 'no-store', 'max-age=0', 'public', 'private', 'no-transform'],
  'Content-Encoding': ['gzip', 'deflate', 'br'],
  'Content-Language': ['en-US', 'es-MX', 'fr-FR', 'de-DE', 'pt-BR'],
  'Accept-Language': ['en-US,en;q=0.9', 'es-MX,es;q=0.9', 'fr-FR,fr;q=0.9', '*'],
  'Accept-Encoding': ['gzip, deflate, br', 'gzip, deflate', 'identity', '*'],
  'Connection': ['keep-alive', 'close', 'upgrade'],
  'User-Agent': ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'PostmanRuntime/7.43.0', 'curl/8.0'],
  'X-Requested-With': ['XMLHttpRequest'],
  'Origin': ['http://localhost:5173', 'http://localhost:3001'],
  'Referer': ['http://localhost:5173/', 'http://localhost:3001/'],
  'Host': ['localhost:3001', 'localhost:5173', 'api.example.com'],
  'Cookie': [''],
  'Content-Length': [''],
  'If-Modified-Since': [''],
  'If-None-Match': [''],
  'X-API-Key': [''],
  'X-CSRF-Token': [''],
  'Access-Control-Allow-Origin': ['*', 'http://localhost:5173'],
  'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, PATCH, OPTIONS'],
  'Access-Control-Allow-Headers': ['Content-Type, Authorization'],
};

const allHeaderNames = Object.keys(commonHeaders);

function App() {
  const [method, setMethod] = useState<Method>('GET');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState<KeyValue[]>([{ key: '', value: '' }]);
  const [auth, setAuth] = useState({ type: 'none', token: '', username: '', password: '', key: '', value: '', addTo: 'header' });
  const [body, setBody] = useState('');
  const [bodyType, setBodyType] = useState<'raw' | 'form-urlencoded'>('raw');
  const [formParams, setFormParams] = useState<KeyValue[]>([{ key: '', value: '' }]);
  const [activeTab, setActiveTab] = useState<'Headers' | 'Auth' | 'Body'>('Headers');
  const [ignoreSSL, setIgnoreSSL] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [activeResTab, setActiveResTab] = useState<ResponseTab>('JSON');
  const [history, setHistory] = useState<any[]>([]);
  const [savedRequests, setSavedRequests] = useState<any[]>([]);
  const [editingSavedId, setEditingSavedId] = useState<number | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<number | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'History' | 'Saved'>('Saved');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(450);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({ Default: true });
  const [folders, setFolders] = useState<any[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<number, boolean>>({});
  const [importModal, setImportModal] = useState<{ show: boolean, items: any[], conflicts: any[], folderTree?: any[] }>({ show: false, items: [], conflicts: [] });

  const isResizing = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = e.clientX;
      if (newWidth > 150 && newWidth < 600) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = 'default';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const toggleProject = (projectName: string) => {
    setExpandedProjects(prev => ({ ...prev, [projectName]: !prev[projectName] }));
  };

  const toggleFolder = (folderId: number) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // Build a tree of folders for a given project
  const buildFolderTree = (projectName: string) => {
    const projectFolders = folders.filter(f => f.project === projectName);
    const buildChildren = (parentId: number | null): any[] => {
      return projectFolders
        .filter(f => f.parent_id === parentId)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(f => ({
          ...f,
          children: buildChildren(f.id)
        }));
    };
    return buildChildren(null);
  };

  // Get all folder IDs in a project (flat list for lookup)
  const getProjectFolderIds = (projectName: string): number[] => {
    return folders.filter(f => f.project === projectName).map(f => f.id);
  };

  // Get requests that belong directly to a folder (or root)
  const getFolderRequests = (requests: any[], folderId: number | null) => {
    return requests.filter(r => (r.folder_id || null) === folderId);
  };

  // Folder CRUD
  const handleCreateFolder = async (project: string, name: string, parentId?: number | null) => {
    if (!name) return;
    try {
      const res = await fetch('http://localhost:3001/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, name, parent_id: parentId || null })
      });
      if (!res.ok) throw new Error('Failed to create folder');
      await fetchFolders();
      showToast('Folder created');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleRenameFolder = async (id: number, currentName: string) => {
    const name = prompt('Enter new folder name:', currentName);
    if (!name || name === currentName) return;
    try {
      const res = await fetch(`http://localhost:3001/api/folders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error('Failed to rename folder');
      await fetchFolders();
      showToast('Folder renamed');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleDeleteFolder = async (id: number) => {
    if (!confirm('Delete this folder and move its contents up?')) return;
    try {
      const res = await fetch(`http://localhost:3001/api/folders/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete folder');
      await fetchFolders();
      await fetchSavedRequests();
      showToast('Folder deleted');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchSavedRequests();
    fetchFolders();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/history');
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.error('Failed to fetch history');
    }
  };

  const fetchSavedRequests = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/requests');
      const data = await res.json();
      setSavedRequests(data);
    } catch (e) {
      console.error('Failed to fetch saved requests');
    }
  };

  const fetchFolders = async (project?: string) => {
    try {
      const url = project
        ? `http://localhost:3001/api/folders?project=${encodeURIComponent(project)}`
        : 'http://localhost:3001/api/folders';
      const res = await fetch(url);
      const data = await res.json();
      setFolders(data);
    } catch (e) {
      console.error('Failed to fetch folders');
    }
  };

  const handleLoadRequest = (item: any, isSaved?: boolean) => {
    setEditingSavedId(isSaved ? item.id : null);
    setMethod(item.method as Method);
    setUrl(item.url);
    
    // Parse headers
    try {
      const parsedHeaders = JSON.parse(item.headers || '{}');
      const headerArray = Object.entries(parsedHeaders).map(([key, value]) => ({ key, value: value as string }));
      setHeaders(headerArray.length > 0 ? headerArray : [{ key: '', value: '' }]);
    } catch (e) {
      setHeaders([{ key: '', value: '' }]);
    }

    // Parse body
    try {
      if (item.body && item.body !== 'null' && item.body !== 'undefined') {
        const parsedBody = typeof item.body === 'string' && (item.body.startsWith('{') || item.body.startsWith('[')) 
          ? JSON.stringify(JSON.parse(item.body), null, 2)
          : item.body;
        setBody(parsedBody);
      } else {
        setBody('');
      }
    } catch (e) {
      setBody(item.body || '');
    }

    // Parse auth
    try {
      const parsedAuth = JSON.parse(item.auth || 'null');
      if (parsedAuth) {
        setAuth(parsedAuth);
      } else {
        setAuth({ type: 'none', token: '', username: '', password: '', key: '', value: '', addTo: 'header' });
      }
    } catch (e) {
      setAuth({ type: 'none', token: '', username: '', password: '', key: '', value: '', addTo: 'header' });
    }

    // Restore bodyType and formParams
    if (item.body_type) {
      setBodyType(item.body_type);
    }
    if (item.form_params) {
      try {
        const parsed = JSON.parse(item.form_params);
        setFormParams(Array.isArray(parsed) && parsed.length > 0 ? parsed : [{ key: '', value: '' }]);
      } catch (e) {
        setFormParams([{ key: '', value: '' }]);
      }
    } else {
      setFormParams([{ key: '', value: '' }]);
    }

    // Restore ignoreSSL
    setIgnoreSSL(item.ignore_ssl ? true : false);

    // Restore response if available
    if (item.response_data) {
      try {
        setResponse({
          status: item.response_status ?? item.status,
          time: item.response_time ?? item.time,
          data: JSON.parse(item.response_data),
          headers: JSON.parse(item.response_headers || '{}')
        });
      } catch (e) {
        console.error('Failed to parse response data');
      }
    } else {
      setResponse(null);
    }
  };

  const handleExport = () => {
    window.location.href = 'http://localhost:3001/api/export';
  };

  const handleExportProject = (projectName: string) => {
    window.location.href = `http://localhost:3001/api/projects/${encodeURIComponent(projectName)}/export`;
  };

  const handleExportItem = (id: number) => {
    window.location.href = `http://localhost:3001/api/export/${id}`;
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const parsePostmanCollection = (items: any[], project: string): { items: any[], folderTree: any[] } => {
    const parsedItems: any[] = [];

    const processItems = (postmanItems: any[], parentPath: string | null): any[] => {
      const folderNodes: any[] = [];
      let localSort = 0;

      postmanItems.forEach(item => {
        if (item.item) {
          // This is a folder
          const folderName = item.name || 'Untitled Folder';
          const currentPath = parentPath ? `${parentPath}/${folderName}` : folderName;

          // Recursively process children
          const children = processItems(item.item, currentPath);

          folderNodes.push({
            name: folderName,
            project,
            sort_order: localSort++,
            children
          });
        } else if (item.request) {
          const req = item.request;
          const method = req.method || 'GET';
          const url = typeof req.url === 'string' ? req.url : (req.url?.raw || '');
          const headerArray = Array.isArray(req.header) ? req.header.map((h: any) => ({ key: h.key, value: h.value })) : [];

          let body = '';
          let bodyType: 'raw' | 'form-urlencoded' = 'raw';
          let formParams: KeyValue[] = [{ key: '', value: '' }];

          if (req.body) {
            if (req.body.mode === 'raw') {
              body = req.body.raw || '';
            } else if (req.body.mode === 'urlencoded') {
              bodyType = 'form-urlencoded';
              formParams = (req.body.urlencoded || []).map((p: any) => ({ key: p.key, value: p.value }));
              if (formParams.length === 0) formParams = [{ key: '', value: '' }];
            } else if (req.body.mode === 'formdata') {
              bodyType = 'form-urlencoded';
              formParams = (req.body.formdata || [])
                .filter((p: any) => p.type === 'text')
                .map((p: any) => ({ key: p.key, value: p.value }));
              if (formParams.length === 0) formParams = [{ key: '', value: '' }];
            }
          }

          let auth = { type: 'none', token: '', username: '', password: '', key: '', value: '', addTo: 'header' };
          if (req.auth) {
            const atype = req.auth.type;
            if (atype === 'bearer') {
              auth.type = 'bearer';
              auth.token = req.auth.bearer?.[0]?.value || '';
            } else if (atype === 'basic') {
              auth.type = 'basic';
              auth.username = req.auth.basic?.find((a: any) => a.key === 'username')?.value || '';
              auth.password = req.auth.basic?.find((a: any) => a.key === 'password')?.value || '';
            } else if (atype === 'apikey') {
              auth.type = 'apikey';
              auth.key = req.auth.apikey?.find((a: any) => a.key === 'key')?.value || '';
              auth.value = req.auth.apikey?.find((a: any) => a.key === 'value')?.value || '';
            }
          }

          parsedItems.push({
            name: item.name || 'Untitled',
            project,
            folderPath: parentPath,
            method,
            url,
            headers: headerArray.reduce((acc: any, curr: any) => { if (curr.key) acc[curr.key] = curr.value; return acc; }, {}),
            body,
            bodyType,
            formParams,
            auth: auth.type === 'none' ? null : auth
          });
        }
      });

      return folderNodes;
    };

    const folderTree = processItems(items, null);
    return { items: parsedItems, folderTree };
  };

  const performImport = async (items: any[], mode: 'overwrite' | 'skip', folderTree?: any[]) => {
    try {
      const res = await fetch('http://localhost:3001/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, mode, folders: folderTree || [] })
      });
      const result = await res.json();
      fetchSavedRequests();
      fetchFolders();
      showToast(`Import finished: ${result.imported} new, ${result.updated} updated, ${result.skipped} skipped`);
      setImportModal({ show: false, items: [], conflicts: [] });
    } catch (e: any) {
      showToast('Import failed: ' + e.message, 'error');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const collection = JSON.parse(text);
      if (!collection.info || !collection.item) throw new Error('Invalid Postman Collection format');

      const projectName = collection.info.name || 'Imported';
      const { items, folderTree } = parsePostmanCollection(collection.item, projectName);

      // Check for conflicts
      const checkRes = await fetch('http://localhost:3001/api/import/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      const { conflicts } = await checkRes.json();

      if (conflicts && conflicts.length > 0) {
        setImportModal({ show: true, items, conflicts, folderTree });
      } else {
        await performImport(items, 'overwrite', folderTree);
      }

      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e: any) {
      showToast('Import failed: ' + e.message, 'error');
    }
  };

  const handleSaveRequest = async () => {
    const current = editingSavedId ? savedRequests.find(r => r.id === editingSavedId) : null;
    const name = prompt('Enter a name for this request:', current?.name || '');
    if (!name) return;
    const project = prompt('Enter project name (leave empty for "Default"):', current?.project || '') || 'Default';

    // Ask for optional folder path
    const projectFolders = folders.filter(f => f.project === project);
    let folderId: number | null = current?.folder_id || null;
    if (projectFolders.length > 0) {
      const folderNames = projectFolders.map(f => `${f.id}: ${f.name}`).join(', ');
      const folderInput = prompt(`Enter folder ID to save in (optional, available: ${folderNames}):`, folderId || '');
      if (folderInput) {
        const parsed = parseInt(folderInput);
        if (!isNaN(parsed) && projectFolders.some(f => f.id === parsed)) {
          folderId = parsed;
        }
      } else {
        folderId = null;
      }
    }

    const headerObj = headers.reduce((acc, curr) => {
      if (curr.key) acc[curr.key] = curr.value;
      return acc;
    }, {} as any);

    const validFormParams = formParams.filter(p => p.key);

    try {
      const endpoint = editingSavedId
        ? `http://localhost:3001/api/requests/${editingSavedId}`
        : 'http://localhost:3001/api/requests';
      const httpMethod = editingSavedId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method: httpMethod,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          project,
          method,
          url,
          headers: headerObj,
          body,
          bodyType,
          formParams: validFormParams,
          ignoreSSL,
          auth: auth.type === 'none' ? null : auth,
          response,
          folderId
        })
      });
      if (!res.ok) throw new Error('Failed to save request');
      setEditingSavedId(null);
      fetchSavedRequests();
      showToast(editingSavedId ? 'Request updated successfully' : 'Request saved successfully');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleDeleteHistory = async (id?: number) => {
    if (!id && !confirm('Clear all history?')) return;
    try {
      await fetch(`http://localhost:3001/api/history${id ? `/${id}` : ''}`, { method: 'DELETE' });
      fetchHistory();
      showToast(id ? 'History item deleted' : 'History cleared');
    } catch (e) {
      showToast('Failed to delete history', 'error');
    }
  };

  const handleDeleteSaved = async (id: number) => {
    if (!confirm('Delete this saved request?')) return;
    try {
      await fetch(`http://localhost:3001/api/requests/${id}`, { method: 'DELETE' });
      fetchSavedRequests();
      showToast('Saved request deleted');
    } catch (e) {
      showToast('Failed to delete saved request', 'error');
    }
  };

  const handleRenameProject = async (oldName: string) => {
    const newName = prompt('Enter new project name:', oldName);
    if (!newName || newName === oldName) return;

    try {
      const res = await fetch('http://localhost:3001/api/projects/rename', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName })
      });
      if (!res.ok) throw new Error('Failed to rename project');
      fetchSavedRequests();
      showToast('Project renamed');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleDeleteProject = async (projectName: string) => {
    if (!confirm(`Delete entire project "${projectName}" and all its requests and folders?`)) return;
    try {
      const res = await fetch(`http://localhost:3001/api/projects/${encodeURIComponent(projectName)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete project');
      fetchSavedRequests();
      fetchFolders();
      showToast(`Project "${projectName}" deleted`);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData('requestId', id.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleProjectDragStart = (e: React.DragEvent, projectName: string) => {
    e.dataTransfer.setData('projectName', projectName);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleProjectDrop = async (e: React.DragEvent, targetProject: string) => {
    e.preventDefault();
    (e.currentTarget as HTMLDivElement).classList.remove('drag-over');
    const sourceProject = e.dataTransfer.getData('projectName');
    if (!sourceProject || sourceProject === targetProject) return;

    // Get current order of projects
    const projectNames = Object.keys(groupedRequests);
    const sourceIdx = projectNames.indexOf(sourceProject);
    const targetIdx = projectNames.indexOf(targetProject);
    
    const newOrder = [...projectNames];
    newOrder.splice(sourceIdx, 1);
    const adjustedTarget = targetIdx > sourceIdx ? targetIdx - 1 : targetIdx;
    newOrder.splice(adjustedTarget, 0, sourceProject);

    try {
      const res = await fetch(`http://localhost:3001/api/projects/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          items: newOrder.map((name, index) => ({ name, sort_order: index })) 
        })
      });
      if (!res.ok) throw new Error('Failed to reorder projects');
      fetchSavedRequests();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleDrop = async (e: React.DragEvent, targetProject: string) => {
    e.preventDefault();
    const requestId = e.dataTransfer.getData('requestId');
    if (!requestId) return;

    try {
      const res = await fetch(`http://localhost:3001/api/requests/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: requestId, project: targetProject })
      });
      if (!res.ok) throw new Error('Failed to move request');
      fetchSavedRequests();
      showToast('Request moved');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleItemDrop = async (e: React.DragEvent, targetId: number, targetProject: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItemId(null);
    const requestId = e.dataTransfer.getData('requestId');
    if (!requestId || parseInt(requestId) === targetId) return;

    try {
      const res = await fetch(`http://localhost:3001/api/requests/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: requestId, project: targetProject, targetId })
      });
      if (!res.ok) throw new Error('Failed to reorder request');
      fetchSavedRequests();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleSend = async () => {
    if (!url) {
      showToast('Please enter a URL', 'error');
      return;
    }

    const headerObj = headers.reduce((acc, curr) => {
      if (curr.key) acc[curr.key] = curr.value;
      return acc;
    }, {} as any);

    let requestData = method !== 'GET' ? body : undefined;
    if (method !== 'GET' && bodyType === 'form-urlencoded') {
      const params = new URLSearchParams();
      formParams.forEach(p => {
        if (p.key) params.append(p.key, p.value);
      });
      requestData = params.toString();
      headerObj['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    try {
      const res = await fetch('http://localhost:3001/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          url,
          headers: headerObj,
          data: requestData,
          auth: auth.type === 'none' ? null : auth,
          ignoreSSL
        })
      });
      const data = await res.json();
      
      if (res.status === 500 && data.error) {
        showToast(data.error, 'error');
      }

      setResponse(data);
      fetchHistory();
      
      // Auto-switch response tab based on content type
      const contentType = data.headers?.['content-type'] || '';
      if (contentType.includes('html')) setActiveResTab('HTML');
      else if (contentType.includes('xml')) setActiveResTab('XML');
      else setActiveResTab('JSON');

    } catch (e: any) {
      setResponse({ error: e.message });
      showToast(e.message, 'error');
    }
  };

  const addHeader = () => setHeaders([...headers, { key: '', value: '' }]);
  const updateHeader = (index: number, field: 'key' | 'value', val: string) => {
    const newHeaders = [...headers];
    newHeaders[index][field] = val;
    setHeaders(newHeaders);
  };

  const formatContent = (content: any, type: ResponseTab) => {
    if (!content) return '';
    if (type === 'JSON') return JSON.stringify(content, null, 2);
    if (typeof content === 'object') return JSON.stringify(content, null, 2);
    return content.toString();
  };

  const groupedRequests = savedRequests.reduce((acc, curr) => {
    const proj = curr.project || 'Default';
    if (!acc[proj]) acc[proj] = [];
    acc[proj].push(curr);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className={`app-container ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`} style={{ '--sidebar-width': `${sidebarWidth}px` } as any}>
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
      
      <aside className="sidebar">
        <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? '✕' : '☰'}
        </button>
        <div className="sidebar-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>API Client</h2>
            {sidebarOpen && (
              <div className="sidebar-actions">
                <button className="icon-btn" title="Import Postman Collection" onClick={handleImportClick}>📥</button>
                <button className="icon-btn" title="Export Postman Collection" onClick={handleExport}>📤</button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  accept=".json" 
                  onChange={handleImportFile} 
                />
              </div>
            )}
          </div>
        </div>
        <div className="sidebar-tabs">
          <button className={`sidebar-tab ${sidebarTab === 'History' ? 'active' : ''}`} onClick={() => setSidebarTab('History')}>History</button>
          <button className={`sidebar-tab ${sidebarTab === 'Saved' ? 'active' : ''}`} onClick={() => setSidebarTab('Saved')}>Saved</button>
        </div>
        
        <div className="history-list">
          {sidebarTab === 'History' ? (
            <>
              <div className="list-header">
                <h3>Recent Activity</h3>
                {history.length > 0 && <button className="clear-btn" onClick={() => handleDeleteHistory()}>Clear</button>}
              </div>
              {history.length === 0 && <p style={{color: '#666', fontSize: '0.9rem', padding: '1rem'}}>No history yet</p>}
              {history.map((item) => (
                  <div key={item.id} className="history-item" onClick={() => handleLoadRequest(item, false)}>
                  <div className="history-item-content">
                    <span className={`method-tag ${item.method}`}>{item.method}</span>
                    <span className="history-url">{item.url}</span>
                  </div>
                  <button className="delete-item-btn" onClick={(e) => { e.stopPropagation(); handleDeleteHistory(item.id); }}>×</button>
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="list-header">
                <h3>Projects</h3>
              </div>
              {Object.keys(groupedRequests).length === 0 && <p style={{color: '#666', fontSize: '0.9rem', padding: '1rem'}}>No saved requests</p>}
              {(Object.entries(groupedRequests) as any).map(([projectName, requests]: [string, any[]]) => {
                const folderTree = buildFolderTree(projectName);
                const rootRequests = getFolderRequests(requests, null);

                const renderFolder = (folder: any, depth: number): JSX.Element => (
                  <div key={folder.id} className="folder-group" style={{ marginLeft: `${depth * 12}px` }}>
                    <div
                      className="folder-header"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('folderId', folder.id.toString());
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                    >
                      <div className="folder-header-main" onClick={() => toggleFolder(folder.id)}>
                        <span>{expandedFolders[folder.id] ? '▼' : '▶'}</span>
                        <span className="folder-icon">📁</span>
                        <strong>{folder.name}</strong>
                      </div>
                      <div style={{display: 'flex', gap: '0.2rem'}}>
                        <button className="icon-btn-xs" onClick={(e) => { e.stopPropagation(); handleCreateFolder(projectName, prompt('Folder name:') || '', folder.id); }} title="New Subfolder">+</button>
                        <button className="icon-btn-xs" onClick={(e) => { e.stopPropagation(); handleRenameFolder(folder.id, folder.name); }} title="Rename">✎</button>
                        <button className="icon-btn-xs" onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }} title="Delete">×</button>
                      </div>
                    </div>
                    {expandedFolders[folder.id] && (
                      <div className="folder-items">
                        {folder.children.map((child: any) => renderFolder(child, depth + 1))}
                        {getFolderRequests(requests, folder.id).map((item: any) => (
                          <div
                            key={item.id}
                            className={`history-item draggable ${dragOverItemId === item.id ? 'drag-over' : ''}`}
                            style={{ marginLeft: `${(depth + 1) * 12}px` }}
                            onClick={() => handleLoadRequest(item, true)}
                            draggable
                            onDragStart={(e) => handleDragStart(e, item.id)}
                            onDragOver={(e) => { e.preventDefault(); setDragOverItemId(item.id); }}
                            onDragLeave={() => setDragOverItemId(null)}
                            onDrop={(e) => handleItemDrop(e, item.id, item.project || 'Default')}
                          >
                            <div className="history-item-content">
                              <div className="saved-name">{item.name}</div>
                              <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                                <span className={`method-tag ${item.method}`} style={{fontSize: '0.7rem'}}>{item.method}</span>
                                <span className="history-url" style={{fontSize: '0.75rem'}}>{item.url}</span>
                              </div>
                            </div>
                            <div className="item-actions">
                              <button className="icon-btn-sm action-btn" onClick={(e) => { e.stopPropagation(); handleExportItem(item.id); }} title="Export Request">📤</button>
                              <button className="delete-item-btn action-btn" onClick={(e) => { e.stopPropagation(); handleDeleteSaved(item.id); }}>×</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );

                return (
                  <div 
                    key={projectName} 
                    className="project-group"
                    onDragOver={(e) => { 
                      e.preventDefault();
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.types.includes('projectName')) {
                        (e.currentTarget as HTMLDivElement).classList.add('drag-over');
                      }
                    }}
                    onDragLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).classList.remove('drag-over');
                    }}
                    onDrop={(e) => {
                      if (e.dataTransfer.getData('projectName')) {
                        handleProjectDrop(e, projectName);
                      } else {
                        handleDrop(e, projectName);
                      }
                      (e.currentTarget as HTMLDivElement).classList.remove('drag-over');
                    }}
                  >
                    <div 
                      className="project-header"
                      draggable
                      onDragStart={(e) => handleProjectDragStart(e, projectName)}
                    >
                      <div className="project-header-main" onClick={() => toggleProject(projectName)}>
                        <span>{expandedProjects[projectName] ? '▼' : '▶'}</span>
                        <strong>{projectName}</strong>
                        <span className="project-count">({requests.length})</span>
                      </div>
                      <div style={{display: 'flex', gap: '0.3rem'}}>
                        <button className="icon-btn-sm" onClick={(e) => { e.stopPropagation(); handleCreateFolder(projectName, prompt('Folder name:') || ''); }} title="New Folder">📁+</button>
                        <button className="icon-btn-sm" onClick={(e) => { e.stopPropagation(); handleExportProject(projectName); }} title="Export Project">📤</button>
                        <button className="rename-btn" onClick={(e) => { e.stopPropagation(); handleRenameProject(projectName); }} title="Rename Project">✎</button>
                        <button className="delete-project-btn" onClick={(e) => { e.stopPropagation(); handleDeleteProject(projectName); }} title="Delete Project">🗑</button>
                      </div>
                    </div>
                    {expandedProjects[projectName] && (
                      <div className="project-items">
                        {folderTree.map((folder: any) => renderFolder(folder, 0))}
                        {rootRequests.map((item: any) => (
                          <div 
                            key={item.id} 
                            className={`history-item draggable ${dragOverItemId === item.id ? 'drag-over' : ''}`}
                            onClick={() => handleLoadRequest(item, true)}
                            draggable
                            onDragStart={(e) => handleDragStart(e, item.id)}
                            onDragOver={(e) => { e.preventDefault(); setDragOverItemId(item.id); }}
                            onDragLeave={() => setDragOverItemId(null)}
                            onDrop={(e) => handleItemDrop(e, item.id, item.project || 'Default')}
                          >
                            <div className="history-item-content">
                              <div className="saved-name">{item.name}</div>
                              <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                                <span className={`method-tag ${item.method}`} style={{fontSize: '0.7rem'}}>{item.method}</span>
                                <span className="history-url" style={{fontSize: '0.75rem'}}>{item.url}</span>
                              </div>
                            </div>
                            <div className="item-actions">
                              <button className="icon-btn-sm action-btn" onClick={(e) => { e.stopPropagation(); handleExportItem(item.id); }} title="Export Request">📤</button>
                              <button className="delete-item-btn action-btn" onClick={(e) => { e.stopPropagation(); handleDeleteSaved(item.id); }}>×</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
        <div className="resizer" onMouseDown={() => { isResizing.current = true; document.body.style.cursor = 'col-resize'; }} />
      </aside>

      <main className="main-content">
        <header className="request-header">
          <select className="method-select" value={method} onChange={(e) => setMethod(e.target.value as Method)}>
            <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option><option>PATCH</option>
          </select>
          <input type="text" className="url-input" placeholder="https://api.example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
          <div className="ssl-toggle">
            <input 
              type="checkbox" 
              id="ignoreSSL" 
              checked={ignoreSSL} 
              onChange={(e) => setIgnoreSSL(e.target.checked)} 
            />
            <label htmlFor="ignoreSSL">Ignore SSL</label>
          </div>
          <div style={{display: 'flex', gap: '0.5rem'}}>
            <button className="send-button" onClick={handleSend}>Send</button>
            <button className="send-button" style={{background: '#444'}} onClick={handleSaveRequest}>Save</button>
          </div>
        </header>

        <div className="workspace-grid">
          <section className="request-config">
            <div className="tabs">
              {(['Headers', 'Auth', 'Body'] as const).map(tab => (
                <div key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</div>
              ))}
            </div>
            <div className="tab-content">
              {activeTab === 'Headers' && (
                <div className="kv-editor">
                  {headers.map((h, i) => (
                    <div key={i} className="kv-row">
                      <input
                        placeholder="Key"
                        list={`header-keys-${i}`}
                        value={h.key}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateHeader(i, 'key', val);
                          // Auto-fill a default value if the key is known and value is empty
                          if (val && commonHeaders[val] && !headers[i].value) {
                            const suggested = commonHeaders[val].find(v => v !== '');
                            if (suggested) updateHeader(i, 'value', suggested);
                          }
                        }}
                      />
                      <datalist id={`header-keys-${i}`}>
                        {allHeaderNames.map(name => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                      <input
                        placeholder="Value"
                        list={`header-vals-${i}`}
                        value={h.value}
                        onChange={(e) => updateHeader(i, 'value', e.target.value)}
                      />
                      <datalist id={`header-vals-${i}`}>
                        {commonHeaders[h.key]?.map(v => (
                          <option key={v} value={v} />
                        ))}
                      </datalist>
                    </div>
                  ))}
                  <button className="send-button" style={{maxWidth: '150px', background: '#333'}} onClick={addHeader}>+ Add Header</button>
                </div>
              )}
              {activeTab === 'Auth' && (
                <div className="auth-editor">
                  <select value={auth.type} onChange={(e) => setAuth({ ...auth, type: e.target.value })}>
                    <option value="none">No Auth</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="apikey">API Key</option>
                    <option value="basic">Basic Auth</option>
                  </select>
                  {auth.type === 'bearer' && <input placeholder="Token" value={auth.token} onChange={(e) => setAuth({ ...auth, token: e.target.value })} />}
                  {auth.type === 'basic' && (
                    <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                      <input placeholder="Username" value={auth.username} onChange={(e) => setAuth({ ...auth, username: e.target.value })} />
                      <input type="password" placeholder="Password" value={auth.password} onChange={(e) => setAuth({ ...auth, password: e.target.value })} />
                    </div>
                  )}
                  {auth.type === 'apikey' && (
                    <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                      <input placeholder="Key" value={auth.key} onChange={(e) => setAuth({ ...auth, key: e.target.value })} />
                      <input placeholder="Value" value={auth.value} onChange={(e) => setAuth({ ...auth, value: e.target.value })} />
                      <select value={auth.addTo} onChange={(e) => setAuth({ ...auth, addTo: e.target.value })}>
                        <option value="header">Header</option><option value="query">Query Params</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'Body' && (
                <div className="body-editor">
                  <div className="body-type-selector">
                    <label>
                      <input type="radio" name="bodyType" checked={bodyType === 'raw'} onChange={() => setBodyType('raw')} /> Raw (JSON/Text)
                    </label>
                    <label>
                      <input type="radio" name="bodyType" checked={bodyType === 'form-urlencoded'} onChange={() => setBodyType('form-urlencoded')} /> x-www-form-urlencoded
                    </label>
                  </div>

                  {bodyType === 'raw' ? (
                    <textarea 
                      className="body-textarea" 
                      placeholder='{"key": "value"}'
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                    />
                  ) : (
                    <div className="kv-editor">
                      {formParams.map((p, i) => (
                        <div key={i} className="kv-row">
                          <input placeholder="Key" value={p.key} onChange={(e) => {
                            const newParams = [...formParams];
                            newParams[i].key = e.target.value;
                            setFormParams(newParams);
                          }} />
                          <input placeholder="Value" value={p.value} onChange={(e) => {
                            const newParams = [...formParams];
                            newParams[i].value = e.target.value;
                            setFormParams(newParams);
                          }} />
                          <button className="clear-btn" onClick={() => {
                            setFormParams(formParams.filter((_, idx) => idx !== i));
                          }}>×</button>
                        </div>
                      ))}
                      <button className="send-button" style={{maxWidth: '150px', background: '#333'}} onClick={() => setFormParams([...formParams, { key: '', value: '' }])}>+ Add Parameter</button>
                    </div>
                  )}
                </div>
              )}

            </div>
          </section>

          <section className="response-section">
            <div className="response-header">
              <strong>Response</strong>
              {response && (
                <div className="response-meta">
                  <span className="status-code">Status: {response.status}</span>
                  <span style={{ color: '#aaa', marginLeft: '1rem' }}>Time: {response.time}</span>
                </div>
              )}
            </div>
            <div className="response-body-container">
              <div className="response-tabs">
                {(['JSON', 'Text', 'HTML', 'XML', 'Headers'] as const).map(tab => (
                  <div 
                    key={tab} 
                    className={`response-tab ${activeResTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveResTab(tab)}
                  >
                    {tab}
                  </div>
                ))}
              </div>
              <div className="response-content">
                {response ? (
                  <pre>
                    {activeResTab === 'Headers' 
                      ? JSON.stringify(response.headers, null, 2) 
                      : formatContent(response.data || response.error, activeResTab)}
                  </pre>
                ) : (
                  <p style={{color: '#666'}}>Ready to send request</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {importModal.show && (
        <div className="import-modal-overlay">
          <div className="import-modal">
            <h3>Confirm Import</h3>
            <p>The collection contains <strong>{importModal.items.length}</strong> requests.</p>
            <p><strong>{importModal.conflicts.length}</strong> of them already exist in the database.</p>
            <div className="import-modal-actions">
              <button className="send-button" onClick={() => performImport(importModal.items, 'overwrite', importModal.folderTree)}>
                Overwrite Duplicates
              </button>
              <button className="send-button" style={{background: '#444'}} onClick={() => performImport(importModal.items, 'skip', importModal.folderTree)}>
                Skip Duplicates
              </button>
              <button className="send-button" style={{background: 'transparent', border: '1px solid #444'}} onClick={() => setImportModal({ show: false, items: [], conflicts: [] })}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
