import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AcademicService {
  constructor(private prisma: PrismaService) {}

  // Classes ---------------------------------------------------------------

  listClasses() {
    return this.prisma.class.findMany({ include: { streams: true }, orderBy: { level: 'asc' } });
  }

  async createClass(level: number, name: string) {
    return this.prisma.class.create({ data: { level, name } });
  }

  // Streams ---------------------------------------------------------------

  listStreams(classId?: string) {
    return this.prisma.stream.findMany({
      where: classId ? { classId } : undefined,
      include: { class: true },
      orderBy: [{ class: { level: 'asc' } }, { name: 'asc' }],
    });
  }

  async createStream(classId: string, name: string) {
    const klass = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!klass) throw new NotFoundException('Class not found');
    return this.prisma.stream.create({ data: { classId, name } });
  }

  // Subjects --------------------------------------------------------------

  listSubjects() {
    return this.prisma.subject.findMany({ orderBy: { name: 'asc' } });
  }

  async createSubject(name: string, code: string) {
    return this.prisma.subject.create({ data: { name, code } });
  }
}
