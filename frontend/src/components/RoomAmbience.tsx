// The room the work is viewed in — replaces the previous aurora orbs.
//
// Every layer here is a property of the medium rather than a decoration:
// grain is the emulsion, the vignette is the lens, and the two coloured
// washes are a key light and a fill placed opposite each other. They sit at
// very low opacity on purpose — this should register as depth in the room,
// not as brand colour on the page.
//
// Purely visual: aria-hidden and pointer-events:none (see .room in index.css).
export function RoomAmbience() {
  return (
    <div className="room" aria-hidden="true">
      <div className="room__key" />
      <div className="room__fill" />
      <div className="room__grain" />
      <div className="room__vignette" />
    </div>
  )
}
