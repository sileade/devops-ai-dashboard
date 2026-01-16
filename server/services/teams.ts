import { getDb } from "../db";
import {
  teams,
  teamMembers,
  teamInvitations,
  teamResources,
  teamActivity,
  InsertTeam,
  InsertTeamMember,
  InsertTeamInvitation,
  InsertTeamResource,
  InsertTeamActivity,
} from "../../drizzle/schema";
import { eq, and, desc, sql, or, like, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";
import { invokeLLM } from "../_core/llm";

// ============================================
// TEAM MANAGEMENT
// ============================================

export async function createTeam(data: {
  name: string;
  slug?: string;
  description?: string;
  ownerId: number;
  parentTeamId?: number;
  settings?: Record<string, unknown>;
  logoUrl?: string;
  primaryColor?: string;
  maxMembers?: number;
  maxApplications?: number;
  maxClusters?: number;
  plan?: "free" | "starter" | "professional" | "enterprise";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Generate slug from name if not provided
  const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Check if slug is unique
  const existing = await db.select().from(teams).where(eq(teams.slug, slug)).limit(1);
  if (existing.length > 0) {
    throw new Error("Team slug already exists");
  }

  const [team] = await db.insert(teams).values({
    name: data.name,
    slug,
    description: data.description,
    ownerId: data.ownerId,
    parentTeamId: data.parentTeamId,
    settings: data.settings,
    logoUrl: data.logoUrl,
    primaryColor: data.primaryColor || "#3B82F6",
    maxMembers: data.maxMembers || 10,
    maxApplications: data.maxApplications || 5,
    maxClusters: data.maxClusters || 3,
    plan: data.plan || "free",
  }).$returningId();

  // Add owner as team member
  await db.insert(teamMembers).values({
    teamId: team.id,
    userId: data.ownerId,
    role: "owner",
    status: "active",
    acceptedAt: new Date(),
  });

  // Log activity
  await logTeamActivity({
    teamId: team.id,
    userId: data.ownerId,
    activityType: "team_created",
    description: `Team "${data.name}" was created`,
    metadata: { teamName: data.name, slug },
  });

  return team;
}

export async function getTeam(teamId: number) {
  const db = await getDb();
  if (!db) return null;

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  return team || null;
}

export async function getTeamBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;

  const [team] = await db.select().from(teams).where(eq(teams.slug, slug)).limit(1);
  return team || null;
}

export async function getUserTeams(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const memberships = await db
    .select({
      team: teams,
      membership: teamMembers,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(and(eq(teamMembers.userId, userId), eq(teamMembers.status, "active")))
    .orderBy(desc(teams.createdAt));

  return memberships.map((m) => ({
    ...m.team,
    role: m.membership.role,
    membershipId: m.membership.id,
  }));
}

export async function updateTeam(
  teamId: number,
  data: Partial<{
    name: string;
    description: string;
    settings: Record<string, unknown>;
    logoUrl: string;
    primaryColor: string;
    maxMembers: number;
    maxApplications: number;
    maxClusters: number;
    plan: "free" | "starter" | "professional" | "enterprise";
    billingEmail: string;
    isActive: boolean;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(teams).set(data).where(eq(teams.id, teamId));

  return getTeam(teamId);
}

export async function deleteTeam(teamId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete all related data
  await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId));
  await db.delete(teamInvitations).where(eq(teamInvitations.teamId, teamId));
  await db.delete(teamResources).where(eq(teamResources.teamId, teamId));
  await db.delete(teamActivity).where(eq(teamActivity.teamId, teamId));
  await db.delete(teams).where(eq(teams.id, teamId));
}

// ============================================
// TEAM MEMBERS
// ============================================

export async function getTeamMembers(teamId: number) {
  const db = await getDb();
  if (!db) return [];

  const members = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(desc(teamMembers.createdAt));

  return members;
}

export async function addTeamMember(data: {
  teamId: number;
  userId: number;
  role?: "owner" | "admin" | "member" | "viewer";
  invitedBy?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if already a member
  const existing = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, data.teamId), eq(teamMembers.userId, data.userId)))
    .limit(1);

  if (existing.length > 0) {
    throw new Error("User is already a team member");
  }

  // Check team member limit
  const team = await getTeam(data.teamId);
  if (team) {
    const memberCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, data.teamId));

    if (memberCount[0].count >= (team.maxMembers || 10)) {
      throw new Error("Team member limit reached");
    }
  }

  const [member] = await db.insert(teamMembers).values({
    teamId: data.teamId,
    userId: data.userId,
    role: data.role || "member",
    status: "active",
    invitedBy: data.invitedBy,
    invitedAt: data.invitedBy ? new Date() : undefined,
    acceptedAt: new Date(),
  }).$returningId();

  // Log activity
  await logTeamActivity({
    teamId: data.teamId,
    userId: data.userId,
    activityType: "member_joined",
    description: `User joined the team`,
    metadata: { role: data.role || "member" },
  });

  return member;
}

