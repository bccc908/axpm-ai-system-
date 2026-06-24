import { GoldSignalsPanel } from "@/components/gold/gold-signals-panel";

export default function GoldSignalsPage() {
  return (
    <div className="gold-desk -mx-4 flex min-h-[calc(100dvh-7rem)] flex-col md:-mx-6 lg:-mx-8">
      <GoldSignalsPanel />
    </div>
  );
}
