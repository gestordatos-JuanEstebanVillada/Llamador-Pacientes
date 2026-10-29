interface ToggleSwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  id?: string;
}

export function ToggleSwitch({ checked, onChange, label, id }: ToggleSwitchProps) {
  const switchId = id ?? "toggle-switch";
  return (
    <label htmlFor={switchId} className="flex items-center gap-3 cursor-pointer select-none">
      <span className="relative inline-flex h-7 w-12 shrink-0">
        <input
          id={switchId}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="absolute inset-0 rounded-full bg-gray-200 transition peer-checked:bg-rose-600" />
        <span className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
      {label && <span className="text-sm text-slate-700">{label}</span>}
      <span className="text-xs text-gray-500">{checked ? "Activo" : "Inactivo"}</span>
    </label>
  );
}
