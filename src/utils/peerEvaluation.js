// =============================================================================
// AVALIAÇÃO POR PARES (PEER EVALUATION) — critérios, escala e cálculos
// Regras conforme Peer_Evaluation.md: 5 critérios, escala 1–5, média apenas
// sobre avaliações ENVIADAS (sem autoavaliação, sem rascunhos), "Sem dados"
// (nunca zero) quando não houver respostas válidas.
// =============================================================================

export const CRITERIOS = [
  {
    chave: 'colaboracao',
    nome: 'Colaboração',
    descricao: 'Ajuda colegas, compartilha conhecimentos e contribui para o resultado coletivo.',
    pergunta: 'O colega ajuda os demais, compartilha conhecimentos e contribui para o resultado coletivo?'
  },
  {
    chave: 'responsabilidade',
    nome: 'Responsabilidade',
    descricao: 'Cumpre os acordos e sinaliza impedimentos com antecedência.',
    pergunta: 'O colega cumpre os acordos e comunica impedimentos com antecedência?'
  },
  {
    chave: 'comunicacao',
    nome: 'Comunicação',
    descricao: 'Compartilha informações, escuta e participa das decisões.',
    pergunta: 'O colega compartilha informações, escuta os outros e participa das decisões?'
  },
  {
    chave: 'qualidade_entregas',
    nome: 'Qualidade das entregas',
    descricao: 'Segue os requisitos, testa as soluções e cuida da qualidade técnica.',
    pergunta: 'O colega segue os requisitos, testa as soluções e cuida da qualidade técnica de suas entregas?'
  },
  {
    chave: 'autonomia',
    nome: 'Autonomia e iniciativa',
    descricao: 'Identifica problemas e propõe soluções sem depender constantemente de orientação.',
    pergunta: 'O colega identifica problemas e propõe soluções sem depender constantemente de orientação?'
  }
]

export const ESCALA = [
  { nota: 1, rotulo: 'Precisa melhorar muito', orientacao: 'O comportamento foi raramente observado ou ficou muito aquém do esperado.' },
  { nota: 2, rotulo: 'Abaixo do esperado', orientacao: 'O comportamento aparece de forma inconsistente e precisa de melhoria.' },
  { nota: 3, rotulo: 'Adequado', orientacao: 'O comportamento atende ao esperado na maior parte das situações observadas.' },
  { nota: 4, rotulo: 'Muito bom', orientacao: 'O comportamento é consistente e contribui positivamente para a equipe.' },
  { nota: 5, rotulo: 'Excelente', orientacao: 'O comportamento é consistente, proativo e contribui de forma muito significativa.' }
]

export const ORIENTACAO_FORMULARIO =
  'Avalie comportamentos observados durante o período. Seja respeitoso, específico e construtivo. ' +
  'Baseie-se em evidências, não em amizade, conflito isolado ou popularidade.'

export const AVISO_CONFIDENCIALIDADE =
  'Avaliação confidencial: você consulta apenas a média recebida dos colegas, sem identificar quem ' +
  'avaliou nem as notas individuais. Professores e gestores autorizados podem consultar resultados e ' +
  'comentários identificados — em grupos pequenos o anonimato não é absoluto.'

export const MSG_SEM_DADOS = 'Ainda não há avaliações suficientes para exibir a média.'
export const MSG_AGUARDANDO = 'Aguardando avaliações'

export function rotuloNota(nota) {
  return ESCALA.find(e => e.nota === nota)?.rotulo || ''
}

export function notaValida(nota) {
  return Number.isInteger(nota) && nota >= 1 && nota <= 5
}

export function periodoAberto(periodo) {
  return periodo?.estado === 'aberto'
}

export function rotuloEstadoPeriodo(estado) {
  return { rascunho: 'Rascunho', aberto: 'Aberto', encerrado: 'Encerrado' }[estado] || estado || ''
}

