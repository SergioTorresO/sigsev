import { Resend } from 'resend'

const resendApiKey = process.env.RESEND_API_KEY
const fromAddress = process.env.RESEND_FROM ?? 'SIGSEV <onboarding@resend.dev>'

const resend = resendApiKey ? new Resend(resendApiKey) : null

// Si no hay RESEND_API_KEY configurada, no enviamos correo de verdad:
// el flujo de "olvidé mi contraseña" sigue funcionando en modo desarrollo
// devolviendo el enlace en la respuesta del API (ver auth.service.ts).
export const isEmailConfigured = () => resend !== null

export const sendPasswordResetEmail = async (to: string, resetLink: string) => {
  if (!resend) {
    throw new Error('RESEND_API_KEY no configurada')
  }

  const { error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject: 'Recupera tu contraseña — SIGSEV',
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
        <p style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#059669;margin-bottom:4px">
          Inventario vial
        </p>
        <h1 style="font-size:20px;margin:0 0 16px">SIGSEV</h1>
        <p>Recibimos una solicitud para restablecer tu contraseña. Si no fuiste tú, puedes ignorar este correo.</p>
        <p style="margin:24px 0">
          <a href="${resetLink}"
             style="background:#059669;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
            Restablecer contraseña
          </a>
        </p>
        <p style="font-size:12px;color:#71717a">
          Este enlace expira en 1 hora. Si el botón no funciona, copia y pega este enlace en tu navegador:<br/>
          <a href="${resetLink}" style="color:#059669">${resetLink}</a>
        </p>
      </div>
    `,
  })

  if (error) {
    throw new Error(`Error enviando correo: ${error.message}`)
  }
}
