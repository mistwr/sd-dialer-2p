# Guia de Contribuição - SD Dialer

## Boas Práticas de Desenvolvimento

### 1. Estrutura de Código

#### TypeScript & Type Safety

```typescript
// ✓ BOM: Usar tipos explícitos
interface LeadInput {
  first_name: string
  phone: string
  email?: string
}

function createLead(data: LeadInput): Promise<Lead> {
  // ...
}

// ✗ EVITAR: Types implícitos ou 'any'
function createLead(data: any) {
  // ...
}
```

#### Componentes React

```typescript
// ✓ BOM: Componente bem estruturado
interface LeadCardProps {
  lead: Lead
  onEdit: (id: string) => void
  loading?: boolean
}

export function LeadCard({ lead, onEdit, loading = false }: LeadCardProps) {
  return (
    <div className="sd-card">
      {/* Content */}
    </div>
  )
}

// ✗ EVITAR: Componente complexo sem separação
function LeadCard(props: any) {
  // Muita lógica aqui
}
```

#### Naming Conventions

```typescript
// Components
export function LeadsList() {}        // PascalCase
export function UserCard() {}         // PascalCase

// Functions
export function getLeads() {}         // camelCase
export function formatPhone() {}      // camelCase

// Constants
export const LEAD_STATUSES = []       // UPPER_SNAKE_CASE
export const DEFAULT_PAGE_SIZE = 20   // UPPER_SNAKE_CASE

// Files
components/leads/LeadsList.tsx        // PascalCase
lib/services/leads.service.ts         // kebab-case + .service.ts
lib/types/index.ts                    // lowercase

// Strings
const leadId = 'lead-123'             // kebab-case
const firstName = 'João'              // camelCase
```

### 2. Padrões de Serviços

Todos os serviços seguem este padrão:

```typescript
// lib/services/example.service.ts
'use client'

import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

/**
 * Serviço para operações Example
 */
export const exampleService = {
  /**
   * Descrição curta do que faz
   * @param id - ID do item
   * @returns { data, error }
   */
  async getExample(id: string) {
    try {
      const { data, error } = await supabase
        .from('examples')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async createExample(data: Partial<Example>) {
    try {
      const { data: result, error } = await supabase
        .from('examples')
        .insert([data])
        .select()
        .single()

      if (error) throw error

      return { data: result, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },
}
```

**Regras**:
- Sempre retornar `{ data, error }`
- Tratamento de erro consistente
- JSDoc comments obrigatórios
- Sem lógica UI

### 3. Componentes Reutilizáveis

Criar componentes comuns em `components/common/`:

```typescript
// components/common/Button.tsx
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  ...props
}: ButtonProps) {
  const variantClass = {
    primary: 'sd-btn-primary',
    secondary: 'sd-btn-secondary',
    danger: 'sd-btn-danger',
  }[variant]

  return (
    <button {...props} className={`${variantClass} sd-btn-${size}`} disabled={loading}>
      {loading ? <LoadingSpinner size={size} /> : children}
    </button>
  )
}
```

### 4. Validação de Dados

Usar Zod para validação:

```typescript
// lib/utils/validators.ts
import { z } from 'zod'

// Schema reutilizável
export const leadSchema = z.object({
  first_name: z.string().min(1, 'Nome obrigatório'),
  phone: z.string().regex(/^\d{9}$/, 'Telefone inválido'),
  email: z.string().email().optional(),
})

export type Lead = z.infer<typeof leadSchema>

// Usar em API routes
import { leadSchema } from '@/lib/utils/validators'

export async function POST(req: Request) {
  const data = await req.json()
  const validated = leadSchema.parse(data)
  // ...
}

// Usar em componentes
function LeadForm() {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = (formData: any) => {
    try {
      const validated = leadSchema.parse(formData)
      // Enviar para servidor
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errs = error.flatten().fieldErrors
        setErrors(errs as Record<string, string>)
      }
    }
  }
}
```

### 5. Gerenciamento de Estado

Preferência: Top-down (Server Components) > SWR (data) > useState (UI)

