// Cloudflare Worker: serves the static site and handles the Join form.
// POST /api/join emails the request to JOIN_TO (a Cloudflare secret; default support@luzzan.com) through Resend.
// Secret needed in Cloudflare: RESEND_API_KEY (Worker → Settings → Variables and Secrets).

const LIMITS = {
  "Shop name": 120,
  "Owner name": 80,
  "Mobile (WhatsApp)": 20,
  City: 60,
  Email: 120,
  "Shop type": 40,
  Stores: 10,
  "Billing today": 30,
  Message: 1500
};
const REQUIRED = ["Shop name", "Owner name", "Mobile (WhatsApp)", "City"];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

/** Checks and trims the form fields. Returns { fields } or { error }. */
export function readJoinForm(body) {
  if (!body || typeof body !== "object") return { error: "Please fill the form and try again." };
  const fields = {};
  for (const [key, max] of Object.entries(LIMITS)) {
    const raw = typeof body[key] === "string" ? body[key] : "";
    // Keep line breaks in the message; everything else is one line.
    const value = (key === "Message" ? raw.replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n") : raw.replace(/\s+/g, " ")).trim();
    if (value.length > max) return { error: `${key} is too long.` };
    fields[key] = value;
  }
  for (const key of REQUIRED) if (!fields[key]) return { error: "Please fill the highlighted fields." };
  const digits = fields["Mobile (WhatsApp)"].replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return { error: "Enter a valid mobile number." };
  if (fields.Email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.Email)) return { error: "Enter a valid email, or leave it empty." };
  return { fields };
}

export function joinEmail(fields, submittedAt) {
  const rows = Object.entries(fields).filter(([, value]) => value);
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#14132b">
<h2 style="margin:0 0 12px">New shop wants to join WowCity</h2>
<table cellpadding="8" style="border-collapse:collapse;border:1px solid #e5e1ec">
${rows.map(([key, value]) => `<tr><th align="left" style="background:#f4efe7;border:1px solid #e5e1ec">${escapeHtml(key)}</th><td style="border:1px solid #e5e1ec">${escapeHtml(value).replace(/\n/g, "<br>")}</td></tr>`).join("\n")}
</table>
<p style="color:#85849c;font-size:13px">Sent from the Join form on luzzan.com at ${escapeHtml(submittedAt)}.</p>
</div>`;
  const text = `New shop wants to join WowCity\n\n${rows.map(([key, value]) => `${key}: ${value}`).join("\n")}\n\nSent ${submittedAt}`;
  return { subject: `New shop: ${fields["Shop name"]} (${fields.City})`, html, text };
}

/** The Resend key, accepted under its documented name or a close misspelling (trailing spaces, other case). */
function resendKey(env) {
  if (env.RESEND_API_KEY) return env.RESEND_API_KEY;
  const name = Object.keys(env).find((key) => key.trim().toUpperCase().replace(/[^A-Z]/g, "") === "RESENDAPIKEY");
  return name ? env[name] : undefined;
}

/** Where join requests go: the JOIN_TO secret (one address, or several separated by commas), else support@. */
function joinTo(env) {
  return String(env.JOIN_TO || "support@luzzan.com").trim();
}

async function handleJoin(request, env) {
  // GET is a setup check for the owner: is email configured? Shows variable names only, never values.
  if (request.method === "GET") {
    const names = Object.keys(env).filter((key) => /resend|mail|api/i.test(key) && !["JOIN_TO", "JOIN_FROM"].includes(key));
    // The destination is shown masked so this public check never reveals a personal address.
    const to = joinTo(env);
    const masked = to.replace(/^(.{2})[^@]*(@.*)$/, "$1***$2");
    return json({ ok: true, emailConfigured: Boolean(resendKey(env)), sendsTo: masked, relatedVariableNames: names });
  }
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return json({ ok: false, error: "Not allowed." }, 403);
  if (Number(request.headers.get("content-length") || 0) > 10_000) return json({ ok: false, error: "That is too long." }, 413);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Please fill the form and try again." }, 400);
  }
  // Bots fill the hidden field; tell them it worked and send nothing.
  if (body?._honey) return json({ ok: true });

  const { fields, error } = readJoinForm(body);
  if (error) return json({ ok: false, error }, 422);
  const apiKey = resendKey(env);
  if (!apiKey) return json({ ok: false, error: "Email is not set up yet." }, 503);

  const submittedAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  const message = joinEmail(fields, submittedAt);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${String(apiKey).trim()}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.JOIN_FROM || "WowCity Website <noreply@luzzan.com>",
      to: joinTo(env).split(",").map((address) => address.trim()).filter(Boolean),
      ...(fields.Email ? { reply_to: fields.Email } : {}),
      subject: message.subject,
      html: message.html,
      text: message.text
    })
  });
  if (!response.ok) {
    console.error("Resend rejected the join email", response.status, (await response.text()).slice(0, 300));
    return json({ ok: false, error: "We couldn't send that just now. Please try again in a minute." }, 502);
  }
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/join") return handleJoin(request, env);
    return env.ASSETS.fetch(request);
  }
};
