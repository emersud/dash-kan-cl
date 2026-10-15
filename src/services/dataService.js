import { MOCK_DATA } from './mockData.js'
import { otimizarImagem } from './imageService.js'
import { CRITERIOS, calcularMedias } from '../utils/peerEvaluation.js'

const DB = {
  turmas: [...MOCK_DATA.turmas],
  usuarios: [...MOCK_DATA.usuarios],
  equipes: JSON.parse(JSON.stringify(MOCK_DATA.equipes)),
  projetos: JSON.parse(JSON.stringify(MOCK_DATA.projetos)),
  tarefas: JSON.parse(JSON.stringify(MOCK_DATA.tarefas)),
  historico_atividades: [...MOCK_DATA.historico_atividades],
  daily_registers: [...MOCK_DATA.daily_registers],
  avaliacoes_periodos: JSON.parse(JSON.stringify(MOCK_DATA.avaliacoes_periodos)),
  peer_avaliacoes: JSON.parse(JSON.stringify(MOCK_DATA.peer_avaliacoes))
}

let useSupabase = false
let supabaseClient = null

// Sessão do usuário no modo mock — espelha o RLS do Supabase nas consultas
// que o aluno não deveria ver inteiras (ex.: avaliações por pares).
let usuarioSessao = null
function definirSessao(usuario) {
  usuarioSessao = usuario || null
}


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
  definirSessao(usuario)
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
  if (perfil) {
    definirSessao(perfil)
    return perfil
  }
  const fallback = { id: data.user.id, email, nome: data.user.user_metadata?.nome || email, papel: 'aluno' }
  definirSessao(fallback)
  return fallback
}

export async function sairSupabase() {
  definirSessao(null)
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

// ============================ IMAGENS (STORAGE) ============================
// Foto de perfil -> bucket "avatares" (500 KB, 3:4); logo de equipe -> bucket
// "logos" (1 MB, 1:1). A imagem já chega do imageService convertida para
// WebP, cortada na proporção e com nome UUID. Caminho: <pasta>/<uuid>.webp
// (pasta = id do usuário ou da equipe — usada pelas policies do Storage).
export async function enviarImagem({ bucket, pasta, arquivo, tipo = 'foto' }) {
  const { blob, nome } = await otimizarImagem(arquivo, tipo)
  const caminho = pasta ? `${pasta}/${nome}` : nome

  if (!useSupabase) {
    // Modo mock/demo: sem Storage — guarda como data URL.
    return await blobParaDataUrl(blob)
  }

  const { error } = await supabaseClient.storage
    .from(bucket)
    .upload(caminho, blob, { contentType: blob.type, upsert: true })
  if (error) {
    console.warn('[enviarImagem]', bucket, error.message || error.code)
    throw new Error('Não foi possível enviar a imagem. Tente novamente.')
  }
  const { data } = supabaseClient.storage.from(bucket).getPublicUrl(caminho)
  return data?.publicUrl || ''
}

// Remove a imagem anterior quando o usuário troca ou remove a foto/logotipo.
// Melhor esforço: URLs antigas (pravatar/dicebear/etc.) são ignoradas.
export async function removerImagem(bucket, url) {
  if (!url || typeof url !== 'string' || !useSupabase) return
  const marca = `/${bucket}/`
  const idx = url.indexOf(marca)
  if (idx === -1) return
  const caminho = decodeURIComponent(url.slice(idx + marca.length).split('?')[0])
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|png|jpg|jpeg|gif)$/i.test(caminho)) return
  const { error } = await supabaseClient.storage.from(bucket).remove([caminho])
  if (error) console.warn('[removerImagem]', bucket, error.message || error.code)
}

function blobParaDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(String(leitor.result))
    leitor.onerror = () => reject(new Error('Não foi possível processar a imagem.'))
    leitor.readAsDataURL(blob)
  })
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
    // Senha e e-mail de LOGIN vivem no Supabase Auth (auth.users), não em
    // public.usuarios (coluna 'senha' deprecada no schema 0001). A RPC
    // alterar_acesso_usuario (migração 0010) grava auth.users.encrypted_password
    // e auth.users.email — sem ela a troca de senha não vale no login.
    const { senha, ...perfil } = dados
    if (senha || perfil.email) {
      const { error: errRpc } = await supabaseClient.rpc('alterar_acesso_usuario', {
        p_usuario_id: id,
        p_senha: senha || null,
        p_email: perfil.email || null
      })
      if (errRpc) {
        const msg = errRpc.message || ''
        const faltando = /alterar_acesso_usuario/i.test(msg) || errRpc.code === 'PGRST202'
        if (faltando) {
          console.warn('[atualizarUsuario] RPC de acesso indisponível:', msg || errRpc.code)
          // Sem a RPC a senha só iria para a coluna deprecada e o login
          // continuaria com a senha antiga — não deixa "parecer salvo".
          if (senha) {
            throw new Error('Não foi possível alterar a senha da conta de login. Aplique a migração 0010 no Supabase (SQL Editor) e tente novamente.')
          }
        } else {
          // Mostra apenas mensagens de regra de negócio; o resto vira aviso genérico.
          const regra = /acesso negado|senha|e-mail|conta de login/i.test(msg)
          console.warn('[atualizarUsuario] falha ao atualizar acesso:', msg || errRpc.code)
          throw new Error(regra ? msg : 'Erro ao atualizar o usuário. Tente novamente.')
        }
      }
    }
    const { data, error } = await supabaseClient.from('usuarios').update(perfil).eq('id', id).select().single()
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
  DB.peer_avaliacoes = DB.peer_avaliacoes.filter(a => a.avaliador_id !== id && a.avaliado_id !== id)
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
  DB.peer_avaliacoes = DB.peer_avaliacoes.filter(a => a.equipe_id !== id)
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

// ============================ AVALIAÇÃO POR PARES ============================
// Período/Sprint + avaliações entre colegas do mesmo grupo (Peer Evaluation).
// No modo Supabase o servidor valida as regras (trigger da migração 0013):
// autoavaliação, duplicidade, período aberto, notas 1–5 e composição da equipe.
// No modo mock as mesmas regras rodam em validarRegrasAvaliacao().
// Privacidade: o aluno só lê as linhas que escreveu (RLS) e as MÉDIAS recebidas
// (RPC peer_resultados); o professor/gestor lê tudo.

function ehGestor(usuario) {
  return usuario?.papel === 'professor' || usuario?.papel === 'gestor'
}

export async function listarPeriodosAvaliacao() {
  if (useSupabase) {
    const { data, error } = await supabaseClient
      .from('avaliacoes_periodos')
      .select('*')
      .order('data_inicio', { ascending: true, nullsFirst: false })
    if (error) throw error
    return data
  }
  return JSON.parse(JSON.stringify(DB.avaliacoes_periodos))
    .sort((a, b) => String(a.data_inicio || '').localeCompare(String(b.data_inicio || '')))
}

export async function criarPeriodoAvaliacao(dados) {
  if (useSupabase) {
    const { data, error } = await supabaseClient
      .from('avaliacoes_periodos')
      .insert(dados)
      .select()
      .single()
    if (error) throw error
    return data
  }
  const novo = { id: genId(), estado: 'aberto', ...dados }
  DB.avaliacoes_periodos.push(novo)
  return novo
}

export async function atualizarPeriodoAvaliacao(id, dados) {
  if (useSupabase) {
    const { data, error } = await supabaseClient
      .from('avaliacoes_periodos')
      .update(dados)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  }
  const idx = DB.avaliacoes_periodos.findIndex(p => p.id === id)
  if (idx !== -1) DB.avaliacoes_periodos[idx] = { ...DB.avaliacoes_periodos[idx], ...dados }
  return DB.avaliacoes_periodos[idx]
}

// Remoção de período (somente professor/gestor; RLS/INSERT-UPDATE impedem o resto).
export async function removerPeriodoAvaliacao(id) {
  if (useSupabase) {
    const { error } = await supabaseClient.from('avaliacoes_periodos').delete().eq('id', id)
    if (error) throw error
    return
  }
  DB.avaliacoes_periodos = DB.avaliacoes_periodos.filter(p => p.id !== id)
  DB.peer_avaliacoes = DB.peer_avaliacoes.filter(a => a.periodo_id !== id)
}

