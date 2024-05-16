const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Caminho para o arquivo onde as credenciais serão armazenadas
const credentialsFile = path.join(__dirname, 'credentials.json');

// Função para carregar as credenciais do arquivo JSON
const loadCredentials = () => {
  try {
    const data = fs.readFileSync(credentialsFile);
    const credentials = JSON.parse(data);
    console.log('Loaded credentials:', credentials); // Imprime as credenciais carregadas
    return credentials;
  } catch (err) {
    console.error('Error reading credentials file:', err);
    return {};
  }
};

// Rota para a página de login
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Rota para autenticar o usuário
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const credentials = loadCredentials();
  console.log('Checking credentials for user:', username); // Imprime o nome de usuário

  // Verifica se as credenciais fornecidas correspondem às credenciais armazenadas
  if (credentials[username] && credentials[username] === password) {
    // Credenciais corretas
    console.log('Login successful for user:', username); // Imprime uma mensagem de sucesso
    return res.status(200).redirect('index.html'); // Alterei aqui
  } else {
    // Credenciais inválidas
    console.log('Invalid credentials for user:', username); // Imprime uma mensagem de erros
    return res.status(401).json({ message: 'Invalid username or password' });
  }
});


// Rota para lidar com a solicitação de logout
app.get('/logout', (req, res) => {
  res.redirect('/login');
});

// Redirecionar todas as outras solicitações para a página de login
app.use((req, res) => {
  res.redirect('/login');
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Código do WebSocket aqui...
wss.on('connection', (ws) => {
  console.log('Client connected');

  // Manipulador de evento para quando uma mensagem é recebida do cliente
  ws.on('message', (message) => {
    console.log('Received message:', message);

    // Aqui você pode processar a mensagem recebida e responder ao cliente, se necessário
    // Por exemplo, você pode consultar o arquivo JSON e enviar os dados para o cliente
    // ws.send('Hello, client!');
  });

  // Manipulador de evento para quando a conexão é fechada pelo cliente
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
