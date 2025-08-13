import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lead } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface KanbanBoardProps {
  leads: Lead[];
}

const stageColumns = [
  { id: 'new', title: 'New Leads', color: 'bg-gray-50' },
  { id: 'contacted', title: 'Contacted', color: 'bg-yellow-50' },
  { id: 'quoted', title: 'Quoted', color: 'bg-blue-50' },
  { id: 'funded', title: 'Closed', color: 'bg-green-50' },
];

export default function KanbanBoard({ leads }: KanbanBoardProps) {
  const getLeadsByStage = (stage: string) => {
    return leads.filter(lead => lead.stage === stage);
  };

  const getPriorityColor = (score: number) => {
    if (score >= 80) return 'bg-red-100 text-red-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getPriorityLabel = (score: number) => {
    if (score >= 80) return 'High Priority';
    if (score >= 60) return 'Medium';
    return 'Low';
  };

  return (
    <div>
      {/* View Toggle */}
      <div className="flex items-center space-x-4 mb-6">
        <span className="text-sm font-medium text-gray-700">View:</span>
        <Button size="sm" className="bg-primary text-white">Kanban</Button>
        <Button size="sm" variant="outline">Table</Button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {stageColumns.map((column) => {
          const stageLeads = getLeadsByStage(column.id);
          
          return (
            <div key={column.id} className={`${column.color} rounded-lg p-4`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-900">{column.title}</h3>
                <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                  {stageLeads.length}
                </Badge>
              </div>
              
              <div className="space-y-3">
                {stageLeads.map((lead) => (
                  <Card key={lead.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-sm">
                          {lead.firstName} {lead.lastName}
                        </h4>
                        <span className="text-xs text-gray-500">
                          {lead.createdAt ? formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true }) : 'Recently'}
                        </span>
                      </div>
                      
                      <p className="text-xs text-gray-600 mb-2">
                        {lead.email}
                      </p>
                      
                      <p className="text-xs text-gray-600 mb-3">
                        {lead.phone}
                      </p>
                      
                      <div className="flex justify-between items-center">
                        <Badge 
                          className={`text-xs ${getPriorityColor(lead.score || 0)}`}
                        >
                          {getPriorityLabel(lead.score || 0)}
                        </Badge>
                        <span className="text-xs text-green-600 font-medium">
                          Est. $129/mo
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {stageLeads.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No leads in this stage</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
