-- floow CRM — 047: Materiais e mídias (depoimentos, vídeos, PDFs, links) do time.
-- Rodar no SQL Editor. Idempotente.
--
-- Estrutura da seção "Materiais e mídias". A tela/UX vem depois; aqui já fica a
-- tabela + o bucket de storage prontos. LEITURA: todo autenticado. ESCRITA: admin.

create table if not exists materiais (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  tipo text,                 -- 'video' | 'imagem' | 'pdf' | 'audio' | 'link' | 'depoimento'
  url text,                  -- link externo OU arquivo no bucket 'materiais'
  categoria text,            -- agrupamento (ex: 'Depoimentos', 'Provas sociais')
  ordem int not null default 0,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists materiais_categoria_ordem_idx on materiais (categoria, ordem);

create or replace function set_materiais_updated_at() returns trigger as $$
begin new.updated_at := now(); return new; end;
$$ language plpgsql;
drop trigger if exists trg_materiais_updated_at on materiais;
create trigger trg_materiais_updated_at before update on materiais
  for each row execute function set_materiais_updated_at();

alter table materiais enable row level security;
drop policy if exists "auth read materiais" on materiais;
create policy "auth read materiais" on materiais for select using (auth.role() = 'authenticated');
drop policy if exists "admin write materiais" on materiais;
create policy "admin write materiais" on materiais for all
  using (app_is_admin()) with check (app_is_admin());

alter table materiais replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'materiais'
  ) then
    alter publication supabase_realtime add table materiais;
  end if;
end $$;

-- Bucket público pros arquivos (o time abre/baixa por URL; upload só admin).
insert into storage.buckets (id, name, public)
values ('materiais', 'materiais', true)
on conflict (id) do nothing;

drop policy if exists "public read materiais bucket" on storage.objects;
create policy "public read materiais bucket" on storage.objects
  for select using (bucket_id = 'materiais');

drop policy if exists "admin write materiais bucket" on storage.objects;
create policy "admin write materiais bucket" on storage.objects
  for all to authenticated
  using (bucket_id = 'materiais' and app_is_admin())
  with check (bucket_id = 'materiais' and app_is_admin());
