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

const iotHubConnectionString = "HostName=TccIotSecurity.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=2Se7ogU6qcnwcrZjoMxBYwGSbwo9z5xUVAIoTK9rRDc=";
if (!iotHubConnectionString) {
    console.error(`Environment variable IotHubConnectionString must be specified.`);
    process.exit(1);
}
console.log(`Using IoT Hub connection string [${iotHubConnectionString}]`);

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
