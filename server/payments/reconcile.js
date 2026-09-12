import { api, db, error, json, readJson, requireMethod, requireUser } from '../_lib.js';

export default api(async request => {
  requireMethod(request, 'POST');
  const user = requireUser(request);
  const { paymentId } = await readJson(request);
  let response;
  if (paymentId) {
    if (!/^\d+$/.test(String(paymentId))) return error('Pago inválido.', 422);
    response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` } });
  } else {
    const pending = (await db().query("SELECT external_reference FROM payments WHERE user_id=$1 AND provider='mercadopago' AND status='pending' ORDER BY created_at DESC LIMIT 1", [user.sub])).rows[0];
    if (!pending) return json({ reconciled: false });
    const search = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(pending.external_reference)}`, { headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` } });
    if (!search.ok) return error('No se pudo verificar el pago.', 502);
    const remote = (await search.json()).results?.find(item => item.status === 'approved');
    if (!remote) return json({ reconciled: false });
    response = new Response(JSON.stringify(remote), { status: 200 });
  }
  if (!response.ok) return error('No se pudo verificar el pago.', 502);
  const remote = await response.json();
  if (remote.status !== 'approved' || !remote.external_reference?.startsWith('beca18-')) return error('El pago aún no está aprobado.', 409);
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    const payment = (await client.query('SELECT p.id,p.subscription_id,s.plan FROM payments p JOIN subscriptions s ON s.id=p.subscription_id WHERE p.user_id=$1 AND p.external_reference=$2 FOR UPDATE', [user.sub, remote.external_reference])).rows[0];
    if (!payment) { await client.query('ROLLBACK'); return error('El pago no pertenece a esta cuenta.', 403); }
    await client.query("UPDATE payments SET provider_payment_id=$1,status='approved',approved_at=COALESCE(approved_at,NOW()) WHERE id=$2", [String(remote.id), payment.id]);
    if (payment.plan === 'basic') await client.query("UPDATE subscriptions SET status='active',start_date=COALESCE(start_date,NOW()),end_date=COALESCE(end_date,NOW()+INTERVAL '30 days') WHERE id=$1", [payment.subscription_id]);
    else return error('El plan completo requiere fecha de examen configurada.', 409);
    await client.query('COMMIT'); return json({ ok: true });
  } catch (cause) { await client.query('ROLLBACK'); throw cause; } finally { client.release(); }
});
