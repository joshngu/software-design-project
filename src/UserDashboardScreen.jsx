import { COLORS, FONT_MONO } from "./QueueSmartAuth";
import { StatusBadge } from "./UserBadges";
import { useNotifications } from "./Notifications";

function timeAgo(ts) { 
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

/* ---------------------------------------------------------
   User Dashboard — overview, active services, notifications
--------------------------------------------------------- */
export default function UserDashboardScreen({ user, services, goJoin, goStatus }) {
  const name = user?.fullName || (user?.email ? user.email.split("@")[0] : "there");
  const { items: notifications } = useNotifications();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest mb-2" style={{ fontFamily: FONT_MONO, color: COLORS.slate }}>
          Customer
        </p>
        <h1 className="text-2xl font-semibold" style={{ color: COLORS.ink }}>
          Welcome back, {name}
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl p-6" style={{ background: "#fff", border: `1px solid ${COLORS.line}` }}>
          <h2 className="text-sm font-semibold mb-1" style={{ color: COLORS.ink }}>
            Queue tracker
          </h2>
          <p className="text-sm" style={{ color: COLORS.slate }}>
            Check your live queue position and estimated wait time from the backend.
          </p>
          <button
            onClick={goStatus}
            className="qs-btn mt-4 text-xs font-semibold px-3 py-2 rounded-lg"
            style={{ background: COLORS.ink, color: COLORS.paper }}
          >
            View appointment status
          </button>
        </div>

        <div className="rounded-2xl p-6" style={{ background: "#fff", border: `1px solid ${COLORS.line}` }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>
            Active services
          </h2>
          <ul className="space-y-2">
            {services.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span style={{ color: COLORS.ink }}>{s.name}</span>
                <StatusBadge status="open" />
              </li>
            ))}
            {services.length === 0 && (
              <li className="text-sm" style={{ color: COLORS.slate }}>
                No services available.
              </li>
            )}
          </ul>
          <button
            onClick={goJoin}
            className="qs-btn mt-4 text-xs font-semibold px-3 py-2 rounded-lg"
            style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
          >
            Join a queue
          </button>
        </div>
      </div>

      <div className="rounded-2xl p-6" style={{ background: "#fff", border: `1px solid ${COLORS.line}` }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>
          Notifications
        </h2>
        <ul className="space-y-3">
          {notifications.slice(0, 4).map((n) => (
            <li key={n.id} className="flex items-start gap-3 text-sm">
              <span
                className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                style={{ background: n.read ? COLORS.line : COLORS.coral }}
              />
              <div>
                <p style={{ color: COLORS.ink }}>{n.title}</p>
                <p className="text-xs mt-0.5" style={{ color: COLORS.slate }}>
                  {timeAgo(n.ts)} 
                </p>
              </div>
            </li>
          ))}
          {notifications.length === 0 && ( 
            <p className="text-sm" style={{ color: COLORS.slate }}>
              No notifications yet.
            </p>
          )} 
        </ul>
      </div>
    </div>
  );
}
