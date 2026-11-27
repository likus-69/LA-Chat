import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AccountStatus, RoleName } from '@la-chat/shared-types';

// =============================================================================
// Standalone CSV parser — exported so it can be unit-tested without a DB.
// Handles quoted fields, escaped quotes (""), commas inside quotes, and CRLF.
// =============================================================================

/**
 * Parse CSV text into a 2D array of string cells.
 *
 * - Quoted fields may contain commas, newlines, or escaped (`""`) quotes.
 * - Both `\n` and `\r\n` line endings are accepted.
 * - Empty lines (containing only whitespace) are dropped.
 * - A trailing newline is not required; the final field is flushed.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r' && next === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
      } else if (char === '\n' || char === '\r') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

// =============================================================================
// Types
// =============================================================================

/** Column order is fixed by the import/export template. */
const CSV_COLUMNS = [
  'type',
  'identifier',
  'fullName',
  'email',
  'phone',
  'role',
  'className',
  'streamName',
  'department',
  'password',
] as const;

export interface ImportError {
  row: number;
  message: string;
}

export interface GeneratedPassword {
  identifier: string;
  password: string;
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: ImportError[];
  generatedPasswords: GeneratedPassword[];
}

// =============================================================================
// Service
// =============================================================================

/**
 * CsvImportService
 *
 * Bulk user import / export for school administrators. Students and staff are
 * distinguished by the `type` column. Each row is created in its own
 * transaction so a single bad row never aborts the whole batch.
 */
@Injectable()
export class CsvImportService {
  private readonly logger = new Logger('CsvImport');

  constructor(private prisma: PrismaService) {}

  // --------------------------------------------------------------------------
  // Import
  // --------------------------------------------------------------------------

