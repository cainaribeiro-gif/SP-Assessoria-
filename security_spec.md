# Security Spec: Zero-Trust Firebase Rules TDD

## 1. Data Invariants

1. **Leads (`/leads/{leadId}`)**:
   - Any guest visitor can write (create) a lead.
   - Lead creation payloads must contain at least `name` and `phone` with strictly limited lengths (maximum 100 characters for `name`, 30 for `phone`).
   - The `status` on creation must strictly be `"Novo"`. Guests cannot inject statuses like `"Concluído"` (State short-cutting) or create fake leads with fake fields.
   - Only Authenticated Administrators can read (`get`, `list`), update, or delete lead documents.
   - Timestamps/dates cannot be spoofed.

2. **Site Data (`/siteData/{docId}`)**:
   - Public visitors (both guest and authenticated) can only read (`get`) site configuration documents. Listing is denied.
   - Only Authenticated Administrators can update the site configuration document.
   - No one can create or delete documents in the `siteData` collection to prevent deleting the site's main content layout.

3. **Admin Identification**:
   - Authorized administrators are verified by looking up their authenticated UID or validating their authenticated email (`cainapribeiro@gmail.com` or `atendimento@sprecursosadm.com.br`) and ensuring `request.auth.token.email_verified == true`.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following 12 payloads are designed to attack the database structure. The security rules MUST reject every single one of them.

### Payload 1: Lead Creation without Required Fields (Missing Phone)
- **Target Path**: `/leads/attacker_lead_1`
- **Operation**: `create`
- **Identity**: Unauthenticated (Guest)
- **Payload**:
  ```json
  {
    "name": "Ataque Sem Telefone",
    "email": "attack@attacker.com",
    "message": "Falta o telefone obrigatório"
  }
  ```
- **Reason for rejection**: Missing the required `phone` property.

### Payload 2: Lead Creation with Excessive Data Size (Denial of Wallet)
- **Target Path**: `/leads/attacker_lead_2`
- **Operation**: `create`
- **Identity**: Unauthenticated (Guest)
- **Payload**:
  ```json
  {
    "name": "Super Long Name " + "[10,000 characters repeating...]",
    "phone": "999999999",
    "message": "Envio gigante"
  }
  ```
- **Reason for rejection**: Violates string size limits on name.

### Payload 3: Lead Creation with Spoofed Status (State Short-cutting)
- **Target Path**: `/leads/attacker_lead_3`
- **Operation**: `create`
- **Identity**: Unauthenticated (Guest)
- **Payload**:
  ```json
  {
    "name": "Joao da Silva",
    "phone": "(11) 98765-4321",
    "status": "Concluído",
    "type": "Contato"
  }
  ```
- **Reason for rejection**: New leads must always start with the `"Novo"` status.

### Payload 4: Lead Creation with Fake Fields (Ghost Fields / Shadow Update)
- **Target Path**: `/leads/attacker_lead_4`
- **Operation**: `create`
- **Identity**: Unauthenticated (Guest)
- **Payload**:
  ```json
  {
    "name": "Alice Silva",
    "phone": "(11) 98765-4321",
    "status": "Novo",
    "type": "Contato",
    "isAdminUser": true,
    "systemOverridden": "yes"
  }
  ```
- **Reason for rejection**: Payload contains un-whitelisted schema fields.

### Payload 5: Anonymous Lead Reading (PII Leak Attack)
- **Target Path**: `/leads/lead-1`
- **Operation**: `get`
- **Identity**: Unauthenticated (Guest)
- **Payload**: `null`
- **Reason for rejection**: Only verified administrators can read customer leads.

### Payload 6: Signed-in Non-Admin Lead Reading (PII Blanket Attack)
- **Target Path**: `/leads/lead-1`
- **Operation**: `get`
- **Identity**: Signed-in user without Admin role (e.g., normal client UID `client123`)
- **Payload**: `null`
- **Reason for rejection**: Only administrator accounts can query lead PII.

### Payload 7: Anonymous Site Config Overwrite
- **Target Path**: `/siteData/main`
- **Operation**: `update`
- **Identity**: Unauthenticated (Guest)
- **Payload**:
  ```json
  {
    "siteConfig": { "phone": "550000000" }
  }
  ```
- **Reason for rejection**: Guests are forbidden from writing to siteData.

### Payload 8: Normal Signed-in User Site Config Overwrite (Privilege Escalation)
- **Target Path**: `/siteData/main`
- **Operation**: `update`
- **Identity**: Authenticated Non-Admin User (e.g., UID `user123`)
- **Payload**:
  ```json
  {
    "siteConfig": { "phone": "550000000" }
  }
  ```
- **Reason for rejection**: Non-admins are blocked from editing application configurations.

### Payload 9: Unverified Admin Email Hijacking (Email Spoofing Attack)
- **Target Path**: `/siteData/main`
- **Operation**: `update`
- **Identity**: Authenticated User with email `atendimento@sprecursosadm.com.br` but `email_verified == false`
- **Payload**:
  ```json
  {
    "siteConfig": { "phone": "55119999999" }
  }
  ```
- **Reason for rejection**: Email domain claim is only trusted when `email_verified == true`.

### Payload 10: Anonymous Deleting Site Configuration
- **Target Path**: `/siteData/main`
- **Operation**: `delete`
- **Identity**: Authenticated Admin
- **Payload**: `null`
- **Reason for rejection**: Deleting critical system layout collections is structurally disabled.

### Payload 11: Lead Modification to Bypass String validation (Value Poisoning)
- **Target Path**: `/leads/lead-1`
- **Operation**: `update`
- **Identity**: Authenticated Admin
- **Payload**:
  ```json
  {
    "name": 12345,
    "phone": "999999999"
  }
  ```
- **Reason for rejection**: The type of `name` must be a string.

### Payload 12: Lead Status Injection by Non-Admin
- **Target Path**: `/leads/lead-1`
- **Operation**: `update`
- **Identity**: Signed-in Non-Admin
- **Payload**:
  ```json
  {
    "status": "Concluído"
  }
  ```
- **Reason for rejection**: Only admins can perform lead state transitions.

---

## 3. Test Assertions

These payloads serve as a checklist. Our Firestore Security Rules must ensure that all 12 scenarios fail with a `PERMISSION_DENIED` error, maintaining bulletproof perimeter safety.
