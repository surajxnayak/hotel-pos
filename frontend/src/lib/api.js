import axios from "axios";
import { logError, logInfo } from "./debugStore";

const BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8080";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Read the freshest customer token from localStorage on every request
const readCustomerToken = () => {
  try {
    const raw = localStorage.getItem("trattoria_customer");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.customerToken || null;
  } catch {
    return null;
  }
};

// Attach the right token per endpoint
api.interceptors.request.use((config) => {
  const url = config.url || "";
  const staffToken = localStorage.getItem("staff_token");
  const customerToken = readCustomerToken();

  // Staff endpoints
  if (
    staffToken &&
    (url.includes("/waiter/") ||
      url.includes("/kitchen/") ||
      url.includes("/cashier/") ||
      url.includes("/bills") ||
      url.includes("/admin/") ||
      url.includes("/staff/me"))
  ) {
    config.headers.Authorization = `Bearer ${staffToken}`;
    logInfo("api", `→ auth: staff token attached (${url})`);
  }
  // Customer session create/join AND customer identity endpoints require Bearer <customerToken>
  else if (
    /\/api\/sessions\/(create|join)\//.test(url) ||
    /\/api\/customers\/(me|logout)/.test(url)
  ) {
    if (customerToken) {
      config.headers.Authorization = `Bearer ${customerToken}`;
      logInfo("api", `→ auth: customer token attached (${url})`);
    } else {
      logError("api", `→ auth: NO customer token in localStorage for ${url}`);
    }
  }

  logInfo("api", `${config.method?.toUpperCase()} ${url}`);
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    let backendMsg;
    if (err.response) {
      backendMsg =
        err.response.data?.message ||
        err.response.data?.error ||
        err.message ||
        "Request failed";
    } else if (err.code === "ERR_NETWORK" || err.message === "Network Error") {
      // Browser couldn't reach the server at all — CORS block or server down
      backendMsg = `Cannot reach backend at ${BASE_URL}. Check that (1) the Spring Boot server is running on port 8080, (2) it binds to 0.0.0.0 (not just 127.0.0.1), and (3) CORS allows origin ${window.location.origin}.`;
    } else if (err.code === "ECONNABORTED") {
      backendMsg = `Request timed out (${BASE_URL}).`;
    } else {
      backendMsg = err.message || "Request failed";
    }
    logError(
      "api",
      `${status || err.code || "ERR"} ${err.config?.url || ""} — ${backendMsg}`,
      err.response?.data
    );
    return Promise.reject({ status, message: backendMsg, raw: err.response?.data });
  }
);

export const API_BASE_URL = BASE_URL;

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const dateOnlyToInstant = (value, endOfDay = false) => {
  if (typeof value !== "string" || !DATE_ONLY_RE.test(value)) return value;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );

  return date.toISOString();
};

const withIsoInstantRange = (params) => {
  if (!params) return params;

  return {
    ...params,
    from: dateOnlyToInstant(params.from),
    to: dateOnlyToInstant(params.to, true),
  };
};

// ---------- Endpoint helpers ----------

// Public
export const getMenu = () => api.get("/api/menu").then((r) => r.data);

// Customer identity
export const customerLogin = (phoneNumber) =>
  api.post("/api/customers/login", { phoneNumber }).then((r) => r.data);

export const customerLogout = () =>
  api.post("/api/customers/logout").then((r) => r.data);

// Customer's current session (resume flow)
export const getMySession = () =>
  api.get("/api/customers/me/session").then((r) => r.data);

// Leave the current table
export const leaveTable = () =>
  api.post("/api/customers/me/session/leave").then((r) => r.data);

export const getSessionStatus = (qrToken) =>
  api.get(`/api/sessions/status/${qrToken}`).then((r) => r.data);
export const createSession = (qrToken) =>
  api.post(`/api/sessions/create/${qrToken}`).then((r) => r.data);
export const joinSession = (qrToken, pin) =>
  api.post(`/api/sessions/join/${qrToken}`, { pin }).then((r) => r.data);

// Cart — note: `notes` is no longer accepted by the backend for customer add/edit.
// Item notes are staff-only via waiterSetItemNote() below.
export const getCart = (sessionToken) =>
  api.get(`/api/cart/${sessionToken}`).then((r) => r.data);
