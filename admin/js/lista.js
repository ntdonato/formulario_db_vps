// Busca os dados na API do servidor e monta a tabela e o relatório.

const corpoTabela = document.querySelector('#tabela-inscricoes tbody');
const aviso = document.getElementById('aviso');
const conteudoRelatorio = document.getElementById('conteudo-relatorio');

const NOMES_MODALIDADE = { presencial: 'Presencial', online: 'On-line' };

// O SQLite guarda "2026-11-20 14:05:00" em UTC; convertemos para o horário local.
function formatarData(texto) {
    const iso = texto.includes('T') ? texto : `${texto.replace(' ', 'T')}Z`;
    return new Date(iso).toLocaleString('pt-BR');
}

async function carregarInscricoes(busca = '') {
    const url = busca ? `/api/admin/inscricoes?busca=${encodeURIComponent(busca)}` : '/api/admin/inscricoes';
    try {
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        const inscricoes = await resposta.json();

        corpoTabela.replaceChildren();
        aviso.textContent = inscricoes.length === 0
            ? 'Nenhuma inscrição encontrada.'
            : `${inscricoes.length} inscrição(ões) encontrada(s).`;

        for (const inscricao of inscricoes) {
            const linha = corpoTabela.insertRow();
            const valores = [
                inscricao.nome,
                inscricao.email,
                inscricao.curso,
                `${inscricao.semestre}º`,
                NOMES_MODALIDADE[inscricao.modalidade] ?? inscricao.modalidade,
                inscricao.atividades.join(', ') || '—',
                formatarData(inscricao.criadoEm),
            ];
            for (const valor of valores) {
                // textContent (e não innerHTML): o texto digitado pelo usuário nunca vira HTML → evita XSS
                linha.insertCell().textContent = valor;
            }

            const botao = document.createElement('button');
            botao.type = 'button';
            botao.textContent = 'Excluir';
            botao.setAttribute('aria-label', `Excluir inscrição de ${inscricao.nome}`);
            botao.addEventListener('click', () => excluir(inscricao));
            linha.insertCell().append(botao);
        }
    } catch (erro) {
        aviso.textContent = "Não foi possível carregar as inscrições. Tente recarregar a página.";
        console.error(erro);
    }
}

async function excluir(inscricao) {
    if (!confirm(`Excluir a inscrição de ${inscricao.nome}?`)) return;

    const resposta = await fetch(`/api/admin/inscricoes/${inscricao.id}`, { method: 'DELETE' });
    if (resposta.ok) {
        await carregarInscricoes(document.getElementById('busca').value.trim());
        await carregarRelatorio();
    } else if (resposta.status === 404) {
        await carregarInscricoes(document.getElementById('busca').value.trim());
        aviso.textContent = 'Inscrição não encontrada (talvez já tenha sido excluída). A lista foi atualizada.';
    } else {
        aviso.textContent = 'Não foi possível excluir a inscrição.';
    }
}

// Monta uma tabelinha "rótulo | total" para cada parte do relatório.
function tabelaResumo(titulo, linhas) {
    const tabela = document.createElement('table');
    tabela.createCaption().textContent = titulo;
    const corpo = tabela.createTBody();
    for (const { rotulo, total } of linhas) {
        const linha = corpo.insertRow();
        linha.insertCell().textContent = NOMES_MODALIDADE[rotulo] ?? rotulo;
        linha.insertCell().textContent = total;
    }
    return tabela;
}

async function carregarRelatorio() {
    try {
        const resposta = await fetch('/api/admin/relatorio');
        if (!resposta.ok) {
            conteudoRelatorio.textContent = 'Não foi possível carregar o relatório.';
            return;
        }
        const relatorio = await resposta.json();

        const total = document.createElement('p');
        total.textContent = `Total de inscrições: ${relatorio.total}`;

        const grade = document.createElement('div');
        grade.className = 'grade-relatorio';
        grade.append(
            tabelaResumo('Por curso', relatorio.porCurso),
            tabelaResumo('Por atividade', relatorio.porAtividade),
            tabelaResumo('Por modalidade', relatorio.porModalidade),
            tabelaResumo('Por semestre', relatorio.porSemestre),
        );

        conteudoRelatorio.replaceChildren(total, grade);
    } catch {
        conteudoRelatorio.textContent = 'Não foi possível carregar o relatório.';
    }
}

document.getElementById('form-busca').addEventListener('submit', (evento) => {
    evento.preventDefault(); // não recarrega a página; busca via fetch
    carregarInscricoes(document.getElementById('busca').value.trim());
});

carregarInscricoes();
carregarRelatorio();
