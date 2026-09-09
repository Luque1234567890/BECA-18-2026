import crypto from 'node:crypto';
import { api, db, error, json, query, requireMethod } from '../_lib.js';
function verifySignature(request, url) { const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET; if (!secret) return false; const signature = request.headers.get('x-signature') || ''; const requestId = request.headers.get('x-request-id') || ''; const parts = Object.fromEntries(signature.split(',').map(item => item.trim().split('='))); const paymentId = new URL(url).searchParams.get('data.id') || ''; const manifest = `id:${paymentId};request-id:${requestId};ts:${parts.ts || ''};`; const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex'); const received = Buffer.from(parts.v1 || '', 'hex'); const calculated = Buffer.from(expected, 'hex'); return received.length === calculated.length && received.length > 0 && crypto.timingSafeEqual(received, calculated); }
export default api(async request => {
  requireMethod(request, 'POST'); if (!verifySignature(request, request.url)) return error('Firma de webhook inválida.', 401);
  const paymentId = new URL(request.url).searchParams.get('data.id'); if (!paymentId || !process.env.MERCADOPAGO_ACCESS_TOKEN) return error('Notificación incompleta.', 400);
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` } }); if (!response.ok) return error('No se pudo verificar el pago.', 502); const remote = await response.json(); const reference = remote.external_reference; if (!reference?.startsWith('beca18-')) return json({ ignored: true });
  const client = await db().connect();
  try { await client.query('BEGIN'); const payment = (await client.query('SELECT p.*,s.plan,s.id AS subscription_id FROM payments p JOIN subscriptions s ON s.id=p.subscription_id WHERE p.external_reference=$1 FOR UPDATE', [reference])).rows[0]; if (!payment) { await client.query('ROLLBACK'); return json({ ignored: true }); }
    const mapped = remote.status === 'approved' ? 'approved' : remote.status === 'rejected' ? 'rejected' : remote.status === 'refunded' ? 'refunded' : 'pending';
    await client.query('UPDATE payments SET provider_payment_id=$1,status=$2,approved_at=CASE WHEN $2=\'approved\' THEN NOW() ELSE approved_at END WHERE id=$3', [String(remote.id), mapped, payment.id]);
    if (mapped === 'approved') {
      if (payment.plan === 'basic') {
        await client.query("UPDATE subscriptions SET status='active',start_date=NOW(),end_date=NOW()+INTERVAL '30 days' WHERE id=$1", [payment.subscription_id]);
      } else {
        const setting = (await client.query("SELECT value FROM app_settings WHERE key='exam_date' FOR UPDATE")).rows[0]?.value;
        if (!setting || Number.isNaN(Date.parse(setting))) throw Object.assign(new Error('La fecha del examen no está configurada.'), { status: 409 });
        await client.query("UPDATE subscriptions SET status='active',start_date=NOW(),end_date=($1::date + INTERVAL '1 day') AT TIME ZONE 'America/Lima' WHERE id=$2", [setting, payment.subscription_id]);
      }
    } else if (mapped === 'refunded' && payment.status === 'approved') await client.query("UPDATE subscriptions SET status='cancelled' WHERE id=$1", [payment.subscription_id]);
    await client.query('COMMIT'); return json({ ok: true });
  } catch (cause) { await client.query('ROLLBACK'); throw cause; } finally { client.release(); }
});
