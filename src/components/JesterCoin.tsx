interface JesterCoinProps {
  size?: number;
  className?: string;
}

export default function JesterCoin({ size = 16, className = '' }: JesterCoinProps) {
  return (
    <img
      src="/jester.png"
      alt="coin"
      width={size}
      height={size}
      className={`inline-block rounded-full drop-shadow-[0_0_3px_rgba(255,191,0,0.5)] ${className}`}
      style={{
        filter: 'sepia(0.3) saturate(2) brightness(1.1) hue-rotate(-10deg)',
        verticalAlign: 'middle',
      }}
    />
  );
}
