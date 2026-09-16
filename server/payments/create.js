import crypto from 'node:crypto';
import { api, assertSameOrigin, db, error, isLocalMockPayments, json, newIdempotencyKey, PLANS, query, readJson, recordLegalAcceptance, requireMethod, requireUser } from '../_lib.js';
export default api(async request => {
  requireMethod(request, 'POST'); assertSameOrigin(request); const user = requireUser(request); const { plan, termsAccepted } = await readJson(request); const selected = PLANS[plan]; if (!selected) return error('Plan inválido.', 422); if (termsAccepted !== true) return error('Debes aceptar los Términos y Condiciones y la Política de Privacidad antes de continuar.', 422); const idempotencyKey = newIdempotencyKey(request);
  const localMock = isLocalMockPayments();
  if (process.env.VERCEL_ENV === 'production' && process.env.PAYMENTS_ENABLED !== 'true') return error('Los pagos aún no están habilitados para el público.', 503);
  if (!localMock && (!process.env.MERCADOPAGO_ACCESS_TOKEN || !process.env.APP_URL)) throw Object.assign(new Error('El pago de prueba aún no está configurado.'), { status: 503 });
  const existing = await query('SELECT p.id,p.status,p.provider_preference_id,p.external_reference FROM payments p WHERE p.user_id=$1 AND p.idempotency_key=$2', [user.sub, idempotencyKey]);
  if (existing.rows[0]?.provider_preference_id) return json({ paymentId: existing.rows[0].id, status: existing.rows[0].status, checkoutUrl: null, reused: true });
  const client = await db().connect(); let payment;
  try { await client.query('BEGIN'); await recordLegalAcceptance(client, user.sub); const subscription = await client.query('INSERT INTO subscriptions (user_id,plan,price,status) VALUES ($1,$2,$3,\'pending\') RETURNING id', [user.sub, plan, selected.price]); const reference = `beca18-${subscription.rows[0].id}`; payment = (await client.query('INSERT INTO payments (user_id,subscription_id,provider,external_reference,idempotency_key,amount,currency,status) VALUES ($1,$2,$3,$4,$5,$6,\'PEN\',\'pending\') RETURNING id,external_reference', [user.sub, subscription.rows[0].id, localMock ? 'local_mock' : 'mercadopago', reference, idempotencyKey, selected.price])).rows[0]; await client.query('COMMIT'); } catch (cause) { await client.query('ROLLBACK'); throw cause; } finally { client.release(); }
  if (localMock) return json({ paymentId: payment.id, status: 'pending', mockApproval: true }, 201);
  const preference = await fetch('https://api.mercadopago.com/checkout/preferences', { method: 'POST', headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`, 'content-type': 'application/json', 'X-Idempotency-Key': idempotencyKey }, body: JSON.stringify({ items: [{ title: selected.label, quantity: 1, unit_price: selected.price, currency_id: 'PEN' }], external_reference: payment.external_reference, notification_url: `${process.env.APP_URL}/api/payments/webhook`, back_urls: { success: `${process.env.APP_URL}/mi-cuenta.html?payment=success`, failure: `${process.env.APP_URL}/mi-cuenta.html?payment=failure`, pending: `${process.env.APP_URL}/mi-cuenta.html?payment=pending` }, auto_return: 'approved' }) });
  if (!preference.ok) { console.error(await preference.text()); return error('No se pudo iniciar el pago. Inténtalo nuevamente.', 502); }
  const data = await preference.json(); await query('UPDATE payments SET provider_preference_id=$1 WHERE id=$2', [String(data.id), payment.id]);
  // En producción se debe abrir el Checkout real. sandbox_init_point es solo
  // para las pruebas con credenciales de prueba.
  const checkoutUrl = process.env.VERCEL_ENV === 'production' ? data.init_point : (data.sandbox_init_point || data.init_point);
  if (!checkoutUrl) return error('Mercado Pago no devolvió un enlace de pago.', 502);
  return json({ paymentId: payment.id, checkoutUrl, status: 'pending' }, 201);
});
