import { describe, expect, it } from 'vitest';
import { validateAdminSql } from './adminSql';

describe('validateAdminSql', () => {
  it('accepts a plain SELECT', () => {
    const result = validateAdminSql('SELECT * FROM players', false);
    expect(result).toMatchObject({ ok: true, isReadOnly: true, statement: 'SELECT * FROM players' });
  });

  it('accepts WITH ... SELECT', () => {
    expect(validateAdminSql('WITH x AS (SELECT 1) SELECT * FROM x', false).ok).toBe(true);
  });

  it('accepts EXPLAIN and SHOW', () => {
    expect(validateAdminSql('EXPLAIN SELECT 1', false).ok).toBe(true);
    expect(validateAdminSql('SHOW search_path', false).ok).toBe(true);
  });

  it('rejects empty and non-string input', () => {
    expect(validateAdminSql('', false).ok).toBe(false);
    expect(validateAdminSql('   ', false).ok).toBe(false);
    expect(validateAdminSql(null, false).ok).toBe(false);
    expect(validateAdminSql(42, false).ok).toBe(false);
  });

  it('rejects stacked statements', () => {
    const result = validateAdminSql('SELECT 1; DROP TABLE players', false);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/single statement/i);
  });

  it('allows a single trailing semicolon', () => {
    expect(validateAdminSql('SELECT 1;', false)).toMatchObject({ ok: true, statement: 'SELECT 1' });
  });

  it('rejects stacked statements hidden by block comments', () => {
    expect(validateAdminSql('SELECT 1 /* c */; DELETE FROM players', false).ok).toBe(false);
  });

  it('rejects data-modifying CTEs even when writes are allowed', () => {
    const result = validateAdminSql('WITH deleted AS (DELETE FROM players RETURNING *) SELECT * FROM deleted', true);
    expect(result.ok).toBe(false);
  });

  it('rejects SELECT ... INTO', () => {
    expect(validateAdminSql('SELECT * INTO players_backup FROM players', false).ok).toBe(false);
  });

  it('rejects unknown statement types', () => {
    expect(validateAdminSql('DO $$ BEGIN END $$', true).ok).toBe(false);
    expect(validateAdminSql('VACUUM', true).ok).toBe(false);
  });

  it('rejects destructive statements even when writes are enabled', () => {
    for (const sql of [
      'DROP DATABASE postgres',
      'DROP SCHEMA public CASCADE',
      'TRUNCATE players',
      'ALTER ROLE postgres WITH SUPERUSER',
      'GRANT ALL ON players TO public',
      'COPY players TO PROGRAM \'curl evil\'',
      'SELECT pg_read_file(\'/etc/passwd\')',
    ]) {
      expect(validateAdminSql(sql, true).ok, sql).toBe(false);
    }
  });

  it('rejects destructive keywords hidden inside comments', () => {
    expect(validateAdminSql('SELECT 1 -- DROP DATABASE x', false).ok).toBe(true);
  });

  it('requires writes to be explicitly enabled', () => {
    expect(validateAdminSql('UPDATE players SET tier = 1', false)).toMatchObject({ ok: false });
    expect(validateAdminSql('UPDATE players SET tier = 1', true)).toMatchObject({ ok: true, isReadOnly: false });
    expect(validateAdminSql('DELETE FROM players WHERE id = \'x\'', true)).toMatchObject({ ok: true, isReadOnly: false });
  });

  it('is case insensitive', () => {
    expect(validateAdminSql('select 1', false).ok).toBe(true);
    expect(validateAdminSql('drop database x', true).ok).toBe(false);
  });
});
