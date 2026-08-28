<?php
/**
 * Ajustes de TRANSPORTE del SMTP. No son secretos, asi que viven en el repo:
 * config.php lo genera el deploy desde los GitHub Secrets y solo lleva el
 * servidor, el puerto y las credenciales.
 *
 * Lo que se define aca pisa a config.php.
 *
 * ── Por que localhost ─────────────────────────────────────────────────────
 * Este hosting tiene TODO el SMTP saliente bloqueado. Medido desde el propio
 * servidor, dan "Connection timed out" a los 6 segundos:
 *
 *   smtp.gmail.com:587      smtp.gmail.com:465
 *   smtp-relay.brevo.com:587    smtp-relay.brevo.com:2525
 *   smtp.sendgrid.net:2525      relay-hosting.secureserver.net:25
 *
 * En cambio google.com:443 responde en 36ms: la salida a internet anda, lo
 * que esta cerrado son los puertos de mail. Y localhost:25 responde en 1ms,
 * porque el servidor corre su propio Exim. Ese es el unico camino posible
 * aca, y por eso va sin auth y sin cifrado. Host y puerto salen de los
 * secrets SMTP_HOST y SMTP_PORT.
 *
 * Conclusion: ningun proveedor externo (Brevo, SendGrid, Gmail) sirve en
 * este plan de hosting. Para usar uno habria que migrar a un hosting sin
 * ese bloqueo, o mandar por API HTTPS en vez de SMTP (el 443 esta abierto).
 *
 * ── PENDIENTE: entregabilidad ─────────────────────────────────────────────
 * El SPF del dominio es "v=spf1 include:_spf.google.com ~all" y el DMARC
 * esta en p=quarantine, asi que un mail salido de la IP de GoDaddy con
 * From: @longevityargentina.com no pasa SPF y Google lo manda a spam.
 * Se arregla agregando el hosting al SPF:
 *
 *   v=spf1 include:_spf.google.com include:secureserver.net ~all
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
