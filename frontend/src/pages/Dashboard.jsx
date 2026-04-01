import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { dashboardStyles } from '../assets/dummyStyles';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import KpiCard from '../components/KpiCard';

const API_BASE_URL = 'http://localhost:4000';

/* normalize client object */
function normalizeClient(raw) {
  if (!raw) return { name: "", email: "", address: "", phone: "" };
  if (typeof raw === "string")
    return { name: raw, email: "", address: "", phone: "" };
  if (typeof raw === "object") {
    return {
      name: raw.name ?? raw.company ?? raw.client ?? "",
      email: raw.email ?? raw.emailAddress ?? "",
      address: raw.address ?? "",
      phone: raw.phone ?? raw.contact ?? "",
    };
  }
  return { name: "", email: "", address: "", phone: "" };
}

function currencyFmt(amount = 0, currency = "INR") {
  try {
    const n = Number(amount || 0);
    return new Intl.NumberFormat(
      currency === "INR" ? "en-IN" : undefined,
      { style: "currency", currency }
    ).format(n);
  } catch {
    return `${currency} ${amount}`;
  }
}

function capitalize(s) {
  if (!s) return s;
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

function formatDate(dateInput) {
  if (!dateInput) return "—";
  const d = dateInput instanceof Date ? dateInput : new Date(String(dateInput));
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { getToken, isSignedIn } = useAuth();

  const obtainToken = useCallback(async () => {
    if (typeof getToken !== "function") return null;
    try {
      let token = await getToken({ template: "default" }).catch(() => null);
      if (!token) {
        token = await getToken({ forceRefresh: true }).catch(() => null);
      }
      return token;
    } catch {
      return null;
    }
  }, [getToken]);

  const [storedInvoices, setStoredInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [businessProfile, setBusinessProfile] = useState(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await obtainToken();
      const headers = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/api/invoices`, { method: "GET", headers });

      const json = await res.json().catch(() => null);

      if (res.status === 401) {
        setError("Unauthorized. Please sign in.");
        setStoredInvoices([]);
        return;
      }

      if (!res.ok) {
        throw new Error(json?.message || `Failed (${res.status})`);
      }

      const raw = json?.data || [];

      const mapped = (Array.isArray(raw) ? raw : []).map((inv) => {
        const amountVal = Number(inv?.total ?? inv?.amount ?? 0);
        const currency = (inv?.currency || "INR").toUpperCase();

        return {
          ...inv,
          id: inv?.invoiceNumber || inv?._id || String(inv?._id || ""),
          client: normalizeClient(inv?.client),
          amount: amountVal,
          currency,
          status:
            typeof inv?.status === "string"
              ? capitalize(inv.status)
              : inv?.status || "Draft",
        };
      });

      setStoredInvoices(mapped);
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
      setError(err?.message || "Failed to load invoices");
      setStoredInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [obtainToken]);

  const fetchBusinessProfile = useCallback(async () => {
    try {
      const token = await obtainToken();
      if (!token) return;

      const res = await fetch(`${API_BASE_URL}/api/businessProfile/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) return;

      const json = await res.json().catch(() => null);
      if (json?.data) setBusinessProfile(json.data);
    } catch (err) {
      console.warn("Failed to fetch business profile:", err);
    }
  }, [obtainToken]);

  useEffect(() => {
    fetchInvoices();
    fetchBusinessProfile();

    function onStorage(e) {
      if (e.key === "invoices_v1") fetchInvoices();
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [fetchInvoices, fetchBusinessProfile, isSignedIn]);

  // ✅ FIXED KPI
  const kpis = useMemo(() => {
    const totalInvoices = storedInvoices.length;

    const paidInvoices = storedInvoices.filter(inv => inv.status === "Paid");

    const totalPaid = paidInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

    const totalUnpaid = storedInvoices
      .filter(inv => inv.status !== "Paid")
      .reduce((sum, inv) => sum + (inv.amount || 0), 0);

    const paidCount = paidInvoices.length;

    const paidPercentage =
      totalInvoices > 0 ? (paidCount / totalInvoices) * 100 : 0;

    return {
      totalInvoices,
      totalPaid,
      totalUnpaid,
      paidCount,
      paidPercentage,
    };
  }, [storedInvoices]);

  return (
    <div className={dashboardStyles.pageContainer}>
      <div className={dashboardStyles.headerContainer}>
        <h1 className={dashboardStyles.headerTitle}>Dashboard Overview</h1>
        <p className={dashboardStyles.headerSubtitle}>
          Track your invoicing performance and business insights
        </p>
      </div>

      {loading ? (
        <div className="p-6">Loading...</div>
      ) : error ? (
        <div className="p-6">
          <div className="text-red-600 mb-3">Error: {error}</div>
          <div className="flex gap-2">
            <button
              onClick={fetchInvoices}
              className="px-3 py-1 bg-blue-600 text-white rounded"
            >
              Retry
            </button>

            {String(error).toLowerCase().includes("unauthorized") && (
              <button
                onClick={() => navigate("/login")}
                className="px-3 py-1 bg-gray-700 text-white rounded"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      ) : null}

      <div className={dashboardStyles.kpiGrid}>
        <KpiCard title="Total Invoices" value={kpis.totalInvoices} hint="Active invoices" iconType="document" trend={8.5} />

        <KpiCard title="Total Paid" value={currencyFmt(kpis.totalPaid, "INR")} hint="Received Amount(INR)" iconType="revenue" trend={12.2} />

        <KpiCard title="Total Unpaid" value={currencyFmt(kpis.totalUnpaid, "INR")} hint="Outstanding Balance (INR)" iconType="clock" trend={-3.1} />
      </div>

      <div className={dashboardStyles.mainGrid}>
        <div className={dashboardStyles.sidebarColumn}>
          <div className={dashboardStyles.quickStatsCard}>
            <h3 className={dashboardStyles.quickStatsTitle}>Quick Stats</h3>
            <div className='space-y-3'>

              <div className={dashboardStyles.quickStatsRow}>
                <span className={dashboardStyles.quickStatsLabel}>Paid Rate</span>
                <span className={dashboardStyles.quickStatsValue}>
                  {kpis.totalInvoices > 0
                    ? ((kpis.paidCount / kpis.totalInvoices) * 100).toFixed(1)
                    : 0} %
                </span>
              </div>

              <div className={dashboardStyles.quickStatsRow}>
                <span className={dashboardStyles.quickStatsLabel}>Avg. Invoice</span>
                <span className={dashboardStyles.quickStatsValue}>
                  {currencyFmt(
                    kpis.totalInvoices > 0
                      ? (kpis.totalPaid + kpis.totalUnpaid) / kpis.totalInvoices
                      : 0,
                    "INR"
                  )}
                </span>
              </div>

              <div className={dashboardStyles.quickStatsRow}>
                <span className={dashboardStyles.quickStatsLabel}>Collection Eff.</span>
                <span className={dashboardStyles.quickStatsValue}>
                  {kpis.paidPercentage.toFixed(1)}%
                </span>
              </div>

            </div>
          </div>

          {/*  */}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;