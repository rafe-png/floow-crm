-- floow CRM — 032: produto ofertado ao lead (parte da qualificação).
-- Valores: 'aceleracao' | 'floow_insta' | 'floow_catalogo'. Texto livre validado
-- no client (segue o padrão de `fonte`, sem enum no banco pra facilitar adicionar
-- novos produtos depois). Cada produto tem um valor sugerido no client
-- (PRODUTO_VALORES) que pré-preenche `leads.valor` — editável depois. Idempotente.

alter table leads add column if not exists produto text;
