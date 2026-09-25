import { MOCK_DATA } from './mockData.js'

const DB = {
  turmas: [...MOCK_DATA.turmas],
  usuarios: [...MOCK_DATA.usuarios],
  equipes: JSON.parse(JSON.stringify(MOCK_DATA.equipes)),
  projetos: JSON.parse(JSON.stringify(MOCK_DATA.projetos)),
  tarefas: JSON.parse(JSON.stringify(MOCK_DATA.tarefas)),
  historico_atividades: [...MOCK_DATA.historico_atividades],
  daily_registers: [...MOCK_DATA.daily_registers]
}

let useSupabase = false
let supabaseClient = null

export function setSupabase(client) {
  supabaseClient = client
  useSupabase = !!client
}

export function isUsingSupabase() {
  return useSupabase
}

const genId = () => 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

// UUID válido (checklists criados no mock têm id 'c_...' que não cabe em uuid)
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

function ensureSupabaseData(rows, table, defaults = {}) {
  return rows.map(row => ({ ...defaults, ...row }))
}

// ============================ AUTENTICAÇÃO ============================
export async function autenticar(email, senha) {
  if (useSupabase) {
    const { data, error } = await supabaseClient
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .eq('senha', senha)
      .single()
    if (error || !data) throw new Error('Credenciais inválidas')
    return data
  }
  const usuario = DB.usuarios.find(u => u.email === email && u.senha === senha)
  if (!usuario) throw new Error('E-mail ou senha inválidos')
  return { ...usuario }
}

// ============================ AUTH REAL (Supabase Auth) ============================
// FASE 3 - Modo Conectado: autentica via Supabase Auth e carrega o perfil
// da tabela 'usuarios' (RLS 'authenticated').
export async function autenticarSupabase(email, senha) {
  if (!supabaseClient) throw new Error('Serviço indisponível no momento. Tente novamente mais tarde.')
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: senha })
  if (error || !data?.user) {
    const code = error?.code || ''
    if (code === 'invalid_credentials') {
      throw new Error('E-mail ou senha incorretos.')
    }
    if (code === 'email_not_confirmed') {
      throw new Error('E-mail ainda não confirmado. Confirme o e-mail antes de entrar.')
    }
    throw new Error('Erro ao fazer login. Tente novamente.')
  }
  const { data: perfil, error: errPerfil } = await supabaseClient
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .maybeSingle()
  if (errPerfil) throw new Error('Erro ao carregar o perfil. Tente novamente.')
  if (perfil) return perfil
  return { id: data.user.id, email, nome: data.user.user_metadata?.nome || email, papel: 'aluno' }
}

export async function sairSupabase() {
  if (supabaseClient) await supabaseClient.auth.signOut()
}

// Cadastro público na tela de login (sem sessão): cria conta no Supabase Auth.
// O trigger handle_new_user (0001) grava o perfil em public.usuarios.
export async function cadastrarUsuarioPublico(dados) {
  if (!supabaseClient) throw new Error('Serviço indisponível no momento. Tente novamente mais tarde.')
  const { data, error } = await supabaseClient.auth.signUp({
    email: dados.email,
    password: dados.senha,
    options: {
      data: {
        nome: dados.nome,
        papel: dados.papel || 'aluno',
        funcao_principal: dados.funcao_principal || null,
        primeiro_acesso: dados.primeiro_acesso ?? true
      }
    }
  })
  if (error) {
    if (/already registered|already been registered/i.test(error.message || '')) {
      throw new Error('Este e-mail já está cadastrado. Faça login ou use outro e-mail.')
    }
    throw new Error('Erro ao cadastrar usuário. Tente novamente.')
  }
  if (data?.user && !data.session) {
    return {
      mensagem: 'Cadastro realizado! Confirme seu e-mail e faça login.',
      user: data.user
    }
  }
  return { mensagem: 'Usuário cadastrado com sucesso! Faça login com seu e-mail e senha.', user: data?.user }
}

// ============================ TURMAS ============================
export async function listarTurmas() {
  if (useSupabase) {
    const { data, error } = await supabaseClient.from('turmas').select('*')
    if (error) throw error
    return data
  }
  return [...DB.turmas]
}