export const addCartItem = (sessionToken, body) => {
  // Strip any legacy `notes` field just in case a caller still sends it.
  const { menuItemId, quantity, selectedOptionIds } = body || {};
  const payload = { menuItemId, quantity };
  if (Array.isArray(selectedOptionIds) && selectedOptionIds.length > 0) {
    payload.selectedOptionIds = selectedOptionIds;
  }
  return api.post(`/api/cart/${sessionToken}/items`, payload).then((r) => r.data);
};
export const updateCartItem = (sessionToken, itemId, body) => {
  // Only `quantity` is accepted on edits now.
  const payload = {};
  if (body && body.quantity != null) payload.quantity = body.quantity;
  return api
    .patch(`/api/cart/${sessionToken}/items/${itemId}`, payload)
    .then((r) => r.data);
};
export const removeCartItem = (sessionToken, itemId) =>
  api.delete(`/api/cart/${sessionToken}/items/${itemId}`).then((r) => r.data);
export const submitCart = (sessionToken) =>
  api.post(`/api/cart/${sessionToken}/submit`).then((r) => r.data);

// Orders
export const getSessionOrders = (sessionToken) =>
  api.get(`/api/sessions/${sessionToken}/orders`).then((r) => r.data);
export const getOrder = (orderId) =>
  api.get(`/api/orders/${orderId}`).then((r) => r.data);
export const requestBill = (sessionToken) =>
  api.post(`/api/orders/bill-request/${sessionToken}`).then((r) => r.data);

// Customer-facing bill/receipt (no auth; works before + after payment)
export const getSessionBill = (sessionToken) =>
  api.get(`/api/sessions/${sessionToken}/bill`).then((r) => r.data);

// Auth
export const login = (username, password) =>
  api.post("/api/auth/login", { username, password }).then((r) => r.data);

// Waiter
export const waiterTablesList = () => api.get("/api/waiter/tables").then((r) => r.data);
export const waiterTableDetail = (tableId) =>
  api.get(`/api/waiter/tables/${tableId}`).then((r) => r.data);
export const waiterStartTableSession = (tableId) =>
  api.post(`/api/waiter/tables/${tableId}/session`).then((r) => r.data);
export const waiterPlaceOrder = (tableId, items) =>
  api.post(`/api/waiter/tables/${tableId}/orders`, { items }).then((r) => r.data);
export const waiterRequestBillForTable = (tableId) =>
  api.post(`/api/waiter/tables/${tableId}/request-bill`).then((r) => r.data);
export const waiterPending = () => api.get("/api/waiter/orders/pending").then((r) => r.data);
export const waiterReady = () => api.get("/api/waiter/orders/ready-to-serve").then((r) => r.data);
export const waiterConfirm = (orderId) =>
  api.patch(`/api/waiter/orders/${orderId}/confirm`).then((r) => r.data);
export const waiterServeItem = (itemId) =>
  api.patch(`/api/waiter/order-items/${itemId}/serve`).then((r) => r.data);
export const waiterRemoveItem = (orderId, itemId) =>
  api.delete(`/api/waiter/orders/${orderId}/items/${itemId}`).then((r) => r.data);
export const waiterUpdateItem = (orderId, itemId, body) =>
  api.patch(`/api/waiter/orders/${orderId}/items/${itemId}`, body).then((r) => r.data);
// Waiter-only notes (table + item)
export const waiterSetTableNote = (tableId, note) =>
  api.patch(`/api/waiter/tables/${tableId}/note`, { note }).then((r) => r.data);
export const waiterSetItemNote = (itemId, note) =>
  api.patch(`/api/waiter/order-items/${itemId}/note`, { note }).then((r) => r.data);

// Kitchen
export const kitchenQueue = () => api.get("/api/kitchen/queue").then((r) => r.data);
export const kitchenSetItemStatus = (itemId, itemStatus) =>
  api
    .patch(`/api/kitchen/order-items/${itemId}/status`, { itemStatus })
    .then((r) => r.data);
export const kitchenTablesList = () =>
  api.get("/api/kitchen/tables").then((r) => r.data);
export const kitchenTableDetail = (tableId) =>
  api.get(`/api/kitchen/tables/${tableId}`).then((r) => r.data);

