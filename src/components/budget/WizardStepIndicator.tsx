import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  title: string;
  description?: string;
}

interface WizardStepIndicatorProps {
  steps: Step[];
  currentStep: number;
  onStepClick: (index: number) => void;
}

export default function WizardStepIndicator({
  steps,
  currentStep,
  onStepClick,
}: WizardStepIndicatorProps) {
  return (
    <div className="w-full">
      {/* Mobile view - simplified */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Step {currentStep + 1} of {steps.length}
          </span>
          <span className="text-sm text-muted-foreground">
            {steps[currentStep].title}
          </span>
        </div>
        <div className="flex gap-1">
          {steps.map((_, index) => (
            <div
              key={index}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all cursor-pointer",
                index === currentStep
                  ? "bg-primary"
                  : index < currentStep
                  ? "bg-success"
                  : "bg-muted"
              )}
              onClick={() => onStepClick(index)}
            />
          ))}
        </div>
      </div>

      {/* Desktop view - full stepper */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center flex-1">
              <div
                className={cn(
                  "flex items-center cursor-pointer group",
                  index <= currentStep ? "text-foreground" : "text-muted-foreground"
                )}
                onClick={() => onStepClick(index)}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                    index === currentStep
                      ? "border-primary bg-primary text-primary-foreground"
                      : index < currentStep
                      ? "border-success bg-success text-success-foreground"
                      : "border-muted bg-muted group-hover:border-muted-foreground"
                  )}
                >
                  {index < currentStep ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>
                <div className="ml-3">
                  <p
                    className={cn(
                      "text-sm font-medium transition-colors",
                      index === currentStep
                        ? "text-primary"
                        : index < currentStep
                        ? "text-success"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    {step.title}
                  </p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground hidden lg:block">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-4 transition-colors",
                    index < currentStep ? "bg-success" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
