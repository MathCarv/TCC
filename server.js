const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const EventHubReader = require('./scripts/event-hub-reader.js');
const db = require('./db'); // Importe o módulo do banco de dados

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

// Inicialize o aplicativo Express
const app = express();

// Configurar a pasta de arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rota para a página de login
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Rota para autenticar o usuário
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Consultar o banco de dados para verificar as credenciais do usuário
    const user = await db.User.findOne({ where: { username: username } });
    if (!user || user.password !== password) {
      // Credenciais inválidas
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Credenciais corretas
    // Você pode retornar um token de autenticação aqui ou redirecionar para a página principal
    return res.status(200).json({ message: 'Login successful' });
  } catch (error) {
    console.error('Error authenticating user:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Rota para lidar com a solicitação de logout
app.get('/logout', (req, res) => {
  // Aqui você pode limpar a sessão do usuário, se estiver usando sessões
  // Por exemplo: req.session.destroy();

  // Redirecione o usuário de volta para a página de login
  res.redirect('/login');
});

// Redirecionar todas as outras solicitações para a página de login
app.use((req, res) => {
  res.redirect('/login');
});

// Criar o servidor HTTP
const server = http.createServer(app);

// Inicializar o servidor WebSocket
const wss = new WebSocket.Server({ server });

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

// Iniciar o servidor HTTP
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Inicializar o leitor do Event Hub
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
      console.error('Error broadcasting:', err);
    }
  });
})().catch(console.error);
