# floow CRM — Extensão WhatsApp (Fase 4, MVP)

Painel do floow CRM por cima do **WhatsApp Web**: ao abrir uma conversa, mostra o
lead correspondente, deixa **mudar a etapa** do funil e editar **observações**, e
isso vai pro app **em tempo real** (mesmo Supabase + Realtime).

## Como instalar (modo desenvolvedor — não precisa da Chrome Web Store)

1. Abra `chrome://extensions` no Chrome.
2. Ligue o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e selecione a pasta
   `whatsapp-extension/dist`.
4. Abra/atualize o `https://web.whatsapp.com`. Um botão amarelo **floow**
   aparece no canto inferior direito — clique pra abrir o painel.
5. Faça login com o **mesmo e-mail/senha do app** (a sessão fica salva).

## Como usar

- Abra uma conversa: o painel tenta vincular o lead **pelo telefone** (contato não
  salvo) ou **pelo nome**. Se não achar, use o **buscar** pra escolher manualmente.
- **Mover para**: muda a etapa na hora. Só aparecem etapas que não precisam de dados
  extras (Entrada, Qualificado, Em agendamento, Follow-up, Carteira, Sem resposta).
  Reunião agendada, ganho/perdido e desqualificar continuam **no app** (pedem
  closer/data, motivo ou código do criativo).
- **Observações**: edite e clique em salvar.
- A bolinha ao lado de "floow CRM" fica **verde** quando o realtime está conectado.

## Rebuild (quando mudar o código ou o funil)

```bash
cd whatsapp-extension
npm install      # primeira vez
npm run build
```

As credenciais são lidas do `../.env.local` (chave pública/anon, protegida por RLS)
e embutidas no `dist/`. Depois do build, clique em **Atualizar** na extensão em
`chrome://extensions`.

## Limitações conhecidas (MVP)

- O HTML do WhatsApp Web é ofuscado e muda às vezes — se o vínculo automático
  parar de funcionar, a **busca manual** continua resolvendo, e é só ajustar o
  seletor em `src/whatsapp.ts`.
- As permissões respeitam o papel do usuário (RLS): o SDR não move pra etapas do
  Closer.
