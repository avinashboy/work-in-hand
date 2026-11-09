const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  'aria-hidden': true,
  focusable: false,
} as const

export function ArchiveIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 4h18v5H3z" />
      <path d="M5 9v11h14V9" />
      <path d="M9.5 13h5" />
    </svg>
  )
}

export function PencilIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 20l1-4.5L16.5 4l3.5 3.5L8.5 19z" />
      <path d="M14 6.5l3.5 3.5" />
    </svg>
  )
}

export function TrashIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3.5 6.5h17" />
      <path d="M9 6.5V3.5h6v3" />
      <path d="M5.5 6.5l1 14h11l1-14" />
      <path d="M10 11v5.5M14 11v5.5" />
    </svg>
  )
}
