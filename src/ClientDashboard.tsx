import { useState, useEffect, useCallback } from 'react';
import {
  Plus, CurrencyInr, User as UserIcon, Trash,
  Files, Clock, ChartBar, Key, MagnifyingGlass, ArrowCounterClockwise,
  Bank, QrCode, Eye, WarningCircle, Users, TrendUp, Hourglass, XCircle as XCircleIcon,
  PencilSimple, FloppyDisk, Wallet, CaretDown, CaretUp, UserPlus
} from '@phosphor-icons/react';
import api from './api';

function timeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 0) return 'just now';
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

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
          { key: 'admin', icon: <Key size={18} />, label: 'Staff Management' },
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
  const [editBankName, setEditBankName] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Create form
  const [name, setName] = useState('');
  const [userIdCode, setUserIdCode] = useState('');
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [accNum, setAccNum] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accName, setAccName] = useState('');
  const [bankName, setBankName] = useState('');

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
    setEditBankName(w.bank_name || '');
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
        bank_name: editBankName || null,
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
        bank_account_name: accName || null,
        bank_name: bankName || null
      });

      setShowAdd(false);
      setName(''); setUserIdCode(''); setQrFile(null); setAccNum(''); setIfsc(''); setAccName(''); setBankName('');
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
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <MagnifyingGlass style={{ position: 'absolute', left: 14, top: 14, color: 'var(--text-secondary)' }} size={18} />
          <input type="text" className="big-search" placeholder="Search by name or User ID..." value={search} onChange={e => setSearch(e.target.value)} />
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
                  <td><span className="user-id-highlight">{w.worker_id_code || '-'}</span></td>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Full Name</div>
                  <div style={{ fontWeight: 600 }}>{viewWorker.name || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Not set</span>}</div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>User ID</div>
                  <div className="user-id-highlight">{viewWorker.worker_id_code || '-'}</div>
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
                      {viewWorker.bank_name && (
                        <div className="bank-detail-item">
                          <span className="bank-detail-label">Bank Name</span>
                          <span className="bank-detail-value">{viewWorker.bank_name}</span>
                        </div>
                      )}
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
                      <label>Bank Name</label>
                      <input placeholder="e.g., State Bank of India" value={editBankName} onChange={e => setEditBankName(e.target.value)} />
                    </div>
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

              <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Bank size={14} /> Bank Details (Optional)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Bank Name</label>
                    <input placeholder="e.g., State Bank of India" value={bankName} onChange={e => setBankName(e.target.value)} />
                  </div>
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
// BLOCK 2: WITHDRAWAL LIST (with duplicate prevention)
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
      const res = await api.get('/client/workers-with-status');
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
      fetchWorkers(); // refresh to update has_active_payment status
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error adding payment');
    } finally {
      setSubmitting(null);
    }
  };

  const filtered = workers.filter(w =>
    (w.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (w.worker_id_code || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ position: 'relative', maxWidth: '400px', marginBottom: '1rem' }}>
        <MagnifyingGlass style={{ position: 'absolute', left: 14, top: 14, color: 'var(--text-secondary)' }} size={18} />
        <input type="text" className="big-search" placeholder="Search users to add payments..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {dataLoading ? (
        <TableSkeleton columns={4} rows={5} />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead><tr><th>User ID</th><th>Name</th><th>Amount to Pay</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(w => (
                <tr key={w.id} style={{ opacity: w.has_active_payment ? 0.6 : 1 }}>
                  <td><span className="user-id-highlight">{w.worker_id_code || '-'}</span></td>
                  <td>{w.name || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>-</span>}</td>
                  <td>
                    {w.has_active_payment ? (
                      <span style={{ fontSize: '0.85rem', color: '#d97706', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Clock size={16} /> Payment already in queue
                      </span>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>₹</span>
                        <input
                          type="number"
                          placeholder="Enter amount"
                          value={amounts[w.id] || ''}
                          onChange={e => setAmounts(prev => ({...prev, [w.id]: e.target.value}))}
                          style={{ width: '140px', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}
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
                    )}
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
// BLOCK 3: PENDING WITHDRAWALS (with delete + relative time)
// ==========================================
function PendingWithdrawalsBlock() {
  const [payments, setPayments] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

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
    return filterStatus === 'ALL' || p.status === filterStatus;
  });

  const totalPendingAmount = filtered.reduce((sum: number, p: any) => sum + p.amount, 0);

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Delete this pending payment? This cannot be undone.')) return;
    try {
      await api.delete(`/client/payments/${paymentId}`);
      fetchPayments();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error deleting payment');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
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

      {dataLoading ? (
        <TableSkeleton columns={5} rows={5} />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Added</th><th>User ID / Name</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{timeAgo(p.created_at)}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(p.created_at).toLocaleString()}</div>
                  </td>
                  <td>
                    <div className="user-id-highlight">{p.worker?.worker_id_code || '-'}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{p.worker?.name || '-'}</div>
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
                  <td>
                    {p.status === 'PENDING' && (
                      <button
                        className="btn-secondary"
                        style={{ padding: '0.4rem 0.6rem', color: '#dc2626', fontSize: '0.8rem' }}
                        onClick={() => handleDeletePayment(p.id)}
                        title="Delete this pending payment"
                      >
                        <Trash size={14} /> Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No pending transactions.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==========================================
// BLOCK 4: STATISTICS & STATEMENTS (with staff filter, deposit tracking)
// ==========================================
function StatisticsBlock({ initialUserId, onClearUserFilter }: { initialUserId: string | null, onClearUserFilter: () => void }) {
  const [stats, setStats] = useState<any>({});
  const [statements, setStatements] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statementsLoading, setStatementsLoading] = useState(true);

  const getDefaultStartDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 5);
    return d.toISOString().split('T')[0];
  };

  const [filterUser, setFilterUser] = useState<string>(initialUserId || '');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterStaff, setFilterStaff] = useState<string>('');
  const [filterDateStart, setFilterDateStart] = useState<string>(initialUserId ? getDefaultStartDate() : '');
  const [filterDateEnd, setFilterDateEnd] = useState<string>(initialUserId ? new Date().toISOString().split('T')[0] : '');

  const fetchGlobalStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStaff) params.append('staff_id', filterStaff);
      if (filterDateStart) params.append('start_date', new Date(filterDateStart).toISOString());
      if (filterDateEnd) {
        const eDate = new Date(filterDateEnd);
        eDate.setHours(23, 59, 59, 999);
        params.append('end_date', eDate.toISOString());
      }
      const res = await api.get(`/client/statistics?${params.toString()}`);
      setStats(res.data);
    } finally {
      setStatsLoading(false);
    }
  }, [filterStaff, filterDateStart, filterDateEnd]);

  const fetchWorkers = useCallback(async () => {
    const res = await api.get('/client/workers');
    setWorkers(res.data);
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await api.get('/client/staff');
      setStaffList(res.data);
    } catch {}
  }, []);

  const fetchStatements = useCallback(async () => {
    setStatementsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterUser) params.append('worker_id', filterUser);
      if (filterStatus) params.append('status', filterStatus);
      if (filterStaff) params.append('staff_id', filterStaff);
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
  }, [filterUser, filterStatus, filterStaff, filterDateStart, filterDateEnd]);

  useEffect(() => {
    fetchGlobalStats();
    fetchWorkers();
    fetchStaff();
  }, [fetchGlobalStats, fetchWorkers, fetchStaff]);

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
      {/* Overview cards */}
      {statsLoading ? (
        <StatCardSkeleton count={8} />
      ) : (
        <>
          {/* Deposit overview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', color: 'white' }}>
              <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Wallet size={16} /> Total Deposited to Staff
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>₹{(stats.total_deposited || 0).toLocaleString()}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', color: 'white' }}>
              <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <TrendUp size={16} /> Total Withdrawn (Completed)
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>₹{(stats.total_withdrawal_amount || 0).toLocaleString()}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '0.25rem' }}>{stats.total_transactions || 0} transactions</div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Wallet size={16} /> Remaining Staff Balance
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent-color)' }}>₹{(stats.total_staff_balance || 0).toLocaleString()}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <Hourglass size={16} /> Pending
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#d97706' }}>₹{(stats.pending_amount || 0).toLocaleString()}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{stats.pending_count || 0} waiting</div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <Clock size={16} /> Processing
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2563eb' }}>₹{(stats.processing_amount || 0).toLocaleString()}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{stats.processing_count || 0} active</div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <XCircleIcon size={16} /> Failed
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626' }}>₹{(stats.failed_amount || 0).toLocaleString()}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{stats.failed_count || 0} failed</div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <Users size={16} /> Users
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.active_workers || 0}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>active</div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <Key size={16} /> Staff
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.active_staff || 0}<span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/{stats.total_staff || 0}</span></div>
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
                    <span className="user-id-highlight" style={{ fontSize: '0.85rem' }}>{w.worker_id_code || w.name}</span>
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
            setFilterUser(''); setFilterStatus(''); setFilterStaff(''); setFilterDateStart(''); setFilterDateEnd('');
            onClearUserFilter();
        }}>
            Clear Filters
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>User</label>
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '0.85rem' }}>
            <option value="">All Users</option>
            {workers.map(w => <option key={w.id} value={w.id}>{w.worker_id_code || w.name} ({w.name || 'No Name'})</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Staff</label>
          <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '0.85rem' }}>
            <option value="">All Staff</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.username}</option>)}
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
            <thead><tr><th>Date</th><th>User</th><th>Amount</th><th>Status</th><th>Processed By</th><th>UTR / Comment</th></tr></thead>
            <tbody>
              {statements.map(tx => (
                <tr key={tx.id}>
                  <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    <div>{timeAgo(tx.created_at)}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{new Date(tx.created_at).toLocaleString()}</div>
                  </td>
                  <td>
                    <div className="user-id-highlight">{tx.worker?.worker_id_code || '-'}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{tx.worker?.name}</div>
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
                  <td style={{ fontSize: '0.85rem' }}>
                    {tx.locked_by_staff ? (
                      <div>
                        <div style={{ fontWeight: 600 }}>{tx.locked_by_staff.username}</div>
                        {tx.completed_at && (
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                            {new Date(tx.completed_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>-</span>
                    )}
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
// BLOCK 5: ADMIN PANEL (STAFF MANAGEMENT + Balance)
// ==========================================
function AdminPanelBlock() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [scope, setScope] = useState('own_client');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [balanceAmounts, setBalanceAmounts] = useState<Record<string, string>>({});
  const [balanceNotes, setBalanceNotes] = useState<Record<string, string>>({});
  const [addingBalance, setAddingBalance] = useState<string | null>(null);
  const [staffHistory, setStaffHistory] = useState<Record<string, any[]>>({});
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [showAddStaffForm, setShowAddStaffForm] = useState(false);

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
      await api.post('/client/staff', { username, password, scope });
      alert('Staff account created successfully!');
      setUsername(''); setPassword(''); setScope('own_client');
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

  const handleAddBalance = async (staffId: string) => {
    const amt = parseFloat(balanceAmounts[staffId]);
    if (!amt || amt <= 0) return alert('Enter a valid amount');
    setAddingBalance(staffId);
    try {
      await api.post(`/client/staff/${staffId}/add-balance`, {
        staff_id: staffId,
        amount: amt,
        note: balanceNotes[staffId] || null
      });
      setBalanceAmounts(prev => ({ ...prev, [staffId]: '' }));
      setBalanceNotes(prev => ({ ...prev, [staffId]: '' }));
      fetchStaff();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error adding balance');
    } finally {
      setAddingBalance(null);
    }
  };

  const handleViewHistory = async (staffId: string) => {
    if (showHistory === staffId) {
      setShowHistory(null);
      return;
    }
    try {
      const res = await api.get(`/client/staff/${staffId}/full-history`);
      setStaffHistory(prev => ({ ...prev, [staffId]: res.data }));
      setShowHistory(staffId);
    } catch { alert('Error fetching staff history'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>Manage Staff</h3>
        <button className="btn-primary" onClick={() => setShowAddStaffForm(!showAddStaffForm)}>
          <UserPlus size={16} /> {showAddStaffForm ? 'Hide Form' : 'Add Staff'}
        </button>
      </div>

      {showAddStaffForm && (
        <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem' }}>
          <form onSubmit={handleCreateStaff} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '180px' }}>
              <label>Staff Login Username</label>
              <input required type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g., staff_john" />
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '180px' }}>
              <label>Password</label>
              <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a strong password" />
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '180px' }}>
              <label>Withdrawal Access</label>
              <select value={scope} onChange={e => setScope(e.target.value)} style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.9rem', width: '100%' }}>
                <option value="own_client">This Client Only</option>
                <option value="all">All Clients</option>
              </select>
            </div>
            <button type="submit" className="btn-primary" disabled={loading} style={{ height: '42px' }}>
              {loading ? 'Creating...' : 'Create Staff Account'}
            </button>
          </form>
        </div>
      )}

      <div>
          {dataLoading ? (
            <TableSkeleton columns={6} rows={3} />
          ) : (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Username</th><th>Status</th><th>Access</th><th>Balance</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {staffList.map(staff => (
                    <>
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
                        <td>
                          <span style={{
                              padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 600,
                              background: staff.staff_scope === 'all' ? '#dbeafe' : '#f3e8ff',
                              color: staff.staff_scope === 'all' ? '#1e40af' : '#7c3aed'
                           }}>
                              {staff.staff_scope === 'all' ? 'All Clients' : 'This Client'}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: (staff.available_balance || 0) > 0 ? '#16a34a' : '#dc2626', fontSize: '1.05rem' }}>
                            ₹{(staff.available_balance || 0).toLocaleString()}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {timeAgo(staff.created_at)}
                        </td>
                        <td>
                           <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                               <button className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handleToggleActive(staff.id, staff.is_active)}>
                                   {staff.is_active ? 'Deactivate' : 'Activate'}
                               </button>
                               <button className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--accent-color)' }} onClick={() => handleResetPassword(staff.id)}>
                                   Reset Password
                               </button>
                               <button className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handleViewHistory(staff.id)}>
                                   {showHistory === staff.id ? <CaretUp size={14} /> : <CaretDown size={14} />} History
                               </button>
                           </div>
                        </td>
                      </tr>
                      {/* Add balance row */}
                      <tr key={`${staff.id}-balance`}>
                        <td colSpan={6} style={{ background: 'var(--bg-secondary)', padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <Wallet size={16} color="var(--accent-color)" />
                            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Add Balance:</span>
                            <input
                              type="number"
                              placeholder="Amount"
                              value={balanceAmounts[staff.id] || ''}
                              onChange={e => setBalanceAmounts(prev => ({...prev, [staff.id]: e.target.value}))}
                              style={{ width: '120px', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                              min="1"
                            />
                            <input
                              type="text"
                              placeholder="Note (optional)"
                              value={balanceNotes[staff.id] || ''}
                              onChange={e => setBalanceNotes(prev => ({...prev, [staff.id]: e.target.value}))}
                              style={{ width: '160px', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                            />
                            <button className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => handleAddBalance(staff.id)} disabled={addingBalance === staff.id}>
                              <Plus size={14} /> {addingBalance === staff.id ? 'Adding...' : 'Add'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Full history (deposits + payments) */}
                      {showHistory === staff.id && staffHistory[staff.id] && (
                        <tr key={`${staff.id}-history`}>
                          <td colSpan={6} style={{ padding: '0.75rem 1rem', background: 'var(--bg-tertiary)' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Transaction History (Bank Statement)</div>
                            {staffHistory[staff.id].length === 0 ? (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.5rem 0' }}>No history yet.</div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {staffHistory[staff.id].map((entry: any, idx: number) => {
                                  const isDeposit = entry.type === 'deposit';
                                  const entryTime = entry.completed_at || entry.created_at;
                                  return (
                                    <div key={idx} style={{
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                      fontSize: '0.8rem', padding: '0.5rem 0.25rem', borderBottom: '1px solid var(--border-color)',
                                      gap: '0.5rem', flexWrap: 'wrap'
                                    }}>
                                      <span style={{
                                        color: isDeposit ? '#16a34a' : '#dc2626',
                                        fontWeight: 700, minWidth: '100px'
                                      }}>
                                        {isDeposit ? '+' : '-'}₹{entry.amount.toLocaleString()}
                                      </span>
                                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', minWidth: '80px' }}>
                                        {isDeposit ? 'Deposit' : `Payment${entry.status === 'FAILED' ? ' (Failed)' : ''}`}
                                      </span>
                                      {entry.deposited_by && (
                                        <span style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: '#dbeafe', color: '#1e40af' }}>
                                          {isDeposit ? 'by' : 'from'} {entry.deposited_by}
                                        </span>
                                      )}
                                      {entry.worker_id_code && (
                                        <span className="user-id-highlight" style={{ fontSize: '0.75rem' }}>{entry.worker_id_code}</span>
                                      )}
                                      {entry.balance_after !== null && (
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                          Bal: ₹{entry.balance_after.toLocaleString()}
                                        </span>
                                      )}
                                      {entry.note && <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.75rem' }}>{entry.note}</span>}
                                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginLeft: 'auto' }}>
                                        {new Date(entryTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {staffList.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>No staff enrolled yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </div>
  );
}
