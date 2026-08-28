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

    /* ── Opcionales ────────────────────────────────────────────────────────
       smtp_secure   'tls' (STARTTLS, puerto 587) o 'ssl' (SMTPS, puerto 465).
                     Si se omite, se usa STARTTLS.
       smtp_timeout  Segundos de espera al conectar. Bajo a proposito: si el
                     hosting bloquea el puerto SMTP, queremos fallar rapido y
                     mostrar el aviso, no colgarnos hasta el fatal de PHP.
       smtp_debug    true escribe el dialogo SMTP en php/logs/form.log (sin las
                     credenciales). Dejarlo en true mientras se diagnostica y
                     pasarlo a false cuando el formulario ande.
       ------------------------------------------------------------------- */
    'smtp_secure'   => 'tls',
    'smtp_timeout'  => 8,
    'smtp_debug'    => true,
];
