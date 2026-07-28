const sharp = require('sharp');
const path = require('path');

const imgDir = path.join(__dirname, 'img');

async function resize(input, output, width, quality = 82) {
  await sharp(path.join(imgDir, input))
    .resize(width, null, { withoutEnlargement: true })
    .webp({ quality })
    .toFile(path.join(imgDir, output));

  const fs = require('fs');
  const kb = (fs.statSync(path.join(imgDir, output)).size / 1024).toFixed(1);
  console.log(`✓ ${output} — ${kb} KiB`);
}

async function main() {
  console.log('Generando variantes optimizadas...\n');

  // ── Imágenes de contenido: múltiples anchos para srcset ──

  // graceFinal: columna portrait 340px desktop, ~300px móvil
  await resize('graceFinal.webp', 'graceFinal-340.webp', 340);
  await resize('graceFinal.webp', 'graceFinal-680.webp', 680);

  // enfermera: col hero ~55vw desktop, 100vw móvil
  await resize('enfermera.webp', 'enfermera-480.webp', 480);
  await resize('enfermera.webp', 'enfermera-900.webp', 900, 85);

  // quienesomos: media columna ~560px desktop, 480px móvil
  await resize('quienesomos.webp', 'quienesomos-480.webp', 480, 85);
  await resize('quienesomos.webp', 'quienesomos-560.webp', 560, 85);

  // ── Logos: versión única al doble del tamaño mostrado (Retina) ──

  // marca2: h=40px CSS → ancho ~135px → 2× = 270px
  await resize('marca2.webp', 'marca2-270.webp', 270, 88);

  // marca_blanco: h=36px CSS → ancho ~121px → 2× = 242px
  await resize('marca_blanco.webp', 'marca_blanco-242.webp', 242, 88);

  // prepaga-medicus: max-width 140px → 2× = 280px
  await resize('prepaga-medicus.webp', 'prepaga-medicus-280.webp', 280, 88);

  // prepaga-swiss: max-width 140px → 2× = 280px
  await resize('prepaga-swiss.webp', 'prepaga-swiss-280.webp', 280, 88);

  // prepaga-omint: cuadrada, max-height 56px → 2× = 112px
  await resize('prepaga-omint.webp', 'prepaga-omint-112.webp', 112, 88);

  // prepaga-galeno: max-width 140px → 2× = 280px
  await resize('prepaga-galeno.webp', 'prepaga-galeno-280.webp', 280, 88);

  console.log('\n✅ Listo.');
}

main().catch(console.error);
