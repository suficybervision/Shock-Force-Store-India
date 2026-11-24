import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import {
  AuditLogEntry,
  calculateDeliveryCharge,
  DEFAULT_PRODUCT,
  DEFAULT_SETTINGS,
  OrderRecord,
  OrderStatus,
  OrderTrackingInfo,
  ProductData,
  StorefrontSettings,
  VerifiedReview,
} from '../types/store';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'hajshdbdb262837@gmail.com';

export function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get('content-type') || '';
  return ct.toLowerCase().includes('application/json');
}

export function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return new Date().toISOString();
}

export function toTrackingInfo(ord: {
  orderId: string;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  paymentVerified: boolean;
  courierName: string;
  trackingId: string;
  rejectionReason: string;
  productTitle: string;
  quantity: number;
  subtotalInr: number;
  deliveryChargeInr: number;
  totalInr: number;
}): OrderTrackingInfo {
  const paymentStatusMap: Record<OrderStatus, string> = {
    AWAITING_PAYMENT: 'Awaiting UPI Payment',
    PENDING_VERIFICATION: 'Pending Verification',
    APPROVED: 'Verified & Approved',
    REJECTED: 'Rejected',
    SHIPPED: 'Verified & Approved',
    DELIVERED: 'Verified & Approved',
  };
  const orderStatusMap: Record<OrderStatus, string> = {
    AWAITING_PAYMENT: 'Pending',
    PENDING_VERIFICATION: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    SHIPPED: 'Shipped',
    DELIVERED: 'Delivered',
  };
  const shippingStatusMap: Record<OrderStatus, string> = {
    AWAITING_PAYMENT: 'Not Dispatched',
    PENDING_VERIFICATION: 'Pending Payment Verification',
    APPROVED: 'Preparing Dispatch',
    REJECTED: 'Dispatch Cancelled',
    SHIPPED: 'Shipped',
    DELIVERED: 'Delivered',
  };
  return {
    orderId: ord.orderId,
    createdAt: ord.createdAt,
    updatedAt: ord.updatedAt,
    status: ord.status,
    paymentVerified: Boolean(ord.paymentVerified),
    paymentStatus: paymentStatusMap[ord.status],
    orderStatus: orderStatusMap[ord.status],
    shippingStatus: shippingStatusMap[ord.status],
    courierName: ord.courierName || '',
    trackingId: ord.trackingId || '',
    rejectionReason: ord.rejectionReason || '',
    productTitle: ord.productTitle,
    quantity: ord.quantity,
    subtotalInr: ord.subtotalInr,
    deliveryChargeInr: ord.deliveryChargeInr,
    totalInr: ord.totalInr,
  };
}

export async function compressImageToDataUrl(
  file: File,
  options?: { maxDimension?: number; maxLength?: number }
): Promise<string> {
  const maxDimension = options?.maxDimension ?? 960;
  const maxLength = options?.maxLength ?? 280000;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Invalid or unreadable image file.'));
      el.src = objectUrl;
    });

    const attempts: Array<{ scaleDim: number; quality: number }> = [
      { scaleDim: maxDimension, quality: 0.78 },
      { scaleDim: Math.min(maxDimension, 800), quality: 0.65 },
      { scaleDim: 640, quality: 0.55 },
      { scaleDim: 480, quality: 0.45 },
    ];

    for (const { scaleDim, quality } of attempts) {
      const ratio = Math.min(1, scaleDim / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * ratio));
      const height = Math.max(1, Math.round(img.height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= maxLength) {
        return dataUrl;
      }
    }

    throw new Error('Image is too large even after compression. Please choose a smaller screenshot.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export interface CreateOrderPayload {
  customerName: string;
  phone: string;
  state: string;
  city: string;
  pinCode: string;
  address: string;
  landmark: string;
  quantity: number;
  idempotencyKey: string;
}

function getSafeCustomerUid(): string {
  const u = auth.currentUser;
  if (u && u.emailVerified && /^[a-zA-Z0-9_\-]+$/.test(u.uid)) {
    return u.uid;
  }
  return 'guest';
}

function makeLocalToken(orderId: string, phone: string): string {
  return `fs_${orderId}_${phone.slice(-4)}`;
}