export function rotuloEstadoColega(estado) {
  return { rascunho: 'Rascunho', enviada: 'Concluída' }[estado] || 'Pendente'
}

export function badgeEstadoColega(estado) {
  return { rascunho: 'badge-pending', enviada: 'badge-done' }[estado] || 'badge-neutral'
}

/**
 * Média por critério de um conjunto de avaliações JÁ filtrado
 * (somente estado 'enviada' — rascunhos/incompletas ficam de fora).
 * Critério sem nota válida -> { media: null, qtd: 0 } (exibir "Sem dados").
 */
export function calcularMedias(avaliacoes) {
  const medias = {}
  for (const criterio of CRITERIOS) {
    const notas = (avaliacoes || [])
      .map(a => a[criterio.chave])
      .filter(notaValida)
    medias[criterio.chave] = notas.length
      ? { media: notas.reduce((soma, n) => soma + n, 0) / notas.length, qtd: notas.length }
      : { media: null, qtd: 0 }
  }
  return medias
}

export function temAlgumDado(medias) {
  return CRITERIOS.some(c => medias?.[c.chave]?.media != null)
}

/** Exibição: duas casas decimais com vírgula; null -> "—". */
export function formatarMedia(valor) {
  if (valor == null || Number.isNaN(valor)) return '—'
  return Number(valor).toFixed(2).replace('.', ',')
}

/** Estado de um colega para o avaliador logado no período. */
export function estadoDoColega(avaliacoes, periodoId, avaliadorId, avaliadoId) {
  const registro = (avaliacoes || []).find(a =>
    a.periodo_id === periodoId && a.avaliador_id === avaliadorId && a.avaliado_id === avaliadoId
  )
  return registro?.estado || null
}

export function avaliacaoDoPar(avaliacoes, periodoId, avaliadorId, avaliadoId) {
  return (avaliacoes || []).find(a =>
    a.periodo_id === periodoId && a.avaliador_id === avaliadorId && a.avaliado_id === avaliadoId
  ) || null
}

/** "Você avaliou X de Y colegas" — progresso calculado sobre os colegas elegíveis. */
export function progressoDoAvaliador({ avaliacoes, periodoId, avaliadorId, colegasIds = [] }) {
  let concluidos = 0
  let rascunhos = 0
  for (const colegaId of colegasIds) {
    const estado = estadoDoColega(avaliacoes, periodoId, avaliadorId, colegaId)
    if (estado === 'enviada') concluidos++
    else if (estado === 'rascunho') rascunhos++
  }
  return {
    total: colegasIds.length,
    concluidos,
    rascunhos,
    pendentes: colegasIds.length - concluidos - rascunhos
  }
}

export function validarRascunho(notas) {
  const temNota = CRITERIOS.some(c => notas?.[c.chave] != null)
  if (!temNota) return 'Informe ao menos uma nota antes de salvar o rascunho.'
  const invalida = CRITERIOS.find(c => notas[c.chave] != null && !notaValida(notas[c.chave]))
  if (invalida) return `Nota inválida em "${invalida.nome}". Use valores de 1 a 5.`
  return null
}

export function validarEnvio(notas) {
  const faltando = CRITERIOS
    .filter(c => !notaValida(notas?.[c.chave]))
    .map(c => c.nome)
  if (faltando.length) {
    return `Informe uma nota de 1 a 5 em todos os critérios. Faltando: ${faltando.join(', ')}.`
  }
  return null
}

/**
 * Painel de participação (professor): para cada aluno, quantos colegas ele
 * deveria avaliar no período e quantas avaliações enviou/rascunhou.
 * Não calcula nota nem classifica desempenho.
 */
