import { api, error, json, query, requireUser } from '../_lib.js';
export default api(async request => {
  const user = requireUser(request); const kind = new URL(request.url).searchParams.get('kind') || 'diagnostic';
  if (!['diagnostic', 'simulator'].includes(kind)) return error('Evaluación inválida.', 422);
  if (kind === 'simulator') { const membership = await query("SELECT 1 FROM subscriptions WHERE user_id=$1 AND status='active' AND end_date>=NOW()", [user.sub]); if (!membership.rowCount) return error('Necesitas una membresía activa para usar simulacros.', 403); }
  const questions = await query('SELECT id,category,level,prompt,options FROM questions WHERE is_active=true ORDER BY random() LIMIT 10');
  return json({ kind, questions: questions.rows });
});
