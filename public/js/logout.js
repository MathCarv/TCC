// Captura o clique no botão de logout
document.getElementById('logoutButton').addEventListener('click', function() {
    // Envia uma requisição GET para a rota de logout
    fetch('/logout', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Erro ao fazer logout');
        }
        // Redireciona para a página de login após o logout
        window.location.href = '/login';
    })
    .catch(error => console.error('Erro ao fazer logout:', error));
});
