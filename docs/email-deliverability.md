# Email Deliverability & Technical DNS Configuration Guide

## 1. Overview & Objectives
Maintaining high inbox placement and domain reputation requires robust DNS authentication, strict sending hygiene, domain reputation monitoring, and gradual volume scaling.

---

## 2. Mandatory DNS Authentication Records

To prevent spoofing, impersonation, and spam folder placement, configure the following DNS records on your sending domain (e.g. `mail.projectauro.com`):

### A. Sender Policy Framework (SPF)
Authorizes specific IP addresses or server relays to send on behalf of your domain:
```dns
Type:  TXT
Host:  @ (or subdomain mail)
Value: v=spf1 include:_spf.google.com include:sendgrid.net ~all
```

### B. DomainKeys Identified Mail (DKIM)
Provides cryptographic signature proof that the email was sent by the domain owner and unmodified in transit:
```dns
Type:  TXT
Host:  auro._domainkey.mail.projectauro.com
Value: v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC3...
```

### C. Domain-based Message Authentication, Reporting & Conformance (DMARC)
Specifies how receiving mail servers should treat messages that fail SPF or DKIM checks, and enables automated delivery reporting:
```dns
Type:  TXT
Host:  _dmarc.mail.projectauro.com
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@projectauro.com; ruf=mailto:dmarc-forensics@projectauro.com; pct=100; sp=reject
```

---

## 3. Recommended Warm-Up Schedule & Volume Ramps

When launching a new sending domain or IP address, follow the phased warm-up ramp:

| Phase | Days | Daily Volume Limit | Interval Between Sends | Focus / Best Practice |
|-------|------|--------------------|------------------------|-----------------------|
| **Phase 1: Seed & Handshake** | Days 1–3 | 10 emails / day | 120–180 seconds | Send only to high-affinity contacts; verify 0 bounces |
| **Phase 2: Initial Scaling** | Days 4–7 | 25 emails / day | 60–90 seconds | Monitor open rates (>40%) and spam complaint rate (<0.1%) |
| **Phase 3: Ramp-up** | Days 8–14 | 50 emails / day | 30–60 seconds | Stagger delivery across working hours (9 AM – 5 PM IST) |
| **Phase 4: Steady State** | Days 15+ | 100+ emails / day | 15–30 seconds | Automated per-domain throttling active (max 3/domain/day) |

---

## 4. Deliverability Safeguards Embedded in Project Auro

1. **RFC-Compliant List-Unsubscribe Header**: Includes `List-Unsubscribe: <https://app.projectauro.com/api/email/unsubscribe?token=...>` enabling one-click unsubscribe in Apple Mail, Gmail, and Outlook.
2. **Reverse DNS (rDNS / PTR)**: Outbound SMTP relays must have matching forward and reverse DNS records.
3. **Automated Bounce Circuit Breaker**: Immediate suppression on 5xx permanent delivery failures.
4. **Reputation Monitoring**: Track bounce rate (must remain < 2%) and spam complaint rate (must remain < 0.05%).
