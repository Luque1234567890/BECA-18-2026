import crypto from 'node:crypto';
import { api, assertSameOrigin, normalEmail, query, readJson, requireMethod, json } from '../_lib.js';
export default api(async request => {
  requireMethod(request, 'POST'); assertSameOrigin(request); const { email: supplied } = await readJson(request); const email = normalEmail(supplied); const user = (await query('SELECT id, email FROM users WHERE email=$1', [email])).rows[0];
  if (user) { const token = crypto.randomBytes(32).toString('base64url'); const hash = crypto.createHash('sha256').update(token).digest('hex'); await query('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,NOW()+INTERVAL \'30 minutes\')', [user.id, hash]);
    if (process.env.RESEND_API_KEY && process.env.APP_URL) await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [user.email], subject: 'Restablece tu contraseña', html: `<p>Usa este enlace válido por 30 minutos:</p><p><a href="${process.env.APP_URL}/restablecer-contrasena.html?token=${token}">Restablecer contraseña</a></p>` }) });
  }
  return json({ message: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña.' });
});
