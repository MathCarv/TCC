$(document).ready(function() {
    // Seleciona o formulário de login
    const loginForm = $('#loginForm');

    // Manipula o evento de envio do formulário
    loginForm.submit(function(event) {
        // Impede o comportamento padrão do formulário de ser submetido
        event.preventDefault();

        // Obtém os valores dos campos de usuário e senha
        const username = $('#username').val();
        const password = $('#password').val();

        // Faz uma solicitação AJAX para autenticar o usuário
        $.ajax({
            url: '/login', // Rota no servidor para autenticar o usuário
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ username: username, password: password }),
            success: function(response) {
                // Redireciona o usuário para a página principal se o login for bem-sucedido
                window.location.href = '/index.html';
            },
            error: function(xhr, status, error) {
                console.error('Error logging in:', error);
                // Exibe uma mensagem de erro ao usuário
                alert('Invalid username or password. Please try again.');
            }
        });
    });
});
