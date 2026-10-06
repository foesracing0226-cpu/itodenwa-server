const webpush = require('web-push');

// VAPIDキーの固定設定
const publicKey = 'BDxFmtYhZymkxU0xlT6TP5K3-7wahGajI7U__nES7NLNmldS9AOFgh4AXyDjWTgXoyuMfQ9hw-QAeORSVDlUhd0';
const privateKey = 'p_r1b1Q9gXeIHM457uc4pz1NK0EiRn-u51jQKnVUGbg';

webpush.setVapidDetails(
  'mailto:example@gmail.com',
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

// プッシュ通知を送信する関数（senderEndpointを指定すれば自分を除外可能）
function sendPushNotification(title, body, senderEndpoint = null) {
  const payload = JSON.stringify({ title, body });
  
  if (subscriptions.length === 0) {
    console.log('【通知スキップ】登録されている通知宛先（subscriptions）がありません。');
    return;
  }

  subscriptions.forEach((sub, index) => {
    // 送信元本人の端末には通知を送らない（重複防止）
    if (senderEndpoint && sub.endpoint === senderEndpoint) {
      return;
    }

    webpush.sendNotification(sub, payload)
      .then(() => console.log('【通知成功】Push通知を送信しました！'))
      .catch(err => {
        console.error('【通知エラー】Push通知送信失敗:', err.statusCode || err);
        // 無効になった通知宛先（期限切れなど）は削除
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
        ws.subscriptionEndpoint = data.subscription ? data.subscription.endpoint : null;
        
        if (data.subscription && !subscriptions.some(s => s.endpoint === data.subscription.endpoint)) {
          subscriptions.push(data.subscription);
          console.log(`【登録完了】新しい通知宛先を登録しました！現在の件数: ${subscriptions.length}`);
        } else {
          console.log(`【登録済み】すでに登録されている宛先です。現在の件数: ${subscriptions.length}`);
        }
      } else if (data.type === 'join') {
        currentRoom = data.room;
        if (!rooms[currentRoom]) {
          rooms[currentRoom] = [];
        }
        rooms[currentRoom].push(ws);
        console.log(`【ルーム参加】ルーム [${currentRoom}] に参加しました。`);
        
        // 相手（＝自分以外の全登録端末）へ通知を飛ばす
        sendPushNotification(
          '🧵 糸でんわ', 
          `相手がルーム（${currentRoom}）に参加しました！タップしてアプリを開いてください📞`,
          ws.subscriptionEndpoint
        );
      } else if (currentRoom && rooms[currentRoom]) {
        // 同じルームの他のユーザーへ転送
        rooms[currentRoom].forEach((client) => {
          if (client !== ws && client.readyState === 1) { // 1 = OPEN
            client.send(JSON.stringify(data));
          }
        });

        // メッセージ受信時にも自分以外の登録端末へ通知を飛ばす
        if (data.type === 'text') {
          sendPushNotification('💬 新しいメッセージ', data.text, ws.subscriptionEndpoint);
        } else if (data.type === 'image') {
          sendPushNotification('📷 画像が届きました', '相手から画像が送信されました！', ws.subscriptionEndpoint);
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
