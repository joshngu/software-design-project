import { useEffect, useState } from "react";

import { COLORS, FONT_MONO } from "./QueueSmartAuth";
import { OutcomeBadge } from "./UserBadges";
import { fetchHistory, fetchServices } from "./api";

const OUTCOME_LABELS = {
  served: "Served",
  left_queue: "Left queue",
  no_show: "No-show",
};

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/* ---------------------------------------------------------
   History — past queues joined, loaded from the backend
--------------------------------------------------------- */
export default function HistoryScreen({ token }) {
  const [history, setHistory] = useState([]);
  const [serviceNames, setServiceNames] = useState({});
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchHistory(token), fetchServices(token)])
      .then(([historyRes, servicesRes]) => {
        if (cancelled) return;
        setHistory(historyRes.history);
        const names = {};
        servicesRes.services.forEach((service) => {
          names[service.id] = service.name;
        });
        setServiceNames(names);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest mb-2" style={{ fontFamily: FONT_MONO, color: COLORS.slate }}>
          History
        </p>
        <h1 className="text-2xl font-semibold" style={{ color: COLORS.ink }}>
          Past queues
        </h1>
      </div>

      {loadError && <p style={{ color: COLORS.coral }}>{loadError}</p>}

      {!loadError && loading && (
        <p className="text-sm" style={{ color: COLORS.slate }}>
          Loading history…
        </p>
      )}

      {!loadError && !loading && history.length === 0 && (
        <p className="text-sm" style={{ color: COLORS.slate }}>
          You haven't joined any queues yet.
        </p>
      )}

      {!loadError && !loading && history.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: `1px solid ${COLORS.line}` }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                <th className="text-left font-medium px-5 py-3" style={{ color: COLORS.slate }}>
                  Date
                </th>
                <th className="text-left font-medium px-5 py-3" style={{ color: COLORS.slate }}>
                  Time
                </th>
                <th className="text-left font-medium px-5 py-3" style={{ color: COLORS.slate }}>
                  Service
                </th>
                <th className="text-left font-medium px-5 py-3" style={{ color: COLORS.slate }}>
                  Outcome
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                  <td className="px-5 py-3" style={{ color: COLORS.ink }}>
                    {formatDate(h.joinedAt)}
                  </td>
                  <td className="px-5 py-3" style={{ color: COLORS.ink }}>
                    {formatTime(h.joinedAt)}
                  </td>
                  <td className="px-5 py-3" style={{ color: COLORS.ink }}>
                    {serviceNames[h.serviceId] || `Service #${h.serviceId}`}
                  </td>
                  <td className="px-5 py-3">
                    <OutcomeBadge outcome={OUTCOME_LABELS[h.outcome] || h.outcome} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
