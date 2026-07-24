# SD Dialer - Plataforma de CRM Comercial

> Uma plataforma profissional de CRM para gestão comercial e distribuição de leads, desenvolvida com Next.js 16, TypeScript, Supabase e TailwindCSS.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![Next.js](https://img.shields.io/badge/next.js-16-black.svg)

## Visão Geral

SD Dialer é uma solução completa para equipas de vendas gerenciarem leads e realizar chamadas de forma eficiente. A plataforma foi desenvolvida com foco em:

- **Multiempresa**: Suporte completo para múltiplas empresas com isolamento de dados
- **PWA**: Instalável em Android, Windows e Tablet
- **Real-time**: Dashboards com dados em tempo real
- **Segurança**: Row Level Security (RLS) no banco de dados
- **Escalabilidade**: Arquitetura preparada para futuras expansões

## Funcionalidades Principais

### 1. Autenticação & Controle de Acesso
- Login com email e password (Supabase Auth nativa)
- Três perfis de utilizador: Admin, Supervisor, Comercial
- Gestão de sessão segura com RLS

### 2. Dashboard Admin
- Visualização em tempo real de métricas
- Número de comerciais online
- Contagem de leads e leads por contactar
- Chamadas efetuadas e tempo total
- Taxa de conversão
- Objetivos de vendas
- Gráficos interativos e relatórios PDF

### 3. Gestão de Utilizadores
- CRUD completo (criar, editar, eliminar, ativar/desativar)
- Organização por equipas
- Atribuição de supervisores
- Gestão de perfis

### 4. Campanhas de Venda
- Criação de campanhas (ex: DIGI, Energia, Solar, Seguros)
- Configuração de período (data início/fim)
- Estados: Draft, Active, Paused, Completed

### 5. Leads & Importação
- Importação de ficheiros Excel e CSV
- Mapeamento automático de campos
- Deduplicação de leads
- Estados: New, Contacted, Sold, Not Interested, Follow-up, Other

### 6. Distribuição de Leads
- **Manual**: Atribui leads manualmente
- **Automática**: Round-robin entre comerciais
- **Por Equipa**: Distribui para toda a equipa
- **Por Percentagem**: Controla percentagem para cada comercial

### 7. Área do Comercial
- Visualização de leads atribuídos
- Pesquisa e filtros avançados
- Botão "Ligar" (tel: protocol)
- Integração WhatsApp
- Google Maps para localização
- Cronómetro com rastreamento (localStorage + Service Worker)

### 8. Resultado de Chamadas
- Múltiplos resultados: Venda, Não interessado, Não atende, Número errado, Ligar depois, Cliente aderiu, Sem cobertura, Outro
- Notas e observações
- Gravação automática de histórico

### 9. Follow-ups
- Agendamento de follow-ups
- Notificações internas
- Gestão de follow-ups pendentes

### 10. Relatórios & Analytics
- Chamadas por comercial
- Tempo médio de chamada
- Taxa de conversão
- Ranking de comerciais
- Vendas e conversões
- Gráficos diários, semanais, mensais
- Export para PDF

### 11. PWA
- Instalável em Android, Windows, Tablet
- Funciona offline (com Service Worker)
- Sincronização automática
- Ícones customizados
- Manifest.json configurado

## Stack Tecnológico

```
Frontend:
- Next.js 16 (App Router)
- React 19
- TypeScript
- TailwindCSS v4
- SWR (data fetching)

Backend:
- Supabase PostgreSQL
- Supabase Auth (nativa)
- Row Level Security (RLS)

Integrações:
- Recharts (gráficos)
- jsPDF (relatórios PDF)
- XLSX (importação Excel)
- PapaParse (importação CSV)
- Zod (validação)
- next-pwa (PWA)

Deploy:
- Vercel (recomendado)
```

## Estrutura de Pastas

```
sd-dialer/
├── app/
│   ├── (auth)/               # Layouts de autenticação
│   │   ├── callback/
│   │   ├── login/
│   │   └── signup/
│   ├── (dashboard)/          # Layouts do dashboard
│   │   ├── admin/            # Dashboard admin
│   │   ├── supervisor/       # Dashboard supervisor
│   │   └── comercial/        # Area do comercial
│   ├── api/                  # API routes
│   │   ├── auth/
│   │   ├── leads/
│   │   ├── usuarios/
│   │   ├── campanhas/
│   │   ├── historico/
│   │   └── relatorios/
│   ├── globals.css           # Estilos globais
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Página raiz (redirect)
├── components/
│   ├── auth/                 # Componentes de auth
│   ├── layout/               # Componentes de layout
│   ├── dashboard/            # Componentes do dashboard
│   ├── leads/                # Componentes de leads
│   ├── usuarios/             # Componentes de usuarios
│   ├── campanhas/            # Componentes de campanhas
│   ├── importacao/           # Componentes de importação
│   ├── distribuicao/         # Componentes de distribuição
│   ├── relatorios/           # Componentes de relatórios
│   ├── timer/                # Componentes do cronómetro
│   ├── notifications/        # Notificações
│   └── common/               # Componentes reutilizáveis
├── lib/
│   ├── supabase/            # Clientes Supabase
│   │   ├── client.ts        # Cliente browser
│   │   ├── server.ts        # Cliente server
│   │   └── proxy.ts         # Proxy de sessão
│   ├── services/            # Serviços de dados
│   │   ├── auth.service.ts
│   │   ├── leads.service.ts
│   │   ├── campanhas.service.ts
│   │   ├── callHistory.service.ts
│   │   ├── followUp.service.ts
│   │   ├── distribution.service.ts
│   │   ├── notifications.service.ts
│   │   ├── reports.service.ts
│   │   └── index.ts
│   ├── hooks/               # React hooks customizados
│   │   └── useAuth.ts
│   ├── types/               # TypeScript types
│   │   └── index.ts
│   └── utils/               # Utilitários
│       ├── constants.ts
│       ├── validators.ts
│       ├── formatters.ts
│       └── calculations.ts
├── middleware.ts            # Next.js middleware
├── public/
│   ├── icons/              # PWA icons
│   └── manifest.json       # PWA manifest
├── supabase/
│   └── migrations/         # Database migrations
├── .env.example            # Exemplo de variáveis de ambiente
├── next.config.mjs         # Configuração Next.js com PWA
├── tailwind.config.ts      # Configuração TailwindCSS
├── tsconfig.json           # Configuração TypeScript
└── README.md               # Este ficheiro
```

## Instalação & Setup

### Pré-requisitos

- Node.js >= 18.0.0
- pnpm (recomendado) ou npm
- Conta Supabase

### 1. Clone o Repositório

```bash
git clone https://github.com/seu-repo/sd-dialer.git
cd sd-dialer
```

### 2. Instale as Dependências

```bash
pnpm install
```

### 3. Configure as Variáveis de Ambiente

Copie o ficheiro `.env.example` para `.env.local`:

```bash
cp .env.example .env.local
```

Preencha as variáveis Supabase:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Para development/preview (deixe em branco em produção)
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=
```

### 4. Configure o Supabase

A aplicação inclui migrations automáticas. O schema foi criado com:
- 11 tabelas principais
- Row Level Security (RLS) em todas as tabelas
- Índices para performance
- Tipos customizados

### 5. Inicie o Servidor de Development

```bash
pnpm dev
```

Aceda a `http://localhost:3000` no browser.

## Autenticação

### Primeiro Acesso

1. Visite `/auth/signup` para criar uma conta
2. Crie uma empresa e uma conta de admin
3. Verifique o email (se configurado em produção)
4. Faça login com suas credenciais

### Perfis de Utilizador

- **Admin**: Acesso total - Dashboard, Usuarios, Campanhas, Relatórios, Distribuição
- **Supervisor**: Gestão de equipa - Visualiza apenas sua equipa
- **Comercial**: Acesso limitado - Visualiza seus leads e pode fazer chamadas

## Fluxo de Leads

```
1. Importação Excel/CSV
   ↓
2. Deduplicação automática
   ↓
3. Distribuição (manual/automática/equipa/percentagem)
   ↓
4. Atribuição aos comerciais
   ↓
5. Comercial visualiza lead
   ↓
6. Clica em "Ligar" → Abre tel: protocol
   ↓
7. Cronómetro rastreia duração (localStorage + Service Worker)
   ↓
8. Preenchimento de resultado
   ↓
9. Histórico gravado automaticamente
   ↓
10. Follow-ups agendados (opcional)
```

## Cronómetro PWA

O cronómetro funciona mesmo quando o utilizador sai da app:

- **localStorage**: Grava tempo acumulado
- **Service Worker**: Continua contando em background
- **Sincronização**: Quando volta à app, a duração é atualizada automaticamente

## API Endpoints

Os endpoints seguem o padrão REST:

```
# Leads
GET    /api/leads
POST   /api/leads
GET    /api/leads/:id
PUT    /api/leads/:id
DELETE /api/leads/:id

# Usuarios
GET    /api/usuarios
POST   /api/usuarios
PUT    /api/usuarios/:id
DELETE /api/usuarios/:id

# Campanhas
GET    /api/campanhas
POST   /api/campanhas
PUT    /api/campanhas/:id

# Call History
POST   /api/call-history
GET    /api/call-history/:leadId

# Relatórios
GET    /api/reports/stats
GET    /api/reports/ranking
GET    /api/reports/trends
```

## Segurança

### Row Level Security (RLS)

Todas as tabelas possuem RLS configurado:

- Utilizadores só veem dados da sua empresa
- Comerciais só veem seus leads
- Supervisores só veem sua equipa
- Admins têm acesso total da empresa

### Validação

- Validação client-side com Zod
- Validação server-side em API routes
- Input sanitization

### Password

- Gerido por Supabase Auth
- Hashing automático
- Reset de password via email

## Extensibilidade

A arquitetura foi preparada para:

### VoIP Integration
```typescript
// Placeholder para integração VoIP
lib/services/voip.service.ts
```

### Click-to-Call
```typescript
// Placeholder para integração Click-to-Call
lib/services/clickToCall.service.ts
```

### WhatsApp API
```typescript
// Placeholder para integração WhatsApp
lib/services/whatsapp.service.ts
```

### Gravação de Chamadas
```typescript
// Placeholder para gravação
lib/services/recording.service.ts
```

### Transcrição
```typescript
// Placeholder para transcrição
lib/services/transcription.service.ts
```

### IA - Resumo Automático
```typescript
// Placeholder para IA
lib/services/ai.service.ts
```

## Deploy para Vercel

### 1. Push para GitHub

```bash
git add .
git commit -m "Initial SD Dialer commit"
git push origin main
```

### 2. Deploy na Vercel

```bash
vercel deploy
```

Ou via Web:
1. Visite https://vercel.com/new
2. Importe o repositório
3. Configure as environment variables
4. Deploy

### Environment Variables no Vercel

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Documentação Adicional

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Arquitetura detalhada
- [DATABASE.md](./supabase/DATABASE.md) - Schema do banco de dados
- [API.md](./docs/API.md) - Documentação de API

## Roadmap

- [ ] VoIP Integration (Twilio/Asterisk)
- [ ] Click-to-Call
- [ ] WhatsApp API Integration
- [ ] Gravação de Chamadas
- [ ] Transcrição com IA
- [ ] Resumo Automático com IA
- [ ] Integrações CRM (HubSpot, Salesforce)
- [ ] SMS Integration
- [ ] Advanced Analytics
- [ ] Mobile App (React Native)
- [ ] Webhooks & Automations

## Troubleshooting

### Erro: "Supabase not connected"

Verifique:
- `.env.local` com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Projeto Supabase ativo
- CORS configurado se necessário

### Erro: "RLS policy violation"

Verifique:
- Utilizador está autenticado
- RLS policies estão configuradas
- Query está filtrando by `company_id`

### PWA não instala

Verifique:
- HTTPS em produção (obrigatório)
- `manifest.json` válido
- Service Worker registado

## Contribuindo

1. Fork o repositório
2. Crie uma branch feature (`git checkout -b feature/amazing-feature`)
3. Commit suas mudanças (`git commit -m 'Add amazing feature'`)
4. Push para a branch (`git push origin feature/amazing-feature`)
5. Abra um Pull Request

## Licença

Este projeto está sob a licença MIT. Veja o ficheiro [LICENSE](LICENSE) para mais detalhes.

## Suporte

Para problemas e questões:

1. Verifique a [documentação](./docs)
2. Abra uma [Issue no GitHub](https://github.com/seu-repo/sd-dialer/issues)
3. Entre em contacto: support@sddialer.com

## Autor

**SD Dialer Team**

## Changelog

### v1.0.0 (2024-07-24)

- Release inicial
- Autenticação completa
- Dashboard admin
- Gestão de leads
- Cronómetro PWA
- Relatórios & Analytics
- Importação Excel/CSV
- Distribuição de leads
