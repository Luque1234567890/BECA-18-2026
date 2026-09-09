import { api, assertSameOrigin, db, error, isLocalMockPayments, json, readJson, requireMethod, requireUser } from '../_lib.js';

// Nunca puede aprobar pagos en Vercel. Permite validar el flujo de acceso con
// una base local antes de que Mercado Pago habilite el entorno sandbox.
export default api(async request => {
  requireMethod(request, 'POST'); assertSameOrigin(request);
  if (!isLocalMockPayments()) return error('El simulador de pagos solo está disponible localmente.', 404);
  const user = requireUser(request); const { paymentId } = await readJson(request);
  if (!/^[0-9a-f-]{36}$/i.test(String(paymentId))) return error('Pago de prueba inválido.', 422);
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT p.id,p.status,s.id AS subscription_id,s.plan FROM payments p JOIN subscriptions s ON s.id=p.subscription_id WHERE p.id=$1 AND p.user_id=$2 AND p.provider=\'local_mock\' FOR UPDATE', [paymentId, user.sub]);
    const payment = result.rows[0]; if (!payment) throw Object.assign(new Error('Orden de prueba no encontrada.'), { status: 404 });
    if (payment.status !== 'approved') {
      await client.query("UPDATE payments SET status='approved',provider_payment_id=$1,approved_at=NOW() WHERE id=$2", [`mock-${payment.id}`, payment.id]);
      if (payment.plan === 'basic') await client.query("UPDATE subscriptions SET status='active',start_date=NOW(),end_date=NOW()+INTERVAL '30 days' WHERE id=$1", [payment.subscription_id]);
      else {
        const setting = (await client.query("SELECT value FROM app_settings WHERE key='exam_date' FOR UPDATE")).rows[0]?.value;
        if (!setting || Number.isNaN(Date.parse(setting))) throw Object.assign(new Error('Configura la fecha del examen desde el panel de administración antes de probar el plan completo.'), { status: 409 });
        await client.query("UPDATE subscriptions SET status='active',start_date=NOW(),end_date=($1::date + INTERVAL '1 day') AT TIME ZONE 'America/Lima' WHERE id=$2", [setting, payment.subscription_id]);
      }
    }
    await client.query('COMMIT'); return json({ approved: true });
  } catch (cause) { await client.query('ROLLBACK'); throw cause; } finally { client.release(); }
});
