import multer from 'multer'

// Multer en memoria para certificados de calibración de cámaras (PDF o foto
// escaneada). Mismo patrón que lib/imageUpload.ts: buffer en memoria, nunca a
// disco, validado por extensión y MIME antes de subir a Supabase Storage.
// Límite más alto que las evidencias (10MB) porque un PDF escaneado pesa más
// que una foto jpg/webp comprimida.
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp']
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

export const certificateUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname ?? '').toLowerCase()
    const hasAllowedExtension = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))
    const hasAllowedMimeType = ALLOWED_MIME_TYPES.includes(file.mimetype)

    if (!hasAllowedExtension || !hasAllowedMimeType) {
      return cb(new Error('Solo se permiten archivos PDF, JPG, PNG o WEBP'))
    }
    cb(null, true)
  },
})
