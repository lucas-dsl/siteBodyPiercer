-- Única conta administrativa do site.
create table public.admin_users (
    user_id uuid primary key references auth.users(id) on delete cascade
);

-- Fotos e informações exibidas nas galerias públicas.
create table public.galeria (
    id bigint generated always as identity primary key,
    arquivo_id uuid not null unique,
    categoria text not null check (
        categoria in (
            'joia_titanio',
            'joia_gold',
            'perfuracao_orelha',
            'perfuracao_outras'
        )
    ),
    titulo varchar(100) not null,
    descricao varchar(500),
    ordem smallint not null default 0 check (ordem between 0 and 9999),
    ativo boolean not null default true,
    created_at timestamptz not null default now()
);

create index galeria_listagem_idx
    on public.galeria (categoria, ativo, ordem);

alter table public.admin_users enable row level security;
alter table public.galeria enable row level security;

-- A usuária autenticada pode confirmar se possui acesso administrativo.
create policy "admin_confirma_proprio_acesso"
on public.admin_users
for select
to authenticated
using (user_id = (select auth.uid()));

-- Visitantes sem login enxergam somente itens publicados.
create policy "publico_le_publicados"
on public.galeria
for select
to anon
using (ativo = true);

-- Apenas quem está em admin_users pode gerenciar a galeria.
create policy "admin_gerencia_galeria"
on public.galeria
for all
to authenticated
using (
    (select auth.uid()) in (select user_id from public.admin_users)
)
with check (
    (select auth.uid()) in (select user_id from public.admin_users)
);

grant select on public.admin_users to authenticated;
grant select on public.galeria to anon, authenticated;
grant insert, update, delete on public.galeria to authenticated;
grant usage, select on sequence public.galeria_id_seq to authenticated;

-- As imagens são públicas, mas somente a administradora pode modificá-las.
insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'galeria',
    'galeria',
    true,
    1048576,
    array['image/webp']
);

create policy "admin_gerencia_arquivos"
on storage.objects
for all
to authenticated
using (
    bucket_id = 'galeria'
    and (select auth.uid()) in (select user_id from public.admin_users)
)
with check (
    bucket_id = 'galeria'
    and (storage.foldername(name))[1] in ('imagens', 'miniaturas')
    and (select auth.uid()) in (select user_id from public.admin_users)
);
