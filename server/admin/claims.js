import { api, assertSameOrigin, clean, error, json, query, readJson, requireAdmin } from '../_lib.js';

export default api(async request => {
  requireAdmin(request);
  if (request.method === 'GET') {
    const result = await query(`SELECT claim_code,claim_type,first_name,last_name,email,phone,address,parent_or_guardian,service_description,amount,detail,request_detail,status,response_detail,created_at,responded_at FROM consumer_claims ORDER BY created_at DESC LIMIT 100`);
    return json({ claims: result.rows });
  }
  if (request.method !== 'PUT') return error('Método no permitido.', 405);
  assertSameOrigin(request);
  const body = await readJson(request);
  const status = body.status;
  if (!['received', 'in_progress', 'resolved'].includes(status)) return error('Estado inválido.', 422);
  const claimCode = clean(body.claimCode, 40);
  const responseDetail = clean(body.responseDetail, 5000);
  if (!claimCode || (status === 'resolved' && responseDetail.length < 5)) return error('Incluye una respuesta antes de marcar el caso como resuelto.', 422);
  const updated = await query(`UPDATE consumer_claims SET status=$1,response_detail=$2,responded_at=CASE WHEN $3='resolved' THEN NOW() ELSE responded_at END WHERE claim_code=$4 RETURNING claim_code`, [status, responseDetail || null, status, claimCode]);
  if (!updated.rows[0]) return error('No se encontró la solicitud.', 404);
  return json({ message: 'Solicitud actualizada.' });
});
