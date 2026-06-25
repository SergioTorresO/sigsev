import { randomUUID } from 'crypto'
import supabase from './supabase'

// Bucket público "evidences" en Supabase Storage (creado vía migración/MCP).
// Público porque las fotos no contienen información sensible — solo señales
// viales en espacio público — y simplifica mostrarlas en el frontend sin URLs firmadas.
const BUCKET = 'evidences'

/**
 * Sube una foto de evidencia (inspección o mantenimiento) a Supabase Storage
 * y devuelve la URL pública para guardarla en `evidences.image_url`.
 */
export const uploadEvidenceImage = async (file: Express.Multer.File, pathPrefix: string): Promise<string> => {
  const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase()
  const path = `${pathPrefix}/${randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  })

  if (error) throw new Error(`Error subiendo evidencia: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