export async function listarPeerAvaliacoes() {
  if (useSupabase) {
    // RLS: professor/gestor vê todas; aluno vê apenas as que ele mesmo gravou.
    const { data, error } = await supabaseClient
      .from('peer_avaliacoes')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw error
    return data || []
  }
  if (!usuarioSessao) return []
  const todas = JSON.parse(JSON.stringify(DB.peer_avaliacoes))
  if (ehGestor(usuarioSessao)) return todas
  return todas.filter(a => a.avaliador_id === usuarioSessao.id)
}

// Regras de negócio no "servidor" do modo mock (espelham o trigger do banco).
function validarRegrasAvaliacao(a) {
  const periodo = DB.avaliacoes_periodos.find(p => p.id === a.periodo_id)
  if (!periodo) return 'Período de avaliação não encontrado.'
  if (periodo.estado !== 'aberto') return 'O período foi encerrado e não aceita alterações.'
  if (a.avaliador_id === a.avaliado_id) return 'Você não pode avaliar a si mesmo.'
  const avaliador = DB.usuarios.find(u => u.id === a.avaliador_id)
  const avaliado = DB.usuarios.find(u => u.id === a.avaliado_id)
  if (avaliador?.papel !== 'aluno' || avaliado?.papel !== 'aluno') {
    return 'Apenas alunos podem participar da avaliação por pares.'
  }
  const equipe = DB.equipes.find(e => e.id === a.equipe_id)
  if (!equipe) return 'Equipe não encontrada.'
  const membros = new Set((equipe.membros || []).map(m => m.aluno_id))
  if (!membros.has(a.avaliador_id) || !membros.has(a.avaliado_id)) {
    return 'Avaliador e avaliado precisam fazer parte da mesma equipe.'
  }
  for (const criterio of CRITERIOS) {
    const nota = a[criterio.chave]
    if (nota == null) continue
    if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
      return `Nota inválida em "${criterio.nome}". Use valores inteiros de 1 a 5.`
    }
  }
  if (a.estado === 'enviada') {
    const faltando = CRITERIOS.filter(c => a[c.chave] == null).map(c => c.nome)
    if (faltando.length) {
      return `Informe uma nota de 1 a 5 em todos os critérios antes de enviar. Faltando: ${faltando.join(', ')}.`
    }
  }
  return null
}

// Espelha a RLS do modo Supabase: só o próprio aluno grava em seu nome e só
// exclui enquanto o período estiver aberto; professor/gestor modera.
function validarPropriaAvaliacao(avaliacao, { excluindo = false } = {}) {
  if (!usuarioSessao || ehGestor(usuarioSessao)) return null
  if (avaliacao.avaliador_id !== usuarioSessao.id) {
    return 'Você só pode registrar avaliações em seu próprio nome.'
  }
  if (excluindo) {
    const periodo = DB.avaliacoes_periodos.find(p => p.id === avaliacao.periodo_id)
    if (periodo && periodo.estado !== 'aberto') {
      return 'O período foi encerrado e não aceita alterações.'
    }
  }
  return null
}

