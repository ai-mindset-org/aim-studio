// SpeakerCard — 4:5 portrait (1080×1350)
// Photo on top 60%, text on bottom 40%. Lab accent for borders / week label.
// Editable text inline.
import { getLab, tokenToCssVars } from '../design-tokens.jsx';

export default function SpeakerCard({
  labId = 'x26',
  name = 'Имя Фамилия',
  role = 'guest speaker',
  week = 'W1',
  photo,
  modalityLabel = 'image',
  telegram = '@username',
}) {
  const lab = getLab(labId);
  const cssVars = tokenToCssVars(lab);
  const weekColor = (lab.weekAccents && lab.weekAccents[week]) || lab.accent;

  const containerStyle = {
    ...cssVars,
    width: 1080,
    height: 1350,
    background: '#0a0a0f',
    color: '#f5f5f7',
    fontFamily: lab.fonts.mono,
    position: 'relative',
    overflow: 'hidden',
    display: 'grid',
    gridTemplateRows: '60% 40%',
    border: `2px solid rgba(${lab.accentRgb}, 0.25)`,
    boxSizing: 'border-box',
  };

  const photoSlot = {
    position: 'relative',
    background: photo
      ? `linear-gradient(180deg, transparent 60%, rgba(10,10,15,0.85) 100%), url(${photo}) center/cover no-repeat`
      : `linear-gradient(135deg, rgba(${lab.accentRgb}, 0.18), rgba(${lab.secondaryAccentRgb}, 0.10))`,
    overflow: 'hidden',
  };

  const weekBadge = {
    position: 'absolute',
    top: 32,
    left: 32,
    padding: '8px 14px',
    background: weekColor,
    color: '#0a0a0f',
    fontFamily: lab.fonts.mono,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '0.12em',
    borderRadius: 3,
  };

  const modalityBadge = {
    position: 'absolute',
    top: 32,
    right: 32,
    padding: '8px 14px',
    border: `1px solid rgba(${lab.accentRgb}, 0.55)`,
    color: lab.accent,
    fontSize: 15,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    background: 'rgba(10,10,15,0.55)',
    borderRadius: 3,
    backdropFilter: 'blur(6px)',
  };

  const textSlot = {
    padding: '40px 48px 48px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    borderTop: `1px solid rgba(${lab.accentRgb}, 0.2)`,
    background: 'linear-gradient(180deg, rgba(10,10,15,1) 0%, rgba(15,15,22,1) 100%)',
  };

  const nameStyle = {
    fontFamily: lab.fonts.display,
    fontSize: 64,
    fontWeight: 700,
    lineHeight: 1.0,
    letterSpacing: '-0.02em',
    color: '#f5f5f7',
  };

  const roleStyle = {
    marginTop: 14,
    fontSize: 20,
    color: lab.accent,
    letterSpacing: '0.05em',
  };

  const tgStyle = {
    fontSize: 16,
    color: 'rgba(245,245,247,0.5)',
    letterSpacing: '0.06em',
  };

  const labStripe = {
    fontSize: 13,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: 'rgba(245,245,247,0.32)',
  };

  return (
    <div data-lab={labId} style={containerStyle}>
      <div style={photoSlot}>
        <div style={weekBadge} contentEditable suppressContentEditableWarning>{week}</div>
        <div style={modalityBadge} contentEditable suppressContentEditableWarning>{modalityLabel}</div>
      </div>
      <div style={textSlot}>
        <div>
          <div style={nameStyle} contentEditable suppressContentEditableWarning>{name}</div>
          <div style={roleStyle} contentEditable suppressContentEditableWarning>{role}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={tgStyle} contentEditable suppressContentEditableWarning>{telegram}</span>
          <span style={labStripe}>{lab.name}</span>
        </div>
      </div>
    </div>
  );
}
