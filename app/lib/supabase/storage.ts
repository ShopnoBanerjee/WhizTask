import { createClient } from '@/lib/supabase/client'
import { MAX_FILE_SIZE, type TaskAttachment } from '@/types/database'

export function validateFileSize(file: File): boolean {
  return file.size <= MAX_FILE_SIZE
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export async function uploadTaskAttachment(
  orgId: string,
  taskId: string,
  file: File
): Promise<TaskAttachment | null> {
  if (!validateFileSize(file)) {
    throw new Error(`File size exceeds ${formatFileSize(MAX_FILE_SIZE)} limit`)
  }

  const supabase = createClient()
  const filePath = `${orgId}/tasks/${taskId}/${Date.now()}-${file.name}`

  const { error } = await supabase.storage
    .from('WhizTask')
    .upload(filePath, file)

  if (error) {
    console.error('Upload error:', error)
    return null
  }

  return {
    name: file.name,
    path: filePath,
    size: file.size,
  }
}

export async function getSignedUrl(path: string): Promise<string | null> {
  const supabase = createClient()

  const { data, error } = await supabase.storage
    .from('WhizTask')
    .createSignedUrl(path, 3600) // 1 hour expiry

  if (error) {
    console.error('Signed URL error:', error)
    return null
  }

  return data.signedUrl
}

export async function deleteAttachment(path: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase.storage
    .from('WhizTask')
    .remove([path])

  if (error) {
    console.error('Delete error:', error)
    return false
  }

  return true
}
