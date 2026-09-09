-- Ejecutar una vez contra la base PostgreSQL vinculada a Vercel.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE membership_status AS ENUM ('pending', 'active', 'expired', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'approved', 'rejected', 'refunded');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL CHECK (char_length(first_name) BETWEEN 2 AND 100),
  last_name TEXT NOT NULL CHECK (char_length(last_name) BETWEEN 2 AND 100),
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL CHECK (char_length(phone) BETWEEN 7 AND 20),
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  province TEXT NOT NULL,
  district TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('basic', 'complete')),
  price NUMERIC(10,2) NOT NULL CHECK (price IN (39.00, 100.00)),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  status membership_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX subscriptions_user_status_idx ON subscriptions (user_id, status);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  provider_payment_id TEXT UNIQUE,
  provider_preference_id TEXT UNIQUE,
  external_reference TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'PEN',
  status payment_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);
CREATE INDEX payments_subscription_idx ON payments (subscription_id);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);
-- Fecha provisional definida por el administrador: domingo 15/11/2026.
-- Puede cambiarse desde /admin cuando PRONABEC publique el cronograma oficial.
INSERT INTO app_settings (key, value) VALUES ('exam_date', '2026-11-15') ON CONFLICT (key) DO NOTHING;

CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Banco inicial autónomo. Puede ampliarse sin cambiar el código de la aplicación.
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('mathematics', 'reading')),
  level SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 3),
  prompt TEXT NOT NULL,
  options JSONB NOT NULL CHECK (jsonb_typeof(options) = 'array'),
  correct_option SMALLINT NOT NULL CHECK (correct_option BETWEEN 0 AND 3),
  explanation TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('diagnostic', 'simulator')),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('started', 'submitted')),
  total_questions SMALLINT NOT NULL,
  correct_answers SMALLINT NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  category_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX assessment_attempts_user_idx ON assessment_attempts (user_id, submitted_at DESC);

CREATE TABLE assessment_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  selected_option SMALLINT NOT NULL CHECK (selected_option BETWEEN 0 AND 3),
  is_correct BOOLEAN NOT NULL
);

CREATE TABLE study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  focus JSONB NOT NULL,
  recommendation TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO questions (category,level,prompt,options,correct_option,explanation) VALUES
('mathematics',1,'¿Cuál es el resultado de 18 + 27?', '["35","45","55","65"]',1,'18 + 27 = 45.'),
('mathematics',1,'Un cuaderno cuesta S/8. ¿Cuánto cuestan 3 cuadernos?', '["S/11","S/16","S/24","S/32"]',2,'Multiplica 8 × 3 para obtener S/24.'),
('mathematics',2,'Si 3x = 21, ¿cuál es el valor de x?', '["5","6","7","8"]',2,'Divide ambos lados entre 3: x = 7.'),
('mathematics',2,'¿Cuál es el 25% de 80?', '["10","20","25","30"]',1,'25% equivale a 1/4; la cuarta parte de 80 es 20.'),
('mathematics',3,'Un rectángulo mide 8 cm de largo y 5 cm de ancho. ¿Cuál es su área?', '["13 cm²","26 cm²","40 cm²","80 cm²"]',2,'Área = largo × ancho = 8 × 5 = 40 cm².'),
('mathematics',3,'Una cantidad aumenta de 120 a 150. ¿Cuál es el aumento porcentual?', '["20%","25%","30%","35%"]',1,'El aumento es 30; 30/120 = 0,25 = 25%.'),
('reading',1,'Lee: “Lucía estudia cada tarde porque quiere mejorar sus resultados”. ¿Cuál es la idea principal?', '["Lucía no estudia","Lucía busca mejorar mediante el estudio","Lucía estudia solo por la mañana","Lucía cambió de colegio"]',1,'La oración explica que estudia para mejorar sus resultados.'),
('reading',1,'¿Cuál palabra es un sinónimo de “rápido”?', '["Lento","Veloz","Pesado","Lejano"]',1,'Veloz y rápido tienen un significado equivalente.'),
('reading',2,'Lee: “Aunque llovía, el equipo llegó puntualmente”. ¿Qué expresa “aunque”?', '["Una causa","Una oposición","Una conclusión","Una enumeración"]',1,'Indica contraste entre lluvia y puntualidad.'),
('reading',2,'En un texto argumentativo, la evidencia sirve principalmente para:', '["Decorar el texto","Sostener una idea","Cambiar de tema","Repetir el título"]',1,'La evidencia respalda la postura o idea principal.'),
('reading',3,'Si un autor presenta datos y luego concluye que se debe actuar, su propósito es principalmente:', '["Narrar una historia","Convencer al lector","Describir un paisaje","Definir una palabra"]',1,'Los datos se usan para persuadir o sustentar una propuesta.'),
('reading',3,'¿Qué estrategia ayuda más a inferir el significado de una palabra desconocida?', '["Ignorarla","Repetirla sin leer","Revisar el contexto cercano","Buscar solo la primera letra"]',2,'Las palabras y oraciones cercanas aportan pistas de significado.');
