/**
 * Security Rules Reference Spec (Dirty Dozen Invariants)
 * Run against Firebase Emulator Suite (`firebase emulators:exec`) when available.
 */
export const DIRTY_DOZEN_CASES = [
  '1. Unauthenticated get on /orders/{orderId} -> PERMISSION_DENIED',
  '2. Cross-customer get on /orders/{otherOrderId} -> PERMISSION_DENIED',
  '3. Unscoped list on /orders by non-admin -> PERMISSION_DENIED',
  '4. Non-owner create on /adminUsers/{uid} -> PERMISSION_DENIED',
  '5. Unverified email claim spoofing admin -> PERMISSION_DENIED',
  '6. Customer create /orders with status=APPROVED -> PERMISSION_DENIED',
  '7. Shadow field injection on /orders create -> PERMISSION_DENIED',
  '8. Customer tampering totalInr on /orders update -> PERMISSION_DENIED',
  '9. Customer mutating /orders after APPROVED -> PERMISSION_DENIED',
  '10. Delete or update on /auditLogs/{logId} -> PERMISSION_DENIED',
  '11. Overlong/invalid path ID on /orders/{badId} -> PERMISSION_DENIED',
  '12. Non-admin update on /settings/storefront -> PERMISSION_DENIED',
] as const;
