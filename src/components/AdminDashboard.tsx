import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  LogOut,
  Search,
  ShieldAlert,
  ShieldCheck,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  AuditLogEntry,
  calculateDeliveryCharge,
  formatInr,
  LaunchLead,
  OrderRecord,
  ProductData,
  StorefrontSettings,
  VALIDATION_PATTERNS,
  VerifiedReview,
} from '../types/store';
import { UpiQrCode } from './UpiQrCode';

interface AdminDashboardProps {
  onStorefrontUpdated: (product: ProductData, settings: StorefrontSettings) => void;
}

type AdminTab = 'orders' | 'settings' | 'audit';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onStorefrontUpdated }) => {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [authReady, setAuthReady] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState('');

  const [tab, setTab] = useState<AdminTab>('orders');
  const [loadingData, setLoadingData] = useState(false);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [reviews, setReviews] = useState<VerifiedReview[]>([]);
  const [launchLeads, setLaunchLeads] = useState<LaunchLead[]>([]);

  // Order filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);

  // Selected order verification / fulfillment state
  const [proofObjectUrl, setProofObjectUrl] = useState<string>('');
  const [loadingProof, setLoadingProof] = useState(false);
  const [bankConfirmed, setBankConfirmed] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [courierName, setCourierName] = useState('');
  const [trackingId, setTrackingId] = useState('');
  const [orderActionMsg, setOrderActionMsg] = useState('');
  const [orderActionBusy, setOrderActionBusy] = useState(false);

  // Settings & Product form state
  const [productDraft, setProductDraft] = useState<ProductData | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<StorefrontSettings | null>(null);
  const [complianceChecklistConfirmed, setComplianceChecklistConfirmed] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState('');
  const [testPin, setTestPin] = useState('560001');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setAuthorized(null);
        setAuthError('');
      }
    });
    return () => unsub();
  }, []);

  const syncToFirestore = useCallback(
    async (
      currentUser: User,
      product: ProductData,
      settings: StorefrontSettings,
      orderList: OrderRecord[],
      logs: AuditLogEntry[],
      leads: LaunchLead[] = []
    ) => {
      try {
        await setDoc(
          doc(db, 'adminUsers', currentUser.uid),
          {
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || 'Admin',
            role: 'admin',
            active: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, `adminUsers/${currentUser.uid}`);
        } catch {
          // Non-fatal if non-bootstrapped secondary admin
        }
      }

      try {
        await setDoc(doc(db, 'products', product.id), {
          ...product,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, `products/${product.id}`);
        } catch {
          // Handled via server state
        }
      }

      try {
        await setDoc(doc(db, 'settings', 'storefront'), {
          ...settings,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, 'settings/storefront');
        } catch {
          // Handled via server state
        }
      }

      for (const ord of orderList.slice(0, 25)) {
        try {
          await setDoc(doc(db, 'orders', ord.orderId), {
            orderId: ord.orderId,
            customerUid: ord.customerUid || 'guest',
            customerName: ord.customerName,
            phone: ord.phone,
            state: ord.state,
            city: ord.city,
            pinCode: ord.pinCode,
            address: ord.address,
            landmark: ord.landmark || '',
            productId: ord.productId,
            productTitle: ord.productTitle,
            unitPriceInr: ord.unitPriceInr,
            quantity: ord.quantity,
            subtotalInr: ord.subtotalInr,
            deliveryChargeInr: ord.deliveryChargeInr,
            totalInr: ord.totalInr,
            status: ord.status,
            paymentVerified: ord.paymentVerified,
            utrNumber: ord.utrNumber || '',
            paymentProofPath: ord.paymentProofPath || '',
            paymentProofName: ord.paymentProofName || '',
            rejectionReason: ord.rejectionReason || '',
            courierName: ord.courierName || '',
            trackingId: ord.trackingId || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch {
          // Continue syncing remaining orders
        }
      }

      for (const log of logs.slice(0, 20)) {
        try {
          await setDoc(doc(db, 'auditLogs', log.id), {
            ...log,
            createdAt: serverTimestamp(),
          });
        } catch {
          // Audit logs are immutable once written
        }
      }

      for (const lead of leads.slice(0, 30)) {
        try {
          await setDoc(doc(db, 'launchLeads', lead.id), {
            ...lead,
            createdAt: serverTimestamp(),
          });
        } catch {
          // Leads are immutable once written
        }
      }
    },
    []
  );

  const loadAdminWorkspace = useCallback(
    async (currentUser: User) => {
      setLoadingData(true);
      setAuthError('');
      try {
        const token = await currentUser.getIdToken();
        const verifyRes = await fetch('/api/admin/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!verifyRes.ok) {
          const errBody = (await verifyRes.json()) as { error?: string };
          setAuthorized(false);
          setAuthError(errBody.error || 'Access denied. Unauthorized Google account.');
          setLoadingData(false);
          return;
        }
        setAuthorized(true);

        const dataRes = await fetch('/api/admin/orders', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (dataRes.ok) {
          const payload = (await dataRes.json()) as {
            orders: OrderRecord[];
            auditLogs: AuditLogEntry[];
            reviews: VerifiedReview[];
            launchLeads?: LaunchLead[];
            product: ProductData;
            settings: StorefrontSettings;
          };
          setOrders(payload.orders);
          setAuditLogs(payload.auditLogs);
          setReviews(payload.reviews);
          setLaunchLeads(payload.launchLeads || []);
          setProductDraft(payload.product);
          setSettingsDraft(payload.settings);
          setComplianceChecklistConfirmed(payload.settings.safetyComplianceApproved);
          onStorefrontUpdated(payload.product, payload.settings);
          void syncToFirestore(
            currentUser,
            payload.product,
            payload.settings,
            payload.orders,
            payload.auditLogs,
            payload.launchLeads || []
          );
        }
      } catch {
        setAuthorized(false);
        setAuthError('Failed to verify admin session.');
      } finally {
        setLoadingData(false);
      }
    },
    [onStorefrontUpdated, syncToFirestore]
  );

  useEffect(() => {
    if (authReady && user) {
      void loadAdminWorkspace(user);
    }
  }, [authReady, user, loadAdminWorkspace]);

  // Fetch private payment proof image securely with Bearer token
  useEffect(() => {
    let active = true;
    let currentUrl = '';

    const loadProof = async () => {
      setProofObjectUrl('');
      setBankConfirmed(false);
      setRejectionReason('');
      setOrderActionMsg('');
      if (!selectedOrder) return;

      setCourierName(selectedOrder.courierName || '');
      setTrackingId(selectedOrder.trackingId || '');

      if (!selectedOrder.paymentProofPath || !user) return;
      setLoadingProof(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch(
          `/api/admin/payment-proof/${encodeURIComponent(selectedOrder.paymentProofPath)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok && active) {
          const blob = await res.blob();
          currentUrl = URL.createObjectURL(blob);
          setProofObjectUrl(currentUrl);
        }
      } catch {
        // Ignore preview load error
      } finally {
        if (active) setLoadingProof(false);
      }
    };

    void loadProof();
    return () => {
      active = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [selectedOrder, user]);

  const handleGoogleSignIn = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setAuthorized(null);
    setSelectedOrder(null);
  };

  // KPI Metrics
  const kpis = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter(
      (o) => o.status === 'PENDING_VERIFICATION' || o.status === 'AWAITING_PAYMENT'
    ).length;
    const approved = orders.filter((o) => o.status === 'APPROVED').length;
    const rejected = orders.filter((o) => o.status === 'REJECTED').length;
    const shipped = orders.filter((o) => o.status === 'SHIPPED').length;
    const delivered = orders.filter((o) => o.status === 'DELIVERED').length;
    const verifiedRevenue = orders
      .filter((o) => o.paymentVerified)
      .reduce((sum, o) => sum + o.totalInr, 0);
    return { total, pending, approved, rejected, shipped, delivered, verifiedRevenue };
  }, [orders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
      if (dateFrom && o.createdAt.slice(0, 10) < dateFrom) return false;
      if (dateTo && o.createdAt.slice(0, 10) > dateTo) return false;
      if (!q) return true;
      return (
        o.orderId.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.phone.includes(q) ||
        o.utrNumber.toLowerCase().includes(q)
      );
    });
  }, [orders, searchQuery, statusFilter, dateFrom, dateTo]);

  const handleOrderMutation = async (
    orderId: string,
    payload: Record<string, unknown>
  ) => {
    if (!user || orderActionBusy) return;
    setOrderActionBusy(true);
    setOrderActionMsg('');
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        order?: OrderRecord;
        auditLog?: AuditLogEntry;
        error?: string;
      };
      if (!res.ok || !data.order) {
        setOrderActionMsg(data.error || 'Failed to update order.');
      } else {
        const updated = data.order;
        setOrders((prev) => prev.map((o) => (o.orderId === orderId ? updated : o)));
        setSelectedOrder(updated);
        if (data.auditLog) {
          setAuditLogs((prev) => [data.auditLog!, ...prev]);
        }
        setOrderActionMsg('Order updated and logged to audit trail.');
        if (productDraft && settingsDraft) {
          void syncToFirestore(user, productDraft, settingsDraft, [updated], data.auditLog ? [data.auditLog] : []);
        }
      }
    } catch {
      setOrderActionMsg('Network error updating order.');
    } finally {
      setOrderActionBusy(false);
    }
  };

  const handleExportCsv = async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch('/api/admin/export-csv', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shock-shoe-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleProductImageUpload = async (file: File) => {
    if (!user || !productDraft) return;
    const token = await user.getIdToken();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/admin/upload-asset', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !data.url) {
      setSettingsFeedback(data.error || 'Image upload failed.');
      return;
    }
    setProductDraft({
      ...productDraft,
      images: [...productDraft.images, data.url].slice(0, 10),
    });
    setSettingsFeedback('Product photograph added. Click Save Settings to publish.');
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !productDraft || !settingsDraft || savingSettings) return;

    if (!VALIDATION_PATTERNS.UPI_ID.test(settingsDraft.merchantUpiId.trim())) {
      setSettingsFeedback('Please enter a valid Merchant UPI ID (e.g. mdsufiyanxyz@ptyes).');
      return;
    }

    if (settingsDraft.safetyComplianceApproved && !complianceChecklistConfirmed) {
      setSettingsFeedback(
        'Please check the compliance confirmation box before enabling live checkout.'
      );
      return;
    }

    setSavingSettings(true);
    setSettingsFeedback('');
    try {
      const token = await user.getIdToken();
      const cleanedSettings: StorefrontSettings = {
        ...settingsDraft,
        merchantUpiId: settingsDraft.merchantUpiId.trim(),
        upiQrImageUrl: '',
      };
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product: productDraft,
          settings: cleanedSettings,
        }),
      });
      const data = (await res.json()) as {
        product?: ProductData;
        settings?: StorefrontSettings;
        auditLog?: AuditLogEntry;
        error?: string;
      };
      if (!res.ok || !data.product || !data.settings) {
        setSettingsFeedback(data.error || 'Could not save settings.');
      } else {
        setProductDraft(data.product);
        setSettingsDraft(data.settings);
        onStorefrontUpdated(data.product, data.settings);
        if (data.auditLog) setAuditLogs((prev) => [data.auditLog!, ...prev]);
        void syncToFirestore(
          user,
          data.product,
          data.settings,
          [],
          data.auditLog ? [data.auditLog] : []
        );
        setSettingsFeedback('Settings saved to server and Cloud Firestore.');
      }
    } catch {
      setSettingsFeedback('Network error saving settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleReview = async (reviewId: string, approved: boolean) => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch(`/api/admin/reviews/${encodeURIComponent(reviewId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ approved }),
    });
    if (res.ok) {
      setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, approved } : r)));
    }
  };

  // Sign-In / Authorization Gate
  if (!authReady) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center text-sm text-neutral-500">
        Checking authentication state...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="border border-neutral-200 rounded-xl p-8 bg-white space-y-5 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-neutral-950 text-yellow-400 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-neutral-950">
              Admin Operations Console
            </h1>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Protected access for authorized Shock Shoe India administrators only. Public
              registration is disabled.
            </p>
          </div>
          {authError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {authError}
            </div>
          )}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full py-3 px-4 bg-neutral-950 hover:bg-neutral-800 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="border border-red-200 rounded-xl p-8 bg-red-50 space-y-4 text-center">
          <XCircle className="w-10 h-10 text-red-700 mx-auto" />
          <h1 className="font-display text-xl font-bold text-red-950">
            Unauthorized Admin Access Denied
          </h1>
          <p className="text-xs text-red-800 leading-relaxed">
            Signed in as <span className="font-mono">{user.email}</span>. {authError}
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-950 text-white text-xs font-semibold rounded-lg"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Top Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
        <div>
          <h1 className="font-display text-2xl font-bold text-neutral-950">
            Shock Shoe India — Admin Dashboard
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Signed in as <span className="font-mono text-neutral-800">{user.email}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 bg-neutral-100 rounded-lg border border-neutral-200">
            <button
              type="button"
              onClick={() => setTab('orders')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                tab === 'orders' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-600'
              }`}
            >
              Orders ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('settings')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                tab === 'settings' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-600'
              }`}
            >
              Product & Safety
            </button>
            <button
              type="button"
              onClick={() => setTab('audit')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                tab === 'audit' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-600'
              }`}
            >
              Reviews & Audit
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-neutral-300 text-xs font-semibold rounded-lg hover:bg-neutral-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-950 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* 7 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total Orders', value: kpis.total },
          { label: 'Pending Payments', value: kpis.pending },
          { label: 'Approved Orders', value: kpis.approved },
          { label: 'Rejected Orders', value: kpis.rejected },
          { label: 'Shipped Orders', value: kpis.shipped },
          { label: 'Delivered Orders', value: kpis.delivered },
          { label: 'Verified Revenue', value: formatInr(kpis.verifiedRevenue) },
        ].map((card) => (
          <div
            key={card.label}
            className="border border-neutral-200 rounded-xl p-4 bg-white space-y-1"
          >
            <p className="text-[11px] font-medium text-neutral-500 truncate">{card.label}</p>
            <p className="font-mono-tabular text-xl font-bold text-neutral-950">{card.value}</p>
          </div>
        ))}
      </div>

      {loadingData && (
        <div className="text-xs text-neutral-500">Refreshing orders and settings...</div>
      )}

      {/* TAB 1: ORDER MANAGEMENT */}
      {tab === 'orders' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Orders List & Filters */}
          <div className="lg:col-span-7 border border-neutral-200 rounded-xl bg-white overflow-hidden">
            <div className="p-4 border-b border-neutral-200 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Order ID, customer name, mobile, or UTR..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by order status"
                  className="px-2.5 py-2 text-xs border border-neutral-300 rounded-lg bg-white"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="AWAITING_PAYMENT">Awaiting Payment</option>
                  <option value="PENDING_VERIFICATION">Pending Verification</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="SHIPPED">Shipped</option>
                  <option value="DELIVERED">Delivered</option>
                </select>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  aria-label="Filter from date"
                  className="px-2.5 py-2 text-xs border border-neutral-300 rounded-lg"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  aria-label="Filter to date"
                  className="px-2.5 py-2 text-xs border border-neutral-300 rounded-lg"
                />
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="p-10 text-center text-xs text-neutral-500">
                No matching orders found. Real orders placed via checkout will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Order ID</th>
                      <th className="py-2.5 px-4 font-semibold">Customer</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Amount</th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {filteredOrders.map((ord) => (
                      <tr
                        key={ord.orderId}
                        onClick={() => setSelectedOrder(ord)}
                        className={`cursor-pointer transition-colors hover:bg-neutral-50 ${
                          selectedOrder?.orderId === ord.orderId ? 'bg-yellow-50' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono-tabular font-semibold text-neutral-950 whitespace-nowrap">
                          {ord.orderId}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-neutral-950">{ord.customerName}</div>
                          <div className="text-[11px] text-neutral-500 font-mono-tabular">
                            +91 {ord.phone} · {ord.pinCode}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono-tabular font-semibold text-right whitespace-nowrap">
                          {formatInr(ord.totalInr)}
                        </td>
                        <td className="py-3 px-4 font-medium text-neutral-800 whitespace-nowrap">
                          {ord.status.replace('_', ' ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Order Detail & Verification Inspector */}
          <div className="lg:col-span-5 border border-neutral-200 rounded-xl bg-white p-5 space-y-5">
            {!selectedOrder ? (
              <div className="py-16 text-center text-xs text-neutral-500">
                Select an order from the list to inspect shipping address, UTR, payment screenshot,
                and verification actions.
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 pb-4 border-b border-neutral-200">
                  <div>
                    <p className="text-[11px] text-neutral-500">Order Reference</p>
                    <h2 className="font-mono-tabular text-lg font-bold text-neutral-950">
                      {selectedOrder.orderId}
                    </h2>
                    <p className="text-xs text-neutral-500">
                      {new Date(selectedOrder.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono-tabular text-lg font-bold text-neutral-950">
                      {formatInr(selectedOrder.totalInr)}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {selectedOrder.status.replace('_', ' ')}
                    </p>
                  </div>
                </div>

                {orderActionMsg && (
                  <div className="p-3 rounded-lg bg-neutral-100 border border-neutral-200 text-xs font-medium text-neutral-900">
                    {orderActionMsg}
                  </div>
                )}

                {/* Complete Shipping Address */}
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-neutral-900">Complete Shipping Address</p>
                  <p className="text-neutral-800 font-medium">
                    {selectedOrder.customerName} · +91 {selectedOrder.phone}
                  </p>
                  <p className="text-neutral-700">{selectedOrder.address}</p>
                  {selectedOrder.landmark && (
                    <p className="text-neutral-600">Landmark: {selectedOrder.landmark}</p>
                  )}
                  <p className="text-neutral-800 font-mono-tabular">
                    {selectedOrder.city}, {selectedOrder.state} — PIN {selectedOrder.pinCode}
                  </p>
                  <div className="pt-2 space-y-1 text-neutral-700 font-mono-tabular">
                    <div>
                      Product: {selectedOrder.quantity} × {formatInr(selectedOrder.unitPriceInr)} ={' '}
                      {formatInr(selectedOrder.subtotalInr)}
                    </div>
                    <div>Delivery Charge: {formatInr(selectedOrder.deliveryChargeInr)}</div>
                    <div className="font-bold text-neutral-950">
                      Final Total: {formatInr(selectedOrder.totalInr)}
                    </div>
                  </div>
                </div>

                {/* UTR & Private Payment Screenshot */}
                <div className="pt-3 border-t border-neutral-200 space-y-2.5 text-xs">
                  <p className="font-bold text-neutral-900">UPI Payment Details</p>
                  <p className="font-mono-tabular text-neutral-800">
                    UTR: <strong>{selectedOrder.utrNumber || 'Not submitted'}</strong>
                  </p>
                  <p className="text-neutral-600">
                    Bank Verification:{' '}
                    <strong>{selectedOrder.paymentVerified ? 'VERIFIED' : 'NOT VERIFIED'}</strong>
                  </p>

                  {loadingProof ? (
                    <div className="p-4 bg-neutral-50 rounded-lg text-neutral-500">
                      Loading private payment screenshot...
                    </div>
                  ) : proofObjectUrl ? (
                    <div className="border border-neutral-200 rounded-lg p-2 bg-neutral-50 space-y-2">
                      <img
                        src={proofObjectUrl}
                        alt="Customer UPI payment screenshot"
                        className="max-h-60 mx-auto rounded object-contain"
                      />
                      <a
                        href={proofObjectUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-700 hover:text-neutral-950"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open full resolution</span>
                      </a>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200 text-neutral-500">
                      No screenshot uploaded yet.
                    </div>
                  )}
                </div>

                {/* Manual Bank Verification Actions */}
                <div className="pt-3 border-t border-neutral-200 space-y-3 text-xs">
                  <p className="font-bold text-neutral-900">Manual Verification</p>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bankConfirmed}
                      onChange={(e) => setBankConfirmed(e.target.checked)}
                      className="mt-0.5 rounded border-neutral-400"
                    />
                    <span className="text-neutral-700">
                      I confirm I have checked our merchant bank/UPI statement and verified actual
                      credit of <strong>{formatInr(selectedOrder.totalInr)}</strong>.
                    </span>
                  </label>
                  <button
                    type="button"
                    disabled={!bankConfirmed || orderActionBusy}
                    onClick={() =>
                      handleOrderMutation(selectedOrder.orderId, {
                        action: 'APPROVE_PAYMENT',
                        bankConfirmed: true,
                      })
                    }
                    className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Payment</span>
                  </button>

                  <div className="space-y-2 pt-2">
                    <input
                      type="text"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Rejection reason (e.g. UTR not found in bank statement)"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      disabled={orderActionBusy || rejectionReason.trim().length < 4}
                      onClick={() =>
                        handleOrderMutation(selectedOrder.orderId, {
                          action: 'REJECT_PAYMENT',
                          rejectionReason: rejectionReason.trim(),
                        })
                      }
                      className="w-full py-2 px-4 border border-red-300 bg-red-50 text-red-800 font-semibold rounded-lg hover:bg-red-100 disabled:opacity-40"
                    >
                      Reject Payment
                    </button>
                  </div>
                </div>

                {/* Shipping & Courier Tracking */}
                <div className="pt-3 border-t border-neutral-200 space-y-2.5 text-xs">
                  <p className="font-bold text-neutral-900">Dispatch & Tracking</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={courierName}
                      onChange={(e) => setCourierName(e.target.value)}
                      placeholder="Courier (e.g. Delhivery)"
                      className="px-3 py-2 border border-neutral-300 rounded-lg"
                    />
                    <input
                      type="text"
                      value={trackingId}
                      onChange={(e) => setTrackingId(e.target.value)}
                      placeholder="Tracking ID / AWB"
                      className="px-3 py-2 border border-neutral-300 rounded-lg font-mono-tabular"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!selectedOrder.paymentVerified || orderActionBusy}
                      onClick={() =>
                        handleOrderMutation(selectedOrder.orderId, {
                          action: 'UPDATE_FULFILLMENT',
                          status: 'SHIPPED',
                          courierName,
                          trackingId,
                        })
                      }
                      className="py-2 px-3 bg-neutral-950 text-white font-semibold rounded-lg disabled:opacity-40"
                    >
                      Mark Shipped
                    </button>
                    <button
                      type="button"
                      disabled={!selectedOrder.paymentVerified || orderActionBusy}
                      onClick={() =>
                        handleOrderMutation(selectedOrder.orderId, {
                          action: 'UPDATE_FULFILLMENT',
                          status: 'DELIVERED',
                          courierName,
                          trackingId,
                        })
                      }
                      className="py-2 px-3 border border-neutral-300 font-semibold rounded-lg hover:bg-neutral-50 disabled:opacity-40"
                    >
                      Mark Delivered
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PRODUCT, SAFETY GATE, UPI QR & DELIVERY SETTINGS */}
      {tab === 'settings' && productDraft && settingsDraft && (
        <form onSubmit={handleSaveSettings} className="space-y-8">
          {settingsFeedback && (
            <div className="p-3.5 rounded-lg border border-neutral-300 bg-yellow-50 text-xs font-semibold text-neutral-950">
              {settingsFeedback}
            </div>
          )}

          {/* Product Safety Compliance Gate */}
          <div className="border border-neutral-300 rounded-xl p-6 bg-yellow-50 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-bold text-neutral-950">
                  <ShieldAlert className="w-5 h-5" />
                  <h2>Product Safety & Legal Compliance Gate</h2>
                </div>
                <p className="text-xs text-neutral-700 max-w-3xl leading-relaxed">
                  Checkout and UPI payment collection remain disabled by default until the business
                  owner independently confirms all applicable Indian product safety, electrical
                  safety, consumer protection, and legal requirements.
                </p>
              </div>
              <label className="inline-flex items-center gap-2.5 shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsDraft.safetyComplianceApproved}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      safetyComplianceApproved: e.target.checked,
                    })
                  }
                  className="w-5 h-5 rounded border-neutral-400"
                />
                <span className="text-sm font-bold text-neutral-950">
                  {settingsDraft.safetyComplianceApproved ? 'Checkout Enabled' : 'Checkout Disabled'}
                </span>
              </label>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-neutral-800 cursor-pointer pt-2 border-t border-yellow-300">
              <input
                type="checkbox"
                checked={complianceChecklistConfirmed}
                onChange={(e) => setComplianceChecklistConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-neutral-400"
              />
              <span>
                I confirm as the business owner that applicable Indian electrical safety, product
                safety, consumer protection, and lawful labeling requirements have been
                independently verified before enabling customer sales.
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Product Configuration */}
            <div className="border border-neutral-200 rounded-xl p-6 bg-white space-y-4">
              <h3 className="font-display text-lg font-bold text-neutral-950">Product Settings</h3>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Product Title (English)
                </label>
                <input
                  type="text"
                  value={productDraft.title}
                  onChange={(e) => setProductDraft({ ...productDraft, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Product Title (Hindi)
                </label>
                <input
                  type="text"
                  value={productDraft.titleHi}
                  onChange={(e) => setProductDraft({ ...productDraft, titleHi: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Price (INR ₹)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={productDraft.priceInr}
                    onChange={(e) =>
                      setProductDraft({ ...productDraft, priceInr: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-neutral-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Available Stock
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={productDraft.stock}
                    onChange={(e) =>
                      setProductDraft({ ...productDraft, stock: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-neutral-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Description (English)
                </label>
                <textarea
                  rows={4}
                  value={productDraft.description}
                  onChange={(e) =>
                    setProductDraft({ ...productDraft, description: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-neutral-700">
                  Actual Shoe Photographs ({productDraft.images.length} active)
                </label>

                {productDraft.images.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {productDraft.images.map((imgUrl, idx) => (
                      <div
                        key={`${imgUrl}-${idx}`}
                        className="relative aspect-[4/3] rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50"
                      >
                        <img
                          src={imgUrl}
                          alt={`Product photo ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        {productDraft.images.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setProductDraft({
                                ...productDraft,
                                images: productDraft.images.filter((_, i) => i !== idx),
                              })
                            }
                            aria-label={`Remove photo ${idx + 1}`}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-neutral-950/80 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <textarea
                  rows={3}
                  value={productDraft.images.join('\n')}
                  onChange={(e) =>
                    setProductDraft({
                      ...productDraft,
                      images: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 text-xs font-mono border border-neutral-300 rounded-lg"
                />
                <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-100 border border-neutral-300 rounded-lg text-xs font-semibold cursor-pointer hover:bg-neutral-200">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Shoe Photograph</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleProductImageUpload(f);
                    }}
                    className="sr-only"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Product Video URLs (optional MP4 URLs, one per line)
                </label>
                <textarea
                  rows={2}
                  value={productDraft.videos.join('\n')}
                  onChange={(e) =>
                    setProductDraft({
                      ...productDraft,
                      videos: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 text-xs font-mono border border-neutral-300 rounded-lg"
                />
              </div>
            </div>

            {/* UPI ID, Auto-Generated QR Preview, Delivery Charges & Policies */}
            <div className="border border-neutral-200 rounded-xl p-6 bg-white space-y-4">
              <h3 className="font-display text-lg font-bold text-neutral-950">
                UPI Payment & Delivery Charges
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Merchant UPI ID
                  </label>
                  <input
                    type="text"
                    value={settingsDraft.merchantUpiId}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, merchantUpiId: e.target.value })
                    }
                    placeholder="mdsufiyanxyz@ptyes"
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-neutral-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Merchant Display Name
                  </label>
                  <input
                    type="text"
                    value={settingsDraft.merchantDisplayName}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, merchantDisplayName: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Separate Price Breakdown Preview + Auto-Generated UPI QR Preview */}
              <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 space-y-4">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-neutral-600">
                    <span>Product Price (Qty 1)</span>
                    <span className="font-mono-tabular font-semibold text-neutral-950">
                      {formatInr(productDraft.priceInr)}
                    </span>
                  </div>
                  <div className="flex justify-between text-neutral-600">
                    <span>Default Delivery Charge</span>
                    <span className="font-mono-tabular font-semibold text-neutral-950">
                      {formatInr(settingsDraft.flatDeliveryChargeInr)}
                    </span>
                  </div>
                  <div className="pt-1.5 border-t border-neutral-200 flex justify-between font-bold text-neutral-950">
                    <span>Final Total (Qty 1)</span>
                    <span className="font-mono-tabular">
                      {formatInr(
                        (Number(productDraft.priceInr) || 0) +
                          (Number(settingsDraft.flatDeliveryChargeInr) || 0)
                      )}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-200 space-y-2 text-center">
                  <p className="text-xs font-semibold text-neutral-800">
                    Auto-Generated UPI QR Preview (from configured UPI ID)
                  </p>
                  <UpiQrCode
                    upiId={settingsDraft.merchantUpiId}
                    merchantName={settingsDraft.merchantDisplayName || settingsDraft.brandName}
                    amount={
                      (Number(productDraft.priceInr) || 0) +
                      (Number(settingsDraft.flatDeliveryChargeInr) || 0)
                    }
                    note="Shock Shoe India Qty 1 Preview"
                    size={190}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-neutral-200">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Delivery Charge Mode
                  </label>
                  <select
                    value={settingsDraft.deliveryMode}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        deliveryMode: e.target.value === 'pincode' ? 'pincode' : 'flat',
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg bg-white"
                  >
                    <option value="flat">Flat Delivery Charge</option>
                    <option value="pincode">PIN-Code Based + Fallback</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Flat / Fallback Charge (INR ₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={settingsDraft.flatDeliveryChargeInr}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        flatDeliveryChargeInr: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-neutral-300 rounded-lg"
                  />
                </div>
              </div>

              {settingsDraft.deliveryMode === 'pincode' && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-neutral-700">
                    PIN Code Ranges (format: start-end:charge)
                  </label>
                  <textarea
                    rows={3}
                    value={settingsDraft.pinDeliveryRulesText}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        pinDeliveryRulesText: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-mono border border-neutral-300 rounded-lg"
                  />
                  <div className="flex items-center gap-2 text-xs text-neutral-600">
                    <span>Test PIN:</span>
                    <input
                      type="text"
                      maxLength={6}
                      value={testPin}
                      onChange={(e) => setTestPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-24 px-2 py-1 border border-neutral-300 rounded font-mono-tabular"
                    />
                    <span className="font-mono-tabular font-semibold text-neutral-950">
                      Calculated: {formatInr(calculateDeliveryCharge(settingsDraft, testPin))}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Announcement Bar (English)
                </label>
                <input
                  type="text"
                  value={settingsDraft.announcementText}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, announcementText: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Shipping Policy
                </label>
                <textarea
                  rows={3}
                  value={settingsDraft.shippingPolicy}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, shippingPolicy: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Return Policy
                </label>
                <textarea
                  rows={3}
                  value={settingsDraft.returnPolicy}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, returnPolicy: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-3 bg-yellow-400 hover:bg-yellow-300 text-neutral-950 font-bold text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              {savingSettings ? 'Saving Settings...' : 'Save All Product & Storefront Settings'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: LAUNCH WAITLIST, REVIEWS & IMMUTABLE AUDIT LOG */}
      {tab === 'audit' && (
        <div className="space-y-8">
          <div className="border border-neutral-200 rounded-xl bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-neutral-950">
                Launch Notification Waitlist ({launchLeads.length})
              </h2>
              <span className="text-xs text-neutral-500">Customer interest registrations</span>
            </div>
            {launchLeads.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500">
                No launch notification requests registered yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Registered At</th>
                      <th className="py-2.5 px-4 font-semibold">Name</th>
                      <th className="py-2.5 px-4 font-semibold">Mobile</th>
                      <th className="py-2.5 px-4 font-semibold">Consent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {launchLeads.map((lead) => (
                      <tr key={lead.id}>
                        <td className="py-2.5 px-4 font-mono-tabular text-neutral-500 whitespace-nowrap">
                          {new Date(lead.createdAt).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-neutral-950">{lead.name}</td>
                        <td className="py-2.5 px-4 font-mono-tabular text-neutral-800 whitespace-nowrap">
                          +91 {lead.phone}
                        </td>
                        <td className="py-2.5 px-4 text-emerald-700 font-medium">Confirmed</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="border border-neutral-200 rounded-xl bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200">
              <h2 className="font-display text-lg font-bold text-neutral-950">
                Verified Customer Reviews Moderation
              </h2>
            </div>
            {reviews.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500">
                No verified customer reviews submitted yet.
              </div>
            ) : (
              <div className="divide-y divide-neutral-200">
                {reviews.map((rev) => (
                  <div key={rev.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                    <div className="space-y-1">
                      <p className="font-semibold text-neutral-950">
                        {rev.customerName} · {rev.rating}/5 · Order{' '}
                        <span className="font-mono-tabular">{rev.orderId}</span>
                      </p>
                      <p className="text-neutral-700">{rev.comment}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleReview(rev.id, !rev.approved)}
                      className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 ${
                        rev.approved
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-neutral-950 text-white'
                      }`}
                    >
                      {rev.approved ? 'Published (Hide)' : 'Approve & Publish'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-neutral-200 rounded-xl bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200">
              <h2 className="font-display text-lg font-bold text-neutral-950">
                Admin Action Audit Log
              </h2>
            </div>
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500">
                No admin audit actions recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                      <th className="py-2.5 px-4 font-semibold">Action</th>
                      <th className="py-2.5 px-4 font-semibold">Order ID</th>
                      <th className="py-2.5 px-4 font-semibold">Admin</th>
                      <th className="py-2.5 px-4 font-semibold">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-2.5 px-4 font-mono-tabular text-neutral-500 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-semibold text-neutral-950 whitespace-nowrap">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-4 font-mono-tabular text-neutral-700 whitespace-nowrap">
                          {log.targetOrderId || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-neutral-700 whitespace-nowrap">
                          {log.actorEmail}
                        </td>
                        <td className="py-2.5 px-4 text-neutral-700">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
