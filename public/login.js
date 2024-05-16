$(document).ready(function() {
    $('#loginForm').submit(function(event) {
        event.preventDefault(); // Evita que o formulário seja enviado por padrão

        // Obtenha os valores dos campos de entrada
        var username = $('#username').val();
        var password = $('#password').val();

        // Envie uma solicitação POST para o endpoint /login
        $.ajax({
            url: '/login',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ username: username, password: password }),
            success: function(response) {
                // Se o login for bem-sucedido, redirecione para a página principal
                window.location.href = '/index.html';
            },
            error: function(xhr, status, error) {
                // Se houver um erro, exiba uma mensagem de erro
                alert('Error: ' + xhr.responseText);
            }
        });
    });

    // Remove as vulnerabilidades XSS
    // Exemplo de manipulação segura de HTML
    $('#userGreeting').text('Please log in to continue.');

    // Remova o link inseguro
    // A lógica aqui é não incluir links inseguros no HTML
});
