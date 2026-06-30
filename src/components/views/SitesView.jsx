import { useCallback, useEffect, useRef, useState } from "react";
import {
  listSites,
  addSite,
  deleteSite,
  listReports,
  addReport,
  deleteReport,
  getReportBlob,
} from "../../db/database";
import { summarizeCookieReport } from "../../utils/cookieReport";

function formatBytes(n) {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function SitesView({ adminUnlocked }) {
  const [sites, setSites] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [reports, setReports] = useState([]);
  const [newSite, setNewSite] = useState({ name: "", url: "" });
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const refreshSites = useCallback(async () => {
    const all = await listSites();
    setSites(all);
    setSelectedId((cur) => (cur && all.some((s) => s.id === cur) ? cur : all[0]?.id ?? null));
  }, []);

  const refreshReports = useCallback(async (siteId) => {
    if (!siteId) {
      setReports([]);
      return;
    }
    setReports(await listReports(siteId));
  }, []);

  useEffect(() => {
    refreshSites();
  }, [refreshSites]);

  useEffect(() => {
    refreshReports(selectedId);
  }, [selectedId, refreshReports]);

  const selectedSite = sites.find((s) => s.id === selectedId) || null;

  const handleAddSite = useCallback(
    async (e) => {
      e.preventDefault();
      setError("");
      try {
        const id = await addSite(newSite);
        setNewSite({ name: "", url: "" });
        await refreshSites();
        setSelectedId(id);
      } catch (err) {
        setError(err.message || "Could not add site.");
      }
    },
    [newSite, refreshSites]
  );

  const handleDeleteSite = useCallback(
    async (id) => {
      if (!window.confirm("Delete this site and all its reports?")) return;
      await deleteSite(id);
      await refreshSites();
    },
    [refreshSites]
  );

  const handleUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file || !selectedId) return;
      setUploading(true);
      setError("");
      try {
        let summary = null;
        try {
          const text = await file.text();
          summary = summarizeCookieReport(text, file.type, file.name);
        } catch {
          summary = null;
        }
        await addReport({ siteId: selectedId, file, summary });
        await refreshReports(selectedId);
      } catch (err) {
        setError(err.message || "Upload failed.");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [selectedId, refreshReports]
  );

  const handleDownload = useCallback(async (report) => {
    const blob = await getReportBlob(report.id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = report.fileName || "cookiebot-report";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const handleDeleteReport = useCallback(
    async (id) => {
      if (!window.confirm("Delete this report?")) return;
      await deleteReport(id);
      await refreshReports(selectedId);
    },
    [selectedId, refreshReports]
  );

  const latest = reports[0];

  return (
    <div className="sites">
      <aside className="sites__list">
        <h3 className="sites__list-title">Sites</h3>
        <ul>
          {sites.map((site) => (
            <li key={site.id}>
              <button
                type="button"
                className={`sites__site${site.id === selectedId ? " is-active" : ""}`}
                onClick={() => setSelectedId(site.id)}
              >
                <span className="sites__site-name">{site.name}</span>
                {site.url ? <span className="sites__site-url">{site.url}</span> : null}
              </button>
            </li>
          ))}
          {sites.length === 0 ? <li className="sites__empty">No sites yet.</li> : null}
        </ul>

        {adminUnlocked ? (
          <form className="sites__add" onSubmit={handleAddSite}>
            <input
              type="text"
              placeholder="Site name"
              value={newSite.name}
              onChange={(e) => setNewSite((s) => ({ ...s, name: e.target.value }))}
              required
            />
            <input
              type="url"
              placeholder="https://…"
              value={newSite.url}
              onChange={(e) => setNewSite((s) => ({ ...s, url: e.target.value }))}
            />
            <button type="submit" className="sites__add-btn">
              Add site
            </button>
          </form>
        ) : null}
      </aside>

      <section className="sites__detail">
        {!selectedSite ? (
          <p className="panel__empty">Select or add a site to manage its Cookiebot reports.</p>
        ) : (
          <>
            <header className="sites__detail-head">
              <div>
                <h2 className="sites__detail-title">{selectedSite.name}</h2>
                {selectedSite.url ? (
                  <a href={selectedSite.url} target="_blank" rel="noopener noreferrer" className="sites__detail-url">
                    {selectedSite.url}
                  </a>
                ) : null}
              </div>
              <div className="sites__detail-actions">
                {adminUnlocked ? (
                  <>
                    <label className="sites__upload">
                      {uploading ? "Uploading…" : "Upload report"}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.json,.pdf,text/csv,application/json"
                        onChange={handleUpload}
                        hidden
                        disabled={uploading}
                      />
                    </label>
                    <button
                      type="button"
                      className="sites__danger"
                      onClick={() => handleDeleteSite(selectedSite.id)}
                    >
                      Delete site
                    </button>
                  </>
                ) : null}
              </div>
            </header>

            {error ? <p className="roadmap__error">{error}</p> : null}

            {latest?.summary?.parsed ? (
              <div className="report-summary">
                <h3 className="panel__title">Latest report insights</h3>
                <div className="report-summary__stats">
                  <div><strong>{latest.summary.cookieCount}</strong><span>cookies</span></div>
                  <div><strong>{latest.summary.unclassified}</strong><span>unclassified</span></div>
                  <div><strong>{latest.summary.marketing}</strong><span>marketing</span></div>
                  <div><strong>{latest.summary.providerCount}</strong><span>providers</span></div>
                </div>
                <div className="report-summary__cols">
                  <div>
                    <h4>Issues</h4>
                    <ul>{latest.summary.issues.map((i, idx) => <li key={idx}>{i}</li>)}</ul>
                  </div>
                  {latest.summary.recommendations.length ? (
                    <div>
                      <h4>Recommendations</h4>
                      <ul>{latest.summary.recommendations.map((r, idx) => <li key={idx}>{r}</li>)}</ul>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <h3 className="panel__title">Reports</h3>
            {reports.length === 0 ? (
              <p className="panel__empty">No reports uploaded yet.</p>
            ) : (
              <table className="projects-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Uploaded</th>
                    <th>Size</th>
                    <th>Cookies</th>
                    <th className="projects-table__actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td className="projects-table__name">{r.fileName}</td>
                      <td className="projects-table__timeline">{formatDate(r.uploadedAt)}</td>
                      <td>{formatBytes(r.size)}</td>
                      <td>{r.summary?.parsed ? r.summary.cookieCount : "—"}</td>
                      <td className="projects-table__actions">
                        <button type="button" className="projects-table__btn" onClick={() => handleDownload(r)}>
                          Download
                        </button>
                        {adminUnlocked ? (
                          <button
                            type="button"
                            className="projects-table__btn projects-table__btn--danger"
                            onClick={() => handleDeleteReport(r.id)}
                          >
                            Delete
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>
    </div>
  );
}
