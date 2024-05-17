const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const crypto = require('crypto');
const EventHubReader = require('./scripts/event-hub-reader.js');


const iotHubConnectionString = process.env.IotHubConnectionString;
if (!iotHubConnectionString) {
  console.error(`Environment variable IotHubConnectionString must be specified.`);
  return;
}
console.log(`Using IoT Hub connection string [${iotHubConnectionString}]`);

const eventHubConsumerGroup = process.env.EventHubConsumerGroup;
console.log(eventHubConsumerGroup);
if (!eventHubConsumerGroup) {
  console.error(`Environment variable EventHubConsumerGroup must be specified.`);
  return;
}
console.log(`Using event hub consumer group [${eventHubConsumerGroup}]`);


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Gera uma chave secreta aleatória usando SHA256
const secretKey = crypto.randomBytes(32).toString('hex');

// Configuração da sessão
app.use(session({
  secret: secretKey,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60000 }
}));

const credentialsFile = path.join(__dirname, 'credentials.json');

const loadCredentials = () => {
  try {
    const data = fs.readFileSync(credentialsFile);
    const credentials = JSON.parse(data);
    console.log('Credenciais carregadas:', credentials);
    return credentials;
  } catch (err) {
    console.error('Erro ao ler o arquivo de credenciais:', err);
    return {};
  }
};

function isAuthenticated(req, res, next) {
  if (req.session && req.session.isAuthenticated) {
    return next();
  } else {
    res.redirect('/login');
  }
}

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const credentials = loadCredentials();
  console.log('Verificando credenciais do usuário:', username);

  if (credentials[username] && credentials[username] === password) {
    req.session.isAuthenticated = true;
    console.log('Login bem-sucedido do usuário: ', username);
    console.log('Redirecting to /index.html');
    return res.status(200).json({ redirect: '/index.html' });
  } else {
    console.log('Credenciais inválidas para o usuário: ', username);
    return res.status(401).json({ message: 'Invalid username or password' });
  }
});

app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/index.html', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/logout', (req, res) => {
  // Limpar a sessão do usuário
  req.session.destroy((err) => {
    if (err) {
      console.error('Erro ao fazer logout:', err);
      return res.status(500).json({ message: 'Erro ao fazer logout' });
    }
    // Redirecionar para a página de login
    res.redirect('/login');
  });
});

// Servir arquivos estáticos do diretório public
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (message) => {
    console.log('Received message:', message);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

wss.broadcast = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        console.log(`Broadcasting data ${data}`);
        client.send(data);
      } catch (e) {
        console.error(e);
      }
    }
  });
};

const eventHubReader = new EventHubReader(iotHubConnectionString, eventHubConsumerGroup);
(async () => {
  await eventHubReader.startReadMessage((message, date, deviceId) => {
    try {
      const payload = {
        IotData: message,
        MessageDate: date || Date.now().toISOString(),
        DeviceId: deviceId,
      };

      wss.broadcast(JSON.stringify(payload));
    } catch (err) {
      console.error('Error broadcasting: [%s] from [%s].', err, message);
    }
  });
})().catch();

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
