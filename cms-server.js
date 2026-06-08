const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const WORKSPACE_DIR = __dirname;

const server = http.createServer((req, res) => {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // Endpoint to Load Visual Data
  if (req.method === 'GET' && url.pathname === '/api/load-visual') {
    const pageKey = url.searchParams.get('page');
    if (!pageKey) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing page parameter' }));
      return;
    }

    const filePath = path.join(WORKSPACE_DIR, 'cms-data', `${pageKey}.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Data not found' }));
    }
    return;
  }

  // Endpoint to Save Visual Data
  if (req.method === 'POST' && url.pathname === '/api/save-visual') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { pageKey, payload } = JSON.parse(body);
        if (!pageKey || !payload) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing pageKey or payload' }));
          return;
        }

        const dirPath = path.join(WORKSPACE_DIR, 'cms-data');
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }

        const filePath = path.join(dirPath, `${pageKey}.json`);
        fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Saved ${pageKey} data to disk.` }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Endpoint to Reset Visual Data
  if (req.method === 'POST' && url.pathname === '/api/reset-visual') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { pageKey } = JSON.parse(body);
        if (!pageKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing pageKey' }));
          return;
        }

        const filePath = path.join(WORKSPACE_DIR, 'cms-data', `${pageKey}.json`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Reset ${pageKey} data (deleted file).` }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Endpoint to Save Code Editor Changes
  if (req.method === 'POST' && url.pathname === '/api/save-code') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { filePath, content } = JSON.parse(body);
        if (!filePath || content === undefined) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing filePath or content' }));
          return;
        }

        const resolvedPath = path.resolve(WORKSPACE_DIR, filePath);
        if (!resolvedPath.startsWith(WORKSPACE_DIR)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Access denied: path is outside workspace directory.' }));
          return;
        }

        fs.writeFileSync(resolvedPath, content, 'utf8');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Successfully saved ${filePath} to disk.` }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(PORT, () => {
  console.log(`CMS Server is running locally on http://localhost:${PORT}`);
});
