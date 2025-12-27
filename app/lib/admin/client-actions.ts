'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
  ClientFull,
  ClientWithCalculations,
  Software,
  SoftwareWithSubscribers,
  Overhead,
  AuditLog,
  AuditLogWithUser,
  AuditAction,
  AuditEntity,
  OverheadCategory,
} from '@/types/database'

// ============ HELPERS ============

async function getOrgId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  return profile?.org_id || null
}

async function createAuditLog(
  entityType: AuditEntity,
  entityId: string,
  entityName: string,
  action: AuditAction,
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = await getOrgId()

  if (!user || !orgId) return

  await supabase.from('audit_logs').insert({
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    action,
    old_value: oldValue,
    new_value: newValue,
    changed_by: user.id,
    org_id: orgId,
  })
}

// ============ CLIENTS ============

export async function getClientsWithCalculations(): Promise<ClientWithCalculations[]> {
  const supabase = await createClient()
  const orgId = await getOrgId()
  if (!orgId) return []

  // Fetch clients
  const { data: clients, error } = await supabase
    .from('clients')
    .select('*')
    .eq('org_id', orgId)
    .order('name')

  if (error || !clients) return []

  // Fetch software and subscriptions
  const { data: software } = await supabase
    .from('software')
    .select('*, software_subscriptions(client_id)')
    .eq('org_id', orgId)

  // Fetch overheads
  const { data: overheads } = await supabase
    .from('overheads')
    .select('*')
    .eq('org_id', orgId)

  const totalOverhead = overheads?.reduce((sum, o) => sum + (o.value_per_month || 0), 0) || 0

  // Calculate total retainership value for overhead apportionment
  const retainershipClients = clients.filter(c => c.type === 'retainership')
  const totalRetainershipValue = retainershipClients.reduce((sum, c) => sum + (c.monthly_value || 0), 0)

  return clients.map((client) => {
    const effectiveMonthlyValue = client.type === 'retainership'
      ? client.monthly_value || 0
      : client.project_duration_months
        ? (client.project_value || 0) / client.project_duration_months
        : 0

    // Calculate software cost for this client
    let softwareCost = 0
    const subscribedSoftware: Software[] = []

    software?.forEach((sw) => {
      const isSubscribed = sw.software_subscriptions?.some(
        (sub: { client_id: string }) => sub.client_id === client.id
      )
      if (isSubscribed) {
        const subscriberCount = sw.software_subscriptions?.length || 1
        softwareCost += sw.value_per_month / subscriberCount
        subscribedSoftware.push({
          id: sw.id,
          name: sw.name,
          value_per_month: sw.value_per_month,
          org_id: sw.org_id,
          created_at: sw.created_at,
          updated_at: sw.updated_at,
        })
      }
    })

    // Calculate overhead cost (only for retainership clients)
    let overheadCost = 0
    if (client.type === 'retainership' && totalRetainershipValue > 0) {
      const contribution = (client.monthly_value || 0) / totalRetainershipValue
      overheadCost = totalOverhead * contribution
    }

    const netValue = effectiveMonthlyValue - softwareCost - overheadCost

    return {
      ...client,
      contact: client.contact || {},
      effective_monthly_value: effectiveMonthlyValue,
      software_cost: Math.round(softwareCost * 100) / 100,
      overhead_cost: Math.round(overheadCost * 100) / 100,
      net_value: Math.round(netValue * 100) / 100,
      subscribed_software: subscribedSoftware,
    } as ClientWithCalculations
  })
}

export async function createClientFull(formData: FormData) {
  const supabase = await createClient()
  const orgId = await getOrgId()
  if (!orgId) return { error: 'No organization found' }

  const name = formData.get('name') as string
  const type = formData.get('type') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  const address = formData.get('address') as string
  const monthlyValue = parseFloat(formData.get('monthly_value') as string) || 0
  const projectValue = parseFloat(formData.get('project_value') as string) || null
  const projectDuration = parseInt(formData.get('project_duration_months') as string) || null
  const softwareIds = formData.getAll('software_ids') as string[]

  const contact = { email, phone, address }

  const { data, error } = await supabase.from('clients').insert({
    name,
    type,
    contact,
    monthly_value: type === 'retainership' ? monthlyValue : 0,
    project_value: type === 'project_basis' ? projectValue : null,
    project_duration_months: type === 'project_basis' ? projectDuration : null,
    org_id: orgId,
  }).select().single()

  if (error) return { error: error.message }

  // Add software subscriptions
  if (softwareIds.length > 0) {
    await supabase.from('software_subscriptions').insert(
      softwareIds.map(swId => ({
        software_id: swId,
        client_id: data.id,
      }))
    )
  }

  await createAuditLog('client', data.id, name, 'create', null, {
    name,
    type,
    monthly_value: monthlyValue,
    project_value: projectValue,
    project_duration_months: projectDuration,
    software_ids: softwareIds,
  })

  revalidatePath('/admin/clients')
  return { success: true, client: data }
}

