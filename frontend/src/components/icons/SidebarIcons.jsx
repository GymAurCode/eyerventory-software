function BaseIcon({ children, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export function MenuIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </BaseIcon>
  );
}

export function LayoutDashboard(props) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="3" width="8" height="8" />
      <rect x="13" y="3" width="8" height="5" />
      <rect x="13" y="10" width="8" height="11" />
      <rect x="3" y="13" width="8" height="8" />
    </BaseIcon>
  );
}

export function Package(props) {
  return (
    <BaseIcon {...props}>
      <path d="M3 7.5 12 3l9 4.5L12 12 3 7.5Z" />
      <path d="M3 7.5V16.5L12 21l9-4.5V7.5" />
      <path d="M12 12v9" />
    </BaseIcon>
  );
}

export function ShoppingCart(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M3 4h2l2.4 10h10.8l2-7H7" />
    </BaseIcon>
  );
}

export function Wallet(props) {
  return (
    <BaseIcon {...props}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M16 12h4.5" />
      <circle cx="15" cy="12" r="0.5" fill="currentColor" stroke="none" />
    </BaseIcon>
  );
}

export function BarChart3(props) {
  return (
    <BaseIcon {...props}>
      <path d="M4 20V10" />
      <path d="M10 20V6" />
      <path d="M16 20V13" />
      <path d="M22 20V4" />
    </BaseIcon>
  );
}

export function Insights(props) {
  return (
    <BaseIcon {...props}>
      <path d="M3 20h18" />
      <path d="M6 16l4-4 3 3 5-6" />
      <circle cx="6" cy="16" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="13" cy="15" r="1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="9" r="1" fill="currentColor" stroke="none" />
    </BaseIcon>
  );
}

export function Users(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M14 19a4 4 0 0 1 7 0" />
    </BaseIcon>
  );
}

export function Handshake(props) {
  return (
    <BaseIcon {...props}>
      <path d="M3 9 7 5l4 4" />
      <path d="m21 9-4-4-4 4" />
      <path d="m8 10 3 3m2-3-3 3m-5 6h14" />
    </BaseIcon>
  );
}

export function FileText(props) {
  return (
    <BaseIcon {...props}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6" />
      <path d="M8 13h8M8 17h8" />
    </BaseIcon>
  );
}

export function Settings(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1.7 1.7 0 0 1-3.4 0v-.1a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1.7 1.7 0 0 1 0-3.4h.1a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a1.7 1.7 0 0 1 3.4 0v.1a1 1 0 0 0 .6.9h.1a1 1 0 0 0 1.1-.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6h.1a1.7 1.7 0 0 1 0 3.4h-.1a1 1 0 0 0-.9.6Z" />
    </BaseIcon>
  );
}

export function Eye(props) {
  return (
    <BaseIcon {...props}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </BaseIcon>
  );
}

export function Pencil(props) {
  return (
    <BaseIcon {...props}>
      <path d="M12 20h9" />
      <path d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5Z" />
    </BaseIcon>
  );
}

export function Trash2(props) {
  return (
    <BaseIcon {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 10v6M14 10v6" />
    </BaseIcon>
  );
}

export function UserCheck(props) {
  return (
    <BaseIcon {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </BaseIcon>
  );
}

export function ClipboardList(props) {
  return (
    <BaseIcon {...props}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h4" />
    </BaseIcon>
  );
}

export function CalendarCheck(props) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="m9 16 2 2 4-4" />
    </BaseIcon>
  );
}

export function DollarSign(props) {
  return (
    <BaseIcon {...props}>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </BaseIcon>
  );
}

export function CreditCard(props) {
  return (
    <BaseIcon {...props}>
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </BaseIcon>
  );
}

export function CalendarOff(props) {
  return (
    <BaseIcon {...props}>
      <path d="M4.18 4.18A2 2 0 0 0 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 1.82-1.18" />
      <path d="M21 15.5V6a2 2 0 0 0-2-2H9.5" />
      <path d="M16 2v4M3 10h7M21 10h-2.5" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </BaseIcon>
  );
}

export function Database(props) {
  return (
    <BaseIcon {...props}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </BaseIcon>
  );
}
