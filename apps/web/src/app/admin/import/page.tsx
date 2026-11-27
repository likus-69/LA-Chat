'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ApiError, isAuthenticated } from '@/lib/api';
import type { UserProfileDto } from '@la-chat/shared-types';

// ---------------------------------------------------------------------------
// Types matching the API response from POST /users/import
// ---------------------------------------------------------------------------

interface ImportError {
  row: number;
  message: string;
}

interface GeneratedPassword {
  identifier: string;
  password: string;
}

interface ImportResult {
  created: number;
  skipped: number;
  errors: ImportError[];
  generatedPasswords: GeneratedPassword[];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ImportUsersPage(): React.JSX.Element {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // Auth gate — only SCHOOL_ADMINISTRATOR / ICT_ADMINISTRATOR may view.
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    apiFetch<UserProfileDto>('/users/me')
      .then((p) => {
        setProfile(p);
        setLoading(false);
        const isAdmin =
          p.roles.includes('SCHOOL_ADMINISTRATOR' as never) ||
          p.roles.includes('ICT_ADMINISTRATOR' as never);
        if (!isAdmin) {
          setAuthError('You do not have permission to access this page.');
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        setAuthError(err instanceof Error ? err.message : 'Failed to load profile');
        setLoading(false);
      });
  }, [router]);

  // -------------------------------------------------------------------------
  // File selection
  // -------------------------------------------------------------------------

