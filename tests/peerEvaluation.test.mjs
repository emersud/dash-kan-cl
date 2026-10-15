// =============================================================================
// TESTES — AVALIAÇÃO POR PARES (Peer Evaluation)
// Rodar com: npm test  (node --test tests/)
// Cobrem os casos obrigatórios de Peer_Evaluation.md (seções 15 e 16):
// cálculos, elegibilidade/integridade, permissões/privacidade e progresso.
// =============================================================================
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CRITERIOS,
  ESCALA,
  notaValida,
  rotuloNota,
  periodoAberto,
  calcularMedias,
  temAlgumDado,
  formatarMedia,
  validarEnvio,
  validarRascunho,
  progressoDoAvaliador,
  painelParticipacao,
  mediaAggregadaGrupo,
  consolidarResultados
} from '../src/utils/peerEvaluation.js'

import * as ds from '../src/services/dataService.js'

const professor = async () => { ds.resetMockData(); return ds.autenticar('carlos@escola.com', '123456') }
const alunoJoao = async () => { ds.resetMockData(); return ds.autenticar('joao@aluno.com', 'Mudar123') }

const avaliacaoValida = {
  periodo_id: 'ap2',
  equipe_id: 'eq1',
  avaliador_id: 'u2',
  avaliado_id: 'u4',
  colaboracao: 3,
  responsabilidade: 3,
  comunicacao: 3,
  qualidade_entregas: 3,
  autonomia: 3,
  comentario: ''
}

// ---------------------------------------------------------------- ESTRUTURA --
test('estrutura: 5 critérios e escala inteira de 1 a 5', () => {
  assert.equal(CRITERIOS.length, 5)
  assert.deepEqual(
    CRITERIOS.map(c => c.chave),
    ['colaboracao', 'responsabilidade', 'comunicacao', 'qualidade_entregas', 'autonomia']
  )
  assert.deepEqual(ESCALA.map(e => e.nota), [1, 2, 3, 4, 5])
  assert.equal(rotuloNota(1), 'Precisa melhorar muito')
  assert.equal(rotuloNota(3), 'Adequado')
  assert.equal(rotuloNota(5), 'Excelente')
  for (const criterio of CRITERIOS) {
    assert.ok(criterio.nome && criterio.descricao && criterio.pergunta)
  }
})

test('validação: notas aceitas apenas como inteiro de 1 a 5', () => {
  for (const n of [1, 2, 3, 4, 5]) assert.equal(notaValida(n), true, `nota ${n} deveria ser válida`)
  for (const n of [0, 6, -1, 3.5, '4', null, undefined, NaN]) {
    assert.equal(notaValida(n), false, `nota ${String(n)} deveria ser inválida`)
  }
})

// ---------------------------------------------------------------- CÁLCULOS --
test('cálculo: média por critério com a fórmula do plano (5+4+4)/3 = 4,33', () => {
  const medias = calcularMedias([
    { colaboracao: 5, responsabilidade: 4, comunicacao: 3, qualidade_entregas: 2, autonomia: 1 },
    { colaboracao: 4, responsabilidade: 4, comunicacao: 3, qualidade_entregas: 2, autonomia: 1 },
    { colaboracao: 4, responsabilidade: 4, comunicacao: 3, qualidade_entregas: 2, autonomia: 1 }
  ])
  // Arredondamento APENAS na exibição: o valor bruto continua exato.
  assert.ok(Math.abs(medias.colaboracao.media - 13 / 3) < 1e-9)
  assert.equal(medias.colaboracao.qtd, 3)
  assert.equal(medias.responsabilidade.media, 4)
  assert.equal(formatarMedia(medias.colaboracao.media), '4,33')
  assert.equal(formatarMedia(4.5), '4,50')
})

test('cálculo: critério sem notas válidas vira "Sem dados" (null), nunca zero', () => {
  const medias = calcularMedias([{ colaboracao: 4, responsabilidade: null, comunicacao: 0 }])
  assert.equal(medias.colaboracao.media, 4)
  assert.equal(medias.responsabilidade.media, null)
  assert.equal(medias.responsabilidade.qtd, 0)
  // nota 0 não é nota válida -> não conta e não vira média zero
  assert.equal(medias.comunicacao.media, null)
  assert.equal(formatarMedia(null), '—')
  assert.equal(temAlgumDado(medias), true)
  assert.equal(temAlgumDado(calcularMedias([])), false)
})

