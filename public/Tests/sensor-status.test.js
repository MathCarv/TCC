const { expect } = require('chai');

//Testes Front-end
describe('Processamento de Mensagens WebSocket', function() {
    it('deve atualizar o display do sensor de presença', function() {
        // Simula dados da mensagem WebSocket para o sensor de presença
        const messageData = {
            DeviceId: 'sensorpresenca',
            IotData: {
                presence: 1 // Simulando o valor de presença
            }
        };

        // Simula elemento DOM para o sensorPresenca
        const fakeDOMElement = {
            id: 'sensorPresenca',
            style: {
                backgroundColor: ''
            },
            css: function(property, value) {
                this.style[property] = value;
            }
        };

        // Função a ser testada
        function updateSensorDisplay(sensorId, value) {
            var color = value == 0 ? 'red' : 'green';
            fakeDOMElement.css('backgroundColor', color);
        }

        // Chama a função com os dados simulados da mensagem
        updateSensorDisplay(messageData.DeviceId, messageData.IotData.presence);

        // Verifica a cor de fundo esperada com base nos dados simulados
        expect(fakeDOMElement.style.backgroundColor).to.equal('green');
    });

    it('deve atualizar o display do sensor de magnetismo', function() {
        // Simula dados da mensagem WebSocket para o sensor de magnetismo
        const messageData = {
            DeviceId: 'sensormagnetismo',
            IotData: {
                magnetism: 0 // Simulando o valor de magnetismo
            }
        };

        // Simula elemento DOM para o sensorMagnetismo
        const fakeDOMElement = {
            id: 'sensorMagnetismo',
            style: {
                backgroundColor: ''
            },
            css: function(property, value) {
                this.style[property] = value;
            }
        };

        // Função a ser testada
        function updateSensorDisplay(sensorId, value) {
            var color = value == 0 ? 'red' : 'green';
            fakeDOMElement.css('backgroundColor', color);
        }

        // Chama a função com os dados simulados da mensagem
        updateSensorDisplay(messageData.DeviceId, messageData.IotData.magnetism);

        // Verifica a cor de fundo esperada com base nos dados simulados
        expect(fakeDOMElement.style.backgroundColor).to.equal('red');
    });
});