// Cashier
export const cashierTablesList = () => api.get("/api/cashier/tables").then((r) => r.data);
export const cashierTableDetail = (tableId) =>
  api.get(`/api/cashier/tables/${tableId}`).then((r) => r.data);
export const cashierRequested = () =>
  api.get("/api/bills/requested").then((r) => r.data);
export const cashierPending = () => api.get("/api/bills/pending").then((r) => r.data);
export const revertBillRequest = (sessionId) =>
  api.patch(`/api/bills/${sessionId}/revert`).then((r) => r.data);
export const generateBill = (sessionId, body) =>
  api.post(`/api/bills/${sessionId}/generate`, body).then((r) => r.data);
export const payBill = (billId, paymentMethod, tip) => {
  const body = { paymentMethod };
  if (tip != null && tip !== "") body.tip = Number(tip);
  return api.patch(`/api/bills/${billId}/pay`, body).then((r) => r.data);
};
export const payBillSplit = (billId, payments, tip) => {
  const body = { payments };
  if (tip != null && tip !== "") body.tip = Number(tip);
  return api.patch(`/api/bills/${billId}/pay-split`, body).then((r) => r.data);
};
export const voidBill = (billId, reason) =>
  api.patch(`/api/bills/${billId}/void`, { reason }).then((r) => r.data);

// ---------- Staff profile (universal) ----------
export const getMyProfile = () => api.get("/api/staff/me").then((r) => r.data);
export const updateMyProfile = (body) => api.patch("/api/staff/me", body).then((r) => r.data);
export const changeMyPassword = (body) =>
  api.patch("/api/staff/me/password", body).then((r) => r.data);

// ---------- Admin ----------
export const adminMe = () => api.get("/api/admin/me").then((r) => r.data);
export const adminSetPin = (currentPassword, newPin) =>
  api.patch("/api/admin/me/pin", { currentPassword, newPin }).then((r) => r.data);

// Tables (admin variant + audit)
export const adminTablesList = (params) =>
  api.get("/api/admin/tables", { params }).then((r) => r.data);
export const adminTableDetail = (tableId) =>
  api.get(`/api/admin/tables/${tableId}`).then((r) => r.data);
export const adminFreeSession = (tableId, pin) =>
  api.post(`/api/admin/tables/${tableId}/free-session`, { pin }).then((r) => r.data);
export const adminRevealParticipants = (tableId, pin) =>
  api.post(`/api/admin/tables/${tableId}/reveal-participants`, { pin }).then((r) => r.data);
export const adminOrderHistory = (orderId) =>
  api.get(`/api/admin/orders/${orderId}/history`).then((r) => r.data);

// Table roster
export const adminTablesRoster = () =>
  api.get("/api/admin/tables/roster").then((r) => r.data);
export const adminCreateTable = (pin, tables) =>
  api.post("/api/admin/tables", { pin, tables }).then((r) => r.data);
export const adminUpdateTable = (tableId, body) =>
  api.patch(`/api/admin/tables/${tableId}`, body).then((r) => r.data);
export const adminRetireTables = (pin, tableIds) =>
  api.post("/api/admin/tables/retire", { pin, tableIds }).then((r) => r.data);
export const adminReactivateTables = (pin, tableIds) =>
  api.post("/api/admin/tables/reactivate", { pin, tableIds }).then((r) => r.data);

// Staff
export const adminStaffList = () => api.get("/api/admin/staff").then((r) => r.data);
export const adminCreateStaff = (pin, staff) =>
  api.post("/api/admin/staff", { pin, staff }).then((r) => r.data);
export const adminUpdateStaff = (staffId, body) =>
  api.patch(`/api/admin/staff/${staffId}`, body).then((r) => r.data);
export const adminActivateStaff = (pin, staffIds) =>
  api.post("/api/admin/staff/activate", { pin, staffIds }).then((r) => r.data);
export const adminDeactivateStaff = (pin, staffIds) =>
  api.post("/api/admin/staff/deactivate", { pin, staffIds }).then((r) => r.data);

// Menu
export const adminMenuCategories = () =>
  api.get("/api/admin/menu/categories").then((r) => r.data);
export const adminCreateCategory = (pin, categories) =>
  api.post("/api/admin/menu/categories", { pin, categories }).then((r) => r.data);