async function syncExpressOrderToFirestore(order: OrderRecord): Promise<void> {
  try {
    const trackingSnap = await getDoc(doc(db, 'orderTracking', order.orderId));
    if (trackingSnap.exists()) return;

    const batch = writeBatch(db);
    const tracking = toTrackingInfo(order);
    batch.set(doc(db, 'orders', order.orderId), {
      orderId: order.orderId,
      customerUid: getSafeCustomerUid(),
      customerName: order.customerName,
      phone: order.phone,
      state: order.state,
      city: order.city,
      pinCode: order.pinCode,
      address: order.address,
      landmark: order.landmark || '',
      productId: order.productId,
      productTitle: order.productTitle,
      unitPriceInr: order.unitPriceInr,
      quantity: order.quantity,
      subtotalInr: order.subtotalInr,
      deliveryChargeInr: order.deliveryChargeInr,
      totalInr: order.totalInr,
      status: 'AWAITING_PAYMENT',
      paymentVerified: false,
      utrNumber: '',
      paymentProofPath: '',
      paymentProofName: '',
      rejectionReason: '',
      courierName: '',
      trackingId: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'orderTracking', order.orderId), {
      ...tracking,
      status: 'AWAITING_PAYMENT',
      paymentVerified: false,
      courierName: '',
      trackingId: '',
      rejectionReason: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch {
    // Non-fatal if already handled locally by Express
  }
}

export async function createOrderHybrid(
  payload: CreateOrderPayload,
  product: ProductData,
  settings: StorefrontSettings
): Promise<{ order: OrderRecord; lookupToken: string }> {
  const customerUid = getSafeCustomerUid();

  // 1. Try Express backend if available (e.g. AI Studio Node runtime)
  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        customerUid,
      }),
    });

    if (isJsonResponse(response)) {
      const data = (await response.json()) as {
        order?: OrderRecord;
        lookupToken?: string;
        error?: string;
      };
      if (!response.ok || !data.order || !data.lookupToken) {
        throw new Error(data.error || 'Could not place order. Please review your details.');
      }
      await syncExpressOrderToFirestore(data.order);
      return { order: data.order, lookupToken: data.lookupToken };
    }
  } catch (err) {
    // If Express returned a real JSON validation/business error, propagate it immediately
    if (
      err instanceof Error &&
      !err.message.includes('Failed to fetch') &&
      !err.message.includes('NetworkError') &&
      !err.message.includes('Unexpected token')
    ) {
      throw err;
    }
    // Otherwise fall through to direct Cloud Firestore transaction (e.g. Vercel static build)
  }

  // 2. Direct Cloud Firestore transaction (Vercel static deployment / serverless fallback)
  let authoritativeProduct = product;
  let authoritativeSettings = settings;
  try {
    const [prodSnap, setSnap] = await Promise.all([
      getDoc(doc(db, 'products', product.id || DEFAULT_PRODUCT.id)),
      getDoc(doc(db, 'settings', 'storefront')),
    ]);
    if (prodSnap.exists()) {
      const pData = prodSnap.data() as Partial<ProductData>;
      if (typeof pData.priceInr === 'number' && pData.priceInr > 0) {
        authoritativeProduct = { ...authoritativeProduct, ...pData };
      }
    }
    if (setSnap.exists()) {
      const sData = setSnap.data() as Partial<StorefrontSettings>;
      if (sData.brandName) {
        const rawAnn = String(sData.announcementText || '');
        const isLegacyDisabledBanner =
          rawAnn.includes('Checkout paused') ||
          rawAnn.includes('Sales Paused') ||
          rawAnn.includes('Launch Coming Soon') ||
          rawAnn.includes('Payment collection disabled');
        authoritativeSettings = {
          ...authoritativeSettings,
          ...sData,
          safetyComplianceApproved: isLegacyDisabledBanner
            ? true
            : Boolean(sData.safetyComplianceApproved),
        };
      }
    }
  } catch {
    // Use passed storefront props if Firestore catalog hasn't been seeded yet
  }

  if (!authoritativeSettings.safetyComplianceApproved) {
    throw new Error(
      'Checkout is currently disabled until product safety and legal compliance approval is confirmed.'
    );
  }

  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const counterId = `orders_${dateStamp}`;
  const counterRef = doc(db, 'counters', counterId);
  const prefix = `SSI-${dateStamp}-`;

  const unitPriceInr = Number(authoritativeProduct.priceInr || DEFAULT_PRODUCT.priceInr);
  const safeQty = Math.max(1, Math.min(20, Math.floor(Number(payload.quantity) || 1)));
  const subtotalInr = unitPriceInr * safeQty;
  const deliveryChargeInr = calculateDeliveryCharge(authoritativeSettings, payload.pinCode);
  const totalInr = subtotalInr + deliveryChargeInr;
  const nowIso = new Date().toISOString();

  const createdOrder = await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const currentSeq = counterSnap.exists() ? Number(counterSnap.data().seq || 0) : 0;
    const nextSeq = currentSeq + 1;

    let candidateId = `${prefix}${String(nextSeq).padStart(3, '0')}`;
    const existingTrackingSnap = await tx.get(doc(db, 'orderTracking', candidateId));
    if (existingTrackingSnap.exists()) {
      const randSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
      candidateId = `${prefix}${String(nextSeq).padStart(3, '0')}-${randSuffix}`;
    }

    const orderDoc: Record<string, unknown> = {
      orderId: candidateId,
      customerUid,
      customerName: payload.customerName.trim().slice(0, 100),
      phone: payload.phone.trim(),
      state: payload.state.trim().slice(0, 60),
      city: payload.city.trim().slice(0, 60),
      pinCode: payload.pinCode.trim(),
      address: payload.address.trim().slice(0, 300),
      landmark: payload.landmark.trim().slice(0, 120),
      productId: (authoritativeProduct.id || 'shock-shoe').slice(0, 64),
      productTitle: (authoritativeProduct.title || DEFAULT_PRODUCT.title).slice(0, 120),
      unitPriceInr,
      quantity: safeQty,
      subtotalInr,
      deliveryChargeInr,
      totalInr,
      status: 'AWAITING_PAYMENT',
      paymentVerified: false,
      utrNumber: '',
      paymentProofPath: '',
      paymentProofName: '',
      rejectionReason: '',
      courierName: '',
      trackingId: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const trackingInfo = toTrackingInfo({
      orderId: candidateId,
      createdAt: nowIso,
      updatedAt: nowIso,
      status: 'AWAITING_PAYMENT',
      paymentVerified: false,
      courierName: '',
      trackingId: '',
      rejectionReason: '',
      productTitle: orderDoc.productTitle as string,
      quantity: safeQty,
      subtotalInr,
      deliveryChargeInr,
      totalInr,
    });

    if (counterSnap.exists()) {
      tx.update(counterRef, {
        seq: nextSeq,
        updatedAt: serverTimestamp(),
      });
    } else {
      tx.set(counterRef, {
        id: counterId,
        seq: 1,
        updatedAt: serverTimestamp(),
      });
    }

    tx.set(doc(db, 'orders', candidateId), orderDoc);
    tx.set(doc(db, 'orderTracking', candidateId), {
      ...trackingInfo,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      orderId: candidateId,
      customerUid,
      customerName: orderDoc.customerName as string,
      phone: orderDoc.phone as string,
      state: orderDoc.state as string,
      city: orderDoc.city as string,
      pinCode: orderDoc.pinCode as string,
      address: orderDoc.address as string,
      landmark: orderDoc.landmark as string,
      productId: orderDoc.productId as string,
      productTitle: orderDoc.productTitle as string,
      unitPriceInr,
      quantity: safeQty,
      subtotalInr,
      deliveryChargeInr,
      totalInr,
      status: 'AWAITING_PAYMENT',
      paymentVerified: false,
      utrNumber: '',
      paymentProofPath: '',
      paymentProofName: '',
      rejectionReason: '',
      courierName: '',
      trackingId: '',
      createdAt: nowIso,
      updatedAt: nowIso,
    } satisfies OrderRecord;
  });

  return {
    order: createdOrder,
    lookupToken: makeLocalToken(createdOrder.orderId, createdOrder.phone),
  };
}

