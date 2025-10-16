import { Dialog, DialogContent } from "@/components/ui/dialog";
import { QuoteForm } from "@/components/quote-form";

interface QuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuoteModal({ isOpen, onClose }: QuoteModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <QuoteForm onSubmitted={onClose} />
      </DialogContent>
    </Dialog>
  );
}
