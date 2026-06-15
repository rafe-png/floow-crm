-- floow CRM — 021: origem do lead (de onde ele entrou no CRM)
-- Rodar no SQL Editor. Idempotente.
--
-- 'manual'   = cadastrado na mão no CRM
-- 'whatsapp' = entrou automático pela integração do WhatsApp (anúncio → conversa)
-- Usado nos relatórios pra saber quantos leads/vendas vieram dos anúncios.

alter table leads add column if not exists origem text;
