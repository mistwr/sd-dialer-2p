# SD Dialer - Arquitetura Técnica

## Visão Geral da Arquitetura

SD Dialer é uma aplicação Next.js 16 com arquitetura em camadas:

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  Components, Pages, UI (React, TailwindCSS)                 │
└─────────────────────────────────────────────────────────────┘
                            ↓↑
┌─────────────────────────────────────────────────────────────┐
│                      LOGIC LAYER                             │
│  Hooks (useAuth, etc), Validators, Formatters              │
└─────────────────────────────────────────────────────────────┘
                            ↓↑
┌─────────────────────────────────────────────────────────────┐
│                    SERVICES LAYER                            │
│  Auth, Leads, Campanhas, Reports, Distribution, etc        │
└─────────────────────────────────────────────────────────────┘
                            ↓↑
┌─────────────────────────────────────────────────────────────┐
│                   SUPABASE / DATABASE                        │
│  PostgreSQL com RLS, Auth, Storage                          │
└─────────────────────────────────────────────────────────────┘
```

## Camadas Detalhadas

### 1. PRESENTATION LAYER

**Responsabilidade**: Renderizar UI e capturar interações do utilizador.

**Componentes Principais**:

```
components/
├── auth/              # Login, Signup forms
├── layout/            # Navbar, Sidebar, Header
├── dashboard/         # Admin dashboard, stats, charts
├── leads/             # Lead list, lead details, lead form
├── usuarios/          # User management CRUD
├── campanhas/         # Campaign management
├── importacao/        # Import wizard
├── distribuicao/      # Distribution interface
├── relatorios/        # Reports e analytics
├── timer/             # Call timer
├── notifications/     # Toast, alerts
└── common/            # Reusable components (Badge, Alert, Spinner)
```

**Padrões**:
- Componentes funcionais com React hooks
- Props bem tipadas com TypeScript
- Separação de responsabilidades (presentacional vs container)
- Reutilização máxima de componentes

**Exemplo**:

```typescript
// Componente Presentacional
function LeadCard({ lead, onCall }: { lead: Lead; onCall: (id: string) => void }) {
  return (
    <div className="sd-card">
      <h3>{lead.first_name} {lead.last_name}</h3>
      <button onClick={() => onCall(lead.id)}>Ligar</button>
    </div>
  )
}

// Componente Container
function LeadsList() {
  const [leads, setLeads] = useState<Lead[]>([])
  
  const handleCall = async (leadId: string) => {
    // Lógica de chamada
  }

  return <LeadCard lead={leads[0]} onCall={handleCall} />
}
```

### 2. LOGIC LAYER

**Responsabilidade**: Lógica de negócio, validação, transformação de dados.

**Hooks Customizados**:

```typescript
lib/hooks/
└── useAuth.ts        # Gerenciar autenticação e sesão
```

**Validadores** (`lib/utils/validators.ts`):

```typescript
// Validar email
export const isValidEmail = (email: string): boolean => {}

// Validar telefone PT
export const isValidPhone = (phone: string): boolean => {}

// Validar NIF PT
export const isValidNIF = (nif: string): boolean => {}
```

**Formatadores** (`lib/utils/formatters.ts`):

```typescript
// Formatar telefone
export const formatPhone = (phone: string): string => {}

// Formatar data
export const formatDate = (date: Date | string): string => {}

// Formatar duração de chamada
export const formatDuration = (seconds: number): string => {}
```

**Cálculos** (`lib/utils/calculations.ts`):

```typescript
// Calcular taxa de conversão
export const calculateConversionRate = (sales: number, total: number): number => {}

