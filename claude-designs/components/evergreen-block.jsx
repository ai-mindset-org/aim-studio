// EvergreenBlock — 3:1 (1500×500) for AI Mindset core / evergreen content
// Mauve accent, no roster, abstract gradient bg. Use for FOS / workshops / cross-cohort announcements.
import { getLab, tokenToCssVars } from '../design-tokens.jsx';

export default function EvergreenBlock({
  headline = 'Founder OS · Spring Workshop',
  sub = 'evergreen practice for builders · live + async',
  cta = 'Apply →',
  ctaUrl = 'https://aimindset.org',
}) {
  const lab = getLab('core');
  const cssVars = tokenToCssVars(lab);

  const containerStyle = {
    ...cssVars,
    width: 1500,
    height: 500,
    background: '#0a0a0f',
    color: '#f5f5f7',
    fontFamily: lab.fonts.mono,
    position: 'relative',
    overflow: 'hidden',
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    alignItems: 'center',
    padding: '0 80px',
    boxSizing: 'border-box',
    backgroundImage: `radial-gradient(circle at 80% 50%, rgba(${lab.accentRgb}, 0.22), transparent 55%), radial-gradient(circle at 10% 110%, rgba(96, 165, 250, 0.10), transparent 60%), linear-gradient(135deg, rgba(${lab.accentRgb}, 0.05), transparent 70%)`,
  };

  const eyebrowStyle = {
    fontSize: 14,
    letterSpacing: '0.26em',
    textTransform: 'uppercase',
    color: lab.accent,
    opacity: 0.85,
    marginBottom: 18,
  };

  const headlineStyle = {
    fontFamily: lab.fonts.display,
    fontSize: 72,
    fontWeight: 600,
    lineHeight: 1.0,
    letterSpacing: '-0.015em',
    color: '#f5f5f7',
    marginBottom: 18,
    maxWidth: 980,
  };

  const subStyle = {
    fontSize: 20,
    color: 'rgba(245,245,247,0.6)',
    letterSpacing: '0.02em',
    maxWidth: 880,
  };

  const ctaStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '20px 32px',
    border: `2px solid ${lab.accent}`,
    color: lab.accent,
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textDecoration: 'none',
    background: `rgba(${lab.accentRgb}, 0.08)`,
    borderRadius: 4,
    fontFamily: lab.fonts.display,
  };

  return (
    <div data-lab="core" style={containerStyle}>
      <div>
        <div style={eyebrowStyle} contentEditable suppressContentEditableWarning>
          {lab.eyebrow}
        </div>
        <div style={headlineStyle} contentEditable suppressContentEditableWarning>
          {headline}
        </div>
        <div style={subStyle} contentEditable suppressContentEditableWarning>
          {sub}
        </div>
      </div>
      <a href={ctaUrl} style={ctaStyle}>
        <span contentEditable suppressContentEditableWarning>{cta}</span>
      </a>
    </div>
  );
}
