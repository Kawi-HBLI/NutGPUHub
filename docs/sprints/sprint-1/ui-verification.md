# UI-01 Visual Consistency and Verification

UI-01 (#6) applies one presentation system to the accepted F-01 to F-04 screens. The baseline screenshots were captured from staging `81a730038a6d9ed41584a54d48c8e1033af6d0f0`. The linked PR identifies the committed UI implementation corresponding to the checks below. Execution-version and release-evidence guidance remains in the [central verification record](verification.md).

## Presentation design

`client/styles.css` owns the color, type, spacing and radius tokens. The palette uses a warm light canvas, white surfaces and a dark orange primary action (`#b33d00`), with a blue focus outline that stays distinct from the primary color. Available, booked, started/past and error states have distinct colors and visible text. The original microchip wordmark is inline SVG and uses `currentColor`; fonts are local system fonts.

`client/components.tsx` supplies Button, Input, Select, Card, Table, StatusBadge, Alert and Brand. Sign-in and both workspaces use these components. Student reservations remain semantic lists; the operator schedule uses a captioned table. Desktop layouts separate primary work and supporting information; narrow screens stack those sections.

The student workspace separates availability, saved booking detail and My Bookings. The operator workspace separates opening slots from reading the schedule. Existing API calls, handlers, validation, access rules and E2E messages remain intact. Started/past labels describe slot time at render time using the browser clock; the server continues to decide whether a booking is permitted.

## Acceptance checks

| Criterion | Check and actual result |
|---|---|
| UI-AC-01: shared tokens/components | No hexadecimal color literals or inline style attributes in TSX page files. Shared controls and state components are used across sign-in, student and operator screens. Source/API/test/dependency scope was inspected. |
| UI-AC-02: contrast | Browser-loaded CSS tokens were checked for 12 foreground/background text pairs. Minimum ratio 5.7455:1. axe-core 4.14.0 ran 19 checks across screens, widths and feedback states with zero WCAG-tagged violations and no incomplete checks. These results were recorded on the earlier green palette. After the dark orange change, a calculated check of the new token pairs gives a minimum text contrast of 5.30:1 (accent on canvas); axe has not been rerun on the new palette. |
| UI-AC-03: keyboard focus | Tab traversal checked 4 distinct controls on sign-in, 11 on the student screen and 6 on the operator screen. Each inspected control had a visible 3px focus outline. A native date-field focus gap found during QA was fixed with `:focus-within`. A skip link reaches the main content. |
| UI-AC-04: feedback | Loading, empty availability, empty My Bookings, invalid credentials, data-load error/retry, booking conflict, operator rejection and past booking states were exercised. Feedback uses the shared Alert/StatusBadge components; errors retain `role="alert"` and success retains `role="status"`. |

Automated axe checks and keyboard traversal cover the checks above; they are not a complete screen-reader or WCAG conformance audit. No assistive-technology session was performed.

## Responsive and regression checks

- 15 before screenshots and 25 after/state screenshots were retained locally. The normal screen captures use 375, 768 and 1440px widths.
- 245 viewport checks passed without horizontal page overflow: the three primary surfaces were checked from 320 to 1440px in 16px steps plus breakpoint-adjacent widths; student and operator screens were also checked with an 80-character username.
- Zero browser page errors were observed in the captured journeys. Intentional rejected requests and simulated failures were used to verify error states.
- `npm test`: 35 passed, 0 failed, 0 skipped across 6 files. Existing test files and assertions were unchanged.
- `npm run build`: both TypeScript configurations and the Vite build passed.
- `npm run test:e2e`: TC-E2E-01 and TC-E2E-02 passed unchanged, including saved retrieval, operator visibility, stale-availability conflict and sign-out.
- `npm run verify:restart`: passed with the same saved booking/session readable after stopping and starting different Node processes.
- A separate read-only code review found no actionable API, workflow or accessibility regression. The parent then verified the rendered screens and the native date-field correction.

All runs used isolated synthetic PostgreSQL data. Raw output, contrast ratios, axe results, viewport/focus observations and the local QA script are under the ignored `evidence/ui-01/` directory. The screenshot comparison is a visual review of an intentional restyle, not a zero-pixel-difference claim.

## Before and after screenshots

The screenshots below use synthetic accounts and show the earlier green palette; layout and states are unchanged by the later color change. Record IDs can differ because each capture run creates fresh fixtures. The saved-booking screen includes My Bookings; the operator screen includes both machine selection and the daily schedule.

| Screen/state | Before (1440px) | After (1440px) |
|---|---|---|
| Sign-in | [Before](images/ui-01/before-sign-in.png) | [After](images/ui-01/after-sign-in.png) |
| Operator machine selection and open schedule | [Before](images/ui-01/before-operator-schedule.png) | [After](images/ui-01/after-operator-schedule.png) |
| Student availability and empty My Bookings | [Before](images/ui-01/before-student-availability.png) | [After](images/ui-01/after-student-availability.png) |
| Saved booking and populated My Bookings | [Before](images/ui-01/before-saved-booking-and-my-bookings.png) | [After](images/ui-01/after-saved-booking-and-my-bookings.png) |
| Operator reservation details | [Before](images/ui-01/before-operator-booked.png) | [After](images/ui-01/after-operator-booked.png) |

Mobile examples: [sign-in](images/ui-01/after-sign-in-mobile.png), [student availability](images/ui-01/after-student-availability-mobile.png), [operator schedule](images/ui-01/after-operator-booked-mobile.png).

## Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-07 | Tanadet Nuchaikaew | Recorded UI-01 presentation, accessibility/responsive checks, regression results and before/after evidence for peer review. |
| 0.2 | 2026-11-08 | Thawat Boonsuk | PR #23 review: changed the primary color to dark orange with warm neutrals and a blue focus outline; recorded the calculated contrast and the checks still to rerun. |
