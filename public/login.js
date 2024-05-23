$(document).ready(function() {
    console.log('Document is ready'); // Log quando o documento está pronto

    const loginForm = $('#loginForm');
    const errorMessage = $('#errorMessage');

    loginForm.submit(function(event) {
        console.log('Form submitted'); // Log quando o formulário é enviado

        event.preventDefault();

        const username = $('#username').val();
        const password = $('#password').val();

        console.log('Username:', username); // Log do nome de usuário
        console.log('Password:', password); // Log da senha

        $.ajax({
            url: '/login',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ username: username, password: password }),
            success: function(response) {
                console.log('Response received:', response); // Log da resposta recebida

                if (response.redirect) {
                    console.log('Redirecting to:', response.redirect); // Log do redirecionamento
                    window.location.href = response.redirect;
                } else {
                    console.error('Redirect URL not found in response.');
                    // Vulnera a XSS ao inserir diretamente HTML sem sanitização
                    errorMessage.html('Error: ' + response.message);
                }
            },
            error: function(xhr, status, error) {
                console.error('Error logging in:', error); // Log do erro
                // Vulnera a XSS ao inserir diretamente HTML sem sanitização
                errorMessage.html('Nome de usuário ou senha inválidos. Por favor, tente novamente.');

                // Centralizar a mensagem de erro abaixo do botão de login
                const loginButton = $('#loginButton');
                const loginButtonPosition = loginButton.offset();
                const loginButtonHeight = loginButton.outerHeight();
                const errorMessageHeight = errorMessage.outerHeight();
                const errorMessageWidth = errorMessage.outerWidth();

                // Calcula a posição correta para a mensagem de erro
                const errorMessageTop = loginButtonPosition.top + loginButtonHeight + 10;
                const errorMessageLeft = (loginButtonPosition.left + loginButton.outerWidth() / 2) - (errorMessageWidth / 2);

                // Define a posição da mensagem de erro
                errorMessage.css({
                    position: 'absolute',
                    top: errorMessageTop,
                    left: errorMessageLeft
                });
            }
        });
    });
});
