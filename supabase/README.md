# Configuração do Supabase

O site público ainda não foi alterado. Esta configuração atende somente ao painel em `admin/`.

## 1. Aplicar a estrutura do banco

Com o projeto correto vinculado pelo Supabase CLI, revise a migration em
`supabase/migrations/` e execute:

```powershell
supabase db push
```

Esse comando cria duas tabelas (`admin_users` e `galeria`), o bucket público
`galeria` e as políticas de acesso. A migration deve ser aplicada apenas depois
de conferir o projeto vinculado em `supabase/.temp/project-ref`.

## 2. Configurar autenticação

1. Em **Authentication > Providers > Email**, mantenha login por e-mail ativo.
2. Desative novos cadastros públicos em **Authentication > Settings**.
3. Em **Authentication > URL Configuration**, defina a URL publicada do site como `Site URL`.

Durante o desenvolvimento, use um servidor local, por exemplo:

```text
http://localhost:5500/admin/
```

Não abra os HTMLs diretamente com `file://`; use um servidor HTTP local.

## 3. Criar a conta administrativa

1. Em **Authentication > Users**, crie a usuária com o e-mail da cliente.
2. Copie o UUID da usuária ou autorize pelo e-mail no SQL Editor:

```sql
insert into public.admin_users (user_id)
select id from auth.users
where email = 'email-da-cliente@exemplo.com'
on conflict (user_id) do nothing;
```

Para autorizar também o desenvolvedor, repita com o segundo e-mail.

## 4. Conectar o frontend

O arquivo `js/supabase-client.js` contém a URL e a chave publicável do projeto:

```js
const SUPABASE_URL = "https://PROJECT_REF.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_...";
```

Use somente a chave **Publishable** (`sb_publishable_...`). A chave Secret e a antiga `service_role` nunca devem entrar nos arquivos do site.

## 5. Testar

Inicie um servidor local na raiz do projeto e acesse:

```text
http://localhost:PORTA/admin/
```

Cadastre inicialmente uma imagem descartável. As imagens atuais do site não são afetadas pelo painel.
