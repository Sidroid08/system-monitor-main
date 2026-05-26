export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Auth pages (login, register) share the same ambient background via body::before
  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {children}
    </div>
  );
}
