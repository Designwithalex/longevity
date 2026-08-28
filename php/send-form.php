<?php
/**
 * Handler único para todos los formularios del sitio (contacto general, consultas por
 * servicio/nivel de complejidad y "Trabajá con Nosotros" con adjunto de CV).
 * Cada <form> del sitio apunta acá vía POST y manda un campo oculto "origen" para
 * identificar de qué página/servicio viene la consulta.
 */

declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', '0');
date_default_timezone_set('America/Argentina/Buenos_Aires');

/**
 * Log propio del formulario. Vive en php/logs/form.log y queda bloqueado al
 * navegador por un .htaccess que se crea solo. Es el único lugar donde mirar
 * cuando alguien reporta que "el formulario no anda".
 */
function form_log(string $line): void
{
    $dir = __DIR__ . '/logs';
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
    }
    $guard = $dir . '/.htaccess';
    if (!is_file($guard)) {
        @file_put_contents($guard, implode("\n", [
            '<IfModule mod_authz_core.c>',
            '  Require all denied',
            '</IfModule>',
            '<IfModule !mod_authz_core.c>',
            '  Order allow,deny',
            '  Deny from all',
            '</IfModule>',
            '',
        ]));
    }
    @file_put_contents(
        $dir . '/form.log',
        '[' . date('Y-m-d H:i:s') . '] ' . $line . "\n",
        FILE_APPEND | LOCK_EX
    );
}

/**
 * Red de seguridad contra la página en blanco.
 *
 * El try/catch de más abajo sólo atrapa excepciones. Un error fatal de PHP
 * (extensión faltante, "maximum execution time exceeded" porque el SMTP quedó
 * colgado, etc.) NO es una excepción: se lleva puesto el script y, con
 * display_errors en 0, el visitante ve una pantalla en blanco.
 *
 * Marcamos $GLOBALS['form_finished'] justo antes de cada salida legítima; si
 * el script muere sin esa marca, acá lo registramos y devolvemos igual al
 * formulario con un mensaje de error.
 */
