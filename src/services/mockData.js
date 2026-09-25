export const MOCK_DATA = {
  turmas: [
    { id: 't1', nome: '1C - Informática', codigo_acesso: 'INF1C', cor_hex: '#4f46e5' },
    { id: 't2', nome: '2C - Desenvolvimento', codigo_acesso: 'DEV2C', cor_hex: '#0891b2' },
    { id: 't3', nome: '3C - Multimídia', codigo_acesso: 'MUL3C', cor_hex: '#16a34a' }
  ],
  usuarios: [
    { id: 'u1', nome: 'Prof. Carlos', email: 'carlos@escola.com', senha: '123456', papel: 'professor', funcao_principal: 'Professor', avatar_url: 'https://i.pravatar.cc/150?u=u1' },
    { id: 'u2', nome: 'João Silva', email: 'joao@aluno.com', senha: 'Mudar123', papel: 'aluno', turma_id: 't1', primeiro_acesso: true, avatar_url: 'https://i.pravatar.cc/150?u=u2' },
    { id: 'u3', nome: 'Maria Santos', email: 'maria@aluno.com', senha: 'Mudar123', papel: 'aluno', turma_id: 't1', primeiro_acesso: false, avatar_url: 'https://i.pravatar.cc/150?u=u3' },
    { id: 'u4', nome: 'Pedro Lima', email: 'pedro@aluno.com', senha: 'Mudar123', papel: 'aluno', turma_id: 't2', primeiro_acesso: true, avatar_url: 'https://i.pravatar.cc/150?u=u4' },
    { id: 'u5', nome: 'Lucas Souza', email: 'lucas@aluno.com', senha: 'Mudar123', papel: 'aluno', turma_id: 't2', primeiro_acesso: false, avatar_url: 'https://i.pravatar.cc/150?u=u5' },
    { id: 'u6', nome: 'Ana Costa', email: 'ana@aluno.com', senha: 'Mudar123', papel: 'aluno', turma_id: 't3', primeiro_acesso: false, avatar_url: 'https://i.pravatar.cc/150?u=u6' },
    { id: 'u7', nome: 'Bruno Rocha', email: 'bruno@aluno.com', senha: 'Mudar123', papel: 'aluno', turma_id: 't3', primeiro_acesso: true, avatar_url: 'https://i.pravatar.cc/150?u=u7' }
  ],
  credenciaisExemplo: [
    { papel: 'Gestor/Professor', email: 'carlos@escola.com', senha: '123456' },
    { papel: 'Aluno', email: 'joao@aluno.com', senha: 'Mudar123' }
  ],
  equipes: [
    {
      id: 'eq1',
      nome: 'Alpha Tech',
      logo_url: 'https://api.dicebear.com/7.x/identicon/svg?seed=Alpha',
      github_url: 'https://github.com/alphatech/projeto-biblioteca',
      cor_hex: '#4f46e5',
      membros: [
        { aluno_id: 'u2', papel_no_grupo: 'Líder / Backend' },
        { aluno_id: 'u4', papel_no_grupo: 'Frontend' },
        { aluno_id: 'u6', papel_no_grupo: 'QA' }
      ]
    },
    {
      id: 'eq2',
      nome: 'Code Wave',
      logo_url: 'https://api.dicebear.com/7.x/identicon/svg?seed=Wave',
      github_url: 'https://github.com/codewave/portal-biblioteca',
      cor_hex: '#0891b2',
      membros: [
        { aluno_id: 'u3', papel_no_grupo: 'Full Stack' },
        { aluno_id: 'u5', papel_no_grupo: 'UI/UX Designer' },
        { aluno_id: 'u7', papel_no_grupo: 'Backend' }
      ]
    }
  ],
  projetos: [
    {
      id: 'p1',
      nome: 'Sistema de Gestão de Biblioteca',
      descricao: 'Desenvolvimento do portal web para empréstimos de livros.',
      data_inicio: '2026-09-01T12:00:00Z',
      data_entrega: '2026-11-30T23:59:00Z',
      recursos: 'Figma: bit.ly/biblioteca-figma | Docs: bit.ly/biblioteca-docs',
      equipes_ids: ['eq1', 'eq2']
    },
    {
      id: 'p2',
      nome: 'App de Feedback Escolar',
      descricao: 'Plataforma para avaliação contínua de disciplinas e professores.',
      data_inicio: '2026-09-15T12:00:00Z',
      data_entrega: '2026-12-15T23:59:00Z',
      recursos: 'Repositório: github.com/school/feedback-app',
      equipes_ids: ['eq1']
    }
  ],
  tarefas: [
    {
      id: 'k1',
      projeto_id: 'p1',
      equipe_id: 'eq1',
      aluno_id: 'u2',
      titulo: 'Modelagem do Banco de Dados',
      descricao: 'Criar o diagrama de dados e o script de criação das tabelas',
      prioridade: 'alta',
      estimativa: '8',
      status: 'concluido',
      posicao: 1000,
      prazo_limite: '2026-10-15T23:59:00Z',
      checklists: [
        { id: 'c1', item: 'Criar tabelas', concluido: true },
        { id: 'c2', item: 'Diagrama ER', concluido: true }
      ]
    },
    {
      id: 'k2',
      projeto_id: 'p1',
      equipe_id: 'eq1',
      aluno_id: 'u4',
      titulo: 'Tela de Login em React',
      descricao: 'Desenvolver formulário Bootstrap com integração de contexto',
      prioridade: 'urgente',
      estimativa: '5',
      status: 'fazendo',
      posicao: 2000,
      prazo_limite: '2026-10-20T23:59:00Z',
      checklists: [
        { id: 'c3', item: 'Layout Bootstrap', concluido: true },
        { id: 'c4', item: 'Integrar contexto', concluido: false }
      ]
    },
    {
      id: 'k3',
      projeto_id: 'p1',
      equipe_id: 'eq2',
      aluno_id: 'u3',
      titulo: 'API de Cadastro de Livros',
      descricao: 'Integrar rotas de CRUD',
      prioridade: 'media',
      estimativa: '5',
      status: 'a_fazer',
      posicao: 1000,
      prazo_limite: '2026-09-10T23:59:00Z',
      is_impedida: true,
      checklists: []
    },
    {
      id: 'k4',
      projeto_id: 'p1',
      equipe_id: 'eq1',
      aluno_id: 'u6',
      titulo: 'Testes de Integração',
      descricao: 'Cobertura das rotas de empréstimo e devolução',
      prioridade: 'baixa',
      estimativa: '3',
      status: 'concluido',
      aguardando_validacao: true,
      posicao: 1000,
      prazo_limite: '2026-10-05T23:59:00Z',
      checklists: [
        { id: 'c5', item: 'Cenários de empréstimo', concluido: true },
        { id: 'c6', item: 'Relatório de cobertura', concluido: false }
      ]
    },
    {
      id: 'k5',
      projeto_id: 'p2',
      equipe_id: 'eq1',
      aluno_id: 'u2',
      titulo: 'Prototipação das telas do app',
      descricao: 'Wireframes de alta fidelidade para o app de feedback',
      prioridade: 'alta',
      estimativa: '3',
      status: 'fazendo',
      posicao: 2000,
      prazo_limite: '2026-10-25T23:59:00Z',
      checklists: [
        { id: 'c7', item: 'Fluxo de login', concluido: true },
        { id: 'c8', item: 'Formulário de avaliação', concluido: false }
      ]
    },
    {
      id: 'k6',
      projeto_id: 'p1',
      equipe_id: 'eq2',
      aluno_id: 'u5',
      titulo: 'Design System e Tokens',
      descricao: 'Paleta de cores e componentes visuais reutilizáveis',
      prioridade: 'media',
      estimativa: '2',
      status: 'concluido',
      posicao: 1000,
      prazo_limite: '2026-09-28T23:59:00Z',
      checklists: [
        { id: 'c9', item: 'Tokens de cor', concluido: true },
        { id: 'c10', item: 'Componentes base', concluido: true }
      ]
    },
    {
      id: 'k7',
      projeto_id: 'p1',
      equipe_id: 'eq2',
      aluno_id: 'u7',
      titulo: 'Integrar Autenticação JWT',
      descricao: 'Middleware de sessão para o portal',
      prioridade: 'alta',
      estimativa: '8',
      status: 'a_fazer',
      posicao: 1500,
      prazo_limite: '2026-10-30T23:59:00Z',
      checklists: []
    },
    {
      id: 'k8',
      projeto_id: 'p2',
      equipe_id: 'eq1',
      aluno_id: 'u4',
      titulo: 'Consumo da API de avaliações',
      descricao: 'Ligar o frontend às rotas de respostas',
      prioridade: 'media',
      estimativa: '5',
      status: 'a_fazer',
      posicao: 1000,
      prazo_limite: '2026-11-05T23:59:00Z',
      is_impedida: true,
      checklists: []
    },
    {
      id: 'k9',
      projeto_id: 'p1',
      equipe_id: 'eq1',
      aluno_id: 'u2',
      titulo: 'Criar formulário de check-in no Daily Register',
      descricao: 'Tela de registro diário com validação de 280 caracteres',
      prioridade: 'media',
      estimativa: '3',
      status: 'backlog',
      posicao: 1000,
      prazo_limite: '2026-11-10T23:59:00Z',
      checklists: [
        { id: 'c11', item: 'Validar limite de 280 caracteres', concluido: false },
        { id: 'c12', item: 'Salvar data atual automaticamente', concluido: false }
      ]
    },
    {
      id: 'k10',
      projeto_id: 'p1',
      equipe_id: 'eq2',
      aluno_id: 'u5',
      titulo: 'Definir política de prioridades do backlog',
      descricao: 'Critérios de priorização para as sprints',
      prioridade: 'baixa',
      estimativa: '1',
      status: 'backlog',
      posicao: 1000,
      prazo_limite: '2026-11-20T23:59:00Z',
      checklists: []
    }
  ],
  historico_atividades: [
    { id: 'h1', usuario_id: 'u2', tarefa_id: 'k1', tipo_acao: 'daily_checkin', descricao: 'Check-in diário', data_hora: '2026-09-14T09:00:00Z' },
    { id: 'h2', usuario_id: 'u2', tarefa_id: 'k1', tipo_acao: 'concluiu_checklist', descricao: 'Concluiu "Criar tabelas"', data_hora: '2026-09-13T10:30:00Z' },
    { id: 'h3', usuario_id: 'u2', tarefa_id: 'k1', tipo_acao: 'movimentou_card', descricao: 'Concluiu a tarefa Modelagem do Banco', data_hora: '2026-09-12T14:30:00Z' },
    { id: 'h4', usuario_id: 'u4', tarefa_id: 'k2', tipo_acao: 'comentou', descricao: 'Iniciou a codificação da tela de Login', data_hora: '2026-09-13T09:15:00Z' },
    { id: 'h5', usuario_id: 'u4', tarefa_id: 'k2', tipo_acao: 'daily_checkin', descricao: 'Check-in diário', data_hora: '2026-09-14T08:45:00Z' },
    { id: 'h6', usuario_id: 'u5', tarefa_id: 'k6', tipo_acao: 'concluiu_checklist', descricao: 'Concluiu "Tokens de cor"', data_hora: '2026-09-11T16:00:00Z' },
    { id: 'h7', usuario_id: 'u5', tarefa_id: 'k6', tipo_acao: 'daily_checkin', descricao: 'Check-in diário', data_hora: '2026-09-13T10:00:00Z' },
    { id: 'h8', usuario_id: 'u6', tarefa_id: 'k4', tipo_acao: 'comentou', descricao: 'Relatório de cobertura em andamento', data_hora: '2026-09-12T11:20:00Z' },
    { id: 'h9', usuario_id: 'u3', tarefa_id: 'k3', tipo_acao: 'bloqueou', descricao: 'Tarefa impedida aguardando suporte', data_hora: '2026-09-08T15:00:00Z' },
    { id: 'h10', usuario_id: 'u2', tarefa_id: 'k5', tipo_acao: 'daily_checkin', descricao: 'Check-in diário', data_hora: '2026-09-15T09:10:00Z' }
  ],
  daily_registers: [
    { id: 'd1', equipe_id: 'eq1', aluno_id: 'u2', data_checkin: '2026-09-13', o_que_fez: 'Finalizei a modelagem do banco de dados.', licao_aprendida: 'Aprendi a revisar as regras de permissão do projeto.', impedimento: '' },
    { id: 'd2', equipe_id: 'eq1', aluno_id: 'u2', data_checkin: '2026-09-14', o_que_fez: 'Iniciei o protótipo das telas do app.', licao_aprendida: 'Prototipagem acelera a validação.', impedimento: '' },
    { id: 'd3', equipe_id: 'eq1', aluno_id: 'u2', data_checkin: '2026-09-15', o_que_fez: 'Configurei as rotas do React.', licao_aprendida: 'Mocks ajudam no desenvolvimento independente do back.', impedimento: 'Aguardando design system.' },
    { id: 'd4', equipe_id: 'eq1', aluno_id: 'u4', data_checkin: '2026-09-15', o_que_fez: 'Desenvolvi a tela de login.', licao_aprendida: 'Importante manter checklists pequenas.', impedimento: '' },
    { id: 'd5', equipe_id: 'eq2', aluno_id: 'u5', data_checkin: '2026-09-14', o_que_fez: 'Criei o design system da equipe.', licao_aprendida: 'Tokens de cor facilitam o tema.', impedimento: '' }
  ]
}