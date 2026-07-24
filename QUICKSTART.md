# SD Dialer - Quick Start Guide

## 🚀 Setup em 5 Minutos

### 1. Clone & Instale

```bash
# Já tem os ficheiros? Perfeito!
cd /vercel/share/v0-project

# Instalar dependências
pnpm install
```

### 2. Configure Supabase

```bash
# Visite https://supabase.com
# Crie um novo projeto

# Copie o URL e ANON KEY
# Crie .env.local
cp .env.example .env.local

# Edite .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Inicie o Servidor

```bash
pnpm dev
# Visite http://localhost:3000
```

### 4. Primeiras Contas

```
Nota: O signup ainda não está implementado.
Para agora, use a Supabase console para criar users manualmente.

Próximas features a implementar:
- SignupForm
- LoginForm
- Password reset
```

## 📊 O Que Está Pronto

### ✅ Backend (100%)
- Supabase integrado
- 8 serviços de dados
- Types TypeScript completos
- RLS policies definidas
- Error handling

### ✅ Layout (50%)
- DashboardLayout
- 3 dashboards base (admin, supervisor, comercial)
- Sidebar com navegação
- Header com user menu
- Responsive design

### ✅ Documentação (100%)
- README completo
- Arquitetura detalhada
- Contribuição guidelines
- Deployment guide
- Este Quick Start

### ⏳ Componentes (0%)
- Todos os componentes de UI ainda precisam ser criados
- Lista abaixo...

## 🎯 Próximos Passos Recomendados

### Opção 1: Rápida (Começar a usar)
```
1. Criar componentes de auth
   - LoginForm
   - SignupForm
   
2. Criar página de leads
   - LeadsList
   - LeadCard
   - Botão "Ligar"

3. Pronto para comerciais usarem!
```

### Opção 2: Completa (Tudo desde o início)
```
1. Dashboard Admin
2. Gestão de Usuarios
3. Campanhas
4. Leads e Import
5. Distribuição
6. Comercial Area com Timer
7. Relatórios
```

### Opção 3: Modular (Feature por Feature)
```
Fazer um push a cada feature:
- Feature 1 (Auth)
- Feature 2 (Leads)
- Feature 3 (Timer)
- Feature 4 (Reports)
- Etc...
```

## 📝 Ficheiros Importantes

### Documentação
```
README.md                    # Visão geral e instalação
ARCHITECTURE.md              # Design técnico detalhado
CONTRIBUTING.md              # Boas práticas de desenvolvimento
DEPLOYMENT.md                # Deploy para produção
IMPLEMENTATION_SUMMARY.md    # Este projeto resumido
QUICKSTART.md                # Este ficheiro
```

### Código Principal
```
lib/
  ├── services/              # Lógica de dados
  ├── types/                 # Types TypeScript
  ├── supabase/              # Clientes Supabase
  ├── hooks/useAuth.ts       # Hook de autenticação
  └── utils/                 # Helpers

components/
  ├── layout/DashboardLayout.tsx
  ├── common/                # Componentes reutilizáveis
  └── (mais a vir)

app/
  ├── (dashboard)/           # Dashboards protegidas
  └── api/                   # API routes
```

## 🔧 Comandos Úteis

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm start            # Start production server

# Linting & Formatting
pnpm lint             # Run ESLint
pnpm format           # Format code with Prettier

# Database
supabase local start  # Start local Supabase (se instalado)
supabase db push      # Push migrations

# Git
git add .
git commit -m "feat: add something"
git push origin main
```

## 🎨 Customização

### Cores
Editar `globals.css` para mudar design tokens:

```css
@theme inline {
  --color-primary: #2563eb;  /* Azul */
  --color-success: #10b981;  /* Verde */
  --color-danger: #ef4444;   /* Vermelho */
}
```

### Fonts
Editar `app/layout.tsx`:

