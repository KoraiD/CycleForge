type BrandMarkProps = {
  size?: number;
  className?: string;
  withWordmark?: boolean;
};

export function BrandMark({
  size = 28,
  className = "",
  withWordmark = false,
}: BrandMarkProps) {
  return (
    <span className={`brand-mark ${className}`.trim()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.svg"
        alt=""
        width={size}
        height={size}
        className="brand-mark__icon"
      />
      {withWordmark ? <span className="brand">CycleForge</span> : null}
    </span>
  );
}
