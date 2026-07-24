# SD Dialer - Guia de Deployment

## Pré-requisitos

- Projeto Supabase configurado
- Repositório GitHub
- Conta Vercel
- Domínio (opcional, mas recomendado)

## Checklist Pré-Deployment

### 1. Variáveis de Ambiente

```bash
# Verifique .env.local tem tudo necessário
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### 2. Build Local

```bash
pnpm build
# Deve terminar sem erros
```

### 3. Testes

```bash
# Testar login
# Testar criação de lead
# Testar distribuição
# Testar cronómetro
# Testar relatórios
# Testar em mobile (PWA)
```

### 4. Database

```bash
# Verificar migrations foram aplicadas
# Verificar RLS policies estão ativas
# Verificar índices existem
# Backup antes de deploy
```

### 5. Segurança

- [ ] Sem console.logs de debug
- [ ] Sem secrets em código
- [ ] .gitignore configu ado
- [ ] Passwords hash em BD
- [ ] HTTPS ativado (em produção)
- [ ] CORS configurado (se necessário)

## Deployment para Vercel

### 1. Preparar Repositório

```bash
# Clone local já tem tudo? 
git status
# Tudo limpo? Sim

# Commit final
git add .
git commit -m "chore: production ready"
git push origin main
```

### 2. Conectar Vercel

**Opção A: CLI**

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel
# Seguir instruções
```

**Opção B: Web (recomendado)**

1. Visite https://vercel.com/new
2. Clique "Import Git Repository"
3. Selecione seu repositório
4. Configure as environment variables
5. Click "Deploy"

### 3. Configurar Environment Variables

No dashboard Vercel:

```
Settings > Environment Variables

NEXT_PUBLIC_SUPABASE_URL = https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = your-anon-key
```

### 4. Configurar Custom Domain

```
Settings > Domains

Add Custom Domain > your-domain.com
Configure DNS records (Vercel fornece instruções)
```

### 5. Configurar HTTPS

```
Automático via Vercel (usando Let's Encrypt)
Veja Settings > Certificates
```

## Pós-Deployment

### 1. Verificar Logs

```
https://vercel.com/your-org/sd-dialer > Deployments

Clicar no deployment ativo
Ver Logs > vercel/functions
```

### 2. Testar Produção

```bash
# Testar login
https://your-domain.com/auth/login

# Testar funcionalidades principais
# Criar lead
# Fazer chamada
# Ver relatório
```

### 3. Monitoramento

Configurar em Vercel:

```
Settings > Monitoring > Web Vitals
Enable > Ver em tempo real
```

### 4. Configurar CI/CD

Automático no Vercel (Push = Deploy automático)

Customizar em `vercel.json`:

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@next-public-supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@next-public-supabase-anon-key"
  }
}
```

## Troubleshooting

### Build Fails

```bash
# Logs
vercel logs --follow

# Soluções comuns
# 1. Dependências desatualizadas
pnpm install

# 2. TypeScript errors
pnpm tsc --noEmit

# 3. Environment variables faltando
# Verificar Vercel dashboard
```

### Aplicação Branca

```
F12 > Console > Ver erros JavaScript

Comum:
- Supabase URL incorreta
- ANON KEY expirada
- CORS bloqueado
```

### Performance Lenta

```
Check > Vercel Analytics > Web Vitals

Otimizações:
- Adicionar mais índices BD
- Usar SWR com cache
- Lazy load imagens
```

### RLS Policies Bloqueando

```
Check > Supabase Dashboard > SQL Editor

Run:
SELECT * FROM usuarios WHERE id = auth.uid();

Se retornar vazio = RLS policy incorreta
```

## Backup & Recovery

### Backup Manual

```bash
# Usar Supabase CLI
supabase db push
supabase db pull

# Ou via dashboard
Supabase > Backups > Request backup
```

### Recovery

```bash
# Se algo falhar
1. Revert no GitHub
2. Vercel rebuilds automatically
3. Ou restore database backup

vercel rollback [deployment-url]
```

## Escalamento

### Quando Escalar

- Mais de 1000 users: Upgrade Vercel
- Mais de 100k leads: Upgrade Supabase
- Muitas chamadas/dia: Considerar caching

### Upgrade Vercel

```
Settings > Plan > Upgrade

Opções:
- Pro: $20/mês
- Enterprise: Contato
```

### Upgrade Supabase

```
Supabase Dashboard > Billing > Plan

Opções:
- Free: Dev apenas
- Pro: $25/mês + charges
- Enterprise: Custom
```

## Segurança em Produção

### 1. HTTPS

```
Automático em Vercel ✓
Redirecionar HTTP > HTTPS

next.config.mjs:
async redirects() {
  return [
    {
      source: '/:path*',
      destination: 'https://:host/:path*',
      permanent: true,
    },
  ]
}
```

### 2. Headers de Segurança

```
vercel.json:
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
      ]
    }
  ]
}
```

### 3. Rate Limiting

```typescript
// Adicionar depois (exemplo com Upstash)
import { Ratelimit } from '@upstash/ratelimit'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 h'),
})

// Use in API routes
const { success } = await ratelimit.limit(userId)
if (!success) return new Response('Too many requests', { status: 429 })
```

### 4. CORS

```typescript
// next.config.mjs
const nextConfig = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.ALLOWED_ORIGIN || '*',
          },
        ],
      },
    ]
  },
}
```

## Observabilidade

### Error Tracking (Sentry)

```bash
# Instalar
pnpm add @sentry/nextjs

# Configurar
# Create account em sentry.io
```

```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
})
```

### Analytics

Vercel fornece:
- Web Vitals automático
- Analytics Dashboard
- Real-time data

Configurar em Dashboard > Analytics

### Logging

```typescript
// Usar logger estruturado
import { logger } from '@/lib/logger'

logger.info('Lead created', { leadId, userId })
logger.error('Failed to create lead', { error, userId })
```

## Plano de Maintenance

### Semanal

- [ ] Verificar error logs
- [ ] Performance metrics
- [ ] Database size

### Mensal

- [ ] Dependency updates (`pnpm up`)
- [ ] Security review
- [ ] Backup verification

### Trimestral

- [ ] Database optimization
- [ ] Query analysis
- [ ] Capacity planning

## Runbook de Incidente

### Lead Não Aparece

1. Verificar Supabase DB
2. Verificar RLS policies
3. Check browser console
4. Limpar cache

### Cronómetro Não Funciona

1. Verificar Service Worker
2. Limpar localStorage
3. Restart navegador
4. Check PWA manifest

### Chamadas Não Registam

1. Verificar API endpoint
2. Check error logs
3. Testar diretamente via cURL
4. Verificar database triggers

## Rollback

```bash
# Se deploy falhar
vercel rollback

# Ou reverter em GitHub
git revert HEAD
git push origin main
# Vercel rebuilds automatically
```

## Conclusão

SD Dialer está agora pronto para produção!

Próximos passos:
1. Deploy para Vercel
2. Configurar domínio customizado
3. Monitorar logs e performance
4. Coletar feedback de utilizadores
5. Iterar e melhorar

Para suporte: support@sddialer.com