export const adminUpdateCategory = (id, body) =>
  api.patch(`/api/admin/menu/categories/${id}`, body).then((r) => r.data);
export const adminDeleteCategory = (id) =>
  api.delete(`/api/admin/menu/categories/${id}`).then((r) => r.data);
export const adminMenuItems = () =>
  api.get("/api/admin/menu/items").then((r) => r.data);
export const adminCreateItem = (pin, items) =>
  api.post("/api/admin/menu/items", { pin, items }).then((r) => r.data);
export const adminUpdateItem = (id, body) =>
  api.patch(`/api/admin/menu/items/${id}`, body).then((r) => r.data);
export const adminSetItemAvailability = (id, available) =>
  api.patch(`/api/admin/menu/items/${id}/availability`, { available }).then((r) => r.data);
export const adminDeleteItem = (id) =>
  api.delete(`/api/admin/menu/items/${id}`).then((r) => r.data);

// Menu — customization groups & options
export const adminCreateCustomizationGroups = (itemId, pin, groups) =>
  api
    .post(`/api/admin/menu/items/${itemId}/customization-groups`, { pin, groups })
    .then((r) => r.data);
export const adminUpdateCustomizationGroup = (groupId, body) =>
  api
    .patch(`/api/admin/menu/customization-groups/${groupId}`, body)
    .then((r) => r.data);
export const adminDeleteCustomizationGroups = (pin, groupIds) =>
  api
    .post(`/api/admin/menu/customization-groups/delete`, { pin, groupIds })
    .then((r) => r.data);
export const adminCreateCustomizationOptions = (groupId, pin, options) =>
  api
    .post(`/api/admin/menu/customization-groups/${groupId}/options`, { pin, options })
    .then((r) => r.data);
export const adminUpdateCustomizationOption = (optionId, body) =>
  api
    .patch(`/api/admin/menu/customization-options/${optionId}`, body)
    .then((r) => r.data);
export const adminDeleteCustomizationOptions = (pin, optionIds) =>
  api
    .post(`/api/admin/menu/customization-options/delete`, { pin, optionIds })
    .then((r) => r.data);

// Bills history
export const adminBills = (params) =>
  api.get("/api/admin/bills", { params: withIsoInstantRange(params) }).then((r) => r.data);

// Analytics
export const adminRevenue = (params) =>
  api.get("/api/admin/analytics/revenue", { params: withIsoInstantRange(params) }).then((r) => r.data);
export const adminTopItems = (params) =>
  api.get("/api/admin/analytics/top-items", { params: withIsoInstantRange(params) }).then((r) => r.data);
export const adminTiming = (params) =>
  api.get("/api/admin/analytics/timing", { params: withIsoInstantRange(params) }).then((r) => r.data);
export const adminVoidDiscountReport = (params) =>
  api.get("/api/admin/analytics/void-discount-report", { params: withIsoInstantRange(params) }).then((r) => r.data);
export const adminStaffPerformanceWaiters = (params) =>
  api.get("/api/admin/analytics/staff-performance/waiters", { params: withIsoInstantRange(params) }).then((r) => r.data);
export const adminStaffPerformanceCashiers = (params) =>
  api.get("/api/admin/analytics/staff-performance/cashiers", { params: withIsoInstantRange(params) }).then((r) => r.data);
export const adminCustomerRetention = (params) =>
  api.get("/api/admin/analytics/customer-retention", { params: withIsoInstantRange(params) }).then((r) => r.data);
export const adminTablePerformance = (params) =>
  api.get("/api/admin/analytics/table-performance", { params: withIsoInstantRange(params) }).then((r) => r.data);
export const adminPeakHours = (params) =>
  api.get("/api/admin/analytics/peak-hours", { params: withIsoInstantRange(params) }).then((r) => r.data);
export const adminTipSummary = (params) =>
  api.get("/api/admin/analytics/tip-summary", { params: withIsoInstantRange(params) }).then((r) => r.data);
export const adminDietaryMix = (params) =>
  api.get("/api/admin/analytics/dietary-mix", { params: withIsoInstantRange(params) }).then((r) => r.data);
export const adminUpsellPerformance = (params) =>
  api.get("/api/admin/analytics/upsell-performance", { params: withIsoInstantRange(params) }).then((r) => r.data);
