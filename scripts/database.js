const sql = require('mssql');

const config = {
  user: 'CloudSA76d82763', // Seu usuário administrador do servidor
  password: 'Tcc2024*', // Sua senha de administrador do servidor
  server: 'usuarios.database.windows.net', // Nome do servidor SQL
  database: 'users', // Nome do banco de dados
  options: {
    encrypt: true, // Usar criptografia
    trustServerCertificate: false // Não confiar automaticamente no certificado do servidor
  }
};

// Função para realizar uma consulta no banco de dados
async function executeQuery(query) {
  try {
    await sql.connect(config);
    const result = await sql.query(query);
    return result.recordset;
  } catch (err) {
    console.error('Erro ao executar consulta:', err);
    throw err;
  } finally {
    await sql.close();
  }
}

// Exemplo de uso da função executeQuery
executeQuery('SELECT * FROM Users')
  .then((data) => {
    console.log('Dados recuperados do banco de dados:', data);
  })
  .catch((err) => {
    console.error('Erro ao recuperar dados do banco de dados:', err);
  });
