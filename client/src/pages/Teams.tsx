import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Settings,
  UserPlus,
  MoreVertical,
  Shield,
  Eye,
  Edit,
  Trash2,
  Mail,
  Activity,
  Crown,
  Building2,
  Copy,
  ExternalLink,
  Sparkles,
} from "lucide-react";

export default function Teams() {

  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: "", description: "", primaryColor: "#3B82F6" });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");

  // Queries
  const { data: teams, isLoading: teamsLoading, refetch: refetchTeams } = trpc.teams.getUserTeams.useQuery();
  const { data: teamDetails } = trpc.teams.get.useQuery(
    { teamId: selectedTeam! },
    { enabled: !!selectedTeam }
  );
  const { data: members } = trpc.teams.getMembers.useQuery(
    { teamId: selectedTeam! },
    { enabled: !!selectedTeam }
  );
  const { data: invitations } = trpc.teams.getInvitations.useQuery(
    { teamId: selectedTeam! },
    { enabled: !!selectedTeam }
  );
  const { data: activity } = trpc.teams.getActivity.useQuery(
    { teamId: selectedTeam!, limit: 20 },
    { enabled: !!selectedTeam }
  );
  const { data: stats } = trpc.teams.getStats.useQuery(
    { teamId: selectedTeam! },
    { enabled: !!selectedTeam }
  );
  const { data: insights, isLoading: insightsLoading } = trpc.teams.getInsights.useQuery(
    { teamId: selectedTeam! },
    { enabled: !!selectedTeam }
  );

  // Mutations
  const createTeam = trpc.teams.create.useMutation({
    onSuccess: () => {
      toast.success("Team created successfully");
      setShowCreateDialog(false);
      setNewTeam({ name: "", description: "", primaryColor: "#3B82F6" });
      refetchTeams();
    },
    onError: (error) => {
      toast.error("Failed to create team", { description: error.message });
    },
  });

  const inviteMember = trpc.teams.createInvitation.useMutation({
    onSuccess: (data) => {
      toast.success("Invitation sent", { description: `Invitation token: ${(data as any).token?.slice(0, 8)}...` });
      setShowInviteDialog(false);
      setInviteEmail("");
    },
    onError: (error) => {
      toast.error("Failed to send invitation", { description: error.message });
    },
  });

  const updateMemberRole = trpc.teams.updateMemberRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update role", { description: error.message });
    },
  });

  const removeMember = trpc.teams.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Member removed successfully");
    },
    onError: (error) => {
      toast.error("Failed to remove member", { description: error.message });
    },
  });

  const cancelInvitation = trpc.teams.cancelInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation cancelled");
    },
  });

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "outline"; icon: React.ReactNode }> = {
      owner: { variant: "default", icon: <Crown className="h-3 w-3 mr-1" /> },
      admin: { variant: "secondary", icon: <Shield className="h-3 w-3 mr-1" /> },
      member: { variant: "outline", icon: <Users className="h-3 w-3 mr-1" /> },
      viewer: { variant: "outline", icon: <Eye className="h-3 w-3 mr-1" /> },
    };
    const config = variants[role] || variants.member;
    return (
      <Badge variant={config.variant} className="flex items-center">
        {config.icon}
        {role}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      invited: "secondary",
      suspended: "destructive",
      pending: "secondary",
      accepted: "default",
      declined: "outline",
      expired: "destructive",
      cancelled: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
            <p className="text-muted-foreground">
              Manage your teams and collaborate with others
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Team</DialogTitle>
                <DialogDescription>
                  Create a team to collaborate with others and share resources.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Team Name</Label>
                  <Input
                    id="name"
                    value={newTeam.name}
                    onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                    placeholder="My Team"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newTeam.description}
                    onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                    placeholder="What is this team for?"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color"
                      type="color"
                      value={newTeam.primaryColor}
                      onChange={(e) => setNewTeam({ ...newTeam, primaryColor: e.target.value })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={newTeam.primaryColor}
                      onChange={(e) => setNewTeam({ ...newTeam, primaryColor: e.target.value })}
                      placeholder="#3B82F6"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createTeam.mutate(newTeam)}
                  disabled={!newTeam.name || createTeam.isPending}
                >
                  {createTeam.isPending ? "Creating..." : "Create Team"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Teams List */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Your Teams</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {teamsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : teams?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No teams yet</p>
                ) : (
                  teams?.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeam(team.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                        selectedTeam === team.id
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold"
                        style={{ backgroundColor: team.primaryColor || "#3B82F6" }}
                      >
                        {team.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{team.name}</p>
                        <p className="text-xs text-muted-foreground">{team.role}</p>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Team Details */}
          <div className="lg:col-span-3">
            {!selectedTeam ? (
              <Card className="h-96 flex items-center justify-center">
                <div className="text-center">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Select a Team</h3>
                  <p className="text-muted-foreground">
                    Choose a team from the list or create a new one
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Team Header */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-2xl font-bold"
                          style={{ backgroundColor: teamDetails?.primaryColor || "#3B82F6" }}
                        >
                          {teamDetails?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold">{teamDetails?.name}</h2>
                          <p className="text-muted-foreground">{teamDetails?.description || "No description"}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">{teamDetails?.plan}</Badge>
                            <Badge variant="secondary">
                              {stats?.memberCount || 0}/{teamDetails?.maxMembers} members
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                          <DialogTrigger asChild>
                            <Button>
                              <UserPlus className="h-4 w-4 mr-2" />
                              Invite
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Invite Team Member</DialogTitle>
                              <DialogDescription>
                                Send an invitation to join this team.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                  id="email"
                                  type="email"
                                  value={inviteEmail}
                                  onChange={(e) => setInviteEmail(e.target.value)}
                                  placeholder="colleague@example.com"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="role">Role</Label>
                                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="member">Member</SelectItem>
                                    <SelectItem value="viewer">Viewer</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                                Cancel
                              </Button>
                              <Button
                                onClick={() => inviteMember.mutate({
                                  teamId: selectedTeam,
                                  email: inviteEmail,
                                  role: inviteRole,
                                })}
                                disabled={!inviteEmail || inviteMember.isPending}
                              >
                                {inviteMember.isPending ? "Sending..." : "Send Invitation"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button variant="outline" size="icon">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-500" />
                        <span className="text-2xl font-bold">{stats?.memberCount || 0}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Members</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <Mail className="h-5 w-5 text-yellow-500" />
                        <span className="text-2xl font-bold">{stats?.pendingInvitations || 0}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Pending Invitations</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-green-500" />
                        <span className="text-2xl font-bold">{stats?.resourceCount || 0}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Resources</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-purple-500" />
                        <span className="text-2xl font-bold">{activity?.length || 0}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Recent Activities</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="members">
                  <TabsList>
                    <TabsTrigger value="members">Members</TabsTrigger>
                    <TabsTrigger value="invitations">Invitations</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                    <TabsTrigger value="insights">AI Insights</TabsTrigger>
                  </TabsList>

                  <TabsContent value="members" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Team Members</CardTitle>
                        <CardDescription>Manage your team members and their roles</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Member</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Joined</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {members?.map((member) => (
                              <TableRow key={member.id}>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                      <Users className="h-4 w-4" />
                                    </div>
                                    <span>User #{member.userId}</span>
                                  </div>
                                </TableCell>
                                <TableCell>{getRoleBadge(member.role)}</TableCell>
                                <TableCell>{getStatusBadge(member.status)}</TableCell>
                                <TableCell>
                                  {member.acceptedAt
                                    ? new Date(member.acceptedAt).toLocaleDateString()
                                    : "-"}
                                </TableCell>
                                <TableCell className="text-right">
                                  {member.role !== "owner" && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          onClick={() =>
                                            updateMemberRole.mutate({
                                              teamId: selectedTeam,
                                              userId: member.userId,
                                              role: "admin",
                                            })
                                          }
                                        >
                                          <Shield className="h-4 w-4 mr-2" />
                                          Make Admin
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            updateMemberRole.mutate({
                                              teamId: selectedTeam,
                                              userId: member.userId,
                                              role: "member",
                                            })
                                          }
                                        >
                                          <Users className="h-4 w-4 mr-2" />
                                          Make Member
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            updateMemberRole.mutate({
                                              teamId: selectedTeam,
                                              userId: member.userId,
                                              role: "viewer",
                                            })
                                          }
                                        >
                                          <Eye className="h-4 w-4 mr-2" />
                                          Make Viewer
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={() =>
                                            removeMember.mutate({
                                              teamId: selectedTeam,
                                              userId: member.userId,
                                            })
                                          }
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Remove
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="invitations" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Pending Invitations</CardTitle>
                        <CardDescription>Manage pending team invitations</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {invitations?.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">
                            No pending invitations
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Expires</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {invitations?.map((invitation) => (
                                <TableRow key={invitation.id}>
                                  <TableCell>{invitation.email}</TableCell>
                                  <TableCell>{getRoleBadge(invitation.role)}</TableCell>
                                  <TableCell>{getStatusBadge(invitation.status)}</TableCell>
                                  <TableCell>
                                    {new Date(invitation.expiresAt).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {invitation.status === "pending" && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          cancelInvitation.mutate({
                                            teamId: selectedTeam,
                                            invitationId: invitation.id,
                                          })
                                        }
                                      >
                                        Cancel
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="activity" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                        <CardDescription>Team activity timeline</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {activity?.map((item) => (
                            <div key={item.id} className="flex items-start gap-4 pb-4 border-b last:border-0">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                <Activity className="h-4 w-4" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm">{item.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(item.createdAt).toLocaleString()}
                                </p>
                              </div>
                              <Badge variant="outline">{item.activityType}</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="insights" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-yellow-500" />
                          AI Team Insights
                        </CardTitle>
                        <CardDescription>
                          AI-powered analysis of your team's health and activity
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {insightsLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                          </div>
                        ) : insights ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <pre className="whitespace-pre-wrap bg-muted p-4 rounded-lg text-sm">
                              {typeof insights.analysis === 'string' ? insights.analysis : JSON.stringify(insights.analysis, null, 2)}
                            </pre>
                            <p className="text-xs text-muted-foreground mt-4">
                              Generated at: {new Date(insights.generatedAt).toLocaleString()}
                            </p>
                          </div>
                        ) : (
                          <p className="text-center text-muted-foreground py-8">
                            Unable to generate insights
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
