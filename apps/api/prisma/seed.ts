/**
 * LA Chat — seed script.
 *
 * IMPORTANT: This file uses ONLY synthetic data. No real student information
 * is ever used. The admission numbers follow the pattern S[1-6][E|W]-NNNN
 * which is reserved for synthetic seed data and rejected by a CI check if
 * it ever appears in a non-seed file.
 *
 * Run with: pnpm --filter @la-chat/api prisma:seed
 */
import { PrismaClient, RoleName, AccountStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const log = (msg: string) => console.log(`[seed] ${msg}`);

async function main() {
  log('Seeding roles + permissions (handled by RolesService at API boot, but we upsert here too for safety)…');

  // Roles
  const roleByName: Record<RoleName, string> = {} as any;
  for (const name of Object.values(RoleName)) {
    const r = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, description: `Role: ${name}` },
    });
    roleByName[name] = r.id;
  }
  log(`  ✓ ${Object.keys(roleByName).length} roles`);

  // Classes (S1–S6) + streams (East, West)
  const classes: { id: string; level: number; name: string }[] = [];
  for (let level = 1; level <= 6; level++) {
    const c = await prisma.class.upsert({
      where: { level_name: { level, name: `Senior ${level}` } },
      update: {},
      create: { level, name: `Senior ${level}` },
    });
    classes.push(c);
    for (const streamName of ['East', 'West']) {
      await prisma.stream.upsert({
        where: { classId_name: { classId: c.id, name: streamName } },
        update: {},
        create: { classId: c.id, name: streamName },
      });
    }
  }
  log(`  ✓ ${classes.length} classes × 2 streams`);

  // Subjects
  const subjects = [
    ['Mathematics', 'MATH'],
    ['English', 'ENG'],
    ['Biology', 'BIO'],
    ['Chemistry', 'CHEM'],
    ['Physics', 'PHY'],
    ['Geography', 'GEO'],
    ['History', 'HIST'],
    ['Computer Science', 'CS'],
  ];
  for (const [name, code] of subjects) {
    await prisma.subject.upsert({
      where: { code },
      update: {},
      create: { name, code },
    });
  }
  log(`  ✓ ${subjects.length} subjects`);

  // ---- Users ---------------------------------------------------------------

  // ICT Administrator
  const ictHash = await argon2.hash('Password1');
  const ict = await prisma.user.upsert({
    where: { email: 'ict.admin@la-chat.local' },
    update: {},
    create: {
      fullName: 'ICT Administrator (seed)',
      email: 'ict.admin@la-chat.local',
      phone: '+256700000001',
      passwordHash: ictHash,
      status: AccountStatus.ACTIVE,
      roles: { create: [{ roleId: roleByName[RoleName.ICT_ADMINISTRATOR] }] },
      staffProfile: { create: { staffNo: 'ICT-0001', department: 'ICT' } },
    },
  });
  log(`  ✓ ICT admin user: ${ict.email} / Password1`);

  // School Administrator
  const schAdmin = await prisma.user.upsert({
    where: { email: 'school.admin@la-chat.local' },
    update: {},
    create: {
      fullName: 'School Administrator (seed)',
      email: 'school.admin@la-chat.local',
      phone: '+256700000002',
      passwordHash: ictHash,
      status: AccountStatus.ACTIVE,
      roles: { create: [{ roleId: roleByName[RoleName.SCHOOL_ADMINISTRATOR] }] },
      staffProfile: { create: { staffNo: 'ADM-0001', department: 'Office' } },
    },
  });
  log(`  ✓ School admin user: ${schAdmin.email} / Password1`);

  // Headteacher
  const head = await prisma.user.upsert({
    where: { email: 'headteacher@la-chat.local' },
    update: {},
    create: {
      fullName: 'Headteacher (seed)',
      email: 'headteacher@la-chat.local',
      phone: '+256700000003',
      passwordHash: ictHash,
      status: AccountStatus.ACTIVE,
      roles: { create: [{ roleId: roleByName[RoleName.HEADTEACHER] }] },
      staffProfile: { create: { staffNo: 'HEAD-0001', department: 'Administration' } },
    },
  });
  log(`  ✓ Headteacher user: ${head.email} / Password1`);

  // Two teachers
  const teachers: { id: string; email: string }[] = [];
  for (const [i, subjectCode] of ['MATH', 'ENG'].entries()) {
    const t = await prisma.user.upsert({
      where: { email: `teacher${i + 1}@la-chat.local` },
      update: {},
      create: {
        fullName: `Teacher ${i + 1} (seed)`,
        email: `teacher${i + 1}@la-chat.local`,
        phone: `+2567000000${10 + i}`,
        passwordHash: ictHash,
        status: AccountStatus.ACTIVE,
        roles: { create: [{ roleId: roleByName[RoleName.TEACHER] }] },
        staffProfile: { create: { staffNo: `T-000${i + 1}`, department: subjectCode === 'MATH' ? 'Mathematics' : 'Languages' } },
      },
    });
    teachers.push({ id: t.id, email: t.email });

    // Assign teacher to S1 + S2 for this subject (class-wide, no stream)
    const subject = await prisma.subject.findUnique({ where: { code: subjectCode } });
    if (subject) {
      for (const c of classes.slice(0, 2)) {
        // Delete any existing assignment for this teacher+subject+class+year+null stream, then create.
        await prisma.teacherAssignment.deleteMany({
          where: { teacherId: t.id, subjectId: subject.id, classId: c.id, streamId: null, academicYear: '2026' },
        }).catch(() => null);
        await prisma.teacherAssignment.create({
          data: {
            teacherId: t.id,
            subjectId: subject.id,
            classId: c.id,
            streamId: null,
            academicYear: '2026',
          },
        }).catch((e) => console.warn(`[seed] teacher assignment skipped: ${(e as Error).message}`));
      }
    }
  }
  log(`  ✓ ${teachers.length} teachers`);

  // Four students — 2 in S1 East, 2 in S1 West
  const s1 = classes[0];
  const s1Streams = await prisma.stream.findMany({ where: { classId: s1.id } });
  const studentRows: { id: string; admissionNo: string; fullName: string; email: string; guardianEmail: string }[] = [];
  let stuIdx = 0;
  for (const stream of s1Streams) {
    for (let i = 1; i <= 2; i++) {
      stuIdx++;
      const admissionNo = `S1${stream.name[0]}-${String(stuIdx).padStart(4, '0')}`;
      const email = `student.${admissionNo.toLowerCase()}@la-chat.local`;
      const stu = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          fullName: `Student ${admissionNo} (seed)`,
          email,
          phone: `+2567000001${stuIdx}`,
          passwordHash: ictHash,
          status: AccountStatus.ACTIVE,
          roles: { create: [{ roleId: roleByName[RoleName.STUDENT] }] },
          studentProfile: {
            create: {
              admissionNo,
              classId: s1.id,
              streamId: stream.id,
            },
          },
        },
      });
      studentRows.push({
        id: stu.id,
        admissionNo,
        fullName: stu.fullName,
        email,
        guardianEmail: `parent.${admissionNo.toLowerCase()}@la-chat.local`,
      });
    }
  }
  log(`  ✓ ${studentRows.length} students`);

  // One parent linked to the first student
  if (studentRows[0]) {
    const parent = await prisma.user.upsert({
      where: { email: studentRows[0].guardianEmail },
      update: {},
      create: {
        fullName: `Parent of ${studentRows[0].admissionNo} (seed)`,
        email: studentRows[0].guardianEmail,
        phone: '+256700000201',
        passwordHash: ictHash,
        status: AccountStatus.ACTIVE,
        roles: { create: [{ roleId: roleByName[RoleName.PARENT_GUARDIAN] }] },
        parentProfile: {
          create: {
            childId: studentRows[0].id,
            relationship: 'Parent',
          },
        },
      },
    });
    log(`  ✓ parent: ${parent.email} (linked to ${studentRows[0].admissionNo})`);
  }

  log('Seed complete.');
  log('─────────────────────────────────────────────────────────────');
  log('Test login credentials (all use password: Password1):');
  log('  ICT Administrator: ict.admin@la-chat.local');
  log('  School Admin:      school.admin@la-chat.local');
  log('  Headteacher:       headteacher@la-chat.local');
  log('  Teacher 1:         teacher1@la-chat.local');
  log('  Student:           student.s1e-0001@la-chat.local');
  log('─────────────────────────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('[seed] failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
