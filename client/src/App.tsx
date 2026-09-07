import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
type ResponseTab = 'JSON' | 'Text' | 'HTML' | 'XML' | 'Headers';
type ConfigTab = 'Headers' | 'Auth' | 'Body';

interface KeyValue {
  key: string;
  value: string;
}

interface MultipartParam {
  type: 'text' | 'file';
  key: string;
  value: string;
  fileName?: string;
  fileData?: string;
  mimeType?: string;
}

interface ApiTab {
  id: string;
  name: string;
  method: Method;
  url: string;
  headers: KeyValue[];
  auth: { type: string; token: string; username: string; password: string; key: string; value: string; addTo: string };
  body: string;
  bodyType: 'raw' | 'form-urlencoded' | 'multipart';
  formParams: KeyValue[];
  multipartParams: MultipartParam[];
  ignoreSSL: boolean;
  activeConfigTab: ConfigTab;
  activeResTab: ResponseTab;
  response: any;
  savedRequestId?: number;
  hasUnsavedChanges: boolean;
  createdAt: number;
}

const STORAGE_KEY = 'apiClient_tabs';

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
  'Origin': ['http://localhost:5173', ''],
  'Referer': ['http://localhost:5173/', '/'],
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

const defaultAuth = { type: 'none', token: '', username: '', password: '', key: '', value: '', addTo: 'header' };

function createDefaultTab(): ApiTab {
  return {
    id: crypto.randomUUID(),
    name: 'New Request',
    method: 'GET',
    url: '',
    headers: [{ key: '', value: '' }],
    auth: { ...defaultAuth },
    body: '',
    bodyType: 'raw',
    formParams: [{ key: '', value: '' }],
    multipartParams: [{ type: 'text', key: '', value: '' }],
    ignoreSSL: false,
    activeConfigTab: 'Headers',
    activeResTab: 'JSON',
    response: null,
    hasUnsavedChanges: false,
    createdAt: Date.now(),
  };
}

function saveTabsToStorage(tabs: ApiTab[], activeTabIndex: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeTabIndex }));
  } catch (e) {
    console.error('Failed to save tabs:', e);
  }
}

function loadTabsFromStorage(): { tabs: ApiTab[]; activeTabIndex: number } | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load tabs:', e);
  }
  return null;
}

