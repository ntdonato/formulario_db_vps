-- Estrutura do banco (roda sempre que o servidor inicia; é idempotente).

CREATE TABLE IF NOT EXISTS cursos (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo  TEXT NOT NULL UNIQUE,
    nome    TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS atividades (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo  TEXT NOT NULL UNIQUE,
    nome    TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS inscricoes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nome            TEXT    NOT NULL CHECK (length(nome) BETWEEN 3 AND 120),
    email           TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    data_nascimento TEXT,
    curso_id        INTEGER NOT NULL REFERENCES cursos(id),
    semestre        INTEGER NOT NULL CHECK (semestre BETWEEN 1 AND 5),
    modalidade      TEXT    NOT NULL CHECK (modalidade IN ('presencial', 'online')),
    comentarios     TEXT,
    consentimento_em TEXT   NOT NULL,                          -- LGPD: quando a pessoa aceitou a política
    criado_em       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inscricao_atividades (
    inscricao_id INTEGER NOT NULL REFERENCES inscricoes(id) ON DELETE CASCADE,
    atividade_id INTEGER NOT NULL REFERENCES atividades(id),
    PRIMARY KEY (inscricao_id, atividade_id)
);

CREATE INDEX IF NOT EXISTS idx_inscricoes_curso ON inscricoes(curso_id);

INSERT OR IGNORE INTO cursos (codigo, nome) VALUES
    ('ads',           'Tecnologia em Análise e Desenvolvimento de Sistemas'),
    ('informatica',   'Técnico em Informática para Internet'),
    ('administracao', 'Técnico em Administração'),
    ('agropecuaria',  'Técnico em Agropecuária'),
    ('outro',         'Outro');

INSERT OR IGNORE INTO atividades (codigo, nome) VALUES
    ('palestras',      'Palestras'),
    ('minicursos',     'Minicursos'),
    ('oficinas',       'Oficinas práticas'),
    ('projetos',       'Apresentação de projetos'),
    ('mesas-redondas', 'Mesas-redondas');