export function painelParticipacao({ avaliacoes, periodoId, alunos, equipes }) {
  return (alunos || []).map(aluno => {
    const equipesAluno = (equipes || []).filter(e =>
      (e.membros || []).some(m => m.aluno_id === aluno.id)
    )
    const colegas = new Set()
    for (const equipe of equipesAluno) {
      for (const m of equipe.membros || []) {
        if (m.aluno_id !== aluno.id) colegas.add(m.aluno_id)
      }
    }
    const minhas = (avaliacoes || []).filter(
      a => a.periodo_id === periodoId && a.avaliador_id === aluno.id
    )
    const enviadas = minhas.filter(a => a.estado === 'enviada').length
    const rascunhos = minhas.filter(a => a.estado === 'rascunho').length
    const equipePrincipal = equipesAluno[0] || null
    return {
      aluno,
      equipe: equipePrincipal,
      equipeNome: equipesAluno.length
        ? equipesAluno.map(e => e.nome).join(' + ')
        : 'Sem equipe',
      esperadas: colegas.size,
      enviadas,
      rascunhos,
      pendentes: Math.max(colegas.size - enviadas, 0)
    }
  })
}

/**
 * Visão agregada do grupo: média ponderada pelas respostas de cada aluno
 * (linhas já agregadas por aluno/período, vindas do serviço/RPC).
 */
/**
 * Consolida as linhas de resultados em UMA por (período, avaliado).
 *
 * O RPC peer_resultados (migração 0014) e o modo mock já devolvem uma linha
 * por aluno/período; esta função é a BLINDAGEM do front-end: se uma base ainda
 * rodar a versão antiga da 0013 (grupo por equipe), alunos em mais de uma
 * equipe viriam duplicados — o que gerava "chave duplicada" no React e fazia
 * o radar exibir só a primeira equipe. As médias são mescladas por MÉDIA
 * PONDERADA pelo número de respostas de cada critério (nunca média de médias)
 * e a equipe exibida passa a ser a que tem mais respostas.
 * Devolve sempre uma lista nova (idempotente: consolidar duas vezes = igual).
 */
export function consolidarResultados(resultados) {
  const linhas = Array.isArray(resultados) ? resultados.filter(Boolean) : []
  const mapa = new Map()

  for (const linha of linhas) {
    const chave = `${linha.periodo_id}|${linha.avaliado_id}`
    const atual = mapa.get(chave)
    if (!atual) {
      mapa.set(chave, { ...linha })
      continue
    }

    const qtdAtual = Number(atual.total_avaliacoes) || 0
    const qtdNova = Number(linha.total_avaliacoes) || 0
    const mesclada = { ...atual, total_avaliacoes: qtdAtual + qtdNova }
    if (qtdNova > qtdAtual) mesclada.equipe_id = linha.equipe_id
    if (!mesclada.avaliado_nome && linha.avaliado_nome) mesclada.avaliado_nome = linha.avaliado_nome

    for (const criterio of CRITERIOS) {
      const campo = criterio.chave
      const n1 = Number(atual[`${campo}_n`]) || 0
      const n2 = Number(linha[`${campo}_n`]) || 0
      const soma =
        (atual[campo] != null && n1 > 0 ? Number(atual[campo]) * n1 : 0) +
        (linha[campo] != null && n2 > 0 ? Number(linha[campo]) * n2 : 0)
      const qtd = n1 + n2
      mesclada[`${campo}_n`] = qtd
      mesclada[campo] = qtd > 0 ? soma / qtd : null
    }

    mapa.set(chave, mesclada)
  }

  return [...mapa.values()]
}

export function mediaAggregadaGrupo(resultados) {
  const agregado = {}
  for (const criterio of CRITERIOS) {
    let soma = 0
    let qtd = 0
    for (const linha of resultados || []) {
      const media = linha[criterio.chave]
      const n = Number(linha[`${criterio.chave}_n`] || 0)
      if (media != null && n > 0) {
        soma += Number(media) * n
        qtd += n
      }
    }
    agregado[criterio.chave] = qtd > 0 ? { media: soma / qtd, qtd } : { media: null, qtd: 0 }
  }
  return agregado
}
