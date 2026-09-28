// =============================================================================
// OTIMIZAÇÃO DE IMAGENS (perfil e equipe)
// -----------------------------------------------------------------------------
// Regras do projeto:
//   * conversão para WebP (fallback para o formato nativo do navegador se ele
//     não souder gravar WebP — extensão/content-type acompanham o resultado);
//   * nome de arquivo = UUID (nada do nome/EXIF original trafega);
//   * limite do upload: FOTO 500 KB · LOGO 1 MB (imposto também no bucket);
//   * proporção fixa: 3:4 para usuário e 1:1 para equipe;
//   * otimização: corte centralizado (cover) -> redimensionamento sem ampliar
//     -> varredura de qualidade WebP -> redução de escala até caber no limite.
// =============================================================================

export const LIMITES = {
  foto: {
    maxKB: 500,
    largura: 720,
    altura: 960,
    proporcao: '3:4',
    bucket: 'avatares',
    rotulo: 'Foto de perfil'
  },
  logo: {
    maxKB: 1024,
    largura: 720,
    altura: 720,
    proporcao: '1:1',
    bucket: 'logos',
    rotulo: 'Logo da equipe'
  }
}

// Limite do arquivo ESCOLHIDO (antes da otimização) — só evita arquivos
// gigantes; o que realmente vai pro Storage respeita LIMITES[*].maxKB.
export const MAX_ORIGINAL_KB = 10 * 1024

const TIPOS_ACEITOS = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/gif', 'image/bmp', 'image/avif'
]

export function formatarKB(kb) {
  const valor = Number(kb)
  if (!Number.isFinite(valor)) return `${kb} KB`
  if (valor < 1024) return `${Math.round(valor)} KB`
  const mb = valor / 1024
  const texto = Number.isInteger(mb) ? String(mb) : mb.toFixed(1)
  return `${texto.replace('.', ',')} MB`
}

export function formatarBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

export function dicaUpload(tipo = 'foto') {
  const cfg = LIMITES[tipo]
  return `JPG, PNG ou WebP · até ${formatarKB(MAX_ORIGINAL_KB)} · vira WebP e é otimizada para no máximo ${formatarKB(cfg.maxKB)} · proporção ${cfg.proporcao}`
}

export function validarArquivo(file, tipo = 'foto') {
  const cfg = LIMITES[tipo] || LIMITES.foto
  if (!file) throw new Error('Selecione uma imagem.')
  if (file.size === 0) throw new Error('O arquivo está vazio.')
  if (!TIPOS_ACEITOS.includes(file.type)) {
    throw new Error('Formato não suportado. Use uma imagem JPG, PNG ou WebP.')
  }
  if (file.size > MAX_ORIGINAL_KB * 1024) {
    throw new Error(`A imagem escolhida é grande demais (máximo ${formatarKB(MAX_ORIGINAL_KB)}). Escolha um arquivo menor.`)
  }
  if (cfg.maxKB <= 0) throw new Error('Configuração de imagem inválida.')
  return true
}

function gerarUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

async function carregarImagem(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch { /* segue para as tentativas abaixo */ }
    try {
      return await createImageBitmap(file)
    } catch { /* segue para o <img> */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a imagem escolhida.')) }
    img.src = url
  })
}

// Corte centralizado na proporção de destino (cover) + redimensionamento.
// escala < 1 é usada nas rodadas de retry quando não coube no limite de KB.
function cortarERedimensionar(fonte, cfg, escala) {
  const fw = fonte.width
  const fh = fonte.height
  const alvo = cfg.largura / cfg.altura

  let sw, sh, sx, sy
  if (fw / fh > alvo) {
    sh = fh
    sw = fh * alvo
    sx = (fw - sw) / 2
    sy = 0
  } else {
    sw = fw
    sh = fw / alvo
    sx = 0
    sy = (fh - sh) / 2
  }

  // nunca amplia além do arquivo original
  const fator = Math.min(cfg.largura / sw, cfg.altura / sh, 1)
  const dw = Math.max(1, Math.round(sw * fator * escala))
  const dh = Math.max(1, Math.round(sh * fator * escala))

  const canvas = document.createElement('canvas')
  canvas.width = dw
  canvas.height = dh
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(fonte, sx, sy, sw, sh, 0, 0, dw, dh)
  return canvas
}

function paraBlob(canvas, qualidade) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível converter a imagem.'))),
        'image/webp',
        qualidade
      )
    } catch (e) {
      reject(e)
    }
  })
}

function extensaoDe(contentType) {
  if (contentType === 'image/webp') return 'webp'
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/gif') return 'gif'
  return 'jpg'
}

/**
 * Converte, corta na proporção, comprime e renomeia com UUID.
 * @param {File} arquivo imagem escolhida pelo usuário
 * @param {'foto'|'logo'} tipo foto (3:4, 500 KB) ou logo (1:1, 1 MB)
 * @returns {Promise<{blob: Blob, nome: string, contentType: string, largura: number, altura: number, bytes: number}>}
 */
export async function otimizarImagem(arquivo, tipo = 'foto') {
  validarArquivo(arquivo, tipo)
  const cfg = LIMITES[tipo] || LIMITES.foto
  const maxBytes = cfg.maxKB * 1024
  const fonte = await carregarImagem(arquivo)

  let escala = 1
  let qualidade = 0.92
  let canvas = null
  let blob = null

  try {
    for (let rodada = 0; rodada < 5; rodada++) {
      canvas = cortarERedimensionar(fonte, cfg, escala)
      qualidade = rodada === 0 ? 0.92 : Math.max(0.5, 0.9 - rodada * 0.1)

      // varredura de qualidade dentro da mesma dimensão
      // eslint-disable-next-line no-constant-condition
      while (true) {
        blob = await paraBlob(canvas, qualidade)
        if (blob.size <= maxBytes || qualidade <= 0.42) break
        qualidade = Math.max(0.4, qualidade - 0.1)
      }

      if (blob.size <= maxBytes) break
      escala *= 0.8 // não coube: reduz as dimensões e tenta de novo
    }
  } finally {
    if (typeof fonte.close === 'function') fonte.close()
  }

  if (!blob || blob.size > maxBytes) {
    throw new Error(`Não foi possível deixar a imagem dentro de ${formatarKB(cfg.maxKB)}. Escolha um arquivo menor.`)
  }

  const contentType = blob.type || 'image/webp'
  if (contentType !== 'image/webp') {
    console.warn('[imageService] navegador não gravou WebP; usando', contentType)
  }

  return {
    blob,
    nome: `${gerarUuid()}.${extensaoDe(contentType)}`, // renomeia com UUID
    contentType,
    largura: canvas.width,
    altura: canvas.height,
    bytes: blob.size
  }
}
