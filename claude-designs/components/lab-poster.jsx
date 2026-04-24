// LabPoster — square poster (1080×1080)
// Big lab title, dates band, modality icons row using week colors, footer.
import { getLab, tokenToCssVars } from '../design-tokens.jsx';

const MODALITIES = [
  { key: 'W1', label: 'text' },
  { key: 'W2', label: 'image' },
  { key: 'W3', label: 'audio' },
  { key: 'W4', label: 'code' },
];

export default function LabPoster({ labId = 'x26' }) {
  const lab = getLab(labId);
  const cssVars = tokenToCssVars(lab);

  const containerStyle = {
    ...cssVars,
    width: 1080,
    height: 1080,
    background: '#0a0a0f',
    color: '#f5f5f7',
    fontFamily: lab.fonts.mono,
    position: 'relative',
    overflow: 'hidden',
    display: 'grid',
    gridTemplateRows: 'auto 1fr auto auto',
    padding: 64,
    boxSizing: 'border-box',
    backgroundImage: `radial-gradient(circle at 50% 0%, rgba(${lab.accentRgb}, 0.16), transparent 60%), radial-gradient(circle at 50% 100%, rgba(${lab.secondaryAccentRgb}, 0.08), transparent 50%)`,
  };

  const eyebrowStyle = {
    fontSize: 16,
    fontWeight: 500,
    letterSpacing: '0.24em',
    textTransform: 'uppercase',
    color: lab.accent,
  };

  const titleBlock = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 10,
  };

  const titleStyle = {
    fontFamily: lab.fonts.display,
    fontSize: 142,
    fontWeight: 700,
    lineHeight: 0.92,
    letterSpacing: '-0.025em',
  };

  const accentStyle = { color: lab.accent };

  const datesBandStyle = {
    margin: '12px 0 22px',
    padding: '14px 20px',
    border: `1px solid rgba(${lab.accentRgb}, 0.4)`,
    borderRadius: 4,
    fontSize: 18,
    letterSpacing: '0.18em',
    color: lab.accent,
    background: `rgba(${lab.accentRgb}, 0.08)`,
    display: 'inline-block',
    alignSelf: 'flex-start',
  };

  const modalityRow = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 14,
    margin: '0 0 28px',
  };

  const modalityCell = (color) => ({
    padding: '22px 14px',
    border: `1px solid ${color}`,
    background: `${color}14`,
    color: color,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 600,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    borderRadius: 4,
  });

  const footerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 14,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'rgba(245,245,247,0.4)',
  };

  return (
    <div data-lab={labId} style={containerStyle}>
      <div style={eyebrowStyle} contentEditable suppressContentEditableWarning>
        {lab.eyebrow}
      </div>

      <div style={titleBlock}>
        <div style={titleStyle} contentEditable suppressContentEditableWarning>
          {lab.title}
        </div>
        <div style={{ ...titleStyle, ...accentStyle }} contentEditable suppressContentEditableWarning>
          {lab.accentTitle}
        </div>
        <div style={datesBandStyle} contentEditable suppressContentEditableWarning>
          {lab.dates}
        </div>
      </div>

      <div style={modalityRow}>
        {MODALITIES.map((m) => {
          const color = (lab.weekAccents && lab.weekAccents[m.key]) || lab.accent;
          return (
            <div key={m.key} style={modalityCell(color)}>
              <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>{m.key}</div>
              <div>{m.label}</div>
            </div>
          );
        })}
      </div>

      <div style={footerStyle}>
        <span contentEditable suppressContentEditableWarning>{lab.footer}</span>
        <span>{lab.recordPaletteLegend}</span>
      </div>
    </div>
  );
}
