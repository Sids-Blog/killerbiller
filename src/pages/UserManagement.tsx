import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Edit, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface User {
  id: string;
  username: string;
  role_name: string;
}

const UserManagement = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_users_with_roles');

    if (error) {
      toast({ title: "Error fetching users", description: error.message, variant: "destructive" });
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  }, [toast]);

  const fetchRoles = useCallback(async () => {
    const { data, error } = await supabase.from('roles').select('*');
    if (error) {
      toast({ title: "Error fetching roles", description: error.message, variant: "destructive" });
    } else {
      setRoles(data || []);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [fetchUsers, fetchRoles]);

  const openDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      const role = roles.find(r => r.name === user.role_name);
      setSelectedRole(role?.id || '');
      setEmail(user.username);
      setPassword('');
    } else {
      setEditingUser(null);
      setSelectedRole('');
      setEmail('');
      setPassword('');
    }
    setIsDialogOpen(true);
  };

  const saveUser = async () => {
    if (editingUser) {
      // Update user role
      if (!selectedRole) return;

      const { error: deleteError } = await supabase.from('user_roles').delete().eq('user_id', editingUser.id);
      if (deleteError) {
        toast({ title: "Error updating user role", description: deleteError.message, variant: "destructive" });
        return;
      }

      const { error: insertError } = await supabase.from('user_roles').insert({ user_id: editingUser.id, role_id: selectedRole });
      if (insertError) {
        toast({ title: "Error updating user role", description: insertError.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "User role updated." });
        fetchUsers();
        setIsDialogOpen(false);
      }
    } else {
      // Create new user
      if (!email || !password || !selectedRole) {
        toast({ title: "Error", description: "All fields are required.", variant: "destructive" });
        return;
      }
      const { data: newUser, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        toast({ title: "Error creating user", description: error.message, variant: "destructive" });
      } else if (newUser.user) {
        const { error: roleError } = await supabase.from('user_roles').insert({ user_id: newUser.user.id, role_id: selectedRole });
        if (roleError) {
          toast({ title: "Error assigning role", description: roleError.message, variant: "destructive" });
        } else {
          toast({ title: "Success", description: "User created." });
          fetchUsers();
          setIsDialogOpen(false);
        }
      }
    }
  };

  const deleteUser = async (userId: string) => {
    const { error } = await supabase.rpc('delete_user', { user_id_to_delete: userId });
    if (error) {
      toast({ title: "Error deleting user", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "User deleted." });
      fetchUsers();
    }
  };

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <p className="text-muted-foreground">Manage users and their roles.</p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild><Button onClick={() => openDialog()}><Plus className="h-4 w-4 mr-2" />Add User</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle></DialogHeader>
            <div className="py-4 space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!editingUser} />
              {!editingUser && (
                <>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </>
              )}
              <Label htmlFor="role">Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (
                    <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveUser}>{editingUser ? "Update Role" : "Create User"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader><CardTitle>User Management</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p>Loading...</p> : (
            <div className="space-y-2">
              {users.map(user => (
                <div key={user.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">{user.username}</span>
                    <span className="text-sm text-muted-foreground">{user.role_name.slice(0, 1).toUpperCase() + user.role_name.slice(1)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openDialog(user)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteUser(user.id)} disabled={user.role_name === 'admin'}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;
