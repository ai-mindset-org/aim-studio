// Backdrop layer primitive — Wave I6.
//
// Returns the lowest z-index DOM/CSS slot for a banner background.
// Wave J will populate `src` for the `ai-generated` branch; this primitive
// just provides the slot. Token quirk: DTCG envelope uses `.$value` for any
// token value — callers should resolve before passing here.

export function renderBg({ type, src, opacity = 1 } = {}) {
  if (type === 'plain') {
    return '<div class="bg-plain"></div>';
  }

  if (type === 'mesh-token') {
    return '<div class="bg-mesh"></div>';
  }

  if (type === 'ai-generated' && src) {
    const safeSrc = String(src).replace(/"/g, '&quot;');
    const safeOpacity = Number.isFinite(opacity) ? opacity : 1;
    return `<img class="bg-ai" src="${safeSrc}" style="opacity:${safeOpacity}" alt="">`;
  }

  return '';
}