// Calcular tempo médio de chamada
export const calculateAverageDuration = (totalDuration: number, calls: number): number => {}
```

### 3. SERVICES LAYER

**Responsabilidade**: Integração com Supabase, operações CRUD, lógica complexa.

**Padrão**: Cada serviço encapsula operações relacionadas.

```typescript
// Exemplo: leadsService
export const leadsService = {
  async getLeads(companyId: string, filters?: Filter[]) {
    // Buscar leads do Supabase com filtros
  },

  async createLead(lead: Partial<Lead>) {
    // Validar e criar lead
  },

  async detectDuplicates(companyId: string, phones: string[]) {
    // Encontrar duplicados
  },
}
```

**Serviços Disponíveis**:

1. **authService**: Login, signup, session management
2. **leadsService**: CRUD de leads, search, filters, duplicates
3. **campanhasService**: Gerenciar campanhas
4. **callHistoryService**: Registar e buscar histórico de chamadas
5. **followUpService**: Agendar e gerenciar follow-ups
6. **distributionService**: Distribuição manual, automática, por equipa, por percentagem
7. **notificationsService**: Criar e gerenciar notificações
8. **reportService**: Gerar relatórios e estatísticas

**Princípios**:

- Separação de responsabilidades
- Tratamento de erros consistente
- Return padrão: `{ data, error }`
- Sem lógica UI - apenas dados e operações

### 4. DATABASE LAYER (Supabase)

**Arquitetura**:

```
PostgreSQL Database
├── Tables (11 principais)
├── Row Level Security (RLS) Policies
├── Triggers & Functions
├── Indexes para performance
└── Custom Types (ENUM)
```

**Tabelas Principais**:

```sql
companies              -- Empresas (multitenancy)
usuarios               -- Utilizadores com roles (admin, supervisor, comercial)
campanhas              -- Campanhas de vendas
leads                  -- Leads da base de dados
call_history           -- Histórico de chamadas
follow_ups             -- Follow-ups agendados
distribuicoes          -- Distribuições de leads
distribuicoes_leads    -- Mapping entre distribuições e leads
notificacoes           -- Notificações de utilizadores
objetivos              -- Objetivos de vendas
```

**Row Level Security (RLS)**:

Todas as tabelas possuem RLS configurado para garantir:

- **Multitenancy**: Utilizadores só veem dados da sua empresa
- **Role-based Access**: Admin > Supervisor > Comercial
- **Data Isolation**: Leads só vistos por quem foi atribuído ou admin/supervisor

**Exemplo de RLS Policy**:

```sql
CREATE POLICY "Users can view leads in their company"
  ON leads
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM usuarios WHERE id = auth.uid()
    )
  );
```

## Fluxos de Dados

### 1. Fluxo de Autenticação

```
User Input (email/password)
    ↓
LoginPage calls supabase.auth.signInWithPassword()
    ↓
useAuth hook receives session
    ↓
Fetch usuario profile from usuarios table
    ↓
Store session in Supabase (automatic)
    ↓
Redirect to dashboard based on role
    ↓
useAuth hook used in protected components
```

### 2. Fluxo de Leads

```
1. IMPORTAÇÃO
   Upload Excel/CSV
   ↓
   Parse file (PapaParse/XLSX)
   ↓
   Validar dados
   ↓
   Detectar duplicados
   ↓
   leadsService.createLeads()
   ↓
   Insert no Supabase

2. DISTRIBUIÇÃO
   Obter leads unassigned
   ↓
   Escolher tipo distribuição
   ↓
   distributionService.distribute*()
   ↓
   Update leads com assigned_to
   ↓
   Criar notificacoes para comerciais

3. EXECUÇÃO
   Comercial visualiza lead
   ↓
   Clica "Ligar"
   ↓
   Abre tel: protocol (sistema operativo)
   ↓
   Cronómetro inicia (localStorage + Service Worker)
   ↓
   Comercial retorna à app
   ↓
   Preenche resultado da chamada
   ↓
   callHistoryService.createCallRecord()
   ↓
   Lead status atualizado
   ↓
   Histórico gravado no Supabase
```

### 3. Fluxo de Follow-ups

```
Comercial preenche follow-up na chamada
    ↓
followUpService.createFollowUp()
    ↓
Inserir em follow_ups table
    ↓
Criar notificação (opcional)
    ↓
Daily scheduler verifica follow-ups pendentes
    ↓
Notificar comerciais sobre follow-ups do dia
    ↓
Comercial abre follow-up
    ↓
Executar chamada seguindo mesmo fluxo
    ↓
followUpService.completeFollowUp()
```

## Padrões de Design

### 1. Service Pattern

Encapsular operações de dados em serviços:

```typescript
// Não fazer
async function getLeads() {
  const response = await supabase.from('leads').select('*')
  return response
}

// Fazer
export const leadsService = {
  async getLeads(companyId: string) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', companyId)
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }
}
```

### 2. Custom Hooks Pattern

Reutilizar lógica em múltiplos componentes:

```typescript
// lib/hooks/useAuth.ts
export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Lógica compartilhada
  
  return { user, loading, login, logout }
}

// Uso
function Dashboard() {
  const { user, isAdmin } = useAuth()
  
  if (!isAdmin()) return <NotFound />
  
  return <div>Admin Dashboard</div>
}
```

### 3. Type Safety Pattern

Usar TypeScript para type safety:

```typescript
// lib/types/index.ts
export interface Lead {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  status: LeadStatus
  assigned_to: string | null
  // ...
}

export type LeadStatus = 'new' | 'contactado' | 'vendido' | 'nao_interessado'
```

## Performance Optimization

### 1. Data Fetching

Usar SWR para cache e revalidação:

```typescript
import useSWR from 'swr'

