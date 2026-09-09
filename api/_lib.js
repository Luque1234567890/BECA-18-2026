import crypto from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
let pool;
export const PLANS = Object.freeze({ basic: { price: 39, label: 'Preparación Básica' }, complete: { price: 100, label: 'Preparación Completa' } });

// El simulador existe únicamente para desarrollar en una máquina local. Vercel
// define VERCEL incluso en previsualizaciones, por lo que no puede habilitarse
// por accidente en ningún despliegue.
export function isLocalMockPayments() {
  return process.env.PAYMENT_PROVIDER === 'mock' && !process.env.VERCEL && process.env.NODE_ENV !== 'production';
}

export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está configurada.');
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false } });
  return pool;
}
export const query = (text, params) => db().query(text, params);
export const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
export const error = (message, status = 400) => json({ error: message }, status);

export function readJson(request) { return request.json().catch(() => { throw Object.assign(new Error('JSON inválido.'), { status: 400 }); }); }
export function requireMethod(request, method) { if (request.method !== method) throw Object.assign(new Error('Método no permitido.'), { status: 405 }); }
export function assertSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw Object.assign(new Error('Origen no permitido.'), { status: 403 });
}
export function clean(value, max = 150) { return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : ''; }
export function normalEmail(value) { const email = clean(value, 254).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Correo inválido.'), { status: 422 }); return email; }
export function phone(value) { const number = String(value ?? '').replace(/[^\d+]/g, ''); if (!/^\+?\d{7,15}$/.test(number)) throw Object.assign(new Error('Celular inválido.'), { status: 422 }); return number; }
export function password(value) { if (typeof value !== 'string' || value.length < 10 || value.length > 128) throw Object.assign(new Error('La contraseña debe tener entre 10 y 128 caracteres.'), { status: 422 }); return value; }
export function hashPassword(value) { const salt = crypto.randomBytes(16).toString('hex'); const hash = crypto.pbkdf2Sync(value, salt, 310000, 32, 'sha256').toString('hex'); return `pbkdf2$310000$${salt}$${hash}`; }
export function verifyPassword(value, stored) { const [kind, rounds, salt, expected] = String(stored).split('$'); if (kind !== 'pbkdf2' || !rounds || !salt || !expected) return false; const hash = crypto.pbkdf2Sync(value, salt, Number(rounds), 32, 'sha256').toString('hex'); return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expected, 'hex')); }
function secret() { if (!process.env.APP_SESSION_SECRET || process.env.APP_SESSION_SECRET.length < 32) throw new Error('APP_SESSION_SECRET debe tener al menos 32 caracteres.'); return process.env.APP_SESSION_SECRET; }
function b64(value) { return Buffer.from(value).toString('base64url'); }
export function signSession(user) { const payload = b64(JSON.stringify({ sub: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 })); const signature = crypto.createHmac('sha256', secret()).update(payload).digest('base64url'); return `${payload}.${signature}`; }
export function sessionFrom(request) { const raw = request.headers.get('cookie')?.match(/(?:^|;\s*)beca_session=([^;]+)/)?.[1]; if (!raw) return null; const [payload, signature] = raw.split('.'); const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url'); const received = Buffer.from(signature || ''); const calculated = Buffer.from(expected); if (!signature || received.length !== calculated.length || !crypto.timingSafeEqual(received, calculated)) return null; try { const user = JSON.parse(Buffer.from(payload, 'base64url').toString()); return user.exp > Date.now() / 1000 ? user : null; } catch { return null; } }
export function cookie(token) { return `beca_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`; }
export const clearCookie = 'beca_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
export function requireUser(request) { const user = sessionFrom(request); if (!user) throw Object.assign(new Error('Debes iniciar sesión.'), { status: 401 }); return user; }
export function requireAdmin(request) { const user = requireUser(request); if (user.role !== 'admin') throw Object.assign(new Error('Acceso de administrador requerido.'), { status: 403 }); return user; }
export function api(handler) { return async request => { try { return await handler(request); } catch (cause) { const status = cause.status || 500; if (status === 500) console.error(cause); return error(status === 500 ? 'Error interno del servidor.' : cause.message, status); } }; }
export function newIdempotencyKey(request) { const key = request.headers.get('idempotency-key'); if (!key || !/^[a-zA-Z0-9_-]{16,128}$/.test(key)) throw Object.assign(new Error('Se requiere una clave de idempotencia válida.'), { status: 422 }); return key; }