export async function submitPaymentProofHybrid(
  order: OrderRecord,
  utrNumber: string,
  file: File,
  lookupToken: string
): Promise<OrderRecord> {
  const cleanUtr = utrNumber.trim().toUpperCase();
  let apiUpdatedOrder: OrderRecord | null = null;

  // Prepare compressed proof first so it is always ready for Firestore (even on Vercel)
  const compressedDataUrl = await compressImageToDataUrl(file, {
    maxDimension: 960,
    maxLength: 320000,
  });

  // 1. Try Express multipart upload if Express backend is present
  try {
    const formData = new FormData();
    formData.append('utrNumber', cleanUtr);
    formData.append('lookupToken', lookupToken);
    formData.append('phone', order.phone);
    formData.append('screenshot', file);

    const res = await fetch(`/api/orders/${encodeURIComponent(order.orderId)}/payment-proof`, {
      method: 'POST',
      body: formData,
    });
    if (isJsonResponse(res)) {
      const data = (await res.json()) as { order?: OrderRecord; error?: string };
      if (!res.ok || !data.order) {
        throw new Error(
          data.error || 'Could not upload payment proof. Please check your file and UTR.'
        );
      }
      apiUpdatedOrder = data.order;
    }
  } catch (err) {
    if (
      err instanceof Error &&
      !err.message.includes('Failed to fetch') &&
      !err.message.includes('NetworkError') &&
      !err.message.includes('Unexpected token')
    ) {
      throw err;
    }
  }

  // 2. Persist proof & PENDING_VERIFICATION status to Firestore atomically
  // Prefer compressed data URL so AdminDashboard can view screenshots on both Express and Vercel!
  const proofPathToStore = compressedDataUrl;
  const proofNameToStore = (apiUpdatedOrder?.paymentProofName || file.name || 'payment-proof.jpg').slice(
    0,
    120
  );
  const nowIso = new Date().toISOString();

  try {
    const orderRef = doc(db, 'orders', order.orderId);
    const trackingRef = doc(db, 'orderTracking', order.orderId);
    const trackingSnap = await getDoc(trackingRef);

    if (trackingSnap.exists()) {
      const batch = writeBatch(db);
      batch.update(orderRef, {
        utrNumber: cleanUtr,
        paymentProofPath: proofPathToStore,
        paymentProofName: proofNameToStore,
        status: 'PENDING_VERIFICATION',
        rejectionReason: '',
        updatedAt: serverTimestamp(),
      });
      batch.update(trackingRef, {
        status: 'PENDING_VERIFICATION',
        paymentStatus: 'Pending Verification',
        orderStatus: 'Pending',
        shippingStatus: 'Pending Payment Verification',
        rejectionReason: '',
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } else if (!apiUpdatedOrder) {
      // Edge case: create missing docs if order never existed in Firestore
      const batch = writeBatch(db);
      const tracking = toTrackingInfo({
        ...order,
        status: 'PENDING_VERIFICATION',
        paymentVerified: false,
        rejectionReason: '',
      });
      batch.set(orderRef, {
        orderId: order.orderId,
        customerUid: getSafeCustomerUid(),
        customerName: order.customerName,
        phone: order.phone,
        state: order.state,
        city: order.city,
        pinCode: order.pinCode,
        address: order.address,
        landmark: order.landmark || '',
        productId: order.productId,
        productTitle: order.productTitle,
        unitPriceInr: order.unitPriceInr,
        quantity: order.quantity,
        subtotalInr: order.subtotalInr,
        deliveryChargeInr: order.deliveryChargeInr,
        totalInr: order.totalInr,
        status: 'PENDING_VERIFICATION',
        paymentVerified: false,
        utrNumber: cleanUtr,
        paymentProofPath: proofPathToStore,
        paymentProofName: proofNameToStore,
        rejectionReason: '',
        courierName: '',
        trackingId: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(trackingRef, {
        ...tracking,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    }
  } catch (err) {
    if (!apiUpdatedOrder) {
      throw new Error(
        err instanceof Error && err.message.includes('PERMISSION_DENIED')
          ? 'This order already has a finalized payment status and cannot be modified.'
          : 'Could not save payment proof. Please try again.'
      );
    }
  }

  return (
    apiUpdatedOrder ?? {
      ...order,
      utrNumber: cleanUtr,
      paymentProofPath: proofPathToStore,
      paymentProofName: proofNameToStore,
      status: 'PENDING_VERIFICATION',
      paymentVerified: false,
      rejectionReason: '',
      updatedAt: nowIso,
    }
  );
}

export async function trackOrderHybrid(cleanOrderId: string): Promise<OrderTrackingInfo | null> {
  // 1. Try Express API if available
  try {
    const res = await fetch('/api/orders/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: cleanOrderId }),
    });
    if (isJsonResponse(res)) {
      if (res.ok) {
        const data = (await res.json()) as { order?: OrderTrackingInfo };
        if (data.order) return data.order;
      }
    }
  } catch {
    // Fall back to Firestore orderTracking lookup
  }

  // 2. Non-PII public lookup in Firestore orderTracking/{orderId}
  const snap = await getDoc(doc(db, 'orderTracking', cleanOrderId));
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  const status = (d.status as OrderStatus) || 'PENDING_VERIFICATION';
  return {
    orderId: String(d.orderId || cleanOrderId),
    createdAt: timestampToIso(d.createdAt),
    updatedAt: timestampToIso(d.updatedAt),
    status,
    paymentVerified: Boolean(d.paymentVerified),
    paymentStatus: String(d.paymentStatus || ''),
    orderStatus: String(d.orderStatus || ''),
    shippingStatus: String(d.shippingStatus || ''),
    courierName: String(d.courierName || ''),
    trackingId: String(d.trackingId || ''),
    rejectionReason: String(d.rejectionReason || ''),
    productTitle: String(d.productTitle || DEFAULT_PRODUCT.title),
    quantity: Number(d.quantity || 1),
    subtotalInr: Number(d.subtotalInr || 0),
    deliveryChargeInr: Number(d.deliveryChargeInr || 0),
    totalInr: Number(d.totalInr || 0),
  };
}

export async function submitReviewHybrid(params: {
  orderId: string;
  phone: string;
  rating: number;
  comment: string;
}): Promise<string> {
  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (isJsonResponse(res)) {
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Could not submit review.');
      }
      return data.message || 'Review submitted for admin approval.';
    }
  } catch (err) {
    if (
      err instanceof Error &&
      !err.message.includes('Failed to fetch') &&
      !err.message.includes('NetworkError') &&
      !err.message.includes('Unexpected token')
    ) {
      throw err;
    }
  }

  // Firestore fallback when running statically on Vercel
  const trackingSnap = await getDoc(doc(db, 'orderTracking', params.orderId));
  if (!trackingSnap.exists() || trackingSnap.data().status !== 'DELIVERED') {
    throw new Error('Verified reviews can only be submitted after your order is marked Delivered.');
  }

  const reviewId = `REV-${Date.now().toString(36).toUpperCase()}`;
  await setDoc(doc(db, 'reviews', reviewId), {
    id: reviewId,
    orderId: params.orderId,
    customerName: 'Verified Buyer',
    rating: params.rating,
    comment: params.comment.trim(),
    verifiedPurchase: true,
    approved: false,
    createdAt: serverTimestamp(),
  });
  return 'Thank you! Your verified review has been submitted for admin approval.';
}

export async function fetchStorefrontFromFirestore(): Promise<{
  product: ProductData | null;
  settings: StorefrontSettings | null;
  reviews: VerifiedReview[];
}> {
  let nextProduct: ProductData | null = null;
  let nextSettings: StorefrontSettings | null = null;
  let nextReviews: VerifiedReview[] = [];

  try {
    const [prodSnap, setSnap, revSnap] = await Promise.all([
      getDoc(doc(db, 'products', 'shock-shoe')),
      getDoc(doc(db, 'settings', 'storefront')),
      getDocs(
        query(
          collection(db, 'reviews'),
          where('approved', '==', true),
          orderBy('createdAt', 'desc'),
          limit(24)
        )
      ).catch(() => null),
    ]);

    if (prodSnap.exists()) {
      const d = prodSnap.data() as Record<string, unknown>;
      const images = Array.isArray(d.images) ? (d.images as string[]) : [];
      const hasLegacyAiImages = images.some((img) => img.startsWith('/src/assets/images/'));
      if (d.title && typeof d.priceInr === 'number' && !hasLegacyAiImages) {
        nextProduct = {
          ...(DEFAULT_PRODUCT as ProductData),
          ...(d as unknown as ProductData),
          updatedAt: timestampToIso(d.updatedAt),
        };
      }
    }

    if (setSnap.exists()) {
      const s = setSnap.data() as Record<string, unknown>;
      if (s.brandName && s.merchantUpiId) {
        const rawAnn = String(s.announcementText || '');
        const rawAnnHi = String(s.announcementTextHi || '');
        const isLegacyDisabledBanner =
          rawAnn.includes('Checkout paused') ||
          rawAnn.includes('Sales Paused') ||
          rawAnn.includes('Launch Coming Soon') ||
          rawAnn.includes('Payment collection disabled');
        nextSettings = {
          ...(DEFAULT_SETTINGS as StorefrontSettings),
          ...(s as unknown as StorefrontSettings),
          safetyComplianceApproved: isLegacyDisabledBanner
            ? true
            : Boolean(s.safetyComplianceApproved),
          announcementText: isLegacyDisabledBanner
            ? DEFAULT_SETTINGS.announcementText
            : rawAnn || DEFAULT_SETTINGS.announcementText,
          announcementTextHi:
            isLegacyDisabledBanner ||
            rawAnnHi.includes('चेकआउट बंद') ||
            rawAnnHi.includes('भुगतान बंद')
              ? DEFAULT_SETTINGS.announcementTextHi
              : rawAnnHi || DEFAULT_SETTINGS.announcementTextHi,
          updatedAt: timestampToIso(s.updatedAt),
        };
      }
    }

    if (revSnap) {
      nextReviews = revSnap.docs.map((docSnap) => {
        const r = docSnap.data() as Record<string, unknown>;
        return {
          id: String(r.id || docSnap.id),
          orderId: String(r.orderId || ''),
          customerName: String(r.customerName || 'Verified Buyer'),
          rating: Number(r.rating || 5),
          comment: String(r.comment || ''),
          verifiedPurchase: Boolean(r.verifiedPurchase),
          approved: Boolean(r.approved),
          createdAt: timestampToIso(r.createdAt),
        };
      });
    }
  } catch {
    // Public fallback safely handled by caller
  }

  return { product: nextProduct, settings: nextSettings, reviews: nextReviews };
}

export function mapFirestoreOrderDoc(id: string, d: Record<string, unknown>): OrderRecord {
  return {
    orderId: String(d.orderId || id),
    customerUid: String(d.customerUid || 'guest'),
    customerName: String(d.customerName || ''),
    phone: String(d.phone || ''),
    state: String(d.state || ''),
    city: String(d.city || ''),
    pinCode: String(d.pinCode || ''),
    address: String(d.address || ''),
    landmark: String(d.landmark || ''),
    productId: String(d.productId || 'shock-shoe'),
    productTitle: String(d.productTitle || DEFAULT_PRODUCT.title),
    unitPriceInr: Number(d.unitPriceInr || DEFAULT_PRODUCT.priceInr),
    quantity: Number(d.quantity || 1),
    subtotalInr: Number(d.subtotalInr || 0),
    deliveryChargeInr: Number(d.deliveryChargeInr || 0),
    totalInr: Number(d.totalInr || 0),
    status: (d.status as OrderStatus) || 'AWAITING_PAYMENT',
    paymentVerified: Boolean(d.paymentVerified),
    utrNumber: String(d.utrNumber || ''),
    paymentProofPath: String(d.paymentProofPath || ''),
    paymentProofName: String(d.paymentProofName || ''),
    rejectionReason: String(d.rejectionReason || ''),
    courierName: String(d.courierName || ''),
    trackingId: String(d.trackingId || ''),
    createdAt: timestampToIso(d.createdAt),
    updatedAt: timestampToIso(d.updatedAt),
  };
}

export function mapFirestoreAuditDoc(id: string, d: Record<string, unknown>): AuditLogEntry {
  return {
    id: String(d.id || id),
    action: String(d.action || ''),
    targetOrderId: String(d.targetOrderId || ''),
    actorUid: String(d.actorUid || ''),
    actorEmail: String(d.actorEmail || ''),
    details: String(d.details || ''),
    createdAt: timestampToIso(d.createdAt),
  };
}
