import crypto from 'node:crypto';
import { api, assertSameOrigin, clean, error, json, normalEmail, phone, query, readJson, requireMethod } from './_lib.js';

const value = (body, name, max, min = 1) => {
  const result = clean(body[name], max);
  if (result.length < min) throw Object.assign(new Error(`Completa el campo: ${name}.`), { status: 422 });
  return result;
};

export default api(async request => {
  requireMethod(request, 'POST');
  assertSameOrigin(request);
  const body = await readJson(request);
  const claimType = body.claimType;
  if (!['reclamo', 'queja'].includes(claimType)) return error('Selecciona si deseas registrar un reclamo o una queja.', 422);
  const documentType = body.documentType;
  if (!['DNI', 'CE', 'Pasaporte', 'Otro'].includes(documentType)) return error('Selecciona un tipo de documento válido.', 422);
  if (body.privacyAccepted !== true) return error('Debes autorizar el tratamiento de tus datos para registrar tu solicitud.', 422);
  const amountText = clean(body.amount, 20).replace(',', '.');
  const amount = amountText ? Number(amountText) : null;
  if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 100000)) return error('El monto debe ser válido.', 422);
  const claimCode = `LR-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  await query(
    `INSERT INTO consumer_claims (claim_code,claim_type,first_name,last_name,document_type,document_number,email,phone,address,parent_or_guardian,service_description,amount,detail,request_detail,privacy_accepted)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true)`,
    [claimCode, claimType, value(body, 'firstName', 100, 2), value(body, 'lastName', 100, 2), documentType, value(body, 'documentNumber', 30, 4), normalEmail(body.email), phone(body.phone), value(body, 'address', 300, 5), clean(body.parentOrGuardian, 200) || null, value(body, 'serviceDescription', 500, 5), amount, value(body, 'detail', 5000, 10), value(body, 'requestDetail', 3000, 5)]
  );
  return json({ claimCode, message: 'Tu solicitud fue registrada correctamente.' }, 201);
});
