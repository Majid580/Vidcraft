// Fixed, decorative animated gradient orbs behind all content.
// Purely visual — aria-hidden, pointer-events none (see .aurora in index.css).
export function AuroraBackground() {
  return (
    <div className="aurora" aria-hidden="true">
      <div className="aurora__orb aurora__orb--1" />
      <div className="aurora__orb aurora__orb--2" />
      <div className="aurora__orb aurora__orb--3" />
    </div>
  )
}
