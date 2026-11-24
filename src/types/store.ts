export type OrderStatus =
  | 'AWAITING_PAYMENT'
  | 'PENDING_VERIFICATION'
  | 'APPROVED'
  | 'REJECTED'
  | 'SHIPPED'
  | 'DELIVERED';

export type DeliveryMode = 'flat' | 'pincode';

export type Language = 'en' | 'hi';

export interface ProductData {
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

export interface StorefrontSettings {
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
  deliveryMode: DeliveryMode;
  flatDeliveryChargeInr: number;
  pinDeliveryRulesText: string;
  shippingPolicy: string;
  returnPolicy: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  updatedAt: string;
}

export interface OrderRecord {
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
  lookupToken?: string;
}

export interface OrderTrackingInfo {
  orderId: string;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  paymentVerified: boolean;
  paymentStatus: string;
  orderStatus: string;
  shippingStatus: string;
  courierName: string;
  trackingId: string;
  rejectionReason: string;
  productTitle: string;
  quantity: number;
  subtotalInr: number;
  deliveryChargeInr: number;
  totalInr: number;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  targetOrderId: string;
  actorUid: string;
  actorEmail: string;
  details: string;
  createdAt: string;
}

export interface VerifiedReview {
  id: string;
  orderId: string;
  customerName: string;
  rating: number;
  comment: string;
  verifiedPurchase: boolean;
  approved: boolean;
  createdAt: string;
}

export interface LaunchLead {
  id: string;
  name: string;
  phone: string;
  consent: boolean;
  createdAt: string;
}

export const VALIDATION_PATTERNS = {
  ID: /^[a-zA-Z0-9_\-]+$/,
  INDIAN_PHONE: /^[6-9][0-9]{9}$/,
  INDIAN_PIN: /^[1-9][0-9]{5}$/,
  UTR: /^[a-zA-Z0-9]{8,30}$/,
  UPI_ID: /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z0-9]{2,}$/,
};

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Chandigarh',
  'Jammu and Kashmir',
  'Ladakh',
  'Puducherry',
] as const;

export const DEFAULT_PRODUCT: ProductData = {
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

export const DEFAULT_SETTINGS: StorefrontSettings = {
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

export function calculateDeliveryCharge(
  settings: StorefrontSettings,
  pinCode?: string
): number {
  const baseFlat = Math.max(0, Number(settings.flatDeliveryChargeInr ?? 199));
  if (settings.deliveryMode !== 'pincode' || !pinCode || !VALIDATION_PATTERNS.INDIAN_PIN.test(pinCode.trim())) {
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

export function calculateOrderTotals(
  unitPriceInr: number,
  quantity: number,
  settings: StorefrontSettings,
  pinCode?: string
): {
  quantity: number;
  unitPriceInr: number;
  subtotalInr: number;
  deliveryChargeInr: number;
  totalInr: number;
} {
  const safeQty = Math.max(0, Math.floor(Number(quantity) || 0));
  const safePrice = Math.max(0, Number(unitPriceInr) || 0);
  const subtotalInr = safeQty * safePrice;
  const deliveryChargeInr = safeQty > 0 ? calculateDeliveryCharge(settings, pinCode) : 0;
  return {
    quantity: safeQty,
    unitPriceInr: safePrice,
    subtotalInr,
    deliveryChargeInr,
    totalInr: subtotalInr + deliveryChargeInr,
  };
}

export function buildUpiPaymentUri(options: {
  upiId: string;
  merchantName?: string;
  amount?: number;
  orderId?: string;
  note?: string;
}): string {
  const params = new URLSearchParams();
  params.set('pa', options.upiId.trim());
  params.set('pn', (options.merchantName || 'Shock Shoe India').trim());
  if (typeof options.amount === 'number' && Number.isFinite(options.amount) && options.amount > 0) {
    params.set('am', options.amount.toFixed(2));
  }
  params.set('cu', 'INR');
  if (options.orderId) {
    params.set('tr', options.orderId);
    params.set('tn', `Order ${options.orderId}`);
  } else if (options.note) {
    params.set('tn', options.note);
  }
  return `upi://pay?${params.toString()}`;
}

export function formatInr(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}