export async function updateTeamMemberRole(
  teamId: number,
  userId: number,
  newRole: "admin" | "member" | "viewer"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get current role
  const [current] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);

  if (!current) {
    throw new Error("Member not found");
  }

  if (current.role === "owner") {
    throw new Error("Cannot change owner role");
  }

  await db
    .update(teamMembers)
    .set({ role: newRole })
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

  // Log activity
  await logTeamActivity({
    teamId,
    userId,
    activityType: "member_role_changed",
    description: `Member role changed from ${current.role} to ${newRole}`,
    metadata: { previousRole: current.role, newRole },
  });
}

export async function removeTeamMember(teamId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if owner
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);

  if (member?.role === "owner") {
    throw new Error("Cannot remove team owner");
  }

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

  // Log activity
  await logTeamActivity({
    teamId,
    userId,
    activityType: "member_left",
    description: `Member left the team`,
  });
}

export async function getUserTeamRole(teamId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;

  const [member] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);

  return member?.role || null;
}

// ============================================
// TEAM INVITATIONS
// ============================================

export async function createTeamInvitation(data: {
  teamId: number;
  email: string;
  role?: "admin" | "member" | "viewer";
  invitedBy: number;
  personalMessage?: string;
  expiresInDays?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check for existing pending invitation
  const existing = await db
    .select()
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.teamId, data.teamId),
        eq(teamInvitations.email, data.email),
        eq(teamInvitations.status, "pending")
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error("Invitation already pending for this email");
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (data.expiresInDays || 7));

  const [invitation] = await db.insert(teamInvitations).values({
    teamId: data.teamId,
    email: data.email,
    role: data.role || "member",
    token,
    invitedBy: data.invitedBy,
    personalMessage: data.personalMessage,
    expiresAt,
  }).$returningId();

  return { ...invitation, token };
}

export async function getTeamInvitations(teamId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.teamId, teamId))
    .orderBy(desc(teamInvitations.createdAt));
}

export async function acceptInvitation(token: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [invitation] = await db
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.token, token))
    .limit(1);

  if (!invitation) {
    throw new Error("Invitation not found");
  }

  if (invitation.status !== "pending") {
    throw new Error("Invitation is no longer valid");
  }

  if (new Date() > invitation.expiresAt) {
    await db
      .update(teamInvitations)
      .set({ status: "expired" })
      .where(eq(teamInvitations.id, invitation.id));
    throw new Error("Invitation has expired");
  }

  // Add user to team
  await addTeamMember({
    teamId: invitation.teamId,
    userId,
    role: invitation.role,
    invitedBy: invitation.invitedBy,
  });

  // Update invitation status
  await db
    .update(teamInvitations)
    .set({ status: "accepted", respondedAt: new Date() })
    .where(eq(teamInvitations.id, invitation.id));

  return invitation;
}

export async function declineInvitation(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(teamInvitations)
    .set({ status: "declined", respondedAt: new Date() })
    .where(eq(teamInvitations.token, token));
}

export async function cancelInvitation(invitationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(teamInvitations)
    .set({ status: "cancelled" })
    .where(eq(teamInvitations.id, invitationId));
}

// ============================================
// TEAM RESOURCES
// ============================================

export async function addTeamResource(data: {
  teamId: number;
  resourceType: "application" | "cluster" | "connection" | "autoscaling_rule" | "scheduled_scaling" | "ab_test" | "canary_deployment" | "prometheus_config" | "email_config";
  resourceId: number;
  accessLevel?: "full" | "read_write" | "read_only";
  addedBy: number;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [resource] = await db.insert(teamResources).values({
    teamId: data.teamId,
    resourceType: data.resourceType,
    resourceId: data.resourceId,
    accessLevel: data.accessLevel || "full",
    addedBy: data.addedBy,
    notes: data.notes,
  }).$returningId();

  // Log activity
  await logTeamActivity({
    teamId: data.teamId,
    userId: data.addedBy,
    activityType: "resource_added",
    description: `Added ${data.resourceType} resource`,
    metadata: { resourceType: data.resourceType, resourceId: data.resourceId },
  });

  return resource;
}

export async function getTeamResources(teamId: number, resourceType?: string) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(teamResources).where(eq(teamResources.teamId, teamId));

  if (resourceType) {
    query = db
      .select()
      .from(teamResources)
      .where(
        and(
          eq(teamResources.teamId, teamId),
          eq(teamResources.resourceType, resourceType as any)
        )
      );
  }

  return query.orderBy(desc(teamResources.createdAt));
}

