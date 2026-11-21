// =====================================================================
// Servidor de PRODUÇÃO — Formulário de inscrição (Node.js + SQLite)
// Local:  npm start                (lê o .env, se existir)
// VPS:    pm2 start deploy/ecosystem.config.cjs
// =====================================================================
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import crypto from 'node:crypto';
import path from 'node:path';
import { validarInscricao, paginaDeErros } from './validacao.js';
import * as banco from './db/banco.js';

const PORTA = Number(process.env.PORTA) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const PRODUCAO = process.env.NODE_ENV === 'production';
const ADMIN_USUARIO = process.env.ADMIN_USUARIO || 'admin';
const ADMIN_SENHA = process.env.ADMIN_SENHA || '';

const app = express();

// Atrás do Nginx: confia em 1 proxy para descobrir o IP real do visitante
// (usado pelo limitador de requisições e pelos logs).
app.set('trust proxy', 1);
app.disable('x-powered-by'); // não anuncia que o servidor é Express

// Cabeçalhos de segurança (CSP, proteção contra clickjacking, etc.)
// Dois cabeçalhos só fazem sentido com HTTPS:
//  - upgrade-insecure-requests: manda o navegador buscar CSS/JS e enviar o
//    formulário por https:// — sem certificado, a página quebra;
//  - Strict-Transport-Security (HSTS): "use sempre HTTPS neste site".
// Por isso a versão completa só vale quando o visitante chegou por HTTPS
// (req.secure, que o Express descobre pelo X-Forwarded-Proto do Nginx).
const segurancaHttps = helmet();
const segurancaHttp = helmet({
    contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } },
    strictTransportSecurity: false,
});
app.use((req, res, next) => (req.secure ? segurancaHttps : segurancaHttp)(req, res, next));

app.use(express.urlencoded({ extended: false, limit: '20kb' })); // corpo grande demais é recusado

// ---------------------------------------------------------------------
// Limitadores: impedem que um robô envie milhares de inscrições
// ou tente adivinhar a senha da área admin.
// ---------------------------------------------------------------------
const limiteInscricoes = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    limit: 10,                // 10 envios por IP nesse período
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => res.status(429).send(
        paginaDeErros(['Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'], 'Calma aí!'),
    ),
});

const limiteAdmin = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});

// ---------------------------------------------------------------------
// Autenticação da área admin (HTTP Basic Auth).
// Só é segura com HTTPS, que o Certbot configura no Nginx.
// ---------------------------------------------------------------------
function iguaisComTempoConstante(a, b) {
    // Compara resumos de mesmo tamanho em tempo constante: não "vaza",
    // pelo tempo de resposta, quantos caracteres da senha estavam certos.
    const hashA = crypto.createHash('sha256').update(a).digest();
    const hashB = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(hashA, hashB);
}

function exigirAdmin(req, res, next) {
    if (!ADMIN_SENHA) {
        return res.status(503).send('Área administrativa desativada: defina ADMIN_SENHA no arquivo .env.');
    }
    const [tipo, credencial] = (req.headers.authorization || '').split(' ');
    if (tipo === 'Basic' && credencial) {
        const texto = Buffer.from(credencial, 'base64').toString('utf-8');
        const separador = texto.indexOf(':');
        const usuario = texto.slice(0, separador);
        const senha = texto.slice(separador + 1);
        const usuarioOk = iguaisComTempoConstante(usuario, ADMIN_USUARIO);
        const senhaOk = iguaisComTempoConstante(senha, ADMIN_SENHA);
        if (separador > -1 && usuarioOk && senhaOk) return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="Area administrativa", charset="UTF-8"');
    res.status(401).send('Acesso restrito.');
}

// ---------------------------------------------------------------------
// Rotas públicas
// ---------------------------------------------------------------------
app.use(express.static(path.join(import.meta.dirname, 'public'), {
    maxAge: PRODUCAO ? '1h' : 0, // em produção o navegador guarda CSS/JS por 1 hora
}));

// Usada para verificar se o sistema está no ar (monitoramento)
app.get('/saude', (req, res) => {
    res.json({ status: 'ok', banco: banco.bancoOk(), horario: new Date().toISOString() });
});

app.get('/api/opcoes', (req, res) => {
    res.json({ cursos: banco.listarCursos(), atividades: banco.listarAtividades() });
});

app.post('/inscricoes', limiteInscricoes, (req, res) => {
    const { dados, erros } = validarInscricao(req.body, {
        cursos: banco.listarCursos().map((c) => c.codigo),
        atividades: banco.listarAtividades().map((a) => a.codigo),
    });
    if (erros.length > 0) return res.status(400).send(paginaDeErros(erros));

    try {
        const id = banco.salvarInscricao(dados);
        console.log(`Inscrição #${id} salva`); // e-mail fora do log: logs não devem guardar dados pessoais
    } catch (erro) {
        if (erro instanceof banco.EmailDuplicadoError) {
            return res.status(409).send(paginaDeErros([erro.message]));
        }
        throw erro;
    }
    res.redirect(303, '/confirmacao.html');
});

// ---------------------------------------------------------------------
// Área administrativa (protegida): páginas em /admin e API em /api/admin
// ---------------------------------------------------------------------
app.use('/admin', limiteAdmin, exigirAdmin, express.static(path.join(import.meta.dirname, 'admin')));
app.use('/api/admin', limiteAdmin, exigirAdmin);

app.get('/api/admin/inscricoes', (req, res) => {
    const busca = String(req.query.busca ?? '').trim().slice(0, 100);
    res.json(banco.listarInscricoes(busca || null));
});

app.delete('/api/admin/inscricoes/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ erro: 'Id inválido.' });
    if (!banco.excluirInscricao(id)) return res.status(404).json({ erro: 'Inscrição não encontrada.' });
    res.status(204).end();
});

app.get('/api/admin/relatorio', (req, res) => {
    res.json(banco.gerarRelatorio());
});

// ---------------------------------------------------------------------
// 404 e erros
// ---------------------------------------------------------------------
app.use((req, res) => {
    res.status(404).send(paginaDeErros(['A página que você procurou não existe.'], 'Página não encontrada'));
});

app.use((erro, req, res, next) => {
    console.error(erro);
    if (res.headersSent) return next(erro);
    res.status(500).send(paginaDeErros(['Erro interno no servidor. Tente novamente mais tarde.'], 'Algo deu errado'));
});

// ---------------------------------------------------------------------
// Inicialização e desligamento seguro
// ---------------------------------------------------------------------
const servidor = app.listen(PORTA, HOST, () => {
    console.log(`Servidor em http://${HOST}:${PORTA} (${PRODUCAO ? 'produção' : 'desenvolvimento'})`);
    if (!ADMIN_SENHA) console.warn('AVISO: ADMIN_SENHA não definida — área /admin desativada.');
});

// O PM2 envia SIGINT/SIGTERM ao reiniciar: terminamos as requisições em andamento
// e fechamos o banco direitinho antes de sair.
function desligar(sinal) {
    console.log(`${sinal} recebido, encerrando...`);
    servidor.close(() => {
        banco.fecharBanco();
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref(); // garante a saída se algo travar
}
process.on('SIGINT', () => desligar('SIGINT'));
process.on('SIGTERM', () => desligar('SIGTERM'));