test('cálculo: somente avaliações ENVIADAS entram nas médias (rascunho fica de fora)', async () => {
  await professor()
  const resultados = await ds.listarPeerResultados('ap2')

  // u4 (Pedro) recebeu pa01 (colab 4, de u2) e pa06 (colab 4, de u6) -> 2 respostas
  const linhaU4 = resultados.find(r => r.avaliado_id === 'u4')
  assert.ok(linhaU4, 'u4 deveria ter linha de resultados em Sprint 2')
  assert.equal(linhaU4.total_avaliacoes, 2)
  assert.equal(linhaU4.colaboracao, 4)
  assert.equal(linhaU4.colaboracao_n, 2)
  assert.equal(linhaU4.qualidade_entregas, 4)

  // u6 recebeu pa02 (enviada) e pa04 (RASCUNHO com colaboracao 4) ->
  // o rascunho não pode puxar a média para 4,5 nem contar como resposta.
  const linhaU6 = resultados.find(r => r.avaliado_id === 'u6')
  assert.equal(linhaU6.total_avaliacoes, 1)
  assert.equal(linhaU6.colaboracao, 5)
  assert.equal(linhaU6.colaboracao_n, 1)
  // critério que só tinha nota em rascunho -> sem dados, não zero
  assert.equal(linhaU6.qualidade_entregas, 5)
  assert.equal(linhaU6.responsabilidade, 4)
})

test('cálculo: comentários, tarefas e check-ins não afetam a média', async () => {
  await professor()
  const semComentario = await ds.listarPeerResultados('ap2')
  const linhaU2 = semComentario.find(r => r.avaliado_id === 'u2')
  // u2 recebeu pa03 (5,5,4,5,5 com comentário) e pa05 (4,5,4,4,5 sem comentário)
  assert.equal(linhaU2.total_avaliacoes, 2)
  assert.ok(Math.abs(linhaU2.colaboracao - 4.5) < 1e-9)
  assert.equal(linhaU2.responsabilidade, 5)
  assert.equal(linhaU2.comunicacao, 4)
  assert.equal(linhaU2.qualidade_entregas, 4.5)
  assert.equal(linhaU2.autonomia, 5)
})

test('cálculo: período sem nenhuma avaliação não gera linha (interface exibe "Sem dados")', async () => {
  await professor()
  const resultados = await ds.listarPeerResultados('ap3')
  assert.equal(resultados.length, 0)
  assert.equal(temAlgumDado(calcularMedias([])), false)
})

test('cálculo: visão agregada do grupo pondera pelas respostas de cada aluno', () => {
  const agregado = mediaAggregadaGrupo([
    { colaboracao: 4, colaboracao_n: 2, responsabilidade: null, responsabilidade_n: 0 },
    { colaboracao: 5, colaboracao_n: 1, responsabilidade: null, responsabilidade_n: 0 }
  ])
  // (4*2 + 5*1) / 3 = 4,333...
  assert.ok(Math.abs(agregado.colaboracao.media - 13 / 3) < 1e-9)
  assert.equal(agregado.colaboracao.qtd, 3)
  assert.equal(agregado.responsabilidade.media, null)
  assert.equal(agregado.responsabilidade.qtd, 0)
})

// ------------------------------------------------- ELEGIBILIDADE / REGRAS ---
test('regra: autoavaliação é bloqueada', async () => {
  await alunoJoao()
  await assert.rejects(
    () => ds.salvarPeerAvaliacao({ ...avaliacaoValida, avaliado_id: 'u2' }, { enviar: true }),
    /si mesmo/i
  )
})

test('regra: não se avalia colega de outra equipe', async () => {
  await alunoJoao()
  await assert.rejects(
    () => ds.salvarPeerAvaliacao({ ...avaliacaoValida, avaliado_id: 'u3', equipe_id: 'eq1' }, { enviar: true }),
    /mesma equipe/i
  )
})

test('regra: período encerrado (ou rascunho) não aceita avaliação', async () => {
  await alunoJoao()
  await assert.rejects(
    () => ds.salvarPeerAvaliacao({ ...avaliacaoValida, periodo_id: 'ap1' }, { enviar: true }),
    /encerrado/i
  )
  await assert.rejects(
    () => ds.salvarPeerAvaliacao({ ...avaliacaoValida, periodo_id: 'ap3' }, { enviar: true }),
    /encerrado/i
  )
})

