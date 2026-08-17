import { useEffect, useMemo, useState } from "react";
import { Clock, CheckCircle2, CircleAlert } from "lucide-react";

import { COLORS, FONT_MONO } from "./QueueSmartAuth";
import { StatusBadge } from "./UserBadges";
import { fetchMyQueues, fetchQueueSummary, joinQueue, leaveQueue } from "./api";

function mapSummaryByService(summary = []) {
  return summary.reduce((acc, item) => {
    acc[item.serviceId] = item;
    return acc;
  }, {});
}

/* ---------------------------------------------------------
  Join Queue — backend-driven queue join/leave flow.
--------------------------------------------------------- */
export default function JoinQueueScreen({ token, services, selectedServiceId, setSelectedServiceId }) {
  const [myQueues, setMyQueues] = useState([]);
  const [loadingQueues, setLoadingQueues] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [queueSummaryByService, setQueueSummaryByService] = useState({});

  async function refreshQueueData() {
    const [{ queues }, { summary }] = await Promise.all([fetchMyQueues(token), fetchQueueSummary(token)]);
    setMyQueues(queues);
    setQueueSummaryByService(mapSummaryByService(summary));
  }

  useEffect(() => {
    let cancelled = false;
    setLoadingQueues(true);
    refreshQueueData()
      .then(() => {
        if (!cancelled) {
          setLoadError("");
        }
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
  const selectedServiceSummary = service ? queueSummaryByService[service.id] : null;

  const recommendedService = useMemo(() => {
    const candidates = services
      .map((candidate) => ({ service: candidate, summary: queueSummaryByService[candidate.id] }))
      .filter((item) => item.summary?.status === "open")
      .sort(
        (a, b) =>
          a.summary.estimatedWaitForNewJoinMinutes - b.summary.estimatedWaitForNewJoinMinutes ||
          a.summary.queueLength - b.summary.queueLength ||
          a.service.id - b.service.id
      );
    return candidates[0] || null;
  }, [services, queueSummaryByService]);

  function selectService(id) {
    setSelectedServiceId(id);
  }

  async function handleJoinQueue() {
    if (!service) return;
    setSubmitting(true);
    setActionError("");
    try {
      await joinQueue(token, { serviceId: service.id });
      await refreshQueueData();
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
      await refreshQueueData();
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
            <div className="mt-3 flex items-center justify-between gap-2">
              <StatusBadge status={queueSummaryByService[s.id]?.status || "open"} />
              <span className="text-xs" style={{ color: COLORS.slate }}>
                {queueSummaryByService[s.id]
                  ? `~${queueSummaryByService[s.id].estimatedWaitForNewJoinMinutes} min`
                  : "Calculating..."}
              </span>
            </div>
          </button>
        ))}
      </div>

      {!loadError && !loadingQueues && recommendedService && (
        <div className="rounded-xl px-4 py-3" style={{ background: "#fff", border: `1px solid ${COLORS.line}` }}>
          <p className="text-xs" style={{ color: COLORS.slate }}>
            Recommended service (shortest estimated wait)
          </p>
          <p className="text-sm font-medium mt-1" style={{ color: COLORS.ink }}>
            {recommendedService.service.name} ~{recommendedService.summary.estimatedWaitForNewJoinMinutes} min
          </p>
          {service?.id !== recommendedService.service.id && (
            <button
              type="button"
              onClick={() => selectService(recommendedService.service.id)}
              className="qs-btn mt-2 text-xs font-semibold px-3 py-2 rounded-lg"
              style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
            >
              Switch to recommended
            </button>
          )}
        </div>
      )}

      {!loadError && !loadingQueues && !recommendedService && services.length > 0 && (
        <p className="text-sm" style={{ color: COLORS.slate }}>
          No open queues are available right now.
        </p>
      )}

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
            {!!selectedServiceSummary && (
              <p className="text-xs mt-1" style={{ color: COLORS.slate }}>
                Estimated wait if you join now: ~{selectedServiceSummary.estimatedWaitForNewJoinMinutes} min
              </p>
            )}
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
              Loading queue status...
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
              {selectedServiceSummary?.status === "closed" && (
                <p className="text-xs mt-2" style={{ color: COLORS.coral }}>
                  This queue is currently closed.
                </p>
              )}
              <button
                type="button"
                disabled={submitting || selectedServiceSummary?.status === "closed"}
                onClick={handleJoinQueue}
                className="qs-btn mt-3 text-sm font-semibold px-4 py-2.5 rounded-lg"
                style={{ background: COLORS.ink, color: COLORS.paper, opacity: selectedServiceSummary?.status === "closed" ? 0.6 : 1 }}
              >
                {submitting ? "Joining..." : selectedServiceSummary?.status === "closed" ? "Queue closed" : "Join queue"}
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
