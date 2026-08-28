<?php
/**
 * Ajustes de TRANSPORTE del SMTP. No son secretos, asi que viven en el repo:
 * config.php lo genera el deploy desde los GitHub Secrets y solo lleva el
 * servidor, el puerto y las credenciales.
 *
 * Lo que se define aca pisa a config.php.
 *
 * ── Estado actual ─────────────────────────────────────────────────────────
 * El servidor no alcanza a smtp.gmail.com:587 (la conexion no completa y
 * agota el timeout), asi que estamos usando el relay del propio hosting,
 * relay-hosting.secureserver.net:25, que autentica por IP de origen y no
 * acepta cifrado. Host y puerto salen de los secrets SMTP_HOST y SMTP_PORT.
 *
 * ── Para volver a Gmail o pasar a Brevo ───────────────────────────────────
 *   'smtp_auth'   => true,
 *   'smtp_secure' => 'tls',
 * y cargar SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS en los secrets.
 * Brevo: smtp-relay.brevo.com, puerto 2525 (el 587 tambien esta bloqueado
 * desde este hosting).
 */

return [
    // El relay del hosting no pide usuario ni contrasenia.
    'smtp_auth'   => false,

    // 'none' desactiva el cifrado y tambien SMTPAutoTLS: sin eso PHPMailer
    // reintenta STARTTLS por su cuenta y el relay corta la sesion.
    'smtp_secure' => 'none',

    // Segundos de espera al conectar. Bajo a proposito: si el puerto esta
    // bloqueado queremos fallar rapido y mostrar el aviso, no colgarnos
    // hasta que PHP mate el script.
    'smtp_timeout' => 8,

    // Mientras diagnosticamos, el dialogo SMTP queda en php/logs/form.log.
    // Pasar a false cuando el formulario este andando.
    'smtp_debug'  => true,
];