test('regra: nota fora de 1–5 é rejeitada', async () => {
  await alunoJoao()
  await assert.rejects(
    () => ds.salvarPeerAvaliacao({ ...avaliacaoValida, colaboracao: 9 }, { enviar: true }),
    /Nota inválida/i
  )
  await assert.rejects(
    () => ds.salvarPeerAvaliacao({ ...avaliacaoValida, comunicacao: 0 }, { enviar: false }),
    /Nota inválida/i
  )
})

test('regra: envio incompleto é rejeitado (5 critérios obrigatórios)', async () => {
  await alunoJoao()
  const incompleta = { ...avaliacaoValida, qualidade_entregas: null, autonomia: null }
  await assert.rejects(
    () => ds.salvarPeerAvaliacao(incompleta, { enviar: true }),
    /todos os critérios/i
  )
})

test('regra: um aluno só grava avaliação em SEU próprio nome', async () => {
  await alunoJoao()
  await assert.rejects(
    () => ds.salvarPeerAvaliacao({ ...avaliacaoValida, avaliador_id: 'u4' }, { enviar: true }),
    /próprio nome/i
  )
})

test('regra: uma avaliação por (período, avaliador, avaliado) — sem duplicidade', async () => {
  await alunoJoao()
  const antes = (await ds.listarPeerAvaliacoes())
    .filter(a => a.periodo_id === 'ap2' && a.avaliador_id === 'u2' && a.avaliado_id === 'u4')
  assert.equal(antes.length, 1)

  // reenvio do mesmo par atualiza a linha, não cria outra
  await ds.salvarPeerAvaliacao({ ...avaliacaoValida, colaboracao: 2 }, { enviar: true })
  const depois = (await ds.listarPeerAvaliacoes())
    .filter(a => a.periodo_id === 'ap2' && a.avaliador_id === 'u2' && a.avaliado_id === 'u4')
  assert.equal(depois.length, 1)
  assert.equal(depois[0].colaboracao, 2)
  assert.equal(depois[0].estado, 'enviada')
})

test('regra: rascunho é salvo sem todas as notas e não vira "enviada"', async () => {
  await alunoJoao()
  const rascunho = {
    ...avaliacaoValida,
    avaliado_id: 'u6',
    responsabilidade: null,
    qualidade_entregas: null,
    autonomia: null
  }
  const salvo = await ds.salvarPeerAvaliacao(rascunho, { enviar: false })
  assert.equal(salvo.estado, 'rascunho')
})

test('regra: período pode ser criado/alterado/excluído e a exclusão limpa as avaliações', async () => {
  await professor()
  const criado = await ds.criarPeriodoAvaliacao({
    nome: 'Sprint Teste', data_inicio: '2026-12-01', data_final: '2026-12-20', estado: 'aberto'
  })
  assert.ok(criado.id)
  await ds.atualizarPeriodoAvaliacao(criado.id, { estado: 'encerrado' })

  await ds.removerPeriodoAvaliacao('ap2')
  const restantes = await ds.listarPeriodosAvaliacao()
  assert.equal(restantes.some(p => p.id === 'ap2'), false)
  const avaliacoes = await ds.listarPeerAvaliacoes()
  assert.equal(avaliacoes.some(a => a.periodo_id === 'ap2'), false)
})

// ------------------------------------------------------- PERMISSÕES / RLS ---
test('privacidade: aluno só lê as avaliações que ele mesmo gravou', async () => {
  await alunoJoao()
  const vistas = await ds.listarPeerAvaliacoes()
  assert.ok(vistas.length > 0)
  assert.ok(vistas.every(a => a.avaliador_id === 'u2'))
  assert.equal(vistas.some(a => a.avaliador_id === 'u4'), false)
})

test('privacidade: professor lê todas as avaliações (moderação/comentários)', async () => {
  await professor()
  const todas = await ds.listarPeerAvaliacoes()
  assert.equal(todas.length, 16)
  assert.equal(new Set(todas.map(a => a.avaliador_id)).size, 6)
})

