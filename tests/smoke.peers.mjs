// =============================================================================
// SMOKE TEST — tela "Avaliação por Pares" (desktop, Chrome headless)
// Rodar manualmente: node tests/smoke.peers.mjs
// Sobe o dev server, loga como PROFESSOR e como ALUNO, abre a nova tela e
// falha se houver erro de JS (pageerror / console.error) no caminho.
// =============================================================================
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import puppeteer from 'puppeteer-core'

const PORT = 5199
const BASE = `http://localhost:${PORT}`
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const erros = []
const registrar = (onde, texto) => { erros.push(`[${onde}] ${texto}`) }

async function aguardarServidor() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE)
      if (r.ok) return
    } catch { /* ainda subindo */ }
    await sleep(500)
  }
  throw new Error('dev server não respondeu')
}

function conectar(page, onde) {
  page.on('pageerror', e => registrar(onde, `pageerror: ${e.message}`))
  page.on('console', msg => {
    if (msg.type() !== 'error') return
    const texto = msg.text()
    // Falhas de rede esperadas enquanto a migração 0013 não está aplicada
    // (404 de tabela/RPC) são tratadas pela tela com mensagem amigável.
    if (/Failed to load resource|404|net::/i.test(texto)) return
    registrar(onde, `console.error: ${texto}`)
  })
}

async function login(page, email, senha) {
  await page.goto(BASE, { waitUntil: 'networkidle2' })
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.type('input[type="email"]', email)
  const senhaSel = 'input[type="password"]'
  await page.waitForSelector(senhaSel)
  await page.type(senhaSel, senha)
  await page.click('button[type="submit"]')
  try {
    await page.waitForFunction(
      () => !document.querySelector('input[type="email"]'),
      { timeout: 20000 }
    )
  } catch {
    const alerta = await page.evaluate(() =>
      (document.body.innerText || '').split('\n').filter(Boolean).slice(-6).join(' | '))
    throw new Error(`login falhou (${email}): ${alerta}`)
  }
  await sleep(800)
}

async function abrirAvaliacaoPorPares(page, onde) {
  await page.evaluate(() => {
    const alvo = [...document.querySelectorAll('.nav-links, a, button')]
      .find(el => (el.textContent || '').includes('Avaliação por Pares'))
    if (alvo) alvo.click()
  })
  await sleep(1200)
  const temTitulo = await page.evaluate(() =>
    (document.body.innerText || '').includes('Avaliação por Pares'))
  if (!temTitulo) registrar(onde, 'título "Avaliação por Pares" não encontrado na tela')
  const temErroFatal = await page.evaluate(() =>
    (document.body.innerText || '').includes('Uncaught') ||
    (document.body.innerText || '').includes('Objects are not valid'))
  if (temErroFatal) registrar(onde, 'texto de erro fatal visível na página')
}

const servidor = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  shell: true,
  stdio: 'ignore'
})

let navegador = null
try {
  await aguardarServidor()
  navegador = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  })

  // ------------------------------- PROFESSOR -------------------------------
  const prof = await navegador.newPage()
  conectar(prof, 'professor')
  await prof.setViewport({ width: 1440, height: 900 })
  await login(prof, 'carlos@escola.com', '123456')
  await abrirAvaliacaoPorPares(prof, 'professor')
  const corpoProf = await prof.evaluate(() => document.body.innerText)
  console.log('professor -> título ok:', corpoProf.includes('Avaliação por Pares'))
  console.log('professor -> botão "Novo período":', corpoProf.includes('Novo período'))
  console.log('professor -> aviso de confidencialidade:', corpoProf.includes('confidencial'))
  console.log('professor -> tabela de participação visível:', corpoProf.includes('Participação') || corpoProf.includes('participação'))
  await prof.screenshot({ path: 'tests/_smoke_professor.png' })

  // --------------------------------- ALUNO --------------------------------
  // Sessão do app vive só em memória: um novo load já volta ao login.
  // Bianca Ramos: conta real do ambiente, presente em equipe(s) do banco.
  const al = await navegador.newPage()
  conectar(al, 'aluno')
  await al.setViewport({ width: 390, height: 844 }) // baseline mobile 375+
  await login(al, 'bianca.ramos@escola.com', 'Mudar123')
  await abrirAvaliacaoPorPares(al, 'aluno')
  const corpoAl = await al.evaluate(() => document.body.innerText)
  console.log('aluno -> título ok:', corpoAl.includes('Avaliação por Pares'))
  console.log('aluno -> seção "Colegas do meu grupo":', corpoAl.includes('Colegas do meu grupo'))
  console.log('aluno -> sem botão "Novo período":', !corpoAl.includes('Novo período'))
  console.log('aluno -> alerta de banco (migração pendente):', /não foi possível|indisponível|erro/i.test(corpoAl))
  await al.screenshot({ path: 'tests/_smoke_aluno.png' })

  await al.close()
  await prof.close()
} catch (e) {
  registrar('execução', e.message)
} finally {
  if (navegador) await navegador.close()
  servidor.kill()
}

console.log('\n--- ERROS CAPTURADOS ---')
if (erros.length === 0) {
  console.log('NENHUM erro de JS na tela "Avaliação por Pares" (professor e aluno).')
} else {
  for (const e of erros) console.log('✖', e)
  process.exitCode = 1
}