  const handleFileSelected = useCallback((selected: File | null) => {
    setResult(null);
    setUploadError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!selected.name.toLowerCase().endsWith('.csv')) {
      setUploadError('Please select a .csv file.');
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setUploadError('File is larger than 10 MB.');
      return;
    }
    setFile(selected);
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFileSelected(e.target.files?.[0] ?? null);
    },
    [handleFileSelected],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFileSelected(e.dataTransfer.files?.[0] ?? null);
    },
    [handleFileSelected],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  // -------------------------------------------------------------------------
  // Upload (raw fetch — multipart/form-data, not JSON)
  // -------------------------------------------------------------------------

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setResult(null);
    try {
      const tokensRaw = typeof window !== 'undefined' ? localStorage.getItem('la-chat-tokens') : null;
      const token = tokensRaw ? (JSON.parse(tokensRaw) as { accessToken?: string }).accessToken : undefined;
      if (!token) {
        setUploadError('You are not signed in. Please reload.');
        setUploading(false);
        return;
      }
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/v1/users/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const isJson = (res.headers.get('content-type') || '').includes('application/json');
      const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
      if (!res.ok) {
        const msg =
          typeof body === 'object' && body && 'message' in body
            ? String((body as { message: unknown }).message)
            : typeof body === 'string'
              ? body
              : `Upload failed (HTTP ${res.status})`;
        setUploadError(msg);
        setUploading(false);
        return;
      }
      setResult(body as ImportResult);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [file]);

  // -------------------------------------------------------------------------
  // Template download — uses apiFetch (text/csv response is fine)
  // -------------------------------------------------------------------------

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const csv = await apiFetch<string>('/users/import/template');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'la-chat-import-template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not download template');
    }
  }, []);

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <p>Loading…</p>
        </div>
      </main>
    );
  }

  if (authError) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>Access denied</h1>
          <p style={styles.muted}>{authError}</p>
          <Link href="/dashboard" style={styles.outlineButton}>Back to dashboard</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Import users</h1>
            <p style={styles.subtitle}>Light Academy Secondary School — bulk CSV import</p>
          </div>
          <Link href="/dashboard" style={styles.outlineButton}>← Dashboard</Link>
        </div>

        {/* Format instructions */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>CSV format</h2>
          <p style={styles.muted}>
            The CSV must have a header row with these columns, in any order:
          </p>
          <pre style={styles.code}>
{`type,identifier,fullName,email,phone,role,className,streamName,department,password`}
          </pre>
          <ul style={styles.list}>
            <li><strong>type</strong> — <code>student</code> or <code>staff</code></li>
            <li><strong>identifier</strong> — admission number (student) or staff number (staff)</li>
            <li><strong>role</strong> — required for staff (e.g. <code>TEACHER</code>, <code>HEADTEACHER</code>); blank for students</li>
            <li><strong>className</strong> + <strong>streamName</strong> — required for students (e.g. <code>Senior One</code>, <code>East</code>); blank for staff</li>
            <li><strong>department</strong> — optional for staff; blank for students</li>
            <li><strong>password</strong> — optional. If blank, a temporary password is generated and shown in the results.</li>
          </ul>
          <button onClick={handleDownloadTemplate} style={styles.outlineButton}>
            Download template
          </button>
        </section>

        {/* Upload area */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Upload file</h2>
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            style={{
              ...styles.dropzone,
              ...(dragOver ? styles.dropzoneActive : {}),
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onInputChange}
              style={{ display: 'none' }}
            />
            {file ? (
              <div>
                <div style={styles.fileName}>{file.name}</div>
                <div style={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</div>
              </div>
            ) : (
              <div>
                <div style={styles.dropzonePrompt}>
                  Drag a CSV file here, or <span style={styles.dropzoneLink}>click to select</span>
                </div>
                <div style={styles.muted}>Max 10 MB · .csv only</div>
              </div>
            )}
          </div>

          {uploadError && (
            <div style={styles.errorBox} role="alert">
              {uploadError}
            </div>
          )}

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              style={{
                ...styles.primaryButton,
                ...((!file || uploading) ? styles.primaryButtonDisabled : {}),
              }}
            >
              {uploading ? 'Importing…' : 'Import users'}
            </button>
            {file && !uploading && (
              <button
                onClick={() => handleFileSelected(null)}
                style={styles.outlineButton}
              >
                Clear
              </button>
            )}
          </div>
        </section>

        {/* Results */}
        {result && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Results</h2>
            <div style={styles.statsRow}>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{result.created}</div>
                <div style={styles.statLabel}>Created</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{result.skipped}</div>
                <div style={styles.statLabel}>Skipped</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{result.errors.length}</div>
                <div style={styles.statLabel}>Errors</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{result.generatedPasswords.length}</div>
                <div style={styles.statLabel}>Generated passwords</div>
              </div>
            </div>

            {result.generatedPasswords.length > 0 && (
              <>
                <h3 style={styles.subsectionTitle}>
                  Generated passwords — give these to the users
                </h3>
                <p style={styles.muted}>
                  These rows had no password in the CSV. A temporary password was generated
                  and is shown here <strong>once</strong>. Copy it now — it will not be retrievable later.
                </p>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Identifier</th>
                        <th style={styles.th}>Temporary password</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.generatedPasswords.map((p) => (
                        <tr key={p.identifier}>
                          <td style={styles.td}>{p.identifier}</td>
                          <td style={{ ...styles.td, fontFamily: 'monospace' }}>{p.password}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {result.errors.length > 0 && (
              <>
                <h3 style={styles.subsectionTitle}>Errors</h3>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Row</th>
                        <th style={styles.th}>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((e) => (
                        <tr key={`${e.row}-${e.message}`}>
                          <td style={styles.td}>{e.row}</td>
                          <td style={styles.td}>{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {result.created > 0 && (
              <p style={styles.muted}>
                New accounts start in <code>PENDING</code> status. Use the users API
                (or the admin console, when available) to approve them before they can sign in.
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Inline styles — brand palette
//   primary navy:  #2E3192
//   red accent:    #ED1C24
//   page bg:       #f0f2f5
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f0f2f5',
    padding: '2rem 1rem',
    display: 'flex',
    justifyContent: 'center',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    color: '#0f172a',
  },
  card: {
    background: 'white',
    borderRadius: '12px',
    padding: '2rem',
    width: '100%',
    maxWidth: '820px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '2rem',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  title: { margin: 0, fontSize: '1.5rem', color: '#2E3192' },
  subtitle: { margin: 0, fontSize: '0.85rem', color: '#475569' },
  section: { marginBottom: '2rem' },
  sectionTitle: {
    fontSize: '1.05rem',
    color: '#2E3192',
    marginBottom: '0.75rem',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '0.5rem',
  },
  subsectionTitle: {
    fontSize: '0.95rem',
    color: '#2E3192',
    marginTop: '1.5rem',
    marginBottom: '0.5rem',
  },
  muted: { color: '#475569', lineHeight: 1.5, fontSize: '0.9rem' },
  list: {
    color: '#475569',
    lineHeight: 1.6,
    fontSize: '0.9rem',
    paddingLeft: '1.25rem',
    margin: '0.5rem 0 1rem 0',
  },
  code: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '0.6rem 0.8rem',
    fontSize: '0.8rem',
    color: '#1e293b',
    fontFamily: 'monospace',
    overflowX: 'auto',
    margin: '0.5rem 0 1rem 0',
  },
  dropzone: {
    border: '2px dashed #cbd5e1',
    borderRadius: '10px',
    padding: '2rem',
    textAlign: 'center',
    cursor: 'pointer',
    background: '#f8fafc',
    transition: 'border-color 0.15s, background 0.15s',
  },
  dropzoneActive: {
    borderColor: '#2E3192',
    background: '#eef0fb',
  },
  dropzonePrompt: {
    color: '#2E3192',
    fontWeight: 600,
    marginBottom: '0.25rem',
  },
  dropzoneLink: {
    color: '#ED1C24',
    textDecoration: 'underline',
  },
  fileName: {
    color: '#2E3192',
    fontWeight: 600,
    marginBottom: '0.25rem',
  },
  fileSize: {
    color: '#475569',
    fontSize: '0.85rem',
  },
  primaryButton: {
    padding: '0.6rem 1.25rem',
    borderRadius: '8px',
    border: 'none',
    background: '#2E3192',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
  },
  primaryButtonDisabled: {
    background: '#a5a8d4',
    cursor: 'not-allowed',
  },
  outlineButton: {
    padding: '0.6rem 1.25rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    background: 'white',
    color: '#2E3192',
    cursor: 'pointer',
    textDecoration: 'none',
    fontSize: '0.9rem',
    fontWeight: 500,
    display: 'inline-block',
  },
  errorBox: {
    marginTop: '1rem',
    padding: '0.75rem 1rem',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    borderRadius: '6px',
    fontSize: '0.9rem',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  statCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '1rem',
    textAlign: 'center',
  },
  statValue: {
    fontSize: '1.6rem',
    fontWeight: 700,
    color: '#2E3192',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#475569',
    marginTop: '0.25rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    marginTop: '0.5rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.6rem 0.85rem',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    color: '#2E3192',
    fontWeight: 600,
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  td: {
    padding: '0.6rem 0.85rem',
    borderBottom: '1px solid #f1f5f9',
    color: '#1e293b',
  },
};
