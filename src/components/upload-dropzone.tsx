import { useState, type DragEvent } from "react";
import { BookOpen, CheckCircle2, FileWarning, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

type State = "idle" | "dragging" | "success" | "error";

interface UploadDropzoneProps {
  compact?: boolean;
  onSelectFiles?: (files: FileList) => void;
}

export function UploadDropzone({ compact = false, onSelectFiles }: UploadDropzoneProps) {
  const [state, setState] = useState<State>("idle");
  const [filename, setFilename] = useState<string>("");

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.toLowerCase().endsWith(".epub")) {
      setFilename(file.name);
      setState("error");
      return;
    }
    setFilename(file.name);
    setState("success");
    onSelectFiles?.(files);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  };

  const onDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setState("dragging");
  };

  return (
    <label
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={() =>
        setState((currentState) => (currentState === "dragging" ? "idle" : currentState))
      }
      className={cn(
        "group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-colors",
        compact ? "px-6 py-8" : "px-6 py-12 sm:px-8 sm:py-14",
        state === "dragging" && "border-accent bg-accent/5",
        state === "success" && "border-accent/40 bg-accent/5",
        state === "error" && "border-destructive/40 bg-destructive/5",
        state === "idle" &&
          "border-border bg-muted/40 hover:border-accent/40 hover:bg-accent/[0.03]",
      )}
    >
      <input
        type="file"
        accept=".epub,application/epub+zip"
        className="sr-only"
        onChange={(event) => handleFiles(event.target.files)}
      />

      {state === "success" ? (
        <>
          <CheckCircle2 className="size-7 text-accent" />
          <div className="text-center">
            <p className="text-sm font-medium">Imported successfully</p>
            <p className="mt-1 text-xs text-muted-foreground">{filename}</p>
          </div>
        </>
      ) : state === "error" ? (
        <>
          <FileWarning className="size-7 text-destructive" />
          <div className="text-center">
            <p className="text-sm font-medium text-destructive">Unsupported file</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Only .epub files are supported. Try another file.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="grid size-12 place-items-center rounded-full bg-card text-accent ring-1 ring-border">
            {compact ? <BookOpen className="size-5" /> : <UploadCloud className="size-6" />}
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">
              {compact ? "Open EPUB file" : "Drag an EPUB file here"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {compact ? "Tap to choose from your device" : "or tap to browse - .epub up to 50 MB"}
            </p>
          </div>
        </>
      )}
    </label>
  );
}