$GLOBALS['form_finished'] = false;
register_shutdown_function(static function (): void {
    if ($GLOBALS['form_finished'] === true) {
        return;
    }

    $fatal = error_get_last();
    if ($fatal !== null && in_array($fatal['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) {
        form_log('FATAL: ' . $fatal['message'] . ' — ' . $fatal['file'] . ':' . $fatal['line']);
    } else {
        form_log('El script terminó sin completar el flujo (probable timeout de ejecución).');
    }

    if (!headers_sent()) {
        $back = form_safe_referer();
        $sep = str_contains($back, '?') ? '&' : '?';
        header('Location: ' . $back . $sep . 'form_error=error_envio#contacto');
    }
});

require __DIR__ . '/PHPMailer/src/Exception.php';
require __DIR__ . '/PHPMailer/src/PHPMailer.php';
require __DIR__ . '/PHPMailer/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;

/**
 * Página a la que volvemos cuando hay un error. Sale del Referer, pero sólo si
 * apunta a este mismo host: si no, cualquiera podría usar el formulario como
 * redirector hacia un sitio externo.
 */
function form_safe_referer(): string
{
    $ref = $_SERVER['HTTP_REFERER'] ?? '';
    if ($ref === '') {
        return '/index.html';
    }
    $host = parse_url($ref, PHP_URL_HOST);
    if ($host === null) {
        // Referer relativo: ya es de este sitio.
        return $ref;
    }
    // HTTP_HOST puede venir con puerto ("ejemplo.com:8080"); parse_url nunca lo
    // incluye. Sin recortarlo, la comparacion falla siempre fuera del 80/443.
    $self = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    $self = (string)preg_replace('~:\d+$~', '', $self);
    if (strtolower($host) !== $self) {
        return '/index.html';
    }
    return $ref;
}

function redirect_error(string $reason): void
{
    $back = form_safe_referer();
    $sep = str_contains($back, '?') ? '&' : '?';
    $GLOBALS['form_finished'] = true;
    header('Location: ' . $back . $sep . 'form_error=' . urlencode($reason) . '#contacto');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    $GLOBALS['form_finished'] = true;
    header('Location: /index.html');
    exit;
}

/**
 * Marca un envío como spam. A los bots les mostramos la misma página de
 * "gracias" (fail-silently: no les damos pistas de que los detectamos), pero
 * SIN el parámetro ?ok=1. Ese parámetro es el que dispara la conversión en
 * GTM, así que los bots no ensucian las métricas de Ads/Analytics.
 * Los errores legítimos, en cambio, vuelven al form con un mensaje
 * (redirect_error).
 */
function drop_as_spam(string $motivo): void
{
    form_log('Descartado como spam (' . $motivo . ') — IP ' . ($_SERVER['REMOTE_ADDR'] ?? '?'));
    $GLOBALS['form_finished'] = true;
    header('Location: /gracias.html');
    exit;
}

// ── Capa 0: cuerpo descartado por PHP ──
// Si el navegador mandó un cuerpo pero $_POST y $_FILES llegan vacíos, PHP tiró
// el request entero por superar post_max_size (pasa con los CV de "Trabajá con
// Nosotros"). Sin este chequeo, "ts" quedaría vacío y el envío se descartaría
// como si fuera un bot: el postulante ve la página de gracias y el CV no llega
// nunca. Le damos un error real.
$contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > 0 && $_POST === [] && $_FILES === []) {
    form_log(sprintf(
        'Cuerpo descartado por PHP: Content-Length=%d, post_max_size=%s, upload_max_filesize=%s',
        $contentLength,
        (string)ini_get('post_max_size'),
        (string)ini_get('upload_max_filesize')
    ));
    redirect_error('envio_muy_grande');
}

// ── Capa 1: Honeypot ── campo oculto por CSS que un humano nunca completa.
if (!empty($_POST['website'] ?? '')) {
    drop_as_spam('honeypot');
}

// ── Capa 2: Time-trap ── el JS del sitio pone en "ts" los segundos que el
// visitante tardó en completar el form. Vacío = no ejecutó JS (bot); < 3s =
// completó demasiado rápido para ser humano.
$ts = $_POST['ts'] ?? '';
if ($ts === '' || !ctype_digit((string)$ts) || (int)$ts < 3) {
    drop_as_spam('time-trap ts="' . (string)$ts . '"');
}

// ── Capa 3: Rate-limiting por IP ── máx. 15 CONSULTAS ENVIADAS por hora.
// Ojo: sólo se cuentan los envíos que terminaron en un mail efectivamente
// mandado (ver el final del archivo). Antes se contaba cada POST, con lo cual
// probar el formulario cuatro veces dejaba a la IP bloqueada una hora entera
// — y con CGNAT (Telecentro, Claro, Movistar) una IP puede ser todo un barrio.
const RATE_MAX_POR_HORA = 15;

$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$rateDir = sys_get_temp_dir() . '/longevity_form_rl';
@mkdir($rateDir, 0700, true);
$rateFile = $rateDir . '/' . hash('sha256', $ip) . '.json';
$now = time();
$hits = [];
if (is_file($rateFile)) {
    $decoded = json_decode((string)@file_get_contents($rateFile), true);
    if (is_array($decoded)) {
        // Conservamos solo los envíos de la última hora.
        $hits = array_filter($decoded, static fn($t) => is_int($t) && ($now - $t) < 3600);
    }
}
if (count($hits) >= RATE_MAX_POR_HORA) {
    form_log('Rate-limit alcanzado para la IP ' . $ip . ' (' . count($hits) . ' envíos en la última hora)');
    redirect_error('demasiados_envios');
}

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    form_log('FALTA php/config.php en el servidor.');
    redirect_error('error_envio');
}
$config = require $configFile;

