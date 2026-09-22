---
name: דוח 1 הבא
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#002114'
  on-tertiary-container: '#069669'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#85f8c4'
  tertiary-fixed-dim: '#68dba9'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005137'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Rubik
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Rubik
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Rubik
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Rubik
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Rubik
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Rubik
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Rubik
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Rubik
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-md:
    fontFamily: Rubik
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Rubik
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
  code-num:
    fontFamily: Rubik
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1.25rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style
The design system establishes an authoritative, high-trust operational environment calibrated for mission-critical human resources, troop accountability, and readiness reporting. Designed ground-up for Hebrew (RTL-first), it bridges high-velocity military logistics with calm, human-centric ergonomic software.

The aesthetic fuses **Tactical Precision** and **Modern Corporate Enterprise**:
- **Clarity over ornamentation**: Critical information (reporting statuses, personnel tallies, unverified reports) must be parseable within sub-second glances under low-light or high-stress operational conditions.
- **RTL Architectural Balance**: Visual flow, hierarchy, micro-interactions, swipe directions, and status progress follow an organic right-to-left visual cadence.
- **Controlled Density**: Interfaces present dense military telemetry without cognitive overload through rigorous compartmentalization, subtle tonal borders, and systematic badge taxonomy.
- **Assurance & Reliability**: Interactive states avoid ambiguity; destructive actions and state modifications require explicit tactile feedback and distinct audit markers.

## Colors
The palette balances tactical authority with operational precision, adhering strictly to clear semantic meaning:

- **Command Slate (Primary `#0F172A` / `#1E293B`)**: The backbone of the interface. Anchors primary navigation, structural headings, deep elevation backdrops, and active structural frames.
- **Disciplined Blue (Secondary `#2563EB` / Active `#3B82F6`)**: Reserved for system interactions, state transitions, links, and operational AI assistant interactions (verification bot, auto-parsing prompts).
- **Tactical Emerald / Olive (Tertiary `#059669` / `#10B981`)**: Signals positive readiness, verified presence ("נוכח בבסיס", "כשיר"), and completed morning roll calls.
- **Operational Amber (`#D97706` / `#F59E0B`)**: Denotes pending status, delayed roll-call reports ("ממתין לאישור מפקד"), leaves, or non-critical anomalies.
- **Alert Crimson (`#DC2626` / `#EF4444`)**: Highlights critical discrepancies, AWOL/unaccounted personnel ("נפקד / חסר דיווח"), medical emergencies, and irreversible rejection actions.
- **Neutral Field Canvas (`#F8FAFC`, `#F1F5F9`, `#FFFFFF`)**: Ultra-clean baseline surfaces preventing eye fatigue, framed with crisp slate borders (`#E2E8F0`).
- **Dark Surface Tokens**: On dark mode, backdrops invert to `#0B0F19`, `#1E293B`, and `#334155` maintaining WCAG AAA contrast ratios for nighttime tactical operations.

## Typography
Typography is anchored by **Rubik**, selected for its exceptional Hebrew legibility, open apertures, geometric precision, and balanced proportion when pairing Hebrew text alongside Arabic numerals, military IDs (מספר אישי), and operational acronyms (דו״ח 1, גימ״לים, אפטר, ימ״ח).

Guidelines for RTL operational typography:
- **Numerical Alignment**: Personal IDs, timestamps, and percentages use tabular, proportional figures with clean line-height alignment to avoid visual jitter across shifting status dashboards.
- **Hierarchy Stacking**: Section labels sit right-aligned with tight vertical margins above cards; operational tags and timestamps balance opposite on the left edge.
- **Micro-Copy Weighting**: Status pills and operational chips utilize `label-md` and `label-sm` with semibold weight (`600`) to guarantee instant readability in high-glare environments.

## Layout & Spacing
The layout relies on a mobile-first, single-column fluid frame (constrained to 430px maximum width on mobile views, centering on wider tactical tablets with 4 to 8 fluid columns).

- **Directional Rhythm**: All primary content anchors to the right edge (`margin-right: 1rem`), while actions, time indicators, and navigation chevrons anchor to the left edge.
- **Touch-Target Geometry**: Every interactive element adheres strictly to a minimum touch bounding box of 44x44px, insulated with at least `space-xs` boundary padding to prevent mis-clicks during field usage.
- **RTL Fluid Inset**: Bottom navigation sheets, persistent action bars, and segmented filters maintain symmetrical outer margins (`margin-mobile: 1rem`) with internal item gaps calibrated via `space-sm` and `space-md`.

