import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreHorizontal, Eye, MessageSquare, Phone, Mail } from "lucide-react";
import { Lead } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { LEAD_STAGES } from "@/lib/constants";

interface LeadTableProps {
  leads: Lead[];
  onUpdateLead: (id: string, updates: any) => void;
  isUpdating: boolean;
}

export default function LeadTable({ leads, onUpdateLead, isUpdating }: LeadTableProps) {
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(new Set(leads.map(lead => lead.id)));
    } else {
      setSelectedLeads(new Set());
    }
  };

  const handleSelectLead = (leadId: string, checked: boolean) => {
    const newSelected = new Set(selectedLeads);
    if (checked) {
      newSelected.add(leadId);
    } else {
      newSelected.delete(leadId);
    }
    setSelectedLeads(newSelected);
  };

  const getStageColor = (stage: string) => {
    const stageConfig = LEAD_STAGES.find(s => s.value === stage);
    return stageConfig?.color || 'bg-gray-50';
  };

  const getStageLabel = (stage: string) => {
    const stageConfig = LEAD_STAGES.find(s => s.value === stage);
    return stageConfig?.label || stage;
  };

  const getPriorityColor = (score: number) => {
    if (score >= 80) return 'bg-red-100 text-red-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getPriorityLabel = (score: number) => {
    if (score >= 80) return 'High';
    if (score >= 60) return 'Medium';
    return 'Low';
  };

  const sortedLeads = [...leads].sort((a, b) => {
    let aValue: any = a[sortField as keyof Lead];
    let bValue: any = b[sortField as keyof Lead];

    if (sortField === 'createdAt') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    }

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (sortDirection === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      {selectedLeads.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-blue-700">
              {selectedLeads.size} lead{selectedLeads.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex space-x-2">
              <Button size="sm" variant="outline">
                <MessageSquare className="w-4 h-4 mr-2" />
                Send SMS
              </Button>
              <Button size="sm" variant="outline">
                <Mail className="w-4 h-4 mr-2" />
                Send Email
              </Button>
              <Select onValueChange={(stage) => {
                selectedLeads.forEach(leadId => {
                  onUpdateLead(leadId, { stage });
                });
                setSelectedLeads(new Set());
              }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Change Stage" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STAGES.map((stage) => (
                    <SelectItem key={stage.value} value={stage.value}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedLeads.size === leads.length && leads.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('firstName')}
              >
                Name
                {sortField === 'firstName' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('email')}
              >
                Contact
                {sortField === 'email' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('stage')}
              >
                Stage
                {sortField === 'stage' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Source</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('createdAt')}
              >
                Created
                {sortField === 'createdAt' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLeads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedLeads.has(lead.id)}
                    onCheckedChange={(checked) => handleSelectLead(lead.id, !!checked)}
                  />
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{lead.firstName} {lead.lastName}</p>
                    {lead.assignedToId && (
                      <p className="text-sm text-gray-500">Assigned</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className="text-sm">{lead.email}</p>
                    <p className="text-sm text-gray-500">{lead.phone}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <p>Vehicle info needed</p>
                    <p className="text-gray-500">{lead.zip}, {lead.state}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Select 
                    value={lead.stage} 
                    onValueChange={(stage) => onUpdateLead(lead.id, { stage })}
                    disabled={isUpdating}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue>
                        <Badge className={getStageColor(lead.stage)}>
                          {getStageLabel(lead.stage)}
                        </Badge>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_STAGES.map((stage) => (
                        <SelectItem key={stage.value} value={stage.value}>
                          {stage.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={getPriorityColor(lead.score || 0)}
                  >
                    {getPriorityLabel(lead.score || 0)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {lead.source || 'Web'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {lead.createdAt ? formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true }) : 'Recently'}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => window.location.href = `/app/leads/${lead.id}`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => window.open(`tel:${lead.phone}`)}
                    >
                      <Phone className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => window.open(`mailto:${lead.email}`)}
                    >
                      <Mail className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {leads.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  No leads found. New leads will appear here as they come in.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Table Info */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <p>
          Showing {leads.length} lead{leads.length !== 1 ? 's' : ''}
          {selectedLeads.size > 0 && ` (${selectedLeads.size} selected)`}
        </p>
        <div className="flex items-center space-x-2">
          <span>Rows per page:</span>
          <Select defaultValue="50">
            <SelectTrigger className="w-16 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
