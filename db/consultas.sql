-- =====================================================================
-- Consultas de ESTUDO. Rode uma de cada vez no SQLite Viewer /
-- DB Browser for SQLite abrindo o arquivo db/inscricoes.db.
-- =====================================================================

-- 1) SELECT simples: tudo da tabela de inscrições
SELECT * FROM inscricoes;

-- 2) Escolhendo colunas e filtrando com WHERE
SELECT nome, email FROM inscricoes WHERE modalidade = 'online';

-- 3) JOIN: troca o curso_id pelo nome do curso (junta duas tabelas)
SELECT i.nome, c.nome AS curso
FROM inscricoes i
JOIN cursos c ON c.id = i.curso_id;

-- 4) Relação N:N: quais atividades cada pessoa escolheu (junta TRÊS tabelas)
SELECT i.nome, a.nome AS atividade
FROM inscricoes i
JOIN inscricao_atividades ia ON ia.inscricao_id = i.id
JOIN atividades a            ON a.id = ia.atividade_id
ORDER BY i.nome;

-- 5) GROUP BY + COUNT: quantos inscritos por curso
--    LEFT JOIN mantém cursos com zero inscritos
SELECT c.nome AS curso, COUNT(i.id) AS inscritos
FROM cursos c
LEFT JOIN inscricoes i ON i.curso_id = c.id
GROUP BY c.id
ORDER BY inscritos DESC;

-- 6) Atividade mais procurada (ORDER BY + LIMIT)
SELECT a.nome, COUNT(*) AS interessados
FROM inscricao_atividades ia
JOIN atividades a ON a.id = ia.atividade_id
GROUP BY a.id
ORDER BY interessados DESC
LIMIT 1;

-- 7) Presencial × on-line
SELECT modalidade, COUNT(*) AS total FROM inscricoes GROUP BY modalidade;

-- 8) HAVING: filtro DEPOIS do agrupamento (cursos com 2 ou mais inscritos)
SELECT c.nome, COUNT(*) AS total
FROM inscricoes i
JOIN cursos c ON c.id = i.curso_id
GROUP BY c.id
HAVING COUNT(*) >= 2;

-- 9) Busca parcial com LIKE (% = qualquer texto)
SELECT nome, email FROM inscricoes WHERE nome LIKE '%silva%';

-- 10) Idade aproximada calculada a partir da data de nascimento
SELECT nome,
       CAST((julianday('now') - julianday(data_nascimento)) / 365.25 AS INTEGER) AS idade
FROM inscricoes
WHERE data_nascimento IS NOT NULL;

-- 11) UPDATE: alterar dados (SEMPRE com WHERE, senão altera TODAS as linhas!)
-- UPDATE inscricoes SET modalidade = 'presencial' WHERE id = 1;

-- 12) DELETE: apagar (SEMPRE com WHERE!). O CASCADE apaga as atividades ligadas.
-- DELETE FROM inscricoes WHERE id = 1;

-- 13) Testando as restrições (devem DAR ERRO de propósito):
-- INSERT INTO inscricoes (nome, email, curso_id, semestre, modalidade)
--     VALUES ('Teste', 'x@x.com', 1, 9, 'online');          -- CHECK: semestre 9 não existe
-- INSERT INTO inscricoes (nome, email, curso_id, semestre, modalidade)
--     VALUES ('Teste', 'x@x.com', 999, 1, 'online');        -- FOREIGN KEY: curso 999 não existe
