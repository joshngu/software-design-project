import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";

import { COLORS, FONT_MONO } from "./QueueSmartAuth";
import { fetchMyQueues } from "./api";

const STATUS_STEPS = [
  { id: "waiting", label: "Waiting" },
  { id: "almost", label: "Almost ready" },
  { id: "served", label: "Served" },
];

/* ---------------------------------------------------------
  Queue Status — active queue status from backend data.
--------------------------------------------------------- */
export default function QueueStatusScreen({ token }) {
  const [activeQueue, setActiveQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  async function loadQueueStatus() {
    setLoading(true);
    setLoadError("");
    try {
      const { activeQueue: queue } = await fetchMyQueues(token);
      setActiveQueue(queue || null);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueueStatus();
  }, [token]);

  const currentStep = useMemo(() => {
    if (!activeQueue) return "served";
    if (activeQueue.position <= 1 || activeQueue.estimatedWaitMinutes <= activeQueue.expectedDuration) {
      return "almost";
    }
    return "waiting";
  }, [activeQueue]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest mb-2" style={{ fontFamily: FONT_MONO, color: COLORS.slate }}>
          Queue status
        </p>
        <h1 className="text-2xl font-semibold" style={{ color: COLORS.ink }}>
          Your appointment
        </h1>
      </div>

      <div className="rounded-2xl p-6" style={{ background: "#fff", border: `1px solid ${COLORS.line}` }}>
        {loadError && <p style={{ color: COLORS.coral }}>{loadError}</p>}
        {!loadError && loading && <p style={{ color: COLORS.slate }}>Loading queue status...</p>}
        {!loadError && !loading && !activeQueue && (
          <p style={{ color: COLORS.slate }}>You are not currently in any queue.</p>
        )}

        {!loadError && !loading && activeQueue && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs" style={{ color: COLORS.slate }}>
                  {activeQueue.serviceName}
                </p>
                <p className="text-4xl font-semibold mt-1" style={{ fontFamily: FONT_MONO, color: COLORS.ink }}>
                  #{activeQueue.position}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: COLORS.slate }}>
                  Estimated wait
                </p>
                <p className="text-2xl font-semibold" style={{ color: COLORS.ink }}>
                  {activeQueue.estimatedWaitMinutes} min
                </p>
              </div>
            </div>

            <div className="mt-4 h-2 rounded-full" style={{ background: COLORS.line }}>
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${Math.max(6, Math.min(100, (1 / activeQueue.position) * 100))}%`,
                  background: COLORS.amber,
                }}
              />
            </div>
            <p className="mt-2 text-xs" style={{ color: COLORS.slate }}>
              Expected duration per user: {activeQueue.expectedDuration} min
            </p>

            <StatusStepper current={currentStep} />

            <div className="flex flex-wrap gap-3 mt-6">
              <button
                type="button"
                onClick={loadQueueStatus}
                className="qs-btn text-xs font-medium px-3 py-2 rounded-lg"
                style={{ background: COLORS.ink, color: COLORS.paper }}
              >
                Refresh status
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatusStepper({ current }) {
  const currentIndex = STATUS_STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center mt-6">
      {STATUS_STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              {done ? (
                <CheckCircle2 size={20} style={{ color: COLORS.green }} />
              ) : (
                <Circle
                  size={20}
                  style={{ color: active ? COLORS.ink : COLORS.line }}
                  fill={active ? COLORS.ink : "none"}
                />
              )}
              <p
                className="text-xs mt-1.5 whitespace-nowrap"
                style={{ color: active || done ? COLORS.ink : COLORS.slate, fontWeight: active ? 600 : 400 }}
              >
                {step.label}
              </p>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div
                className="flex-1 h-px mx-2 mb-5"
                style={{ background: i < currentIndex ? COLORS.green : COLORS.line }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
