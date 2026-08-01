import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus, Patch, Delete, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationService } from '../services/organization.service';
import { CreateAgencyDto } from '../dto/create-agency.dto';
import { InviteMemberDto } from '../dto/invite-member.dto';
import { UpdateMemberRoleDto } from '../dto/update-member-role.dto';
import { CurrentUser } from '@packages/security/decorators/current-user.decorator';
import { IdentityContext } from '@packages/security/interfaces/identity-context.interface';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller({ path: 'organizations', version: '1' })
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post('agencies')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new agency and become its Owner' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Agency successfully created' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  async createAgency(
    @Body() dto: CreateAgencyDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.organizationService.createAgency(dto, user.authUserId, user.sessionId);
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get current user's active agency and all memberships" })
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns active agency and list of memberships' })
  async getMyMemberships(@CurrentUser() user: IdentityContext) {
    return this.organizationService.getMyMemberships(user.authUserId, user.sessionId);
  }

  @Post(':agencyId/invitations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a member to an agency' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Invitation successfully sent' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Not a member of the agency' })
  async inviteMember(
    @Param('agencyId') agencyId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.organizationService.inviteMember(agencyId, dto, user.authUserId);
  }

  @Get(':agencyId/members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all members for an agency' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of agency memberships' })
  async getAgencyMembers(@Param('agencyId') agencyId: string) {
    return this.organizationService.getMembers(agencyId);
  }

  @Post(':agencyId/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate an agency for the current session' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Agency activated for current session' })
  async activateAgency(
    @Param('agencyId') agencyId: string,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.organizationService.activateAgency(agencyId, user);
  }

  @Patch(':agencyId/members/:membershipId/role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change agency member roles' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Member roles changed' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Optimistic lock failed or last owner protection triggered' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Only owners and managers can change roles' })
  async updateMemberRole(
    @Param('agencyId') agencyId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.organizationService.updateMemberRole(agencyId, membershipId, dto, user);
  }

  @Delete(':agencyId/members/:membershipId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove an agency member' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Member removed' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Optimistic lock failed, self-removal, or last owner protection triggered' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Only owners can remove members' })
  async removeMember(
    @Param('agencyId') agencyId: string,
    @Param('membershipId') membershipId: string,
    @Query('version', ParseIntPipe) version: number,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.organizationService.removeMember(agencyId, membershipId, version, user);
  }

  @Post('invitations/:token/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an agency invitation' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Invitation accepted and membership created' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid or expired invitation token' })
  async acceptInvitation(
    @Param('token') token: string,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.organizationService.acceptInvitation(token, user.authUserId);
  }

  @Get('roles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get available roles for the agency' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of roles' })
  async getRoles(@CurrentUser() user: IdentityContext) {
    if (!user.agencyId) {
      return []; // Return empty if no active agency context
    }
    return this.organizationService.getRoles(user.agencyId);
  }

  @Get('members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all members for the active agency' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of memberships' })
  async getMembers(@CurrentUser() user: IdentityContext) {
    if (!user.agencyId) {
      return []; // Return empty if no active agency context
    }
    return this.organizationService.getMembers(user.agencyId);
  }
}
