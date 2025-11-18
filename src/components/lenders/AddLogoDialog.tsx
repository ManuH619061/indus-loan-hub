import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link2, Upload, Loader2 } from "lucide-react";

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
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [fetchingFavicon, setFetchingFavicon] = useState(false);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Logo for {lenderName}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="url" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url">From URL</TabsTrigger>
            <TabsTrigger value="fetch">Fetch from Website</TabsTrigger>
          </TabsList>
          
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
