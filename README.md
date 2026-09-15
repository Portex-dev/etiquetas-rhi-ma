# Etiquetas RHI MA

Aplicação web responsiva para registrar etiquetas por equipamento, consultar registros sob autenticação, alternar entre **Novo** e **Visto**, exportar resultados filtrados e imprimir QR Codes.

## Estrutura

- `index.html`, `styles.css` e `app.js`: site estático compatível com GitHub Pages.
- `config.js`: configuração pública do projeto; nunca coloque uma chave `service_role` neste arquivo.
- `supabase/schema.sql`: tabelas, índices e políticas de acesso.
- `supabase/functions/create-label`: recebimento público protegido pelo Turnstile.
- `supabase/functions/purge-trash`: exclusão definitiva após 30 dias.

## Preparação para publicar

1. Crie um projeto gratuito no Supabase e execute `supabase/schema.sql` no SQL Editor.
2. Em Authentication, crie o usuário administrativo compartilhado com e-mail e senha.
3. Publique as duas Edge Functions. Configure `TURNSTILE_SECRET_KEY` e `RATE_LIMIT_SECRET` na função de registro e `CRON_SECRET` na limpeza da lixeira.
4. Crie gratuitamente um widget Cloudflare Turnstile para o domínio do GitHub Pages.
5. Copie os valores públicos para `config.js`: URL do Supabase, chave publicável/anon, site key do Turnstile e endereço público do site.
6. Suba estes arquivos para um repositório público e ative GitHub Pages na raiz da branch principal.
7. Agende `purge-trash` uma vez por dia, enviando `Authorization: Bearer <CRON_SECRET>`.

## Segurança

O navegador usa somente credenciais públicas. A função de registro valida os campos e o Turnstile antes de gravar. As políticas RLS impedem visitantes anônimos de ler os registros e fotos; apenas a conta administrativa autenticada pode consultar e alterar dados.
