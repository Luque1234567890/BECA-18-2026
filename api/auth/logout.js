import { api, assertSameOrigin, clearCookie, json, requireMethod } from '../_lib.js';
export default api(async request => { requireMethod(request, 'POST'); assertSameOrigin(request); return json({ ok: true }, 200, { 'set-cookie': clearCookie }); });
