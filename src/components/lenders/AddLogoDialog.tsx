import { useState, useRef, DragEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link2, Upload, Loader2, ImageIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import ImageCropper from "./ImageCropper";

interface AddLogoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lenderId: string;
  lenderName: string;
  onLogoAdded: () => void;
}

export default function AddLogoDialog({
  open,
  onOpenChange,
  lenderId,
  lenderName,
  onLogoAdded,
}: AddLogoDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [fetchingFavicon, setFetchingFavicon] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFetchFavicon = async () => {
    if (!websiteUrl) return;
    
    setFetchingFavicon(true);
    try {
      const url = new URL(websiteUrl);
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=128`;
      setLogoUrl(faviconUrl);
      toast({ title: "Favicon fetched!", description: "Preview the logo before saving" });
    } catch (error) {
      toast({ 
        variant: "destructive", 
        title: "Invalid URL", 
        description: "Please enter a valid website URL" 
      });
    } finally {
      setFetchingFavicon(false);
    }
  };

  const handleCropComplete = (blob: Blob) => {
    setCroppedBlob(blob);
    setShowCropper(false);
    
    // Create preview URL for the cropped image
    const previewUrl = URL.createObjectURL(blob);
    setLogoUrl(previewUrl);
  };

  const handleCancelCrop = () => {
    setShowCropper(false);
    setSelectedFile(null);
    setLogoUrl("");
  };

  const handleFileUpload = async () => {
    if (!croppedBlob || !user) {
      toast({ variant: "destructive", title: "Please crop the image first" });
      return;
    }

    setUploading(true);
    try {
      const fileName = `${user.id}/${lenderId}-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("lender-logos")
        .upload(fileName, croppedBlob, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("lender-logos")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("lenders")
        .update({ logo_url: publicUrl })
        .eq("id", lenderId);

      if (updateError) throw updateError;

      toast({ title: "Logo uploaded successfully!" });
      onLogoAdded();
      onOpenChange(false);
      setSelectedFile(null);
      setCroppedBlob(null);
      setLogoUrl("");
      setWebsiteUrl("");
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Upload failed", 
        description: error.message 
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveLogo = async () => {
    if (!logoUrl) {
      toast({ variant: "destructive", title: "Please provide a logo URL" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("lenders")
        .update({ logo_url: logoUrl })
        .eq("id", lenderId);

      if (error) throw error;

      toast({ title: "Logo added successfully!" });
      onLogoAdded();
      onOpenChange(false);
      setLogoUrl("");
      setWebsiteUrl("");
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: error.message 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        setSelectedFile(file);
        setLogoUrl(URL.createObjectURL(file));
        setShowCropper(true);
      } else {
        toast({ variant: "destructive", title: "Please upload an image file" });
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith("image/")) {
        setSelectedFile(file);
        setLogoUrl(URL.createObjectURL(file));
        setShowCropper(true);
      } else {
        toast({ variant: "destructive", title: "Please upload an image file" });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Logo for {lenderName}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="url">From URL</TabsTrigger>
            <TabsTrigger value="fetch">Fetch from Website</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-4">
            {!showCropper && !croppedBlob && (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag & drop your logo here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports: PNG, JPG, JPEG, WEBP • Will be resized to 256×256px
                </p>
              </div>
            )}
            
            {showCropper && logoUrl && (
              <ImageCropper
                imageSrc={logoUrl}
                onCropComplete={handleCropComplete}
                onCancel={handleCancelCrop}
              />
            )}
            
            {croppedBlob && logoUrl && !showCropper && (
              <>
                <div className="flex justify-center p-4 bg-muted rounded-lg">
                  <img 
                    src={logoUrl} 
                    alt="Logo preview" 
                    className="h-32 w-32 object-contain"
                  />
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  Logo cropped and ready to upload (256×256px)
                </p>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      setShowCropper(true);
                      setCroppedBlob(null);
                    }} 
                    variant="outline"
                    className="flex-1"
                  >
                    Re-crop
                  </Button>
                  <Button 
                    onClick={handleFileUpload} 
                    disabled={uploading} 
                    className="flex-1"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Logo
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
          
          <TabsContent value="url" className="space-y-4">
            <div className="space-y-2">
              <Label>Logo URL</Label>
              <Input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </div>
            {logoUrl && (
              <div className="flex justify-center p-4 bg-muted rounded-lg">
                <img 
                  src={logoUrl} 
                  alt="Logo preview" 
                  className="h-16 w-16 object-contain"
                  onError={(e) => {
                    e.currentTarget.src = "";
                    toast({ 
                      variant: "destructive", 
                      title: "Invalid image URL" 
                    });
                  }}
                />
              </div>
            )}
            <Button onClick={handleSaveLogo} disabled={loading || !logoUrl} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Save Logo
                </>
              )}
            </Button>
          </TabsContent>
          
          <TabsContent value="fetch" className="space-y-4">
            <div className="space-y-2">
              <Label>Website or App Store URL</Label>
              <Input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://www.lender-website.com"
              />
            </div>
            <Button 
              onClick={handleFetchFavicon} 
              disabled={fetchingFavicon || !websiteUrl}
              variant="outline"
              className="w-full"
            >
              {fetchingFavicon ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Fetch Logo
                </>
              )}
            </Button>
            {logoUrl && (
              <>
                <div className="flex justify-center p-4 bg-muted rounded-lg">
                  <img 
                    src={logoUrl} 
                    alt="Logo preview" 
                    className="h-16 w-16 object-contain"
                  />
                </div>
                <Button onClick={handleSaveLogo} disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Save Logo
                    </>
                  )}
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
