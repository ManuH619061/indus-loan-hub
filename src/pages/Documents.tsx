"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Plus, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Lender = {
  name: string | null;
};

type Loan = {
  loan_name: string | null;
  user_id: string;
  lenders: Lender | null;
};

type DocumentRow = {
  id: string;
  label: string | null;
  doc_type: string | null;
  file_url: string | null;
  added_on: string | null;
  valid_to: string | null;
  notes: string | null;
  loans: Loan | null;
};

export default function Documents() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentRow | null>(null);

  useEffect(() => {
    if (user) {
      void fetchDocuments();
    }
  }, [user]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("documents")
        .select(`
          *,
          loans!inner (
            loan_name,
            user_id,
            lenders (name)
          )
        `)
        .order("added_on", { ascending: false });

      if (error) throw error;

      // Optional: filter by current user if needed
      const filtered = (data as any)?.filter((doc: any) => doc.loans?.user_id === user?.id) ?? [];

      setDocuments(filtered as DocumentRow[]);
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast({
        title: "Error loading documents",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;

    try {
      // Delete from storage if file exists
      if (documentToDelete.file_url) {
        // Use the full storage path (file_url already contains the full path)
        const { error: storageError } = await supabase.storage
          .from("loan-documents")
          .remove([documentToDelete.file_url]);

        if (storageError) {
          console.error("Storage deletion error:", storageError);
          throw new Error(`Failed to delete file from storage: ${storageError.message}`);
        }
      }

      // Delete document record
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", documentToDelete.id);

      if (error) throw error;

      toast({ title: "Document deleted successfully" });
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
      void fetchDocuments();
    } catch (error: any) {
      console.error("Error deleting document:", error);
      toast({
        title: "Error deleting document",
        description: error?.message ?? "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const byLoan = useMemo(() => {
    const grouped: Record<string, DocumentRow[]> = {};
    documents.forEach((doc) => {
      const loanName = doc.loans?.loan_name || "Unknown loan";
      if (!grouped[loanName]) grouped[loanName] = [];
      grouped[loanName].push(doc);
    });
    return grouped;
  }, [documents]);

  const byLender = useMemo(() => {
    const grouped: Record<string, DocumentRow[]> = {};
    documents.forEach((doc) => {
      const lenderName = doc.loans?.lenders?.name || "Unknown lender";
      if (!grouped[lenderName]) grouped[lenderName] = [];
      grouped[lenderName].push(doc);
    });
    return grouped;
  }, [documents]);

  const DocumentCard = ({ doc }: { doc: DocumentRow }) => {
    const addedOnDate = doc.added_on ? new Date(doc.added_on) : null;
    const validToDate = doc.valid_to ? new Date(doc.valid_to) : null;

    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <FileText className="h-5 w-5 text-muted-foreground mt-1" />
              <div className="flex-1">
                <h4 className="font-medium">{doc.label || "Untitled document"}</h4>
                <p className="text-sm text-muted-foreground">
                  {doc.doc_type || "Document"}
                  {addedOnDate && (
                    <>
                      {" "}
                      • Added{" "}
                      {formatDistanceToNow(addedOnDate, {
                        addSuffix: true,
                      })}
                    </>
                  )}
                </p>
                {validToDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Valid until {validToDate.toLocaleDateString("en-IN")}
                  </p>
                )}
                {doc.notes && <p className="text-sm mt-2 whitespace-pre-line">{doc.notes}</p>}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {doc.file_url && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDocumentToDelete(doc);
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">Manage loan documents and files</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      <Tabs defaultValue="by-loan" className="w-full">
        <TabsList>
          <TabsTrigger value="by-loan">By Loan</TabsTrigger>
          <TabsTrigger value="by-lender">By Lender</TabsTrigger>
        </TabsList>

        <TabsContent value="by-loan" className="space-y-6 mt-6">
          {Object.keys(byLoan).length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center py-8">
                  No documents uploaded yet. Add documents to your loans to see them here.
                </p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(byLoan).map(([loanName, docs]) => (
              <div key={loanName} className="space-y-3">
                <h3 className="text-lg font-semibold mb-1">{loanName}</h3>
                {docs.map((doc) => (
                  <DocumentCard key={doc.id} doc={doc} />
                ))}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="by-lender" className="space-y-6 mt-6">
          {Object.keys(byLender).length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center py-8">
                  No documents uploaded yet. Add documents to your loans to see them here.
                </p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(byLender).map(([lenderName, docs]) => (
              <div key={lenderName} className="space-y-3">
                <h3 className="text-lg font-semibold mb-1">{lenderName}</h3>
                {docs.map((doc) => (
                  <DocumentCard key={doc.id} doc={doc} />
                ))}
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{documentToDelete?.label || "this document"}&quot;? This
              action cannot be undone and will permanently remove the document from storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
