/**
 * SD Dialer - Formatters
 * Formatação de dados para apresentação
 */

import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Date Formatting
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy', { locale: ptBR })
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy HH:mm', { locale: ptBR })
}

// Curta e sem ambiguidade (dia/mes, nunca nomes de mes que dependem de ICU
// no runtime de producao — ver bug da Agenda a mostrar "09/01" em vez de "1 set.")
export function formatDateTimeShort(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM HH:mm', { locale: ptBR })
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'HH:mm', { locale: ptBR })
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatDistanceToNow(d, { addSuffix: true, locale: ptBR })
}

// Number Formatting
export function formatCurrency(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency,
  }).format(value)
}

export function formatPercentage(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`
}

export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('pt-PT', { maximumFractionDigits: decimals })
}

// Duration Formatting
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)

  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return `${hours}h ${remainingMinutes}m`
}

export function formatDurationLong(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)} segundo${Math.round(seconds) !== 1 ? 's' : ''}`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)

  if (minutes < 60) {
    return `${minutes} minuto${minutes !== 1 ? 's' : ''} e ${remainingSeconds} segundo${remainingSeconds !== 1 ? 's' : ''}`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return `${hours} hora${hours !== 1 ? 's' : ''} e ${remainingMinutes} minuto${remainingMinutes !== 1 ? 's' : ''}`
}

// Phone Formatting
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')

  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5)}`
  }

  if (cleaned.length === 11 && cleaned.startsWith('351')) {
    const number = cleaned.slice(3)
    return `+351 ${number.slice(0, 2)} ${number.slice(2, 5)} ${number.slice(5)}`
  }

  return phone
}

// NIF Formatting
export function formatNIF(nif: string): string {
  const cleaned = nif.replace(/\D/g, '')
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`
  }
  return nif
}

// Postal Code Formatting
export function formatPostalCode(postalCode: string): string {
  const cleaned = postalCode.replace(/\D/g, '')
  if (cleaned.length === 7) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`
  }
  return postalCode
}

// Name Formatting
export function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim()
}

export function formatNameInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

// Address Formatting
export function formatAddress(
  address: string,
  postalCode: string,
  city: string
): string {
  const parts = [address, postalCode, city].filter(Boolean)
  return parts.join(', ')
}

// Status Labels with Colors
export function getStatusColor(status: string): string {
  const colors: { [key: string]: string } = {
    // Lead Status
    novo: 'bg-blue-50 text-blue-700 border-blue-200',
    contactado: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    vendido: 'bg-green-50 text-green-700 border-green-200',
    nao_interessado: 'bg-red-50 text-red-700 border-red-200',
    agendar: 'bg-purple-50 text-purple-700 border-purple-200',
    outras: 'bg-gray-50 text-gray-700 border-gray-200',
    // Campaign Status / User Status (shared "active")
    draft: 'bg-gray-50 text-gray-700 border-gray-200',
    active: 'bg-green-50 text-green-700 border-green-200',
    paused: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    completed: 'bg-blue-50 text-blue-700 border-blue-200',
    inactive: 'bg-gray-50 text-gray-700 border-gray-200',
  }

  return colors[status] || 'bg-gray-50 text-gray-700 border-gray-200'
}

// Truncate Text
export function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) {
    return text
  }
  return text.substring(0, maxLength) + '...'
}

// Capitalize
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

// Slug
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
