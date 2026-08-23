export function OrderMotionVisual({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`order-motion-visual ${compact ? "compact" : ""}`} aria-hidden="true">
      <div className="motion-orbit orbit-one" />
      <div className="motion-orbit orbit-two" />
      <div className="motion-glow" />
      <div className="motion-track"><i /><i /><i /></div>
      <div className="motion-parcel">
        <span className="parcel-top" />
        <span className="parcel-front"><b>R</b></span>
        <span className="parcel-side" />
        <i className="parcel-ribbon" />
      </div>
      <div className="motion-spark spark-one" />
      <div className="motion-spark spark-two" />
      <div className="motion-spark spark-three" />
    </div>
  );
}
