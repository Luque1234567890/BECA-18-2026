import { api, assertSameOrigin, clean, cookie, hashPassword, json, normalEmail, phone, query, readJson, requireMethod, signSession } from '../_lib.js';
export default api(async request => {
  requireMethod(request, 'POST'); assertSameOrigin(request);
  const body = await readJson(request);
  const firstName = clean(body.firstName, 100), lastName = clean(body.lastName, 100), email = normalEmail(body.email), mobile = phone(body.phone);
  const department = clean(body.department, 100), province = clean(body.province, 100), district = clean(body.district, 100);
  if (![firstName, lastName, department, province, district].every(value => value.length >= 2)) return new Response(JSON.stringify({ error: 'Completa todos los campos de ubicación y nombre.' }), { status: 422, headers: { 'content-type': 'application/json' } });
  const passwordHash = hashPassword(body.password);
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const role = adminEmail && email === adminEmail ? 'admin' : 'student';
  const client = await (await import('../_lib.js')).db().connect();
  try {
    await client.query('BEGIN');
    const user = await client.query('INSERT INTO users (first_name,last_name,email,phone,password_hash,role) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,first_name,last_name,email,phone,role', [firstName, lastName, email, mobile, passwordHash, role]);
    await client.query('INSERT INTO profiles (user_id,department,province,district) VALUES ($1,$2,$3,$4)', [user.rows[0].id, department, province, district]);
    await client.query('COMMIT');
    return json({ user: user.rows[0] }, 201, { 'set-cookie': cookie(signSession(user.rows[0])) });
  } catch (cause) { await client.query('ROLLBACK'); if (cause.code === '23505') return json({ error: 'Este correo ya está registrado.' }, 409); throw cause; } finally { client.release(); }
});
