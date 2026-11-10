<?php
/**
 * API del cotizador interno (/cotizador/).
 *
 * Guarda las tarifas y las cotizaciones como JSON en php/datos-cotizador/
 * (protegido con .htaccess). Todo pide la clave del equipo en el header
 * X-Clave, salvo `ping`, que solo dice si la API esta configurada.
 *
 * La clave sale de php/config.php ('cotizador_clave'), que arma deploy.yml
 * con el secret COTIZADOR_CLAVE. Sin clave configurada la API queda apagada
 * y el cotizador funciona en "modo prueba" (guarda en el navegador).
 *
 *   GET  ?accion=ping
 *   GET  ?accion=tarifas
 *   POST ?accion=guardar-tarifas        body: tarifas
 *   GET  ?accion=versiones
 *   GET  ?accion=cotizaciones
 *   POST ?accion=guardar-cotizacion     body: cotizacion (le asigna numero si no tiene)
 *   POST ?accion=borrar-cotizacion      body: {id}
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

const DIR_DATOS = __DIR__ . '/datos-cotizador';
const MAX_BODY = 2 * 1024 * 1024;
const MAX_VERSIONES = 40;

function responder($datos, int $codigo = 200): void
{
    http_response_code($codigo);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE);
    exit;
}

function fallar(string $msg, int $codigo = 400): void
{
    responder(['ok' => false, 'error' => $msg], $codigo);
}

function leerJson(string $archivo, $def)
{
    $ruta = DIR_DATOS . '/' . $archivo;
    if (!is_file($ruta)) return $def;
    $d = json_decode((string) file_get_contents($ruta), true);
    return $d === null ? $def : $d;
}

function escribirJson(string $archivo, $datos): void
{
    if (!is_dir(DIR_DATOS) && !mkdir(DIR_DATOS, 0750, true)) fallar('No se pudo crear la carpeta de datos', 500);
    $ruta = DIR_DATOS . '/' . $archivo;
    $tmp = $ruta . '.tmp' . bin2hex(random_bytes(4));
    if (file_put_contents($tmp, json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX) === false || !rename($tmp, $ruta)) {
        @unlink($tmp);
        fallar('No se pudo guardar', 500);
    }
}

function cuerpo(): array
{
    $raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
    if ($raw === false || strlen($raw) > MAX_BODY) fallar('Datos demasiado grandes', 413);
    $d = json_decode($raw, true);
    if (!is_array($d)) fallar('JSON inválido');
    return $d;
}

$config = is_file(__DIR__ . '/config.php') ? require __DIR__ . '/config.php' : [];
$clave = (string) ($config['cotizador_clave'] ?? '');
$accion = (string) ($_GET['accion'] ?? '');

if ($accion === 'ping') responder(['ok' => true, 'configurado' => $clave !== '']);
if ($clave === '') fallar('El cotizador no tiene clave configurada', 503);

$enviada = (string) ($_SERVER['HTTP_X_CLAVE'] ?? '');
if (!hash_equals($clave, $enviada)) {
    usleep(400000); // frena intentos por fuerza bruta
    fallar('Clave incorrecta', 401);
}

$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';

switch ($accion) {
    case 'tarifas':
        responder(['ok' => true, 'tarifas' => leerJson('tarifas.json', null)]);

    case 'guardar-tarifas':
        if ($metodo !== 'POST') fallar('Método inválido', 405);
        $t = cuerpo();
        if (!isset($t['categorias'], $t['modalidades']) || !is_array($t['categorias'])) fallar('No es una lista de tarifas');
        $anterior = leerJson('tarifas.json', null);
        if ($anterior) {
            $v = leerJson('versiones.json', []);
            array_unshift($v, ['fecha' => date('c'), 'vigencia' => $anterior['vigencia'] ?? '', 'tarifas' => $anterior]);
            escribirJson('versiones.json', array_slice($v, 0, MAX_VERSIONES));
        }
        escribirJson('tarifas.json', $t);
        responder(['ok' => true]);

    case 'versiones':
        responder(['ok' => true, 'versiones' => leerJson('versiones.json', [])]);

    case 'cotizaciones':
        responder(['ok' => true, 'cotizaciones' => leerJson('cotizaciones.json', [])]);

    case 'guardar-cotizacion':
        if ($metodo !== 'POST') fallar('Método inválido', 405);
        $c = cuerpo();
        if (empty($c['id']) || !is_string($c['id'])) fallar('Falta el id');
        $lista = leerJson('cotizaciones.json', []);
        if (empty($c['numero'])) {
            $anio = date('Y');
            $nums = leerJson('numeracion.json', []);
            $nums[$anio] = ($nums[$anio] ?? 0) + 1;
            escribirJson('numeracion.json', $nums);
            $c['numero'] = $anio . '-' . str_pad((string) $nums[$anio], 4, '0', STR_PAD_LEFT);
        }
        $i = array_search($c['id'], array_column($lista, 'id'), true);
        if ($i === false) array_unshift($lista, $c); else $lista[$i] = $c;
        escribirJson('cotizaciones.json', $lista);
        responder(['ok' => true, 'cotizacion' => $c]);

    case 'borrar-cotizacion':
        if ($metodo !== 'POST') fallar('Método inválido', 405);
        $id = (string) (cuerpo()['id'] ?? '');
        $lista = array_values(array_filter(leerJson('cotizaciones.json', []), fn($x) => ($x['id'] ?? '') !== $id));
        escribirJson('cotizaciones.json', $lista);
        responder(['ok' => true]);

    default:
        fallar('Acción desconocida', 404);
}
