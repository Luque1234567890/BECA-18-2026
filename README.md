# Impulsa Beca 18 — Membresías y pagos sandbox

Plataforma educativa privada e independiente. No pertenece, representa ni está afiliada a PRONABEC, al Ministerio de Educación ni al Estado peruano.

## Alcance de esta fase

- Registro, inicio/cierre de sesión y recuperación de contraseña.
- PostgreSQL: usuarios, perfiles, suscripciones, pagos, ajustes y tokens de recuperación.
- Dos únicos planes: **Preparación Básica S/39 por 30 días** y **Preparación Completa S/100 hasta la fecha de examen administrada**.
- Checkout Pro de Mercado Pago exclusivamente preparado para sandbox.
- Activación solo desde webhook firmado y verificado contra la API de Mercado Pago.
- Panel de cuenta, ruta protegida de preparación y panel `/admin` con métricas/búsqueda.

## Configuración inicial

1. En Vercel Marketplace, conecte una base PostgreSQL compatible (por ejemplo, Neon o Supabase) y configure `DATABASE_URL`.
2. Ejecute una vez el contenido de [`db-schema.sql`](db-schema.sql) en esa base.
3. Copie `.env.example` a `.env.local` solo para desarrollo y complete las variables requeridas. Nunca suba ese archivo ni secretos al repositorio.
4. Registre un usuario desde `/mi-cuenta`. Para promover el primer administrador, ejecute en PostgreSQL:

   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'correo-del-administrador@ejemplo.com';
   ```

5. Inicie sesión con esa cuenta y abra `/admin` para registrar la fecha del examen antes de aceptar pagos del plan Completo.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Cadena de conexión PostgreSQL inyectada por la integración. |
| `APP_SESSION_SECRET` | Secreto aleatorio de al menos 32 caracteres para firmar la sesión. |
| `ADMIN_EMAIL` | Correo que recibirá el rol administrador al registrarse por primera vez. |
| `APP_URL` | URL pública base del proyecto, sin barra final. |
| `MERCADOPAGO_ACCESS_TOKEN` | Access token de **prueba/sandbox** de Mercado Pago. |
| `MERCADOPAGO_WEBHOOK_SECRET` | Clave secreta de la notificación webhook de Mercado Pago. |
| `PAYMENT_PROVIDER` | `mercadopago` por defecto. `mock` solo permite simular pagos en local; el código lo rechaza si detecta Vercel o producción. |
| `RESEND_API_KEY` | Opcional, para enviar enlaces de recuperación. |
| `EMAIL_FROM` | Remitente verificado para los correos de recuperación. |

## Pruebas locales

Instale dependencias y ejecute:

```bash
npm install
npm run lint
npm run typecheck
npm run build
```

Para probar registro, abra `/mi-cuenta`, complete el formulario y cierre/inicie sesión. Para pago sandbox, elija uno de los dos planes desde esa misma página: el backend crea la preferencia y redirige al Checkout Pro de prueba. La redirección de regreso no activa la membresía; debe llegar el webhook firmado y el backend consulta el pago antes de activarla. El plan Completa usa inicialmente el 15/11/2026 como fecha provisional y vence al finalizar ese día en horario de Perú; el administrador puede sustituirla cuando exista cronograma oficial.

Configure en Mercado Pago la URL `https://SU-DOMINIO/api/payments/webhook` y use solamente las credenciales y tarjetas de prueba de su cuenta de desarrollador.

## Desarrollo sin credenciales de Mercado Pago

Mientras Mercado Pago habilita el sandbox, cree un `.env` local (nunca lo suba a Git) con `PAYMENT_PROVIDER=mock`. El selector de planes mostrará una confirmación explícita para simular una aprobación local; no se contacta a Mercado Pago y esta ruta devuelve 404 en Vercel o producción.
