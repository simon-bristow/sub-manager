import type { ReactNode } from 'react';

interface Props {
  visible: boolean;
  children: ReactNode;
  onBackdrop?: () => void;
}

export function Overlay({ visible, children, onBackdrop }: Props) {
  return (
    <div
      className={`overlay${visible ? ' visible' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && onBackdrop) onBackdrop();
      }}
    >
      <div className="overlay-card">{children}</div>
    </div>
  );
}
