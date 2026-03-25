export function ColorPicker({ category, color, onChange, presets = [] }) {
  return (
    <div className="color-picker" data-category={category}>
      <input
        type="color"
        value={color || '#888888'}
        onChange={e => onChange && onChange(e.target.value)}
      />
      <div className="color-picker__presets">
        {presets.map((preset, i) => (
          <button
            key={i}
            className="color-picker__swatch"
            style={{ backgroundColor: preset }}
            onClick={() => onChange && onChange(preset)}
            aria-label={preset}
          />
        ))}
      </div>
    </div>
  )
}

export default ColorPicker
