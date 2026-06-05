import { useEffect } from "react";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ReaderSettings } from "@/lib/books";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onChange: (next: ReaderSettings) => void;
  voices?: string[];
}

const VOICES = ["Default voice", "Evelyn (Natural)", "Atlas (Warm)", "June (Soft)", "Orion (Deep)"];
const SPEEDS = [0.8, 1, 1.25, 1.5, 1.75];

export function SettingsSheet({ open, onClose, settings, onChange, voices }: Props) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const voiceOptions = voices && voices.length > 0 ? voices : VOICES;

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
          "fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] overflow-hidden rounded-t-3xl bg-card text-card-foreground shadow-2xl transition-transform duration-300 ease-out sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:max-h-[min(80vh,44rem)] sm:w-[min(36rem,calc(100vw-3rem))] sm:-translate-x-1/2 sm:rounded-3xl",
          open
            ? "translate-y-0 sm:-translate-y-1/2"
            : "pointer-events-none translate-y-full sm:-translate-x-1/2 sm:translate-y-[calc(-50%+2rem)] sm:opacity-0",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Reader settings"
      >
        <div className="flex justify-center pt-3 sm:hidden">
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

        <div className="max-h-[calc(85vh-4rem)] space-y-8 overflow-y-auto px-6 pb-10 pt-6 sm:max-h-[calc(min(80vh,44rem)-4rem)]">
          <div className="rounded-2xl bg-muted/60 p-5">
            <p
              className="font-serif leading-relaxed"
              style={{ fontSize: settings.fontSize, lineHeight: settings.lineHeight }}
            >
              <span className="text-muted-foreground">Preview - </span>
              <span
                className={cn(
                  "relative",
                  settings.highlight === "soft" &&
                    "rounded bg-highlight/80 px-1 text-highlight-foreground",
                  settings.highlight === "underline" &&
                    "underline decoration-accent decoration-2 underline-offset-4",
                  settings.highlight === "bar" && "border-l-2 border-accent pl-2",
                )}
              >
                The reading line glows softly as it speaks.
              </span>
            </p>
          </div>

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
              onChange={(event) => onChange({ ...settings, fontSize: Number(event.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Line spacing
              </label>
              <span className="text-xs font-medium tabular-nums">
                {settings.lineHeight.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={1.3}
              max={2}
              step={0.05}
              value={settings.lineHeight}
              onChange={(event) =>
                onChange({ ...settings, lineHeight: Number(event.target.value) })
              }
              className="w-full accent-[var(--accent)]"
            />
          </div>

          <div>
            <label className="mb-3 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Highlight style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["soft", "underline", "bar"] as const).map((highlight) => (
                <button
                  key={highlight}
                  onClick={() => onChange({ ...settings, highlight })}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-xs font-medium capitalize transition-colors",
                    settings.highlight === highlight
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {highlight}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-3 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Theme
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["light", "dark"] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => onChange({ ...settings, theme })}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-medium capitalize",
                    settings.theme === theme
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border",
                  )}
                >
                  <span
                    className={cn(
                      "size-3 rounded-full ring-1",
                      theme === "light"
                        ? "bg-[#FBF9F6] ring-zinc-300"
                        : "bg-zinc-900 ring-zinc-700",
                    )}
                  />
                  {theme === "light" ? "Afternoon" : "Midnight"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-3 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Voice
            </label>
            <Select
              value={settings.voice}
              onValueChange={(value) => onChange({ ...settings, voice: value })}
            >
              <SelectTrigger className="h-11 rounded-2xl border-border bg-background text-sm">
                <SelectValue placeholder="Choose a voice" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {voiceOptions.map((voice) => (
                  <SelectItem key={voice} value={voice}>
                    {voice}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-3 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Reading speed
            </label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {SPEEDS.map((speed) => (
                <button
                  key={speed}
                  onClick={() => onChange({ ...settings, speed })}
                  className={cn(
                    "rounded-xl border py-2 text-xs font-medium tabular-nums",
                    settings.speed === speed
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
