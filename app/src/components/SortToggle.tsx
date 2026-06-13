interface Props {
  label: string;
  onClick: () => void;
  title: string;
}

// A small sort button with the standard "descending bars" sort glyph plus a
// short label showing the active mode. Shared by the Pitch, Bench, and Subs
// column headers so they all look identical.
export function SortToggle({ label, onClick, title }: Props) {
  return (
    <button className="sort-toggle" onClick={onClick} title={title} aria-label={title}>
      <svg
        className="sort-toggle-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <path d="M5 7h14M5 12h9M5 17h4" />
      </svg>
      <span>{label}</span>
    </button>
  );
}