test('privacidade: aluno vê apenas as MÉDIAS recebidas por ele; professor vê todos', async () => {
  await alunoJoao()
  const doAluno = await ds.listarPeerResultados('ap2')
  assert.ok(doAluno.length > 0)
  assert.ok(doAluno.every(r => r.avaliado_id === 'u2'), 'aluno só pode ver a própria linha de resultados')

  await professor()
  const doProfessor = await ds.listarPeerResultados('ap2')
  assert.equal(doProfessor.length, 6, 'professor vê as médias de todos os 6 alunos')
})

test('privacidade: aluno não altera/exclui avaliação de outra pessoa', async () => {
  await alunoJoao()
  // pa03 foi gravada pelo avaliador u4 — o aluno u2 não pode excluí-la
  // (mesma regra do RLS peer_avaliacoes_delete_own_or_professor).
  await assert.rejects(() => ds.removerPeerAvaliacao('pa03'), /próprio nome/i)
  const aindaLa = (await ds.listarPeerAvaliacoes()).some(a => a.id === 'pa03')
  assert.equal(aindaLa, false, 'a linha de outro avaliador nem aparece para o aluno')
})

// ------------------------------------------------------------- PROGRESSO ----
test('progresso: "Você avaliou X de Y colegas" considera só colegas elegíveis', async () => {
  // Visão completa das linhas (professor); o progresso filtra por avaliador.
  await professor()
  const avaliacoes = await ds.listarPeerAvaliacoes()
  const progresso = progressoDoAvaliador({
    avaliacoes,
    periodoId: 'ap2',
    avaliadorId: 'u2',
    colegasIds: ['u4', 'u6'] // exclui a si mesmo
  })
  assert.deepEqual(progresso, { total: 2, concluidos: 2, rascunhos: 0, pendentes: 0 })

  const progressoParcial = progressoDoAvaliador({
    avaliacoes,
    periodoId: 'ap2',
    avaliadorId: 'u4',
    colegasIds: ['u2', 'u6'] // pa03 enviada + pa04 rascunho
  })
  assert.deepEqual(progressoParcial, { total: 2, concluidos: 1, rascunhos: 1, pendentes: 0 })

  // Aluno que ainda não avaliou ninguém no período
  const progressoVazio = progressoDoAvaliador({
    avaliacoes,
    periodoId: 'ap3',
    avaliadorId: 'u2',
    colegasIds: ['u4', 'u6']
  })
  assert.deepEqual(progressoVazio, { total: 2, concluidos: 0, rascunhos: 0, pendentes: 2 })
})

test('painel do professor: adesão por aluno (esperadas/enviadas/pendentes)', async () => {
  await professor()
  const [alunos, equipes, avaliacoes] = await Promise.all([
    ds.listarUsuarios(),
    ds.listarEquipes(),
    ds.listarPeerAvaliacoes()
  ])
  const painel = painelParticipacao({
    avaliacoes,
    periodoId: 'ap2',
    alunos: alunos.filter(u => u.papel === 'aluno'),
    equipes
  })
  const linhaU2 = painel.find(l => l.aluno.id === 'u2')
  assert.equal(linhaU2.esperadas, 2)
  assert.equal(linhaU2.enviadas, 2)
  assert.equal(linhaU2.pendentes, 0)
  assert.equal(linhaU2.equipeNome, 'Alpha Tech')

  const linhaU5 = painel.find(l => l.aluno.id === 'u5')
  assert.equal(linhaU5.esperadas, 2)
  assert.equal(linhaU5.enviadas, 1)
  assert.equal(linhaU5.rascunhos, 1)
  assert.equal(linhaU5.pendentes, 1)
})

// ------------------------------------------------------------ FORMULÁRIO ----
test('formulário: enviar exige os 5 critérios; rascunho exige ao menos um', () => {
  const completo = { colaboracao: 1, responsabilidade: 2, comunicacao: 3, qualidade_entregas: 4, autonomia: 5 }
  assert.equal(validarEnvio(completo), null)

  const erro = validarEnvio({ colaboracao: 1, responsabilidade: 2 })
  assert.match(erro, /todos os critérios/)
  assert.match(erro, /Comunicação/)
  assert.match(erro, /Autonomia e iniciativa/)

  assert.equal(validarRascunho({ colaboracao: 3 }), null)
  assert.match(validarRascunho({}), /ao menos uma nota/)
  assert.match(validarRascunho({ colaboracao: 7 }), /1 a 5/)
})

