import React from "react";

// مجموعة أيقونات خطية موحدة (بديل الإيموجي) — تتلون بلون النص المحيط
const I = ({ size = 16, style, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ flexShrink: 0, verticalAlign: "-3px", ...style }} {...rest}>{children}</svg>
);

export const BallIcon = (p) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.6 16 10.5l-1.5 4.7h-5L8 10.5z" />
    <path d="M12 3v4.6M16 10.5l4.3-1.4M14.5 15.2l2.6 3.8M9.5 15.2l-2.6 3.8M8 10.5 3.7 9.1" /></I>
);
export const CalendarIcon = (p) => (
  <I {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8.5 3v4M15.5 3v4" /></I>
);
export const ChartIcon = (p) => (
  <I {...p}><path d="M4 20h16" /><rect x="6" y="11" width="3.4" height="9" rx="1" />
    <rect x="10.8" y="6" width="3.4" height="14" rx="1" /><rect x="15.6" y="14" width="3.4" height="6" rx="1" /></I>
);
export const TrophyIcon = (p) => (
  <I {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 5H5a3 3 0 0 0 3 4M16 5h3a3 3 0 0 1-3 4" />
    <path d="M12 13v3M8.5 20h7M10 20v-2.5a6 6 0 0 0 4 0V20" /></I>
);
export const ShieldIcon = (p) => (
  <I {...p}><path d="M12 3.5 19 6v6c0 4.4-3 7.4-7 8.5-4-1.1-7-4.1-7-8.5V6z" /><path d="m9.3 12 1.9 1.9 3.5-3.7" /></I>
);
export const LockIcon = (p) => (
  <I {...p}><rect x="5.5" y="10.5" width="13" height="9.5" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></I>
);
export const ClockIcon = (p) => (
  <I {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></I>
);
export const UsersIcon = (p) => (
  <I {...p}><circle cx="9.5" cy="8.5" r="3.2" /><path d="M3.8 19a5.7 5.7 0 0 1 11.4 0" />
    <path d="M15.5 5.8a3.2 3.2 0 0 1 0 5.7M17.6 13.8a5.7 5.7 0 0 1 2.9 5.2" /></I>
);
export const PlusIcon = (p) => <I {...p}><path d="M12 5.5v13M5.5 12h13" /></I>;
export const TicketIcon = (p) => (
  <I {...p}><path d="M4 8.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2V10a2 2 0 0 0 0 4v1.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V14a2 2 0 0 0 0-4z" />
    <path d="M14 6.5v11" strokeDasharray="2.4 2.6" /></I>
);
export const EyeIcon = (p) => (
  <I {...p}><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" /><circle cx="12" cy="12" r="2.7" /></I>
);
export const EyeOffIcon = (p) => (
  <I {...p}><path d="M4 4.5 20 19.5M9.9 6.4A8.6 8.6 0 0 1 12 6c5.5 0 9 6 9 6a16.5 16.5 0 0 1-2.7 3.3M6 8A15.7 15.7 0 0 0 3 12s3.5 6 9 6a8.8 8.8 0 0 0 3.4-.7" />
    <path d="M10 10.3a2.7 2.7 0 0 0 3.8 3.8" /></I>
);
export const CopyIcon = (p) => (
  <I {...p}><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5.5 14.5H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 2 2v.5" /></I>
);
export const ShareIcon = (p) => (
  <I {...p}><circle cx="6" cy="12" r="2.6" /><circle cx="17.5" cy="6" r="2.6" /><circle cx="17.5" cy="18" r="2.6" />
    <path d="m8.4 10.8 6.8-3.6M8.4 13.2l6.8 3.6" /></I>
);
export const BackIcon = (p) => <I {...p}><path d="M4.5 12h15M13.5 6l6 6-6 6" /></I>;
export const PinIcon = (p) => (
  <I {...p}><path d="M12 21s-6.5-5.5-6.5-10.4a6.5 6.5 0 0 1 13 0C18.5 15.5 12 21 12 21z" /><circle cx="12" cy="10.3" r="2.3" /></I>
);
export const SearchIcon = (p) => (
  <I {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.3-4.3" /></I>
);
export const AlertIcon = (p) => (
  <I {...p}><path d="M12 4 21 19.5H3z" /><path d="M12 10v4M12 16.8v.2" /></I>
);
export const CheckIcon = (p) => <I {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></I>;
export const RefreshIcon = (p) => (
  <I {...p}><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4.3h-4.3" /></I>
);
export const ListIcon = (p) => (
  <I {...p}><path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12" /><path d="M4 6.5h.01M4 12h.01M4 17.5h.01" strokeWidth="2.6" /></I>
);
