import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AdminNavProps {
  search: string;
  setSearch: (val: string) => void;
  priority: string;
  setPriority: (val: string) => void;
}

export default function AdminNav({
  search,
  setSearch,
  priority,
  setPriority,
}: AdminNavProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 border-b bg-white">
      <nav className="flex items-center gap-4">
        <a href="#analytics" className="font-semibold text-primary">
          Dashboard
        </a>
        <a href="#leads" className="text-gray-600 hover:text-primary">
          Leads
        </a>
        <a href="#customers" className="text-gray-600 hover:text-primary">
          Customers
        </a>
      </nav>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <Input
          placeholder="Search leads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64"
        />
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </header>
  );
}

