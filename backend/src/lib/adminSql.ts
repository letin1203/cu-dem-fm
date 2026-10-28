/**
 * Guards for the admin SQL console.
 *
 * The console runs raw SQL, so validation must never rely on a keyword
 * blacklist alone. A statement is accepted only when it is a single, clearly
 * read-only statement whose leading keyword is allowlisted. Anything else —
 * data-modifying CTEs, `SELECT ... INTO`, `DO` blocks, function calls that
 * have side effects — is rejected unless writes are explicitly enabled.
 */

const READ_ONLY_KEYWORDS = ['SELECT', 'WITH', 'EXPLAIN', 'SHOW', 'VALUES'] as const;

const DESTRUCTIVE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'DROP DATABASE', pattern: /\bDROP\s+DATABASE\b/i },
  { label: 'DROP SCHEMA', pattern: /\bDROP\s+SCHEMA\b/i },
  { label: 'TRUNCATE', pattern: /\bTRUNCATE\b/i },
  { label: 'ALTER ROLE', pattern: /\bALTER\s+ROLE\b/i },
  { label: 'ALTER USER', pattern: /\bALTER\s+USER\b/i },
  { label: 'CREATE ROLE', pattern: /\bCREATE\s+ROLE\b/i },
  { label: 'CREATE USER', pattern: /\bCREATE\s+USER\b/i },
  { label: 'GRANT', pattern: /\bGRANT\b/i },
  { label: 'REVOKE', pattern: /\bREVOKE\b/i },
  { label: 'COPY', pattern: /\bCOPY\b/i },
  { label: 'pg_read_file', pattern: /\bPG_READ_FILE\b/i },
  { label: 'pg_read_binary_file', pattern: /\bPG_READ_BINARY_FILE\b/i },
  { label: 'pg_ls_dir', pattern: /\bPG_LS_DIR\b/i },
  { label: 'lo_import', pattern: /\bLO_IMPORT\b/i },
  { label: 'dblink', pattern: /\bDBLINK\b/i },
];

const WRITE_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP'] as const;

export interface SqlGuardResult {
  ok: boolean;
  error?: string;
  /** Normalized single statement, without comments or a trailing semicolon. */
  statement?: string;
  isReadOnly?: boolean;
}

const stripComments = (sql: string): string =>
  sql
    // Line comments and block comments are removed so a keyword cannot hide
    // inside a comment and so `SELECT /*x*/ 1;` is still detected as stacked.
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');

const leadingKeyword = (statement: string): string => {
  const match = statement.trim().match(/^([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : '';
};

/** `WITH` can prefix a data-modifying statement, so inspect its body. */
const isReadOnlyWith = (statement: string): boolean =>
  !/\b(INSERT|UPDATE|DELETE|MERGE)\b/i.test(statement.slice(statement.toUpperCase().indexOf('WITH')));

/** `SELECT ... INTO new_table` creates a table in PostgreSQL. */
const hasSelectInto = (statement: string): boolean => /\bSELECT\b[\s\S]*\bINTO\b/i.test(statement);

/**
 * Validate an admin-supplied SQL statement.
 *
 * @param raw SQL from the request body.
 * @param allowWrites Value of `DATABASE_ADMIN_ALLOW_WRITES`.
 */
export const validateAdminSql = (raw: unknown, allowWrites: boolean): SqlGuardResult => {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, error: 'Query is required and must be a non-empty string' };
  }

  const statement = stripComments(raw).trim().replace(/;+\s*$/, '');
  if (!statement) {
    return { ok: false, error: 'Query is empty' };
  }
  if (statement.includes(';')) {
    return { ok: false, error: 'Only a single statement is allowed' };
  }

  for (const { label, pattern } of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(statement)) {
      return { ok: false, error: `Operation not allowed: ${label}` };
    }
  }

  const keyword = leadingKeyword(statement);
  const isReadOnly = (READ_ONLY_KEYWORDS as readonly string[]).includes(keyword);
  if (!isReadOnly && !(WRITE_KEYWORDS as readonly string[]).includes(keyword)) {
    return { ok: false, error: `Statement type not allowed: ${keyword || 'unknown'}` };
  }

  if (isReadOnly) {
    if (keyword === 'WITH' && !isReadOnlyWith(statement)) {
      return { ok: false, error: 'Data-modifying statements are not allowed in this console' };
    }
    if (hasSelectInto(statement)) {
      return { ok: false, error: 'SELECT ... INTO is not allowed' };
    }
    return { ok: true, statement, isReadOnly: true };
  }

  if (!allowWrites) {
    return {
      ok: false,
      error: 'Only read-only queries are allowed. Set DATABASE_ADMIN_ALLOW_WRITES=true to enable writes.',
    };
  }

  return { ok: true, statement, isReadOnly: false };
};
