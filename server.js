const webpush = require('web-push');

// 先ほど生成されたVAPIDキーを固定設定
const publicKey = 'BPSJBiHSKzcUTmd3WrDiXPRd_SUTOwg8PBl3iUbzThc3FqTsxpadgebGs2TscnM3gIe_cM2GJu4CzCUEA';
const privateKey = 'OezFBL3U6sfqyYkV5EL0uSgoSob8xA0s_LsWu7zIN';

webpush.setVapidDetails(
  'mailto:example@example.com',
  publicKey,
  privateKey
);
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

// 1. 静的ファイル（HTML, manifest等）を返す HTTP サーバーを作成
const server = http.createServer((req, res) => {
  let filePath = '.' + req.url;
  if (filePath === './' || filePath === './index.html') {
    filePath = './index.html';
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.json': 'application/json',
    '.js': 'text/javascript',
    '.css': 'text/css'
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('File Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// 2. HTTP サーバーの上に WebSocketServer を載せる
const wss = new WebSocketServer({ server });

const rooms = {};

wss.on('connection', (ws) => {
  let currentRoom = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      
      if (msg.type === 'join') {
        currentRoom = msg.room;
        if (!rooms[currentRoom]) rooms[currentRoom] = [];
        rooms[currentRoom].push(ws);
        console.log(`User joined room: ${currentRoom}`);
      } 
      else if (currentRoom && rooms[currentRoom]) {
        rooms[currentRoom].forEach((client) => {
          if (client !== ws && client.readyState === 1) {
            client.send(JSON.stringify(msg));
          }
        });
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom] = rooms[currentRoom].filter((client) => client !== ws);
      if (rooms[currentRoom].length === 0) delete rooms[currentRoom];
    }
  });
});

// 3. Renderが指定するポート（または3000）で起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