export async function updateClientFull(clientId: string, formData: FormData) {
  const supabase = await createClient()

  // Get old values for audit
  const { data: oldClient } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  const name = formData.get('name') as string
  const type = formData.get('type') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  const address = formData.get('address') as string
  const monthlyValue = parseFloat(formData.get('monthly_value') as string) || 0
  const projectValue = parseFloat(formData.get('project_value') as string) || null
  const projectDuration = parseInt(formData.get('project_duration_months') as string) || null
  const softwareIds = formData.getAll('software_ids') as string[]

  const contact = { email, phone, address }

  const { error } = await supabase.from('clients').update({
    name,
    type,
    contact,
    monthly_value: type === 'retainership' ? monthlyValue : 0,
    project_value: type === 'project_basis' ? projectValue : null,
    project_duration_months: type === 'project_basis' ? projectDuration : null,
    updated_at: new Date().toISOString(),
  }).eq('id', clientId)

  if (error) return { error: error.message }

  // Update software subscriptions
  await supabase.from('software_subscriptions').delete().eq('client_id', clientId)
  if (softwareIds.length > 0) {
    await supabase.from('software_subscriptions').insert(
      softwareIds.map(swId => ({
        software_id: swId,
        client_id: clientId,
      }))
    )
  }

  await createAuditLog('client', clientId, name, 'update', oldClient, {
    name,
    type,
    monthly_value: monthlyValue,
    project_value: projectValue,
    project_duration_months: projectDuration,
    software_ids: softwareIds,
  })

  revalidatePath('/admin/clients')
  return { success: true }
}

export async function deleteClientFull(clientId: string) {
  const supabase = await createClient()

  const { data: client } = await supabase
    .from('clients')
    .select('name')
    .eq('id', clientId)
    .single()

  const { error } = await supabase.from('clients').delete().eq('id', clientId)
  if (error) return { error: error.message }

  await createAuditLog('client', clientId, client?.name || '', 'delete', client, null)

  revalidatePath('/admin/clients')
  return { success: true }
}

// ============ SOFTWARE ============

export async function getSoftwareWithSubscribers(): Promise<SoftwareWithSubscribers[]> {
  const supabase = await createClient()
  const orgId = await getOrgId()
  if (!orgId) return []

  const { data, error } = await supabase
    .from('software')
    .select(`
      *,
      software_subscriptions(
        client:clients(id, name)
      )
    `)
    .eq('org_id', orgId)
    .order('name')

  if (error || !data) return []

  return data.map((sw) => {
    const subscribers = sw.software_subscriptions
      ?.map((sub: { client: { id: string; name: string } }) => sub.client)
      .filter(Boolean) || []

    return {
      id: sw.id,
      name: sw.name,
      value_per_month: sw.value_per_month,
      org_id: sw.org_id,
      created_at: sw.created_at,
      updated_at: sw.updated_at,
      subscribers,
      apportioned_cost: subscribers.length > 0
        ? Math.round((sw.value_per_month / subscribers.length) * 100) / 100
        : sw.value_per_month,
    }
  })
}

export async function createSoftware(formData: FormData) {
  const supabase = await createClient()
  const orgId = await getOrgId()
  if (!orgId) return { error: 'No organization found' }

  const name = formData.get('name') as string
  const valuePerMonth = parseFloat(formData.get('value_per_month') as string) || 0
  const clientIds = formData.getAll('client_ids') as string[]

  const { data, error } = await supabase.from('software').insert({
    name,
    value_per_month: valuePerMonth,
    org_id: orgId,
  }).select().single()

  if (error) return { error: error.message }

  // Add subscriptions
  if (clientIds.length > 0) {
    await supabase.from('software_subscriptions').insert(
      clientIds.map(clientId => ({
        software_id: data.id,
        client_id: clientId,
      }))
    )
  }

  await createAuditLog('software', data.id, name, 'create', null, {
    name,
    value_per_month: valuePerMonth,
    client_ids: clientIds,
  })

  revalidatePath('/admin/clients')
  return { success: true, software: data }
}

