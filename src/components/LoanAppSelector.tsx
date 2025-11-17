import { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const POPULAR_LOAN_APPS = [
  { value: "branch", label: "Branch" },
  { value: "moneyview", label: "MoneyView" },
  { value: "navi", label: "Navi" },
  { value: "paytm", label: "Paytm" },
  { value: "phonepe", label: "PhonePe" },
  { value: "googlepay", label: "Google Pay" },
  { value: "amazonpay", label: "Amazon Pay" },
  { value: "cred", label: "CRED" },
  { value: "mobikwik", label: "MobiKwik" },
  { value: "freecharge", label: "Freecharge" },
  { value: "bajajfinserv", label: "Bajaj Finserv" },
  { value: "tatadigital", label: "Tata Digital" },
  { value: "dhani", label: "Dhani" },
  { value: "earlysalary", label: "EarlySalary" },
  { value: "kreditbee", label: "KreditBee" },
  { value: "moneytap", label: "MoneyTap" },
  { value: "stashfin", label: "StashFin" },
  { value: "paysense", label: "PaySense" },
  { value: "incred", label: "InCred" },
  { value: "lendingkart", label: "Lendingkart" },
  { value: "prefr", label: "Prefr" },
  { value: "zestmoney", label: "ZestMoney" },
  { value: "simpl", label: "Simpl" },
  { value: "flexmoney", label: "FlexMoney" },
  { value: "creditmantri", label: "Credit Mantri" },
  { value: "fairmoney", label: "FairMoney" },
  { value: "cashe", label: "CASHe" },
  { value: "lazypay", label: "LazyPay" },
  { value: "kissht", label: "Kissht" },
  { value: "instacred", label: "InstaCred" },
  { value: "rupeecircle", label: "RupeeCircle" },
  { value: "lendbox", label: "Lendbox" },
  { value: "indifi", label: "Indifi" },
  { value: "capital18", label: "Capital18" },
  { value: "niyo", label: "Niyo" },
  { value: "slice", label: "Slice" },
  { value: "uni", label: "Uni" },
  { value: "onecard", label: "OneCard" },
  { value: "jupiter", label: "Jupiter" },
  { value: "fi", label: "Fi Money" },
  { value: "epifi", label: "Epifi" },
  { value: "kreditzy", label: "Kreditzy" },
  { value: "loantap", label: "LoanTap" },
  { value: "fullertonindia", label: "Fullerton India" },
  { value: "tataCapital", label: "Tata Capital" },
  { value: "hdb", label: "HDB Financial" },
  { value: "idfc", label: "IDFC First Bank" },
  { value: "hdfc", label: "HDFC Bank" },
  { value: "icici", label: "ICICI Bank" },
  { value: "sbi", label: "State Bank of India" },
  { value: "axis", label: "Axis Bank" },
  { value: "kotak", label: "Kotak Mahindra Bank" },
  { value: "indusind", label: "IndusInd Bank" },
  { value: "yesbank", label: "Yes Bank" },
  { value: "rbl", label: "RBL Bank" },
  { value: "standard", label: "Standard Chartered" },
  { value: "pnb", label: "Punjab National Bank" },
  { value: "bob", label: "Bank of Baroda" },
  { value: "unionbank", label: "Union Bank of India" },
  { value: "canara", label: "Canara Bank" },
].sort((a, b) => a.label.localeCompare(b.label));

interface LoanAppSelectorProps {
  value: string;
  onSelect: (value: string) => void;
  placeholder?: string;
}

export function LoanAppSelector({ value, onSelect, placeholder = "Select loan app..." }: LoanAppSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value
            ? POPULAR_LOAN_APPS.find((app) => app.value === value)?.label
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search loan app..." />
          <CommandList>
            <CommandEmpty>No loan app found.</CommandEmpty>
            <CommandGroup>
              {POPULAR_LOAN_APPS.map((app) => (
                <CommandItem
                  key={app.value}
                  value={app.value}
                  onSelect={(currentValue) => {
                    onSelect(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === app.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {app.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
