# Configuração do Supabase

O site público ainda não foi alterado. Esta configuração atende somente ao painel em `admin/`.

## 1. Criar e configurar o projeto

1. Crie um projeto gratuito no Supabase.
2. Abra **SQL Editor**, cole todo o conteúdo de `setup.sql` e execute uma vez.
3. Em **Authentication > Providers > Email**, mantenha login por e-mail ativo.
4. Desative novos cadastros públicos em **Authentication > Settings**.
5. Em **Authentication > URL Configuration**, defina a URL publicada do site como `Site URL`.
6. Adicione às `Redirect URLs` a URL completa de `admin/nova-senha.html`.

Durante desenvolvimento local, adicione também a origem usada pelo servidor local, por exemplo:

```text
http://localhost:5500/**
```

Não abra os HTMLs diretamente com `file://`; use um servidor HTTP local.

## 2. Criar a conta administrativa

1. Em **Authentication > Users**, crie a usuária com o e-mail da cliente.
2. Copie o UUID da usuária ou autorize pelo e-mail no SQL Editor:

```sql
insert into public.admin_users (user_id)
select id from auth.users
where email = 'email-da-cliente@exemplo.com'
on conflict (user_id) do nothing;
```

Para autorizar também o desenvolvedor, repita com o segundo e-mail.

## 3. Conectar o frontend

Abra `js/supabase-client.js` e substitua:

```js
const SUPABASE_URL = "COLE_AQUI_A_URL_DO_SUPABASE";
const SUPABASE_PUBLISHABLE_KEY = "COLE_AQUI_A_CHAVE_PUBLICAVEL_DO_SUPABASE";
```

Use somente a chave **Publishable** (`sb_publishable_...`). A chave Secret e a antiga `service_role` nunca devem entrar nos arquivos do site.

## 4. Testar

Inicie um servidor local na raiz do projeto e acesse:

```text
http://localhost:PORTA/admin/
```

Cadastre inicialmente uma imagem descartável. As imagens atuais do site não são afetadas pelo painel.
