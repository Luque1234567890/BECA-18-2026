import account from '../server/account.js';
import preparation from '../server/access/preparation.js';
import adminExamDate from '../server/admin/exam-date.js';
import adminOverview from '../server/admin/overview.js';
import adminParticipants from '../server/admin/participants.js';
import assessmentQuestions from '../server/assessments/questions.js';
import assessmentSubmit from '../server/assessments/submit.js';
import forgotPassword from '../server/auth/forgot-password.js';
import login from '../server/auth/login.js';
import logout from '../server/auth/logout.js';
import me from '../server/auth/me.js';
import register from '../server/auth/register.js';
import resetPassword from '../server/auth/reset-password.js';
import createPayment from '../server/payments/create.js';
import mockApprove from '../server/payments/mock-approve.js';
import paymentWebhook from '../server/payments/webhook.js';
import progress from '../server/progress.js';
import studyPlan from '../server/study-plan.js';

const routes = new Map([
  ['/api/account', account], ['/api/access/preparation', preparation],
  ['/api/admin/exam-date', adminExamDate], ['/api/admin/overview', adminOverview], ['/api/admin/participants', adminParticipants],
  ['/api/assessments/questions', assessmentQuestions], ['/api/assessments/submit', assessmentSubmit],
  ['/api/auth/forgot-password', forgotPassword], ['/api/auth/login', login], ['/api/auth/logout', logout], ['/api/auth/me', me], ['/api/auth/register', register], ['/api/auth/reset-password', resetPassword],
  ['/api/payments/create', createPayment], ['/api/payments/mock-approve', mockApprove], ['/api/payments/webhook', paymentWebhook],
  ['/api/progress', progress], ['/api/study-plan', studyPlan]
]);

function requestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Vercel ejecuta las funciones Node con req/res. Los módulos de la aplicación
// usan la API web Request/Response, por lo que este borde las adapta.
export default async function handler(req, res) {
  const host = req.headers.host || 'localhost';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await requestBody(req);
  const request = new Request(`${protocol}://${host}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: body?.length ? body : undefined
  });
  const path = new URL(request.url).pathname.replace(/\/$/, '') || '/api';
  const route = routes.get(path);
  const response = route
    ? await route(request)
    : new Response(JSON.stringify({ error: 'Ruta no encontrada.' }), { status: 404, headers: { 'content-type': 'application/json; charset=utf-8' } });
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.status(response.status).send(Buffer.from(await response.arrayBuffer()));
}
