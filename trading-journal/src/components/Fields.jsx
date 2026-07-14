// Small reusable form primitives, styled by index.css.

export function Text({ label, value, onChange, hint, required, error, ...rest }) {
  return (
    <div className={`field ${required ? 'req' : ''} ${error ? 'invalid' : ''}`}>
      {label && <label>{label}</label>}
      {hint && <span className="hint">{hint}</span>}
      <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export function Area({ label, value, onChange, hint, required, error, rows = 3, ...rest }) {
  return (
    <div className={`field ${required ? 'req' : ''} ${error ? 'invalid' : ''}`}>
      {label && <label>{label}</label>}
      {hint && <span className="hint">{hint}</span>}
      <textarea
        rows={rows}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export function Select({ label, value, onChange, options, hint }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {hint && <span className="hint">{hint}</span>}
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const val = typeof o === 'string' ? o : o.value;
          const lbl = typeof o === 'string' ? o : o.label;
          return (
            <option key={val} value={val}>
              {lbl}
            </option>
          );
        })}
      </select>
    </div>
  );
}

export function Check({ label, checked, onChange }) {
  return (
    <label className="cb-label" style={{ display: 'flex', gap: 6, cursor: 'pointer' }}>
      <input
        type="checkbox"
        style={{ width: 'auto', accentColor: '#2dd4bf' }}
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
