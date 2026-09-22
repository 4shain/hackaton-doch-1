---
name: Tactical Blue Command
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#434656'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#737688'
  outline-variant: '#c3c5d9'
  surface-tint: '#004ced'
  primary: '#003ec7'
  on-primary: '#ffffff'
  primary-container: '#0052ff'
  on-primary-container: '#dfe3ff'
  inverse-primary: '#b7c4ff'
  secondary: '#00677d'
  on-secondary: '#ffffff'
  secondary-container: '#50d9fe'
  on-secondary-container: '#005c70'
  tertiary: '#005a3c'
  on-tertiary: '#ffffff'
  tertiary-container: '#007550'
  on-tertiary-container: '#72fec0'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b7c4ff'
  on-primary-fixed: '#001452'
  on-primary-fixed-variant: '#0038b6'
  secondary-fixed: '#b3ebff'
  secondary-fixed-dim: '#4cd6fb'
  on-secondary-fixed: '#001f27'
  on-secondary-fixed-variant: '#004e5f'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display:
    fontFamily: Rubik
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Rubik
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Rubik
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
  headline-md:
    fontFamily: Rubik
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Rubik
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Rubik
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  title-sm:
    fontFamily: Rubik
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
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
    lineHeight: 16px
  label-lg:
    fontFamily: Rubik
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Rubik
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Rubik
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-sm: 0.75rem
  margin: 1.25rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system blends tactical military discipline with cutting-edge digital product aesthetics. Designed for field commanders, squad leaders, and defense personnel managing daily attendance and tactical readiness, it communicates uncompromising operational clarity, speed, and modern precision.

The design movement combines **High-Contrast Modern Tech** with **Subtle Tactical Glassmorphism**:
- Ultra-legible typography tuned for instant cognitive capture in high-stress field conditions.
- Rich, electric royal blue visual anchors derived directly from tactical operational emblems.
- High-structure container hierarchy that emphasizes operational metrics, active roll calls, and personnel statuses without clutter.
- Crisp, technological accents—precision badges, geometric chamfers, and clear data grids—reinforcing mission-critical reliability.

## Colors

The palette is engineered for rapid field scanning, strong daylight contrast, and unmistakable visual hierarchy:

- **Primary (`#0052FF`)**: An electric, authoritative royal blue driving key actions, primary operational toggles, active statuses, and dominant branding.
- **Secondary (`#00B4D8`)**: A bright cyan/dynamic blue for secondary telemetry, data highlights, and supporting mission tags.
- **Tertiary / Success (`#10B981`)**: Tactical green indicating full readiness, present status, and validated roll-call reports.
- **Neutral (`#0F172A`)**: Deep naval slate serving as the grounding tone for high-contrast typography, critical headers, and structural borders.
- **Surface Accents**: Icy blue-tinted backdrops (`#F0F5FF`, `#E5EFFF`) create crisp tonal separation from pure white elevated tactical cards (`#FFFFFF`).

## Typography

**Rubik** is selected for its robust geometric clarity, balanced proportions, and native Hebrew and Latin rendering. Its slightly rounded terminals offer exceptional legibility under fast scanning, low illumination, or mobile jitter.

- Numerical readiness counts and tactical metrics use `font-weight: 700` or `800` with tabular lining figures (`font-variant-numeric: tabular-nums`) to prevent jitter across active status updates.
- Labels for military ranks, unit codes, and status pills utilize uppercase or emphasized weight with increased letter spacing for crisp recognition.
- RTL (Right-to-Left) layout parity is preserved across all typographic scales.

## Layout & Spacing

The layout is built upon an 8pt dynamic fluid grid designed for rapid tactical workflows on both rugged handheld devices and desktop mission control terminals:

- **Mobile (Handheld / Field)**: Single-column full-width cards with a persistent 4-column micro-grid, 20px (`1.25rem`) side margins, and touch-target padding never dropping below 48px height.
- **Tablet / In-Vehicle Displays**: 8-column layout with 16px gutters; enables dual-pane viewing (attendance overview on the left, individual soldier dossiers on the right).
- **Desktop (Command Operations)**: 12-column fixed-max system (max 1440px) with 24px gutters and 32px canvas margins.
- **Rhythm**: Compact element gap tokens (`space-xs` to `space-md`) prevent dead screen space, ensuring operational stats remain above the fold.

