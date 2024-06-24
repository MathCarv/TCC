import chai from 'chai';
import chaiHttp from 'chai-http';
import { expect } from 'chai';
import server from '../../server.js';

chai.use(chaiHttp);
//Testes Back-End
describe('Server Tests', () => {
    it('Deve redirecionar para /login na rota /', (done) => {
        chai.request(server)
            .get('/')
            .end((err, res) => {
                expect(res).to.redirect;
                expect(res).to.have.status(200);
                done();
            });
    });

    it('Deve retornar a página de login na rota /login', (done) => {
        chai.request(server)
            .get('/login')
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res).to.be.html;
                done();
            });
    });

    it('Deve fazer login com credenciais válidas', (done) => {
        const credentials = { username: 'TCC', password: 'tcc' }; // Ajuste as credenciais aqui
        chai.request(server)
            .post('/login')
            .send(credentials)
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('redirect', '/index.html');
                done();
            });
    });

    it('Não deve fazer login com credenciais inválidas', (done) => {
        const credentials = { username: 'wrongUser', password: 'wrongPassword' };
        chai.request(server)
            .post('/login')
            .send(credentials)
            .end((err, res) => {
                expect(res).to.have.status(401);
                expect(res.body).to.have.property('message', 'Invalid username or password');
                done();
            });
    });
});
