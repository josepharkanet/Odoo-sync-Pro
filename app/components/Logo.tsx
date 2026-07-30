// Arkanet brand mark. This is an SVG recreation of the red + navy Arkanet logo
// so it stays crisp at any size. To use the exact original instead, drop the
// file in /public and swap <LogoMark/> for an <img src="/arkanet-logo.png" />.

const RED = "#E1251B";
const NAVY = "#24305E";

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Arkanet"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* left blade (red) */}
      <path d="M20 6 L27 6 L14 42 L7 42 Z" fill={RED} />
      {/* right blade (navy) */}
      <path d="M21 6 L28 6 L41 42 L34 42 Z" fill={NAVY} />
    </svg>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <LogoMark size={size} />
      <span
        style={{
          fontWeight: 800,
          letterSpacing: "0.12em",
          fontSize: Math.round(size * 0.5),
          color: NAVY,
        }}
      >
        ARKANET
      </span>
    </span>
  );
}