## Elevation & Depth

Visual hierarchy combines clean tonal surfaces with subtle tactical depth rather than dramatic theatrical shadows:

- **Level 0 (Canvas Base)**: Cool tactical tint `#F4F7FD` creating a glare-resistant, clear canvas.
- **Level 1 (Default Cards & Dossiers)**: Crisp white (`#FFFFFF`) with a delicate 1px boundary (`#E2E8F0`) and an ambient tactical shadow: `0 2px 8px rgba(0, 82, 255, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)`.
- **Level 2 (Active Drill-down & Modals)**: Lifted cards and flyouts carry a pronounced blue-tinted drop: `0 12px 28px rgba(0, 82, 255, 0.12), 0 4px 10px rgba(15, 23, 42, 0.05)`.
- **Level 3 (Tactical Float / Sticky Bottom Submission Bar)**: Backed with an ultra-fine backdrop blur (`backdrop-filter: blur(12px)`) at 85% opacity, held in place by an illuminated primary accent stroke (`rgba(0, 82, 255, 0.2)`).

## Shapes

The design system adopts **Level 2 (Rounded)** with purposeful modern-card framing:

- **Base Components (Inputs, Chips, Small Buttons)**: `0.5rem` (8px) radius, providing comfortable finger fit while feeling engineered and precise.
- **Standard Cards & Operational Modules (`rounded-lg`)**: `1rem` (16px) radius, delivering modern visual clarity and separation.
- **Hero Unit Badges & Tactical Dossiers (`rounded-xl`)**: `1.5rem` (24px) radius, echoing the smooth contour seen in the unit icon emblem.
- **Status Pills**: Pill-shaped (`9999px`) to immediately distinguish ephemeral status tags (e.g., "Present", "On Leave", "Gimel") from functional interaction surfaces.

## Components

### Buttons
- **Primary Operational Action**: Bold royal blue (`#0052FF`) fill, pure white label, `0.5rem` radius, minimum 48px height. Active states trigger subtle blue glow shadows (`0 0 0 3px rgba(0, 82, 255, 0.3)`).
- **Secondary / Quick Filter**: Pale icy blue background (`#EBF2FF`), royal blue text (`#0052FF`), 1px border (`rgba(0, 82, 255, 0.2)`).
- **Destructive / Alert Action**: Tactical crimson (`#EF4444`) fill or outline for emergency flags, missing reports, or red status submissions.

### Cards & Personnel List Items
- **Attendance Card**: White surface, 16px corner radius, equipped with a 4px left (or right in RTL) tactical accent strip denoting live status (Green for Present, Orange for Sick/Leave, Red for Unaccounted).
- **Unit Header Metric Card**: Vibrant royal blue gradient background (`linear-gradient(135deg, #0052FF 0%, #003ECC 100%)`) with white tabular counters, semi-transparent frosted badges, and crisp subtext.

### Chips & Badges
- Compact `24px` or `28px` pill containers.
- Status representations:
  - *Ready/Present*: Soft emerald tint (`#ECFDF5`), bold emerald text (`#059669`).
  - *Absent/Missing*: Soft rose tint (`#FEF2F2`), bold rose text (`#DC2626`).
  - *Pass/Leave*: Soft amber tint (`#FFFBEB`), deep amber text (`#D97706`).

### Input Fields & Search
- Surface: Crisp white with an inset boundary of `#CBD5E1`.
- Focused: Crisp 2px outer outline in primary royal blue (`#0052FF`) with a delicate faint glow. Rubik 14px text with slate placeholder `#94A3B8`.

### Checkboxes & Segmented Controls
- **Segmented Duty Switchers**: Recessed icy-slate channel (`#E2E8F0`) housing snappy elevated white segments, providing tactile feedback when toggling between company, platoon, and squad views.
- **Rapid Checkboxes**: Square with 6px radius, expanding into solid royal blue with a crisp white military checkmark icon upon selection.