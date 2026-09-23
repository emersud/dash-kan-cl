import * as XLSX from 'xlsx'

export async function lerPlanilha(file) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const primeiraAba = workbook.SheetNames[0]
  const sheet = workbook.Sheets[primeiraAba]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  return rows
}

export function gerarPlanilhaAlunos(rows, mapeamento, turmaId) {
  return rows.map((row, index) => {
    const get = (chave) => (row[chave] !== undefined ? String(row[chave]).trim() : '')
    const nome = get(mapeamento.nome) || `Aluno ${index + 1}`
    const email = get(mapeamento.email) || `aluno${index + 1}@aluno.com`
    const matricula = get(mapeamento.matricula) || `M${Date.now()}${index}`
    return {
      nome,
      email,
      matricula,
      turma_id: turmaId,
      papel: 'aluno',
      senha: 'Mudar123',
      senha_padrao: 'Mudar123',
      primeiro_acesso: true
    }
  })
}