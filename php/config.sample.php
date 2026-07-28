<?php
/**
 * Copiar este archivo como config.php (mismo directorio) y completar con los datos reales.
 * config.php NO se sube a git (ver .gitignore) porque contiene una contraseña.
 *
 * SMTP_PASS debe ser una "Contraseña de aplicación" de Google Workspace, generada en:
 * https://myaccount.google.com/apppasswords (la cuenta de Workspace debe tener
 * la verificación en 2 pasos activada para poder generarla).
 */

return [
    'smtp_host'     => 'smtp.gmail.com',
    'smtp_port'     => 587,
    'smtp_user'     => 'info@longevityargentina.com',
    'smtp_pass'     => 'REEMPLAZAR_CON_CONTRASENA_DE_APLICACION',
    'mail_to'       => 'info@longevityargentina.com',
    'mail_from'     => 'info@longevityargentina.com',
    'mail_from_name'=> 'Web Longevity Argentina',
];