// Ajustes de transporte (auth, cifrado, timeout, debug). Van aparte porque no
// son secretos: config.php lo regenera el deploy desde los GitHub Secrets y
// solo trae servidor, puerto y credenciales. Lo de aca pisa a config.php.
$transportFile = __DIR__ . '/smtp-transport.php';
if (is_file($transportFile)) {
    $transport = require $transportFile;
    if (is_array($transport)) {
        $config = array_merge($config, $transport);
    }
}

$nombre   = trim((string)($_POST['nombre'] ?? ''));
$telefono = trim((string)($_POST['telefono'] ?? ''));
$email    = trim((string)($_POST['email'] ?? ''));
$mensaje  = trim((string)($_POST['mensaje'] ?? ''));
$origen   = trim((string)($_POST['origen'] ?? 'Sitio web'));
$nivel    = trim((string)($_POST['nivel'] ?? ''));

if ($nombre === '' || $telefono === '') {
    redirect_error('faltan_datos');
}

if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    redirect_error('email_invalido');
}

// ── Capa 4: Filtro de contenido ── el spam de formularios casi siempre trae
// links, BBCode o alfabetos que no corresponden a un público argentino.
$blob = $nombre . ' ' . $mensaje;
$spamSignals = [
    '~https?://~i',              // URLs
    '~\[url~i',                  // BBCode típico de spam
    '~<a\s~i',                   // HTML anchors
    '~\b(viagra|cialis|casino|crypto|bitcoin|backlink|seo\s+service)\b~i',
    '~[\x{0400}-\x{04FF}]~u',    // cirílico
    '~[\x{4E00}-\x{9FFF}]~u',    // ideogramas CJK
];
foreach ($spamSignals as $pattern) {
    if (preg_match($pattern, $blob)) {
        drop_as_spam('filtro de contenido ' . $pattern);
    }
}
// El teléfono no debería tener letras más allá de un "+" inicial.
if ($telefono !== '' && !preg_match('~^[\d\s()+\-\.]{6,25}$~', $telefono)) {
    redirect_error('faltan_datos');
}

// Adjunto de CV (solo lo usa el form de "Trabajá con Nosotros").
$cvPath = null;
$cvName = null;
if (!empty($_FILES['cv']['name'] ?? '')) {
    $file = $_FILES['cv'];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        form_log('Error de upload del CV: código ' . (string)$file['error']);
        redirect_error($file['error'] === UPLOAD_ERR_INI_SIZE ? 'adjunto_muy_grande' : 'error_adjunto');
    }

    $maxBytes = 5 * 1024 * 1024; // 5MB
    if ($file['size'] > $maxBytes) {
        redirect_error('adjunto_muy_grande');
    }

    $allowedExt = ['pdf', 'doc', 'docx'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExt, true)) {
        redirect_error('formato_adjunto_invalido');
    }

    // finfo puede no estar disponible (extensión fileinfo desactivada). Si falta,
    // nos quedamos con la validación por extensión en vez de tirar un fatal.
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        $allowedMime = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (!in_array($mime, $allowedMime, true)) {
            redirect_error('formato_adjunto_invalido');
        }
    } else {
        form_log('Aviso: la extensión fileinfo no está disponible; el CV se validó sólo por extensión.');
    }

    $cvPath = $file['tmp_name'];
    $cvName = 'CV - ' . $nombre . '.' . $ext;
}