export async function criarTurma(dados) {
  if (useSupabase) {
    const { data, error } = await supabaseClient.from('turmas').insert(dados).select().single()
    if (error) throw error
    return data
  }
  const nova = { id: genId(), ...dados }
  DB.turmas.push(nova)
  return nova
}

export async function atualizarTurma(id, dados) {
  if (useSupabase) {
    const { data, error } = await supabaseClient.from('turmas').update(dados).eq('id', id).select().single()
    if (error) throw error
    return data
  }
  const idx = DB.turmas.findIndex(t => t.id === id)
  if (idx !== -1) DB.turmas[idx] = { ...DB.turmas[idx], ...dados }
  return DB.turmas[idx]
}

export async function removerTurma(id, { excluirAlunos = false, onProgresso } = {}) {
  // onProgresso({ etapa, atual, total }) — chamado a cada aluno removido para
  // a tela exibir barra de progresso real (exclusão de turma é N requisições).
  const notificar = (p) => { if (typeof onProgresso === 'function') onProgresso(p) }

  if (useSupabase) {
    let total = 0
    if (excluirAlunos) {
      const { data: alunos, error: errList } = await supabaseClient
        .from('usuarios')
        .select('id')
        .eq('turma_id', id)
        .eq('papel', 'aluno')
      if (errList) throw errList
      total = (alunos || []).length
      notificar({ etapa: 'alunos', atual: 0, total })
      let concluidos = 0
      for (const aluno of alunos || []) {
        await removerUsuarioCompleto(aluno.id)
        concluidos++
        notificar({ etapa: 'alunos', atual: concluidos, total })
      }
    }
    notificar({ etapa: 'turma', atual: total, total })
    const { error } = await supabaseClient.from('turmas').delete().eq('id', id)
    if (error) throw error
    notificar({ etapa: 'concluido', atual: total, total })
    return
  }

  let total = 0
  if (excluirAlunos) {
    const ids = DB.usuarios
      .filter(u => u.turma_id === id && u.papel === 'aluno')
      .map(u => u.id)
    total = ids.length
    notificar({ etapa: 'alunos', atual: 0, total })
    let concluidos = 0
    for (const uid of ids) {
      await removerUsuarioCompleto(uid)
      concluidos++
      notificar({ etapa: 'alunos', atual: concluidos, total })
    }
  }
  notificar({ etapa: 'turma', atual: total, total })
  DB.turmas = DB.turmas.filter(t => t.id !== id)
  notificar({ etapa: 'concluido', atual: total, total })
}

// ============================ USUÁRIOS ============================
export async function listarUsuarios() {
  if (useSupabase) {
    const { data, error } = await supabaseClient.from('usuarios').select('*')
    if (error) throw error
    return data
  }
  return [...DB.usuarios]
}

// Contas de login (auth.users) — SÓ o gestor recebe a lista (RPC 0007).
// Inclui e-mails nunca confirmados e contas sem perfil em public.usuarios.
// Lança erro se a migração 0007 não estiver aplicada (a tela trata o fallback).
export async function listarUsuariosAuth() {
  if (!useSupabase) {
    return DB.usuarios.map(u => ({
      id: u.id,
      email: u.email,
      email_confirmado: true,
      criado_em: u.created_at || null,
      tem_perfil: true,
      nome: u.nome,
      papel: u.papel,
      turma_id: u.turma_id || null
    }))
  }
  const { data, error } = await supabaseClient.rpc('listar_usuarios_auth')
  if (error) {
    console.warn('[listarUsuariosAuth] falha ao carregar contas de login:', error.message || error.code)
    throw new Error('Não foi possível carregar as contas de login.')
  }
  return Array.isArray(data) ? data : []
}

