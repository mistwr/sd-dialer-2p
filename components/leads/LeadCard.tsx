'use client'

import { Lead } from '@/lib/types'
import { Badge } from '@/components/common'
import { formatPhoneNumber } from '@/lib/utils/formatters'
import { getStatusColor } from '@/lib/utils/constants'

interface LeadCardProps {
  lead: Lead
  onSelect?: (lead: Lead) => void
  onCall?: (lead: Lead) => void
  onWhatsApp?: (lead: Lead) => void
  onMaps?: (lead: Lead) => void
}

export function LeadCard({ lead, onSelect, onCall, onWhatsApp, onMaps }: LeadCardProps) {
  return (
    <div className="sd-card cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onSelect?.(lead)}>
      <div className="sd-card-body">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-gray-900">
              {lead.first_name} {lead.last_name}
            </h3>
            <p className="text-sm text-gray-600">{lead.city}</p>
          </div>
          <Badge className={getStatusColor(lead.status)}>{lead.status}</Badge>
        </div>

        <div className="space-y-2 mb-4 text-sm">
          <p className="text-gray-700">
            <span className="font-medium">Tel:</span> {formatPhoneNumber(lead.phone)}
          </p>
          {lead.mobile && (
            <p className="text-gray-700">
              <span className="font-medium">Telemóvel:</span> {formatPhoneNumber(lead.mobile)}
            </p>
          )}
          {lead.email && (
            <p className="text-gray-700">
              <span className="font-medium">Email:</span> {lead.email}
            </p>
          )}
          {lead.operator && (
            <p className="text-gray-700">
              <span className="font-medium">Operador:</span> {lead.operator}
            </p>
          )}
        </div>

        {lead.notes && (
          <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded mb-4 line-clamp-2">{lead.notes}</p>
        )}

        <div className="flex gap-2">
          {onCall && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCall(lead)
              }}
              className="sd-btn-success flex-1 text-sm"
            >
              📞 Ligar
            </button>
          )}
          {onWhatsApp && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onWhatsApp(lead)
              }}
              className="sd-btn-secondary flex-1 text-sm"
            >
              💬 WhatsApp
            </button>
          )}
          {onMaps && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMaps(lead)
              }}
              className="sd-btn-secondary flex-1 text-sm"
            >
              📍 Mapa
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
