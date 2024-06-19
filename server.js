const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const crypto = require('crypto');
const moment = require('moment');
const bodyParser = require('body-parser');
const EventHubReader = require('./scripts/event-hub-reader.js');
const MQTT = require("async-mqtt");

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

const iotHubConnectionString = "HostName=TccIotHub.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=jjOkrHXECYjcHVFg3KhLDUWaSc+WCN2oIAIoTPLYZ8k=";
if (!iotHubConnectionString) {
    console.error(`Environment variable IotHubConnectionString must be specified.`);
    process.exit(1);
}
console.log(`Using IoT Hub connection string [${iotHubConnectionString}]`);

const deviceId = "sensortrava";
const iotHubName = "TccIotHub";
const userName = `${iotHubName}.azure-devices.net/${deviceId}/api-version=2016-11-14`;
const iotHubTopic = `devices/${deviceId}/messages/events/`;

function generateSasToken(endpoint, policyKey, policyName, expiresInMins) {
  endpoint = encodeURIComponent(endpoint.toLowerCase());
  
  const expiry = moment().add(expiresInMins, 'minutes').unix();
  const stringToSign = `${endpoint}\n${expiry}`;

  const hmac = crypto.createHmac('sha256', Buffer.from(policyKey, 'base64'));
  hmac.update(stringToSign);
  const signature = encodeURIComponent(hmac.digest('base64'));

  return {
      token: `SharedAccessSignature sr=${endpoint}&sig=${signature}&se=${expiry}&skn=${policyName}`,
      expiresOn: expiry
  };
}

const iotHubEndpoint = "TccIotHub.azure-devices.net";
const policyName = "service";
const policyKey = "jjOkrHXECYjcHVFg3KhLDUWaSc+WCN2oIAIoTPLYZ8k=";
const sasToken = generateSasToken(iotHubEndpoint, policyKey, policyName, 60);
console.log("Generated SAS Token:", sasToken.token);
console.log("Token expires on:", moment.unix(sasToken.expiresOn).format('YYYY-MM-DD HH:mm:ss'));

var client = MQTT.connect(`mqtts://${iotHubName}.azure-devices.net:8883`, {
  keepalive: 10,
  clientId: deviceId,
  protocolId: 'MQTT',
  clean: false,
  protocolVersion: 4,
  reconnectPeriod: 1000,
  connectTimeout: 30 * 1000,
  username: userName,
  password: sasToken.token,
  rejectUnauthorized: false, 
});

async function doStuff() {
  console.log("Starting MQTT operations");
  try {
      await client.publish(iotHubTopic, "It works!");
      await client.end();
      console.log("MQTT operations completed");
  } catch (e) {
      console.log("Error while sending a message...");
      console.log(e.stack);
      process.exit();
  }
}

// Rota para receber comandos do cliente
app.post('/send_command', (req, res) => {
  const command = req.body.command;

  // Enviar o comando para o IoT Hub
  sendCommandToIoTHub(command);

  console.log('Received command:', command);

  res.status(200).json({ message: 'Command received successfully' });
});

async function sendCommandToIoTHub(command) {
  try {
      await client.publish(iotHubTopic, command.toString()); // Converte para string, se necessário
      console.log('Command sent to IoT Hub:', command);
  } catch (error) {
      console.error('Error sending command to IoT Hub:', error);
  }
}

function generateMessageId() {
    // Gera um identificador único para cada mensagem
    return `Message_${Math.random().toString(16).substr(2, 8)}`;
}

const eventHubConsumerGroup = "tccconsumergroup";
if (!eventHubConsumerGroup) {
    console.error(`Environment variable EventHubConsumerGroup must be specified.`);
    process.exit(1);
}
console.log(`Using event hub consumer group [${eventHubConsumerGroup}]`);

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        console.log('Received message:', message);
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

const eventHubReader = new EventHubReader(iotHubConnectionString, eventHubConsumerGroup);

(async () => {
    await eventHubReader.startReadMessage((message, date, deviceId) => {
        try {
            const payload = {
                IotData: message,
                MessageDate: date || new Date().toISOString(),
                DeviceId: deviceId,
            };

            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(payload));
                }
            });
        } catch (err) {
            console.error('Error broadcasting: [%s] from [%s].', err, message);
        }
    });
})().catch();

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
