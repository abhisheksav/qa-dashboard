// Class sets for pinning columns while a wide table scrolls horizontally.
//
// Two things must stay visible however far a row is scrolled: what the row *is*
// (its ID, on the left) and what you can *do* to it (its actions, on the right).
// Without the right-hand pin, approve/reject and row menus sit past the edge and
// have to be scrolled to, which is the whole problem this solves.
//
// Requirements on the caller:
//   • the scroll container is the one inside <Table> (overflow-x-auto)
//   • body rows carry `group/row bg-card` so the pinned cells can follow hover
//     and selection instead of reading as a detached strip
//   • header rows carry `bg-card`, or scrolled body cells show through them

/** Follows the row's own background through hover and selection. */
// Opaque throughout: a translucent hover would let the columns scrolling
// underneath show through the pinned cell. Rows must set `hover:bg-muted` to
// match, since the shared TableRow hover is translucent by default.
const FOLLOWS_ROW =
  'bg-card group-hover/row:bg-muted group-data-[state=selected]/row:bg-accent'

/** Seam drawn on the side the content scrolls under. */
const EDGE_RIGHT = 'shadow-[1px_0_0_0_var(--border)]'
const EDGE_LEFT = 'shadow-[-1px_0_0_0_var(--border)]'

export const stickyLeftHead = (offset = 'left-0', edge = false) =>
  `sticky ${offset} z-30 bg-card ${edge ? EDGE_RIGHT : ''}`

export const stickyLeftCell = (offset = 'left-0', edge = false) =>
  `sticky ${offset} z-10 ${FOLLOWS_ROW} ${edge ? EDGE_RIGHT : ''}`

export const stickyRightHead = () => `sticky right-0 z-30 bg-card ${EDGE_LEFT}`

export const stickyRightCell = () => `sticky right-0 z-10 ${FOLLOWS_ROW} ${EDGE_LEFT}`
