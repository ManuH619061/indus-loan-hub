import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

interface DeleteLenderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lenderName: string;
  hasLoans: boolean;
  onConfirm: () => Promise<void>;
  loading: boolean;
}

export default function DeleteLenderDialog({
  open,
  onOpenChange,
  lenderName,
  hasLoans,
  onConfirm,
  loading,
}: DeleteLenderDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Lender</AlertDialogTitle>
          <AlertDialogDescription>
            {hasLoans ? (
              <>
                <span className="text-destructive font-medium">
                  Cannot delete "{lenderName}"
                </span>
                <br />
                This lender has active loans associated with it. Please close or
                reassign those loans before deleting this lender.
              </>
            ) : (
              <>
                Are you sure you want to delete "{lenderName}"? This action
                cannot be undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          {!hasLoans && (
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
