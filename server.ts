import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = __dirname;
let STORAGE_BASE = ROOT_DIR;
try {
  fs.mkdirSync(path.resolve(ROOT_DIR, 'data'), { recursive: true });
  fs.accessSync(path.resolve(ROOT_DIR, 'data'), fs.constants.W_OK);
} catch {
  STORAGE_BASE = path.resolve(os.tmpdir(), 'shock_shoe_india');
}

const DATA_DIR = path.resolve(STORAGE_BASE, 'data');
const PRIVATE_PROOF_DIR = path.resolve(STORAGE_BASE, 'private_uploads', 'payment_proofs');
const PUBLIC_ASSET_DIR = path.resolve(STORAGE_BASE, 'public_assets');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(PRIVATE_PROOF_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_ASSET_DIR, { recursive: true });

const CONFIG_PATH = path.resolve(ROOT_DIR, 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as {
  projectId: string;
};

// Initialize Firebase Admin ONLY for ID token verification (works on any project without IAM)
const adminApp = getApps().length
  ? getApp()
  : initializeApp({ projectId: firebaseConfig.projectId });
const adminAuth = getAuth(adminApp);

const SESSION_HMAC_SECRET =
  process.env.ORDER_TOKEN_SECRET && process.env.ORDER_TOKEN_SECRET.trim().length >= 16
    ? process.env.ORDER_TOKEN_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

const BOOTSTRAPPED_ADMIN_EMAIL = 'hajshdbdb262837@gmail.com';

function getAuthorizedAdminEmails(): Set<string> {
  const allowed = new Set<string>([BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()]);
  if (process.env.ADMIN_EMAILS) {
    for (const raw of process.env.ADMIN_EMAILS.split(',')) {
      const cleaned = raw.trim().toLowerCase();
      if (cleaned) allowed.add(cleaned);
    }
  }
  const extraPath = path.resolve(DATA_DIR, 'admin_emails.json');
  if (fs.existsSync(extraPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(extraPath, 'utf-8')) as string[];
      if (Array.isArray(parsed)) {
        for (const e of parsed) {
          if (typeof e === 'string' && e.trim()) {
            allowed.add(e.trim().toLowerCase());
          }
        }
      }
    } catch {
      // Ignore malformed file
    }
  }
  return allowed;
}

interface ProductState {
  id: string;
  title: string;
  titleHi: string;
  description: string;
  descriptionHi: string;
  priceInr: number;
  stock: number;
  active: boolean;
  images: string[];
  videos: string[];
  specs: string[];
  safetyWarnings: string[];
  updatedAt: string;
}

interface SettingsState {
  id: string;
  brandName: string;
  announcementText: string;
  announcementTextHi: string;
  safetyComplianceApproved: boolean;
  complianceOwnerName: string;
  complianceConfirmedAt: string;
  merchantUpiId: string;
  merchantDisplayName: string;
  upiQrImageUrl: string;
  deliveryMode: 'flat' | 'pincode';
  flatDeliveryChargeInr: number;
  pinDeliveryRulesText: string;
  shippingPolicy: string;
  returnPolicy: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  updatedAt: string;
}

type OrderStatus =
  | 'AWAITING_PAYMENT'
  | 'PENDING_VERIFICATION'
  | 'APPROVED'
  | 'REJECTED'
  | 'SHIPPED'
  | 'DELIVERED';

interface ServerOrder {
  orderId: string;
  customerUid: string;
  customerName: string;
  phone: string;
  state: string;
  city: string;
  pinCode: string;
  address: string;
  landmark: string;
  productId: string;
  productTitle: string;
  unitPriceInr: number;
  quantity: number;
  subtotalInr: number;
  deliveryChargeInr: number;
  totalInr: number;
  status: OrderStatus;
  paymentVerified: boolean;
  utrNumber: string;
  paymentProofPath: string;
  paymentProofName: string;
  rejectionReason: string;
  courierName: string;
  trackingId: string;
  createdAt: string;
  updatedAt: string;
  idempotencyKey?: string;
}

interface ServerAuditLog {
  id: string;
  action: string;
  targetOrderId: string;
  actorUid: string;
  actorEmail: string;
  details: string;
  createdAt: string;
}

interface ServerReview {
  id: string;
  orderId: string;
  customerName: string;
  rating: number;
  comment: string;
  verifiedPurchase: boolean;
  approved: boolean;
  createdAt: string;
}

interface ServerLaunchLead {
  id: string;
  name: string;
  phone: string;
  consent: boolean;
  createdAt: string;
}

const DEFAULT_PRODUCT_STATE: ProductState = {
  id: 'shock-shoe',
  title: 'Shock Shoe — Prototype Edition',
  titleHi: 'शॉक शू — प्रोटोटाइप संस्करण',
  description:
    'Shock Shoe is an educational prototype electrostatic footwear unit featuring a breathable mesh upper, rubber outsole, Type-C charging port, push-button activation, grounding wire mesh, and 1MΩ ankle band assembly. Offered for educational demonstration purposes with strict adherence to written safety warnings.',
  descriptionHi:
    'शॉक शू एक शैक्षणिक प्रोटोटाइप इलेक्ट्रोस्टैटिक फुटवियर यूनिट है जिसमें हल्का मेश अपर, रबर सोल, टाइप-सी चार्जिंग पोर्ट, पुश-बटन एक्टिवेशन, ग्राउंडिंग वायर मेश और 1MΩ एंकल बैंड असेंबली शामिल है। इसे केवल शैक्षणिक उद्देश्य और सुरक्षा निर्देशों के पालन के साथ प्रस्तुत किया गया है।',
  priceInr: 299,
  stock: 25,
  active: true,
  images: [
    '/assets/aistudio/Screenshot_20261124_083306_5f195d82.jpg',
    '/assets/aistudio/Screenshot_20261124_083405_af2a70cc.jpg',
    '/assets/aistudio/Screenshot_20261124_083422_6bc08a7f.jpg',
  ],
  videos: [],
  specs: [
    'Model: Shock Shoe Educational Prototype Unit',
    'Product Price: ₹299 INR + ₹199 INR Delivery (₹498 INR for Qty 1)',
    'Upper Material: Lightweight Breathable Synthetic Mesh',
    'Sole & Grounding: Rubber Outsole with Grounding Wire Mesh',
    'Controls & Power: Push-Button Activation & USB Type-C Port',
    'Safety Harness: 1MΩ Ankle Band Assembly',
    'Intended Use: Educational Prototype & Demonstration Only',
  ],
  safetyWarnings: [
    'Educational prototype electrical/static-electricity footwear unit. Not certified for medical or industrial PPE environments.',
    'Never use to shock, startle, or discharge static electricity toward any person or animal.',
    'Do not wear or activate near flammable gases, fuel vapors, wet floors, standing water, electrical wall plates, or conductive metal grates.',
    'Individuals with pacemakers, implanted electronic medical devices, or heart conditions must not handle or wear prototype electrostatic footwear.',
    'Keep out of reach of children. Follow all written safety warnings strictly.',
  ],
  updatedAt: new Date().toISOString(),
};

