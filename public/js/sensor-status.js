$(document).ready(function() {
    const protocol = document.location.protocol.startsWith('https') ? 'wss://' : 'ws://';
    const webSocket = new WebSocket(protocol + location.host);

    webSocket.onmessage = function onMessage(message) {
        try {
            const messageData = JSON.parse(message.data);
            console.log('Mensagem recebida:', messageData);

            // Atualiza o sensor de presença
            if (messageData.DeviceId === 'sensorpresenca') {
                console.log('Valor do sensor de presença:', messageData.IotData.presence);
                updateSensorDisplay('sensorPresenca', messageData.IotData.presence);
            }

            // Atualiza o sensor da trava
            if (messageData.DeviceId === 'sensortrava') {
                console.log('Valor do sensor da trava:', messageData.IotData.lock);
                // Substitua 'lock' pelo campo relevante para o status da trava
                updateSensorDisplay('sensorTrava', messageData.IotData.lock);
            }

            // Atualiza o sensor de magnetismo
            if (messageData.DeviceId === 'sensormagnetismo') {
                console.log('Valor do sensor de magnetismo:', messageData.IotData.magnetism);
                // Substitua 'magnetism' pelo campo relevante para o status do magnetismo
                updateSensorDisplay('sensorMagnetismo', messageData.IotData.magnetism);
            }

        } catch (err) {
            console.error('Erro ao processar mensagem:', err);
        }
    };

    function updateSensorDisplay(sensorId, value) {
        var color = value == 0 ? 'red' : 'green';
        $('#' + sensorId).css('background-color', color);
    }
    
});
