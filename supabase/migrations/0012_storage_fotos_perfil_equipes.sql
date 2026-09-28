-- =============================================================================
-- EDUPROJECT AGILE - MIGRACAO 0012: STORAGE DE FOTOS DE PERFIL E LOGOS
-- -----------------------------------------------------------------------------
-- O aluno deixa de colar uma URL: ele ENVIA uma imagem do computador. O app
-- (src/services/imageService.js) converte para WebP, corta na proporcao,
-- comprime e renomeia com UUID antes do upload. Este script prepara o Supabase:
--
--   Bucket "avatares" -> foto de perfil (3:4, limite 500 KB)
--   Bucket "logos"    -> logo de equipe (1:1, limite 1 MB)
--
-- Caminho dos arquivos: <pasta>/<uuid>.webp
--   * avatares: pasta = id do usuario;
--   * logos:    pasta = id da equipe (equipe nova: id de quem criou).
-- As policies usam a pasta para o controle de quem pode enviar/apagar:
--   * avatares: o dono (pasta = auth.uid) OU professor/gestor (moderacao de
--     imagem impr-opria);
--   * logos:    professor/gestor OU dono da pasta OU membro da equipe.
--
-- COMO APLICAR: rodar este arquivo INTEIRO no SQL Editor do Supabase.
-- =============================================================================

-- 1) Buckets (publicos: as imagens aparecem em <img src> pela URL) ----------
do $$
begin
  begin
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values
      ('avatares', 'avatares', true, 512000,  array['image/webp','image/png','image/jpeg']),
      ('logos',    'logos',    true, 1048576, array['image/webp','image/png','image/jpeg'])
    on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  exception when others then
    raise notice 'Nao foi possivel criar os buckets via SQL (%). Crie-os no Dashboard > Storage com: avatares (publico, 500 KB) e logos (publico, 1 MB). Detalhe: %', sqlerrm, sqlerrm;
  end;
end $$;

-- Confirmacao dos limites (500 KB / 1 MB em bytes)
select id, public, file_size_limit, allowed_mime_types
  from storage.buckets
 where id in ('avatares', 'logos')
 order by id;

-- 2) Policies de leitura (imagens publicas) --------------------------------
drop policy if exists "midias_select_publica" on storage.objects;
create policy "midias_select_publica" on storage.objects
  for select to public
  using (bucket_id in ('avatares', 'logos'));

-- 3) Policies de ENVIO ------------------------------------------------------
-- Formato: o app sempre envia .webp (aceita .png/.jpg como fallback de
-- navegadores antigos). Tamanho: imposto pelo file_size_limit do bucket.
drop policy if exists "avatares_insert_auth" on storage.objects;
create policy "avatares_insert_auth" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatares'
    and (
      lower(name) like '%.webp'
      or lower(name) like '%.png'
      or lower(name) like '%.jpg'
    )
    and (
      coalesce((storage.foldername(name))[1], '') = auth.uid()::text
      or public.is_professor()
    )
  );

drop policy if exists "logos_insert_auth" on storage.objects;
create policy "logos_insert_auth" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (
      lower(name) like '%.webp'
      or lower(name) like '%.png'
      or lower(name) like '%.jpg'
    )
    and (
      public.is_professor()
      or coalesce((storage.foldername(name))[1], '') = auth.uid()::text
      or exists (
        select 1 from public.equipe_membros em
         where em.aluno_id = auth.uid()
           and em.equipe_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- 4) Policies de SUBSTITUICAO (upload com upsert: true) ---------------------
drop policy if exists "avatares_update_auth" on storage.objects;
create policy "avatares_update_auth" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatares'
    and (
      coalesce((storage.foldername(name))[1], '') = auth.uid()::text
      or public.is_professor()
    )
  )
  with check (
    bucket_id = 'avatares'
    and (
      coalesce((storage.foldername(name))[1], '') = auth.uid()::text
      or public.is_professor()
    )
  );

drop policy if exists "logos_update_auth" on storage.objects;
create policy "logos_update_auth" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and (
      public.is_professor()
      or coalesce((storage.foldername(name))[1], '') = auth.uid()::text
      or exists (
        select 1 from public.equipe_membros em
         where em.aluno_id = auth.uid()
           and em.equipe_id::text = (storage.foldername(name))[1]
      )
    )
  )
  with check (
    bucket_id = 'logos'
    and (
      public.is_professor()
      or coalesce((storage.foldername(name))[1], '') = auth.uid()::text
      or exists (
        select 1 from public.equipe_membros em
         where em.aluno_id = auth.uid()
           and em.equipe_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- 5) Policies de REMOCAO (trocar/apagar foto impr-opria) --------------------
drop policy if exists "avatares_delete_auth" on storage.objects;
create policy "avatares_delete_auth" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatares'
    and (
      coalesce((storage.foldername(name))[1], '') = auth.uid()::text
      or public.is_professor()
    )
  );

drop policy if exists "logos_delete_auth" on storage.objects;
create policy "logos_delete_auth" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and (
      public.is_professor()
      or coalesce((storage.foldername(name))[1], '') = auth.uid()::text
      or exists (
        select 1 from public.equipe_membros em
         where em.aluno_id = auth.uid()
           and em.equipe_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- 6) Verificacao ------------------------------------------------------------
select policyname, cmd
  from pg_policies
 where schemaname = 'storage'
   and tablename = 'objects'
   and (policyname like '%avatares%' or policyname like '%logos%' or policyname = 'midias_select_publica')
 order by policyname;