export async function criarUsuario(dados) {
  if (useSupabase) {
    // MODO CONECTADO - cadastro/importação:
    // public.usuarios NÃO aceita matricula/senha_padrao no insert direto e
    // id referencia auth.users. A importação de alunos usa o RPC
    // importar_aluno (migração 0003) que cria Auth + perfil + matricula.
    const ehImportacaoAluno = dados.papel === 'aluno' && (dados.matricula !== undefined || dados.senha_padrao !== undefined || dados.turma_id)
    if (ehImportacaoAluno) {
      const { data: novoId, error: errRpc } = await supabaseClient.rpc('importar_aluno', {
        p_nome: dados.nome,
        p_email: dados.email,
        p_turma_id: dados.turma_id || null,
        p_matricula: dados.matricula || null,
        p_senha: dados.senha || dados.senha_padrao || 'Mudar123'
      })
      if (errRpc) {
        const msg = errRpc.message || ''
        const faltando = /importar_aluno/i.test(msg) || errRpc.code === 'PGRST202'
        if (faltando) {
          console.warn('[criarUsuario] importação indisponível:', msg || errRpc.code)
          throw new Error('Erro ao importar aluno. Tente novamente.')
        }
        // Mostra apenas mensagens de validação da importação; o resto vira aviso genérico.
        const validacao = /nome do aluno|e-mail/i.test(msg)
        console.warn('[criarUsuario] falha na importação:', msg || errRpc.code)
        throw new Error(validacao ? msg : 'Erro ao importar aluno. Tente novamente.')
      }
      const { data: perfil, error: errPerfil } = await supabaseClient
        .from('usuarios')
        .select('*')
        .eq('id', novoId)
        .maybeSingle()
      if (errPerfil) throw errPerfil
      return perfil || { id: novoId, ...dados }
    }
    // Fallback: apenas colunas que existem em public.usuarios
    const payload = {
      nome: dados.nome,
      email: dados.email,
      senha: dados.senha || null,
      papel: dados.papel || 'aluno',
      funcao_principal: dados.funcao_principal || null,
      avatar_url: dados.avatar_url || null,
      turma_id: dados.turma_id || null,
      primeiro_acesso: dados.primeiro_acesso ?? true
    }
    const { data, error } = await supabaseClient.from('usuarios').insert(payload).select().single()
    if (error) throw error
    return data
  }
  const novo = { id: genId(), papel: 'aluno', primeiro_acesso: true, ...dados }
  DB.usuarios.push(novo)
  return novo
}

export async function atualizarUsuario(id, dados) {
  if (useSupabase) {
    const { data, error } = await supabaseClient.from('usuarios').update(dados).eq('id', id).select().single()
    if (error) throw error
    return data
  }
  const idx = DB.usuarios.findIndex(u => u.id === id)
  if (idx !== -1) DB.usuarios[idx] = { ...DB.usuarios[idx], ...dados }
  return DB.usuarios[idx]
}

// Exclusão COMPLETA de usuário/aluno: remove ligações (daily_registers,
// histórico, membros de equipe, tarefas alocadas) e o próprio registro.
export async function removerUsuarioCompleto(id) {
  if (useSupabase) {
    // Preferência: RPC security definer (0004) — remove Auth + cascata.
    const { error: errRpc } = await supabaseClient.rpc('excluir_usuario_completo', {
      p_usuario_id: id
    })
    if (!errRpc) return
    const rpcFaltando = /excluir_usuario_completo/i.test(errRpc.message || '') || errRpc.code === 'PGRST202'
    if (!rpcFaltando) {
      // Mostra apenas mensagens de regra de negócio; o resto vira aviso genérico.
      const msg = errRpc.message || ''
      const regra = /excluir alunos|acesso negado|proprio usuario|informe o usuario/i.test(msg)
      console.warn('[removerUsuarioCompleto] falha na exclusão:', msg || errRpc.code)
      throw new Error(regra ? msg : 'Erro ao excluir usuário. Tente novamente.')
    }
    // Fallback sem RPC: limpa ligações conhecidas e o perfil.
    const limpar = async (tabela, filtro) => {
      const { error } = await supabaseClient.from(tabela).delete().eq(filtro, id)
      if (error) console.warn(`[removerUsuarioCompleto] ${tabela}:`, error.message)
    }
    await limpar('daily_registers', 'aluno_id')
    await limpar('equipe_membros', 'aluno_id')
    await limpar('historico_atividades', 'usuario_id')
    await limpar('tarefas', 'aluno_id')
    const { error } = await supabaseClient.from('usuarios').delete().eq('id', id)
    if (error) throw error

    // Sem o RPC principal, a conta de login (auth.users + auth.identities)
    // ficaria órfã — limpa via RPC da migração 0009 (best effort).
    const { error: errLimpeza } = await supabaseClient.rpc('limpar_auth_orfao', { p_usuario_id: id })
    if (errLimpeza) console.warn('[removerUsuarioCompleto] limpeza de auth ignorada:', errLimpeza.message || errLimpeza.code)
    return
  }
  DB.daily_registers = DB.daily_registers.filter(d => d.aluno_id !== id)
  DB.historico_atividades = DB.historico_atividades.filter(h => h.usuario_id !== id)
  DB.equipes = DB.equipes.map(e => ({
    ...e,
    membros: (e.membros || []).filter(m => m.aluno_id !== id)
  }))
  DB.tarefas = DB.tarefas.filter(t => t.aluno_id !== id)
  DB.usuarios = DB.usuarios.filter(u => u.id !== id)
}

