const webpush = require('web-push');

// VAPIDキーを固定設定
const publicKey = 'BPSJBiHSKzcUTmd3WrDiXPRd_SUTOwg8PBl3iUbzThc3FqTsxpadgebGs2TscnM3gIe_cM2GJu4CzCUEA-a02S8';
const privateKey = 'OezFBL3U6sfqyYkV5EL0uSgoSob8xA0s_LsWu7zIN8I';

webpush.setVapidDetails(
  'mailto:example@example.com',
  publicKey,
  privateKey
);

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

// サブスクリプション（通知宛先）を保持する配列
let subscriptions = [];

// 1. 静的ファイル（HTML, manifest等）を返す HTTP サーバーの設定
const server = http.createServer((req, res) => {
  let filePath = '.' + req.url;
  if (filePath === './' || filePath === './index.html') {
    filePath = './index.html';
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png'
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('404 Not Found', 'utf-8');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + error.code, 'utf-8');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// 2. WebSocket サーバーの設定
const wss = new WebSocketServer({ server });
const rooms = {};

// プッシュ通知を送信する関数
function sendPushNotification(title, body) {
  const payload = JSON.stringify({ title, body });
  subscriptions.forEach((sub, index) => {
    webpush.sendNotification(sub, payload).catch(err => {
      console.error('Push通知送信エラー:', err);
      // 送信失敗した宛先は配列から削除
      if (err.statusCode === 410 || err.statusCode === 404) {
        subscriptions.splice(index, 1);
      }
    });
  });
}

wss.on('connection', (ws) => {
  let currentRoom = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'subscribe') {
        // 通知用のサブスクリプション登録
        if (!subscriptions.some(s => s.endpoint === data.subscription.endpoint)) {
          subscriptions.push(data.subscription);
        }
      } else if (data.type === 'join') {
        currentRoom = data.room;
        if (!rooms[currentRoom]) {
          rooms[currentRoom] = [];
        }
        rooms[currentRoom].push(ws);
        
        // 相手が参加してきたら通知を飛ばす
        sendPushNotification('🧵 糸でんわ', `ルーム [${currentRoom}] に誰かが参加しました！`);
      } else if (currentRoom && rooms[currentRoom]) {
        // 同じルームの他のユーザーへ転送
        rooms[currentRoom].forEach((client) => {
          if (client !== ws && client.readyState === 1) { // 1 = OPEN
            client.send(JSON.stringify(data));
          }
        });

        // メッセージ受信時にも通知を飛ばす
        if (data.type === 'text') {
          sendPushNotification('💬 新しいメッセージ', data.text);
        } else if (data.type === 'image') {
          sendPushNotification('📷 画像が届きました', '相手から画像が送信されました！');
        }
      }
    } catch (e) {
      console.error('Error handling message:', e);
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom] = rooms[currentRoom].filter((client) => client !== ws);
      if (rooms[currentRoom].length === 0) {
        delete rooms[currentRoom];
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
