import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReaderNoteEditorSheetProps {
  open: boolean;
  currentText: string;
  noteDraft: string;
  hasCurrentNote: boolean;
  onClose: () => void;
  onDeleteOrCancel: () => void;
  onSave: () => void;
  onDraftChange: (value: string) => void;
}

export function ReaderNoteEditorSheet({
  open,
  currentText,
  noteDraft,
  hasCurrentNote,
  onClose,
  onDeleteOrCancel,
  onSave,
  onDraftChange,
}: ReaderNoteEditorSheetProps) {
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
        aria-label="Add note"
      >
        <div className="flex justify-center pt-3">
          <div className="h-1.5 w-12 rounded-full bg-muted" />
        </div>
        <div className="flex items-center justify-between px-6 pt-4">
          <h2 className="font-serif text-xl">Note</h2>
          <button
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-4 px-6 pb-8 pt-4">
          <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            {currentText || "Select a line to attach a note."}
          </div>
          <textarea
            value={noteDraft}
            onChange={(event) => onDraftChange(event.target.value)}
            rows={6}
            placeholder="Write a note for this line"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none ring-0 placeholder:text-muted-foreground focus:border-accent"
          />
          <div className="flex items-center justify-between">
            <button
              onClick={onDeleteOrCancel}
              className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {hasCurrentNote ? "Delete note" : "Cancel"}
            </button>
            <button
              onClick={onSave}
              className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-foreground"
            >
              Save note
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
