# Ametista Conversões — guia do projeto

## O que é
Plataforma SaaS de gestão para agências de marketing de performance. Dois portais:
- **Portal do Cliente**: visualização (dashboard, performance, relatórios, projeto, tarefas, arquivos, comentários, reuniões, IA, configurações)
- **Portal do Gestor**: operação (dashboard executivo, clientes, kanban, workflows, incidentes, ativos digitais, alertas, timeline, metas SMART, onboarding)

Filosofia: centralizar a operação, não substituir ferramentas que já existem (não é um CRM, não é uma plataforma de automação de marketing).

## Stack obrigatório — não trocar sem perguntar antes
- Frontend: React 18 + TypeScript + Vite
- Estilo: Tailwind CSS + shadcn/ui (Radix UI)
- Rotas: React Router DOM 7
- Dados/cache: TanStack Query
- Gráficos: Recharts
- Ícones: lucide-react (exclusivamente)
- Formulários: react-hook-form + zod
- Backend: Supabase (Postgres + Auth + Storage + Edge Functions), Row Level Security habilitado em todas as tabelas
- Testes: Vitest (unitário) + Playwright (end-to-end)
- Datas: date-fns

## Design system (tema escuro permanente — sem toggle de tema)

| Token | HSL | Hex | Uso |
|---|---|---|---|
| background | 215 50% 8% | #0B1220 | fundo principal |
| card | 220 40% 13% | #131C31 | cards e painéis |
| secondary | 220 30% 17% | #1A2540 | hover, bordas, inputs |
| primary | 263 70% 58% | #7C3AED | roxo principal (ações) |
| foreground | 0 0% 100% | #FFFFFF | texto principal |
| muted-foreground | 215 20% 65% | slate-400 | texto secundário |
| destructive | 0 84% 60% | vermelho | erros, emergência |

- Fonte: Inter, pesos 300–800
- Cantos: `--radius: 0.75rem`
- Cards padrão: `bg-[#131C31] rounded-xl border border-[#1A2540] p-5 md:p-6 hover:border-purple-600/30`
- Botões ativos: `bg-purple-600/15 text-purple-400 border border-purple-600/20`
- Badges de status: cor semântica com opacidade 10% (ex: `bg-emerald-500/10 text-emerald-400`)
- Scrollbar customizada: trilha `#0B1220`, thumb `#1A2540`, hover roxo
- Layout: Sidebar fixa (desktop) / drawer (mobile) + TopBar sticky + main com padding responsivo

## Estrutura de rotas

```
Públicas: /login, /register, /forgot-password, /reset-password
Portal cliente: /, /project, /tasks, /files, /comments, /meetings, /cassie, /reports, /settings
Portal gestor: /admin, /clients, /kanban, /workflows, /incidents, /assets, /alerts, /timeline, /smart-goals, /onboarding
```

## RBAC (papéis e permissões)

- **admin**: acesso total, incluindo configurações globais
- **gestor**: operação diária (clientes, projetos, tarefas, incidentes, workflows)
- **cliente**: portal do cliente + ações limitadas

Regra: rotas do Portal do Gestor usam `RoleRoute` com `allowedRoles={["admin","gestor"]}`. Se um usuário `cliente` tentar acessar uma rota restrita, ele é redirecionado para `/` com um toast "Acesso Negado".

## Entidades principais (Fase 3)

| Entidade | Campos-chave |
|---|---|
| Project | title, client_id, status, health_score, cpa/roas/ctr/spend/revenue, channel, start_date, end_date |
| Task | title, client_id, project_id, status (backlog/todo/in_progress/review/done), priority, due_date, category |
| Client | name, company, email, status (active/onboarding/paused/churned), plan, monthly_fee, health_score |
| OnboardingStep | title, client_id, project_id, completed, order, category |
| SmartGoal | title, client_id, metric_type, target_value, current_value, period, status |
| FileItem | name, client_id, folder, file_url, file_type, status (pending/approved/rejected/revision_requested) |
| Approval | title, client_id, file_url, file_type, status, feedback |
| Incident | title, client_id, severity, status, category, resolution |
| Alert | title, message, client_id, severity, category, resolved |
| DigitalAsset | name, type (business_manager/ad_account/pixel/domain/...), client_id, platform, status |
| Meeting | title, client_id, date, meeting_link, status |
| Comment | content, entity_type, entity_id, client_id, author_role |
| AuditLog | action, entity_type, entity_id, client_id, severity |
| FeatureFlag | key, label, enabled, scope (global/agency/client/user) |
| Organization | name, plan, status, domain |
| User | full_name, email, role (admin/gestor/cliente) |

Todas as entidades incluem `id`, `created_date`, `updated_date`. Todas as tabelas com `client_id` precisam de Row Level Security garantindo que um cliente só veja seus próprios dados.

## Convenções de código

- Componentes em PascalCase, arquivos `.tsx`
- Um componente por arquivo
- Sempre usar os tokens de cor do design system acima — nunca cor hardcoded fora da paleta
- Perguntar antes de instalar qualquer dependência não listada no stack obrigatório
- Commits pequenos e descritivos, um por funcionalidade concluída
