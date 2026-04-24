// Netlify Function: AI background generation via OpenRouter (Gemini 2.5 Flash Image)
// POST { prompt, style, lab } → { dataUrl, prompt, model }
//
// Style presets prepend a visual prefix; lab adds an accent hint.
// Cost ~$0.003/image. Model: google/gemini-2.5-flash-image-preview.

const STYLE_PREFIXES = {
  biological: 'Abstract biological cellular pattern, microscope plate aesthetic, dark background with glowing cell structures, dense organic texture, ',
  terminal:   'Dark CRT terminal aesthetic, ASCII art, glowing phosphor traces, oscilloscope grid, scientific instrument display, ',
  glitch:     'Glitchy data corruption aesthetic, scan lines, RGB shift, digital decay, pixel sorting, ',
  botanical:  'Victorian botanical engraving meets circuit diagram, fern leaves intertwined with PCB traces, scientific plate, ',
  blueprint:  'Technical blueprint, hand-drawn architectural diagram, schematic lines, annotated technical drawing, ',
  evergreen:  'Soft mauve abstract gradient, mesh noise pattern, ambient depth, ethereal evergreen aesthetic, ',
  plain:      '',
};

const LAB_ACCENTS = {
  x26:  ', accent color #16a34a green',
  s3:   ', accent color #8ddff2 cyan-blue',
  core: ', accent color #a78bfa mauve',
};

const MODEL_ID = 'google/gemini-2.5-flash-image-preview';
const API_URL  = 'https://openrouter.ai/api/v1/chat/completions';

const jsonResponse = (status, body) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, { error: 'OPENROUTER_API_KEY not configured' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const { prompt = '', style = 'plain', lab = 'x26' } = payload;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return jsonResponse(400, { error: 'prompt is required' });
  }

  const stylePrefix = STYLE_PREFIXES[style] != null ? STYLE_PREFIXES[style] : '';
  const accentHint  = LAB_ACCENTS[lab] || '';
  const finalPrompt = stylePrefix + prompt.trim() + accentHint;

  const body = {
    model: MODEL_ID,
    messages: [
      { role: 'user', content: [{ type: 'text', text: finalPrompt }] },
    ],
    modalities: ['image', 'text'],
  };

  let resp;
  try {
    resp = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error('OpenRouter fetch failed:', e);
    return jsonResponse(502, { error: 'Upstream fetch failed' });
  }

  const text = await resp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error('OpenRouter non-JSON response:', resp.status, text.slice(0, 500));
    return jsonResponse(502, { error: 'Upstream returned non-JSON' });
  }

  if (!resp.ok) {
    const msg = (data && data.error && (data.error.message || data.error)) || `Upstream ${resp.status}`;
    console.error('OpenRouter error:', resp.status, msg);
    if (resp.status >= 400 && resp.status < 500) {
      return jsonResponse(resp.status, { error: typeof msg === 'string' ? msg : 'Upstream client error' });
    }
    return jsonResponse(502, { error: 'Upstream server error' });
  }

  // Extract image. Gemini-via-OpenRouter returns it in message.images[0].image_url.url
  // (typically a data:image/png;base64,... URL). Fallback: scan content for data URL.
  let dataUrl = null;
  try {
    const choice  = (data.choices && data.choices[0]) || {};
    const message = choice.message || {};
    const images  = Array.isArray(message.images) ? message.images : [];

    if (images.length > 0) {
      const first = images[0];
      if (typeof first === 'string') {
        dataUrl = first.startsWith('data:') ? first : `data:image/png;base64,${first}`;
      } else if (first && typeof first === 'object') {
        const url = (first.image_url && first.image_url.url) || first.url || '';
        if (url.startsWith('data:')) {
          dataUrl = url;
        } else if (url) {
          // Bare base64
          dataUrl = `data:image/png;base64,${url}`;
        }
      }
    }

    if (!dataUrl) {
      const content = message.content;
      const asString = typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content.map((c) => (typeof c === 'string' ? c : (c && c.text) || '')).join('')
          : '';
      const m = asString.match(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/);
      if (m) dataUrl = m[0];
    }
  } catch (e) {
    console.error('Parse error:', e);
  }

  if (!dataUrl) {
    console.error('No image in response. Keys:', Object.keys(data || {}), 'choice0:', JSON.stringify(data.choices && data.choices[0]).slice(0, 500));
    return jsonResponse(502, { error: 'No image in upstream response' });
  }

  return jsonResponse(200, {
    dataUrl,
    prompt: finalPrompt,
    model:  MODEL_ID,
  });
};