function LeadsList() {
  const { data: leads } = useSWR(
    ['leads', companyId],
    () => leadsService.getLeads(companyId)
  )
  
  return <div>{leads?.map(lead => ...)}</div>
}
```

### 2. Code Splitting

Next.js automático: cada página é um chunk separado.

### 3. Image Optimization

Usar next/image para otimização automática:

```typescript
import Image from 'next/image'

export function CompanyLogo({ src }: { src: string }) {
  return <Image src={src} alt="Logo" width={100} height={100} />
}
```

### 4. Database Indexes

Criadas automaticamente nas migrations:

```sql
CREATE INDEX idx_leads_company_id ON leads(company_id);
CREATE INDEX idx_call_history_usuario_id ON call_history(usuario_id);
```

## Segurança

### 1. Row Level Security (RLS)

Todas as queries são filtradas automáticamente:

```typescript
// Mesmo que um utilizador tente:
const { data } = await supabase.from('leads').select('*')

// RLS vai retornar apenas leads da sua empresa
// Não é possível byppassar sem alterar auth token
```

### 2. Input Validation

Validação em 3 camadas:

1. **Client-side**: Immediate feedback
2. **API Routes**: Validar com Zod
3. **RLS**: Última camada de defesa

```typescript
// API route
import { z } from 'zod'

const createLeadSchema = z.object({
  first_name: z.string().min(1),
  phone: z.string().regex(/^\d{9}$/),
})

export async function POST(req: Request) {
  const data = createLeadSchema.parse(await req.json())
  // Process...
}
```

### 3. Secrets Management

Variáveis sensíveis em `.env.local`:

```env
# Nunca fazer commit
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Escalabilidade

### 1. Multitenancy

Design desde o início:

- Todos os dados têm `company_id`
- RLS garante isolamento
- Cada empresa é independente

### 2. Database Performance

```typescript
// Índices para queries comuns
CREATE INDEX idx_leads_company_id_status ON leads(company_id, status);
CREATE INDEX idx_call_history_usuario_date ON call_history(usuario_id, call_date);
```

### 3. Horizontal Scaling

- Supabase escala automaticamente
- Vercel distribui globally
- CDN para assets estáticos

## Extensibilidade

### 1. Adicionar Nova Tabela

1. Criar migration SQL
2. Criar service em `lib/services/`
3. Adicionar types em `lib/types/`
4. Criar componentes em `components/`
5. Criar API routes em `app/api/`

### 2. Adicionar Integração Externa

```typescript
// lib/services/voip.service.ts
export const voipService = {
  async initCall(phoneNumber: string) {
    // Integração com provider VoIP
  }
}

// Usar em componente
function LeadDetail() {
  const handleCall = async () => {
    await voipService.initCall(lead.phone)
  }
}
```

## Deploy & DevOps

### 1. Vercel Deployment

```bash
# Automatic deployment on push to main
# Environment variables configured in Vercel dashboard
```

### 2. Monitoring

- Vercel Analytics
- Sentry para error tracking
- Custom logging

### 3. Database Backups

- Supabase handles backups automatically
- Point-in-time recovery available

## Testes

### Estratégia de Testes

```
Unit Tests (Jest)
├── Utils (validators, formatters)
├── Hooks
└── Services

Integration Tests
├── API routes
└── Database operations

E2E Tests (Playwright)
├── Auth flow
├── Lead creation
└── Call timer
```

Exemplo:

```typescript
// lib/utils/__tests__/formatters.test.ts
describe('formatDuration', () => {
  it('should format seconds to MM:SS', () => {
    expect(formatDuration(125)).toBe('02:05')
  })
})
```

## Monitoring & Logging

### Application Logs

```typescript
// Use console.log("[v0] ...") for debugging
console.log('[v0] Lead created:', leadId)

// Production logging (implementar depois)
import { captureException } from '@sentry/nextjs'
try {
  // operation
} catch (error) {
  captureException(error)
}
```

### Metrics

- Número de utilizadores ativos
- Chamadas por dia
- Taxa de conversão
- Tempo médio de resposta

## Conclusão

SD Dialer foi arquitetado com foco em:

- **Escalabilidade**: Multitenancy desde o design
- **Segurança**: RLS + validação em 3 camadas
- **Performance**: Índices, caching, code splitting
- **Manutenibilidade**: Separação de camadas, tipos, padrões
- **Extensibilidade**: Placeholders para futuras integrações

A arquitetura permite adicionar VoIP, gravações, IA, etc. sem alterar a estrutura existente.
