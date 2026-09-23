import { createClient } from '@supabase/supabase-js'
import { setSupabase, isUsingSupabase } from './dataService.js'

export const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || ''
export const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || ''

// VITE_DEMO_MODE=true força o uso de dados mockados, mesmo com Supabase configurado.
// DESATIVADO na versão final: a UI de login não expõe mais demo/teste de conexão.
export const DEMO_MODE = String(import.meta.env?.VITE_DEMO_MODE || '').toLowerCase() === 'true'

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null

export const isDemoForced = () => DEMO_MODE
// Versão final: Sempre que o Supabase estiver configurado, o app roda conectado.
export const isSupabaseDisponivel = () => !!supabase

// Ativa o dataService em modo Supabase se as variáveis de ambiente existirem.
export function setupSupabase() {
  if (isSupabaseDisponivel() && !isUsingSupabase()) {
    setSupabase(supabase)
    console.info('[dataService] Supabase ativado.')
  }
  return supabase
}

// Alterna explicitamente para o modo CONECTADO (dados reais via Supabase).
export function entrarModoConectado() {
  if (supabase) setSupabase(supabase)
  return !!supabase
}

// DESATIVADO (não usado na UI final): entrada em modo demonstração/mock.
export function entrarModoDemo() {
  console.warn('[supabaseClient] entrarModoDemo desativado na versão final.')
}

// DESATIVADO (não usado na UI final): teste de conexão da Fase 2.
export async function testarConexao() {
  return { ok: false, etapas: [{ nome: 'Teste de conexão', ok: false, detalhe: 'Desativado na versão final.' }] }
}
