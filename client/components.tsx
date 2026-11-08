import type { ComponentProps, ReactNode } from 'react';

export function Button({ className = '', variant = 'primary', type = 'button', ...props }: ComponentProps<'button'> & { variant?: 'primary' | 'secondary' }) {
  return <button {...props} type={type} className={`button button--${variant} ${className}`} />;
}

export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return <input {...props} className={`control ${className}`} />;
}

export function Select({ className = '', ...props }: ComponentProps<'select'>) {
  return <select {...props} className={`control ${className}`} />;
}

export function Card({ className = '', ...props }: ComponentProps<'section'>) {
  return <section {...props} className={`card ${className}`} />;
}

export function StatusBadge({ tone, children }: { tone: 'available' | 'booked' | 'past' | 'error'; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function Alert({ tone, children }: { tone: 'error' | 'success' | 'loading' | 'empty'; children: ReactNode }) {
  return <p className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : tone === 'success' ? 'status' : undefined}>
    <span className="alert-dot" aria-hidden="true" />{children}
  </p>;
}

export function Table({ caption, children }: { caption: string; children: ReactNode }) {
  return <div className="table-wrap"><table><caption className="sr-only">{caption}</caption>{children}</table></div>;
}

export function Brand() {
  return <div className="brand">
    <svg className="brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="7" y="7" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M12 3v4m8-4v4m-8 18v4m8-4v4M3 12h4m-4 8h4m18-8h4m-4 8h4M12 21V11l8 10V11" stroke="currentColor" strokeWidth="2" />
    </svg>
    <span>NutGPUHub<span className="brand-subtitle">University GPU reservations</span></span>
  </div>;
}
