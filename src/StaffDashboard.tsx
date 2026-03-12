import { useState, useEffect, useCallback } from 'react';
import {
  LockKey, CheckCircle, Clock, XCircle, ArrowLeft,
  MagnifyingGlass, ChartBar, CurrencyInr, TrendUp, Wallet
} from '@phosphor-icons/react';
import api from './api';

function timeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

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

export default function StaffDashboard() {
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [payments, setPayments] = useState<any[]>([]);
  const [processingPayment, setProcessingPayment] = useState<any | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [balance, setBalance] = useState<number>(0);

  const [utr, setUtr] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQueue, setSearchQueue] = useState('');

  const fetchPayments = useCallback(async () => {
    try {
      const res = await api.get('/staff/payments/pending');
      setPayments(res.data);

      const locked = res.data.find((p: any) => p.status === 'PROCESSING');
      if (locked) setProcessingPayment(locked);
    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await api.get('/staff/my-balance');
      setBalance(res.data.available_balance);
    } catch {}
  }, []);

  useEffect(() => {
    fetchPayments();
    fetchBalance();
    const interval = setInterval(() => { fetchPayments(); fetchBalance(); }, 10000);
    return () => clearInterval(interval);
  }, [fetchPayments, fetchBalance]);

  const handleLockPayment = async (paymentId: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post(`/staff/payments/${paymentId}/lock`);
      setProcessingPayment(res.data);
      setUtr(''); setComment('');
      fetchPayments();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Someone else already grabbed this payment.');
      fetchPayments();
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseLock = async () => {
    if (!processingPayment) return;
    setLoading(true);
    try {
      await api.post(`/staff/payments/${processingPayment.id}/release`);
      setProcessingPayment(null);
      fetchPayments();
    } catch {
      alert('Failed to release lock');
    } finally {
      setLoading(false);
    }
  };

  const handleFailPayment = async () => {
    if (!processingPayment) return;
    if (!comment) return alert('Please provide a comment explaining why this failed.');

    setLoading(true);
    try {
      await api.post(`/staff/payments/${processingPayment.id}/fail`, { staff_comment: comment });
      setProcessingPayment(null);
      fetchPayments();
      fetchBalance();
    } catch {
      alert('Error failing payment');
    } finally {
      setLoading(false);
    }
  };

  const handleCompletePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processingPayment) return;

    setLoading(true);
    setError('');
    try {
      await api.post(`/staff/payments/${processingPayment.id}/complete`, {
        transaction_ref_no: utr,
        staff_comment: comment || null
      });
      setProcessingPayment(null);
      fetchPayments();
      fetchBalance();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to complete payment.');
    } finally {
      setLoading(false);
    }
  };

  // Processing view
  if (processingPayment) {
    const worker = processingPayment.worker;
    return (
      <div style={{ padding: '2rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LockKey weight="bold" /> Processing Locked
          </h2>
          <button className="btn-secondary" onClick={handleReleaseLock} disabled={loading} style={{ border: '1px solid var(--border-color)' }}>
            <ArrowLeft /> Go Back & Release Lock
          </button>
        </div>

        {error && <div style={{ color: '#dc2626', marginBottom: '1rem', padding: '1rem', background: '#fee2e2', borderRadius: '4px' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
          {/* Details Column - BIGGER user id and bank details */}
          <div style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              Target Details
            </h3>
            <p style={{ fontSize: '2.5rem', fontWeight: 700, color: '#16a34a', marginBottom: '1.5rem' }}>
              ₹{processingPayment.amount.toLocaleString()}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div><strong>Name:</strong> <span style={{ fontSize: '1.1rem' }}>{worker?.name}</span></div>
              {worker?.worker_id_code && (
                <div>
                  <strong>User ID:</strong>{' '}
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.4rem', color: 'var(--accent-color)', letterSpacing: '1px' }}>
                    {worker?.worker_id_code}
                  </span>
                </div>
              )}
              {worker?.bank_account_number && (
                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '8px', marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Bank Account Number</div>
                  <div style={{ fontWeight: 700, letterSpacing: '2px', fontFamily: 'monospace', fontSize: '1.4rem' }}>{worker.bank_account_number}</div>
                  <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem' }}>
                    <div>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>IFSC: </span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '1.1rem' }}>{worker.bank_ifsc}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Name: </span>
                      <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{worker.bank_account_name}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* QR Column */}
          {worker?.qr_code_url && (
            <div style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Scan to Pay</div>
              <img src={worker.qr_code_url} alt="QR Code" style={{ maxWidth: '100%', maxHeight: '250px', objectFit: 'contain' }} />
            </div>
          )}
        </div>

        <form onSubmit={handleCompletePayment} style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Finalize Action</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label>Transaction UTR / Reference Number</label>
              <input
                type="text"
                placeholder="Required for Success"
                value={utr}
                onChange={e => setUtr(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Optional Comment / Reason for Failure</label>
              <input
                type="text"
                placeholder="Required if Failing"
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="button" className="btn-secondary" disabled={loading} onClick={handleFailPayment} style={{ color: '#dc2626', borderColor: '#fca5a5' }}>
              <XCircle size={18} weight="bold" />
              Mark as Failed
            </button>
            <button type="submit" className="btn-primary" disabled={loading} style={{ background: '#16a34a', flex: 1 }}>
              <CheckCircle size={18} weight="bold" />
              {loading ? 'Processing...' : 'Confirm Payment Sent (Requires UTR)'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  const pendingPayments = payments.filter(p => p.status === 'PENDING');
  const filteredPending = searchQueue
    ? pendingPayments.filter(p =>
        (p.worker?.worker_id_code || '').toLowerCase().includes(searchQueue.toLowerCase()) ||
        (p.worker?.name || '').toLowerCase().includes(searchQueue.toLowerCase())
      )
    : pendingPayments;

  return (
    <div>
      {/* Balance display */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ background: 'var(--bg-secondary)', padding: '1rem 1.5rem', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Wallet size={22} color="var(--accent-color)" />
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Available Balance</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: balance > 0 ? '#16a34a' : '#dc2626' }}>₹{balance.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Tab buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          className={activeTab === 'queue' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('queue')}
        >
          <CurrencyInr size={18} /> Pending Queue
        </button>
        <button
          className={activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('history')}
        >
          <ChartBar size={18} /> My Transactions
        </button>
      </div>

      {activeTab === 'queue' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
              <MagnifyingGlass style={{ position: 'absolute', left: 14, top: 14, color: 'var(--text-secondary)' }} size={18} />
              <input
                type="text"
                className="big-search"
                placeholder="Search by User ID or name..."
                value={searchQueue}
                onChange={e => setSearchQueue(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {!dataLoading && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{filteredPending.length} payment{filteredPending.length !== 1 ? 's' : ''} waiting</span>}
              <button className="btn-secondary" onClick={fetchPayments}>Refresh Queue</button>
            </div>
          </div>

          {error && <div style={{ color: '#dc2626', marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fee2e2', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>{error}</div>}

          {dataLoading ? (
            <TableSkeleton columns={5} rows={5} />
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Status / ID</th>
                    <th>Target</th>
                    <th>Amount</th>
                    <th>Added</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPending.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="btn-icon" style={{ backgroundColor: 'var(--bg-tertiary)', border: 'none', width: 28, height: 28 }}>
                            <Clock size={14} weight="bold" />
                          </div>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{payment.id.split('-')[0]}</span>
                        </div>
                      </td>
                      <td>
                        <div className="user-id-highlight">{payment.worker?.worker_id_code || '-'}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{payment.worker?.name}</div>
                      </td>
                      <td style={{ fontWeight: 700, fontSize: '1.1rem' }}>₹{payment.amount.toLocaleString()}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{timeAgo(payment.created_at)}</td>
                      <td>
                        <button
                          className="btn-primary"
                          onClick={() => handleLockPayment(payment.id)}
                          disabled={loading}
                          style={{ background: 'var(--accent-color)' }}
                        >
                          <LockKey size={16} weight="bold" />
                          Proceed to Pay
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredPending.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        {searchQueue ? 'No payments match your search.' : 'There are no pending payments in the queue!'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && <StaffTransactionHistory />}
    </div>
  );
}


// ==========================================
// Staff Transaction History with stats
// ==========================================
function StaffTransactionHistory() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  const getDefaultStart = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(getDefaultStart());
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchUser, setSearchUser] = useState('');

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', new Date(startDate).toISOString());
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        params.append('end_date', eDate.toISOString());
      }
      if (filterStatus) params.append('status', filterStatus);
      if (searchUser) params.append('search', searchUser);
      const res = await api.get(`/staff/my-transactions?${params.toString()}`);
      setTransactions(res.data);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filterStatus, searchUser]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', new Date(startDate).toISOString());
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        params.append('end_date', eDate.toISOString());
      }
      const res = await api.get(`/staff/my-stats?${params.toString()}`);
      setStats(res.data);
    } finally {
      setStatsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const filteredTotal = transactions.reduce((sum: number, t: any) => sum + t.amount, 0);

  return (
    <div>
      {/* Stats cards */}
      {!statsLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
              <TrendUp size={14} /> Completed
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#16a34a' }}>₹{(stats.completed_amount || 0).toLocaleString()}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{stats.completed_count || 0} payments</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
              <XCircle size={14} /> Failed
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626' }}>₹{(stats.failed_amount || 0).toLocaleString()}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{stats.failed_count || 0} payments</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
              <Wallet size={14} /> Balance
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-color)' }}>₹{(stats.available_balance || 0).toLocaleString()}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>available</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Search User ID</label>
          <input
            type="text"
            placeholder="User ID or name"
            value={searchUser}
            onChange={e => setSearchUser(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '0.85rem' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '0.85rem' }}>
            <option value="">All</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '0.45rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.85rem' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '0.45rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.85rem' }} />
        </div>
      </div>

      {/* Summary */}
      {!loading && transactions.length > 0 && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <span>{transactions.length} record{transactions.length !== 1 ? 's' : ''}</span>
          <span>|</span>
          <span>Total: <strong style={{ color: 'var(--text-primary)' }}>₹{filteredTotal.toLocaleString()}</strong></span>
        </div>
      )}

      {loading ? (
        <TableSkeleton columns={5} rows={5} />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>User</th>
                <th>Amount</th>
                <th>Status</th>
                <th>UTR / Comment</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id}>
                  <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    <div>{new Date(tx.completed_at || tx.created_at).toLocaleDateString()}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{timeAgo(tx.completed_at || tx.created_at)}</div>
                  </td>
                  <td>
                    <div className="user-id-highlight">{tx.worker?.worker_id_code || '-'}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{tx.worker?.name}</div>
                  </td>
                  <td style={{ fontWeight: 700, fontSize: '1rem' }}>₹{tx.amount.toLocaleString()}</td>
                  <td>
                    <span style={{
                      padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 600,
                      background: tx.status === 'COMPLETED' ? '#dcfce7' : '#fee2e2',
                      color: tx.status === 'COMPLETED' ? '#166534' : '#991b1b'
                    }}>
                      {tx.status}
                    </span>
                  </td>
                  <td>
                    {tx.transaction_ref_no && <div style={{ fontSize: '0.85rem' }}><strong>UTR:</strong> <span style={{ fontFamily: 'monospace' }}>{tx.transaction_ref_no}</span></div>}
                    {tx.staff_comment && <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontStyle: 'italic' }}>"{tx.staff_comment}"</div>}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No transactions found for this period.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
