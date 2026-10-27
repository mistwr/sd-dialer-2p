# Neural OS — isolated read-only proof of concept

Status: **not deployed, not wired to any route, no production changes**.

## Implemented
- `lib/neural-os/authorization.ts`: pure default-deny authorization contract.
- Read capabilities: `lead.read`, `call.read`.
- Write capabilities (calls, lead updates, follow-ups, agent config) are always denied, with human approval required.
- Rejects inactive identities, absent company IDs, cross-company resources and partner-owned resources not assigned to the caller.

## Important boundaries
- The pure contract is an additional gate, **not** a replacement for Supabase RLS, verified server-side identity or per-endpoint authorization.
- `isSuperAdmin` must come from a verified server-side profile, never from the request body.
- This prototype intentionally keeps even superadmins within the active company context.
- Never send the Supabase service-role key, Twilio credentials or LiveKit secrets to agents or the browser.
- Consent for contact and transcription is declared to exist in customer agreements; before outbound execution, verify scope, current status, opt-outs and evidence linkage. Transcription authorization must not be inferred from a hardcoded database value.
- Do not invoke the existing outbound endpoint in dry-run mode: its implementation can create leads and initiate LiveKit calls.

## Acceptance checks before enabling integration
1. Missing or inactive identity -> denied.
2. Cross-company resource -> denied for every role.
3. Partner reading another partner's assigned resource -> denied.
4. Partner reading own assigned resource -> allowed.
5. Admin/supervisor reading within their company -> allowed.
6. Every write capability -> denied, requires approval.
7. Confirm Supabase RLS and service-role routes enforce equivalent server-side restrictions.
8. Verify no production deployment is connected to this branch.
9. Run build, unit tests and integration tests in an isolated environment with synthetic data.

## Next step
Add a server-side read-only adapter using verified session/profile and explicit `company_id` filtering, then add automated tests. No automatic calling, mutation, transcription or background jobs until the security review is complete.
