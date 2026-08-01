import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@packages/security/decorators/current-user.decorator';
import { IdentityContext } from '@packages/security/interfaces/identity-context.interface';
import { CampaignService } from './campaign.service';
import { CampaignStatusActionDto } from './dto/campaign-status-action.dto';
import { CreateCampaignTeamAssignmentDto, UpdateCampaignTeamAssignmentDto } from './dto/campaign-team-assignment.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import {
  CancelPublishingScheduleDto,
  CreatePublishingScheduleDto,
  GeneratePublishingProductionDto,
  MarkPublishingSchedulePublishedDto,
  UpdatePublishingScheduleDto,
} from './dto/publishing-schedule.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@ApiTags('Campaigns')
@ApiBearerAuth()
@Controller({ path: 'campaigns', version: '1' })
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  @ApiOperation({ summary: 'Create a campaign planning contract with deliverables and publishing schedule drafts' })
  create(@Body() dto: CreateCampaignDto, @CurrentUser() user: IdentityContext) {
    return this.campaignService.create(dto, user.agencyId, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List campaigns for the active agency' })
  findMany(@CurrentUser() user: IdentityContext) {
    return this.campaignService.findMany(user.agencyId ?? '');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a campaign dashboard payload' })
  findById(@Param('id') id: string, @CurrentUser() user: IdentityContext) {
    return this.campaignService.findById(id, user.agencyId ?? '');
  }

  @Get(':id/team')
  @ApiOperation({ summary: 'Get structured campaign team assignments' })
  getTeam(@Param('id') id: string, @CurrentUser() user: IdentityContext) {
    return this.campaignService.getTeam(id, user.agencyId ?? '');
  }

  @Get(':id/activity')
  @ApiOperation({ summary: 'Get campaign activity timeline' })
  getActivity(@Param('id') id: string, @CurrentUser() user: IdentityContext) {
    return this.campaignService.getActivity(id, user.agencyId ?? '');
  }

  @Get(':id/publishing-schedules')
  @ApiOperation({ summary: 'Get campaign publishing agenda' })
  getPublishingSchedules(@Param('id') id: string, @CurrentUser() user: IdentityContext) {
    return this.campaignService.getPublishingSchedules(id, user);
  }

  @Post(':id/publishing-schedules')
  @ApiOperation({ summary: 'Create a publishing slot' })
  createPublishingSchedule(@Param('id') id: string, @Body() dto: CreatePublishingScheduleDto, @CurrentUser() user: IdentityContext) {
    return this.campaignService.createPublishingSchedule(id, dto, user);
  }

  @Patch(':id/publishing-schedules/:scheduleId')
  @ApiOperation({ summary: 'Update or reschedule a publishing slot' })
  updatePublishingSchedule(
    @Param('id') id: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdatePublishingScheduleDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.campaignService.updatePublishingSchedule(id, scheduleId, dto, user);
  }

  @Post(':id/publishing-schedules/:scheduleId/cancel')
  @ApiOperation({ summary: 'Cancel a publishing slot' })
  cancelPublishingSchedule(
    @Param('id') id: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: CancelPublishingScheduleDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.campaignService.cancelPublishingSchedule(id, scheduleId, dto, user);
  }

  @Post(':id/publishing-schedules/:scheduleId/mark-published')
  @ApiOperation({ summary: 'Mark a publishing slot as published' })
  markPublishingSchedulePublished(
    @Param('id') id: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: MarkPublishingSchedulePublishedDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.campaignService.markPublishingSchedulePublished(id, scheduleId, dto, user);
  }

  @Post(':id/publishing-schedules/:scheduleId/generate-production')
  @ApiOperation({ summary: 'Generate a content asset and first workflow task from a publishing slot' })
  generatePublishingProduction(
    @Param('id') id: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: GeneratePublishingProductionDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.campaignService.generatePublishingProduction(id, scheduleId, dto, user);
  }

  @Post(':id/team')
  @ApiOperation({ summary: 'Assign a member to a structured campaign responsibility' })
  assignTeamMember(@Param('id') id: string, @Body() dto: CreateCampaignTeamAssignmentDto, @CurrentUser() user: IdentityContext) {
    return this.campaignService.assignTeamMember(id, dto, user);
  }

  @Patch(':id/team/:assignmentId')
  @ApiOperation({ summary: 'Update a structured campaign team assignment' })
  updateTeamAssignment(
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: UpdateCampaignTeamAssignmentDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.campaignService.updateTeamAssignment(id, assignmentId, dto, user);
  }

  @Delete(':id/team/:assignmentId')
  @ApiOperation({ summary: 'Remove a structured campaign team assignment' })
  removeTeamAssignment(@Param('id') id: string, @Param('assignmentId') assignmentId: string, @CurrentUser() user: IdentityContext) {
    return this.campaignService.removeTeamAssignment(id, assignmentId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update the full campaign planning model' })
  update(@Param('id') id: string, @Body() dto: UpdateCampaignDto, @CurrentUser() user: IdentityContext) {
    return this.campaignService.update(id, dto, user.agencyId ?? '', user.userId);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive a campaign' })
  archive(@Param('id') id: string, @Body() dto: CampaignStatusActionDto, @CurrentUser() user: IdentityContext) {
    return this.campaignService.archive(id, dto, user);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a draft campaign' })
  activate(@Param('id') id: string, @Body() dto: CampaignStatusActionDto, @CurrentUser() user: IdentityContext) {
    return this.campaignService.activate(id, dto, user);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause an active campaign' })
  pause(@Param('id') id: string, @Body() dto: CampaignStatusActionDto, @CurrentUser() user: IdentityContext) {
    return this.campaignService.pause(id, dto, user);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a paused campaign' })
  resume(@Param('id') id: string, @Body() dto: CampaignStatusActionDto, @CurrentUser() user: IdentityContext) {
    return this.campaignService.resume(id, dto, user);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete an active campaign' })
  complete(@Param('id') id: string, @Body() dto: CampaignStatusActionDto, @CurrentUser() user: IdentityContext) {
    return this.campaignService.complete(id, dto, user);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore an archived campaign' })
  restore(@Param('id') id: string, @Body() dto: CampaignStatusActionDto, @CurrentUser() user: IdentityContext) {
    return this.campaignService.restore(id, dto, user);
  }
}
