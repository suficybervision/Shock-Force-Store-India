# Security Specification & Payload-First TDD — Shock Shoe India

## 1. Data Invariants
1. `orders/{orderId}` contains shipping PII (full name, mobile number, street address, PIN code) and may ONLY be read (`get` / `list`) by an authorized verified Admin or the authenticated order owner (`customerUid == request.auth.uid`).
2. `orders/{orderId}` creation by non-admin users is strictly locked to `status == 'AWAITING_PAYMENT'` and `paymentVerified == false`, and `customerUid == request.auth.uid`.
3. Non-admin customers may ONLY transition an order once from `AWAITING_PAYMENT` to `PENDING_VERIFICATION` updating strictly `['utrNumber', 'paymentProofPath', 'paymentProofName', 'status', 'updatedAt']`, and can never set `paymentVerified: true` or `APPROVED`/`SHIPPED`/`DELIVERED`.
4. `settings/storefront` and `products/{productId}` contain zero PII and can only be mutated by verified Admins.
5. `adminUsers/{adminUid}` cannot be self-registered by regular users; only the bootstrapped owner or existing verified super-admin path can manage `adminUsers`.
6. `auditLogs/{logId}` is strictly append-only by verified Admins; updates and deletes are unconditionally denied.
7. Every string field enforces strict `.size()` bounds; every ID matches `^[a-zA-Z0-9_\-]+$`; every Indian mobile matches `^[6-9][0-9]{9}$`; every Indian PIN code matches `^[1-9][0-9]{5}$`; timestamps must equal `request.time`.

## 2. Dirty Dozen Attack Payloads (All Expected: PERMISSION_DENIED)
1. **Unauthenticated Order Read**: Unauthenticated client requests `get(/orders/SSI-20261123-0001)` -> Denied.
2. **Cross-Customer Order Read**: Signed-in User B requests `get(/orders/order-of-user-A)` -> Denied.
3. **Unscoped Order List**: Signed-in non-admin requests `list(/orders)` without matching `customerUid` -> Denied.
4. **Privilege Escalation via Self-Admin**: Signed-in User B attempts `create(/adminUsers/{uidB})` with `{ role: 'admin', active: true }` -> Denied.
5. **Email Spoofing Attack**: User with matching admin email string but `email_verified == false` attempts admin write -> Denied.
6. **Payment Bypass on Order Create**: Customer attempts `create(/orders/SSI-1)` with `status: 'APPROVED'` or `paymentVerified: true` -> Denied.
7. **Shadow Field Injection**: Customer attempts `create(/orders/SSI-1)` with extra ghost field `isAdminApproved: true` -> Denied (`hasOnly`).
8. **Customer Tampering Total/Status**: Customer attempts `update(/orders/SSI-1)` changing `totalInr` from `348` to `1` -> Denied (`affectedKeys().hasOnly(...)`).
9. **Post-Approval Mutation by Customer**: Customer attempts to overwrite `utrNumber` after order is `APPROVED` -> Denied (`existing().status == 'AWAITING_PAYMENT'`).
10. **Audit Log Deletion / Forgery**: Admin or user attempts `delete(/auditLogs/log1)` or `update(/auditLogs/log1)` -> Denied.
11. **Path ID Poisoning**: Client attempts `create(/orders/../../bad_id_longer_than_128_chars...)` -> Denied (`isValidId`).
12. **Public Settings Overwrite**: Non-admin attempts `update(/settings/storefront)` to toggle `safetyComplianceApproved: true` -> Denied.
