'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError, isAuthenticated } from '@/lib/api';
import type { ReportDto, ReportStatus, ModerationActionType } from '@la-chat/shared-types';

type ReportListResponse = {
  items: ReportDto[];
  total: number;
  page: number;
  pageSize: number;
};

type ReportedMessage = {
  message: {
    id: string;
    body: string | null;
    createdAt: string;
    deletedAt: string | null;
    editedAt: string | null;
    type: string;
    sender: { fullName: string } | null;
    conversation: { id: string; type: string } | null;
    reactions: { emoji: string }[];
    attachments: { id: string; filename: string; mimeType: string; sizeBytes: number }[];
  } | null;
  accessLogged: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  BULLYING: 'Bullying',
  INAPPROPRIATE: 'Inappropriate',
  SPAM: 'Spam',
  IMPERSONATION: 'Impersonation',
  THREAT: 'Threat',
  OTHER: 'Other',
};

const STATUS_COLORS: Record<ReportStatus, { bg: string; color: string }> = {
  OPEN: { bg: '#fef3c7', color: '#92400e' },
  REVIEWING: { bg: '#dbeafe', color: '#1e40af' },
  RESOLVED: { bg: '#dcfce7', color: '#166534' },
  DISMISSED: { bg: '#f1f5f9', color: '#475569' },
};