$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host    = $config['smtp_host'];
    $mail->Port    = (int)$config['smtp_port'];
    $mail->CharSet = 'UTF-8';

    // Los relays del propio hosting (GoDaddy: relay-hosting.secureserver.net,
    // puerto 25) no piden usuario ni contrasenia: autentican por IP de origen.
    // Gmail y Brevo si autentican, y ahi smtp_auth va en true.
    $mail->SMTPAuth = (bool)($config['smtp_auth'] ?? true);
    if ($mail->SMTPAuth) {
        $mail->Username = $config['smtp_user'];
        $mail->Password = $config['smtp_pass'];
    }

    // 'tls' = STARTTLS (587) | 'ssl' = SMTPS (465) | '' o 'none' = sin cifrar,
    // que es el unico modo que acepta el relay de GoDaddy en el puerto 25.
    $secure = (string)($config['smtp_secure'] ?? PHPMailer::ENCRYPTION_STARTTLS);
    if ($secure === '' || strtolower($secure) === 'none') {
        $mail->SMTPSecure = '';
        // Sin esto PHPMailer intenta STARTTLS igual y el relay corta la sesion.
        $mail->SMTPAutoTLS = false;
    } else {
        $mail->SMTPSecure = $secure;
    }

    // Sin esto, un puerto SMTP bloqueado por el hosting deja la conexión colgada
    // hasta que PHP mata el script por max_execution_time: error fatal y página
    // en blanco. Con 8 segundos falla rápido y el visitante ve el aviso.
    $mail->Timeout    = (int)($config['smtp_timeout'] ?? 8);

    // Diagnóstico del diálogo SMTP. Se apaga poniendo 'smtp_debug' => false en
    // config.php una vez que el formulario esté andando.
    if (($config['smtp_debug'] ?? true) === true) {
        $mail->SMTPDebug = SMTP::DEBUG_SERVER;
        $mail->Debugoutput = static function ($str, $level): void {
            $str = trim((string)$str);
            if ($str === '') {
                return;
            }
            // Nunca guardamos las líneas de autenticación: llevan usuario y
            // contraseña en base64 y este log lo abre cualquiera con FTP.
            if (stripos($str, 'AUTH') !== false
                || preg_match('~^(CLIENT -> SERVER:\s*)?[A-Za-z0-9+/]{16,}={0,2}$~', $str)) {
                $str = '[credenciales omitidas]';
            }
            form_log('SMTP[' . (string)$level . '] ' . $str);
        };
    }

    $mail->setFrom($config['mail_from'], $config['mail_from_name']);
    $mail->addAddress($config['mail_to']);
    if ($email !== '') {
        $mail->addReplyTo($email, $nombre);
    }

    if ($cvPath !== null) {
        $mail->addAttachment($cvPath, $cvName);
    }

    $mail->Subject = 'Nueva consulta web — ' . $origen;

    $bodyLines = [
        'Origen: ' . $origen,
    ];
    if ($nivel !== '') {
        $bodyLines[] = 'Nivel de complejidad: ' . $nivel;
    }
    $bodyLines[] = 'Nombre: ' . $nombre;
    $bodyLines[] = 'Teléfono: ' . $telefono;
    if ($email !== '') {
        $bodyLines[] = 'Email: ' . $email;
    }
    if ($mensaje !== '') {
        $bodyLines[] = '';
        $bodyLines[] = 'Mensaje:';
        $bodyLines[] = $mensaje;
    }
    if ($cvName !== null) {
        $bodyLines[] = '';
        $bodyLines[] = '(Se adjunta CV)';
    }

    $mail->isHTML(false);
    $mail->Body = implode("\n", $bodyLines);

    $mail->send();
} catch (\Throwable $e) {
    // \Throwable y no PHPMailerException: acá caen también los TypeError, los
    // errores de extensiones faltantes y cualquier excepción que PHPMailer no
    // envuelva. Antes, todo eso terminaba en una página en blanco.
    form_log('Error enviando formulario: ' . $e->getMessage() . ' | PHPMailer: ' . $mail->ErrorInfo);
    redirect_error('error_envio');
}

// Recién ahora, con el mail efectivamente enviado, anotamos el envío para el
// rate-limit. Los intentos fallidos no gastan cupo.
$hits[] = $now;
@file_put_contents($rateFile, json_encode(array_values($hits)), LOCK_EX);

form_log('Consulta enviada OK — origen "' . $origen . '"');

// ?ok=1 => envío legítimo. Es el único caso que debe contar como conversión.
$GLOBALS['form_finished'] = true;
header('Location: /gracias.html?ok=1');
exit;
