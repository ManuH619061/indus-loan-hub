import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUTS = [
  {
    category: "Navigation",
    items: [
      { keys: ["/"], description: "Open search" },
      { keys: ["g", "d"], description: "Go to Dashboard" },
      { keys: ["g", "l"], description: "Go to Loan Manager" },
      { keys: ["g", "b"], description: "Go to Bank Manager" },
      { keys: ["g", "e"], description: "Go to Expenses" },
      { keys: ["g", "p"], description: "Go to Budget Planner" },
      { keys: ["g", "c"], description: "Go to EMI Calendar" },
    ],
  },
  {
    category: "Actions",
    items: [
      { keys: ["q"], description: "Open Quick Actions" },
      { keys: ["n"], description: "Open Notifications" },
      { keys: ["?"], description: "Show keyboard shortcuts" },
      { keys: ["Esc"], description: "Close dialog / modal" },
    ],
  },
  {
    category: "Search Results",
    items: [
      { keys: ["↑", "↓"], description: "Navigate results" },
      { keys: ["Enter"], description: "Select result" },
    ],
  },
];

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          {SHORTCUTS.map((section) => (
            <div key={section.category}>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                {section.category}
              </h4>
              <div className="space-y-2">
                {section.items.map((shortcut, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <span key={keyIdx}>
                          <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border bg-muted px-1.5 font-mono text-xs">
                            {key}
                          </kbd>
                          {keyIdx < shortcut.keys.length - 1 && (
                            <span className="mx-0.5 text-muted-foreground">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
