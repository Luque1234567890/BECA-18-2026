-- Ejecutar una sola vez en la base ya creada, solo si conserva una fecha vacía.
-- La fecha es provisional y se podrá actualizar desde el panel de administración.
INSERT INTO app_settings (key, value)
VALUES ('exam_date', '2026-11-15')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW()
WHERE app_settings.value = '';