```typescript
import { Inter, JetBrains_Mono } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })
const mono = JetBrains_Mono({ subsets: ['latin'] })
```

### Tailwind
Editar `tailwind.config.ts` (se Tailwind v3) ou `globals.css` (se v4)

## 🐛 Troubleshooting

### "Cannot find module @/lib..."
```bash
# Verificar tsconfig.json tem paths corretos
# Restart IDE
# pnpm install
```

### "Supabase connection failed"
```bash
1. Verificar .env.local existe
2. Verificar URLs e keys estão corretos
3. Verificar Supabase project está ativo
4. Testar em incognito (sem cache)
```

### "Port 3000 in use"
```bash
# Usar porta diferente
pnpm dev -- -p 3001
```

### TypeScript errors
```bash
# Verificar tipos
pnpm tsc --noEmit

# Rebuild
pnpm build

# Restart IDE
```

## 📚 Estrutura de uma Feature

Quando adicionar nova funcionalidade:

```bash
# 1. Type
# Editar: lib/types/index.ts
export interface NovaThing { ... }

# 2. Service
# Criar: lib/services/novacoisa.service.ts
export const novaService = { ... }

# 3. Component
# Criar: components/novos/NovoComponent.tsx
export function NovoComponent() { ... }

# 4. Page (se necessário)
# Criar: app/(dashboard)/path/page.tsx
export default function NovaPage() { ... }

# 5. API Route (se necessário)
# Criar: app/api/novo/route.ts
export async function GET() { ... }
```

## 🌐 Deployment Rápido

### Vercel (Recomendado)

```bash
# 1. Push para GitHub
git push origin main

# 2. Visite https://vercel.com/new
# 3. Import seu repositório
# 4. Add environment variables
# 5. Deploy!

# Pronto! Sua app está online em:
# https://seu-projeto.vercel.app
```

### GitHub Pages (Não recomendado para full-stack)
```
Supabase é necessário, então precisa de API.
GitHub Pages é apenas static hosting.
Use Vercel ou similar em vez disso.
```

## 🎓 Learning Path

Se é novo a este projeto:

1. **Leia primeiro**: [README.md](./README.md)
2. **Entenda a arquitetura**: [ARCHITECTURE.md](./ARCHITECTURE.md)
3. **Veja boas práticas**: [CONTRIBUTING.md](./CONTRIBUTING.md)
4. **Implementar primeira feature**
5. **Deploy para produção**: [DEPLOYMENT.md](./DEPLOYMENT.md)

## 💡 Tips & Tricks

### Debug
```typescript
// Use este formato
console.log('[v0] Debug message:', variable)

// Aparece nos logs do v0
// Remova antes de produção
```

### Type Safety
```typescript
// Sempre use types
const lead: Lead = { ... }

// Não use any
const lead: any = { ... }  // ❌
```

### Error Handling
```typescript
try {
  const { data, error } = await service.getData()
  if (error) throw error
  return data
} catch (err) {
  console.error('[v0]', err)
  return null
}
```

### Performance
```typescript
// Use SWR para cache
const { data } = useSWR(['key'], () => service.getData())

// Não refetch constantly
```

## 📞 Suporte

- 📖 Documentação: [README.md](./README.md)
- 🏗️ Arquitetura: [ARCHITECTURE.md](./ARCHITECTURE.md)
- 💻 Desenvolvimento: [CONTRIBUTING.md](./CONTRIBUTING.md)
- 🚀 Deploy: [DEPLOYMENT.md](./DEPLOYMENT.md)
- 📋 Roadmap: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)

## 🎉 Ready to Go!

Você agora tem:

- ✅ Setup completo
- ✅ Database configurado
- ✅ Serviços prontos
- ✅ Layout base
- ✅ Documentação completa
- ✅ Boas práticas definidas

**Próximo passo**: Criar componentes de UI e implementar features!

---

**Dúvidas? Comece com a [README.md](./README.md)**

Feliz codificação! 🚀
