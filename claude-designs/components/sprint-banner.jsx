// SprintBanner — 3:1 hero banner (1800×600)
// Lab-aware via DESIGN_TOKENS. Props override token defaults.
// All text fields are contentEditable so designers can iterate inline in Claude Designs.
import { DESIGN_TOKENS, getLab, tokenToCssVars } from '../design-tokens.jsx';

export default function SprintBanner({
  labId = 'x26',
  eyebrow,
  title,
  accentTitle,
  sub,
  dates,
  footer,
}) {
  const lab = getLab(labId);
  const cssVars = tokenToCssVars(lab);

  const _eyebrow = eyebrow ?? lab.eyebrow;
  const _title = title ?? lab.title;
  const _accentTitle = accentTitle ?? lab.accentTitle;
  const _sub = sub ?? lab.sub;
  const _dates = dates ?? lab.dates;
  const _footer = footer ?? lab.footer;

  const containerStyle = {
    ...cssVars,
    width: 1800,
    height: 600,
    background: '#0a0a0f',
    color: '#f5f5f7',
    fontFamily: lab.fonts.mono,
    position: 'relative',
    overflow: 'hidden',
    display: 'grid',
    gridTemplateRows: 'auto 1fr auto',
    padding: '64px 80px',
    boxSizing: 'border-box',
    backgroundImage: `radial-gradient(circle at 85% 30%, rgba(${lab.accentRgb}, 0.18), transparent 55%), radial-gradient(circle at 15% 85%, rgba(${lab.secondaryAccentRgb}, 0.08), transparent 50%)`,
  };

  const eyebrowStyle = {
    fontSize: 18,
    fontWeight: 500,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: lab.accent,
    opacity: 0.85,
  };

  const titleRowStyle = {
    display: 'flex',
    alignItems: 'baseline',
    gap: 32,
    fontFamily: lab.fonts.display,
    fontSize: 168,
    fontWeight: 700,
    lineHeight: 0.92,
    letterSpacing: '-0.025em',
    margin: '12px 0',
  };

  const accentTitleStyle = {
    color: lab.accent,
  };

  const subStyle = {
    fontSize: 22,
    color: 'rgba(245,245,247,0.62)',
    letterSpacing: '0.02em',
    maxWidth: 1100,
    marginTop: 8,
  };

  const datesBadgeStyle = {
    display: 'inline-block',
    padding: '10px 18px',
    border: `1px solid rgba(${lab.accentRgb}, 0.45)`,
    borderRadius: 4,
    fontSize: 16,
    letterSpacing: '0.16em',
    color: lab.accent,
    background: `rgba(${lab.accentRgb}, 0.07)`,
    marginTop: 18,
  };

  const footerRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    fontSize: 15,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'rgba(245,245,247,0.38)',
  };

  return (
    <div data-lab={labId} style={containerStyle}>
      <div style={eyebrowStyle} contentEditable suppressContentEditableWarning>
        {_eyebrow}
      </div>

      <div>
        <div style={titleRowStyle}>
          <span contentEditable suppressContentEditableWarning>{_title}</span>
          <span style={accentTitleStyle} contentEditable suppressContentEditableWarning>
            {_accentTitle}
          </span>
        </div>
        <div style={subStyle} contentEditable suppressContentEditableWarning>
          {_sub}
        </div>
        <div style={datesBadgeStyle} contentEditable suppressContentEditableWarning>
          {_dates}
        </div>
      </div>

      <div style={footerRowStyle}>
        <span contentEditable suppressContentEditableWarning>{_footer}</span>
        <span contentEditable suppressContentEditableWarning>{lab.recordPaletteLegend}</span>
      </div>
    </div>
  );
}
