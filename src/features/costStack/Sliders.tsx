import { recenter } from "../../engine";
import { UnverifiedFlag } from "../../components/UnverifiedFlag";
import { useAppStore, useAssumptions } from "../../store/useAppStore";
import { SLIDER_GROUPS, formatSlider, type SliderSpec } from "./sliderConfig";

export function Sliders() {
  return (
    <div className="space-y-4">
      {SLIDER_GROUPS.map((g) => (
        <fieldset key={g.title} className="rounded-lg border border-stone-200 bg-white p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-stone-500">{g.title}</legend>
          <div className="space-y-2.5">
            {g.sliders.map((s) => (
              <Slider key={s.id} spec={s} />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function Slider({ spec }: { spec: SliderSpec }) {
  const set = useAssumptions();
  const defaults = useAppStore((s) => s.defaults);
  const overridden = useAppStore((s) => spec.id in s.overrides);
  const setOverride = useAppStore((s) => s.setOverride);
  const resetOverride = useAppStore((s) => s.resetOverride);
  const a = set.assumptions[spec.id]!;
  const base = defaults.assumptions[spec.id]!.value;
  const id = `slider-${spec.id}`;

  const onChange = (x: number) =>
    setOverride(spec.id, base.central === 0 ? { low: x * 0.7, central: x, high: x * 1.3 } : recenter(base, x));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <label htmlFor={id} className="font-medium text-stone-700">
          {a.label} {!a.verified && <UnverifiedFlag />}
        </label>
        <span className="whitespace-nowrap font-mono">
          {formatSlider(a.value.central, spec.format)}
          {overridden && (
            <button className="ml-1 text-[10px] text-stone-500 underline" onClick={() => resetOverride(spec.id)} aria-label={`Reset ${a.label}`}>
              reset
            </button>
          )}
        </span>
      </div>
      <input
        id={id}
        type="range"
        className="w-full"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={a.value.central}
        aria-valuetext={formatSlider(a.value.central, spec.format)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="text-[10px] text-stone-400">
        uncertainty {formatSlider(a.value.low, spec.format)} – {formatSlider(a.value.high, spec.format)}
      </div>
    </div>
  );
}