// Salva (ou atualiza) a avaliação de um par (avaliador, avaliado, período).
// enviar=true grava estado 'enviada' (entra nas médias); false = 'rascunho'.
export async function salvarPeerAvaliacao(dados, { enviar = false } = {}) {
  const payload = { ...dados, estado: enviar ? 'enviada' : 'rascunho' }

  if (useSupabase) {
    const { data, error } = await supabaseClient
      .from('peer_avaliacoes')
      .upsert(payload, { onConflict: 'periodo_id,avaliador_id,avaliado_id' })
      .select()
      .single()
    if (error) {
      const msg = error.message || ''
      const regra = /avalia|per[ií]odo|equipe|nota|si mesmo|alunos/i.test(msg)
      console.warn('[salvarPeerAvaliacao] falha:', msg || error.code)
      throw new Error(regra ? msg : 'Não foi possível salvar a avaliação. Tente novamente.')
    }
    return data
  }

  const erroRegra = validarPropriaAvaliacao(payload)
  if (erroRegra) throw new Error(erroRegra)
  const erro = validarRegrasAvaliacao(payload)
  if (erro) throw new Error(erro)
  const existente = DB.peer_avaliacoes.find(a =>
    a.periodo_id === payload.periodo_id &&
    a.avaliador_id === payload.avaliador_id &&
    a.avaliado_id === payload.avaliado_id
  )
  if (existente) {
    Object.assign(existente, payload, { updated_at: new Date().toISOString() })
    return { ...existente }
  }
  const nova = {
    id: genId(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...payload
  }
  DB.peer_avaliacoes.push(nova)
  return { ...nova }
}

// Exclusão: o próprio avaliador (enquanto o período estiver aberto) ou o
// professor/gestor (moderação de comentário impróprio). RLS impõe a mesma regra.
export async function removerPeerAvaliacao(id) {
  if (useSupabase) {
    const { error } = await supabaseClient.from('peer_avaliacoes').delete().eq('id', id)
    if (error) throw error
    return
  }
  const alvo = DB.peer_avaliacoes.find(a => a.id === id)
  if (!alvo) return
  const erro = validarPropriaAvaliacao(alvo, { excluindo: true })
  if (erro) throw new Error(erro)
  DB.peer_avaliacoes = DB.peer_avaliacoes.filter(a => a.id !== id)
}

/**
 * Médias recebidas por aluno e período (agrupadas por avaliado).
 * Supabase: RPC peer_resultados (migração 0013) — o servidor calcula e já
 * aplica a autorização (professor: todos; aluno: apenas ele mesmo).
 * Mock: mesma agregação aqui, para não duplicar fórmula na interface.
 */
export async function listarPeerResultados(periodoId = null) {
  if (useSupabase) {
    const { data, error } = await supabaseClient.rpc('peer_resultados', {
      p_periodo_id: periodoId || null
    })
    if (error) {
      const faltando = /peer_resultados/i.test(error.message || '') || error.code === 'PGRST202'
      console.warn('[listarPeerResultados] indisponível:', error.message || error.code)
      throw new Error(faltando
        ? 'Serviço indisponível no momento. Tente novamente mais tarde.'
        : 'Não foi possível carregar os resultados. Tente novamente.')
    }
    return Array.isArray(data) ? data : []
  }

  const enviadas = DB.peer_avaliacoes.filter(a => a.estado === 'enviada')
  const visiveis = !usuarioSessao || ehGestor(usuarioSessao)
    ? enviadas
    : enviadas.filter(a => a.avaliado_id === usuarioSessao.id)
  const filtradas = periodoId ? visiveis.filter(a => a.periodo_id === periodoId) : visiveis

  const grupos = new Map()
  for (const avaliacao of filtradas) {
    const chave = `${avaliacao.periodo_id}|${avaliacao.avaliado_id}`
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave).push(avaliacao)
  }
  return [...grupos.values()].map(linhas => {
    const medias = calcularMedias(linhas)
    const avaliado = DB.usuarios.find(u => u.id === linhas[0].avaliado_id)
    const linha = {
      periodo_id: linhas[0].periodo_id,
      avaliado_id: linhas[0].avaliado_id,
      equipe_id: linhas[0].equipe_id,
      avaliado_nome: avaliado?.nome || '',
      total_avaliacoes: linhas.length
    }
    for (const criterio of CRITERIOS) {
      linha[criterio.chave] = medias[criterio.chave].media
      linha[`${criterio.chave}_n`] = medias[criterio.chave].qtd
    }
    return linha
  })
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
  DB.avaliacoes_periodos = JSON.parse(JSON.stringify(MOCK_DATA.avaliacoes_periodos))
  DB.peer_avaliacoes = JSON.parse(JSON.stringify(MOCK_DATA.peer_avaliacoes))
}

export function exportMockData() {
  return JSON.stringify({
    turmas: DB.turmas,
    usuarios: DB.usuarios,
    equipes: DB.equipes,
    projetos: DB.projetos,
    tarefas: DB.tarefas,
    historico_atividades: DB.historico_atividades,
    daily_registers: DB.daily_registers,
    avaliacoes_periodos: DB.avaliacoes_periodos,
    peer_avaliacoes: DB.peer_avaliacoes
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
  if (data.avaliacoes_periodos) DB.avaliacoes_periodos = data.avaliacoes_periodos
  if (data.peer_avaliacoes) DB.peer_avaliacoes = data.peer_avaliacoes
}