export async function removerUsuario(id) {
  return removerUsuarioCompleto(id)
}

// ============================ EQUIPES ============================
// No Supabase, o array equipes.membros foi normalizado na tabela
// equipe_membros; aqui ele é remontado no formato das telas (mock).
export async function listarEquipes() {
  if (useSupabase) {
    const [{ data: equipes, error: e1 }, { data: membros, error: e2 }] = await Promise.all([
      supabaseClient.from('equipes').select('*').order('created_at'),
      supabaseClient.from('equipe_membros').select('*')
    ])
    if (e1) throw e1
    if (e2) throw e2
    return (equipes || []).map(eq => ({
      ...eq,
      membros: (membros || [])
        .filter(m => m.equipe_id === eq.id)
        .map(m => ({ aluno_id: m.aluno_id, papel_no_grupo: m.papel_no_grupo }))
    }))
  }
  return JSON.parse(JSON.stringify(DB.equipes))
}

export async function criarEquipe(dados) {
  if (useSupabase) {
    const { membros = [], ...resto } = dados
    const { data, error } = await supabaseClient.from('equipes').insert(resto).select().single()
    if (error) throw error
    await sincronizarMembrosEquipe(data.id, membros)
    return { ...data, membros }
  }
  const nova = { id: genId(), cor_hex: '#6366f1', membros: [], ...dados }
  DB.equipes.push(nova)
  return nova
}

export async function atualizarEquipe(id, dados) {
  if (useSupabase) {
    const { membros, ...resto } = dados
    const { data, error } = await supabaseClient.from('equipes').update(resto).eq('id', id).select().single()
    if (error) throw error
    if (membros) await sincronizarMembrosEquipe(id, membros)
    return { ...data, membros: membros || undefined }
  }
  const idx = DB.equipes.findIndex(e => e.id === id)
  if (idx !== -1) DB.equipes[idx] = { ...DB.equipes[idx], ...dados }
  return DB.equipes[idx]
}

// Substitui os membros da equipe (equipe_membros) pelos informados.
async function sincronizarMembrosEquipe(equipeId, membros) {
  const { error: errDel } = await supabaseClient.from('equipe_membros').delete().eq('equipe_id', equipeId)
  if (errDel) throw errDel
  if (membros.length) {
    const linhas = membros.map(m => ({
      equipe_id: equipeId,
      aluno_id: m.aluno_id,
      papel_no_grupo: m.papel_no_grupo || null
    }))
    const { error: errIns } = await supabaseClient.from('equipe_membros').insert(linhas)
    if (errIns) throw errIns
  }
}

