import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LockKey, CheckCircle, XCircle, ArrowLeft,
  MagnifyingGlass, ChartBar, CurrencyInr, TrendUp,
  CaretUp, CaretDown, ArrowsDownUp
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

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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

  // Sorting state for pending table
  const [sortField, setSortField] = useState<'amount' | 'created_at' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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

  // ---- Processing view (mobile-first) ----
  if (processingPayment) {
    const worker = processingPayment.worker;
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1.1rem' }}>
            <LockKey weight="bold" size={20} /> Payment Locked
          </h2>
          <button className="btn-secondary" onClick={handleReleaseLock} disabled={loading} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
            <ArrowLeft size={16} /> Release
          </button>
        </div>

        {error && <div style={{ color: '#dc2626', marginBottom: '1rem', padding: '0.75rem', background: '#fee2e2', borderRadius: '8px', fontSize: '0.85rem' }}>{error}</div>}

        {/* QR Code - PROMINENT on top for mobile */}
        {worker?.qr_code_url && (
          <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-lg)', marginBottom: '1rem', textAlign: 'center' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>Scan to Pay</div>
            <img src={worker.qr_code_url} alt="QR Code" style={{ maxWidth: '280px', width: '100%', objectFit: 'contain', borderRadius: '8px' }} />
          </div>
        )}

        {/* Amount + User ID - BIG and clear */}
        <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', marginBottom: '1rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Amount to Pay</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#16a34a' }}>₹{processingPayment.amount.toLocaleString()}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>User ID</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.3rem', color: 'var(--accent-color)', wordBreak: 'break-all' }}>
                {worker?.worker_id_code || '-'}
              </div>
            </div>
            <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Name</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{worker?.name || '-'}</div>
            </div>
          </div>
        </div>

        {/* Bank details */}
        {worker?.bank_account_number && (
          <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-lg)', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Bank Details</div>
            <div style={{ fontWeight: 700, letterSpacing: '2px', fontFamily: 'monospace', fontSize: '1.3rem', marginBottom: '0.5rem', wordBreak: 'break-all' }}>{worker.bank_account_number}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>IFSC: </span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{worker.bank_ifsc || '-'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Name: </span>
                <span style={{ fontWeight: 600 }}>{worker.bank_account_name || '-'}</span>
              </div>
            </div>
            {worker.bank_name && (
              <div style={{ marginTop: '0.4rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Bank: </span>
                <span style={{ fontWeight: 600 }}>{worker.bank_name}</span>
              </div>
            )}
          </div>
        )}

        {/* UTR + Comment form */}
        <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.85rem' }}>Transaction UTR / Reference *</label>
              <input
                type="text"
                placeholder="Enter UTR after payment"
                value={utr}
                onChange={e => setUtr(e.target.value)}
                style={{ fontSize: '1rem', padding: '0.75rem' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.85rem' }}>Comment (required if failing)</label>
              <input
                type="text"
                placeholder="Optional comment"
                value={comment}
                onChange={e => setComment(e.target.value)}
                style={{ fontSize: '1rem', padding: '0.75rem' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              className="btn-primary"
              disabled={loading || !utr}
              onClick={handleCompletePayment as any}
              style={{ background: '#16a34a', justifyContent: 'center', padding: '0.875rem', width: '100%', fontSize: '1rem' }}
            >
              <CheckCircle size={20} weight="bold" />
              {loading ? 'Processing...' : 'Confirm Payment Sent'}
            </button>
            <button
              className="btn-secondary"
              disabled={loading}
              onClick={handleFailPayment}
              style={{ color: '#dc2626', borderColor: '#fca5a5', justifyContent: 'center', padding: '0.75rem', width: '100%' }}
            >
              <XCircle size={18} weight="bold" />
              Mark as Failed
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Queue view ----
  const pendingPayments = payments.filter(p => p.status === 'PENDING');
  const filteredPending = searchQueue
    ? pendingPayments.filter(p =>
        (p.worker?.worker_id_code || '').toLowerCase().includes(searchQueue.toLowerCase()) ||
        (p.worker?.name || '').toLowerCase().includes(searchQueue.toLowerCase())
      )
    : pendingPayments;

  // Sorting
  const sortedPending = useMemo(() => {
    if (!sortField) return filteredPending;
    return [...filteredPending].sort((a, b) => {
      let valA: any, valB: any;
      if (sortField === 'amount') {
        valA = a.amount;
        valB = b.amount;
      } else {
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      }
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });
  }, [filteredPending, sortField, sortDir]);

  const handleSort = (field: 'amount' | 'created_at') => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const totalPendingAmount = pendingPayments.reduce((s: number, p: any) => s + p.amount, 0);

  return (
    <div>
      {/* Stats bar - compact for mobile */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Balance</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: balance > 0 ? '#16a34a' : '#dc2626' }}>₹{balance.toLocaleString()}</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Pending</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#d97706' }}>₹{totalPendingAmount.toLocaleString()}</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Queue</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{pendingPayments.length}</div>
        </div>
      </div>

      {/* Tab buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          className={activeTab === 'queue' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('queue')}
          style={{ flex: 1, justifyContent: 'center' }}
        >
          <CurrencyInr size={16} /> Queue
        </button>
        <button
          className={activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('history')}
          style={{ flex: 1, justifyContent: 'center' }}
        >
          <ChartBar size={16} /> My Transactions
        </button>
      </div>

      {activeTab === 'queue' && (
        <>
          {/* Search + refresh */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <MagnifyingGlass style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-secondary)' }} size={16} />
              <input
                type="text"
                className="big-search"
                placeholder="Search User ID or name..."
                value={searchQueue}
                onChange={e => setSearchQueue(e.target.value)}
                style={{ minWidth: 'unset' }}
              />
            </div>
            <button className="btn-secondary" onClick={fetchPayments} style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>Refresh</button>
          </div>

          {error && <div style={{ color: '#dc2626', marginBottom: '0.75rem', padding: '0.6rem 0.75rem', background: '#fee2e2', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>{error}</div>}

          {dataLoading ? (
            <TableSkeleton columns={4} rows={5} />
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th onClick={() => handleSort('amount')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        Amount {sortField === 'amount' && (sortDir === 'asc' ? <CaretUp size={12} /> : <CaretDown size={12} />)}
                        {sortField !== 'amount' && <ArrowsDownUp size={12} style={{ opacity: 0.4 }} />}
                      </span>
                    </th>
                    <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        Added {sortField === 'created_at' && (sortDir === 'asc' ? <CaretUp size={12} /> : <CaretDown size={12} />)}
                        {sortField !== 'created_at' && <ArrowsDownUp size={12} style={{ opacity: 0.4 }} />}
                      </span>
                    </th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPending.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <div className="user-id-highlight">{payment.worker?.worker_id_code || '-'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{payment.worker?.name}</div>
                      </td>
                      <td style={{ fontWeight: 700, fontSize: '1.05rem' }}>₹{payment.amount.toLocaleString()}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{timeAgo(payment.created_at)}</td>
                      <td>
                        <button
                          className="btn-primary"
                          onClick={() => handleLockPayment(payment.id)}
                          disabled={loading}
                          style={{ background: 'var(--accent-color)', fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                        >
                          <LockKey size={14} weight="bold" />
                          Pay
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sortedPending.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)' }}>
                        {searchQueue ? 'No payments match your search.' : 'No pending payments in the queue.'}
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
      {/* Stats cards - 2 col for mobile */}
      {!statsLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '0.875rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.3rem' }}>
              <TrendUp size={12} /> Completed
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#16a34a' }}>₹{(stats.completed_amount || 0).toLocaleString()}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{stats.completed_count || 0} payments</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '0.875rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.3rem' }}>
              <XCircle size={12} /> Failed
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#dc2626' }}>₹{(stats.failed_amount || 0).toLocaleString()}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{stats.failed_count || 0} payments</div>
          </div>
        </div>
      )}

      {/* Filters - stacked for mobile */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Search User</label>
          <input
            type="text"
            placeholder="User ID or name"
            value={searchUser}
            onChange={e => setSearchUser(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '0.85rem' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '0.85rem' }}>
            <option value="">All</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: '100%', padding: '0.45rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: '100%', padding: '0.45rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem' }} />
        </div>
      </div>

      {/* Summary */}
      {!loading && transactions.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <span>{transactions.length} record{transactions.length !== 1 ? 's' : ''}</span>
          <span>|</span>
          <span>Total: <strong style={{ color: 'var(--text-primary)' }}>₹{filteredTotal.toLocaleString()}</strong></span>
        </div>
      )}

      {loading ? (
        <TableSkeleton columns={4} rows={5} />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Time / UTR</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id}>
                  <td>
                    <div className="user-id-highlight" style={{ fontSize: '0.95rem' }}>{tx.worker?.worker_id_code || '-'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{tx.worker?.name}</div>
                  </td>
                  <td style={{ fontWeight: 700, fontSize: '1rem' }}>₹{tx.amount.toLocaleString()}</td>
                  <td>
                    <span style={{
                      padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 600,
                      background: tx.status === 'COMPLETED' ? '#dcfce7' : '#fee2e2',
                      color: tx.status === 'COMPLETED' ? '#166534' : '#991b1b'
                    }}>
                      {tx.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>
                    <div style={{ color: 'var(--text-secondary)' }}>{formatTime(tx.completed_at || tx.created_at)}</div>
                    {tx.transaction_ref_no && <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', marginTop: '0.15rem' }}>{tx.transaction_ref_no}</div>}
                    {tx.staff_comment && <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>"{tx.staff_comment}"</div>}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No transactions found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
