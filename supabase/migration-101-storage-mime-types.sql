-- Ametista Conversões — restringe tipo de arquivo (MIME) nos buckets de
-- Storage que só servem imagem por desenho (logo do cliente, avatar do
-- usuário). Até aqui só existia `accept="image/*"` no <input> do
-- navegador — filtro de interface, trivial de burlar (DevTools, curl
-- direto no endpoint do Storage). `allowed_mime_types` é aplicado pelo
-- próprio Supabase Storage no upload, não depende do front-end.
--
-- `client-files` fica DE FORA de propósito: é privado (só acessível
-- via URL assinada pra quem já tem permissão — nunca fica hospedado
-- publicamente), e o próprio app foi desenhado pra aceitar qualquer
-- tipo de arquivo ali (categoria "Outros" em `src/lib/file-category.ts`
-- é resultado esperado, não erro — cliente de agência sobe PSD, ZIP,
-- etc.). Restringir esse bucket quebraria uso real do produto pra
-- fechar um risco que já é baixo (não é público, não pode virar link
-- de phishing hospedado).

update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id in ('client-logos', 'user-avatars');