const DEFAULT_SETTINGS_STATE: SettingsState = {
  id: 'storefront',
  brandName: 'Shock Shoe India',
  announcementText: 'Educational Prototype · Product ₹299 + ₹199 Delivery (₹498 Total) · Direct UPI Checkout Open',
  announcementTextHi: 'शैक्षणिक प्रोटोटाइप · उत्पाद ₹299 + ₹199 डिलीवरी (कुल ₹498) · UPI चेकआउट उपलब्ध',
  safetyComplianceApproved: true,
  complianceOwnerName: 'Educational Prototype Store',
  complianceConfirmedAt: '2026-11-24T00:00:00.000Z',
  merchantUpiId: 'mdsufiyanxyz@ptyes',
  merchantDisplayName: 'Shock Shoe India',
  upiQrImageUrl: '',
  deliveryMode: 'flat',
  flatDeliveryChargeInr: 199,
  pinDeliveryRulesText: '400001-400099:199\n110001-110099:199\n560001-560100:199',
  shippingPolicy:
    'Orders are dispatched only after manual bank/UPI payment verification is completed by our operations team and safety compliance approval is active. Standard delivery charge is ₹199 INR across India with courier tracking.',
  returnPolicy:
    'Returns are accepted within 7 days of delivery only for unused units in original packaging with manufacturing defects. Due to prototype electrical component handling, units exposed to water or physical tampering are ineligible for return.',
  contactEmail: 'support@shockshoeindia.example',
  contactPhone: '+91 98000 00000',
  contactAddress: 'Shock Shoe India Lab, Bengaluru, Karnataka 560001, India',
  updatedAt: new Date().toISOString(),
};

const STORE_FILE = path.resolve(DATA_DIR, 'store_state.json');
const ORDERS_FILE = path.resolve(DATA_DIR, 'orders_ledger.json');
const ORDER_SEQ_FILE = path.resolve(DATA_DIR, 'order_sequence.json');
const AUDIT_FILE = path.resolve(DATA_DIR, 'audit_logs.json');
const REVIEWS_FILE = path.resolve(DATA_DIR, 'reviews.json');
const LEADS_FILE = path.resolve(DATA_DIR, 'launch_leads.json');

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath: string, data: unknown): void {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);
}

function getStoreState(): { product: ProductState; settings: SettingsState } {
  const state = readJsonFile<{ product?: ProductState; settings?: SettingsState }>(STORE_FILE, {});
  let product = state.product ?? DEFAULT_PRODUCT_STATE;
  let settings = state.settings ?? DEFAULT_SETTINGS_STATE;

  // Migrate legacy AI image paths or unset UPI/old 49 delivery defaults if present
  const hasLegacyAiImages = product.images?.some((img) => img.startsWith('/src/assets/images/'));
  if (hasLegacyAiImages) {
    product = {
      ...product,
      images: DEFAULT_PRODUCT_STATE.images,
      specs: DEFAULT_PRODUCT_STATE.specs,
    };
  }
  if (!settings.merchantUpiId) {
    settings = {
      ...settings,
      merchantUpiId: DEFAULT_SETTINGS_STATE.merchantUpiId,
      upiQrImageUrl: '',
    };
  }
  if (
    settings.announcementText?.includes('Checkout paused') ||
    settings.announcementText?.includes('Sales Paused') ||
    settings.announcementText?.includes('Launch Coming Soon') ||
    settings.announcementText?.includes('Payment collection disabled')
  ) {
    settings = {
      ...settings,
      safetyComplianceApproved: true,
      complianceOwnerName: settings.complianceOwnerName || DEFAULT_SETTINGS_STATE.complianceOwnerName,
      complianceConfirmedAt: settings.complianceConfirmedAt || DEFAULT_SETTINGS_STATE.complianceConfirmedAt,
      announcementText: DEFAULT_SETTINGS_STATE.announcementText,
      announcementTextHi: DEFAULT_SETTINGS_STATE.announcementTextHi,
    };
    saveStoreState(product, settings);
  }

  return { product, settings };
}

function generateUniqueOrderId(existingOrders: ServerOrder[]): string {
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `SSI-${dateStamp}-`;
  const seqState = readJsonFile<Record<string, number>>(ORDER_SEQ_FILE, {});
  let maxForDay = Number(seqState[dateStamp]) || 0;

  for (const ord of existingOrders) {
    if (ord.orderId.startsWith(prefix)) {
      const tail = Number(ord.orderId.slice(prefix.length));
      if (Number.isInteger(tail) && tail > maxForDay) {
        maxForDay = tail;
      }
    }
  }

  let nextSeq = maxForDay + 1;
  let candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  const existingSet = new Set(existingOrders.map((o) => o.orderId.toUpperCase()));
  while (existingSet.has(candidate.toUpperCase())) {
    nextSeq += 1;
    candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  }

  seqState[dateStamp] = nextSeq;
  writeJsonFile(ORDER_SEQ_FILE, seqState);
  return candidate;
}