test('formulário: nota 0 não é aceita como envio', () => {
  const comZero = { colaboracao: 0, responsabilidade: 2, comunicacao: 3, qualidade_entregas: 4, autonomia: 5 }
  const erro = validarEnvio(comZero)
  assert.match(erro, /Colaboração/)
})

test('estado do período: aberto aceita, rascunho/encerrado não', () => {
  assert.equal(periodoAberto({ estado: 'aberto' }), true)
  assert.equal(periodoAberto({ estado: 'encerrado' }), false)
  assert.equal(periodoAberto({ estado: 'rascunho' }), false)
  assert.equal(periodoAberto(null), false)
})

// --------------------------------------- CONSOLIDAÇÃO DE RESULTADOS --------
// Regressão da migração 0014: aluno membro de 2 equipes vinha com DUAS linhas
// por período (chave duplicada no React + radar mostrando só uma equipe).
const linhaEquipeA = {
  periodo_id: 'p1', avaliado_id: 'u4', equipe_id: 'eq1', avaliado_nome: 'Aluno Teste',
  total_avaliacoes: 2,
  colaboracao: 4, colaboracao_n: 2,
  responsabilidade: 3, responsabilidade_n: 2,
  comunicacao: 5, comunicacao_n: 2,
  qualidade_entregas: null, qualidade_entregas_n: 0,
  autonomia: null, autonomia_n: 0
}
const linhaEquipeB = {
  periodo_id: 'p1', avaliado_id: 'u4', equipe_id: 'eq2', avaliado_nome: 'Aluno Teste',
  total_avaliacoes: 3,
  colaboracao: 3, colaboracao_n: 3,
  responsabilidade: 5, responsabilidade_n: 3,
  comunicacao: 4, comunicacao_n: 3,
  qualidade_entregas: 2, qualidade_entregas_n: 3,
  autonomia: null, autonomia_n: 0
}

test('consolidação: aluno em 2 equipes vira UMA linha por período (chave única)', () => {
  const consolidado = consolidarResultados([linhaEquipeA, linhaEquipeB])
  assert.equal(consolidado.length, 1)
  assert.equal(consolidado[0].periodo_id, 'p1')
  assert.equal(consolidado[0].avaliado_id, 'u4')
  assert.equal(consolidado[0].total_avaliacoes, 5)
  // equipe exibida = a de mais respostas (representativa)
  assert.equal(consolidado[0].equipe_id, 'eq2')
})

test('consolidação: média PONDERADA pelas respostas (nunca média de médias)', () => {
  const [linha] = consolidarResultados([linhaEquipeA, linhaEquipeB])
  // (4*2 + 3*3) / 5 = 17/5 = 3,40
  assert.equal(linha.colaboracao_n, 5)
  assert.ok(Math.abs(linha.colaboracao - 3.4) < 1e-9)
  // (3*2 + 5*3) / 5 = 4,20
  assert.equal(linha.responsabilidade_n, 5)
  assert.ok(Math.abs(linha.responsabilidade - 4.2) < 1e-9)
  // (5*2 + 4*3) / 5 = 4,40
  assert.equal(linha.comunicacao_n, 5)
  assert.ok(Math.abs(linha.comunicacao - 4.4) < 1e-9)
  // critério presente em só UMA das linhas: entra só com as respostas dela
  assert.equal(linha.qualidade_entregas_n, 3)
  assert.ok(Math.abs(linha.qualidade_entregas - 2) < 1e-9)
  // critério sem nenhuma resposta -> "Sem dados" (null), nunca zero
  assert.equal(linha.autonomia, null)
  assert.equal(linha.autonomia_n, 0)
})

test('consolidação: preserva períodos/alunos distintos e é idempotente', () => {
  const outroPeriodo = { ...linhaEquipeA, periodo_id: 'p2', avaliado_id: 'u5' }
  const consolidado = consolidarResultados([linhaEquipeA, linhaEquipeB, outroPeriodo])
  assert.equal(consolidado.length, 2)
  assert.deepEqual(consolidarResultados(consolidado), consolidado)
  assert.deepEqual(consolidarResultados([]), [])
  assert.deepEqual(consolidarResultados(null), [])
})
