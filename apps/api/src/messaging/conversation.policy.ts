import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleName } from '@la-chat/shared-types';

/**
 * Conversation policy for LA Chat.
 *
 * Rules (mirror of documentation/security/permissions-matrix.md §policy):
 *   1. Student → Student private chat is OFF by default.
 *   2. Teacher → Student requires an active teacher_assignments row for that
 *      teacher in the student's class (or one of the student's subjects).
 *   3. Parent → Teacher is allowed only if the teacher teaches the parent's
 *      child.
 *   4. Staff ↔ Staff is always allowed.
 *   5. Headteacher ↔ anyone is always allowed (formal channels).
 *   6. Any user can message themselves? No — that's a no-op.
 *
 * These rules are enforced server-side, never on the client.
 */
@Injectable()
export class ConversationPolicy {
  constructor(private prisma: PrismaService) {}

  /**
   * Throws ForbiddenException if `initiator` may not start a private
   * conversation with `target`.
   */
  async assertCanStartPrivate(initiatorId: string, targetId: string): Promise<void> {
    if (initiatorId === targetId) {
      throw new ForbiddenException('Cannot start a conversation with yourself');
    }

    const [initiator, target] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: initiatorId },
        include: { roles: { include: { role: true } } },
      }),
      this.prisma.user.findUnique({
        where: { id: targetId },
        include: { roles: { include: { role: true } } },
      }),
    ]);

    if (!initiator || !target) {
      throw new ForbiddenException('User not found');
    }
    if (initiator.status !== 'ACTIVE' || target.status !== 'ACTIVE') {
      throw new ForbiddenException('One or both accounts are not active');
    }

    const initRoles = new Set(initiator.roles.map((r) => r.role.name));
    const targetRoles = new Set(target.roles.map((r) => r.role.name));

    // Headteacher can message anyone (formal channels)
    if (initRoles.has(RoleName.HEADTEACHER)) return;

    // Both staff (non-student, non-parent) → always allowed
    const initIsStaff = !initRoles.has(RoleName.STUDENT) && !initRoles.has(RoleName.PARENT_GUARDIAN);
    const targetIsStaff = !targetRoles.has(RoleName.STUDENT) && !targetRoles.has(RoleName.PARENT_GUARDIAN);
    if (initIsStaff && targetIsStaff) return;

    // Teacher/ClassTeacher → Student: must have a teacher_assignment in the student's class
    const initIsTeacher =
      initRoles.has(RoleName.TEACHER) || initRoles.has(RoleName.CLASS_TEACHER);
    if (initIsTeacher && targetRoles.has(RoleName.STUDENT)) {
      const ok = await this.teacherAssignedToStudent(initiatorId, targetId);
      if (!ok) {
        throw new ForbiddenException(
          'You can only message students in classes you are assigned to teach',
        );
      }
      return;
    }

    // Student → Teacher/ClassTeacher: same rule, reversed
    if (initRoles.has(RoleName.STUDENT) && (targetRoles.has(RoleName.TEACHER) || targetRoles.has(RoleName.CLASS_TEACHER))) {
      const ok = await this.teacherAssignedToStudent(targetId, initiatorId);
      if (!ok) {
        throw new ForbiddenException(
          'You can only message teachers assigned to your class',
        );
      }
      return;
    }

    // Parent → Teacher: teacher must teach the parent's child
    if (initRoles.has(RoleName.PARENT_GUARDIAN) && (targetRoles.has(RoleName.TEACHER) || targetRoles.has(RoleName.CLASS_TEACHER))) {
      const ok = await this.teacherAssignedToParentsChild(initiatorId, targetId);
      if (!ok) {
        throw new ForbiddenException(
          'You can only message teachers who teach your child',
        );
      }
      return;
    }

    // Student → Student: off by default
    if (initRoles.has(RoleName.STUDENT) && targetRoles.has(RoleName.STUDENT)) {
      throw new ForbiddenException(
        'Student-to-student private chat is disabled. Use your class group instead.',
      );
    }

    // Default: deny
    throw new ForbiddenException(
      'You do not have permission to start this conversation',
    );
  }

  /**
   * Throws if `user` is not a participant in `conversationId`.
   */
  async assertIsParticipant(userId: string, conversationId: string): Promise<void> {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    });
    if (!participant || participant.leftAt) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async teacherAssignedToStudent(teacherId: string, studentId: string): Promise<boolean> {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: studentId },
    });
    if (!student) return false;

    const assignment = await this.prisma.teacherAssignment.findFirst({
      where: {
        teacherId,
        classId: student.classId,
        // either class-wide (streamId null) or stream-specific
        OR: [
          { streamId: null },
          { streamId: student.streamId },
        ],
      },
    });
    return assignment !== null;
  }

  private async teacherAssignedToParentsChild(parentId: string, teacherId: string): Promise<boolean> {
    const parent = await this.prisma.parentProfile.findUnique({
      where: { userId: parentId },
    });
    if (!parent) return false;

    // parent.childId is a StudentProfile.userId
    return this.teacherAssignedToStudent(teacherId, parent.childId);
  }
}