```typescript
// ✓ BOM: Usar SWR para dados que mudam
function LeadsList() {
  const { data: leads, mutate } = useSWR(
    ['leads', companyId],
    () => leadsService.getLeads(companyId),
    { revalidateOnFocus: false }
  )

  const handleDelete = async (id: string) => {
    await leadsService.deleteLead(id)
    mutate()
  }
}

// ✓ BOM: useState apenas para UI ephemeral
function LeadForm() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
}

// ✗ EVITAR: Guardar dados em useState se vem do servidor
function BadLeadsList() {
  const [leads, setLeads] = useState([])
  useEffect(() => {
    leadsService.getLeads().then(setLeads)
  }, [])
}
```

### 6. Error Handling

```typescript
// ✓ BOM: Tratamento de erro consistente
async function handleSubmit() {
  try {
    setLoading(true)
    const { data, error } = await leadsService.createLead(formData)

    if (error) {
      setError('Falha ao criar lead')
      return
    }

    setSuccess('Lead criado com sucesso')
    router.push('/leads')
  } catch (err) {
    setError('Erro inesperado')
    console.error('[v0] Error:', err)
  } finally {
    setLoading(false)
  }
}

// ✗ EVITAR: Ignorar erros
async function badSubmit() {
  const result = await leadsService.createLead(formData)
  // Não verifica se erro existe
}
```

### 7. Comments & Documentation

```typescript
// ✓ BOM: Comments úteis e concisos
/**
 * Detecta leads duplicados baseado em telefone
 * @param companyId - ID da empresa
 * @param phones - Array de números de telefone
 * @returns Array de leads duplicados encontrados
 */
export async function detectDuplicates(companyId: string, phones: string[]) {
  // Implementação
}

// Explicar o "porquê", não o "como"
// RLS garante que o utilizador só vê dados da sua empresa
const { data } = await supabase.from('leads').select('*')

// ✗ EVITAR: Comments óbvios
// Incrementar contador
counter++

// ✗ EVITAR: Código comentado
// const oldWay = async () => { ... }
// Use git history em vez disso
```

### 8. Segurança

#### API Routes

```typescript
// ✓ BOM: Validar tudo
import { leadSchema } from '@/lib/utils/validators'

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const body = await req.json()
    const validated = leadSchema.parse(body)

    const { data, error } = await leadsService.createLead({
      ...validated,
      company_id: user.company_id,
    })

    if (error) throw error

    return Response.json(data)
  } catch (error) {
    return new Response('Bad request', { status: 400 })
  }
}

// ✗ EVITAR: Sem validação
export async function POST(req: Request) {
  const data = await req.json()
  await db.leads.insert(data)
  return Response.json({ ok: true })
}
```

#### Dados Sensíveis

```typescript
// ✓ BOM: Nunca expor dados sensíveis
const profile = {
  id: user.id,
  email: user.email,
  role: user.role,
  // NÃO incluir: password, auth_token, etc
}

// ✓ BOM: Usar .env.local (não incluir em git)
// .env.local (add to .gitignore)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

// ✓ BOM: Separar public vs secret
// Prefix NEXT_PUBLIC_ = incluído no bundle (público)
// Sem prefix = server-only (secreto)
```

### 9. Performance

```typescript
// ✓ BOM: Usar SWR com fallback
const { data: leads = [] } = useSWR(
  ['leads', id],
  () => leadsService.getLeads(id),
  {
    fallbackData: [],
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  }
)

// ✓ BOM: Lazy load images
import Image from 'next/image'

<Image src="/logo.png" alt="Logo" width={100} height={100} loading="lazy" />

// ✗ EVITAR: N+1 queries
// Buscar lead depois suas chamadas depois seus follow-ups
for (const lead of leads) {
  const calls = await getCallHistory(lead.id)
  const followUps = await getFollowUps(lead.id)
}

// ✓ BOM: Usar SELECT com JOINs (se necessário)
// Ou buscar em batch
```

### 10. Testing

```typescript
// Estrutura básica de teste
import { describe, it, expect, beforeEach } from '@jest/globals'
import { leadsService } from '@/lib/services/leads.service'

describe('leadsService', () => {
  describe('getLeads', () => {
    it('should return leads for a company', async () => {
      const { data, error } = await leadsService.getLeads('company-123')

      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should handle errors gracefully', async () => {
      const { data, error } = await leadsService.getLeads('')

      expect(data).toBeNull()
      expect(error).toBeDefined()
    })
  })
})
```