// onProgresso({ etapa, atual, total }) — etapas "preparando" -> "vinculos" ->
// "concluido". No modo Supabase a cascata (membros, check-ins, vínculos) roda
// no banco numa única requisição; no modo mock as etapas são notificadas uma
// a uma para a barra de progresso da tela.
export async function removerEquipe(id, { onProgresso } = {}) {
  const notificar = (p) => { if (typeof onProgresso === 'function') onProgresso(p) }
  notificar({ etapa: 'preparando', atual: 0, total: 0 })
  if (useSupabase) {
    notificar({ etapa: 'vinculos', atual: 0, total: 0 })
    const { error } = await supabaseClient.from('equipes').delete().eq('id', id)
    if (error) throw error
    notificar({ etapa: 'concluido', atual: 0, total: 0 })
    return
  }
  // Espelha o schema real (0001): cascade em equipe_membros/projeto_equipes/
  // daily_registers e ON DELETE SET NULL em tarefas.equipe_id.
  DB.equipes = DB.equipes.filter(e => e.id !== id)
  notificar({ etapa: 'vinculos', atual: 1, total: 3 })
  DB.tarefas = DB.tarefas.map(t => (t.equipe_id === id ? { ...t, equipe_id: null } : t))
  notificar({ etapa: 'vinculos', atual: 2, total: 3 })
  DB.daily_registers = DB.daily_registers.filter(d => d.equipe_id !== id)
  notificar({ etapa: 'vinculos', atual: 3, total: 3 })
  notificar({ etapa: 'concluido', atual: 3, total: 3 })
}

// ============================ PROJETOS ============================
// projetos.equipes_ids é normalizado na tabela projeto_equipes; aqui é
// remontado como array no formato das telas.
export async function listarProjetos() {
  if (useSupabase) {
    const [{ data: projetos, error: e1 }, { data: vinculos, error: e2 }] = await Promise.all([
      supabaseClient.from('projetos').select('*').order('created_at'),
      supabaseClient.from('projeto_equipes').select('*')
    ])
    if (e1) throw e1
    if (e2) throw e2
    return (projetos || []).map(p => ({
      ...p,
      equipes_ids: (vinculos || []).filter(v => v.projeto_id === p.id).map(v => v.equipe_id)
    }))
  }
  return JSON.parse(JSON.stringify(DB.projetos))
}

export async function criarProjeto(dados) {
  if (useSupabase) {
    const { equipes_ids = [], ...resto } = dados
    const { data, error } = await supabaseClient.from('projetos').insert(resto).select().single()
    if (error) throw error
    await sincronizarEquipesProjeto(data.id, equipes_ids)
    return { ...data, equipes_ids }
  }
  const novo = { id: genId(), data_inicio: new Date().toISOString().slice(0, 10), status: 'em_andamento', equipes_ids: [], ...dados }
  DB.projetos.push(novo)
  return novo
}

export async function atualizarProjeto(id, dados) {
  if (useSupabase) {
    const { equipes_ids, ...resto } = dados
    const { data, error } = await supabaseClient.from('projetos').update(resto).eq('id', id).select().single()
    if (error) throw error
    if (equipes_ids) await sincronizarEquipesProjeto(id, equipes_ids)
    return { ...data, equipes_ids: equipes_ids || undefined }
  }
  const idx = DB.projetos.findIndex(p => p.id === id)
  if (idx !== -1) DB.projetos[idx] = { ...DB.projetos[idx], ...dados }
  return DB.projetos[idx]
}

// Substitui os vínculos projeto<->equipes (projeto_equipes).
async function sincronizarEquipesProjeto(projetoId, equipesIds) {
  const { error: errDel } = await supabaseClient.from('projeto_equipes').delete().eq('projeto_id', projetoId)
  if (errDel) throw errDel
  if (equipesIds.length) {
    const linhas = equipesIds.map(equipeId => ({ projeto_id: projetoId, equipe_id: equipeId }))
    const { error: errIns } = await supabaseClient.from('projeto_equipes').insert(linhas)
    if (errIns) throw errIns
  }
}

