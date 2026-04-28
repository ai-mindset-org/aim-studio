/**
 * Apply teal-pine duotone + scrim to an AI-generated bg dataUrl.
 * Mirrors make-banner.py:compose() from AIM-ain-visuals skill.
 *
 * @param {string} srcDataUrl  - PNG/JPEG dataUrl from generate-bg function
 * @param {object} [opts]
 * @param {string} [opts.tint='#0f3d38']      - tint color (teal-pine for AIN)
 * @param {number} [opts.tintAlpha=0.35]      - tint blend opacity
 * @param {number} [opts.scrimAlpha=0.43]     - black scrim opacity
 * @returns {Promise<string>}                 - processed dataUrl (PNG)
 */
export async function postprocess(srcDataUrl, opts = {}) {
  const { tint = '#0f3d38', tintAlpha = 0.35, scrimAlpha = 0.43 } = opts;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('postprocess: image failed to load'));
    img.src = srcDataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');

  // 1) draw image desaturated
  ctx.filter = 'grayscale(100%)';
  ctx.drawImage(img, 0, 0);
  ctx.filter = 'none';

  // 2) tint overlay
  ctx.globalAlpha = tintAlpha;
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 3) scrim
  ctx.globalAlpha = scrimAlpha;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = 1;

  return canvas.toDataURL('image/png');
}