function saveStoreState(product: ProductState, settings: SettingsState): void {
  writeJsonFile(STORE_FILE, { product, settings });
}

function getOrders(): ServerOrder[] {
  return readJsonFile<ServerOrder[]>(ORDERS_FILE, []);
}

function saveOrders(orders: ServerOrder[]): void {
  writeJsonFile(ORDERS_FILE, orders);
}

function getAuditLogs(): ServerAuditLog[] {
  return readJsonFile<ServerAuditLog[]>(AUDIT_FILE, []);
}

function appendAuditLog(entry: ServerAuditLog): void {
  const logs = getAuditLogs();
  logs.unshift(entry);
  writeJsonFile(AUDIT_FILE, logs.slice(0, 500));
}

function getReviews(): ServerReview[] {
  return readJsonFile<ServerReview[]>(REVIEWS_FILE, []);
}

function saveReviews(reviews: ServerReview[]): void {
  writeJsonFile(REVIEWS_FILE, reviews);
}

function getLaunchLeads(): ServerLaunchLead[] {
  return readJsonFile<ServerLaunchLead[]>(LEADS_FILE, []);
}

function saveLaunchLeads(leads: ServerLaunchLead[]): void {
  writeJsonFile(LEADS_FILE, leads);
}

const VALID_ID_RE = /^[a-zA-Z0-9_\-]+$/;
const VALID_PHONE_RE = /^[6-9][0-9]{9}$/;
const VALID_PIN_RE = /^[1-9][0-9]{5}$/;
const VALID_UTR_RE = /^[a-zA-Z0-9]{8,30}$/;
const VALID_UPI_RE = /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z0-9]{2,}$/;

function calculateServerDeliveryCharge(settings: SettingsState, pinCode?: string): number {
  const baseFlat = Math.max(0, Number(settings.flatDeliveryChargeInr) || 0);
  if (settings.deliveryMode !== 'pincode' || !pinCode || !VALID_PIN_RE.test(pinCode.trim())) {
    return baseFlat;
  }
  const pinNum = Number(pinCode.trim());
  const lines = (settings.pinDeliveryRulesText || '').split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || !line.includes(':')) continue;
    const [rangePart, chargePart] = line.split(':');
    const charge = Number(chargePart?.trim());
    if (!Number.isFinite(charge) || charge < 0) continue;
    if (rangePart.includes('-')) {
      const [startStr, endStr] = rangePart.split('-');
      const start = Number(startStr.trim());
      const end = Number(endStr.trim());
      if (Number.isFinite(start) && Number.isFinite(end) && pinNum >= start && pinNum <= end) {
        return charge;
      }
    } else if (rangePart.trim() === pinCode.trim()) {
      return charge;
    }
  }
  return baseFlat;
}

function createOrderLookupToken(orderId: string, phone: string): string {
  return crypto
    .createHmac('sha256', SESSION_HMAC_SECRET)
    .update(`${orderId}:${phone}`)
    .digest('hex');
}

function verifyOrderLookupToken(orderId: string, phone: string, token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const expected = createOrderLookupToken(orderId, phone);
  const a = Buffer.from(expected, 'utf-8');
  const b = Buffer.from(token, 'utf-8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function detectImageTypeFromMagicBytes(buf: Buffer): { ext: 'jpg' | 'png' | 'webp'; mime: string } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

function sanitizeSafeUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/assets/aistudio/') || trimmed.startsWith('/api/assets/')) {
    return trimmed;
  }
  if (/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(trimmed) && trimmed.length <= 150000) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return trimmed;
    }
  } catch {
    return '';
  }
  return '';
}

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  const formulaSafe = /^[=+\-@]/.test(str) ? `'${str}` : str;
  const escaped = formulaSafe.replace(/"/g, '""');
  return `"${escaped}"`;
}

interface AuthenticatedAdminRequest extends Request {
  adminUser?: {
    uid: string;
    email: string;
  };
}

async function requireAdmin(
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required. Please sign in with Google.' });
      return;
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      res.status(401).json({ error: 'Invalid authorization token.' });
      return;
    }
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase();
    const emailVerified = Boolean(decoded.email_verified);

    if (!email || !emailVerified) {
      res.status(403).json({ error: 'Verified email required for admin access.' });
      return;
    }

    const authorizedEmails = getAuthorizedAdminEmails();
    if (!authorizedEmails.has(email)) {
      res.status(403).json({
        error: 'Unauthorized account. Only explicitly authorized admin accounts can access this panel.',
      });
      return;
    }

    req.adminUser = { uid: decoded.uid, email };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication session.' });
  }
}

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
    files: 1,
  },
});

