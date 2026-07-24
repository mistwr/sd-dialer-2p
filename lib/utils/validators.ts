/**
 * SD Dialer - Validators
 * Validações de dados do projeto
 */

import { z } from 'zod'

// Auth Validation
export const loginSchema = z.object({
  email: z.string().email('Email inválido').min(1, 'Email é obrigatório'),
  password: z.string().min(6, 'Password deve ter pelo menos 6 caracteres'),
})

export const registerSchema = z
  .object({
    email: z.string().email('Email inválido').min(1, 'Email é obrigatório'),
    password: z.string().min(8, 'Password deve ter pelo menos 8 caracteres'),
    passwordConfirm: z.string().min(1, 'Confirmação de password é obrigatória'),
    fullName: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
    companyName: z.string().min(3, 'Nome da empresa deve ter pelo menos 3 caracteres'),
    nif: z.string().min(9, 'NIF deve ter 9 dígitos'),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Passwords não correspondem',
    path: ['passwordConfirm'],
  })

// Lead Validation
export const leadSchema = z.object({
  firstName: z.string().min(1, 'Nome é obrigatório'),
  lastName: z.string().min(1, 'Apelido é obrigatório'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().min(9, 'Telefone deve ter pelo menos 9 dígitos'),
  mobile: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  postalCode: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  nif: z.string().optional().or(z.literal('')),
  operator: z.string().optional().or(z.literal('')),
  campaignId: z.string().min(1, 'Campanha é obrigatória'),
})

// Campaign Validation
export const campaignSchema = z.object({
  name: z.string().min(3, 'Nome da campanha deve ter pelo menos 3 caracteres'),
  description: z.string().optional().or(z.literal('')),
  startDate: z.string().min(1, 'Data de início é obrigatória'),
  endDate: z.string().min(1, 'Data de fim é obrigatória'),
  targetCount: z.number().min(1, 'Alvo deve ser maior que 0').optional(),
})

// Usuario Validation
export const usuarioSchema = z.object({
  email: z.string().email('Email inválido'),
  fullName: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  phone: z.string().min(9, 'Telefone deve ter pelo menos 9 dígitos').optional().or(z.literal('')),
  role: z.enum(['admin', 'supervisor', 'comercial']),
  supervisorId: z.string().optional().or(z.literal('')),
})

// Call Result Validation
export const callResultSchema = z.object({
  result: z.enum([
    'venda',
    'nao_interessado',
    'nao_atende',
    'numero_errado',
    'ligar_depois',
    'cliente_aderiu',
    'sem_cobertura',
    'outro',
  ]),
  notes: z.string().optional().or(z.literal('')),
  followUp: z.boolean().optional().default(false),
  followUpDate: z.string().optional().or(z.literal('')),
  followUpTime: z.string().optional().or(z.literal('')),
})

// Validators
export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

export function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '')
  return cleaned.length >= 9
}

export function validateNIF(nif: string): boolean {
  const cleaned = nif.replace(/\D/g, '')
  return cleaned.length === 9
}

export function validatePostalCode(postalCode: string): boolean {
  const re = /^\d{4}-\d{3}$/
  return re.test(postalCode)
}

export function formatPhoneForCall(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('351')) {
    return `tel:+${cleaned}`
  }
  return `tel:+351${cleaned}`
}

export function formatPhoneForWhatsApp(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('351')) {
    return `https://wa.me/${cleaned}`
  }
  return `https://wa.me/351${cleaned}`
}

export function detectOperator(phone: string): string | null {
  const cleaned = phone.replace(/\D/g, '')
  const prefix = cleaned.slice(0, 2)

  const operators: { [key: string]: string } = {
    '21': 'MEO',
    '22': 'MEO',
    '91': 'Vodafone',
    '92': 'Mover',
    '93': 'NOS',
  }

  return operators[prefix] || null
}

// CSV/Excel Upload Validation
export function validateFileUpload(file: File): { valid: boolean; error?: string } {
  const validTypes = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
  const maxSize = 10 * 1024 * 1024 // 10MB

  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Tipo de ficheiro não suportado. Use CSV ou Excel.' }
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'Ficheiro é demasiado grande. Máximo 10MB.' }
  }

  return { valid: true }
}

// Date Validation
export function validateDateRange(startDate: string, endDate: string): boolean {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return start < end
}

export function isFutureDate(date: string): boolean {
  return new Date(date) > new Date()
}

export function isPastDate(date: string): boolean {
  return new Date(date) < new Date()
}
