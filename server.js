// server.js

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const db = require('./scripts/database.js');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  res.redirect('/login');
});

// Redirecionar todas as outras solicitações para a página de login
app.use((req, res) => {
  res.redirect('/login');
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Código do WebSocket aqui...

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
