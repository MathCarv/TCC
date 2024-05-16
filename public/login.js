$(document).ready(function() {
    // Seleciona o formulário de login
    const loginForm = $('#loginForm');
    const errorMessage = $('#errorMessage'); // Seleciona a div para exibir a mensagem de erro

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
                // Verifica se a resposta contém o redirecionamento para a página index.html
                if (response.redirect) {
                    window.location.href = response.redirect; // Redireciona para a página especificada na resposta
                } else {
                    console.error('Redirect URL not found in response.');
                    // Em caso de redirecionamento não encontrado na resposta, exibe uma mensagem de erro genérica
                    errorMessage.text('Error: Redirect URL not found.');
                }
            },
            error: function(xhr, status, error) {
                console.error('Error logging in:', error);
                // Exibe uma mensagem de erro ao usuário
                errorMessage.text('Invalid username or password. Please try again.'); // Define o texto da mensagem de erro
            }
        });
    });
});
