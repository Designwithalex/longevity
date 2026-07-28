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

require __DIR__ . '/PHPMailer/src/Exception.php';
require __DIR__ . '/PHPMailer/src/PHPMailer.php';
require __DIR__ . '/PHPMailer/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;

function redirect_error(string $reason): void
{
    $back = $_SERVER['HTTP_REFERER'] ?? '/index.html';
    $sep = str_contains($back, '?') ? '&' : '?';
    header('Location: ' . $back . $sep . 'form_error=' . urlencode($reason) . '#contacto');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /index.html');
    exit;
}

/**
 * Marca un envío como spam. A los bots les mostramos la página de "gracias"
 * (fail-silently: no les damos pistas de que los detectamos). Los errores
 * legítimos, en cambio, vuelven al form con un mensaje (redirect_error).
 */
function drop_as_spam(): void
{
    header('Location: /gracias.html');
    exit;
}

// ── Capa 1: Honeypot ── campo oculto por CSS que un humano nunca completa.
if (!empty($_POST['website'] ?? '')) {
    drop_as_spam();
}

// ── Capa 2: Time-trap ── el JS del sitio pone en "ts" los segundos que el
// visitante tardó en completar el form. Vacío = no ejecutó JS (bot); < 3s =
// completó demasiado rápido para ser humano.
$ts = $_POST['ts'] ?? '';
if ($ts === '' || !ctype_digit((string)$ts) || (int)$ts < 3) {
    drop_as_spam();
}

// ── Capa 3: Rate-limiting por IP ── máx. 5 envíos por hora desde la misma IP.
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
if (count($hits) >= 5) {
    redirect_error('demasiados_envios');
}
$hits[] = $now;
@file_put_contents($rateFile, json_encode(array_values($hits)), LOCK_EX);

$config = require __DIR__ . '/config.php';

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
        drop_as_spam();
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
        redirect_error('error_adjunto');
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

    $cvPath = $file['tmp_name'];
    $cvName = 'CV - ' . $nombre . '.' . $ext;
}

$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host       = $config['smtp_host'];
    $mail->SMTPAuth   = true;
    $mail->Username   = $config['smtp_user'];
    $mail->Password   = $config['smtp_pass'];
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = $config['smtp_port'];
    $mail->CharSet    = 'UTF-8';

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
} catch (PHPMailerException $e) {
    error_log('Error enviando formulario Longevity: ' . $mail->ErrorInfo);
    redirect_error('error_envio');
}

header('Location: /gracias.html');
exit;
