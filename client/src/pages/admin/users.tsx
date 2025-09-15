import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminNav from "@/components/admin-nav";
import AdminLogin from "@/components/admin-login";
import { getAuthHeaders, clearCredentials, getStoredUsername, fetchWithAuth } from "@/lib/auth";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users as UsersIcon, ShieldAlert, AlertTriangle } from "lucide-react";

const authJsonHeaders = () => ({
  ...getAuthHeaders(),
  "Content-Type": "application/json",
});

type ApiUser = {
  id: string;
  username: string;
  role: "admin" | "staff";
  createdAt: string | null;
};

type CreateUserPayload = {
  username: string;
  password: string;
  role: "admin" | "staff";
};

export default function AdminUsers() {
  const { authenticated, checking, markAuthenticated, markLoggedOut } = useAdminAuth();
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState<CreateUserPayload>({
    username: "",
    password: "",
    role: "staff",
  });
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const currentUsername = getStoredUsername();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queriesEnabled = authenticated && !checking;

  const usersQuery = useQuery({
    queryKey: ["/api/admin/users"],
    enabled: queriesEnabled,
    queryFn: async () => {
      const res = await fetchWithAuth("/api/admin/users", { headers: getAuthHeaders() });
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error("Unauthorized");
      }
      if (res.status === 403) {
        setForbidden(true);
        return { data: [] };
      }

      setForbidden(false);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to fetch users");
      }
      return data;
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const createUserMutation = useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      const res = await fetchWithAuth("/api/admin/users", {
        method: "POST",
        headers: authJsonHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error("Unauthorized");
      }
      if (res.status === 403) {
        setForbidden(true);
        throw new Error("You do not have permission to manage users");
      }
      if (!res.ok) {
        throw new Error(data?.message || "Failed to create user");
      }
      setForbidden(false);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setForm({ username: "", password: "", role: "staff" });
      toast({
        title: "User created",
        description: "The new user can now log in to the admin tools.",
      });
    },
    onError: (error: Error) => {
      if (error.message === "Unauthorized") return;
      toast({
        title: "Unable to create user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      setPendingDeleteId(id);
      const res = await fetchWithAuth(`/api/admin/users/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error("Unauthorized");
      }
      if (res.status === 403) {
        setForbidden(true);
        throw new Error("You do not have permission to manage users");
      }
      if (!res.ok) {
        throw new Error(data?.message || "Failed to delete user");
      }
      setForbidden(false);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User removed",
        description: "The user can no longer access the admin tools.",
      });
    },
    onError: (error: Error) => {
      if (error.message === "Unauthorized") return;
      toast({
        title: "Unable to remove user",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => setPendingDeleteId(null),
  });

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!authenticated) {
    return <AdminLogin onSuccess={markAuthenticated} />;
  }

  if (usersQuery.isLoading && !usersQuery.data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center text-lg font-semibold">
                <ShieldAlert className="h-5 w-5 text-red-500 mr-2" />
                Access restricted
              </CardTitle>
              <CardDescription>
                You must be an administrator to manage user accounts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Please contact a system administrator if you believe this is an error.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (usersQuery.error) {
    const message = usersQuery.error instanceof Error
      ? usersQuery.error.message
      : "Failed to load user accounts.";

    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center text-lg font-semibold">
                <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
                Unable to load users
              </CardTitle>
              <CardDescription>{message}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => usersQuery.refetch()} disabled={usersQuery.isFetching}>
                Try again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const users: ApiUser[] = usersQuery.data?.data ?? [];

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.username || !form.password) {
      toast({
        title: "Missing information",
        description: "Please provide both a username and password.",
        variant: "destructive",
      });
      return;
    }
    createUserMutation.mutate({ ...form, username: form.username.trim() });
  };

  const handleDelete = (id: string) => {
    if (deleteUserMutation.isPending || pendingDeleteId === id) return;
    const confirmed = window.confirm("Are you sure you want to remove this user?");
    if (confirmed) {
      deleteUserMutation.mutate(id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <UsersIcon className="h-6 w-6 mr-2 text-primary" />
            User Management
          </h1>
          <p className="text-gray-600 mt-2 max-w-2xl">
            Create individual logins for your team and remove access when accounts are no longer needed.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Active users</CardTitle>
              <CardDescription>Team members who can access the admin portal.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const created = user.createdAt
                        ? new Date(user.createdAt).toLocaleString("en-US", {
                            timeZone: "America/New_York",
                          })
                        : "—";
                      const isCurrentUser = currentUsername && user.username === currentUsername;
                      const isDeleting = deleteUserMutation.isPending && pendingDeleteId === user.id;
                      const disableDelete = !!(isCurrentUser || isDeleting);

                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.username}</TableCell>
                          <TableCell>
                            <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                              {user.role === "admin" ? "Admin" : "Staff"}
                            </Badge>
                          </TableCell>
                          <TableCell>{created}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={disableDelete}
                              onClick={() => handleDelete(user.id)}
                            >
                              {isDeleting ? "Removing..." : "Remove"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                          No users found. Use the form to invite your team.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add a user</CardTitle>
              <CardDescription>Provide a unique username and secure password.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Username</label>
                  <Input
                    required
                    value={form.username}
                    onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                    placeholder="jane.doe"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Password</label>
                  <Input
                    required
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Role</label>
                  <Select
                    value={form.role}
                    onValueChange={(value: "admin" | "staff") => setForm((prev) => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? "Creating..." : "Add user"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
