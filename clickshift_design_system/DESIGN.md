---
name: ClickShift Design System
colors:
  surface: '#f8f9ff'
  surface-dim: '#d8dae0'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3f9'
  surface-container: '#ecedf4'
  surface-container-high: '#e7e8ee'
  surface-container-highest: '#e1e2e8'
  on-surface: '#191c20'
  on-surface-variant: '#414750'
  inverse-surface: '#2e3035'
  inverse-on-surface: '#eff0f7'
  outline: '#727781'
  outline-variant: '#c1c7d2'
  surface-tint: '#1261a3'
  primary: '#004275'
  on-primary: '#ffffff'
  primary-container: '#005a9c'
  on-primary-container: '#afd1ff'
  inverse-primary: '#a1c9ff'
  secondary: '#006a6a'
  on-secondary: '#ffffff'
  secondary-container: '#8cf3f3'
  on-secondary-container: '#007070'
  tertiary: '#6a3100'
  on-tertiary: '#ffffff'
  tertiary-container: '#8d4401'
  on-tertiary-container: '#ffc29c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d2e4ff'
  primary-fixed-dim: '#a1c9ff'
  on-primary-fixed: '#001c37'
  on-primary-fixed-variant: '#00487f'
  secondary-fixed: '#8cf3f3'
  secondary-fixed-dim: '#6fd7d6'
  on-secondary-fixed: '#002020'
  on-secondary-fixed-variant: '#004f4f'
  tertiary-fixed: '#ffdcc7'
  tertiary-fixed-dim: '#ffb787'
  on-tertiary-fixed: '#311300'
  on-tertiary-fixed-variant: '#733600'
  background: '#f8f9ff'
  on-background: '#191c20'
  surface-variant: '#e1e2e8'
  status-approved: '#2E7D32'
  status-pending: '#F9A825'
  status-denied: '#D32F2F'
  status-off: '#757575'
  surface-background: '#F8FAFC'
  surface-border: '#E2E8F0'
typography:
  h1:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  h3:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  data-tabular:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.2'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  container-padding: 24px
  grid-gutter: 1px
  sidebar-width: 260px
  row-height-dense: 40px
---

# ClickShift - Product Requirements Document (PRD)

## Project Overview
**ClickShift** is a workforce scheduling and time-off management platform designed for outpatient clinics. It differentiates between personal schedule awareness (Staff), operational staffing visibility (Managers), and system-level pattern control (Admins).

---

## 1. Information Architecture & Sitemap

### Global / Shared
- **Authentication**: Login, Forgot Password, Reset Password.
- **Profile/Settings**: User profile, Notification preferences.

### Staff Experience (Personal Focus)
- **Dashboard**: Overview of next shift, recent request status, and quick links.
- **Personal Schedule**: Day, Week, and Month views of the user's assigned shifts.
- **Time-Off Requests**:
    - Request Form (PTO, Sick, Vacation, etc.)
    - Request History (List view with statuses)
    - Request Details (Detailed view with manager comments)

### Manager Experience (Operational Focus)
- **Manager Dashboard**: Staffing alerts, pending request count, coverage summary.
- **Clinic Staffing Views**:
    - Daily View (Detailed coverage for today)
    - Weekly View (Team schedule board)
    - Monthly View (Focus on approved/pending time off)
- **Request Management**:
    - Pending Requests Queue (List of items needing action)
    - Request Review Modal (Approve/Deny with staffing impact overlay)

### Admin Experience (Structural Focus)
- **Admin Dashboard**: System health, employee count, clinic stats.
- **Pattern Builder**: 2-week repeating cycle configuration grid.
- **Management Modules**:
    - Employee Management (Add/Edit/Role assignment)
    - Department/Clinic Settings
    - Rules & Configuration (Time-off types, shift hours)

---

## 2. User Flows

### Flow A: Staff Requesting Time Off
1. Staff logs in -> Dashboard.
2. Clicks "Request Time Off".
3. Fills out form (Date range, type, notes) -> Submits.
4. Receives confirmation.
5. Views "Request History" to see "Pending" status.

### Flow B: Manager Approving Request
1. Manager logs in -> Dashboard (sees alert).
2. Navigates to "Pending Requests".
3. Selects a request -> Reviews "Staffing Impact" for those dates.
4. Clicks "Approve" and adds a comment.
5. Request is moved to "Approved"; Staff is notified.

### Flow C: Admin Setting a 2-Week Pattern
1. Admin logs in -> Admin Dashboard.
2. Navigates to "Pattern Builder".
3. Selects an Employee or Role.
4. Configures Week 1 and Week 2 (AM/PM shifts).
5. Saves pattern -> System automatically populates the calendar for future dates.

---

## 3. Data Schema (Suggested)

### `Users`
- `id`, `name`, `email`, `role` (Admin, Manager, Staff), `department_id`

### `Clinics/Departments`
- `id`, `name`, `location`, `manager_id`

### `SchedulePatterns` (2-Week Cycle)
- `id`, `user_id`, `week_number` (1 or 2), `day_of_week`, `shift_type` (AM, PM, Full, Off)

### `Shifts` (Actual instances)
- `id`, `user_id`, `date`, `shift_type`, `status` (Working, Off, PTO)

### `TimeOffRequests`
- `id`, `user_id`, `start_date`, `end_date`, `type` (PTO, SCK, VAC, etc.), `status` (Pending, Approved, Denied), `manager_comment`, `staff_note`

---

## 4. Visual Direction
- **Typography**: Clean sans-serif (e.g., Inter or Roboto).
- **Colors**: 
    - Primary: Professional Teal or Navy (#005A9C).
    - Status: Green (Approved), Amber (Pending), Red (Denied), Grey (Off).
- **Layout**: Sidebar navigation for desktop; high-density grids for scheduling.