## Elevation & Depth
Depth in this system conveys command status and urgency rather than decorative flair, utilizing structural borders alongside ambient low-contrast shadows:

- **Level 0 (Base Canvas)**: Flat `#F8FAFC` (Light) or `#0B0F19` (Dark). Completely flush.
- **Level 1 (Card & Module Layer)**: `#FFFFFF` surface with a crisp 1px structural outline (`#E2E8F0` / dark: `#1E293B`) paired with an ultra-subtle ambient shadow: `0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)`.
- **Level 2 (Active Pending Cards & AI Assistant Prompts)**: Elevated surface with `0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`. Outlines receive a deliberate slate-tinted rim.
- **Level 3 (Modal Bottom Sheets & Overlays)**: Floated surface supported by `0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08)` and backdrop frosted blur (`backdrop-filter: blur(8px)` with 40% `#0F172A` scrim).
- **Status Border Accents**: Urgent and pending cards feature a 3px right-border accent (Right-to-Left orientation marker) keyed directly to their status color (Emerald, Amber, or Crimson).

## Shapes
The system employs roundedness level `2` (medium-soft architecture):
- Standard cards, interactive items, and operational modules use `0.5rem` (8px) corner radius, balancing contemporary digital product feel with disciplined geometric structure.
- Modal bottom sheets and persistent drawers transition smoothly into view using `1rem` (16px) top-right and top-left radii.
- Status badges, operational chips, and readiness pills use continuous full-pill geometry (`rounded-full` / 9999px) to distinctly isolate qualitative tags from square-cornered structural cards.

## Components

### Buttons
- **Primary Operational Button**: Solid `#0F172A` background, white label, full-width or dynamic RTL trailing icon alignment. Heights: 48px for main actions ("שמור ושלח דו״ח"), 36px for localized actions.
- **Tactical Action Buttons (Approve / Reject / Clarify)**:
  - *Approve ("אשר")*: Soft emerald container (`#ECFDF5`), bold emerald text (`#047857`), 1px `#A7F3D0` outline.
  - *Reject ("דחה")*: Soft crimson container (`#FEF2F2`), crimson text (`#B91C1C`), 1px `#FECACA` outline.
  - *Clarify / Details ("ברר / פרטים")*: Slate ghost style with disciplined blue iconography.

### Status Pills & Audit Badges
- **Present / Ready ("נוכח")**: `#ECFDF5` container, `#065F46` label, small 6px solid `#10B981` leading dot indicator positioned to the right of the Hebrew text.
- **Pending ("ממתין לאישור")**: `#FFFBEB` container, `#92400E` label, pulsing amber dot.
- **Unavailable / AWOL ("חסר דיווח / חריג")**: `#FEF2F2` container, `#991B1B` label, warning exclamation icon.
- **Audit Stamp**: Sub-10px monospaced military time stamp ("אומת ע״י רס״ל כהן - 08:14") anchored at the bottom-left of reviewed personnel cards.

### Chat & AI Verification Cards
- **Bot Directive Bubble**: Crisp white surface framed in subtle `#DBEAFE` border with a `#2563EB` micro-badge on the top right ("עוזר דוח 1"). Provides automated anomaly detection: "זוהתה אי-התאמה: 3 חיילים טרם עודכנו ממחלקת קשר".
- **Quick-Prompt Chips**: Horizontally scrollable row beneath the bot bubble allowing one-tap bulk actions ("סמן את כולם כנוכחים", "העבר תזכורת בוואטסאפ").

### Operational Readiness Gauge
- Concentric or linear segmented progress bar: Green segment (accounted for), Amber (on leave / permit), Crimson (unaccounted).
- Displays immediate percentage (`96.4% כשירות`) in bold numerical tabular format right-aligned beside unit identifier.

### Pending Approval Queue Card
- Card anatomy: Soldier rank and full name top-right, army ID (`מ.א`) formatted left-aligned. Center displays requested attendance change ("ימי מחלה (גימלים) • 2 ימים").
- Bottom action footer: Compact 3-way trigger row (Approve, Reject, Clarify) with high touch-target heights (40px).

### Drill-Down Modal Drawers
- Slides from bottom up for individual soldier historical timeline and military certification logs. Equipped with an ergonomic RTL drag handle and clear top-left dismissal trigger ("סגור").