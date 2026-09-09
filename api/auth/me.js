import { api, json, query, requireUser } from '../_lib.js';
export default api(async request => { const session = requireUser(request); const result = await query('SELECT u.id,u.first_name,u.last_name,u.email,u.phone,u.role,p.department,p.province,p.district FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id=$1', [session.sub]); return json({ user: result.rows[0] }); });
