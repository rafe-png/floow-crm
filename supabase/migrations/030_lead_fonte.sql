-- floow CRM — 030: fonte de marketing do lead (exibida/selecionável no card).
-- Valores: 'meta_ads' | 'indicacao' | 'outbound' | 'outro'. Texto livre validado no
-- client (sem enum no banco pra facilitar adicionar novas fontes depois). Idempotente.
--
-- Não confundir com `origem` ('manual'|'whatsapp'), que é controle interno de
-- entrada/roteamento. `fonte` é o canal de marketing.

alter table leads add column if not exists fonte text;

-- Backfill: tudo que entrou pela automação do WhatsApp veio do anúncio (Meta Ads).
update leads set fonte = 'meta_ads' where origem = 'whatsapp' and fonte is null;