// onProgresso({ etapa, atual, total }) — etapas "preparando" -> "tarefas" ->
// "concluido" (tarefas + checklists + vínculos saem em cascata no banco).
export async function removerProjeto(id, { onProgresso } = {}) {
  const notificar = (p) => { if (typeof onProgresso === 'function') onProgresso(p) }
  notificar({ etapa: 'preparando', atual: 0, total: 0 })
  if (useSupabase) {
    notificar({ etapa: 'tarefas', atual: 0, total: 0 })
    const { error } = await supabaseClient.from('projetos').delete().eq('id', id)
    if (error) throw error
    notificar({ etapa: 'concluido', atual: 0, total: 0 })
    return
  }
  DB.projetos = DB.projetos.filter(p => p.id !== id)
  notificar({ etapa: 'tarefas', atual: 1, total: 2 })
  DB.tarefas = DB.tarefas.filter(t => t.projeto_id !== id)
  notificar({ etapa: 'tarefas', atual: 2, total: 2 })
  notificar({ etapa: 'concluido', atual: 2, total: 2 })
}

// ============================ TAREFAS ============================
// tarefas.checklists é normalizado na tabela checklists; aqui é remontado
// como array no formato das telas.
export async function listarTarefas() {
  if (useSupabase) {
    const [{ data: tarefas, error: e1 }, { data: itens, error: e2 }] = await Promise.all([
      supabaseClient.from('tarefas').select('*').order('posicao'),
      supabaseClient.from('checklists').select('*').order('created_at')
    ])
    if (e1) throw e1
    if (e2) throw e2
    return (tarefas || []).map(t => ({
      ...t,
      checklists: (itens || [])
        .filter(c => c.tarefa_id === t.id)
        .map(c => ({ id: c.id, item: c.item, concluido: c.concluido }))
    }))
  }
  return JSON.parse(JSON.stringify(DB.tarefas))
}

export async function criarTarefa(dados) {
  if (useSupabase) {
    const { checklists = [], ...resto } = dados
    const { data, error } = await supabaseClient.from('tarefas').insert(resto).select().single()
    if (error) throw error
    await sincronizarChecklists(data.id, checklists)
    return { ...data, checklists }
  }
  const nova = { id: genId(), status: 'backlog', posicao: 1000, checklists: [], prioridade: 'media', ...dados }
  DB.tarefas.push(nova)
  return nova
}

export async function atualizarTarefa(id, dados) {
  if (useSupabase) {
    const { checklists, ...resto } = dados
    const { data, error } = await supabaseClient.from('tarefas').update(resto).eq('id', id).select().single()
    if (error) throw error
    if (checklists) await sincronizarChecklists(id, checklists)
    return { ...data, checklists: checklists || undefined }
  }
  const idx = DB.tarefas.findIndex(t => t.id === id)
  if (idx !== -1) DB.tarefas[idx] = { ...DB.tarefas[idx], ...dados }
  return DB.tarefas[idx]
}

// Substitui os itens de checklist da tarefa pelos informados.
// Preserva o id quando já é um UUID (itens existentes); novos itens do mock
// ('c_...') recebem id gerado pelo banco.
async function sincronizarChecklists(tarefaId, checklists) {
  const { error: errDel } = await supabaseClient.from('checklists').delete().eq('tarefa_id', tarefaId)
  if (errDel) throw errDel
  if (checklists.length) {
    const linhas = checklists.map(c => ({
      ...(isUuid(c.id) ? { id: c.id } : {}),
      tarefa_id: tarefaId,
      item: c.item,
      concluido: !!c.concluido
    }))
    const { error: errIns } = await supabaseClient.from('checklists').insert(linhas)
    if (errIns) throw errIns
  }
}

export async function removerTarefa(id) {
  if (useSupabase) {
    const { error } = await supabaseClient.from('tarefas').delete().eq('id', id)
    if (error) throw error
    return
  }
  DB.tarefas = DB.tarefas.filter(t => t.id !== id)
}

