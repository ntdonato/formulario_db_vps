// Camada de acesso ao banco SQLite: todo o SQL do sistema fica aqui.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// Em produção o caminho vem do .env (DB_PATH), fora da pasta do código.
const caminho = process.env.DB_PATH || path.join(import.meta.dirname, 'inscricoes.db');
fs.mkdirSync(path.dirname(caminho), { recursive: true });

const db = new DatabaseSync(caminho);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');   // leituras não bloqueiam gravações (melhor com vários acessos)
db.exec('PRAGMA busy_timeout = 5000;');  // espera até 5 s se o banco estiver ocupado, em vez de falhar
db.exec(fs.readFileSync(path.join(import.meta.dirname, 'schema.sql'), 'utf-8'));

export class EmailDuplicadoError extends Error {}

export function fecharBanco() {
    db.close();
}

export function bancoOk() {
    return db.prepare('SELECT 1 AS ok').get().ok === 1;
}

export function listarCursos() {
    return db.prepare("SELECT id, codigo, nome FROM cursos ORDER BY codigo = 'outro', nome").all();
}

export function listarAtividades() {
    return db.prepare('SELECT id, codigo, nome FROM atividades ORDER BY id').all();
}

const sqlInserirInscricao = db.prepare(`
    INSERT INTO inscricoes
        (nome, email, data_nascimento, curso_id, semestre, modalidade, comentarios, consentimento_em)
    VALUES
        (?, ?, ?, (SELECT id FROM cursos WHERE codigo = ?), ?, ?, ?, datetime('now'))
`);

const sqlInserirAtividade = db.prepare(`
    INSERT INTO inscricao_atividades (inscricao_id, atividade_id)
    VALUES (?, (SELECT id FROM atividades WHERE codigo = ?))
`);

export function salvarInscricao(dados) {
    db.exec('BEGIN');
    try {
        const resultado = sqlInserirInscricao.run(
            dados.nome, dados.email, dados.nascimento, dados.curso,
            dados.semestre, dados.modalidade, dados.comentarios,
        );
        const inscricaoId = Number(resultado.lastInsertRowid);
        for (const codigo of dados.atividades) sqlInserirAtividade.run(inscricaoId, codigo);
        db.exec('COMMIT');
        return inscricaoId;
    } catch (erro) {
        db.exec('ROLLBACK');
        if (String(erro.message).includes('UNIQUE constraint failed: inscricoes.email')) {
            throw new EmailDuplicadoError('Este e-mail já está inscrito.');
        }
        throw erro;
    }
}

const sqlListarInscricoes = db.prepare(`
    SELECT
        i.id, i.nome, i.email,
        i.data_nascimento AS nascimento,
        c.nome            AS curso,
        i.semestre, i.modalidade, i.comentarios,
        i.criado_em       AS criadoEm,
        GROUP_CONCAT(a.nome, '|') AS atividades
    FROM inscricoes i
    JOIN cursos c                     ON c.id = i.curso_id
    LEFT JOIN inscricao_atividades ia ON ia.inscricao_id = i.id
    LEFT JOIN atividades a            ON a.id = ia.atividade_id
    WHERE (? IS NULL OR i.nome LIKE ? ESCAPE '\\' OR i.email LIKE ? ESCAPE '\\')
    GROUP BY i.id
    ORDER BY i.criado_em DESC, i.id DESC
`);

export function listarInscricoes(busca) {
    // Escapa os curingas do LIKE (% e _) para que sejam buscados como texto comum
    const termo = busca ? `%${busca.replace(/[\\%_]/g, '\\$&')}%` : null;
    return sqlListarInscricoes.all(termo, termo, termo).map((linha) => ({
        ...linha,
        atividades: linha.atividades ? linha.atividades.split('|') : [],
    }));
}

const sqlExcluir = db.prepare('DELETE FROM inscricoes WHERE id = ?');

export function excluirInscricao(id) {
    return sqlExcluir.run(id).changes > 0;
}

export function gerarRelatorio() {
    return {
        total: db.prepare('SELECT COUNT(*) AS total FROM inscricoes').get().total,
        porCurso: db.prepare(`
            SELECT c.nome AS rotulo, COUNT(i.id) AS total
            FROM cursos c LEFT JOIN inscricoes i ON i.curso_id = c.id
            GROUP BY c.id ORDER BY total DESC, c.nome`).all(),
        porAtividade: db.prepare(`
            SELECT a.nome AS rotulo, COUNT(ia.inscricao_id) AS total
            FROM atividades a LEFT JOIN inscricao_atividades ia ON ia.atividade_id = a.id
            GROUP BY a.id ORDER BY total DESC, a.nome`).all(),
        porModalidade: db.prepare(`
            SELECT modalidade AS rotulo, COUNT(*) AS total
            FROM inscricoes GROUP BY modalidade ORDER BY total DESC`).all(),
        porSemestre: db.prepare(`
            SELECT semestre || 'º semestre' AS rotulo, COUNT(*) AS total
            FROM inscricoes GROUP BY semestre ORDER BY semestre`).all(),
    };
}

// Cópia de segurança consistente, mesmo com o servidor rodando.
// VACUUM INTO grava uma cópia completa do banco em outro arquivo.
export function fazerBackup(destino) {
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    db.prepare('VACUUM INTO ?').run(destino);
}
