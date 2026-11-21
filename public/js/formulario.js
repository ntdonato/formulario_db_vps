// ---------------------------------------------------------------------
// Aviso: página aberta direto do disco (file://) em vez de pelo servidor.
// Nesse caso o envio iria para "file:///C:/inscricoes" e daria ERR_FILE_NOT_FOUND,
// porque não existe servidor no caminho para receber os dados.
// ---------------------------------------------------------------------
function avisarSeAbertoSemServidor() {
    if (location.protocol !== 'file:') return; // aberto por http://localhost:3000 → tudo certo

    const aviso = document.createElement('div');
    aviso.className = 'aviso-servidor';
    aviso.setAttribute('role', 'alert'); // leitores de tela anunciam na hora

    const titulo = document.createElement('strong');
    titulo.textContent = 'Esta página foi aberta direto do arquivo, sem o servidor.';

    const explicacao = document.createElement('p');
    explicacao.textContent = 'Assim a inscrição não pode ser salva. No terminal, dentro da pasta formulário_db, '
        + 'rode "npm start" e depois acesse http://localhost:3000 no navegador.';

    aviso.append(titulo, explicacao);
    document.querySelector('main').prepend(aviso);

    // Impede o envio que levaria à página de erro do navegador
    document.querySelector('form').addEventListener('submit', (evento) => {
        evento.preventDefault();
        aviso.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
}

avisarSeAbertoSemServidor();

// Melhoria progressiva: o HTML já traz opções fixas e funciona sem JavaScript.
// Se o servidor responder, trocamos essas opções pelas que estão no BANCO.

async function carregarOpcoes() {
    try {
        const resposta = await fetch('/api/opcoes');
        if (!resposta.ok) return;
        const { cursos, atividades } = await resposta.json();

        // --- Cursos no <select> ---
        const select = document.getElementById('curso');
        const selecionado = select.value;
        select.replaceChildren(new Option('Selecione seu curso', ''));
        for (const curso of cursos) {
            select.add(new Option(curso.nome, curso.codigo));
        }
        select.value = selecionado;

        // --- Atividades como checkboxes ---
        const grupo = document.getElementById('grupo-atividades');
        grupo.querySelectorAll('.opcao').forEach((elemento) => elemento.remove());
        for (const atividade of atividades) {
            const id = `atividade-${atividade.codigo}`;

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = id;
            input.name = 'atividades';
            input.value = atividade.codigo;

            const label = document.createElement('label');
            label.htmlFor = id; // equivale ao atributo for="..."
            label.textContent = atividade.nome;

            const div = document.createElement('div');
            div.className = 'opcao';
            div.append(input, label);
            grupo.append(div);
        }
    } catch {
        // Sem servidor (ex.: arquivo aberto direto do disco): mantém as opções do HTML.
    }
}

carregarOpcoes();
