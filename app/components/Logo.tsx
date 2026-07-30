// Arkanet brand logo: the real file, served from /public/arkanet-logo.jpg.

export function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <img
      src="/arkanet-logo.jpg"
      alt="Arkanet"
      style={{ height: size, width: "auto", display: "block" }}
    />
  );
}

export function Logo({ size = 44 }: { size?: number }) {
  return <LogoMark size={size} />;
}