function App() {
  const [tabs, setTabs] = useState<ApiTab[]>(() => {
    const saved = loadTabsFromStorage();
    const loadedTabs = saved?.tabs?.length ? saved.tabs : [createDefaultTab()];
    return loadedTabs.map((tab, i) => ({
      ...tab,
      multipartParams: tab.multipartParams || [{ type: 'text', key: '', value: '' }],
      createdAt: tab.createdAt || Date.now() - i,
    }));
  });
  const [activeTabIndex, setActiveTabIndex] = useState<number>(() => {
    const saved = loadTabsFromStorage();
    if (saved && saved.activeTabIndex >= 0 && saved.activeTabIndex < (saved.tabs?.length || 0)) {
      return saved.activeTabIndex;
    }
    return 0;
  });

  const [history, setHistory] = useState<any[]>([]);
  const [savedRequests, setSavedRequests] = useState<any[]>([]);
  const [dragOverItemId, setDragOverItemId] = useState<number | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'History' | 'Saved'>('Saved');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(450);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({ Default: true });
  const [folders, setFolders] = useState<any[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<number, boolean>>({});
  const [isSending, setIsSending] = useState(false);
  const [importModal, setImportModal] = useState<{ show: boolean, items: any[], conflicts: any[], folderTree?: any[] }>({ show: false, items: [], conflicts: [] });
  const [appMode, setAppMode] = useState<'client' | 'inventory' | 'loadtest'>('client');

  // Inventory state
  const [inventoryApis, setInventoryApis] = useState<any[]>([]);
  const [inventoryStats, setInventoryStats] = useState({ total_apis: 0, active_apis: 0, inactive_apis: 0, total_endpoints: 0 });
  const [inventoryFilter, setInventoryFilter] = useState({ project: '', status: '', search: '' });
  const [showNewApiModal, setShowNewApiModal] = useState(false);
  const [newApiForm, setNewApiForm] = useState({ name: '', description: '', base_url: '', auth_type: 'none', status: 'active', project: 'Default' });

  const isResizing = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const activeTab = tabs[activeTabIndex] || tabs[0];

  const switchTab = useCallback((index: number) => {
    setActiveTabIndex(index);
    setTabs(prev => prev.map((tab, i) =>
      i === index ? { ...tab, createdAt: Date.now() } : tab
    ));
  }, []);

  const updateActiveTab = useCallback((updates: Partial<ApiTab>) => {
    setTabs(prev => prev.map((tab, i) =>
      i === activeTabIndex ? { ...tab, ...updates } : tab
    ));
  }, [activeTabIndex]);

  const addTab = useCallback((tabData?: Partial<ApiTab>) => {
    const newTab = { ...createDefaultTab(), ...tabData };
    setTabs(prev => {
      const next = [...prev, newTab];
      setActiveTabIndex(next.length - 1);
      return next;
    });
  }, []);

  const closeTab = useCallback((index: number) => {
    setTabs(prev => {
      const tab = prev[index];
      if (tab.hasUnsavedChanges) {
        if (!window.confirm(`"${tab.name}" has unsaved changes. Close anyway?`)) return prev;
      }
      if (prev.length === 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      setActiveTabIndex(prevIdx => {
        if (index < prevIdx) return prevIdx - 1;
        if (index === prevIdx && prevIdx >= next.length) return next.length - 1;
        return Math.min(prevIdx, next.length - 1);
      });
      return next;
    });
  }, []);

  useEffect(() => {
    saveTabsToStorage(tabs, activeTabIndex);
  }, [tabs, activeTabIndex]);

  useEffect(() => {
    const container = tabsContainerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [tabs]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      saveTabsToStorage(tabs, activeTabIndex);
      const hasUnsaved = tabs.some(tab => tab.hasUnsavedChanges);
      if (hasUnsaved) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [tabs, activeTabIndex]);

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

  const getFolderRequests = (requests: any[], folderId: number | null) => {
    return requests.filter(r => (r.folder_id || null) === folderId);
  };

  const handleCreateFolder = async (project: string, name: string, parentId?: number | null) => {
    if (!name) return;
    try {
      const res = await fetch('/api/folders', {
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
      const res = await fetch(`/api/folders/${id}`, {
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
      const res = await fetch(`/api/folders/${id}`, {
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
      const res = await fetch('/api/history');
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.error('Failed to fetch history');
    }
  };

  const fetchSavedRequests = async () => {
    try {
      const res = await fetch('/api/requests');
      const data = await res.json();
      setSavedRequests(data);
    } catch (e) {
      console.error('Failed to fetch saved requests');
    }
  };

  const fetchFolders = async (project?: string) => {
    try {
      const folderUrl = project
        ? `/api/folders?project=${encodeURIComponent(project)}`
        : '/api/folders';
      const res = await fetch(folderUrl);
      const data = await res.json();
      setFolders(data);
    } catch (e) {
      console.error('Failed to fetch folders');
    }
  };

  const fetchInventoryApis = async () => {
    try {
      const params = new URLSearchParams();
      if (inventoryFilter.project) params.append('project', inventoryFilter.project);
      if (inventoryFilter.status) params.append('status', inventoryFilter.status);
      if (inventoryFilter.search) params.append('search', inventoryFilter.search);
      const res = await fetch(`/api/inventory?${params.toString()}`);
      const data = await res.json();
      setInventoryApis(data);
    } catch (e) {
      console.error('Failed to fetch inventory APIs');
    }
  };

  const fetchInventoryStats = async () => {
    try {
      const res = await fetch('/api/inventory/stats/overview');
      const data = await res.json();
      setInventoryStats(data);
    } catch (e) {
      console.error('Failed to fetch inventory stats');
    }
  };

  const handleCreateApi = async () => {
    if (!newApiForm.name) { showToast('Name is required', 'error'); return; }
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newApiForm),
      });
      if (!res.ok) throw new Error('Failed to create API');
      setShowNewApiModal(false);
      setNewApiForm({ name: '', description: '', base_url: '', auth_type: 'none', status: 'active', project: 'Default' });
      fetchInventoryApis();
      fetchInventoryStats();
      showToast('API created');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleDeleteApi = async (id: number) => {
    if (!confirm('Delete this API and all its endpoints?')) return;
    try {
      await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
      fetchInventoryApis();
      fetchInventoryStats();
      showToast('API deleted');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  useEffect(() => {
    if (appMode === 'inventory') {
      fetchInventoryApis();
      fetchInventoryStats();
    }
  }, [appMode, inventoryFilter]);

  const handleLoadRequest = (item: any, isSaved?: boolean) => {
    if (isSaved && item.id) {
      const existingIndex = tabs.findIndex(t => t.savedRequestId === item.id);
      if (existingIndex >= 0) {
        switchTab(existingIndex);
        return;
      }
    }

    let parsedHeaders: KeyValue[];
    try {
      const parsed = JSON.parse(item.headers || '{}');
      parsedHeaders = Object.entries(parsed).map(([key, value]) => ({ key, value: value as string }));
      if (parsedHeaders.length === 0) parsedHeaders = [{ key: '', value: '' }];
    } catch {
      parsedHeaders = [{ key: '', value: '' }];
    }

    let parsedBody = '';
    try {
      if (item.body && item.body !== 'null' && item.body !== 'undefined') {
        parsedBody = typeof item.body === 'string' && (item.body.startsWith('{') || item.body.startsWith('['))
          ? JSON.stringify(JSON.parse(item.body), null, 2)
          : item.body;
      }
    } catch {
      parsedBody = item.body || '';
    }

    let parsedAuth = { ...defaultAuth };
    try {
      const parsed = JSON.parse(item.auth || 'null');
      if (parsed) parsedAuth = parsed;
    } catch {}

    let parsedFormParams: KeyValue[] = [{ key: '', value: '' }];
    if (item.form_params) {
      try {
        const parsed = JSON.parse(item.form_params);
        if (Array.isArray(parsed) && parsed.length > 0) parsedFormParams = parsed;
      } catch {}
    }

    let parsedMultipartParams: MultipartParam[] = [{ type: 'text', key: '', value: '' }];
    if (item.multipart_params) {
      try {
        const parsed = JSON.parse(item.multipart_params);
        if (Array.isArray(parsed) && parsed.length > 0) parsedMultipartParams = parsed;
      } catch {}
    }

    let parsedResponse = null;
    if (item.response_data) {
      try {
        parsedResponse = {
          status: item.response_status ?? item.status,
          time: item.response_time ?? item.time,
          data: JSON.parse(item.response_data),
          headers: JSON.parse(item.response_headers || '{}'),
          timestamp: item.timestamp
        };
      } catch {}
    }

    const displayName = isSaved && item.name
      ? item.name
      : (item.url || '').slice(0, 30);

    const newTab: ApiTab = {
      id: crypto.randomUUID(),
      name: displayName,
      method: item.method as Method,
      url: item.url || '',
      headers: parsedHeaders,
      auth: parsedAuth,
      body: parsedBody,
      bodyType: item.body_type || 'raw',
      formParams: parsedFormParams,
      multipartParams: parsedMultipartParams,
      ignoreSSL: item.ignore_ssl || false,
      activeConfigTab: 'Headers',
      activeResTab: 'JSON',
      response: parsedResponse,
      savedRequestId: isSaved ? item.id : undefined,
      hasUnsavedChanges: false,
    };

    addTab(newTab);
  };

  const handleExport = () => {
    window.location.href = '/api/export';
  };

  const handleExportProject = (projectName: string) => {
    window.location.href = `/api/projects/${encodeURIComponent(projectName)}/export`;
  };

  const handleExportItem = (id: number) => {
    window.location.href = `/api/export/${id}`;
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
          const folderName = item.name || 'Untitled Folder';
          const currentPath = parentPath ? `${parentPath}/${folderName}` : folderName;
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
          let bodyType: 'raw' | 'form-urlencoded' | 'multipart' = 'raw';
          let formParams: KeyValue[] = [{ key: '', value: '' }];
          let multipartParams: MultipartParam[] = [{ type: 'text', key: '', value: '' }];

          if (req.body) {
            if (req.body.mode === 'raw') {
              body = req.body.raw || '';
            } else if (req.body.mode === 'urlencoded') {
              bodyType = 'form-urlencoded';
              formParams = (req.body.urlencoded || []).map((p: any) => ({ key: p.key, value: p.value }));
              if (formParams.length === 0) formParams = [{ key: '', value: '' }];
            } else if (req.body.mode === 'formdata') {
              const formdataItems = req.body.formdata || [];
              const hasFiles = formdataItems.some((p: any) => p.type === 'file');
              if (hasFiles) {
                bodyType = 'multipart';
                multipartParams = formdataItems.map((p: any) => ({
                  type: p.type === 'file' ? 'file' as const : 'text' as const,
                  key: p.key,
                  value: p.value || '',
                  fileName: p.src || undefined,
                }));
                if (multipartParams.length === 0) multipartParams = [{ type: 'text', key: '', value: '' }];
              } else {
                bodyType = 'form-urlencoded';
                formParams = formdataItems
                  .filter((p: any) => p.type === 'text')
                  .map((p: any) => ({ key: p.key, value: p.value }));
                if (formParams.length === 0) formParams = [{ key: '', value: '' }];
              }
            }
          }

          let auth = { ...defaultAuth };
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
            multipartParams,
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
      const res = await fetch('/api/import', {
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

      const checkRes = await fetch('/api/import/check', {
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
    const tab = activeTab;
    const current = tab.savedRequestId ? savedRequests.find(r => r.id === tab.savedRequestId) : null;
    const name = prompt('Enter a name for this request:', current?.name || tab.name);
    if (!name) return;
    const project = prompt('Enter project name (leave empty for "Default"):', current?.project || '') || 'Default';

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

    const headerObj = tab.headers.reduce((acc, curr) => {
      if (curr.key) acc[curr.key] = curr.value;
      return acc;
    }, {} as any);

    const validFormParams = tab.formParams.filter(p => p.key);
    const validMultipartParams = tab.multipartParams.filter(p => p.key);

    try {
      const endpoint = tab.savedRequestId
        ? `/api/requests/${tab.savedRequestId}`
        : '/api/requests';
      const httpMethod = tab.savedRequestId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method: httpMethod,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          project,
          method: tab.method,
          url: tab.url,
          headers: headerObj,
          body: tab.body,
          bodyType: tab.bodyType,
          formParams: validFormParams,
          multipartParams: validMultipartParams,
          ignoreSSL: tab.ignoreSSL,
          auth: tab.auth.type === 'none' ? null : tab.auth,
          response: tab.response,
          folderId
        })
      });
      if (!res.ok) throw new Error('Failed to save request');
      const savedItem = await res.json();
      fetchSavedRequests();
      updateActiveTab({
        savedRequestId: savedItem.id || tab.savedRequestId,
        name: name,
        hasUnsavedChanges: false
      });
      showToast(tab.savedRequestId ? 'Request updated successfully' : 'Request saved successfully');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleDeleteHistory = async (id?: number) => {
    if (!id && !confirm('Clear all history?')) return;
    try {
      await fetch(`/api/history${id ? `/${id}` : ''}`, { method: 'DELETE' });
      fetchHistory();
      showToast(id ? 'History item deleted' : 'History cleared');
    } catch (e) {
      showToast('Failed to delete history', 'error');
    }
  };

  const handleDeleteSaved = async (id: number) => {
    if (!confirm('Delete this saved request?')) return;
    try {
      await fetch(`/api/requests/${id}`, { method: 'DELETE' });
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
      const res = await fetch('/api/projects/rename', {
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
      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}`, {
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

    const projectNames = Object.keys(groupedRequests);
    const sourceIdx = projectNames.indexOf(sourceProject);
    const targetIdx = projectNames.indexOf(targetProject);
    
    const newOrder = [...projectNames];
    newOrder.splice(sourceIdx, 1);
    const adjustedTarget = targetIdx > sourceIdx ? targetIdx - 1 : targetIdx;
    newOrder.splice(adjustedTarget, 0, sourceProject);

    try {
      const res = await fetch(`/api/projects/reorder`, {
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
      const res = await fetch(`/api/requests/move`, {
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
      const res = await fetch(`/api/requests/move`, {
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

  const handleCopyAsCurl = () => {
    const tab = activeTab;
    if (!tab.url) {
      showToast('Enter a URL first', 'error');
      return;
    }

    const headerObj = tab.headers.reduce((acc, curr) => {
      if (curr.key) acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    let curl = `curl -X ${tab.method}`;

    Object.entries(headerObj).forEach(([k, v]) => {
      curl += ` \\\n  -H "${k}: ${v}"`;
    });

    if (tab.auth.type === 'bearer' && tab.auth.token) {
      curl += ` \\\n  -H "Authorization: Bearer ${tab.auth.token}"`;
    } else if (tab.auth.type === 'basic' && tab.auth.username) {
      const encoded = btoa(`${tab.auth.username}:${tab.auth.password}`);
      curl += ` \\\n  -H "Authorization: Basic ${encoded}"`;
    } else if (tab.auth.type === 'apikey' && tab.auth.key) {
      if (tab.auth.addTo === 'header') {
        curl += ` \\\n  -H "${tab.auth.key}: ${tab.auth.value}"`;
      } else {
        const separator = tab.url.includes('?') ? '&' : '?';
        curl += `${separator}${encodeURIComponent(tab.auth.key)}=${encodeURIComponent(tab.auth.value)}`;
      }
    }

    if (tab.method !== 'GET' && tab.body) {
      const bodyStr = tab.bodyType === 'form-urlencoded'
        ? tab.formParams.filter(p => p.key).map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
        : tab.bodyType === 'multipart'
        ? ''
        : tab.body;
      if (tab.bodyType === 'multipart') {
        tab.multipartParams.filter(p => p.key).forEach(p => {
          if (p.type === 'file') {
            curl += ` \\\n  -F "${p.key}=@${p.fileName || 'file'}"`;
          } else {
            curl += ` \\\n  -F "${p.key}=${p.value}"`;
          }
        });
      } else if (bodyStr) {
        curl += ` \\\n  -d '${bodyStr.replace(/'/g, "'\\''")}'`;
      }
    }

    curl += ` \\\n  '${tab.url}'`;

    navigator.clipboard.writeText(curl).then(() => {
      showToast('cURL copied to clipboard');
    }).catch(() => {
      showToast('Failed to copy to clipboard', 'error');
    });
  };

  const handleSend = async () => {
    const tab = activeTab;
    if (!tab.url) {
      showToast('Please enter a URL', 'error');
      return;
    }

    setIsSending(true);

    const headerObj = tab.headers.reduce((acc, curr) => {
      if (curr.key) acc[curr.key] = curr.value;
      return acc;
    }, {} as any);

    let requestData = tab.method !== 'GET' ? tab.body : undefined;
    if (tab.method !== 'GET' && tab.bodyType === 'form-urlencoded') {
      const params = new URLSearchParams();
      tab.formParams.forEach(p => {
        if (p.key) params.append(p.key, p.value);
      });
      requestData = params.toString();
      headerObj['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    const isMultipart = tab.method !== 'GET' && tab.bodyType === 'multipart';
    const multipartData = isMultipart ? tab.multipartParams.filter(p => p.key) : undefined;

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: tab.method,
          url: tab.url,
          headers: headerObj,
          data: isMultipart ? undefined : requestData,
          multipartData,
          auth: tab.auth.type === 'none' ? null : tab.auth,
          ignoreSSL: tab.ignoreSSL
        })
      });
      const data = await res.json();
      
      if (res.status === 500 && data.error) {
        if (data.sslError) {
          showToast('SSL certificate error - marca "Ignore SSL" y reintenta', 'error');
          updateActiveTab({ ignoreSSL: true });
        } else {
          showToast(data.error, 'error');
        }
      }

      const newResponse = { ...data, timestamp: new Date().toLocaleString() };
      const contentType = data.headers?.['content-type'] || '';
      let newResTab: ResponseTab = 'JSON';
      if (contentType.includes('html')) newResTab = 'HTML';
      else if (contentType.includes('xml')) newResTab = 'XML';

      updateActiveTab({ response: newResponse, activeResTab: newResTab });
      fetchHistory();

    } catch (e: any) {
      updateActiveTab({ response: { error: e.message } });
      showToast(e.message, 'error');
    } finally {
      setIsSending(false);
    }
  };

  const addHeader = () => {
    updateActiveTab({ headers: [...activeTab.headers, { key: '', value: '' }] });
  };

  const updateHeader = (index: number, field: 'key' | 'value', val: string) => {
    const newHeaders = [...activeTab.headers];
    newHeaders[index] = { ...newHeaders[index], [field]: val };
    updateActiveTab({ headers: newHeaders });
  };

  const addMultipartParam = () => {
    updateActiveTab({ multipartParams: [...activeTab.multipartParams, { type: 'text', key: '', value: '' }] });
  };

  const updateMultipartParam = (index: number, updates: Partial<MultipartParam>) => {
    const newParams = [...activeTab.multipartParams];
    newParams[index] = { ...newParams[index], ...updates };
    updateActiveTab({ multipartParams: newParams });
  };

  const removeMultipartParam = (index: number) => {
    updateActiveTab({ multipartParams: activeTab.multipartParams.filter((_, idx) => idx !== index) });
  };

  const handleMultipartFileSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      updateMultipartParam(index, {
        type: 'file',
        fileData: base64,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        value: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const JsonTreeView = ({ data, expanded = true }: { data: any; expanded?: boolean }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [isExpanded, setIsExpanded] = useState(expanded);

    if (data === null) return <span className="json-null">null</span>;
    if (typeof data === 'boolean') return <span className="json-bool">{data ? 'true' : 'false'}</span>;
    if (typeof data === 'number') return <span className="json-number">{String(data)}</span>;
    if (typeof data === 'string') {
      const maxLen = 500;
      const display = data.length > maxLen ? data.slice(0, maxLen) + '.' : data;
      return <span className="json-string">"{display}"</span>;
    }

    if (Array.isArray(data)) {
      if (data.length === 0) return <span className="json-bracket">[ ]</span>;
      return (
        <span className="json-node">
          <span className="json-toggle" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? '\u25BC' : '\u25B6'}
          </span>
          <span className="json-bracket">[</span>
          {!isExpanded && (
            <span className="json-preview"> {data.length} item{data.length !== 1 ? 's' : ''} </span>
          )}
          {!isExpanded && <span className="json-bracket">]</span>}
          {isExpanded && (
            <>
              <div className="json-children">
                {data.map((item, i) => (
                  <div key={i} className="json-line">
                    <JsonTreeView data={item} expanded={false} />
                    {i < data.length - 1 && <span className="json-comma">,</span>}
                  </div>
                ))}
              </div>
              <span className="json-bracket">]</span>
            </>
          )}
        </span>
      );
    }

    if (typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length === 0) return <span className="json-bracket">{'{ }'}</span>;
      return (
        <span className="json-node">
          <span className="json-toggle" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? '\u25BC' : '\u25B6'}
          </span>
          <span className="json-bracket">{'{'}</span>
          {!isExpanded && (
            <span className="json-preview"> {keys.length} key{keys.length !== 1 ? 's' : ''} </span>
          )}
          {!isExpanded && <span className="json-bracket">{'}'}</span>}
          {isExpanded && (
            <>
              <div className="json-children">
                {keys.map((key, i) => (
                  <div key={key} className="json-line">
                    <span className="json-key">"{key}"</span>
                    <span className="json-colon">: </span>
                    <JsonTreeView data={data[key]} expanded={false} />
                    {i < keys.length - 1 && <span className="json-comma">,</span>}
                  </div>
                ))}
              </div>
              <span className="json-bracket">{'}'}</span>
            </>
          )}
        </span>
      );
    }
    return <span>{String(data)}</span>;
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
    <div className="app-root">
      <nav className="app-nav">
        <button className={appMode === 'client' ? 'active' : ''} onClick={() => setAppMode('client')}>API Client</button>
        <button className={appMode === 'inventory' ? 'active' : ''} onClick={() => setAppMode('inventory')}>API Inventory</button>
        <button className={appMode === 'loadtest' ? 'active' : ''} onClick={() => setAppMode('loadtest')}>Load Testing</button>
      </nav>

      {appMode === 'client' && (
    <div className={`app-container ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`} style={{ '--sidebar-width': `${sidebarWidth}px` } as any}>
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
      
      <aside className="sidebar">
        <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? '\u2715' : '\u2630'}
        </button>
        <div className="sidebar-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>API Client</h2>
            {sidebarOpen && (
              <div className="sidebar-actions">
                <button className="icon-btn" title="Import Postman Collection" onClick={handleImportClick}>Import</button>
                <button className="icon-btn" title="Export Postman Collection" onClick={handleExport}>Export</button>
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
                  <button className="delete-item-btn" onClick={(e) => { e.stopPropagation(); handleDeleteHistory(item.id); }}>{'\u00D7'}</button>
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
                    <div className="folder-header" draggable onDragStart={(e) => { e.dataTransfer.setData('folderId', folder.id.toString()); e.dataTransfer.effectAllowed = 'move'; }}>
                      <div className="folder-header-main" onClick={() => toggleFolder(folder.id)}>
                        <span>{expandedFolders[folder.id] ? '\u25BC' : '\u25B6'}</span>
                        <span className="folder-icon">{'\u25A0'}</span>
                        <strong>{folder.name}</strong>
                      </div>
                      <div style={{display: 'flex', gap: '0.2rem'}}>
                        <button className="icon-btn-xs" onClick={(e) => { e.stopPropagation(); handleCreateFolder(projectName, prompt('Folder name:') || '', folder.id); }} title="New Subfolder">+</button>
                        <button className="icon-btn-xs" onClick={(e) => { e.stopPropagation(); handleRenameFolder(folder.id, folder.name); }} title="Rename">{'\u270E'}</button>
                        <button className="icon-btn-xs" onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }} title="Delete">{'\u00D7'}</button>
                      </div>
                    </div>
                    {expandedFolders[folder.id] && (
                      <div className="folder-items">
                        {folder.children.map((child: any) => renderFolder(child, depth + 1))}
                        {getFolderRequests(requests, folder.id).map((item: any) => (
                          <div key={item.id} className={`history-item draggable ${dragOverItemId === item.id ? 'drag-over' : ''}`} style={{ marginLeft: `${(depth + 1) * 12}px` }} onClick={() => handleLoadRequest(item, true)} draggable onDragStart={(e) => handleDragStart(e, item.id)} onDragOver={(e) => { e.preventDefault(); setDragOverItemId(item.id); }} onDragLeave={() => setDragOverItemId(null)} onDrop={(e) => handleItemDrop(e, item.id, item.project || 'Default')}>
                            <div className="history-item-content">
                              <div className="saved-name">{item.name}</div>
                              <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                                <span className={`method-tag ${item.method}`} style={{fontSize: '0.7rem'}}>{item.method}</span>
                                <span className="history-url" style={{fontSize: '0.75rem'}}>{item.url}</span>
                              </div>
                            </div>
                            <div className="item-actions">
                              <button className="icon-btn-sm action-btn" onClick={(e) => { e.stopPropagation(); handleExportItem(item.id); }} title="Export Request">{'\u2191'}</button>
                              <button className="delete-item-btn action-btn" onClick={(e) => { e.stopPropagation(); handleDeleteSaved(item.id); }}>{'\u00D7'}</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );

                return (
                  <div key={projectName} className="project-group" onDragOver={(e) => { e.preventDefault(); }} onDragEnter={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes('projectName')) { (e.currentTarget as HTMLDivElement).classList.add('drag-over'); } }} onDragLeave={(e) => { (e.currentTarget as HTMLDivElement).classList.remove('drag-over'); }} onDrop={(e) => { if (e.dataTransfer.getData('projectName')) { handleProjectDrop(e, projectName); } else { handleDrop(e, projectName); } (e.currentTarget as HTMLDivElement).classList.remove('drag-over'); }}>
                    <div className="project-header" draggable onDragStart={(e) => handleProjectDragStart(e, projectName)}>
                      <div className="project-header-main" onClick={() => toggleProject(projectName)}>
                        <span>{expandedProjects[projectName] ? '\u25BC' : '\u25B6'}</span>
                        <strong>{projectName}</strong>
                        <span className="project-count">({requests.length})</span>
                      </div>
                      <div style={{display: 'flex', gap: '0.3rem'}}>
                        <button className="icon-btn-sm" onClick={(e) => { e.stopPropagation(); handleCreateFolder(projectName, prompt('Folder name:') || ''); }} title="New Folder">{'\u25A0'}+</button>
                        <button className="icon-btn-sm" onClick={(e) => { e.stopPropagation(); handleExportProject(projectName); }} title="Export Project">{'\u2191'}</button>
                        <button className="rename-btn" onClick={(e) => { e.stopPropagation(); handleRenameProject(projectName); }} title="Rename Project">{'\u270E'}</button>
                        <button className="delete-project-btn" onClick={(e) => { e.stopPropagation(); handleDeleteProject(projectName); }} title="Delete Project">{'\u00D7'}</button>
                      </div>
                    </div>
                    {expandedProjects[projectName] && (
                      <div className="project-items">
                        {folderTree.map((folder: any) => renderFolder(folder, 0))}
                        {rootRequests.map((item: any) => (
                          <div key={item.id} className={`history-item draggable ${dragOverItemId === item.id ? 'drag-over' : ''}`} onClick={() => handleLoadRequest(item, true)} draggable onDragStart={(e) => handleDragStart(e, item.id)} onDragOver={(e) => { e.preventDefault(); setDragOverItemId(item.id); }} onDragLeave={() => setDragOverItemId(null)} onDrop={(e) => handleItemDrop(e, item.id, item.project || 'Default')}>
                            <div className="history-item-content">
                              <div className="saved-name">{item.name}</div>
                              <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                                <span className={`method-tag ${item.method}`} style={{fontSize: '0.7rem'}}>{item.method}</span>
                                <span className="history-url" style={{fontSize: '0.75rem'}}>{item.url}</span>
                              </div>
                            </div>
                            <div className="item-actions">
                              <button className="icon-btn-sm action-btn" onClick={(e) => { e.stopPropagation(); handleExportItem(item.id); }} title="Export Request">{'\u2191'}</button>
                              <button className="delete-item-btn action-btn" onClick={(e) => { e.stopPropagation(); handleDeleteSaved(item.id); }}>{'\u00D7'}</button>
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
        <div className="tabs-bar">
          <div className="tabs-container" ref={tabsContainerRef}>
            {(() => {
              const sortedByAge = [...tabs]
                .map((t, i) => ({ t, i }))
                .sort((a, b) => b.t.createdAt - a.t.createdAt);
              const recencyMap = new Map<number, { opacity: number; textColor: string; bold: boolean; accent: boolean }>();
              const levels = [
                { opacity: 1.0, textColor: '#fff', bold: true, accent: true },
                { opacity: 0.95, textColor: '#ddd', bold: true, accent: true },
                { opacity: 0.85, textColor: '#bbb', bold: false, accent: false },
                { opacity: 0.70, textColor: '#888', bold: false, accent: false },
                { opacity: 0.55, textColor: '#666', bold: false, accent: false },
              ];
              sortedByAge.forEach(({ t, i }, rank) => {
                recencyMap.set(i, levels[Math.min(rank, levels.length - 1)]);
              });
              return tabs.map((tab, index) => {
                const r = recencyMap.get(index) ?? levels[4];
                return (
                  <div
                    key={tab.id}
                    className={`tab-item ${index === activeTabIndex ? 'active' : ''}`}
                    style={{
                      '--tab-opacity': r.opacity,
                      '--tab-text-color': r.textColor,
                      '--tab-font-weight': r.bold ? '600' : '400',
                      '--tab-border-left': r.accent ? '3px solid var(--accent-blue)' : '3px solid transparent',
                    } as any}
                    onClick={() => switchTab(index)}
                  >
                    <span className={`method-tag ${tab.method}`}>{tab.method}</span>
                    <span className="tab-name">{tab.name}</span>
                    {tab.hasUnsavedChanges && <span className="tab-unsaved">{'\u2022'}</span>}
                    <button className="tab-close" onClick={(e) => { e.stopPropagation(); closeTab(index); }}>{'\u00d7'}</button>
                  </div>
                );
              });
            })()}
          </div>
          <button className="tab-add-btn" onClick={() => addTab()}>+</button>
        </div>

        <header className="request-header">
          <select className="method-select" value={activeTab.method} onChange={(e) => updateActiveTab({ method: e.target.value as Method })}>
            <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option><option>PATCH</option>
          </select>
          <input type="text" className="url-input" placeholder="https://api.example.com" value={activeTab.url} onChange={(e) => updateActiveTab({ url: e.target.value })} />
          <div className="ssl-toggle">
            <input type="checkbox" id="ignoreSSL" checked={activeTab.ignoreSSL} onChange={(e) => updateActiveTab({ ignoreSSL: e.target.checked })} />
            <label htmlFor="ignoreSSL">Ignore SSL</label>
          </div>
          <div style={{display: 'flex', gap: '0.5rem'}}>
            <button className="send-button" onClick={handleSend} disabled={isSending}>
              {isSending ? <span className="spinner" /> : 'Send'}
            </button>
            <button className="send-button" style={{background: '#444'}} onClick={handleSaveRequest}>Save</button>
            <button className="send-button" style={{background: '#333', fontSize: '0.75rem'}} onClick={handleCopyAsCurl} title="Copy as cURL">Curl</button>
          </div>
        </header>

        <div className="workspace-grid">
          <section className="request-config">
            <div className="tabs">
              {(['Headers', 'Auth', 'Body'] as const).map(ctab => (
                <div key={ctab} className={`tab ${activeTab.activeConfigTab === ctab ? 'active' : ''}`} onClick={() => updateActiveTab({ activeConfigTab: ctab })}>{ctab}</div>
              ))}
            </div>
            <div className="tab-content">
              {activeTab.activeConfigTab === 'Headers' && (
                <div className="kv-editor">
                  {activeTab.headers.map((h, i) => (
                    <div key={i} className="kv-row">
                      <input placeholder="Key" list={`header-keys-${i}`} value={h.key} onChange={(e) => {
                        const val = e.target.value;
                        updateHeader(i, 'key', val);
                        if (val && commonHeaders[val] && !activeTab.headers[i].value) {
                          const suggested = commonHeaders[val].find(v => v !== '');
                          if (suggested) updateHeader(i, 'value', suggested);
                        }
                      }} />
                      <datalist id={`header-keys-${i}`}>
                        {allHeaderNames.map(name => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                      <input placeholder="Value" list={`header-vals-${i}`} value={h.value} onChange={(e) => updateHeader(i, 'value', e.target.value)} />
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
              {activeTab.activeConfigTab === 'Auth' && (
                <div className="auth-editor">
                  <select value={activeTab.auth.type} onChange={(e) => updateActiveTab({ auth: { ...activeTab.auth, type: e.target.value } })}>
                    <option value="none">No Auth</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="apikey">API Key</option>
                    <option value="basic">Basic Auth</option>
                  </select>
                  {activeTab.auth.type === 'bearer' && <input placeholder="Token" value={activeTab.auth.token} onChange={(e) => updateActiveTab({ auth: { ...activeTab.auth, token: e.target.value } })} />}
                  {activeTab.auth.type === 'basic' && (
                    <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                      <input placeholder="Username" value={activeTab.auth.username} onChange={(e) => updateActiveTab({ auth: { ...activeTab.auth, username: e.target.value } })} />
                      <input type="password" placeholder="Password" value={activeTab.auth.password} onChange={(e) => updateActiveTab({ auth: { ...activeTab.auth, password: e.target.value } })} />
                    </div>
                  )}
                  {activeTab.auth.type === 'apikey' && (
                    <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                      <input placeholder="Key" value={activeTab.auth.key} onChange={(e) => updateActiveTab({ auth: { ...activeTab.auth, key: e.target.value } })} />
                      <input placeholder="Value" value={activeTab.auth.value} onChange={(e) => updateActiveTab({ auth: { ...activeTab.auth, value: e.target.value } })} />
                      <select value={activeTab.auth.addTo} onChange={(e) => updateActiveTab({ auth: { ...activeTab.auth, addTo: e.target.value } })}>
                        <option value="header">Header</option><option value="query">Query Params</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
              {activeTab.activeConfigTab === 'Body' && (
                <div className="body-editor">
                  <div className="body-type-selector">
                    <label>
                      <input type="radio" name="bodyType" checked={activeTab.bodyType === 'raw'} onChange={() => updateActiveTab({ bodyType: 'raw' })} /> Raw (JSON/Text)
                    </label>
                    <label>
                      <input type="radio" name="bodyType" checked={activeTab.bodyType === 'form-urlencoded'} onChange={() => updateActiveTab({ bodyType: 'form-urlencoded' })} /> x-www-form-urlencoded
                    </label>
                    <label>
                      <input type="radio" name="bodyType" checked={activeTab.bodyType === 'multipart'} onChange={() => updateActiveTab({ bodyType: 'multipart' })} /> multipart/form-data
                    </label>
                  </div>

                  {activeTab.bodyType === 'raw' ? (
                    <textarea className="body-textarea" placeholder='{"key": "value"}' value={activeTab.body} onChange={(e) => updateActiveTab({ body: e.target.value })} />
                  ) : activeTab.bodyType === 'form-urlencoded' ? (
                    <div className="kv-editor">
                      {activeTab.formParams.map((p, i) => (
                        <div key={i} className="kv-row">
                          <input placeholder="Key" value={p.key} onChange={(e) => {
                            const newParams = [...activeTab.formParams];
                            newParams[i] = { ...newParams[i], key: e.target.value };
                            updateActiveTab({ formParams: newParams });
                          }} />
                          <input placeholder="Value" value={p.value} onChange={(e) => {
                            const newParams = [...activeTab.formParams];
                            newParams[i] = { ...newParams[i], value: e.target.value };
                            updateActiveTab({ formParams: newParams });
                          }} />
                          <button className="clear-btn" onClick={() => {
                            updateActiveTab({ formParams: activeTab.formParams.filter((_, idx) => idx !== i) });
                          }}>{'\u00D7'}</button>
                        </div>
                      ))}
                      <button className="send-button" style={{maxWidth: '150px', background: '#333'}} onClick={() => updateActiveTab({ formParams: [...activeTab.formParams, { key: '', value: '' }] })}>+ Add Parameter</button>
                    </div>
                  ) : (
                    <div className="kv-editor">
                      {activeTab.multipartParams.map((p, i) => (
                        <div key={i} className="kv-row multipart-row">
                          <select value={p.type} onChange={(e) => {
                            const newType = e.target.value as 'text' | 'file';
                            updateMultipartParam(i, { type: newType, value: '', fileData: undefined, fileName: undefined, mimeType: undefined });
                          }} className="multipart-type-select">
                            <option value="text">Text</option>
                            <option value="file">File</option>
                          </select>
                          <input placeholder="Key" value={p.key} onChange={(e) => updateMultipartParam(i, { key: e.target.value })} />
                          {p.type === 'text' ? (
                            <input placeholder="Value" value={p.value} onChange={(e) => updateMultipartParam(i, { value: e.target.value })} />
                          ) : (
                            <div className="file-input-wrapper">
                              <input
                                type="file"
                                style={{ display: 'none' }}
                                id={`multipart-file-${activeTab.id}-${i}`}
                                onChange={(e) => handleMultipartFileSelect(i, e)}
                              />
                              <label htmlFor={`multipart-file-${activeTab.id}-${i}`} className="file-input-label">
                                {p.fileName || 'Choose file...'}
                              </label>
                              {p.fileData && <span className="file-badge">Ready</span>}
                            </div>
                          )}
                          <button className="clear-btn" onClick={() => removeMultipartParam(i)}>{'\u00D7'}</button>
                        </div>
                      ))}
                      <button className="send-button" style={{maxWidth: '150px', background: '#333'}} onClick={addMultipartParam}>+ Add Parameter</button>
                    </div>
                  )}
                </div>
              )}

            </div>
          </section>

          <section className="response-section">
            <div className="response-header">
              <strong>Response</strong>
              {activeTab.response && (
                <div className="response-meta">
                  <span style={{ color: '#aaa', marginRight: '1rem' }}>{activeTab.response.timestamp || ''}</span>
                  <span className="status-code">Status: {activeTab.response.status}</span>
                  <span style={{ color: '#aaa', marginLeft: '1rem' }}>Time: {activeTab.response.time}</span>
                </div>
              )}
            </div>
            <div className="response-body-container">
              <div className="response-tabs">
                {(['JSON', 'Text', 'HTML', 'XML', 'Headers'] as const).map(rtab => (
                  <div 
                    key={rtab} 
                    className={`response-tab ${activeTab.activeResTab === rtab ? 'active' : ''}`}
                    onClick={() => updateActiveTab({ activeResTab: rtab })}
                  >
                    {rtab}
                  </div>
                ))}
              </div>
              <div className="response-content">
                {activeTab.response ? (
                  activeTab.activeResTab === 'JSON' && activeTab.response.data && typeof activeTab.response.data === 'object' ? (
                    <div className="json-tree-container">
                      <JsonTreeView data={activeTab.response.data} expanded={true} />
                    </div>
                  ) : (
                    <pre>
                      {activeTab.activeResTab === 'Headers' 
                        ? JSON.stringify(activeTab.response.headers, null, 2) 
                        : formatContent(activeTab.response.data || activeTab.response.error, activeTab.activeResTab)}
                    </pre>
                  )
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
      )}

      {appMode === 'inventory' && (
        <div className="inventory-view">
          <div className="inventory-header">
            <h2>API Inventory</h2>
            <button className="send-button" onClick={() => setShowNewApiModal(true)}>+ New API</button>
          </div>

          <div className="inventory-filters">
            <input
              placeholder="Search APIs..."
              value={inventoryFilter.search}
              onChange={(e) => setInventoryFilter({ ...inventoryFilter, search: e.target.value })}
            />
            <select value={inventoryFilter.status} onChange={(e) => setInventoryFilter({ ...inventoryFilter, status: e.target.value })}>
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="deprecated">Deprecated</option>
            </select>
          </div>

          <div className="inventory-stats">
            <div className="stat-card"><span className="stat-value">{inventoryStats.total_apis}</span><span className="stat-label">Total APIs</span></div>
            <div className="stat-card"><span className="stat-value" style={{color: '#4caf50'}}>{inventoryStats.active_apis}</span><span className="stat-label">Active</span></div>
            <div className="stat-card"><span className="stat-value" style={{color: '#ff9800'}}>{inventoryStats.inactive_apis}</span><span className="stat-label">Inactive</span></div>
            <div className="stat-card"><span className="stat-value" style={{color: '#007acc'}}>{inventoryStats.total_endpoints}</span><span className="stat-label">Endpoints</span></div>
          </div>

          <div className="inventory-grid">
            {inventoryApis.length === 0 && <p style={{color: '#666', gridColumn: '1/-1'}}>No APIs found. Create one to get started.</p>}
            {inventoryApis.map((api) => (
              <div key={api.id} className="api-card">
                <div className="api-card-header">
                  <span className={`status-dot ${api.status}`}></span>
                  <strong>{api.name}</strong>
                  <button className="delete-item-btn" onClick={() => handleDeleteApi(api.id)}>{'\u00D7'}</button>
                </div>
                <div className="api-card-body">
                  {api.base_url && <div className="api-card-url">{api.base_url}</div>}
                  <div className="api-card-meta">
                    <span>{api.endpoint_count || 0} endpoints</span>
                    <span>{api.total_calls || 0} calls</span>
                    {api.avg_response_time > 0 && <span>{Math.round(api.avg_response_time)}ms avg</span>}
                  </div>
                  {api.description && <div className="api-card-desc">{api.description}</div>}
                </div>
                <div className="api-card-footer">
                  <span className={`api-status-badge ${api.status}`}>{api.status}</span>
                  <span className="api-project-badge">{api.project}</span>
                </div>
              </div>
            ))}
          </div>

          {showNewApiModal && (
            <div className="import-modal-overlay">
              <div className="import-modal">
                <h3>Create New API</h3>
                <div className="modal-form">
                  <input placeholder="API Name *" value={newApiForm.name} onChange={(e) => setNewApiForm({ ...newApiForm, name: e.target.value })} />
                  <input placeholder="Base URL (e.g. https://api.example.com)" value={newApiForm.base_url} onChange={(e) => setNewApiForm({ ...newApiForm, base_url: e.target.value })} />
                  <textarea placeholder="Description" rows={3} value={newApiForm.description} onChange={(e) => setNewApiForm({ ...newApiForm, description: e.target.value })} />
                  <div style={{display: 'flex', gap: '0.5rem'}}>
                    <select value={newApiForm.status} onChange={(e) => setNewApiForm({ ...newApiForm, status: e.target.value })}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="deprecated">Deprecated</option>
                    </select>
                    <select value={newApiForm.auth_type} onChange={(e) => setNewApiForm({ ...newApiForm, auth_type: e.target.value })}>
                      <option value="none">No Auth</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="basic">Basic Auth</option>
                      <option value="apikey">API Key</option>
                    </select>
                    <input placeholder="Project" value={newApiForm.project} onChange={(e) => setNewApiForm({ ...newApiForm, project: e.target.value })} />
                  </div>
                </div>
                <div className="import-modal-actions">
                  <button className="send-button" onClick={handleCreateApi}>Create API</button>
                  <button className="send-button" style={{background: 'transparent', border: '1px solid #444'}} onClick={() => setShowNewApiModal(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {appMode === 'loadtest' && (
        <div className="inventory-view">
          <div className="inventory-header">
            <h2>Load Testing</h2>
          </div>
          <p style={{color: '#666', padding: '2rem'}}>Coming soon...</p>
        </div>
      )}
    </div>
  );
}

export default App;
