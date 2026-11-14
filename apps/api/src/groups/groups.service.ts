import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from '../messaging/conversations.service';
import { GroupDto, GroupMemberDto } from '@la-chat/shared-types';
import { CreateGroupInput } from '@la-chat/validation';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService, private conversations: ConversationsService) {}

  async create(callerId: string, input: CreateGroupInput): Promise<GroupDto> {
    let autoMemberIds: string[] = [];
    if (input.type === 'CLASS' && input.classId) {
      const students = await this.prisma.studentProfile.findMany({ where: { classId: input.classId }, select: { userId: true } });
      const teachers = await this.prisma.teacherAssignment.findMany({ where: { classId: input.classId }, select: { teacherId: true } });
      autoMemberIds = [...students.map((s) => s.userId), ...teachers.map((t) => t.teacherId)];
    } else if (input.type === 'STREAM' && input.streamId) {
      const students = await this.prisma.studentProfile.findMany({ where: { streamId: input.streamId }, select: { userId: true } });
      autoMemberIds = students.map((s) => s.userId);
    } else if (input.type === 'SUBJECT' && input.subjectId) {
      const assignments = await this.prisma.teacherAssignment.findMany({ where: { subjectId: input.subjectId }, select: { teacherId: true, classId: true } });
      const teacherIds = Array.from(new Set(assignments.map((a) => a.teacherId)));
      const classIds = Array.from(new Set(assignments.map((a) => a.classId)));
      const students = await this.prisma.studentProfile.findMany({ where: { classId: { in: classIds } }, select: { userId: true } });
      autoMemberIds = [...teacherIds, ...students.map((s) => s.userId)];
    } else if (input.memberUserIds && input.memberUserIds.length > 0) {
      autoMemberIds = input.memberUserIds;
    }
    autoMemberIds = Array.from(new Set([callerId, ...autoMemberIds]));
    const group = await this.prisma.group.create({
      data: {
        type: input.type as any, name: input.name, description: input.description ?? null, createdBy: callerId,
        members: { create: autoMemberIds.map((userId) => ({ userId, role: userId === callerId ? 'ADMIN' : 'MEMBER', addedBy: callerId })) },
      },
      include: { members: { include: { user: { select: { fullName: true } } } } },
    });
    try {
      await this.conversations.createGroup(callerId, { name: input.name, participantIds: autoMemberIds, groupId: group.id });
    } catch { /* non-fatal */ }
    return this.toDto(group as any);
  }

  async list(callerId: string): Promise<GroupDto[]> {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId: callerId, removedAt: null },
      include: { group: { include: { members: { where: { removedAt: null }, include: { user: { select: { fullName: true } } } } } } },
    });
    return memberships.map((m) => this.toDto(m.group as any));
  }

  async getById(callerId: string, groupId: string): Promise<GroupDto> {
    const membership = await this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: callerId } } });
    if (!membership || membership.removedAt) throw new ForbiddenException('You are not a member of this group');
    const group = await this.prisma.group.findUnique({ where: { id: groupId }, include: { members: { where: { removedAt: null }, include: { user: { select: { fullName: true } } } } } });
    if (!group) throw new NotFoundException('Group not found');
    return this.toDto(group as any);
  }

  async addMember(callerId: string, groupId: string, userId: string, role: 'MEMBER' | 'ADMIN' = 'MEMBER'): Promise<void> {
    const callerMembership = await this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: callerId } } });
    if (!callerMembership || callerMembership.role !== 'ADMIN') throw new ForbiddenException('Only group admins can add members');
    await this.prisma.groupMember.upsert({ where: { groupId_userId: { groupId, userId } }, update: { removedAt: null, role, addedBy: callerId }, create: { groupId, userId, role, addedBy: callerId } });
  }

  async removeMember(callerId: string, groupId: string, userId: string): Promise<void> {
    const callerMembership = await this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: callerId } } });
    if (!callerMembership || callerMembership.role !== 'ADMIN') throw new ForbiddenException('Only group admins can remove members');
    await this.prisma.groupMember.update({ where: { groupId_userId: { groupId, userId } }, data: { removedAt: new Date() } });
  }

  private toDto(group: any): GroupDto {
    const members: GroupMemberDto[] = group.members.map((m: any) => ({ userId: m.userId, fullName: m.user.fullName, role: m.role, addedAt: m.addedAt.toISOString() }));
    return { id: group.id, type: group.type, name: group.name, description: group.description, conversationId: group.conversationId, createdBy: group.createdBy, createdAt: group.createdAt.toISOString(), memberCount: group.members.length, members };
  }
}
