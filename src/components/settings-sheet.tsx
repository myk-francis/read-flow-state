import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReaderSettings {
  fontSize: number; // px
  lineHeight: number; // multiplier
  voice: string;
  speed: number;
  theme: "light" | "dark";
  highlight: "soft" | "underline" | "bar";
}

interface Props {
  open: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onChange: (next: ReaderSettings) => void;
}

const VOICES = ["Evelyn (Natural)", "Atlas (Warm)", "June (Soft)", "Orion (Deep)"];
const SPEEDS = [0.8, 1, 1.25, 1.5, 1.75];

export function SettingsSheet({ open, onClose, settings, onChange }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-3xl bg-card text-card-foreground shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-full",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Reader settings"
      >
        <div className="flex justify-center pt-3">
          <div className="h-1.5 w-12 rounded-full bg-muted" />
        </div>
        <div className="flex items-center justify-between px-6 pt-4">
          <h2 className="font-serif text-xl">Reading settings</h2>
          <button
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-8 px-6 pb-10 pt-6">
          {/* Highlight preview */}
          <div className="rounded-2xl bg-muted/60 p-5">
            <p
              className="font-serif leading-relaxed"
              style={{ fontSize: settings.fontSize, lineHeight: settings.lineHeight }}
            >
              <span className="text-muted-foreground">Preview — </span>
              <span
                className={cn(
                  "relative",
                  settings.highlight === "soft" && "rounded bg-highlight/80 px-1 text-highlight-foreground",
                  settings.highlight === "underline" && "underline decoration-accent decoration-2 underline-offset-4",
                  settings.highlight === "bar" && "border-l-2 border-accent pl-2",
                )}
              >
                The reading line glows softly as it speaks.
              </span>
            </p>
          </div>

          {/* Font size */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Font size
              </label>
              <span className="text-xs font-medium tabular-nums">{settings.fontSize}px</span>
            </div>
            <input
              type="range"
              min={14}
              max={26}
              step={1}
              value={settings.fontSize}
              onChange={(e) => onChange({ ...settings, fontSize: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
          </div>

          {/* Line spacing */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Line spacing
              </label>
              <span className="text-xs font-medium tabular-nums">{settings.lineHeight.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={1.3}
              max={2}
              step={0.05}
              value={settings.lineHeight}
              onChange={(e) => onChange({ ...settings, lineHeight: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
          </div>

          {/* Highlight style */}
          <div>
            <label className="mb-3 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Highlight style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["soft", "underline", "bar"] as const).map((h) => (
                <button
                  key={h}
                  onClick={() => onChange({ ...settings, highlight: h })}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-xs font-medium capitalize transition-colors",
                    settings.highlight === h
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div>
            <label className="mb-3 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Theme
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => onChange({ ...settings, theme: t })}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-medium capitalize",
                    settings.theme === t ? "border-accent bg-accent/10 text-accent" : "border-border",
                  )}
                >
                  <span
                    className={cn(
                      "size-3 rounded-full ring-1",
                      t === "light" ? "bg-[#FBF9F6] ring-zinc-300" : "bg-zinc-900 ring-zinc-700",
                    )}
                  />
                  {t === "light" ? "Afternoon" : "Midnight"}
                </button>
              ))}
            </div>
          </div>

          {/* Voice */}
          <div>
            <label className="mb-3 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Voice
            </label>
            <div className="flex flex-wrap gap-2">
              {VOICES.map((v) => (
                <button
                  key={v}
                  onClick={() => onChange({ ...settings, voice: v })}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs",
                    settings.voice === v
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Speed */}
          <div>
            <label className="mb-3 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Reading speed
            </label>
            <div className="flex gap-2">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => onChange({ ...settings, speed: s })}
                  className={cn(
                    "flex-1 rounded-xl border py-2 text-xs font-medium tabular-nums",
                    settings.speed === s
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