// ============================ HISTÓRICO ============================
// Registro auxiliar: falhas (ex.: RLS) não podem interromper o fluxo principal.
export async function registrarAtividade(dados) {
  try {
    if (useSupabase) {
      const { data, error } = await supabaseClient.from('historico_atividades').insert(dados).select().single()
      if (error) {
        console.warn('[registrarAtividade] não registrado:', error.message)
        return null
      }
      return data
    }
    const atividade = { id: genId(), data_hora: new Date().toISOString(), ...dados }
    DB.historico_atividades.unshift(atividade)
    return atividade
  } catch (e) {
    console.warn('[registrarAtividade] não registrado:', e?.message || e)
    return null
  }
}

export async function listarHistorico() {
  if (useSupabase) {
    const { data, error } = await supabaseClient
      .from('historico_atividades')
      .select('*')
      .order('data_hora', { ascending: false })
    if (error) throw error
    return data
  }
  return [...DB.historico_atividades]
}

// ============================ DAILY REGISTER ============================
export async function listarDailyRegisters() {
  if (useSupabase) {
    const { data, error } = await supabaseClient.from('daily_registers').select('*')
    if (error) throw error
    return data
  }
  return JSON.parse(JSON.stringify(DB.daily_registers))
}

export async function criarDailyRegister(dados) {
  if (useSupabase) {
    // UNIQUE (aluno_id, data_checkin): 1 check-in por aluno/dia -> upsert
    const payload = { ...dados, data_checkin: dados.data_checkin || new Date().toISOString().slice(0, 10) }
    const { data, error } = await supabaseClient
      .from('daily_registers')
      .upsert(payload, { onConflict: 'aluno_id,data_checkin' })
      .select()
      .single()
    if (error) throw error
    return data
  }
  const hoje = dados.data_checkin || new Date().toISOString().slice(0, 10)
  const existente = DB.daily_registers.find(d => d.aluno_id === dados.aluno_id && d.data_checkin === hoje)
  if (existente) {
    Object.assign(existente, dados, { id: existente.id })
    return { ...existente }
  }
  const nova = { id: genId(), data_checkin: hoje, licao_aprendida: '', impedimento: '', ...dados }
  DB.daily_registers.push(nova)
  return nova
}

export async function atualizarDailyRegister(id, dados) {
  if (useSupabase) {
    const { data, error } = await supabaseClient.from('daily_registers').update(dados).eq('id', id).select().single()
    if (error) throw error
    return data
  }
  const idx = DB.daily_registers.findIndex(d => d.id === id)
  if (idx !== -1) DB.daily_registers[idx] = { ...DB.daily_registers[idx], ...dados }
  return DB.daily_registers[idx]
}

export async function removerDailyRegister(id) {
  if (useSupabase) {
    const { error } = await supabaseClient.from('daily_registers').delete().eq('id', id)
    if (error) throw error
    return
  }
  DB.daily_registers = DB.daily_registers.filter(d => d.id !== id)
}

// ============================ RESET ============================
export function resetMockData() {
  DB.turmas = [...MOCK_DATA.turmas]
  DB.usuarios = [...MOCK_DATA.usuarios]
  DB.equipes = JSON.parse(JSON.stringify(MOCK_DATA.equipes))
  DB.projetos = JSON.parse(JSON.stringify(MOCK_DATA.projetos))
  DB.tarefas = JSON.parse(JSON.stringify(MOCK_DATA.tarefas))
  DB.historico_atividades = [...MOCK_DATA.historico_atividades]
  DB.daily_registers = [...MOCK_DATA.daily_registers]
}

export function exportMockData() {
  return JSON.stringify({
    turmas: DB.turmas,
    usuarios: DB.usuarios,
    equipes: DB.equipes,
    projetos: DB.projetos,
    tarefas: DB.tarefas,
    historico_atividades: DB.historico_atividades,
    daily_registers: DB.daily_registers
  }, null, 2)
}

export function importMockData(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json
  if (data.turmas) DB.turmas = data.turmas
  if (data.usuarios) DB.usuarios = data.usuarios
  if (data.equipes) DB.equipes = data.equipes
  if (data.projetos) DB.projetos = data.projetos
  if (data.tarefas) DB.tarefas = data.tarefas
  if (data.historico_atividades) DB.historico_atividades = data.historico_atividades
  if (data.daily_registers) DB.daily_registers = data.daily_registers
}