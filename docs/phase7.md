# Phase 7 operator guide

## Account setup

Set DATABASE_URL, NEXTAUTH_URL (the public HTTPS origin) and NEXTAUTH_SECRET in the server environment. INQUIRY_ORIGIN must match the browser origin. Run `npm run db:migrate` to apply the checked-in migrations. GitHub OAuth credentials are optional for password sign-in.

For the first administrator, inject DATABASE_URL through the operator environment. Run the following in zsh. Enter the real email and a unique, generated temporary password when prompted. The password prompt hides input and keeps the value out of shell history.

```zsh
(
  read 'NEXORA_ADMIN_EMAIL?Administrator email: ' || exit 1
  read -rs 'NEXORA_ADMIN_PASSWORD?Temporary password: ' || exit 1
  echo
  export NEXORA_ADMIN_EMAIL NEXORA_ADMIN_PASSWORD
  npm run admin:provision
)
```

Sign in at /sign-in. Change the temporary password at the required prompt and sign in again. Repeating the provisioning command for the same Super Admin preserves the password. A conflicting account or second initial administrator causes the command to fail.

For recovery, use the same protected operator environment and replace the final command with `npm run admin:recover -- rotate`. This requires a fresh temporary password and forces a change at sign-in. The actions `revoke`, `disable` and `enable` need only DATABASE_URL and NEXORA_ADMIN_EMAIL. Each revokes all sessions and outstanding account links and creates an audit entry. Account holders can change their own passwords from /account/security.

## Email

Configure SMTP_HOST, SMTP_PORT, SMTP_FROM and any required SMTP_USER and SMTP_PASSWORD. Remote SMTP requires TLS. Without delivery configuration, registration and reset requests return a service-unavailable response. For a local Mailpit instance, bind SMTP and its web UI to loopback, set SMTP_HOST=127.0.0.1, SMTP_PORT=1025, SMTP_FROM=accounts@example.test, and use http://127.0.0.1:3000 for NEXTAUTH_URL and INQUIRY_ORIGIN. Submit /register, open the message in Mailpit and verify with the registration password. For password recovery, submit /account/forgot-password and choose a new password from the emailed link. Both links expire after 20 minutes. Treat mailbox contents as secrets.

## Operations

Open /operations for scoped admissions, academic, finance or placement tools. Super Admin controls also cover account disabling, revocation, staff scopes and an audit view. Existing unscoped administrators retain their previous administrator permissions. Specialist staff use their scoped operations routes. A finance export groups verified amounts in minor units by currency. Refund requests record an internal request and reserve the requested amount for review. Provider settlement is a separate operation.

Only a Super Admin can approve a paid enrollment held for eligibility or capacity review. This rechecks the captured amount, currency, admission, assessment, terms, available seat and refund state. Approval and audit reason commit in the same transaction.

## Test setup

Use a disposable PostgreSQL database with nexora_phase1 in its name. Point DATABASE_URL and TEST_DATABASE_URL at it, run `npm run db:migrate`, then `npm run db:seed`. Run `npm run test:db` and `npm test`. Build with `npm run build` before running `npm run test:e2e`. CAPTURE_PHASE7=1 captures desktop and mobile finance screens during the Phase 7 browser tests.
