interface SparklineProps {
  data: { t: number; p: number }[];
  width?: number;
  height?: number;
  color?: string;
}

export default function Sparkline({
  data,
  width = 200,
  height = 40,
  color = "#00D1FF",
}: SparklineProps) {
  if (!data || data.length < 2) return null;

  const prices = data.map((d) => d.p);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 0.01;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.p - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polyline = points.join(" ");

  // Gradient fill area
  const areaPoints = [
    `0,${height}`,
    ...points,
    `${width},${height}`,
  ].join(" ");

  const trend = prices[prices.length - 1] - prices[0];
  const lineColor = trend > 0.02
    ? "#00E676"
    : trend < -0.02
    ? "#FF5252"
    : color;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.15" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <polygon
        points={areaPoints}
        fill="url(#sparkGrad)"
      />
      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          filter: `drop-shadow(0 0 3px ${lineColor}60)`,
        }}
      />
      {/* Last price dot */}
      <circle
        cx={parseFloat(points[points.length - 1].split(",")[0])}
        cy={parseFloat(points[points.length - 1].split(",")[1])}
        r="2.5"
        fill={lineColor}
        style={{ filter: `drop-shadow(0 0 4px ${lineColor})` }}
      />
    </svg>
  );
}