export async function updateSoftware(softwareId: string, formData: FormData) {
  const supabase = await createClient()

  const { data: oldSoftware } = await supabase
    .from('software')
    .select('*')
    .eq('id', softwareId)
    .single()

  const name = formData.get('name') as string
  const valuePerMonth = parseFloat(formData.get('value_per_month') as string) || 0
  const clientIds = formData.getAll('client_ids') as string[]

  const { error } = await supabase.from('software').update({
    name,
    value_per_month: valuePerMonth,
    updated_at: new Date().toISOString(),
  }).eq('id', softwareId)

  if (error) return { error: error.message }

  // Update subscriptions
  await supabase.from('software_subscriptions').delete().eq('software_id', softwareId)
  if (clientIds.length > 0) {
    await supabase.from('software_subscriptions').insert(
      clientIds.map(clientId => ({
        software_id: softwareId,
        client_id: clientId,
      }))
    )
  }

  await createAuditLog('software', softwareId, name, 'update', oldSoftware, {
    name,
    value_per_month: valuePerMonth,
    client_ids: clientIds,
  })

  revalidatePath('/admin/clients')
  return { success: true }
}

export async function deleteSoftware(softwareId: string) {
  const supabase = await createClient()

  const { data: software } = await supabase
    .from('software')
    .select('name')
    .eq('id', softwareId)
    .single()

  const { error } = await supabase.from('software').delete().eq('id', softwareId)
  if (error) return { error: error.message }

  await createAuditLog('software', softwareId, software?.name || '', 'delete', software, null)

  revalidatePath('/admin/clients')
  return { success: true }
}

// ============ OVERHEADS ============

export async function getOverheads(): Promise<Overhead[]> {
  const supabase = await createClient()
  const orgId = await getOrgId()
  if (!orgId) return []

  const { data, error } = await supabase
    .from('overheads')
    .select('*')
    .eq('org_id', orgId)
    .order('category')

  return data || []
}

export async function upsertOverhead(formData: FormData) {
  const supabase = await createClient()
  const orgId = await getOrgId()
  if (!orgId) return { error: 'No organization found' }

  const category = formData.get('category') as OverheadCategory
  const valuePerMonth = parseFloat(formData.get('value_per_month') as string) || 0

  // Check if exists
  const { data: existing } = await supabase
    .from('overheads')
    .select('*')
    .eq('org_id', orgId)
    .eq('category', category)
    .single()

  if (existing) {
    const { error } = await supabase.from('overheads').update({
      value_per_month: valuePerMonth,
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id)

    if (error) return { error: error.message }

    await createAuditLog('overhead', existing.id, category, 'update', existing, {
      category,
      value_per_month: valuePerMonth,
    })
  } else {
    const { data, error } = await supabase.from('overheads').insert({
      category,
      value_per_month: valuePerMonth,
      org_id: orgId,
    }).select().single()

    if (error) return { error: error.message }

    await createAuditLog('overhead', data.id, category, 'create', null, {
      category,
      value_per_month: valuePerMonth,
    })
  }

  revalidatePath('/admin/clients')
  return { success: true }
}

// ============ AUDIT LOGS ============

export async function getAuditLogs(filters?: {
  entityType?: AuditEntity
  startDate?: string
  endDate?: string
}): Promise<AuditLogWithUser[]> {
  const supabase = await createClient()
  const orgId = await getOrgId()
  if (!orgId) return []

  let query = supabase
    .from('audit_logs')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (filters?.entityType) {
    query = query.eq('entity_type', filters.entityType)
  }

  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate)
  }

  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate)
  }

  const { data, error } = await query

  return data || []
}

// ============ SUMMARY ============

export async function getFinancialSummary() {
  const clients = await getClientsWithCalculations()
  const overheads = await getOverheads()
  const software = await getSoftwareWithSubscribers()

  const totalMonthlyRevenue = clients.reduce((sum, c) => sum + c.effective_monthly_value, 0)
  const totalSoftwareCost = software.reduce((sum, s) => sum + s.value_per_month, 0)
  const totalOverheadCost = overheads.reduce((sum, o) => sum + o.value_per_month, 0)
  const totalNetRevenue = clients.reduce((sum, c) => sum + c.net_value, 0)

  const retainershipCount = clients.filter(c => c.type === 'retainership').length
  const projectCount = clients.filter(c => c.type === 'project_basis').length

  return {
    totalMonthlyRevenue: Math.round(totalMonthlyRevenue * 100) / 100,
    totalSoftwareCost: Math.round(totalSoftwareCost * 100) / 100,
    totalOverheadCost: Math.round(totalOverheadCost * 100) / 100,
    totalNetRevenue: Math.round(totalNetRevenue * 100) / 100,
    retainershipCount,
    projectCount,
    clientCount: clients.length,
    softwareCount: software.length,
  }
}
