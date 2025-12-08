import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { FileText, Upload, FolderOpen, Search } from "lucide-react";

type DocumentEmptyStateProps = {
  hasFilters: boolean;
  onUpload: () => void;
  onClearFilters: () => void;
};

export default function DocumentEmptyState({
  hasFilters,
  onUpload,
  onClearFilters,
}: DocumentEmptyStateProps) {
  if (hasFilters) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-16 text-center"
      >
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <Search className="h-10 w-10 text-muted-foreground" />
          </div>
        </div>
        <h3 className="text-xl font-semibold mb-2">No documents found</h3>
        <p className="text-muted-foreground mb-6 max-w-sm">
          Try adjusting your filters or search terms to find what you're looking for.
        </p>
        <Button variant="outline" onClick={onClearFilters}>
          Clear All Filters
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      {/* Animated illustration */}
      <div className="relative mb-8">
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative"
        >
          {/* Background circles */}
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute inset-0 w-32 h-32 rounded-full bg-primary/10"
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
            className="absolute inset-0 w-32 h-32 rounded-full bg-primary/5"
          />
          
          {/* Main folder */}
          <div className="relative w-32 h-32 flex items-center justify-center">
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="bg-primary/10 rounded-2xl p-6"
            >
              <FolderOpen className="h-12 w-12 text-primary" />
            </motion.div>
          </div>
          
          {/* Floating documents */}
          <motion.div
            animate={{ y: [0, -8, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 0.2 }}
            className="absolute -top-2 -right-2 bg-background rounded-lg shadow-lg p-2"
          >
            <FileText className="h-6 w-6 text-muted-foreground" />
          </motion.div>
          
          <motion.div
            animate={{ y: [0, -6, 0], rotate: [0, -5, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 0.4 }}
            className="absolute -bottom-1 -left-3 bg-background rounded-lg shadow-lg p-2"
          >
            <FileText className="h-5 w-5 text-muted-foreground" />
          </motion.div>
        </motion.div>
      </div>

      <h3 className="text-2xl font-bold mb-2">Your Document Vault is Empty</h3>
      <p className="text-muted-foreground mb-8 max-w-md">
        Start building your financial document library. Upload loan agreements, 
        bank statements, insurance papers, and more.
      </p>
      
      <Button size="lg" onClick={onUpload} className="shadow-lg">
        <Upload className="h-5 w-5 mr-2" />
        Upload Your First Document
      </Button>

      <div className="mt-8 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
        <span className="bg-muted px-2 py-1 rounded">📄 Loan Agreements</span>
        <span className="bg-muted px-2 py-1 rounded">🏦 Bank Statements</span>
        <span className="bg-muted px-2 py-1 rounded">🔐 Insurance</span>
        <span className="bg-muted px-2 py-1 rounded">🪪 ID Proofs</span>
        <span className="bg-muted px-2 py-1 rounded">🧾 Receipts</span>
      </div>
    </motion.div>
  );
}