## Processo de Desenvolvimento

### 1. Criar Nova Funcionalidade

1. **Criar a migration SQL** (se necessário)
   ```bash
   supabase migration new add_feature
   ```

2. **Criar o service**
   ```bash
   touch lib/services/feature.service.ts
   ```

3. **Criar os types**
   ```bash
   # Editar lib/types/index.ts
   ```

4. **Criar componentes**
   ```bash
   mkdir components/feature
   touch components/feature/FeatureList.tsx
   ```

5. **Criar API route** (se necessário)
   ```bash
   mkdir app/api/feature
   touch app/api/feature/route.ts
   ```

6. **Testar**
   ```bash
   pnpm dev
   # Testar manualmente no browser
   ```

### 2. Git Workflow

```bash
# Feature branch
git checkout -b feature/add-voip-integration

# Fazer commits pequenos e descritivos
git add lib/services/voip.service.ts
git commit -m "feat: add VoIP service"

git add components/timer/VoIPTimer.tsx
git commit -m "feat: add VoIP timer component"

# Push e criar PR
git push origin feature/add-voip-integration
```

### 3. Commit Messages

Usar conventional commits:

```
feat:     Nova funcionalidade
fix:      Correção de bug
docs:     Documentação
style:    Formatação (sem lógica)
refactor: Refatoração (sem mudança funcional)
perf:     Otimização de performance
test:     Testes

Exemplos:
feat: add call timer with localStorage persistence
fix: correct RLS policy for leads table
docs: update installation guide
refactor: extract LeadForm component
perf: add index to call_history table
```

## Checklist para PR

Antes de submeter uma PR:

- [ ] Código segue as conventions de naming
- [ ] TypeScript types definidos
- [ ] JSDoc comments adicionados
- [ ] Teste manual realizado
- [ ] Sem console.log's de debug
- [ ] Sem secrets em commits
- [ ] Responsive design testado (mobile/tablet/desktop)
- [ ] Erro handling implementado
- [ ] RLS policies consideradas (se banco de dados)
- [ ] Documentação atualizada

## Code Review

### Pontos a Verificar

1. **Segurança**
   - Validação de entrada?
   - Sem exposição de secrets?
   - RLS policies corretas?

2. **Performance**
   - N+1 queries?
   - Images otimizadas?
   - Component memoization necessária?

3. **Manutenibilidade**
   - Código legível?
   - Types corretos?
   - Comentários claros?

4. **Testing**
   - Edge cases cobertos?
   - Error handling?
   - Manual testing realizado?

## Debugging

### Console Logs

```typescript
// Usar formato padrão para logs
console.log('[v0] Debug message:', variable)
console.error('[v0] Error:', error)

// Remover antes de commit
```

### DevTools do Supabase

```typescript
// Ver queries ao vivo
const supabase = createClient()
supabase.auth.onAuthStateChange((event, session) => {
  console.log('[v0] Auth:', event, session)
})
```

### Network Tab

- Inspecionar requisições Supabase
- Ver payloads e respostas
- Verificar RLS policies errors

## Escalabilidade

### Quando Refatorar

- Componente > 200 linhas: dividir
- Service > 300 linhas: dividir por domain
- Duplicação de código: extrair helper

### Padrões Escaláveis

```typescript
// ✓ BOM: Service pattern para cada domain
lib/services/
├── leads.service.ts
├── usuarios.service.ts
├── campanhas.service.ts
└── call-history.service.ts

// ✓ BOM: Folder structure por feature
components/
├── leads/
│   ├── LeadsList.tsx
│   ├── LeadCard.tsx
│   ├── LeadForm.tsx
│   └── index.ts
├── usuarios/
└── campanhas/
```

## Referências

- [Next.js Best Practices](https://nextjs.org/docs)
- [React Best Practices](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

## Suporte

Dúvidas?

1. Abra uma [Issue no GitHub](https://github.com/seu-repo/sd-dialer/issues)
2. Consulte [ARCHITECTURE.md](./ARCHITECTURE.md)
3. Contacte: support@sddialer.com
