import multer from 'multer'

// Multer en memoria para fotos de evidencia (completar inspecciones/mantenimientos).
// Mismo patrón que signals/zones bulk-import: buffer en memoria, nunca a disco,
// validado por extensión y MIME antes de subir a Supabase Storage.
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname ?? '').toLowerCase()
    const hasAllowedExtension = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))
    const hasAllowedMimeType = ALLOWED_MIME_TYPES.includes(file.mimetype)

    if (!hasAllowedExtension || !hasAllowedMimeType) {
      return cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP'))
    }
    cb(null, true)
  },
})
