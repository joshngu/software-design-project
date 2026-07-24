import { useEffect, useMemo, useState } from "react";

import {
  fetchServices,
  createService,
  updateService,
  fetchQueueSummary,
  fetchQueueForService,
  serveNextUser as apiServeNextUser,
} from "./api";

const blankForm = {
  name: "",
  description: "",
  duration: "",
  priority: "medium",
};

export default function App({ userEmail, token, onLogout }) {
  const [activeScreen, setActiveScreen] = useState("dashboard");
  const [services, setServices] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [queueLoadError, setQueueLoadError] = useState("");
  const [queueSummaryByService, setQueueSummaryByService] = useState({});
  const [selectedQueueEntries, setSelectedQueueEntries] = useState([]);
  const [servingNext, setServingNext] = useState(false);

  const [isQueueOpen, setIsQueueOpen] = useState(true);
  const [selectedServiceId, setSelectedServiceId] = useState(null);

  const [formData, setFormData] = useState(blankForm);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  async function refreshQueueSummary() {
    const { summary } = await fetchQueueSummary(token);
    const mapped = {};
    summary.forEach((item) => {
      mapped[item.serviceId] = item.queueLength;
    });
    setQueueSummaryByService(mapped);
  }

  async function refreshQueueForService(serviceId) {
    if (!serviceId) {
      setSelectedQueueEntries([]);
      return;
    }
    const { queue } = await fetchQueueForService(token, serviceId);
    setSelectedQueueEntries(queue);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchServices(token), fetchQueueSummary(token)])
      .then(([servicesRes, queueSummaryRes]) => {
        if (cancelled) return;
        const fetched = servicesRes.services;
        setServices(fetched);
        const mapped = {};
        queueSummaryRes.summary.forEach((item) => {
          mapped[item.serviceId] = item.queueLength;
        });
        setQueueSummaryByService(mapped);
        setSelectedServiceId((prev) => prev ?? fetched[0]?.id ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!selectedServiceId) return;
    let cancelled = false;
    setQueueLoadError("");
    fetchQueueForService(token, selectedServiceId)
      .then(({ queue }) => {
        if (!cancelled) setSelectedQueueEntries(queue);
      })
      .catch((err) => {
        if (!cancelled) setQueueLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token, selectedServiceId]);

  const totalQueuedUsers = useMemo(
    () => Object.values(queueSummaryByService).reduce((sum, count) => sum + count, 0),
    [queueSummaryByService]
  );

  function handleFieldChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear that field's error as soon as the user starts fixing it
    setFormErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  }

  async function handleSaveService(event) {
    event.preventDefault();

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      duration: formData.duration,
      priority: formData.priority,
    };

    setSubmitting(true);
    try {
      if (editingServiceId) {
        const { service } = await updateService(token, editingServiceId, payload);
        setServices((prev) => prev.map((s) => (s.id === editingServiceId ? service : s)));
      } else {
        const { service } = await createService(token, payload);
        setServices((prev) => [...prev, service]);
        setQueueSummaryByService((prev) => ({ ...prev, [service.id]: 0 }));
        setSelectedServiceId((prev) => prev ?? service.id);
      }
      setEditingServiceId(null);
      setFormData(blankForm);
      setFormErrors({});
    } catch (err) {
      setFormErrors(
        err.fieldErrors && Object.keys(err.fieldErrors).length ? err.fieldErrors : { form: err.message }
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleEditService(service) {
    setEditingServiceId(service.id);
    setFormData({
      name: service.name,
      description: service.description,
      duration: String(service.duration),
      priority: service.priority,
    });
    setFormErrors({});
    setActiveScreen("service-management");
  }

  function handleCancelEdit() {
    setEditingServiceId(null);
    setFormData(blankForm);
    setFormErrors({});
  }

  async function handleServeNextUser(serviceId) {
    setServingNext(true);
    setQueueLoadError("");
    try {
      await apiServeNextUser(token, serviceId);
      await Promise.all([refreshQueueSummary(), refreshQueueForService(serviceId)]);
    } catch (err) {
      setQueueLoadError(err.message);
    } finally {
      setServingNext(false);
    }
  }
  const selectedQueue = selectedQueueEntries;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Administrator Screens</h1>
        <button
          className={activeScreen === "dashboard" ? "nav-btn active" : "nav-btn"}
          onClick={() => setActiveScreen("dashboard")}
        >
          Admin Dashboard
        </button>
        <button
          className={
            activeScreen === "service-management" ? "nav-btn active" : "nav-btn"
          }
          onClick={() => setActiveScreen("service-management")}
        >
          Service Management
        </button>
        <button
          className={
            activeScreen === "queue-management" ? "nav-btn active" : "nav-btn"
          }
          onClick={() => setActiveScreen("queue-management")}
        >
          Queue Management
        </button>

        {onLogout && (
          <div className="sidebar-footer">
            {userEmail && <p className="sidebar-user">{userEmail}</p>}
            <button className="nav-btn" onClick={onLogout}>
              Log out
            </button>
          </div>
        )}
      </aside>

      <main className="content">
        {activeScreen === "dashboard" && (
          <section>
            <h2>Admin Dashboard</h2>
            <div className="card-grid">
              <article className="card">
                <h3>List of Services</h3>
                <ul className="simple-list">
                  {services.map((service) => (
                    <li key={service.id}>{service.name}</li>
                  ))}
                </ul>
              </article>

              <article className="card">
                <h3>Current Queue Lengths</h3>
                <ul className="simple-list">
                  {services.map((service) => (
                    <li key={service.id}>
                      {service.name}: {queueSummaryByService[service.id] || 0}
                    </li>
                  ))}
                </ul>
                <p className="total">Total waiting users: {totalQueuedUsers}</p>
              </article>

              <article className="card">
                <h3>Quick Actions</h3>
                <p>Queue status: {isQueueOpen ? "Open" : "Closed"}</p>
                <div className="inline-actions">
                  <button
                    className="btn btn-success"
                    onClick={() => setIsQueueOpen(true)}
                  >
                    Open Queue
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => setIsQueueOpen(false)}
                  >
                    Close Queue
                  </button>
                </div>
              </article>
            </div>
          </section>
        )}

        {activeScreen === "service-management" && (
          <section>
            <h2>Service Management Screen</h2>
            <form className="card form-layout" onSubmit={handleSaveService} noValidate>
              <h3>{editingServiceId ? "Edit Service" : "Create Service"}</h3>

              <label className={formErrors.name ? "field-invalid" : ""}>
                Service Name (required, max 100 characters)
                <input
                  name="name"
                  maxLength={100}
                  value={formData.name}
                  onChange={handleFieldChange}
                  aria-invalid={!!formErrors.name}
                  aria-describedby="name-error name-count"
                />
                <span id="name-count" className="char-count">
                  {formData.name.length} / 100
                </span>
                {formErrors.name && (
                  <span id="name-error" className="error">
                    {formErrors.name}
                  </span>
                )}
              </label>

              <label className={formErrors.description ? "field-invalid" : ""}>
                Description (required)
                <textarea
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleFieldChange}
                  aria-invalid={!!formErrors.description}
                  aria-describedby="description-error"
                />
                {formErrors.description && (
                  <span id="description-error" className="error">
                    {formErrors.description}
                  </span>
                )}
              </label>

              <label className={formErrors.duration ? "field-invalid" : ""}>
                Expected Duration in Minutes (required, whole number &gt; 0)
                <input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  name="duration"
                  value={formData.duration}
                  onChange={handleFieldChange}
                  aria-invalid={!!formErrors.duration}
                  aria-describedby="duration-error"
                />
                {formErrors.duration && (
                  <span id="duration-error" className="error">
                    {formErrors.duration}
                  </span>
                )}
              </label>

              <label className={formErrors.priority ? "field-invalid" : ""}>
                Priority Level (required)
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleFieldChange}
                  aria-invalid={!!formErrors.priority}
                  aria-describedby="priority-error"
                >
                  <option value="">Select priority…</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                {formErrors.priority && (
                  <span id="priority-error" className="error">
                    {formErrors.priority}
                  </span>
                )}
              </label>

              {formErrors.form && <span className="error">{formErrors.form}</span>}

              <div className="inline-actions">
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting
                    ? "Saving…"
                    : editingServiceId
                    ? "Save Changes"
                    : "Create Service"}
                </button>
                {editingServiceId && (
                  <button
                    className="btn"
                    type="button"
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            <article className="card">
              <h3>Existing Services</h3>
              {loadError && <p className="error">{loadError}</p>}
              <ul className="service-list">
                {services.map((service) => (
                  <li key={service.id}>
                    <div>
                      <strong>{service.name}</strong>
                      <p>{service.description}</p>
                      <small>
                        Duration: {service.duration} mins | Priority:{" "}
                        {service.priority}
                      </small>
                    </div>
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => handleEditService(service)}
                    >
                      Edit
                    </button>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        )}

        {activeScreen === "queue-management" && (
          <section>
            <h2>Queue Management Screen</h2>
            <article className="card">
              <label>
                Select Service
                <select
                  value={selectedServiceId ?? ""}
                  onChange={(event) => setSelectedServiceId(Number(event.target.value))}
                  disabled={services.length === 0}
                >
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="inline-actions top-margin">
                <button
                  className="btn btn-primary"
                  onClick={() => handleServeNextUser(selectedServiceId)}
                  disabled={selectedQueue.length === 0 || servingNext}
                >
                  {servingNext ? "Serving..." : "Serve Next User"}
                </button>
              </div>

              {queueLoadError && <p className="error top-margin">{queueLoadError}</p>}

              {selectedQueue.length === 0 ? (
                <p className="top-margin">No users currently waiting for this service.</p>
              ) : (
                <ul className="queue-list top-margin">
                  {selectedQueue.map((appointment) => (
                    <li key={appointment.id}>
                      <span>
                        #{appointment.position} {appointment.displayName}
                        <span className="appointment-time">
                          {" "}
                          — Priority: {appointment.priority}, Est. wait:{" "}
                          {appointment.estimatedWaitMinutes} min
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>
        )}
      </main>
    </div>
  );
}
