import { Button } from "@/components/ui/button";

interface QuickQuestionChipsProps {
  questions: string[];
  onSelect: (question: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function QuickQuestionChips({ questions, onSelect, disabled, compact }: QuickQuestionChipsProps) {
  if (questions.length === 0) return null;

  return (
    <div className={`flex gap-2 overflow-x-auto scrollbar-hide ${compact ? "pb-1" : "pb-2"}`}>
      {questions.map((question, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          className={`whitespace-nowrap flex-shrink-0 rounded-full border-border hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-colors ${
            compact ? "h-8 text-xs px-3" : "h-9 text-sm px-4"
          }`}
          onClick={() => onSelect(question)}
          disabled={disabled}
        >
          {question}
        </Button>
      ))}
    </div>
  );
}
