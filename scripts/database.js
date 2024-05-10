// database.js

const { Sequelize, DataTypes } = require('sequelize');

// Configurar a conexão com o banco de dados
const sequelize = new Sequelize('users', 'CloudSA76d82763', 'Tcc2024*', {
  host: 'usuarios.database.windows.net',
  dialect: 'mssql',
  dialectOptions: {
    encrypt: true,
    trustServerCertificate: false
  }
});

// Definir o modelo de usuário
const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

// Sincronizar o modelo com o banco de dados
(async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexão bem-sucedida com o banco de dados.');
    await sequelize.sync(); // Isso sincronizará o modelo com o banco de dados, criando a tabela se não existir
    console.log('Modelo sincronizado com o banco de dados.');
  } catch (error) {
    console.error('Erro ao conectar e sincronizar o modelo:', error);
  }
})();

// Exportar o modelo de usuário
module.exports = { User };
