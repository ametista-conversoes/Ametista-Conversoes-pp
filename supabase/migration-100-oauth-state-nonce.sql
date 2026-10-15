-- Ametista Conversões — endurece o "state" do OAuth (Google/Meta). Até
-- aqui o "state" era o próprio connection_id (ou agency_provider_connection_id)
-- — um UUID v4 (122 bits, já imprevisível por força bruta), mas um
-- identificador PERMANENTE que nunca expira e nunca é invalidado. Se um
-- connection_id algum dia aparecer em algum lugar que não devia (log,
-- vazamento futuro), ele continua servindo de "state" válido pra sempre.
-- Troca pra um nonce dedicado: aleatório, de uso único, que expira em
-- poucos minutos e é zerado assim que o callback usa — mesmo recurso,
-- mas sem a superfície de um identificador permanente fazendo esse papel.

alter table public.digital_asset_connections
  add column oauth_state_nonce text,
  add column oauth_state_expires_at timestamptz;

alter table public.agency_provider_connections
  add column oauth_state_nonce text,
  add column oauth_state_expires_at timestamptz;

-- Busca pelo nonce no /callback é o caminho quente (toda troca de OAuth
-- passa por aqui) — índice parcial, só nas linhas com nonce pendente.
create unique index if not exists digital_asset_connections_oauth_state_nonce_idx
  on public.digital_asset_connections(oauth_state_nonce)
  where oauth_state_nonce is not null;

create unique index if not exists agency_provider_connections_oauth_state_nonce_idx
  on public.agency_provider_connections(oauth_state_nonce)
  where oauth_state_nonce is not null;
