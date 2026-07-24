'use client'

import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/types'

const supabase = createClient()

export const notificationsService = {
  async createNotification(notification: Partial<Notification>) {
    try {
      const { data, error } = await supabase
        .from('notificacoes')
        .insert([notification])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async getNotifications(usuarioId: string) {
    try {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('usuario_id', usuarioId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async getUnreadNotifications(usuarioId: string) {
    try {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('usuario_id', usuarioId)
        .eq('read', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async markAsRead(notificationId: string) {
    try {
      const { data, error } = await supabase
        .from('notificacoes')
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async markAllAsRead(usuarioId: string) {
    try {
      const { data, error } = await supabase
        .from('notificacoes')
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq('usuario_id', usuarioId)
        .eq('read', false)
        .select()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async deleteNotification(notificationId: string) {
    try {
      const { error } = await supabase
        .from('notificacoes')
        .delete()
        .eq('id', notificationId)

      if (error) throw error
      return { error: null }
    } catch (error) {
      return { error }
    }
  },

  async notifyNewLead(usuarioId: string, companyId: string, leadName: string, leadId: string) {
    return this.createNotification({
      usuario_id: usuarioId,
      company_id: companyId,
      type: 'new_lead',
      title: 'Novo lead atribuído',
      message: `O lead ${leadName} foi atribuído a você.`,
      related_entity_id: leadId,
    })
  },

  async notifyFollowUp(
    usuarioId: string,
    companyId: string,
    leadName: string,
    leadId: string
  ) {
    return this.createNotification({
      usuario_id: usuarioId,
      company_id: companyId,
      type: 'follow_up_reminder',
      title: 'Follow-up pendente',
      message: `Tem um follow-up agendado para ${leadName}.`,
      related_entity_id: leadId,
    })
  },

  async notifyObjectiveReached(
    usuarioId: string,
    companyId: string,
    objectiveType: string
  ) {
    return this.createNotification({
      usuario_id: usuarioId,
      company_id: companyId,
      type: 'objective_reached',
      title: 'Objetivo atingido!',
      message: `Parabéns! Atingiu o objetivo de ${objectiveType}.`,
    })
  },

  async notifyAssignment(
    usuarioId: string,
    companyId: string,
    numberOfLeads: number
  ) {
    return this.createNotification({
      usuario_id: usuarioId,
      company_id: companyId,
      type: 'assignment',
      title: 'Leads atribuídos',
      message: `${numberOfLeads} lead(s) foram atribuídos a você.`,
    })
  },
}
