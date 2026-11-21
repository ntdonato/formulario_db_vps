// Regras de validação do servidor. O navegador valida para ajudar a pessoa;
// o servidor valida de novo para proteger o sistema.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MODALIDADES = ['presencial', 'online'];

function paraLista(valor) {
    if (valor === undefined) return [];
    return Array.isArray(valor) ? valor : [valor];
}

function dataValida(texto) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
    const data = new Date(`${texto}T00:00:00Z`);
    return !Number.isNaN(data.getTime()) && data.toISOString().startsWith(texto) && data < new Date();
}

export function validarInscricao(corpo, { cursos, atividades }) {
    const dados = {
        nome: String(corpo.nome ?? '').trim(),
        email: String(corpo.email ?? '').trim().toLowerCase(),
        nascimento: String(corpo.nascimento ?? '').trim() || null,
        curso: String(corpo.curso ?? '').trim(),
        semestre: Number(corpo.semestre),
        atividades: [...new Set(paraLista(corpo.atividades).map(String))],
        modalidade: String(corpo.modalidade ?? '').trim(),
        comentarios: String(corpo.comentarios ?? '').trim() || null,
        consentimento: corpo.consentimento === 'sim',
    };

    const erros = [];
    if (dados.nome.length < 3 || dados.nome.length > 120) erros.push('Informe o nome completo (3 a 120 caracteres).');
    if (dados.email.length > 254 || !EMAIL_REGEX.test(dados.email)) erros.push('Informe um e-mail válido.');
    if (dados.nascimento && !dataValida(dados.nascimento)) erros.push('Data de nascimento inválida.');
    if (!cursos.includes(dados.curso)) erros.push('Selecione um curso da lista.');
    if (!Number.isInteger(dados.semestre) || dados.semestre < 1 || dados.semestre > 5) erros.push('Selecione o semestre atual.');
    if (dados.atividades.length > atividades.length || dados.atividades.some((c) => !atividades.includes(c))) {
        erros.push('Há uma atividade de interesse inválida.');
    }
    if (!MODALIDADES.includes(dados.modalidade)) erros.push('Selecione a modalidade de participação.');
    if (dados.comentarios && dados.comentarios.length > 1000) erros.push('Comentários: no máximo 1000 caracteres.');
    // LGPD: só guardamos dados pessoais com o consentimento da pessoa
    if (!dados.consentimento) erros.push('É preciso concordar com a política de privacidade.');

    return { dados, erros };
}

export function escaparHtml(texto) {
    return String(texto)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

export function paginaDeErros(erros, titulo = 'Não foi possível concluir a inscrição') {
    const itens = erros.map((erro) => `<li>${escaparHtml(erro)}</li>`).join('');
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Erro</title>
    <link rel="stylesheet" href="/estilo.css">
</head>
<body>
    <main class="cartao">
        <h1>${escaparHtml(titulo)}</h1>
        <ul class="erros">${itens}</ul>
        <p>Use o botão <strong>Voltar</strong> do navegador para corrigir sem perder o que já digitou,
        ou <a href="/inscricao.html">recomece a inscrição</a>.</p>
    </main>
</body>
</html>`;
}
