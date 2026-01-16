import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import * as teamsService from "../services/teams";
import { createAuditLog } from "../services/auditLog";

export const teamsRouter = router({
  // Create a new team
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        slug: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        parentTeamId: z.number().optional(),
        logoUrl: z.string().url().optional(),
        primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        maxMembers: z.number().min(1).max(1000).optional(),
        maxApplications: z.number().min(1).max(100).optional(),
        maxClusters: z.number().min(1).max(50).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const team = await teamsService.createTeam({
        ...input,
        ownerId: ctx.user.id,
      });

      await createAuditLog(
        {
          userId: ctx.user.id,
          userEmail: ctx.user.email || undefined,
          userName: ctx.user.name || undefined,
        },
        {
          action: "team_create",
          resourceType: "team",
          resourceId: String(team.id),
          resourceName: input.name,
          description: `Created team "${input.name}"`,
          newState: input as Record<string, unknown>,
        }
      );

      return team;
    }),

  // Get team by ID
  get: protectedProcedure
    .input(z.object({ teamId: z.number() }))
    .query(async ({ input }) => {
      return teamsService.getTeam(input.teamId);
    }),

  // Get team by slug
  getBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      return teamsService.getTeamBySlug(input.slug);
    }),

  // Get user's teams
  getUserTeams: protectedProcedure.query(async ({ ctx }) => {
    return teamsService.getUserTeams(ctx.user.id);
  }),

  // Update team
  update: protectedProcedure
    .input(
      z.object({
        teamId: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        logoUrl: z.string().url().optional(),
        primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        maxMembers: z.number().min(1).max(1000).optional(),
        maxApplications: z.number().min(1).max(100).optional(),
        maxClusters: z.number().min(1).max(50).optional(),
        billingEmail: z.string().email().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { teamId, ...data } = input;

      // Check if user is owner or admin
      const role = await teamsService.getUserTeamRole(teamId, ctx.user.id);
      if (role !== "owner" && role !== "admin") {
        throw new Error("Insufficient permissions");
      }

      const previousTeam = await teamsService.getTeam(teamId);
      const team = await teamsService.updateTeam(teamId, data);

      await createAuditLog(
        {
          userId: ctx.user.id,
          userEmail: ctx.user.email || undefined,
          userName: ctx.user.name || undefined,
          teamId,
        },
        {
          action: "team_update",
          resourceType: "team",
          resourceId: String(teamId),
          resourceName: team?.name,
          description: `Updated team settings`,
          previousState: previousTeam as Record<string, unknown>,
          newState: team as Record<string, unknown>,
        }
      );

      return team;
    }),

  // Delete team
  delete: protectedProcedure
    .input(z.object({ teamId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Check if user is owner
      const role = await teamsService.getUserTeamRole(input.teamId, ctx.user.id);
      if (role !== "owner") {
        throw new Error("Only team owner can delete the team");
      }

      const team = await teamsService.getTeam(input.teamId);
      await teamsService.deleteTeam(input.teamId);

      await createAuditLog(
        {
          userId: ctx.user.id,
          userEmail: ctx.user.email || undefined,
          userName: ctx.user.name || undefined,
        },
        {
          action: "team_delete",
          resourceType: "team",
          resourceId: String(input.teamId),
          resourceName: team?.name,
          description: `Deleted team "${team?.name}"`,
        }
      );

      return { success: true };
    }),

  // Get team members
  getMembers: protectedProcedure
    .input(z.object({ teamId: z.number() }))
    .query(async ({ ctx, input }) => {
      // Check if user is a member
      const role = await teamsService.getUserTeamRole(input.teamId, ctx.user.id);
      if (!role) {
        throw new Error("Not a team member");
      }

      return teamsService.getTeamMembers(input.teamId);
    }),

  // Add team member
  addMember: protectedProcedure
    .input(
      z.object({
        teamId: z.number(),
        userId: z.number(),
        role: z.enum(["admin", "member", "viewer"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is owner or admin
      const role = await teamsService.getUserTeamRole(input.teamId, ctx.user.id);
      if (role !== "owner" && role !== "admin") {
        throw new Error("Insufficient permissions");
      }

      const member = await teamsService.addTeamMember({
        teamId: input.teamId,
        userId: input.userId,
        role: input.role,
        invitedBy: ctx.user.id,
      });

      await createAuditLog(
        {
          userId: ctx.user.id,
          userEmail: ctx.user.email || undefined,
          userName: ctx.user.name || undefined,
          teamId: input.teamId,
        },
        {
          action: "member_invite",
          resourceType: "team_member",
          resourceId: String(input.userId),
          description: `Added user ${input.userId} to team with role ${input.role || "member"}`,
          newState: { userId: input.userId, role: input.role || "member" },
        }
      );

      return member;
    }),

  // Update member role
  updateMemberRole: protectedProcedure
    .input(
      z.object({
        teamId: z.number(),
        userId: z.number(),
        role: z.enum(["admin", "member", "viewer"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is owner or admin
      const currentRole = await teamsService.getUserTeamRole(input.teamId, ctx.user.id);
      if (currentRole !== "owner" && currentRole !== "admin") {
        throw new Error("Insufficient permissions");
      }

      const previousRole = await teamsService.getUserTeamRole(input.teamId, input.userId);
      await teamsService.updateTeamMemberRole(input.teamId, input.userId, input.role);

      await createAuditLog(
        {
          userId: ctx.user.id,
          userEmail: ctx.user.email || undefined,
          userName: ctx.user.name || undefined,
          teamId: input.teamId,
        },
        {
          action: "member_role_change",
          resourceType: "team_member",
          resourceId: String(input.userId),
          description: `Changed user ${input.userId} role from ${previousRole} to ${input.role}`,
          previousState: { role: previousRole },
          newState: { role: input.role },
        }
      );

      return { success: true };
    }),

  // Remove member
  removeMember: protectedProcedure
    .input(
      z.object({
        teamId: z.number(),
        userId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is owner or admin, or removing themselves
      const currentRole = await teamsService.getUserTeamRole(input.teamId, ctx.user.id);
      const isSelf = ctx.user.id === input.userId;

      if (!isSelf && currentRole !== "owner" && currentRole !== "admin") {
        throw new Error("Insufficient permissions");
      }

      await teamsService.removeTeamMember(input.teamId, input.userId);

      await createAuditLog(
        {
          userId: ctx.user.id,
          userEmail: ctx.user.email || undefined,
          userName: ctx.user.name || undefined,
          teamId: input.teamId,
        },
        {
          action: "member_remove",
          resourceType: "team_member",
          resourceId: String(input.userId),
          description: isSelf ? "Left the team" : `Removed user ${input.userId} from team`,
        }
      );

      return { success: true };
    }),

  // Create invitation
  createInvitation: protectedProcedure
    .input(
      z.object({
        teamId: z.number(),
        email: z.string().email(),
        role: z.enum(["admin", "member", "viewer"]).optional(),
        personalMessage: z.string().max(500).optional(),
        expiresInDays: z.number().min(1).max(30).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is owner or admin
      const role = await teamsService.getUserTeamRole(input.teamId, ctx.user.id);
      if (role !== "owner" && role !== "admin") {
        throw new Error("Insufficient permissions");
      }

      const invitation = await teamsService.createTeamInvitation({
        teamId: input.teamId,
        email: input.email,
        role: input.role,
        invitedBy: ctx.user.id,
        personalMessage: input.personalMessage,
        expiresInDays: input.expiresInDays,
      });

      await createAuditLog(
        {
          userId: ctx.user.id,
          userEmail: ctx.user.email || undefined,
          userName: ctx.user.name || undefined,
          teamId: input.teamId,
        },
        {
          action: "member_invite",
          resourceType: "team_invitation",
          resourceId: String(invitation.id),
          description: `Sent invitation to ${input.email}`,
          newState: { email: input.email, role: input.role || "member" },
        }
      );

      return invitation;
    }),

  // Get team invitations
  getInvitations: protectedProcedure
    .input(z.object({ teamId: z.number() }))
    .query(async ({ ctx, input }) => {
      // Check if user is owner or admin
      const role = await teamsService.getUserTeamRole(input.teamId, ctx.user.id);
      if (role !== "owner" && role !== "admin") {
        throw new Error("Insufficient permissions");
      }

      return teamsService.getTeamInvitations(input.teamId);
    }),

  // Accept invitation
  acceptInvitation: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await teamsService.acceptInvitation(input.token, ctx.user.id);

      await createAuditLog(
        {
          userId: ctx.user.id,
          userEmail: ctx.user.email || undefined,
          userName: ctx.user.name || undefined,
          teamId: invitation.teamId,
        },
        {
          action: "member_invite",
          resourceType: "team_invitation",
          resourceId: String(invitation.id),
          description: "Accepted team invitation",
        }
      );

      return { success: true, teamId: invitation.teamId };
    }),

  // Decline invitation
  declineInvitation: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      await teamsService.declineInvitation(input.token);
      return { success: true };
    }),

  // Cancel invitation
  cancelInvitation: protectedProcedure
    .input(
      z.object({
        teamId: z.number(),
        invitationId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is owner or admin
      const role = await teamsService.getUserTeamRole(input.teamId, ctx.user.id);
      if (role !== "owner" && role !== "admin") {
        throw new Error("Insufficient permissions");
      }

      await teamsService.cancelInvitation(input.invitationId);
      return { success: true };
    }),

  // Get team resources
  getResources: protectedProcedure
    .input(
      z.object({
        teamId: z.number(),
        resourceType: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Check if user is a member
      const role = await teamsService.getUserTeamRole(input.teamId, ctx.user.id);
      if (!role) {
        throw new Error("Not a team member");
      }

      return teamsService.getTeamResources(input.teamId, input.resourceType);
    }),

  // Add resource to team
  addResource: protectedProcedure
    .input(
      z.object({
        teamId: z.number(),
        resourceType: z.enum([
          "application",
          "cluster",
          "connection",
          "autoscaling_rule",
          "scheduled_scaling",
          "ab_test",
          "canary_deployment",
          "prometheus_config",
          "email_config",
        ]),
        resourceId: z.number(),
        accessLevel: z.enum(["full", "read_write", "read_only"]).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is owner or admin
      const role = await teamsService.getUserTeamRole(input.teamId, ctx.user.id);
      if (role !== "owner" && role !== "admin") {
        throw new Error("Insufficient permissions");
      }

      const resource = await teamsService.addTeamResource({
        teamId: input.teamId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        accessLevel: input.accessLevel,
        addedBy: ctx.user.id,
        notes: input.notes,
      });

      return resource;
    }),

  // Remove resource from team
  removeResource: protectedProcedure
    .input(
      z.object({
        teamId: z.number(),
        resourceType: z.string(),
        resourceId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is owner or admin
      const role = await teamsService.getUserTeamRole(input.teamId, ctx.user.id);
      if (role !== "owner" && role !== "admin") {
        throw new Error("Insufficient permissions");
      }

      await teamsService.removeTeamResource(input.teamId, input.resourceType, input.resourceId);
      return { success: true };
    }),

  // Get team activity
  getActivity: protectedProcedure
    .input(
      z.object({
        teamId: z.number(),
        limit: z.number().min(1).max(100).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Check if user is a member
      const role = await teamsService.getUserTeamRole(input.teamId, ctx.user.id);
      if (!role) {
        throw new Error("Not a team member");
      }

      return teamsService.getTeamActivity(input.teamId, input.limit);
    }),

  // Get team statistics
  getStats: protectedProcedure
    .input(z.object({ teamId: z.number() }))
    .query(async ({ ctx, input }) => {
      // Check if user is a member
      const role = await teamsService.getUserTeamRole(input.teamId, ctx.user.id);
      if (!role) {
        throw new Error("Not a team member");
      }

      return teamsService.getTeamStats(input.teamId);
    }),

  // Get AI-powered team insights
  getInsights: protectedProcedure
    .input(z.object({ teamId: z.number() }))
    .query(async ({ ctx, input }) => {
      // Check if user is owner or admin
      const role = await teamsService.getUserTeamRole(input.teamId, ctx.user.id);
      if (role !== "owner" && role !== "admin") {
        throw new Error("Insufficient permissions");
      }

      return teamsService.getTeamInsights(input.teamId);
    }),

  // Check resource access
  checkAccess: protectedProcedure
    .input(
      z.object({
        resourceType: z.string(),
        resourceId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      return teamsService.checkResourceAccess(ctx.user.id, input.resourceType, input.resourceId);
    }),
});