export default function ModerationPage() {
  const router = useRouter();
  const [reports, setReports] = useState<ReportDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReportDto | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [reportedMessage, setReportedMessage] = useState<ReportedMessage | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // -----------------------------------------------------------------------
  // Load moderation queue
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const data = await apiFetch<ReportListResponse>(`/moderation/reports${qs}`);
      setReports(data.items);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/login');
        return;
      }
      if (err instanceof ApiError && err.status === 403) {
        setError('You do not have permission to view the moderation queue.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load reports');
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, router]);

  // -----------------------------------------------------------------------
  // Select a report to view details
  // -----------------------------------------------------------------------
  const handleSelect = useCallback((r: ReportDto) => {
    setSelected(r);
    setReportedMessage(null);
    setActionNote('');
  }, []);

  // -----------------------------------------------------------------------
  // Take an action on a report
  // -----------------------------------------------------------------------
  const handleAction = useCallback(async (action: ModerationActionType) => {
    if (!selected) return;
    const confirmMap: Record<ModerationActionType, string> = {
      WARN: 'Send a warning and mark this report as resolved?',
      REMOVE_MESSAGE: 'Remove the reported message and resolve this report?',
      SUSPEND_ACCOUNT: 'SUSPEND the reported user account? This will revoke all their sessions.',
      DISMISS: 'Dismiss this report? No further action will be taken.',
    };
    if (!window.confirm(confirmMap[action])) return;

    setBusy(true);
    setError(null);
    try {
      const updated = await apiFetch<ReportDto>(`/moderation/reports/${selected.id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action, note: actionNote.trim() || undefined }),
      });
      setSelected(updated);
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setActionNote('');
      setReportedMessage(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }, [selected, actionNote, router]);

  // -----------------------------------------------------------------------
  // View the reported message (requires MODERATION_ACCESS_PRIVATE permission)
  // -----------------------------------------------------------------------
  const handleViewMessage = useCallback(async () => {
    if (!selected || !selected.reportedMessageId) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<ReportedMessage>(`/moderation/reports/${selected.id}/message`);
      setReportedMessage(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/login');
        return;
      }
      if (err instanceof ApiError && err.status === 403) {
        setError('You do not have permission to view private message content.');
      } else if (err instanceof ApiError && err.status === 404) {
        setError('No message is associated with this report, or it has been removed.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load message');
      }
    } finally {
      setBusy(false);
    }
  }, [selected, router]);

  if (loading && reports.length === 0) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <header style={styles.header}>
            <Link href="/chat" style={styles.backLink}>← Back to chat</Link>
            <h1 style={styles.title}>Moderation Queue</h1>
          </header>
          <p style={styles.loading}>Loading moderation queue…</p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        {/* Header */}
        <header style={styles.header}>
          <Link href="/chat" style={styles.backLink}>← Back to chat</Link>
          <h1 style={styles.title}>Moderation Queue</h1>
          <div style={styles.filterRow}>
            {['', 'OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'].map((s) => (
              <button
                key={s || 'all'}
                style={{
                  ...styles.filterBtn,
                  ...(statusFilter === s ? styles.filterBtnActive : {}),
                }}
                onClick={() => setStatusFilter(s)}
              >
                {s || 'All'}
              </button>
            ))}
          </div>
        </header>

        {error && <div style={styles.errorBar}>{error}</div>}

        <div style={styles.body}>
          {/* Reports list */}
          <section style={styles.listSection}>
            <h2 style={styles.sectionTitle}>
              Reports {reports.length > 0 && <span style={styles.count}>({reports.length})</span>}
            </h2>
            {reports.length === 0 ? (
              <div style={styles.empty}>
                <p>No reports in the queue. 🎉</p>
              </div>
            ) : (
              <ul style={styles.reportList}>
                {reports.map((r) => {
                  const isSelected = selected?.id === r.id;
                  const statusStyle = STATUS_COLORS[r.status] ?? STATUS_COLORS.OPEN;
                  return (
                    <li
                      key={r.id}
                      style={{
                        ...styles.reportItem,
                        ...(isSelected ? styles.reportItemSelected : {}),
                      }}
                      onClick={() => handleSelect(r)}
                    >
                      <div style={styles.reportItemHeader}>
                        <span style={styles.categoryBadge}>{CATEGORY_LABELS[r.category] ?? r.category}</span>
                        <span style={{ ...styles.statusBadge, background: statusStyle.bg, color: statusStyle.color }}>
                          {r.status}
                        </span>
                      </div>
                      <div style={styles.reportMeta}>
                        <span style={styles.reporterName}>Reported by: {r.reporterName || 'Unknown'}</span>
                        {r.reportedUserName && (
                          <span style={styles.reportedUser}>Subject: {r.reportedUserName}</span>
                        )}
                      </div>
                      <p style={styles.reasonPreview}>
                        {r.reason.length > 120 ? r.reason.slice(0, 120) + '…' : r.reason}
                      </p>
                      <div style={styles.reportFooter}>
                        <span style={styles.dateLabel}>{formatDate(r.createdAt)}</span>
                        {r.actions.length > 0 && (
                          <span style={styles.actionsCount}>{r.actions.length} action(s)</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Report details */}
          <section style={styles.detailSection}>
            {!selected ? (
              <div style={styles.emptyDetail}>
                <p>Select a report from the list to see details and take action.</p>
              </div>
            ) : (
              <div style={styles.detailCard}>
                <div style={styles.detailHeader}>
                  <div>
                    <h2 style={styles.detailTitle}>
                      {CATEGORY_LABELS[selected.category] ?? selected.category}
                    </h2>
                    <span style={{ ...styles.statusBadge, background: STATUS_COLORS[selected.status].bg, color: STATUS_COLORS[selected.status].color }}>
                      {selected.status}
                    </span>
                  </div>
                  <button style={styles.closeBtn} onClick={() => setSelected(null)}>✕</button>
                </div>

                <div style={styles.detailGrid}>
                  <div style={styles.detailField}>
                    <div style={styles.fieldLabel}>Reporter</div>
                    <div style={styles.fieldValue}>{selected.reporterName || 'Unknown'}</div>
                  </div>
                  <div style={styles.detailField}>
                    <div style={styles.fieldLabel}>Reported user</div>
                    <div style={styles.fieldValue}>{selected.reportedUserName ?? '—'}</div>
                  </div>
                  <div style={styles.detailField}>
                    <div style={styles.fieldLabel}>Reported message</div>
                    <div style={styles.fieldValue}>{selected.reportedMessageId ?? '—'}</div>
                  </div>
                  <div style={styles.detailField}>
                    <div style={styles.fieldLabel}>Filed at</div>
                    <div style={styles.fieldValue}>{formatDate(selected.createdAt)}</div>
                  </div>
                  {selected.resolvedAt && (
                    <div style={styles.detailField}>
                      <div style={styles.fieldLabel}>Resolved at</div>
                      <div style={styles.fieldValue}>{formatDate(selected.resolvedAt)}</div>
                    </div>
                  )}
                </div>

                <div style={styles.reasonBlock}>
                  <div style={styles.fieldLabel}>Reason</div>
                  <p style={styles.reasonText}>{selected.reason}</p>
                </div>

                {/* Action history */}
                {selected.actions.length > 0 && (
                  <div style={styles.actionHistory}>
                    <div style={styles.fieldLabel}>Action history</div>
                    <ul style={styles.actionList}>
                      {selected.actions.map((a) => (
                        <li key={a.id} style={styles.actionItem}>
                          <span style={styles.actionType}>{a.action}</span>
                          <span style={styles.actionBy}>by {a.moderatorName}</span>
                          <span style={styles.actionDate}>{formatDate(a.createdAt)}</span>
                          {a.note && <p style={styles.actionNote}>{a.note}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* View reported message */}
                {selected.reportedMessageId && (
                  <div style={styles.messageBlock}>
                    <button
                      style={styles.viewMsgBtn}
                      onClick={handleViewMessage}
                      disabled={busy}
                    >
                      View reported message
                    </button>
                    {reportedMessage?.message && (
                      <div style={styles.messagePreview}>
                        <div style={styles.msgMeta}>
                          <strong>From:</strong> {reportedMessage.message.sender?.fullName ?? 'Unknown'} ·
                          <strong> Type:</strong> {reportedMessage.message.type} ·
                          <strong> Sent:</strong> {formatDate(reportedMessage.message.createdAt)}
                        </div>
                        {reportedMessage.message.deletedAt ? (
                          <p style={styles.deletedMsg}>(message has been removed)</p>
                        ) : reportedMessage.message.body ? (
                          <p style={styles.msgBody}>{reportedMessage.message.body}</p>
                        ) : (
                          <p style={styles.msgBody}>(no text body)</p>
                        )}
                        {reportedMessage.message.attachments.length > 0 && (
                          <ul style={styles.attachmentList}>
                            {reportedMessage.message.attachments.map((att) => (
                              <li key={att.id}>{att.filename} ({(att.sizeBytes / 1024).toFixed(1)} KB)</li>
                            ))}
                          </ul>
                        )}
                        {reportedMessage.accessLogged && (
                          <p style={styles.accessNote}>
                            ✅ Access logged in the moderation access log (append-only).
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                {selected.status !== 'RESOLVED' && selected.status !== 'DISMISSED' && (
                  <div style={styles.actionPanel}>
                    <div style={styles.fieldLabel}>Moderator note (optional)</div>
                    <textarea
                      style={styles.noteInput}
                      value={actionNote}
                      onChange={(e) => setActionNote(e.target.value)}
                      placeholder="Add a note explaining the action…"
                      rows={3}
                    />
                    <div style={styles.actionButtons}>
                      <button
                        style={styles.btnWarn}
                        onClick={() => handleAction('WARN')}
                        disabled={busy}
                      >⚠️ Warn</button>
                      <button
                        style={styles.btnRemove}
                        onClick={() => handleAction('REMOVE_MESSAGE')}
                        disabled={busy}
                      >🗑️ Remove message</button>
                      <button
                        style={styles.btnSuspend}
                        onClick={() => handleAction('SUSPEND_ACCOUNT')}
                        disabled={busy}
                      >🚫 Suspend account</button>
                      <button
                        style={styles.btnDismiss}
                        onClick={() => handleAction('DISMISS')}
                        disabled={busy}
                      >✕ Dismiss</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f0f2f5', display: 'flex', fontFamily: 'system-ui, -apple-system, sans-serif' },
  shell: { display: 'flex', flexDirection: 'column', width: '100%', minHeight: '100vh' },
  header: {
    display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1.5rem',
    background: '#1e3a5f', color: 'white', flexWrap: 'wrap',
  },
  backLink: { color: 'white', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 },
  title: { margin: 0, fontSize: '1.25rem', fontWeight: 700, flex: 1, minWidth: '180px' },
  filterRow: { display: 'flex', gap: '0.25rem', flexWrap: 'wrap' },
  filterBtn: {
    background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none',
    padding: '0.35rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem',
  },
  filterBtnActive: { background: 'white', color: '#1e3a5f', fontWeight: 600 },
  body: { display: 'flex', flex: 1, gap: '1rem', padding: '1rem 1.5rem', minHeight: 0 },
  listSection: { flex: '1 1 35%', minWidth: '320px', background: 'white', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column' },
  detailSection: { flex: '1 1 65%', minWidth: '400px', background: 'white', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column' },
  sectionTitle: { margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#1e3a5f', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' },
  count: { fontSize: '0.85rem', fontWeight: 400, color: '#64748b' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: '2rem', fontStyle: 'italic' },
  loading: { padding: '2rem', textAlign: 'center', color: '#64748b', margin: 'auto' },
  errorBar: { padding: '0.75rem 1.5rem', background: '#fef2f2', color: '#b91c1c', fontSize: '0.85rem', borderBottom: '1px solid #fecaca' },
  reportList: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', overflow: 'auto' },
  reportItem: {
    padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0',
    cursor: 'pointer', transition: 'all 0.15s',
  },
  reportItemSelected: { border: '2px solid #1e3a5f', background: '#f8fafc' },
  reportItemHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' },
  categoryBadge: {
    background: '#1e3a5f', color: 'white', padding: '0.15rem 0.5rem',
    borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600,
  },
  statusBadge: { padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 },
  reportMeta: { display: 'flex', flexDirection: 'column', gap: '0.15rem', marginBottom: '0.4rem', fontSize: '0.8rem', color: '#475569' },
  reporterName: { fontWeight: 500 },
  reportedUser: { color: '#64748b' },
  reasonPreview: { margin: '0 0 0.4rem 0', fontSize: '0.85rem', color: '#1f2937', lineHeight: 1.4 },
  reportFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: '#94a3b8' },
  dateLabel: {},
  actionsCount: { background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px' },
  emptyDetail: { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#94a3b8', fontStyle: 'italic' },
  detailCard: { display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflow: 'auto' },
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' },
  detailTitle: { margin: '0 0 0.5rem 0', fontSize: '1.15rem', color: '#1e3a5f' },
  closeBtn: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#64748b' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' },
  detailField: {},
  fieldLabel: { fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, marginBottom: '0.15rem' },
  fieldValue: { fontSize: '0.9rem', color: '#1f2937', wordBreak: 'break-word' },
  reasonBlock: { background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' },
  reasonText: { margin: '0.25rem 0 0 0', fontSize: '0.9rem', lineHeight: 1.5, color: '#1f2937', whiteSpace: 'pre-wrap' },
  actionHistory: {},
  actionList: { listStyle: 'none', margin: '0.25rem 0 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  actionItem: { padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '6px', fontSize: '0.85rem' },
  actionType: { fontWeight: 600, color: '#1e3a5f', marginRight: '0.5rem' },
  actionBy: { color: '#475569', marginRight: '0.5rem' },
  actionDate: { color: '#94a3b8', fontSize: '0.75rem' },
  actionNote: { margin: '0.25rem 0 0 0', color: '#475569', fontStyle: 'italic' },
  messageBlock: { background: '#fef3c7', padding: '0.75rem', borderRadius: '8px', border: '1px solid #fde68a' },
  viewMsgBtn: {
    background: '#1e3a5f', color: 'white', border: 'none', padding: '0.5rem 1rem',
    borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
  },
  messagePreview: { marginTop: '0.75rem', padding: '0.75rem', background: 'white', borderRadius: '6px', border: '1px solid #e2e8f0' },
  msgMeta: { fontSize: '0.8rem', color: '#475569', marginBottom: '0.5rem' },
  msgBody: { margin: '0', fontSize: '0.95rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', color: '#1f2937' },
  deletedMsg: { margin: '0', fontStyle: 'italic', color: '#94a3b8' },
  attachmentList: { margin: '0.5rem 0 0 0', paddingLeft: '1.25rem', fontSize: '0.8rem', color: '#475569' },
  accessNote: { margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#166534' },
  actionPanel: { borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' },
  noteInput: {
    width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1',
    borderRadius: '6px', fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical',
    outline: 'none', boxSizing: 'border-box',
  },
  actionButtons: { display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' },
  btnWarn: {
    background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a',
    padding: '0.5rem 0.85rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
  },
  btnRemove: {
    background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca',
    padding: '0.5rem 0.85rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
  },
  btnSuspend: {
    background: '#b91c1c', color: 'white', border: '1px solid #991b1b',
    padding: '0.5rem 0.85rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
  },
  btnDismiss: {
    background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0',
    padding: '0.5rem 0.85rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
  },
};
