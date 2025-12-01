import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ZoomIn, ZoomOut, X } from "lucide-react";
import { useState } from "react";

type DocumentPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    label: string;
    file_url: string;
    file_name: string | null;
  } | null;
};

export default function DocumentPreviewDialog({ open, onOpenChange, document }: DocumentPreviewDialogProps) {
  const [zoom, setZoom] = useState(100);

  if (!document) return null;

  const fileExtension = document.file_name?.split('.').pop()?.toLowerCase() || 
                       document.file_url.split('.').pop()?.toLowerCase();
  
  const isPDF = fileExtension === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '');

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex-1">{document.label}</DialogTitle>
            <div className="flex items-center gap-2">
              {isImage && (
                <>
                  <Button variant="outline" size="sm" onClick={handleZoomOut}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
                    {zoom}%
                  </span>
                  <Button variant="outline" size="sm" onClick={handleZoomIn}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" asChild>
                <a href={document.file_url} download>
                  <Download className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto bg-muted/20 rounded-lg">
          {isPDF && (
            <iframe
              src={document.file_url}
              className="w-full h-full border-0"
              title={document.label}
            />
          )}
          
          {isImage && (
            <div className="flex items-center justify-center h-full p-4">
              <img
                src={document.file_url}
                alt={document.label}
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '100%',
                  transform: `scale(${zoom / 100})`,
                  transition: 'transform 0.2s ease-in-out'
                }}
                className="object-contain"
              />
            </div>
          )}
          
          {!isPDF && !isImage && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <p className="mb-4">Preview not available for this file type</p>
              <Button asChild>
                <a href={document.file_url} download>
                  <Download className="h-4 w-4 mr-2" />
                  Download to View
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