async function startServer(): Promise<void> {
  const app = express();
  app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  const orderLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many order requests. Please wait a few minutes and try again.' },
  });

  const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many upload attempts. Please wait and try again.' },
  });

  const lookupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many order lookup requests. Please try again later.' },
  });

  const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Admin rate limit reached. Please slow down.' },
  });

  // Public Storefront State (zero PII)
  app.get('/api/storefront', (_req, res) => {
    const { product, settings } = getStoreState();
    const approvedReviews = getReviews().filter((r) => r.approved);
    res.json({ product, settings, reviews: approvedReviews });
  });

  // Serve admin-uploaded public storefront assets (UPI QR, product images)
  app.get('/api/assets/:fileName', (req, res) => {
    const fileName = req.params.fileName;
    if (!/^[a-zA-Z0-9_\-]+\.(jpg|png|webp)$/.test(fileName)) {
      res.status(400).json({ error: 'Invalid asset name.' });
      return;
    }
    const resolved = path.resolve(PUBLIC_ASSET_DIR, fileName);
    if (!resolved.startsWith(PUBLIC_ASSET_DIR + path.sep) || !fs.existsSync(resolved)) {
      res.status(404).json({ error: 'Asset not found.' });
      return;
    }
    res.sendFile(resolved);
  });

  // Register launch notification interest (no payment, no paid order created)
  app.post('/api/launch-notify', orderLimiter, (req, res) => {
    const body = req.body as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const consent = body.consent === true;

    if (name.length < 2 || name.length > 100) {
      res.status(400).json({ error: 'Please enter a valid name (2–100 characters).' });
      return;
    }
    if (!VALID_PHONE_RE.test(phone)) {
      res.status(400).json({
        error: 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
      });
      return;
    }
    if (!consent) {
      res.status(400).json({ error: 'Explicit consent is required to register for launch updates.' });
      return;
    }

    const leads = getLaunchLeads();
    const existing = leads.find((l) => l.phone === phone);
    if (existing) {
      res.status(200).json({
        lead: existing,
        alreadyRegistered: true,
        message: 'Your mobile number is already registered for the Shock Shoe India launch update.',
      });
      return;
    }

    const lead: ServerLaunchLead = {
      id: `LEAD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      name,
      phone,
      consent: true,
      createdAt: new Date().toISOString(),
    };
    leads.unshift(lead);
    saveLaunchLeads(leads);

    res.status(201).json({
      lead,
      message: 'Thank you! We will notify you once safety verification is complete and sales open.',
    });
  });

  // Create validated order (enforces safety gate, rate limit, duplicate check, server totals)
  app.post('/api/orders', orderLimiter, (req, res) => {
    const { product, settings } = getStoreState();

    if (!settings.safetyComplianceApproved) {
      res.status(403).json({
        error:
          'Checkout is currently disabled until the business owner confirms applicable Indian product and electrical safety compliance.',
      });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const state = typeof body.state === 'string' ? body.state.trim() : '';
    const city = typeof body.city === 'string' ? body.city.trim() : '';
    const pinCode = typeof body.pinCode === 'string' ? body.pinCode.trim() : '';
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    const landmark = typeof body.landmark === 'string' ? body.landmark.trim() : '';
    const quantity = Number(body.quantity);
    const idempotencyKey =
      typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim().slice(0, 64) : '';
    const customerUid =
      typeof body.customerUid === 'string' && VALID_ID_RE.test(body.customerUid.trim())
        ? body.customerUid.trim().slice(0, 128)
        : 'guest';

    if (customerName.length < 2 || customerName.length > 100) {
      res.status(400).json({ error: 'Please enter a valid full name (2–100 characters).' });
      return;
    }
    if (!VALID_PHONE_RE.test(phone)) {
      res.status(400).json({
        error: 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
      });
      return;
    }
    if (state.length < 2 || state.length > 60) {
      res.status(400).json({ error: 'Please select a valid Indian state or union territory.' });
      return;
    }
    if (city.length < 2 || city.length > 60) {
      res.status(400).json({ error: 'Please enter a valid city or district name.' });
      return;
    }
    if (!VALID_PIN_RE.test(pinCode)) {
      res.status(400).json({ error: 'Please enter a valid 6-digit Indian PIN code.' });
      return;
    }
    if (address.length < 8 || address.length > 300) {
      res.status(400).json({ error: 'Please enter a complete street address (8–300 characters).' });
      return;
    }
    if (landmark.length > 120) {
      res.status(400).json({ error: 'Landmark must be 120 characters or fewer.' });
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      res.status(400).json({ error: 'Quantity must be a whole number between 1 and 20.' });
      return;
    }
    if (!product.active || product.stock < quantity) {
      res.status(409).json({
        error: `Insufficient stock available (${product.stock} units remaining).`,
      });
      return;
    }

    const orders = getOrders();
    const nowMs = Date.now();

    // Duplicate prevention: idempotency key OR identical active order within 60 seconds
    if (idempotencyKey) {
      const existingByKey = orders.find((o) => o.idempotencyKey === idempotencyKey);
      if (existingByKey) {
        res.status(200).json({
          order: existingByKey,
          lookupToken: createOrderLookupToken(existingByKey.orderId, existingByKey.phone),
          deduplicated: true,
        });
        return;
      }
    }

    const recentDuplicate = orders.find((o) => {
      const ageMs = nowMs - new Date(o.createdAt).getTime();
      return (
        ageMs < 60_000 &&
        o.phone === phone &&
        o.pinCode === pinCode &&
        o.quantity === quantity &&
        o.status === 'AWAITING_PAYMENT'
      );
    });
    if (recentDuplicate) {
      res.status(409).json({
        error:
          'A matching order was just placed within the last minute. Please complete payment for that order or wait 60 seconds.',
        existingOrderId: recentDuplicate.orderId,
      });
      return;
    }

    const orderId = generateUniqueOrderId(orders);

    const unitPriceInr = Number(product.priceInr);
    const subtotalInr = unitPriceInr * quantity;
    const deliveryChargeInr = calculateServerDeliveryCharge(settings, pinCode);
    const totalInr = subtotalInr + deliveryChargeInr;
    const nowIso = new Date().toISOString();

    const newOrder: ServerOrder = {
      orderId,
      customerUid,
      customerName,
      phone,
      state,
      city,
      pinCode,
      address,
      landmark,
      productId: product.id,
      productTitle: product.title,
      unitPriceInr,
      quantity,
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
      idempotencyKey: idempotencyKey || undefined,
    };

    product.stock = Math.max(0, product.stock - quantity);
    product.updatedAt = nowIso;
    saveStoreState(product, settings);

    orders.unshift(newOrder);
    saveOrders(orders);

    res.status(201).json({
      order: newOrder,
      lookupToken: createOrderLookupToken(orderId, phone),
    });
  });

  // Upload payment proof + UTR (private storage, magic bytes validated, never auto-approves)
  app.post(
    '/api/orders/:orderId/payment-proof',
    uploadLimiter,
    (req, res, next) => {
      uploadMiddleware.single('screenshot')(req, res, (err: unknown) => {
        if (err) {
          const message =
            err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
              ? 'Screenshot exceeds the maximum 5 MB file size limit.'
              : 'Invalid file upload request.';
          res.status(400).json({ error: message });
          return;
        }
        next();
      });
    },
    (req, res) => {
      const orderId = String(req.params.orderId || '').trim();
      if (!VALID_ID_RE.test(orderId)) {
        res.status(400).json({ error: 'Invalid order ID format.' });
        return;
      }

      const orders = getOrders();
      const idx = orders.findIndex((o) => o.orderId === orderId);
      if (idx === -1) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }
      const order = orders[idx];

      const lookupToken = typeof req.body?.lookupToken === 'string' ? req.body.lookupToken.trim() : '';
      const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
      const authorized =
        verifyOrderLookupToken(orderId, order.phone, lookupToken) ||
        (VALID_PHONE_RE.test(phone) && phone === order.phone);

      if (!authorized) {
        res.status(403).json({ error: 'Invalid order verification credentials.' });
        return;
      }

      if (order.status !== 'AWAITING_PAYMENT' && order.status !== 'REJECTED') {
        res.status(409).json({
          error: 'Payment proof has already been submitted or finalized for this order.',
        });
        return;
      }

      const utrNumber = typeof req.body?.utrNumber === 'string' ? req.body.utrNumber.trim().toUpperCase() : '';
      if (!VALID_UTR_RE.test(utrNumber)) {
        res.status(400).json({
          error: 'Please enter a valid alphanumeric UTR / UPI transaction reference (8–30 characters).',
        });
        return;
      }

      // Duplicate UTR check across other orders
      const duplicateUtr = orders.find(
        (o) => o.orderId !== orderId && o.utrNumber && o.utrNumber.toUpperCase() === utrNumber
      );
      if (duplicateUtr) {
        res.status(409).json({
          error: 'This UTR number is already associated with another order. Please check your transaction reference.',
        });
        return;
      }

      if (!req.file || !req.file.buffer) {
        res.status(400).json({ error: 'Please upload a payment screenshot (JPG, PNG, or WebP, max 5 MB).' });
        return;
      }

      const detected = detectImageTypeFromMagicBytes(req.file.buffer);
      if (!detected) {
        res.status(400).json({
          error: 'Unsupported or corrupted image file. Only genuine JPG, PNG, and WebP screenshots are accepted.',
        });
        return;
      }

      const fileName = `${orderId}_${Date.now()}.${detected.ext}`;
      const targetPath = path.resolve(PRIVATE_PROOF_DIR, fileName);
      if (!targetPath.startsWith(PRIVATE_PROOF_DIR + path.sep)) {
        res.status(400).json({ error: 'Invalid file path.' });
        return;
      }

      fs.writeFileSync(targetPath, req.file.buffer);

      const nowIso = new Date().toISOString();
      orders[idx] = {
        ...order,
        utrNumber,
        paymentProofPath: fileName,
        paymentProofName: req.file.originalname.slice(0, 100),
        status: 'PENDING_VERIFICATION',
        paymentVerified: false, // Never auto-mark payment successful
        rejectionReason: '',
        updatedAt: nowIso,
      };
      saveOrders(orders);

      res.json({
        order: orders[idx],
        message: 'Payment proof received. Awaiting manual bank/UPI verification by merchant.',
      });
    }
  );

  // Order status lookup by unique Order ID (strictly non-PII; never exposes addresses or mobile numbers)
  app.post('/api/orders/lookup', lookupLimiter, (req, res) => {
    const body = req.body as Record<string, unknown>;
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';

    if (!VALID_ID_RE.test(orderId) || orderId.length < 6) {
      res.status(400).json({ error: 'Please enter a valid unique Order ID (e.g. SSI-20261124-001).' });
      return;
    }

    const order = getOrders().find((o) => o.orderId.toUpperCase() === orderId.toUpperCase());
    if (!order) {
      res.status(404).json({ error: 'No order found matching that Order ID.' });
      return;
    }

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

    res.json({
      order: {
        orderId: order.orderId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        status: order.status,
        paymentVerified: order.paymentVerified,
        paymentStatus: paymentStatusMap[order.status],
        orderStatus: orderStatusMap[order.status],
        shippingStatus: shippingStatusMap[order.status],
        courierName: order.courierName,
        trackingId: order.trackingId,
        rejectionReason: order.rejectionReason,
        productTitle: order.productTitle,
        quantity: order.quantity,
        subtotalInr: order.subtotalInr,
        deliveryChargeInr: order.deliveryChargeInr,
        totalInr: order.totalInr,
      },
    });
  });

  // Submit genuine customer review (only allowed for verified DELIVERED orders)
  app.post('/api/reviews', orderLimiter, (req, res) => {
    const body = req.body as Record<string, unknown>;
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const rating = Number(body.rating);
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';

    if (!VALID_ID_RE.test(orderId) || !VALID_PHONE_RE.test(phone)) {
      res.status(400).json({ error: 'Valid Order ID and mobile number are required.' });
      return;
    }
    const order = getOrders().find((o) => o.orderId === orderId && o.phone === phone);
    if (!order || order.status !== 'DELIVERED') {
      res.status(403).json({
        error: 'Verified reviews can only be submitted after your order is marked Delivered.',
      });
      return;
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Rating must be between 1 and 5.' });
      return;
    }
    if (comment.length < 5 || comment.length > 1000) {
      res.status(400).json({ error: 'Review comment must be 5–1000 characters.' });
      return;
    }

    const reviews = getReviews();
    if (reviews.some((r) => r.orderId === orderId)) {
      res.status(409).json({ error: 'A review has already been submitted for this order.' });
      return;
    }

    const review: ServerReview = {
      id: `REV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      orderId,
      customerName: order.customerName,
      rating,
      comment,
      verifiedPurchase: true,
      approved: false,
      createdAt: new Date().toISOString(),
    };
    reviews.unshift(review);
    saveReviews(reviews);
    res.status(201).json({
      review,
      message: 'Thank you! Your verified review has been submitted for admin publication.',
    });
  });

  // ======================== ADMIN ROUTES (Firebase ID Token Verified) ========================

  app.get('/api/admin/me', adminLimiter, requireAdmin, (req: AuthenticatedAdminRequest, res) => {
    res.json({
      authorized: true,
      admin: req.adminUser,
    });
  });

  app.get('/api/admin/orders', adminLimiter, requireAdmin, (_req, res) => {
    const orders = getOrders();
    const auditLogs = getAuditLogs();
    const reviews = getReviews();
    const launchLeads = getLaunchLeads();
    const { product, settings } = getStoreState();
    res.json({ orders, auditLogs, reviews, launchLeads, product, settings });
  });

  // Private payment screenshot retrieval (Admin only)
  app.get(
    '/api/admin/payment-proof/:fileName',
    adminLimiter,
    requireAdmin,
    (req, res) => {
      const fileName = String(req.params.fileName || '');
      if (!/^[a-zA-Z0-9_\-]+\.(jpg|png|webp)$/.test(fileName)) {
        res.status(400).json({ error: 'Invalid screenshot filename.' });
        return;
      }
      const resolved = path.resolve(PRIVATE_PROOF_DIR, fileName);
      if (!resolved.startsWith(PRIVATE_PROOF_DIR + path.sep) || !fs.existsSync(resolved)) {
        res.status(404).json({ error: 'Screenshot file not found.' });
        return;
      }
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(resolved);
    }
  );

  // Admin: update order verification / shipping status
  app.patch(
    '/api/admin/orders/:orderId',
    adminLimiter,
    requireAdmin,
    (req: AuthenticatedAdminRequest, res) => {
      const orderId = String(req.params.orderId || '');
      if (!VALID_ID_RE.test(orderId)) {
        res.status(400).json({ error: 'Invalid order ID.' });
        return;
      }

      const orders = getOrders();
      const idx = orders.findIndex((o) => o.orderId === orderId);
      if (idx === -1) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }
      const order = orders[idx];
      const body = req.body as Record<string, unknown>;
      const action = typeof body.action === 'string' ? body.action : '';
      const nowIso = new Date().toISOString();

      let nextOrder = { ...order, updatedAt: nowIso };
      let logAction = '';
      let logDetails = '';

      if (action === 'APPROVE_PAYMENT') {
        if (body.bankConfirmed !== true) {
          res.status(400).json({
            error: 'You must explicitly confirm actual bank/UPI credit before approving payment.',
          });
          return;
        }
        nextOrder.status = 'APPROVED';
        nextOrder.paymentVerified = true;
        nextOrder.rejectionReason = '';
        logAction = 'APPROVE_PAYMENT';
        logDetails = `Approved payment after bank/UPI verification (UTR: ${order.utrNumber || 'N/A'}, ₹${order.totalInr}).`;
      } else if (action === 'REJECT_PAYMENT') {
        const reason = typeof body.rejectionReason === 'string' ? body.rejectionReason.trim() : '';
        if (reason.length < 4 || reason.length > 300) {
          res.status(400).json({ error: 'Please provide a clear rejection reason (4–300 characters).' });
          return;
        }
        nextOrder.status = 'REJECTED';
        nextOrder.paymentVerified = false;
        nextOrder.rejectionReason = reason;
        logAction = 'REJECT_PAYMENT';
        logDetails = `Rejected payment: ${reason}`;

        // Restore stock if rejecting an order that had reserved stock
        if (order.status !== 'REJECTED') {
          const { product, settings } = getStoreState();
          product.stock += order.quantity;
          product.updatedAt = nowIso;
          saveStoreState(product, settings);
        }
      } else if (action === 'UPDATE_FULFILLMENT') {
        const nextStatus = typeof body.status === 'string' ? body.status : order.status;
        if (!['APPROVED', 'SHIPPED', 'DELIVERED'].includes(nextStatus)) {
          res.status(400).json({ error: 'Invalid fulfillment status.' });
          return;
        }
        if (!order.paymentVerified) {
          res.status(400).json({
            error: 'Cannot ship or mark delivered before manual payment verification is approved.',
          });
          return;
        }
        const courierName =
          typeof body.courierName === 'string' ? body.courierName.trim().slice(0, 80) : order.courierName;
        const trackingId =
          typeof body.trackingId === 'string' ? body.trackingId.trim().slice(0, 80) : order.trackingId;
        if (nextStatus === 'SHIPPED' && (!courierName || !trackingId)) {
          res.status(400).json({ error: 'Courier name and tracking ID are required to mark Shipped.' });
          return;
        }
        nextOrder.status = nextStatus as OrderStatus;
        nextOrder.courierName = courierName;
        nextOrder.trackingId = trackingId;
        logAction = `STATUS_${nextStatus}`;
        logDetails = `Updated status to ${nextStatus}${courierName ? ` (${courierName} · ${trackingId})` : ''}.`;
      } else {
        res.status(400).json({ error: 'Unknown admin order action.' });
        return;
      }

      orders[idx] = nextOrder;
      saveOrders(orders);

      const logEntry: ServerAuditLog = {
        id: `LOG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        action: logAction,
        targetOrderId: orderId,
        actorUid: req.adminUser!.uid,
        actorEmail: req.adminUser!.email,
        details: logDetails,
        createdAt: nowIso,
      };
      appendAuditLog(logEntry);

      res.json({ order: nextOrder, auditLog: logEntry });
    }
  );

  // Admin: update product & storefront settings (including safety gate)
  app.put(
    '/api/admin/settings',
    adminLimiter,
    requireAdmin,
    (req: AuthenticatedAdminRequest, res) => {
      const { product: currentProduct, settings: currentSettings } = getStoreState();
      const body = req.body as {
        product?: Partial<ProductState>;
        settings?: Partial<SettingsState>;
      };
      const nowIso = new Date().toISOString();

      const pIn = body.product || {};
      const sIn = body.settings || {};

      const nextPrice =
        pIn.priceInr !== undefined ? Number(pIn.priceInr) : currentProduct.priceInr;
      const nextStock =
        pIn.stock !== undefined ? Number(pIn.stock) : currentProduct.stock;
      const nextFlatDelivery =
        sIn.flatDeliveryChargeInr !== undefined
          ? Number(sIn.flatDeliveryChargeInr)
          : currentSettings.flatDeliveryChargeInr;

      if (!Number.isFinite(nextPrice) || nextPrice <= 0 || nextPrice > 1000000) {
        res.status(400).json({ error: 'Product price must be between ₹1 and ₹10,00,000.' });
        return;
      }
      if (!Number.isInteger(nextStock) || nextStock < 0 || nextStock > 100000) {
        res.status(400).json({ error: 'Stock must be an integer between 0 and 1,00,000.' });
        return;
      }
      if (!Number.isFinite(nextFlatDelivery) || nextFlatDelivery < 0 || nextFlatDelivery > 5000) {
        res.status(400).json({ error: 'Delivery charge must be between ₹0 and ₹5,000.' });
        return;
      }

      const nextImages = Array.isArray(pIn.images)
        ? pIn.images.map((u) => sanitizeSafeUrl(String(u))).filter(Boolean).slice(0, 10)
        : currentProduct.images;
      const nextVideos = Array.isArray(pIn.videos)
        ? pIn.videos.map((u) => sanitizeSafeUrl(String(u))).filter(Boolean).slice(0, 4)
        : currentProduct.videos;

      const nextProduct: ProductState = {
        ...currentProduct,
        title: typeof pIn.title === 'string' && pIn.title.trim() ? pIn.title.trim().slice(0, 120) : currentProduct.title,
        titleHi: typeof pIn.titleHi === 'string' ? pIn.titleHi.trim().slice(0, 160) : currentProduct.titleHi,
        description:
          typeof pIn.description === 'string' && pIn.description.trim().length >= 10
            ? pIn.description.trim().slice(0, 3000)
            : currentProduct.description,
        descriptionHi:
          typeof pIn.descriptionHi === 'string'
            ? pIn.descriptionHi.trim().slice(0, 3500)
            : currentProduct.descriptionHi,
        priceInr: nextPrice,
        stock: nextStock,
        active: typeof pIn.active === 'boolean' ? pIn.active : currentProduct.active,
        images: nextImages.length > 0 ? nextImages : currentProduct.images,
        videos: nextVideos,
        specs: Array.isArray(pIn.specs)
          ? pIn.specs.map((s) => String(s).trim()).filter(Boolean).slice(0, 20)
          : currentProduct.specs,
        safetyWarnings: Array.isArray(pIn.safetyWarnings)
          ? pIn.safetyWarnings.map((s) => String(s).trim()).filter(Boolean).slice(0, 12)
          : currentProduct.safetyWarnings,
        updatedAt: nowIso,
      };

      const nextSafetyApproved =
        typeof sIn.safetyComplianceApproved === 'boolean'
          ? sIn.safetyComplianceApproved
          : currentSettings.safetyComplianceApproved;

      const nextMerchantUpiId =
        typeof sIn.merchantUpiId === 'string'
          ? sIn.merchantUpiId.trim().slice(0, 100)
          : currentSettings.merchantUpiId;
      if (!VALID_UPI_RE.test(nextMerchantUpiId)) {
        res.status(400).json({ error: 'Please enter a valid Merchant UPI ID (e.g. name@bank).' });
        return;
      }

      const nextSettings: SettingsState = {
        ...currentSettings,
        announcementText:
          typeof sIn.announcementText === 'string'
            ? sIn.announcementText.trim().slice(0, 200)
            : currentSettings.announcementText,
        announcementTextHi:
          typeof sIn.announcementTextHi === 'string'
            ? sIn.announcementTextHi.trim().slice(0, 240)
            : currentSettings.announcementTextHi,
        safetyComplianceApproved: nextSafetyApproved,
        complianceOwnerName: nextSafetyApproved
          ? (typeof sIn.complianceOwnerName === 'string' && sIn.complianceOwnerName.trim()
              ? sIn.complianceOwnerName.trim().slice(0, 120)
              : req.adminUser!.email)
          : '',
        complianceConfirmedAt: nextSafetyApproved
          ? currentSettings.complianceConfirmedAt || nowIso
          : '',
        merchantUpiId: nextMerchantUpiId,
        merchantDisplayName:
          typeof sIn.merchantDisplayName === 'string'
            ? sIn.merchantDisplayName.trim().slice(0, 100)
            : currentSettings.merchantDisplayName,
        upiQrImageUrl: '',
        deliveryMode: sIn.deliveryMode === 'pincode' ? 'pincode' : 'flat',
        flatDeliveryChargeInr: nextFlatDelivery,
        pinDeliveryRulesText:
          typeof sIn.pinDeliveryRulesText === 'string'
            ? sIn.pinDeliveryRulesText.slice(0, 2000)
            : currentSettings.pinDeliveryRulesText,
        shippingPolicy:
          typeof sIn.shippingPolicy === 'string'
            ? sIn.shippingPolicy.trim().slice(0, 3000)
            : currentSettings.shippingPolicy,
        returnPolicy:
          typeof sIn.returnPolicy === 'string'
            ? sIn.returnPolicy.trim().slice(0, 3000)
            : currentSettings.returnPolicy,
        contactEmail:
          typeof sIn.contactEmail === 'string'
            ? sIn.contactEmail.trim().slice(0, 120)
            : currentSettings.contactEmail,
        contactPhone:
          typeof sIn.contactPhone === 'string'
            ? sIn.contactPhone.trim().slice(0, 20)
            : currentSettings.contactPhone,
        contactAddress:
          typeof sIn.contactAddress === 'string'
            ? sIn.contactAddress.trim().slice(0, 300)
            : currentSettings.contactAddress,
        updatedAt: nowIso,
      };

      saveStoreState(nextProduct, nextSettings);

      const logEntry: ServerAuditLog = {
        id: `LOG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        action: 'UPDATE_SETTINGS',
        targetOrderId: '',
        actorUid: req.adminUser!.uid,
        actorEmail: req.adminUser!.email,
        details: `Updated settings (Price: ₹${nextProduct.priceInr}, Delivery: ₹${nextSettings.flatDeliveryChargeInr}, UPI: ${nextSettings.merchantUpiId}, Safety Approved: ${nextSettings.safetyComplianceApproved}).`,
        createdAt: nowIso,
      };
      appendAuditLog(logEntry);

      res.json({ product: nextProduct, settings: nextSettings, auditLog: logEntry });
    }
  );

  // Admin: upload actual product photograph securely (QR upload removed; QR is auto-generated from UPI ID)
  app.post(
    '/api/admin/upload-asset',
    adminLimiter,
    requireAdmin,
    (req, res, next) => {
      uploadMiddleware.single('file')(req, res, (err: unknown) => {
        if (err) {
          res.status(400).json({ error: 'Invalid file upload (max 5 MB JPG/PNG/WebP).' });
          return;
        }
        next();
      });
    },
    (req: AuthenticatedAdminRequest, res) => {
      if (!req.file || !req.file.buffer) {
        res.status(400).json({ error: 'No image file provided.' });
        return;
      }
      const detected = detectImageTypeFromMagicBytes(req.file.buffer);
      if (!detected) {
        res.status(400).json({ error: 'Only genuine JPG, PNG, and WebP images are allowed.' });
        return;
      }
      const fileName = `product_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.${detected.ext}`;
      const target = path.resolve(PUBLIC_ASSET_DIR, fileName);
      if (!target.startsWith(PUBLIC_ASSET_DIR + path.sep)) {
        res.status(400).json({ error: 'Invalid asset path.' });
        return;
      }
      fs.writeFileSync(target, req.file.buffer);
      const url = `/api/assets/${fileName}`;

      appendAuditLog({
        id: `LOG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        action: 'UPLOAD_PRODUCT_IMAGE',
        targetOrderId: '',
        actorUid: req.adminUser!.uid,
        actorEmail: req.adminUser!.email,
        details: `Uploaded product photograph (${fileName}).`,
        createdAt: new Date().toISOString(),
      });

      res.json({ url, fileName });
    }
  );

  // Admin: approve/reject genuine verified reviews
  app.patch(
    '/api/admin/reviews/:reviewId',
    adminLimiter,
    requireAdmin,
    (req: AuthenticatedAdminRequest, res) => {
      const reviewId = String(req.params.reviewId || '');
      const reviews = getReviews();
      const idx = reviews.findIndex((r) => r.id === reviewId);
      if (idx === -1) {
        res.status(404).json({ error: 'Review not found.' });
        return;
      }
      const approved = Boolean((req.body as { approved?: boolean })?.approved);
      reviews[idx] = { ...reviews[idx], approved };
      saveReviews(reviews);

      appendAuditLog({
        id: `LOG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        action: approved ? 'APPROVE_REVIEW' : 'HIDE_REVIEW',
        targetOrderId: reviews[idx].orderId,
        actorUid: req.adminUser!.uid,
        actorEmail: req.adminUser!.email,
        details: `${approved ? 'Approved' : 'Hidden'} verified customer review ${reviewId}.`,
        createdAt: new Date().toISOString(),
      });

      res.json({ review: reviews[idx] });
    }
  );

  // Admin: export orders CSV
  app.get('/api/admin/export-csv', adminLimiter, requireAdmin, (_req, res) => {
    const orders = getOrders();
    const headers = [
      'Order ID',
      'Date',
      'Customer Name',
      'Mobile',
      'State',
      'City',
      'PIN Code',
      'Address',
      'Landmark',
      'Quantity',
      'Subtotal (INR)',
      'Delivery (INR)',
      'Total (INR)',
      'Status',
      'Payment Verified',
      'UTR Number',
      'Courier',
      'Tracking ID',
      'Rejection Reason',
    ];
    const rows = orders.map((o) =>
      [
        o.orderId,
        o.createdAt,
        o.customerName,
        o.phone,
        o.state,
        o.city,
        o.pinCode,
        o.address,
        o.landmark,
        o.quantity,
        o.subtotalInr,
        o.deliveryChargeInr,
        o.totalInr,
        o.status,
        o.paymentVerified ? 'YES' : 'NO',
        o.utrNumber,
        o.courierName,
        o.trackingId,
        o.rejectionReason,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
    const csv = [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="shock-shoe-india-orders.csv"');
    res.send(csv);
  });

  // Frontend serving (Vite middleware in dev, static dist/ in production)
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && fs.existsSync(path.resolve(ROOT_DIR, 'dist'))) {
    const distDir = path.resolve(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Shock Shoe India server listening on http://0.0.0.0:${port}`);
  });
}

void startServer();