  /**
   * Parse, validate and bulk-create users from CSV text.
   * Returns counts, per-row errors and any generated temporary passwords
   * (for rows where the CSV left the password column blank — the
   * administrator must hand those to the account holder out-of-band).
   */
  async importUsers(csvText: string, actorId: string): Promise<ImportResult> {
    const rows = parseCsv(csvText);
    if (rows.length === 0) {
      return { created: 0, skipped: 0, errors: [], generatedPasswords: [] };
    }

    const header = rows[0].map((h) => h.trim());
    const colIndex = this.buildColumnIndex(header);
    if (colIndex === null) {
      return {
        created: 0,
        skipped: 0,
        errors: [{ row: 1, message: `Missing required columns. Expected: ${CSV_COLUMNS.join(', ')}` }],
        generatedPasswords: [],
      };
    }

    const errors: ImportError[] = [];
    const generatedPasswords: GeneratedPassword[] = [];
    let created = 0;
    let skipped = 0;

    // Cache classes/streams and roles for the duration of the import so we
    // don't hammer the DB on every row.
    const classCache = new Map<string, { id: string; level: number }>();
    const streamCache = new Map<string, { id: string; classId: string }>();
    const roleCache = new Map<string, string>();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1; // 1-indexed in the CSV file (header is row 1)

      try {
        const cells = CSV_COLUMNS.map((_, idx) => (colIndex[idx] < row.length ? row[colIndex[idx]] ?? '' : ''));
        const result = await this.importRow(cells, actorId, classCache, streamCache, roleCache);
        if (result.created) {
          created++;
          if (result.generatedPassword) {
            generatedPasswords.push({
              identifier: result.identifier,
              password: result.generatedPassword,
            });
          }
        } else if (result.skipped) {
          skipped++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ row: rowNum, message });
        this.logger.warn(`Row ${rowNum} failed: ${message}`);
      }
    }

    return { created, skipped, errors, generatedPasswords };
  }

  /** Map header names to column positions, validating that all required columns exist. */
  private buildColumnIndex(header: string[]): number[] | null {
    const lookup = new Map(header.map((h, i) => [h.toLowerCase(), i] as const));
    const indexes: number[] = [];
    for (const col of CSV_COLUMNS) {
      const idx = lookup.get(col.toLowerCase());
      if (idx === undefined) return null;
      indexes.push(idx);
    }
    return indexes;
  }

  /**
   * Import a single row. All writes happen inside one `$transaction` so a
   * failure rolls back this row's partial writes without touching the others.
   */
  private async importRow(
    cells: string[],
    actorId: string,
    classCache: Map<string, { id: string; level: number }>,
    streamCache: Map<string, { id: string; classId: string }>,
    roleCache: Map<string, string>,
  ): Promise<{ created: boolean; skipped: boolean; generatedPassword?: string; identifier: string }> {
    const [typeRaw, identifierRaw, fullNameRaw, emailRaw, phoneRaw, roleRaw, classNameRaw, streamNameRaw, departmentRaw, passwordRaw] =
      cells.map((c) => c.trim());

    const type = typeRaw.toLowerCase();
    const identifier = identifierRaw;
    const fullName = fullNameRaw;
    const email = emailRaw || null;
    const phone = phoneRaw || null;
    const role = roleRaw || null;
    const className = classNameRaw || null;
    const streamName = streamNameRaw || null;
    const department = departmentRaw || null;

    if (type !== 'student' && type !== 'staff') {
      throw new Error(`Unknown type "${typeRaw}" — must be "student" or "staff"`);
    }
    if (!identifier) {
      throw new Error('identifier is required');
    }
    if (!fullName) {
      throw new Error('fullName is required');
    }

    if (type === 'student') {
      return this.importStudent({
        identifier,
        fullName,
        email,
        phone,
        className,
        streamName,
        passwordRaw,
        actorId,
        classCache,
        streamCache,
      });
    }

    return this.importStaff({
      identifier,
      fullName,
      email,
      phone,
      role,
      department,
      passwordRaw,
      actorId,
      roleCache,
    });
  }

  private async importStudent(args: {
    identifier: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    className: string | null;
    streamName: string | null;
    passwordRaw: string;
    actorId: string;
    classCache: Map<string, { id: string; level: number }>;
    streamCache: Map<string, { id: string; classId: string }>;
  }): Promise<{ created: boolean; skipped: boolean; generatedPassword?: string; identifier: string }> {
    const { identifier, fullName, email, phone, className, streamName, passwordRaw, actorId, classCache, streamCache } = args;

    if (!className) throw new Error('className is required for students');
    if (!streamName) throw new Error('streamName is required for students');

    // Duplicate check by admission number, email, or phone — skip if exists.
    const existingByAdmissionNo = await this.prisma.studentProfile.findUnique({
      where: { admissionNo: identifier },
    });
    if (existingByAdmissionNo) {
      return { created: false, skipped: true, identifier };
    }
    if (email) {
      const dup = await this.prisma.user.findUnique({ where: { email } });
      if (dup) return { created: false, skipped: true, identifier };
    }
    if (phone) {
      const dup = await this.prisma.user.findUnique({ where: { phone } });
      if (dup) return { created: false, skipped: true, identifier };
    }

    // Look up class + stream (cached).
    const classRow = await this.lookupClass(className, classCache);
    if (!classRow) throw new Error(`Class "${className}" not found`);
    const streamRow = await this.lookupStream(streamName, classRow.id, streamCache);
    if (!streamRow) throw new Error(`Stream "${streamName}" not found for class "${className}"`);

    const { password, generated } = this.resolvePassword(passwordRaw);
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName,
          email,
          phone,
          passwordHash,
          status: AccountStatus.PENDING,
          roles: {
            create: [
              {
                role: { connect: { name: RoleName.STUDENT } },
                grantedBy: actorId,
              },
            ],
          },
          studentProfile: {
            create: {
              admissionNo: identifier,
              classId: classRow.id,
              streamId: streamRow.id,
            },
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'user.import_csv.student',
          targetType: 'user',
          targetId: user.id,
        },
      });
    });

    return { created: true, skipped: false, generatedPassword: generated ? password : undefined, identifier };
  }

  private async importStaff(args: {
    identifier: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    role: string | null;
    department: string | null;
    passwordRaw: string;
    actorId: string;
    roleCache: Map<string, string>;
  }): Promise<{ created: boolean; skipped: boolean; generatedPassword?: string; identifier: string }> {
    const { identifier, fullName, email, phone, role, department, passwordRaw, actorId, roleCache } = args;

    if (!role) throw new Error('role is required for staff');
    if (!this.isValidRoleName(role)) {
      throw new Error(`Invalid role "${role}" — must be one of ${Object.values(RoleName).join(', ')}`);
    }

    // Duplicate check by staff number, email, or phone.
    const existingByStaffNo = await this.prisma.staffProfile.findUnique({
      where: { staffNo: identifier },
    });
    if (existingByStaffNo) {
      return { created: false, skipped: true, identifier };
    }
    if (email) {
      const dup = await this.prisma.user.findUnique({ where: { email } });
      if (dup) return { created: false, skipped: true, identifier };
    }
    if (phone) {
      const dup = await this.prisma.user.findUnique({ where: { phone } });
      if (dup) return { created: false, skipped: true, identifier };
    }

    const roleId = await this.lookupRoleId(role, roleCache);

    const { password, generated } = this.resolvePassword(passwordRaw);
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName,
          email,
          phone,
          passwordHash,
          status: AccountStatus.PENDING,
          roles: {
            create: [
              {
                roleId,
                grantedBy: actorId,
              },
            ],
          },
          staffProfile: {
            create: {
              staffNo: identifier,
              department,
            },
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'user.import_csv.staff',
          targetType: 'user',
          targetId: user.id,
        },
      });
    });

    return { created: true, skipped: false, generatedPassword: generated ? password : undefined, identifier };
  }

  // --------------------------------------------------------------------------
  // Export
  // --------------------------------------------------------------------------

  /**
   * Query users and serialise them as CSV text. The format matches the import
   * template so the file can be round-tripped: edit in a spreadsheet, then
   * re-import. Filterable by role or status.
   */
  async exportUsersCsv(opts: { role?: string; status?: string }): Promise<string> {
    const where = {
      deletedAt: null,
      ...(opts.status ? { status: opts.status as AccountStatus } : {}),
      ...(opts.role ? { roles: { some: { role: { name: opts.role as RoleName } } } } : {}),
    };

    const users = await this.prisma.user.findMany({
      where,
      include: {
        roles: { include: { role: true } },
        studentProfile: { include: { class: true, stream: true } },
        staffProfile: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const lines: string[] = [CSV_COLUMNS.join(',')];
    for (const u of users) {
      const isStudent = !!u.studentProfile;
      const type = isStudent ? 'student' : 'staff';
      const identifier = isStudent ? u.studentProfile!.admissionNo : u.staffProfile?.staffNo ?? '';
      const role = isStudent
        ? ''
        : (u.roles.find((ur) => ur.role.name !== RoleName.STUDENT)?.role.name ?? u.roles[0]?.role.name ?? '');
      const className = isStudent ? u.studentProfile!.class?.name ?? '' : '';
      const streamName = isStudent ? u.studentProfile!.stream?.name ?? '' : '';
      const department = isStudent ? '' : u.staffProfile?.department ?? '';

      const fields = [
        type,
        identifier,
        u.fullName,
        u.email ?? '',
        u.phone ?? '',
        role,
        className,
        streamName,
        department,
        // never export password hashes — leave blank
        '',
      ];
      lines.push(fields.map(csvEscape).join(','));
    }
    return lines.join('\n') + '\n';
  }

  // --------------------------------------------------------------------------
  // Template
  // --------------------------------------------------------------------------

  /**
   * Returns a CSV template with the header row and two example rows (one
   * student, one staff) so an administrator can copy the structure and fill
   * in real data.
   */
  getTemplateCsv(): string {
    const header = CSV_COLUMNS.join(',');
    const student = [
      'student',
      'S1E-0001',
      'John Doe',
      'john@la-chat.local',
      '+256700000001',
      '',
      'Senior One',
      'East',
      '',
      'Password1',
    ]
      .map(csvEscape)
      .join(',');
    const staff = [
      'staff',
      'T-0001',
      'Jane Smith',
      'jane@la-chat.local',
      '+256700000002',
      'TEACHER',
      '',
      '',
      'Mathematics',
      'Password1',
    ]
      .map(csvEscape)
      .join(',');
    return `${header}\n${student}\n${staff}\n`;
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  /** Returns the password to hash plus a flag if it was generated. */
  private resolvePassword(raw: string): { password: string; generated: boolean } {
    if (raw && raw.trim() !== '') {
      return { password: raw, generated: false };
    }
    // 12 base64url chars + "1A!" → meets policy (length ≥ 8, has upper, lower, digit).
    const generated = randomBytes(10).toString('base64url').slice(0, 12) + '1A!';
    return { password: generated, generated: true };
  }

  private isValidRoleName(value: string): boolean {
    return Object.values(RoleName).includes(value as RoleName);
  }

  private async lookupClass(
    name: string,
    cache: Map<string, { id: string; level: number }>,
  ): Promise<{ id: string; level: number } | null> {
    const key = name.toLowerCase();
    if (cache.has(key)) return cache.get(key)!;
    const found = await this.prisma.class.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true, level: true },
    });
    if (found) cache.set(key, found);
    return found ?? null;
  }

  private async lookupStream(
    name: string,
    classId: string,
    cache: Map<string, { id: string; classId: string }>,
  ): Promise<{ id: string; classId: string } | null> {
    const key = `${classId}:${name.toLowerCase()}`;
    if (cache.has(key)) return cache.get(key)!;
    const found = await this.prisma.stream.findFirst({
      where: { classId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true, classId: true },
    });
    if (found) cache.set(key, found);
    return found ?? null;
  }

  private async lookupRoleId(roleName: string, cache: Map<string, string>): Promise<string> {
    if (cache.has(roleName)) return cache.get(roleName)!;
    const role = await this.prisma.role.findUnique({ where: { name: roleName as RoleName } });
    if (!role) throw new Error(`Role "${roleName}" not found in the database`);
    cache.set(roleName, role.id);
    return role.id;
  }
}

/**
 * Escape a single CSV field. Wraps the value in double quotes if it contains
 * a comma, quote, newline, or carriage return; embedded quotes are doubled.
 */
function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
