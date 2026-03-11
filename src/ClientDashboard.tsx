import { useState, useEffect, useCallback } from 'react';
import {
  Plus, CurrencyInr, User as UserIcon, Trash,
  Files, Clock, ChartBar, Key, MagnifyingGlass, ArrowCounterClockwise,
  Bank, QrCode, Eye, WarningCircle, Users, TrendUp, Hourglass, XCircle as XCircleIcon,
  PencilSimple, FloppyDisk
} from '@phosphor-icons/react';
import api from './api';

// ==========================================
// LOADING SKELETON COMPONENT
// ==========================================
function TableSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}><div className="skeleton skeleton-text" style={{ width: '80px' }} /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, ri) => (
            <tr key={ri}>
              {Array.from({ length: columns }).map((_, ci) => (
                <td key={ci}><div className="skeleton skeleton-text" /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`, gap: '1rem', marginBottom: '2rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
          <div className="skeleton skeleton-text" style={{ width: '120px', marginBottom: '0.75rem' }} />
          <div className="skeleton skeleton-text" style={{ width: '80px', height: '2rem' }} />
        </div>
      ))}
    </div>
  );
}

export default function ClientDashboard() {
  const [activeTab, setActiveTab] = useState('users');
  const [statementUserIdFilter, setStatementUserIdFilter] = useState<string | null>(null);

  const handleViewStatement = (userId: string) => {
    setStatementUserIdFilter(userId);
    setActiveTab('stats');
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', overflowX: 'auto', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        {[
          { key: 'users', icon: <UserIcon size={18} />, label: 'User List' },
          { key: 'withdrawals', icon: <CurrencyInr size={18} />, label: 'Add Withdrawals' },
          { key: 'pending', icon: <Clock size={18} />, label: 'Pending Withdrawals' },
          { key: 'stats', icon: <ChartBar size={18} />, label: 'Statistics & Statements' },
          { key: 'admin', icon: <Key size={18} />, label: 'Admin Panel (Staff)' },
        ].map(tab => (
          <button
            key={tab.key}
            className={activeTab === tab.key ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'users' && <UsersBlock onViewStatement={handleViewStatement} />}
      {activeTab === 'withdrawals' && <WithdrawListBlock onViewStatement={handleViewStatement} />}
      {activeTab === 'pending' && <PendingWithdrawalsBlock />}
      {activeTab === 'stats' && <StatisticsBlock initialUserId={statementUserIdFilter} onClearUserFilter={() => setStatementUserIdFilter(null)} />}
      {activeTab === 'admin' && <AdminPanelBlock />}
    </div>
  );
}

// ==========================================
// BLOCK 1: USER LIST
// ==========================================
function UsersBlock({ onViewStatement }: { onViewStatement: (id: string) => void }) {
  const [workers, setWorkers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [viewWorker, setViewWorker] = useState<any | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Edit form state
  const [editQrFile, setEditQrFile] = useState<File | null>(null);
  const [editAccNum, setEditAccNum] = useState('');
  const [editIfsc, setEditIfsc] = useState('');
  const [editAccName, setEditAccName] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Create form
  const [name, setName] = useState('');
  const [userIdCode, setUserIdCode] = useState('');
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [accNum, setAccNum] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accName, setAccName] = useState('');

  const fetchWorkers = useCallback(async () => {
    setDataLoading(true);
    try {
      const res = await api.get('/client/workers');
      setWorkers(res.data);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => { fetchWorkers(); }, [fetchWorkers]);

  const openViewModal = (w: any) => {
    setViewWorker(w);
    setEditMode(false);
    setEditQrFile(null);
    setEditAccNum(w.bank_account_number || '');
    setEditIfsc(w.bank_ifsc || '');
    setEditAccName(w.bank_account_name || '');
  };

  const handleSaveEdit = async () => {
    if (!viewWorker) return;
    setEditSaving(true);
    try {
      let qrUrl: string | undefined = undefined;
      if (editQrFile) {
        const formData = new FormData();
        formData.append('file', editQrFile);
        const uploadRes = await api.post('/client/workers/upload-qr', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        qrUrl = uploadRes.data.url;
      }

      const payload: any = {
        bank_account_number: editAccNum || null,
        bank_ifsc: editIfsc || null,
        bank_account_name: editAccName || null,
      };
      if (qrUrl !== undefined) {
        payload.qr_code_url = qrUrl;
      }

      const res = await api.put(`/client/workers/${viewWorker.id}`, payload);
      setViewWorker(res.data);
      setEditMode(false);
      setEditQrFile(null);
      fetchWorkers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error updating user');
    } finally {
      setEditSaving(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrFile) {
      alert('QR Code image is mandatory. Please upload a QR code.');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', qrFile);
      const uploadRes = await api.post('/client/workers/upload-qr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const qrUrl = uploadRes.data.url;

      await api.post('/client/workers', {
        name: name || null,
        worker_id_code: userIdCode,
        qr_code_url: qrUrl,
        bank_account_number: accNum || null,
        bank_ifsc: ifsc || null,
        bank_account_name: accName || null
      });

      setShowAdd(false);
      setName(''); setUserIdCode(''); setQrFile(null); setAccNum(''); setIfsc(''); setAccName('');
      fetchWorkers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error adding user');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.delete(`/client/workers/${id}`);
      fetchWorkers();
    } catch { alert('Error deleting user'); }
  };

  const filtered = workers.filter(w =>
    (w.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (w.worker_id_code || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <MagnifyingGlass style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-secondary)' }} />
          <input type="text" placeholder="Search by name or User ID..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.5rem', width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {!dataLoading && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {filtered.length} user{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
          <button className="btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Onboard User</button>
        </div>
      </div>

      {dataLoading ? (
        <TableSkeleton columns={4} rows={5} />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th>Payment Info</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(w => (
                <tr key={w.id}>
                  <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.9rem' }}>{w.worker_id_code || '-'}</td>
                  <td>{w.name || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>-</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {w.qr_code_url && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem',
                          background: '#dcfce7', color: '#166534'
                        }}>
                          <QrCode size={14} /> QR
                        </span>
                      )}
                      {w.bank_account_number && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem',
                          background: '#dbeafe', color: '#1e40af'
                        }}>
                          <Bank size={14} /> ***{w.bank_account_number.slice(-4)}
                        </span>
                      )}
                      {!w.qr_code_url && !w.bank_account_number && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem',
                          background: '#fee2e2', color: '#991b1b'
                        }}>
                          <WarningCircle size={14} /> No payment info
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn-secondary" style={{ padding: '0.4rem 0.6rem' }} onClick={() => openViewModal(w)} title="View / Edit Details">
                        <Eye size={16} />
                      </button>
                      <button className="btn-secondary" style={{ padding: '0.4rem 0.6rem' }} onClick={() => onViewStatement(w.id)} title="View Statements">
                        <Files size={16} />
                      </button>
                      <button className="btn-secondary" style={{ padding: '0.4rem 0.6rem', color: '#dc2626' }} onClick={() => handleDelete(w.id)} title="Delete User">
                        <Trash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} style={{textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)'}}>No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* View / Edit Worker Details Modal */}
      {viewWorker && (
        <div className="modal-overlay" onClick={() => setViewWorker(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserIcon size={22} /> User Details
              </h2>
              {!editMode && (
                <button className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => setEditMode(true)}>
                  <PencilSimple size={16} /> Edit
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Basic Info (read only) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Full Name</div>
                  <div style={{ fontWeight: 600 }}>{viewWorker.name || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Not set</span>}</div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>User ID</div>
                  <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{viewWorker.worker_id_code || '-'}</div>
                </div>
              </div>

              {/* QR Code Section */}
              <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <QrCode size={16} /> QR Code
                </div>
                {viewWorker.qr_code_url && !editMode && (
                  <div style={{ textAlign: 'center' }}>
                    <img src={viewWorker.qr_code_url} alt="QR Code" style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }} />
                  </div>
                )}
                {!viewWorker.qr_code_url && !editMode && (
                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    No QR code uploaded
                  </div>
                )}
                {editMode && (
                  <div>
                    {viewWorker.qr_code_url && (
                      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                        <img src={viewWorker.qr_code_url} alt="Current QR" style={{ maxWidth: '120px', maxHeight: '120px', objectFit: 'contain', borderRadius: 'var(--radius-sm)', opacity: 0.6 }} />
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Current QR</div>
                      </div>
                    )}
                    <div style={{
                      border: `2px dashed ${editQrFile ? '#16a34a' : 'var(--border-color)'}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: editQrFile ? '#f0fdf4' : 'var(--bg-primary)',
                    }}
                    onClick={() => document.getElementById('edit-qr-file-input')?.click()}
                    >
                      <input
                        id="edit-qr-file-input"
                        type="file"
                        accept="image/*"
                        onChange={e => setEditQrFile(e.target.files?.[0] || null)}
                        style={{ display: 'none' }}
                      />
                      {editQrFile ? (
                        <div style={{ color: '#16a34a', fontSize: '0.85rem' }}>New file: {editQrFile.name}</div>
                      ) : (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Click to upload new QR code</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bank Details Section */}
              <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Bank size={16} /> Bank Details
                </div>
                {!editMode ? (
                  viewWorker.bank_account_number ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div className="bank-detail-item">
                        <span className="bank-detail-label">Account Number</span>
                        <span className="bank-detail-value" style={{ fontFamily: 'monospace', letterSpacing: '1px' }}>{viewWorker.bank_account_number}</span>
                      </div>
                      <div className="bank-detail-item">
                        <span className="bank-detail-label">IFSC Code</span>
                        <span className="bank-detail-value" style={{ fontFamily: 'monospace' }}>{viewWorker.bank_ifsc || '-'}</span>
                      </div>
                      <div className="bank-detail-item">
                        <span className="bank-detail-label">Account Name</span>
                        <span className="bank-detail-value">{viewWorker.bank_account_name || '-'}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      No bank details configured
                    </div>
                  )
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Account Holder Name</label>
                      <input placeholder="Name as per bank records" value={editAccName} onChange={e => setEditAccName(e.target.value)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Account Number</label>
                        <input placeholder="e.g., 1234567890" value={editAccNum} onChange={e => setEditAccNum(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>IFSC Code</label>
                        <input placeholder="e.g., SBIN0001234" value={editIfsc} onChange={e => setEditIfsc(e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              {editMode ? (
                <>
                  <button className="btn-secondary" onClick={() => { setEditMode(false); setEditQrFile(null); }}>Cancel</button>
                  <button className="btn-primary" onClick={handleSaveEdit} disabled={editSaving}>
                    <FloppyDisk size={16} /> {editSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-secondary" onClick={() => { onViewStatement(viewWorker.id); setViewWorker(null); }}>
                    <Files size={16} /> View Statement
                  </button>
                  <button className="btn-secondary" onClick={() => setViewWorker(null)}>Close</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Onboard User Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>Onboard New User</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              User ID and QR Code are mandatory. Name and bank details are optional.
            </p>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Required Section */}
              <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-color)', marginBottom: '1rem' }}>
                  Required Information
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>User ID Code *</label>
                    <input required value={userIdCode} onChange={e => setUserIdCode(e.target.value)} placeholder="Unique identifier" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Full Name (Optional)</label>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter full name" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <QrCode size={16} /> QR Code Image *
                    </label>
                    <div style={{
                      border: `2px dashed ${qrFile ? '#16a34a' : 'var(--border-color)'}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '1.5rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: qrFile ? '#f0fdf4' : 'var(--bg-primary)',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => document.getElementById('qr-file-input')?.click()}
                    >
                      <input
                        id="qr-file-input"
                        type="file"
                        accept="image/*"
                        onChange={e => setQrFile(e.target.files?.[0] || null)}
                        style={{ display: 'none' }}
                      />
                      {qrFile ? (
                        <div style={{ color: '#16a34a', fontWeight: 500 }}>
                          <QrCode size={24} style={{ marginBottom: '0.25rem' }} />
                          <div>{qrFile.name}</div>
                          <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Click to change</div>
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-secondary)' }}>
                          <QrCode size={24} style={{ marginBottom: '0.25rem' }} />
                          <div>Click to upload QR code image</div>
                          <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>PNG, JPG accepted</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Optional Bank Details Section */}
              <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Bank size={14} /> Bank Details (Optional)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Account Holder Name</label>
                    <input placeholder="Name as per bank records" value={accName} onChange={e => setAccName(e.target.value)} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Account Number</label>
                      <input placeholder="e.g., 1234567890" value={accNum} onChange={e => setAccNum(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>IFSC Code</label>
                      <input placeholder="e.g., SBIN0001234" value={ifsc} onChange={e => setIfsc(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Uploading...' : 'Save User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// BLOCK 2: WITHDRAWAL LIST
// ==========================================
function WithdrawListBlock({ onViewStatement }: { onViewStatement: (id: string) => void }) {
  const [workers, setWorkers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [dataLoading, setDataLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const fetchWorkers = useCallback(async () => {
    setDataLoading(true);
    try {
      const res = await api.get('/client/workers');
      setWorkers(res.data);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => { fetchWorkers(); }, [fetchWorkers]);

  const handleAddPayment = async (workerId: string) => {
    const amt = parseFloat(amounts[workerId]);
    if (!amt || amt <= 0) return alert('Enter a valid amount');
    setSubmitting(workerId);
    try {
      await api.post('/client/payments', { worker_id: workerId, amount: amt });
      setAmounts(prev => ({ ...prev, [workerId]: '' }));
      alert('Payment added to queue successfully!');
    } catch { alert('Error adding payment'); } finally {
      setSubmitting(null);
    }
  };

  const filtered = workers.filter(w =>
    (w.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (w.worker_id_code || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ position: 'relative', width: '300px', marginBottom: '1rem' }}>
        <MagnifyingGlass style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-secondary)' }} />
        <input type="text" placeholder="Search users to add payments..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.5rem', width: '100%' }} />
      </div>

      {dataLoading ? (
        <TableSkeleton columns={4} rows={5} />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead><tr><th>User ID</th><th>Name</th><th>Amount to Pay</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(w => (
                <tr key={w.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{w.worker_id_code || '-'}</td>
                  <td>{w.name || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>-</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>₹</span>
                      <input
                        type="number"
                        placeholder="Enter amount"
                        value={amounts[w.id] || ''}
                        onChange={e => setAmounts(prev => ({...prev, [w.id]: e.target.value}))}
                        style={{ width: '140px' }}
                        min="1"
                      />
                      <button
                        className="btn-primary"
                        onClick={() => handleAddPayment(w.id)}
                        disabled={submitting === w.id}
                      >
                        {submitting === w.id ? 'Adding...' : 'Add to Queue'}
                      </button>
                    </div>
                  </td>
                  <td>
                    <button className="btn-secondary" style={{ padding: '0.4rem 0.6rem' }} onClick={() => onViewStatement(w.id)} title="View Statements">
                      <Files size={16} /> Statement
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} style={{textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)'}}>No active users found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==========================================
// BLOCK 3: PENDING WITHDRAWALS
// ==========================================
function PendingWithdrawalsBlock() {
  const [payments, setPayments] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]);

  const fetchPayments = useCallback(async () => {
    setDataLoading(true);
    try {
      const res = await api.get('/client/statements');
      setPayments(res.data);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const pendingAll = payments.filter(p => p.status === 'PENDING' || p.status === 'PROCESSING');

  const filtered = pendingAll.filter(p => {
    const matchDate = p.created_at.startsWith(dateStr);
    const matchStatus = filterStatus === 'ALL' || p.status === filterStatus;
    return matchDate && matchStatus;
  });

  const oldPendingExists = pendingAll.some(p => !p.created_at.startsWith(dateStr));

  const totalPendingAmount = filtered.reduce((sum: number, p: any) => sum + p.amount, 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '0.875rem' }}
          >
            <option value="ALL">All Pending</option>
            <option value="PENDING">Waiting</option>
            <option value="PROCESSING">Being Processed</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {!dataLoading && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {filtered.length} item{filtered.length !== 1 ? 's' : ''} | Total: <strong style={{ color: '#d97706' }}>₹{totalPendingAmount.toLocaleString()}</strong>
            </span>
          )}
          <button className="btn-secondary" onClick={fetchPayments} style={{ padding: '0.4rem 0.8rem' }}>
            Refresh
          </button>
        </div>
      </div>

      {!dataLoading && oldPendingExists && (
        <div style={{ background: '#fef9c3', color: '#854d0e', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <WarningCircle size={18} weight="bold" />
          There are pending withdrawals from other dates. Change the date filter to view them.
        </div>
      )}

      {dataLoading ? (
        <TableSkeleton columns={4} rows={5} />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Time</th><th>User ID / Name</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>{new Date(p.created_at).toLocaleTimeString()}</td>
                  <td>
                    <div>{p.worker?.name || '-'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{p.worker?.worker_id_code}</div>
                  </td>
                  <td style={{ fontWeight: 600, fontSize: '1rem' }}>₹{p.amount.toLocaleString()}</td>
                  <td>
                    <span style={{
                      padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 600,
                      background: p.status === 'PROCESSING' ? '#dbeafe' : '#fef3c7',
                      color: p.status === 'PROCESSING' ? '#1e40af' : '#92400e'
                    }}>
                      {p.status === 'PROCESSING' ? 'Being Processed' : 'Waiting'}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No pending transactions for this date.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==========================================
// BLOCK 4: STATISTICS & STATEMENTS
// ==========================================
function StatisticsBlock({ initialUserId, onClearUserFilter }: { initialUserId: string | null, onClearUserFilter: () => void }) {
  const [stats, setStats] = useState<any>({});
  const [statements, setStatements] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statementsLoading, setStatementsLoading] = useState(true);

  const getDefaultStartDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 5);
    return d.toISOString().split('T')[0];
  };

  const [filterUser, setFilterUser] = useState<string>(initialUserId || '');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDateStart, setFilterDateStart] = useState<string>(initialUserId ? getDefaultStartDate() : '');
  const [filterDateEnd, setFilterDateEnd] = useState<string>(initialUserId ? new Date().toISOString().split('T')[0] : '');

  const fetchGlobalStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.get('/client/statistics');
      setStats(res.data);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchWorkers = useCallback(async () => {
    const res = await api.get('/client/workers');
    setWorkers(res.data);
  }, []);

  const fetchStatements = useCallback(async () => {
    setStatementsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterUser) params.append('worker_id', filterUser);
      if (filterStatus) params.append('status', filterStatus);
      if (filterDateStart) params.append('start_date', new Date(filterDateStart).toISOString());
      if (filterDateEnd) {
        const eDate = new Date(filterDateEnd);
        eDate.setHours(23, 59, 59, 999);
        params.append('end_date', eDate.toISOString());
      }
      const res = await api.get(`/client/statements?${params.toString()}`);
      setStatements(res.data);
    } finally {
      setStatementsLoading(false);
    }
  }, [filterUser, filterStatus, filterDateStart, filterDateEnd]);

  useEffect(() => {
    fetchGlobalStats();
    fetchWorkers();
  }, [fetchGlobalStats, fetchWorkers]);

  useEffect(() => {
    fetchStatements();
  }, [fetchStatements]);

  useEffect(() => {
    if (initialUserId !== null) {
      setFilterUser(initialUserId);
      setFilterDateStart(getDefaultStartDate());
      setFilterDateEnd(new Date().toISOString().split('T')[0]);
    }
  }, [initialUserId]);

  const handleRetry = async (paymentId: string) => {
    if (!confirm('Retry this failed payment? It will return to the PENDING queue.')) return;
    try {
      await api.post(`/client/payments/${paymentId}/retry`);
      fetchStatements();
      fetchGlobalStats();
    } catch { alert('Error retrying payment'); }
  };

  const filteredTotal = statements.reduce((sum: number, tx: any) => sum + tx.amount, 0);

  return (
    <div>
      {/* Stats Cards */}
      {statsLoading ? (
        <StatCardSkeleton count={6} />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <TrendUp size={16} /> Completed
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#16a34a' }}>₹{(stats.total_withdrawal_amount || 0).toLocaleString()}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{stats.total_transactions || 0} transactions</div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <Hourglass size={16} /> Pending
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#d97706' }}>₹{(stats.pending_amount || 0).toLocaleString()}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{stats.pending_count || 0} payments waiting</div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <Clock size={16} /> Processing
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#2563eb' }}>₹{(stats.processing_amount || 0).toLocaleString()}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{stats.processing_count || 0} being handled</div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <XCircleIcon size={16} /> Failed
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#dc2626' }}>₹{(stats.failed_amount || 0).toLocaleString()}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{stats.failed_count || 0} failed</div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <Users size={16} /> Users
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{stats.active_workers || 0}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>active workers</div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <Key size={16} /> Staff
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{stats.active_staff || 0}<span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/{stats.total_staff || 0}</span></div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>active / total</div>
            </div>
          </div>

          {stats.top_pending_workers && stats.top_pending_workers.length > 0 && (
            <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', marginBottom: '2rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <WarningCircle size={16} color="#d97706" /> Top Pending Workers
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {stats.top_pending_workers.map((w: any) => (
                  <div key={w.worker_id} style={{
                    background: 'var(--bg-primary)', padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)', fontSize: '0.85rem', cursor: 'pointer'
                  }}
                  onClick={() => { setFilterUser(w.worker_id); setFilterDateStart(''); setFilterDateEnd(''); setFilterStatus('PENDING'); }}
                  >
                    <span style={{ fontWeight: 600 }}>{w.name || w.worker_id_code}</span>
                    <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                      {w.pending_count} pending | ₹{w.pending_amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Filter Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', marginTop: '1rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}><Files size={20} /> Statements</h3>
        <button className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => {
            setFilterUser(''); setFilterStatus(''); setFilterDateStart(''); setFilterDateEnd('');
            onClearUserFilter();
        }}>
            Clear Filters
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>User</label>
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '0.85rem' }}>
            <option value="">All Users</option>
            {workers.map(w => <option key={w.id} value={w.id}>{w.name || w.worker_id_code} ({w.worker_id_code || 'No ID'})</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '0.85rem' }}>
            <option value="">Any</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>From</label>
          <input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} style={{ padding: '0.45rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.85rem' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>To</label>
          <input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} style={{ padding: '0.45rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.85rem' }} />
        </div>
      </div>

      {/* Summary */}
      {!statementsLoading && statements.length > 0 && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <span>{statements.length} record{statements.length !== 1 ? 's' : ''}</span>
          <span>|</span>
          <span>Total: <strong style={{ color: 'var(--text-primary)' }}>₹{filteredTotal.toLocaleString()}</strong></span>
        </div>
      )}

      {statementsLoading ? (
        <TableSkeleton columns={6} rows={5} />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Date</th><th>User</th><th>Amount</th><th>Status</th><th>Payment Info</th><th>UTR / Comment</th></tr></thead>
            <tbody>
              {statements.map(tx => (
                <tr key={tx.id}>
                  <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{new Date(tx.created_at).toLocaleString()}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{tx.worker?.name || '-'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{tx.worker?.worker_id_code}</div>
                  </td>
                  <td style={{ fontWeight: 700, fontSize: '1rem' }}>₹{tx.amount.toLocaleString()}</td>
                  <td>
                    <span style={{
                      padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 600,
                      background: tx.status === 'COMPLETED' ? '#dcfce7' : (tx.status === 'FAILED' ? '#fee2e2' : (tx.status === 'PROCESSING' ? '#dbeafe' : '#fef3c7')),
                      color: tx.status === 'COMPLETED' ? '#166534' : (tx.status === 'FAILED' ? '#991b1b' : (tx.status === 'PROCESSING' ? '#1e40af' : '#92400e'))
                    }}>
                      {tx.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {tx.worker?.bank_account_number ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Bank size={14} /> ***{tx.worker.bank_account_number.slice(-4)}
                      </span>
                    ) : tx.worker?.qr_code_url ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <QrCode size={14} /> QR Scan
                      </span>
                    ) : 'N/A'}
                  </td>
                  <td>
                    {tx.transaction_ref_no && <div style={{ fontSize: '0.85rem' }}><strong>UTR:</strong> <span style={{ fontFamily: 'monospace' }}>{tx.transaction_ref_no}</span></div>}
                    {tx.staff_comment && <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontStyle: 'italic' }}>"{tx.staff_comment}"</div>}

                    {tx.status === 'FAILED' && (
                      <button className="btn-secondary" style={{ marginTop: '0.4rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => handleRetry(tx.id)}>
                        <ArrowCounterClockwise size={14} /> Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {statements.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No statements match your filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==========================================
// BLOCK 5: ADMIN PANEL (STAFF MANAGEMENT)
// ==========================================
function AdminPanelBlock() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const fetchStaff = useCallback(async () => {
    setDataLoading(true);
    try {
      const res = await api.get('/client/staff');
      setStaffList(res.data);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/client/staff', { username, password });
      alert('Staff account created successfully!');
      setUsername(''); setPassword('');
      fetchStaff();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error creating staff');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this staff member?`)) return;
    try {
      await api.put(`/client/staff/${id}/toggle`);
      fetchStaff();
    } catch { alert('Error toggling staff status'); }
  };

  const handleResetPassword = async (id: string) => {
    const newPw = prompt("Enter new password for this staff member:");
    if (!newPw) return;
    try {
      await api.put(`/client/staff/${id}/reset-password`, { new_password: newPw });
      alert("Password reset successfully!");
    } catch { alert('Error resetting password'); }
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 400px) 1fr', gap: '2rem' }}>

        <div style={{ background: 'var(--bg-secondary)', padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>Onboard Staff Member</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            Create login credentials for your outsourcing team so they can process payments.
          </p>
          <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Staff Login Username</label>
              <input required type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g., staff_john" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Password</label>
              <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a strong password" />
            </div>
            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
              {loading ? 'Creating...' : 'Create Staff Account'}
            </button>
          </form>
        </div>

        <div>
          <h3 style={{ marginBottom: '1rem' }}>Manage Existing Staff</h3>
          {dataLoading ? (
            <TableSkeleton columns={4} rows={3} />
          ) : (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Username</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {staffList.map(staff => (
                    <tr key={staff.id}>
                      <td style={{ fontWeight: 600 }}>{staff.username}</td>
                      <td>
                        <span style={{
                            padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 600,
                            background: staff.is_active ? '#dcfce7' : '#fee2e2',
                            color: staff.is_active ? '#166534' : '#991b1b'
                         }}>
                            {staff.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {new Date(staff.created_at).toLocaleDateString()}
                      </td>
                      <td>
                         <div style={{ display: 'flex', gap: '0.5rem' }}>
                             <button className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handleToggleActive(staff.id, staff.is_active)}>
                                 {staff.is_active ? 'Deactivate' : 'Activate'}
                             </button>
                             <button className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--accent-color)' }} onClick={() => handleResetPassword(staff.id)}>
                                 Reset Password
                             </button>
                         </div>
                      </td>
                    </tr>
                  ))}
                  {staffList.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>No staff enrolled yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
