import { useEffect, useMemo, useState } from "react";
import { Clock, CheckCircle2, CircleAlert } from "lucide-react";

import { COLORS, FONT_MONO } from "./QueueSmartAuth";
import { StatusBadge } from "./UserBadges";
import { fetchMyQueues, joinQueue, leaveQueue } from "./api";

/* ---------------------------------------------------------
  Join Queue — backend-driven queue join/leave flow.
--------------------------------------------------------- */
export default function JoinQueueScreen({ token, services, selectedServiceId, setSelectedServiceId }) {
  const [myQueues, setMyQueues] = useState([]);
  const [loadingQueues, setLoadingQueues] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingQueues(true);
    fetchMyQueues(token)
      .then(({ queues }) => {
        if (!cancelled) setMyQueues(queues);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingQueues(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const service = useMemo(
    () => services.find((candidate) => candidate.id === selectedServiceId) || services[0],
    [services, selectedServiceId]
  );
  const queueForSelectedService = useMemo(
    () => myQueues.find((entry) => entry.serviceId === service?.id) || null,
    [myQueues, service?.id]
  );

  function selectService(id) {
    setSelectedServiceId(id);
  }

  async function refreshMyQueues() {
    const { queues } = await fetchMyQueues(token);
    setMyQueues(queues);
  }

  async function handleJoinQueue() {
    if (!service) return;
    setSubmitting(true);
    setActionError("");
    try {
      await joinQueue(token, { serviceId: service.id });
      await refreshMyQueues();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLeaveQueue() {
    if (!service) return;
    setSubmitting(true);
    setActionError("");
    try {
      await leaveQueue(token, { serviceId: service.id });
      await refreshMyQueues();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest mb-2" style={{ fontFamily: FONT_MONO, color: COLORS.slate }}>
          Join a queue
        </p>
        <h1 className="text-2xl font-semibold" style={{ color: COLORS.ink }}>
          Book an appointment
        </h1>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {services.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => selectService(s.id)}
            className="qs-btn text-left rounded-2xl p-4"
            style={{
              background: "#fff",
              border: `1px solid ${s.id === selectedServiceId ? COLORS.ink : COLORS.line}`,
              boxShadow: s.id === selectedServiceId ? `0 0 0 1px ${COLORS.ink}` : "none",
            }}
          >
            <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>
              {s.name}
            </p>
            <p className="text-xs mt-1" style={{ color: COLORS.slate }}>
              {s.description}
            </p>
            <div className="mt-3">
              <StatusBadge status="open" />
            </div>
          </button>
        ))}
      </div>

      {service ? (
        <div className="rounded-2xl p-6" style={{ background: "#fff", border: `1px solid ${COLORS.line}` }}>
          <h2 className="text-lg font-semibold" style={{ color: COLORS.ink }}>
            {service.name}
          </h2>
          <p className="text-sm mt-1" style={{ color: COLORS.slate }}>
            {service.description}
          </p>

          <div className="mt-5">
            <p className="text-xs" style={{ color: COLORS.slate }}>
              Expected duration
            </p>
            <p className="text-lg font-semibold flex items-center gap-1.5" style={{ color: COLORS.ink }}>
              <Clock size={16} /> {service.duration} min
            </p>
          </div>

          {loadError && (
            <p className="mt-5 text-sm flex items-center gap-1.5" style={{ color: COLORS.coral }}>
              <CircleAlert size={16} /> {loadError}
            </p>
          )}
          {actionError && (
            <p className="mt-2 text-sm flex items-center gap-1.5" style={{ color: COLORS.coral }}>
              <CircleAlert size={16} /> {actionError}
            </p>
          )}

          {!loadError && loadingQueues && (
            <p className="mt-5 text-sm" style={{ color: COLORS.slate }}>
              Loading your queue status...
            </p>
          )}

          {!loadError && !loadingQueues && queueForSelectedService && (
            <div className="mt-5">
              <p className="text-sm flex items-center gap-1.5" style={{ color: COLORS.greenText }}>
                <CheckCircle2 size={16} /> You're in queue at position #{queueForSelectedService.position}. Estimated
                wait: {queueForSelectedService.estimatedWaitMinutes} min.
              </p>
              <button
                type="button"
                disabled={submitting}
                onClick={handleLeaveQueue}
                className="qs-btn mt-3 text-sm font-semibold px-4 py-2.5 rounded-lg"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
              >
                {submitting ? "Leaving..." : "Leave queue"}
              </button>
            </div>
          )}

          {!loadError && !loadingQueues && !queueForSelectedService && (
            <div className="mt-5">
              <p className="text-xs" style={{ color: COLORS.slate }}>
                Join this queue to receive wait-time estimates and notifications.
              </p>
              <button
                type="button"
                disabled={submitting}
                onClick={handleJoinQueue}
                className="qs-btn mt-3 text-sm font-semibold px-4 py-2.5 rounded-lg"
                style={{ background: COLORS.ink, color: COLORS.paper }}
              >
                {submitting ? "Joining..." : "Join queue"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm" style={{ color: COLORS.slate }}>
          No services available.
        </p>
      )}
    </div>
  );
}
