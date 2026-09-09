import { api, json, query, requireUser } from './_lib.js';
export default api(async request => {
  const user = requireUser(request); const attempt = (await query('SELECT category_scores,score FROM assessment_attempts WHERE user_id=$1 ORDER BY submitted_at DESC LIMIT 1', [user.sub])).rows[0];
  if (!attempt) return json({ ready: false, message: 'Completa el diagnóstico inicial para generar tu plan automático.' });
  const scores = attempt.category_scores; const weak = Object.entries(scores).sort((a,b) => (a[1].correct / Math.max(a[1].total,1)) - (b[1].correct / Math.max(b[1].total,1))).map(([category]) => category); const labels = { mathematics: 'Matemática', reading: 'Comprensión lectora' }; const focus = weak.map((category, index) => ({ category, label: labels[category], sessions: index === 0 ? 3 : 2 })); const recommendation = `Prioriza ${labels[weak[0]]} con 3 sesiones semanales y complementa con ${labels[weak[1]]} en 2 sesiones. Repite un simulacro al finalizar la semana.`;
  await query('INSERT INTO study_plans (user_id,focus,recommendation) VALUES ($1,$2,$3)', [user.sub, JSON.stringify(focus), recommendation]); return json({ ready: true, score: attempt.score, focus, recommendation });
});
