<?php
/**
 * TEMPORAL — diagnostico de conectividad SMTP. Protegido por token.
 * Se borra apenas se identifique por donde puede salir el mail.
 */
declare(strict_types=1);
header('Content-Type: text/plain; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');

const DIAG_TOKEN = 'd325b390f736d7533fc0fe7ccbd32fb569bf1949baf301db';
if (!hash_equals(DIAG_TOKEN, (string)($_GET['t'] ?? ''))) {
    http_response_code(404);
    exit;
}

echo "PHP " . PHP_VERSION . "  |  " . php_uname('s') . "\n";
echo str_repeat('=', 64) . "\n\n";

echo "== Que puede alcanzar el servidor ==\n";
$destinos = [
    ['relay-hosting.secureserver.net', 25],
    ['localhost', 25],
    ['127.0.0.1', 25],
    ['smtp.gmail.com', 587],
    ['smtp.gmail.com', 465],
    ['smtp-relay.brevo.com', 587],
    ['smtp-relay.brevo.com', 2525],
    ['smtp.sendgrid.net', 2525],
    ['google.com', 443],
];
foreach ($destinos as [$h, $p]) {
    $t0 = microtime(true);
    $fp = @fsockopen($h, $p, $errno, $errstr, 6);
    $ms = (int)round((microtime(true) - $t0) * 1000);
    if ($fp) {
        stream_set_timeout($fp, 3);
        $saludo = @fgets($fp, 512);
        fclose($fp);
        printf("  OK    %-34s %5d  %4dms  %s\n", $h, $p, $ms, trim((string)$saludo));
    } else {
        printf("  FALLA %-34s %5d  %4dms  [%d] %s\n", $h, $p, $ms, $errno, $errstr);
    }
}

echo "\n== Envio local de PHP ==\n";
printf("  mail() disponible : %s\n", function_exists('mail') ? 'si' : 'NO');
printf("  sendmail_path     : %s\n", (string)ini_get('sendmail_path') ?: '(vacio)');
printf("  SMTP / smtp_port  : %s / %s\n", (string)ini_get('SMTP'), (string)ini_get('smtp_port'));
foreach (['/usr/sbin/sendmail', '/usr/lib/sendmail'] as $bin) {
    printf("  %-20s: %s\n", $bin, is_executable($bin) ? 'ejecutable' : 'no');
}

echo "\n== Limites relevantes ==\n";
foreach (['max_execution_time','post_max_size','upload_max_filesize','allow_url_fopen'] as $k) {
    printf("  %-20s: %s\n", $k, (string)ini_get($k));
}
printf("  %-20s: %s\n", 'extension openssl', extension_loaded('openssl') ? 'si' : 'NO');
printf("  %-20s: %s\n", 'extension fileinfo', extension_loaded('fileinfo') ? 'si' : 'NO');

echo "\n== config.php efectivo (sin credenciales) ==\n";
$c = @require __DIR__ . '/config.php';
if (is_array($c)) {
    foreach ($c as $k => $v) {
        if (stripos($k, 'pass') !== false) { $v = '(' . strlen((string)$v) . ' caracteres)'; }
        printf("  %-16s: %s\n", $k, var_export($v, true));
    }
} else { echo "  no se pudo leer\n"; }
$t = @require __DIR__ . '/smtp-transport.php';
echo "  --- smtp-transport.php ---\n";
if (is_array($t)) { foreach ($t as $k => $v) { printf("  %-16s: %s\n", $k, var_export($v, true)); } }

echo "\n== Ultimas 60 lineas de logs/form.log ==\n";
$log = __DIR__ . '/logs/form.log';
if (is_file($log)) {
    $lineas = file($log, FILE_IGNORE_NEW_LINES);
    foreach (array_slice($lineas, -60) as $l) { echo "  " . $l . "\n"; }
} else { echo "  (todavia no existe)\n"; }
