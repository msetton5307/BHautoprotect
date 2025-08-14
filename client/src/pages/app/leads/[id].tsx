import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  MapPin, 
  Car, 
  FileText, 
  MessageSquare, 
  CheckSquare,
  Plus,
  Send
} from "lucide-react";
import CrmSidebar from "@/components/crm-sidebar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { LEAD_STAGES } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

export default function LeadDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [newNote, setNewNote] = useState('');
  const [newTask, setNewTask] = useState({ title: '', description: '', dueAt: '' });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: leadData, isLoading: leadLoading, error } = useQuery({
    queryKey: ["/api/leads", id],
    enabled: !!id && isAuthenticated,
    retry: false,
  });

  const updateLeadMutation = useMutation({
    mutationFn: async (updates: any) => {
      return apiRequest("PATCH", `/api/leads/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", id] });
      toast({
        title: "Lead Updated",
        description: "Lead has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (body: string) => {
      return apiRequest("POST", `/api/leads/${id}/notes`, { body });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", id] });
      setNewNote('');
      toast({
        title: "Note Added",
        description: "Note has been added successfully.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addTaskMutation = useMutation({
    mutationFn: async (task: any) => {
      return apiRequest("POST", `/api/leads/${id}/tasks`, task);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", id] });
      setNewTask({ title: '', description: '', dueAt: '' });
      toast({
        title: "Task Created",
        description: "Task has been created successfully.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading || leadLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error && isUnauthorizedError(error as Error)) {
    return null;
  }

  if (!leadData?.data) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <CrmSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Lead Not Found</h2>
            <p className="text-gray-600">The requested lead could not be found.</p>
            <Button className="mt-4" onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { lead, vehicle, quotes, notes, tasks, messages } = leadData.data;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <CrmSidebar />
      
      <div className="flex-1">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <Button 
                  variant="ghost" 
                  onClick={() => window.history.back()}
                  className="mr-4"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {lead.firstName} {lead.lastName}
                  </h1>
                  <p className="text-gray-600">Lead ID: {lead.id}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Select 
                  value={lead.stage} 
                  onValueChange={(value) => updateLeadMutation.mutate({ stage: value })}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STAGES.map((stage) => (
                      <SelectItem key={stage.value} value={stage.value}>
                        {stage.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button>
                  <FileText className="w-4 h-4 mr-2" />
                  Create Quote
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Lead Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Avatar className="w-8 h-8 mr-3">
                      <AvatarFallback>
                        {lead.firstName?.[0]}{lead.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 mr-2 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-medium">{lead.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 mr-2 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Phone</p>
                        <p className="font-medium">{lead.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 mr-2 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Location</p>
                        <p className="font-medium">{lead.zip}, {lead.state}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Source</p>
                      <Badge variant="outline">{lead.source}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Vehicle Information */}
              {vehicle && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Car className="w-5 h-5 mr-2" />
                      Vehicle Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Year</p>
                        <p className="font-medium">{vehicle.year}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Make & Model</p>
                        <p className="font-medium">{vehicle.make} {vehicle.model}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Trim</p>
                        <p className="font-medium">{vehicle.trim || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Odometer</p>
                        <p className="font-medium">{vehicle.odometer?.toLocaleString()} miles</p>
                      </div>
                      {vehicle.vin && (
                        <div className="col-span-2">
                          <p className="text-sm text-gray-500">VIN</p>
                          <p className="font-medium font-mono">{vehicle.vin}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle>Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="notes">
                    <TabsList>
                      <TabsTrigger value="notes">Notes</TabsTrigger>
                      <TabsTrigger value="messages">Messages</TabsTrigger>
                      <TabsTrigger value="activity">Activity</TabsTrigger>
                    </TabsList>

                    <TabsContent value="notes" className="space-y-4">
                      {/* Add Note */}
                      <div className="border rounded-lg p-4">
                        <Textarea
                          placeholder="Add a note..."
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          className="mb-3"
                        />
                        <Button 
                          onClick={() => addNoteMutation.mutate(newNote)}
                          disabled={!newNote.trim() || addNoteMutation.isPending}
                          size="sm"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Note
                        </Button>
                      </div>

                      {/* Notes List */}
                      <div className="space-y-3">
                        {notes?.map((note: any) => (
                          <div key={note.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <p className="font-medium">Internal Note</p>
                              <p className="text-sm text-gray-500">
                                {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                            <p className="text-gray-700">{note.body}</p>
                          </div>
                        ))}
                        {(!notes || notes.length === 0) && (
                          <p className="text-gray-500 text-center py-4">No notes yet</p>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="messages">
                      <div className="space-y-3">
                        {messages?.map((message: any) => (
                          <div key={message.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <Badge variant={message.direction === 'in' ? 'default' : 'secondary'}>
                                {message.direction === 'in' ? 'Incoming' : 'Outgoing'} {message.channel}
                              </Badge>
                              <p className="text-sm text-gray-500">
                                {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                            <p className="text-gray-700">{message.body}</p>
                          </div>
                        ))}
                        {(!messages || messages.length === 0) && (
                          <p className="text-gray-500 text-center py-4">No messages yet</p>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="activity">
                      <p className="text-gray-500 text-center py-4">No activity yet</p>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" variant="outline">
                    <Phone className="w-4 h-4 mr-2" />
                    Call Lead
                  </Button>
                  <Button className="w-full" variant="outline">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Send SMS
                  </Button>
                  <Button className="w-full" variant="outline">
                    <Mail className="w-4 h-4 mr-2" />
                    Send Email
                  </Button>
                  <Button className="w-full">
                    <FileText className="w-4 h-4 mr-2" />
                    Generate Quote
                  </Button>
                </CardContent>
              </Card>

              {/* Tasks */}
              <Card>
                <CardHeader>
                  <CardTitle>Tasks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add Task */}
                  <div className="space-y-3">
                    <Input
                      placeholder="Task title"
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    />
                    <Textarea
                      placeholder="Description (optional)"
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    />
                    <Input
                      type="datetime-local"
                      value={newTask.dueAt}
                      onChange={(e) => setNewTask({ ...newTask, dueAt: e.target.value })}
                    />
                    <Button 
                      onClick={() => addTaskMutation.mutate({
                        title: newTask.title,
                        description: newTask.description || null,
                        dueAt: newTask.dueAt ? new Date(newTask.dueAt).toISOString() : null,
                        type: 'follow_up',
                      })}
                      disabled={!newTask.title.trim() || addTaskMutation.isPending}
                      size="sm"
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Task
                    </Button>
                  </div>

                  {/* Tasks List */}
                  <div className="space-y-3">
                    {tasks?.map((task: any) => (
                      <div key={task.id} className="border rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start">
                            <CheckSquare className="w-4 h-4 mr-2 mt-1 text-gray-400" />
                            <div>
                              <p className="font-medium text-sm">{task.title}</p>
                              {task.description && (
                                <p className="text-xs text-gray-600 mt-1">{task.description}</p>
                              )}
                              {task.dueAt && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Due: {formatDistanceToNow(new Date(task.dueAt), { addSuffix: true })}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!tasks || tasks.length === 0) && (
                      <p className="text-gray-500 text-center py-4 text-sm">No tasks yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Quotes */}
              {quotes && quotes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Quotes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {quotes.map((quote: any) => (
                      <div key={quote.id} className="border rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant="outline">{quote.plan}</Badge>
                          <Badge 
                            variant={quote.status === 'accepted' ? 'default' : 'secondary'}
                          >
                            {quote.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500">Details unavailable</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
