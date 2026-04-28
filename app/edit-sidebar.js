// app/edit-sidebar.js
// Persistent edit sidebar shell for AIM Studio.
// Wave I7 — label + text input rows only. No font-size control yet (Wave J6).
//
// Contract:
//   mount({ root, state, onChange })
//     root:     HTMLElement target for the sidebar markup
//     state:    application state with state.copy (or current copy snapshot)
//     onChange: (fieldKey, value) => void  — wired to updateCopyField
//
// Field keys are derived from the current copy snapshot so that the sidebar
// stays in sync with whatever mode is active (generic / speaker / creator /
// participant). Each row exposes a single text input bound to onChange.

const FIELD_LABEL_OVERRIDES = {
  accentTitle: 'ACCENT TITLE',
  subtitle: 'SUB',
  sub: 'SUB',
};

function readCopySnapshot(state) {
  if (!state) return {};

  // Preferred: explicit state.copy (per task contract).
  if (state.copy && typeof state.copy === 'object') {
    return state.copy;
  }

  // Fallback: AIM Studio merges defaults with overrides via currentCopy().
  if (typeof window !== 'undefined' && typeof window.currentCopy === 'function') {
    try {
      return window.currentCopy() || {};
    } catch (_err) {
      return {};
    }
  }

  return {};
}

function fieldLabel(key) {
  if (FIELD_LABEL_OVERRIDES[key]) return FIELD_LABEL_OVERRIDES[key];
  return String(key)
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toUpperCase();
}

function buildRow(key, value, onChange) {
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.field = key;

  const label = document.createElement('label');
  label.htmlFor = `edit-sidebar-input-${key}`;
  label.textContent = fieldLabel(key);

  const input = document.createElement('input');
  input.type = 'text';
  input.id = `edit-sidebar-input-${key}`;
  input.name = key;
  input.value = value == null ? '' : String(value);
  input.autocomplete = 'off';
  input.spellcheck = false;

  input.addEventListener('input', (event) => {
    if (typeof onChange === 'function') {
      onChange(key, event.target.value);
    }
  });

  row.appendChild(label);
  row.appendChild(input);
  return row;
}

export function mount({ root, state, onChange } = {}) {
  if (!root) return null;

  root.innerHTML = '';

  const header = document.createElement('h2');
  header.textContent = 'EDITABLE COPY';
  root.appendChild(header);

  const rows = document.createElement('div');
  rows.className = 'edit-sidebar-rows';
  root.appendChild(rows);

  const copy = readCopySnapshot(state);
  const keys = Object.keys(copy);

  if (!keys.length) {
    const empty = document.createElement('p');
    empty.className = 'edit-sidebar-empty';
    empty.textContent = 'no editable fields for this view.';
    rows.appendChild(empty);
  } else {
    keys.forEach((key) => {
      rows.appendChild(buildRow(key, copy[key], onChange));
    });
  }

  // Placeholder slot for Wave J6 — font-size controls land here.
  const futureSlot = document.createElement('div');
  futureSlot.className = 'edit-sidebar-future';
  // <!-- Wave J6: font-size controls will mount here. -->
  root.appendChild(futureSlot);

  function refresh(nextState) {
    const snapshot = readCopySnapshot(nextState || state);
    Array.from(rows.querySelectorAll('input')).forEach((input) => {
      const key = input.name;
      if (key in snapshot) {
        const next = snapshot[key] == null ? '' : String(snapshot[key]);
        if (document.activeElement !== input && input.value !== next) {
          input.value = next;
        }
      }
    });
  }

  return { root, refresh };
}

export default { mount };
