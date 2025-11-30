import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import LenderAvatar from "@/components/lenders/LenderAvatar";

interface Lender {
  id: string;
  name: string;
  type: string;
  logo_url?: string | null;
}

interface LenderMasterSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  onAddNew: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function LenderMasterSelector({
  value,
  onValueChange,
  onAddNew,
  placeholder = "Select lender...",
  disabled = false,
}: LenderMasterSelectorProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchLenders();
      
      // Subscribe to real-time updates
      const channel = supabase
        .channel('lender-master-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'lenders',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchLenders();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchLenders = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("lenders")
        .select("id, name, type, logo_url")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      setLenders(data || []);
    } catch (error) {
      console.error("Error fetching lenders:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedLender = lenders.find((l) => l.id === value);

  const getLenderTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      BANK: "Bank",
      NBFC: "NBFC",
      CARD: "Credit Card",
      FRIEND: "Friend/Family",
      OTHER: "Other",
    };
    return types[type] || type;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {selectedLender ? (
            <div className="flex items-center gap-2 truncate">
              <LenderAvatar 
                name={selectedLender.name} 
                logoUrl={selectedLender.logo_url} 
                size="sm" 
              />
              <span className="truncate">{selectedLender.name}</span>
              <span className="text-xs text-muted-foreground">
                ({getLenderTypeLabel(selectedLender.type)})
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search lenders..." />
          <CommandList>
            <CommandEmpty>
              {loading ? (
                <span className="text-muted-foreground">Loading...</span>
              ) : (
                <div className="py-2 text-center text-sm">
                  <p className="text-muted-foreground">No lenders found.</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      onAddNew();
                    }}
                    className="mt-1"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add new lender
                  </Button>
                </div>
              )}
            </CommandEmpty>
            
            {lenders.length > 0 && (
              <CommandGroup heading="Your Lenders">
                {lenders.map((lender) => (
                  <CommandItem
                    key={lender.id}
                    value={`${lender.name} ${lender.type}`}
                    onSelect={() => {
                      onValueChange(lender.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === lender.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <LenderAvatar 
                        name={lender.name} 
                        logoUrl={lender.logo_url} 
                        size="sm" 
                      />
                      <span className="truncate">{lender.name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {getLenderTypeLabel(lender.type)}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandSeparator />
            
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  onAddNew();
                }}
                className="text-primary cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4" />
                <span className="font-medium">Add New Lender...</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
