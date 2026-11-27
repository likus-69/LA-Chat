import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../../src/users/csv-import.service';

describe('parseCsv', () => {
  it('parses a simple CSV', () => {
    const rows = parseCsv('a,b,c\n1,2,3');
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], ['a', 'b', 'c']);
    assert.deepEqual(rows[1], ['1', '2', '3']);
  });

  it('handles quoted fields with commas', () => {
    const rows = parseCsv('"hello, world","foo"');
    assert.deepEqual(rows[0], ['hello, world', 'foo']);
  });

  it('handles escaped quotes', () => {
    const rows = parseCsv('"say ""hello"""');
    assert.deepEqual(rows[0], ['say "hello"']);
  });

  it('handles CRLF line endings', () => {
    const rows = parseCsv('a,b\r\nc,d');
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[1], ['c', 'd']);
  });

  it('handles empty lines', () => {
    const rows = parseCsv('a,b\n\nc,d\n');
    assert.equal(rows.length, 2);
  });

  it('handles fields with newlines inside quotes', () => {
    const rows = parseCsv('"line1\nline2",x');
    assert.equal(rows.length, 1);
    assert.equal(rows[0][0], 'line1\nline2');
  });

  it('handles the LA Chat import template format', () => {
    const csv =
      'type,identifier,fullName,email,phone,role,className,streamName,department,password\n' +
      'student,S1E-0001,John Doe,john@la-chat.local,+256700000001,,Senior One,East,,Password1';
    const rows = parseCsv(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[0][0], 'type');
    assert.equal(rows[1][0], 'student');
    assert.equal(rows[1][1], 'S1E-0001');
    assert.equal(rows[1][2], 'John Doe');
  });

  it('handles a trailing newline without producing an empty trailing row', () => {
    const rows = parseCsv('a,b\n1,2\n');
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[1], ['1', '2']);
  });

  it('handles lone carriage returns as line separators', () => {
    const rows = parseCsv('a,b\rc,d');
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[1], ['c', 'd']);
  });

  it('handles quoted field that contains both a comma and a newline', () => {
    const rows = parseCsv('"multi,\nline",x,y');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].length, 3);
    assert.equal(rows[0][0], 'multi,\nline');
    assert.equal(rows[0][1], 'x');
    assert.equal(rows[0][2], 'y');
  });

  it('handles an empty quoted field', () => {
    const rows = parseCsv('"",x');
    assert.deepEqual(rows[0], ['', 'x']);
  });

  it('returns an empty array for an empty string', () => {
    assert.deepEqual(parseCsv(''), []);
  });

  it('returns an empty array for whitespace-only input', () => {
    assert.deepEqual(parseCsv('   \n  \n'), []);
  });

  it('parses both the student and staff example rows from the template', () => {
    const csv =
      'type,identifier,fullName,email,phone,role,className,streamName,department,password\n' +
      'student,S1E-0001,John Doe,john@la-chat.local,+256700000001,,Senior One,East,,Password1\n' +
      'staff,T-0001,Jane Smith,jane@la-chat.local,+256700000002,TEACHER,,,Mathematics,Password1\n';
    const rows = parseCsv(csv);
    assert.equal(rows.length, 3);
    assert.equal(rows[1][0], 'student');
    assert.equal(rows[1][5], '');         // role blank for students
    assert.equal(rows[1][6], 'Senior One'); // className
    assert.equal(rows[1][7], 'East');       // streamName
    assert.equal(rows[1][8], '');           // department blank
    assert.equal(rows[1][9], 'Password1'); // password
    assert.equal(rows[2][0], 'staff');
    assert.equal(rows[2][5], 'TEACHER');
    assert.equal(rows[2][6], '');           // className blank
    assert.equal(rows[2][7], '');           // streamName blank
    assert.equal(rows[2][8], 'Mathematics'); // department
    assert.equal(rows[2][9], 'Password1');
  });

  it('handles a quoted fullName containing a comma (e.g. "Doe, John")', () => {
    const csv = 'type,identifier,fullName,email\nstudent,S1E-0002,"Doe, John",john2@la-chat.local';
    const rows = parseCsv(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[1][2], 'Doe, John');
    assert.equal(rows[1][3], 'john2@la-chat.local');
  });
});
