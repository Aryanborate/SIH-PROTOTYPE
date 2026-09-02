/**
 * Static ambient layer (deepest): soft radial light, fine grid, film grain.
 * Sits behind the live 3D background field (-z-20) and all content.
 */
export default function Background() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-30 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(640px 420px at 12% -4%, rgba(79,70,229,0.16), transparent 62%), radial-gradient(720px 520px at 90% 6%, rgba(37,99,235,0.10), transparent 62%)',
        }}
      />
      <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_90%_65%_at_50%_0%,black_25%,transparent_80%)]" />
      <div className="noise absolute inset-0 opacity-[0.035]" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-ink-950/80 to-transparent" />
    </div>
  )
}
