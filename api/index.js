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

export default async function handler(request) {
  const path = new URL(request.url).pathname.replace(/\/$/, '') || '/api';
  const route = routes.get(path);
  if (route) return route(request);
  return new Response(JSON.stringify({ error: 'Ruta no encontrada.' }), { status: 404, headers: { 'content-type': 'application/json; charset=utf-8' } });
}