export async function removeTeamResource(teamId: number, resourceType: string, resourceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(teamResources)
    .where(
      and(
        eq(teamResources.teamId, teamId),
        eq(teamResources.resourceType, resourceType as any),
        eq(teamResources.resourceId, resourceId)
      )
    );
}

export async function checkResourceAccess(
  userId: number,
  resourceType: string,
  resourceId: number
): Promise<{ hasAccess: boolean; accessLevel: string | null; teamId: number | null }> {
  const db = await getDb();
  if (!db) return { hasAccess: false, accessLevel: null, teamId: null };

  // Get user's teams
  const userTeams = await getUserTeams(userId);
  const teamIds = userTeams.map((t) => t.id);

  if (teamIds.length === 0) {
    return { hasAccess: false, accessLevel: null, teamId: null };
  }

  // Check if resource belongs to any of user's teams
  const [resource] = await db
    .select()
    .from(teamResources)
    .where(
      and(
        inArray(teamResources.teamId, teamIds),
        eq(teamResources.resourceType, resourceType as any),
        eq(teamResources.resourceId, resourceId)
      )
    )
    .limit(1);

  if (!resource) {
    return { hasAccess: false, accessLevel: null, teamId: null };
  }

  // Check user's role in the team
  const userRole = await getUserTeamRole(resource.teamId, userId);
  
  // Owners and admins have full access regardless of resource access level
  if (userRole === "owner" || userRole === "admin") {
    return { hasAccess: true, accessLevel: "full", teamId: resource.teamId };
  }

  return { hasAccess: true, accessLevel: resource.accessLevel, teamId: resource.teamId };
}

// ============================================
// TEAM ACTIVITY
// ============================================

export async function logTeamActivity(data: {
  teamId: number;
  userId?: number;
  activityType: "member_joined" | "member_left" | "member_role_changed" | "resource_added" | "resource_removed" | "settings_changed" | "team_created" | "team_updated";
  description: string;
  metadata?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) return;

  await db.insert(teamActivity).values({
    teamId: data.teamId,
    userId: data.userId,
    activityType: data.activityType,
    description: data.description,
    metadata: data.metadata,
  });
}

export async function getTeamActivity(teamId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(teamActivity)
    .where(eq(teamActivity.teamId, teamId))
    .orderBy(desc(teamActivity.createdAt))
    .limit(limit);
}

// ============================================
// TEAM STATISTICS
// ============================================

export async function getTeamStats(teamId: number) {
  const db = await getDb();
  if (!db) return null;

  const [memberCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.status, "active")));

  const [resourceCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(teamResources)
    .where(eq(teamResources.teamId, teamId));

  const [pendingInvitations] = await db
    .select({ count: sql<number>`count(*)` })
    .from(teamInvitations)
    .where(and(eq(teamInvitations.teamId, teamId), eq(teamInvitations.status, "pending")));

  const recentActivity = await getTeamActivity(teamId, 10);

  return {
    memberCount: memberCount.count,
    resourceCount: resourceCount.count,
    pendingInvitations: pendingInvitations.count,
    recentActivity,
  };
}

// ============================================
// AI-POWERED TEAM INSIGHTS
// ============================================

export async function getTeamInsights(teamId: number) {
  const db = await getDb();
  if (!db) return null;

  const team = await getTeam(teamId);
  if (!team) return null;

  const stats = await getTeamStats(teamId);
  const activity = await getTeamActivity(teamId, 100);

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a team management AI assistant. Analyze team data and provide insights about team health, activity patterns, and recommendations.`,
        },
        {
          role: "user",
          content: `Analyze this team data and provide insights:

Team: ${team.name}
Plan: ${team.plan}
Members: ${stats?.memberCount || 0}/${team.maxMembers}
Resources: ${stats?.resourceCount || 0}
Pending Invitations: ${stats?.pendingInvitations || 0}

Recent Activity (last 100 events):
${activity.map((a) => `- ${a.activityType}: ${a.description}`).join("\n")}

Provide:
1. Team health score (0-100)
2. Activity level assessment
3. Key observations
4. Recommendations for improvement`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content || "";
    return {
      analysis: content,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to generate team insights:", error);
    return null;
  }
}
