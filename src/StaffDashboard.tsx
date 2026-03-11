import { useState, useEffect, useCallback } from 'react';
import { LockKey, CurrencyInr, CheckCircle, Clock, XCircle, ArrowLeft } from '@phosphor-icons/react';
import api from './api';

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
  const [payments, setPayments] = useState<any[]>([]);
  const [processingPayment, setProcessingPayment] = useState<any | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const [utr, setUtr] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPayments = useCallback(async () => {
    try {
      const res = await api.get('/staff/payments/pending');
      setPayments(res.data);

      // Auto-resume if I have a locked payment currently PROCESSING
      const locked = res.data.find((p: any) => p.status === 'PROCESSING');
      if (locked) setProcessingPayment(locked);
    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
    const interval = setInterval(fetchPayments, 10000);
    return () => clearInterval(interval);
  }, [fetchPayments]);

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
    if (!comment) return alert('Please provide a comment explaining why this failed (e.g. invalid bank account).');

    setLoading(true);
    try {
      await api.post(`/staff/payments/${processingPayment.id}/fail`, { staff_comment: comment });
      setProcessingPayment(null);
      fetchPayments();
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
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to complete payment.');
    } finally {
      setLoading(false);
    }
  };

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
          {/* Details Column */}
          <div style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              Target Details
            </h3>
            <p style={{ fontSize: '2rem', fontWeight: 700, color: '#16a34a', marginBottom: '1.5rem' }}>
              ₹{processingPayment.amount.toLocaleString()}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div><strong>Name:</strong> {worker?.name}</div>
              {worker?.worker_id_code && <div><strong>User ID:</strong> <span style={{ fontFamily: 'monospace' }}>{worker?.worker_id_code}</span></div>}
              {worker?.bank_account_number && (
                <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '4px', marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Bank Account Number</div>
                  <div style={{ fontWeight: 600, letterSpacing: '1px', fontFamily: 'monospace', fontSize: '1.1rem' }}>{worker.bank_account_number}</div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    <div><span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>IFSC: </span><span style={{ fontFamily: 'monospace' }}>{worker.bank_ifsc}</span></div>
                    <div><span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Name: </span> {worker.bank_account_name}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* QR Column */}
          {worker?.qr_code_url && (
            <div style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Scan to Pay</div>
              <img src={worker.qr_code_url} alt="QR Code" style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain' }} />
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2>Pending Payments Queue</h2>
          {!dataLoading && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{pendingPayments.length} payment{pendingPayments.length !== 1 ? 's' : ''} waiting</p>}
        </div>
        <button className="btn-secondary" onClick={fetchPayments}>
          Refresh Queue
        </button>
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
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingPayments.map((payment) => (
                <tr key={payment.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div className="btn-icon" style={{ backgroundColor: 'var(--bg-tertiary)', border: 'none' }}>
                        <Clock size={16} weight="bold" />
                      </div>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{payment.id.split('-')[0]}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{payment.worker?.name}</div>
                    {payment.worker?.worker_id_code && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{payment.worker.worker_id_code}</div>}
                  </td>
                  <td style={{ fontWeight: 700, fontSize: '1.1rem' }}>₹{payment.amount.toLocaleString()}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{new Date(payment.created_at).toLocaleTimeString()}</td>
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
              {pendingPayments.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    There are no pending payments in the queue!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
