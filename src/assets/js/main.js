// WowCity site interactions. Plain JS, no dependencies. Everything degrades to a readable static page.
(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const rupees = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;

  /* ---------- Hero words ---------- */
  $$(".hero-title .reveal-word").forEach((word, index) => word.style.setProperty("--w", index));
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add("is-loaded")));

  /* ---------- Scroll reveal ---------- */
  const revealables = $$(".reveal");
  revealables.forEach((el) => el.style.setProperty("--d", el.dataset.delay || 0));
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add("in"));
  }

  /* ---------- Header, progress bar, steps ---------- */
  const header = $("[data-header]");
  const steps = $("[data-steps]");
  let lastY = window.scrollY;
  let ticking = false;

  function onScroll() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    document.documentElement.style.setProperty("--progress", max > 0 ? (y / max).toFixed(4) : 0);
    if (header) {
      header.classList.toggle("is-scrolled", y > 24);
      const menuOpen = document.body.classList.contains("menu-open");
      header.classList.toggle("is-hidden", !menuOpen && y > 480 && y > lastY + 4);
      if (y < lastY - 4) header.classList.remove("is-hidden");
    }
    if (steps) {
      const rect = steps.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (window.innerHeight * 0.75 - rect.top) / (rect.height + window.innerHeight * 0.2)));
      steps.style.setProperty("--steps", progress.toFixed(3));
      const items = $$(".step", steps);
      items.forEach((step, index) => step.classList.toggle("is-active", progress >= index / items.length + 0.02));
    }
    lastY = y;
    ticking = false;
  }
  window.addEventListener("scroll", () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  }, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  const toggle = $("[data-menu-toggle]");
  const menu = $("[data-mobile-menu]");
  function setMenu(open) {
    if (!toggle || !menu) return;
    document.body.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open) menu.hidden = false;
    else setTimeout(() => { if (!document.body.classList.contains("menu-open")) menu.hidden = true; }, 700);
  }
  toggle?.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
  menu?.addEventListener("click", (event) => { if (event.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") setMenu(false); });
  window.matchMedia("(min-width: 921px)").addEventListener("change", (event) => { if (event.matches) setMenu(false); });

  /* ---------- Word rotator ---------- */
  const rotator = $("[data-rotator]");
  if (rotator && !reduceMotion) {
    const words = rotator.dataset.rotator.split(",");
    let index = 0;
    setInterval(() => {
      index = (index + 1) % words.length;
      rotator.innerHTML = "";
      [...words[index]].forEach((ch, i) => {
        const span = document.createElement("span");
        span.className = "ch";
        span.style.setProperty("--c", i);
        span.textContent = ch === " " ? " " : ch;
        rotator.appendChild(span);
      });
      rotator.setAttribute("aria-label", words[index]);
    }, 2600);
  }

  /* ---------- Count-up numbers ---------- */
  function countUp(el, to, duration = 1600) {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      el.textContent = Math.round(to * eased).toLocaleString("en-IN");
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const counters = $$("[data-count]");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const co = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        countUp(entry.target, Number(entry.target.dataset.count));
        co.unobserve(entry.target);
      }
    }, { threshold: 0.6 });
    counters.forEach((el) => co.observe(el));
  }

  /* ---------- Pointer effects ---------- */
  if (finePointer && !reduceMotion) {
    document.addEventListener("pointermove", (event) => {
      const card = event.target.closest?.(".spotlight");
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      card.style.setProperty("--my", `${event.clientY - rect.top}px`);
    }, { passive: true });

    $$("[data-magnetic]").forEach((btn) => {
      btn.addEventListener("pointermove", (event) => {
        const rect = btn.getBoundingClientRect();
        const x = (event.clientX - rect.left - rect.width / 2) * 0.18;
        const y = (event.clientY - rect.top - rect.height / 2) * 0.3;
        btn.style.transform = `translate(${x}px, ${y}px)`;
      });
      btn.addEventListener("pointerleave", () => { btn.style.transform = ""; });
    });

    const tilt = $("[data-tilt]");
    const phone = tilt && $(".phone", tilt);
    if (tilt && phone) {
      tilt.addEventListener("pointermove", (event) => {
        const rect = tilt.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;
        phone.style.setProperty("--ry", `${(px * 18 - 4).toFixed(2)}deg`);
        phone.style.setProperty("--rx", `${(-py * 12 + 2).toFixed(2)}deg`);
      });
      tilt.addEventListener("pointerleave", () => {
        phone.style.removeProperty("--ry");
        phone.style.removeProperty("--rx");
      });
    }
  }

  /* ---------- Live billing demo in the hero phone ---------- */
  const lines = $("[data-bill-lines]");
  if (lines && !reduceMotion) {
    const scanBox = $(".scan-box");
    const scanText = $("[data-scan-text]");
    const subtotalEl = $("[data-subtotal]");
    const discountEl = $("[data-discount]");
    const totalEl = $("[data-total]");
    const pay = $("[data-pay]");
    const toast = $("[data-toast]");
    const stockChip = $(".chip-stock");
    const stockValue = $("[data-stock]");
    const items = [
      { name: "Cotton kurta", meta: "Size M · Saffron", price: 899, color: "#ff7a2f", query: "8901 0425 7731" },
      { name: "Slim fit jeans", meta: "Size 32 · Indigo", price: 1299, color: "#3d63ff", query: "jeans 32" },
      { name: "Silk dupatta", meta: "Free size · Rani", price: 649, color: "#ff2e7e", query: "8901 0425 9902" }
    ];
    const discount = 47;
    let visible = true;
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(lines.closest(".phone"));
    const whenVisible = async () => { while (!visible || document.hidden) await sleep(400); };

    function tween(el, from, to, duration, format) {
      return new Promise((resolve) => {
        const start = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - start) / duration);
          el.textContent = format(from + (to - from) * (1 - Math.pow(1 - t, 3)));
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
    }

    async function type(text) {
      scanBox.classList.add("is-typing");
      scanText.textContent = "";
      for (const ch of text) {
        scanText.textContent += ch;
        await sleep(45 + Math.random() * 40);
      }
    }

    async function run() {
      for (;;) {
        await whenVisible();
        lines.innerHTML = "";
        subtotalEl.textContent = "₹0";
        discountEl.textContent = "−₹0";
        totalEl.textContent = "₹0";
        pay.textContent = "Collect ₹0";
        pay.classList.remove("is-done");
        toast.classList.remove("is-shown");
        stockValue.textContent = "5 → 5";
        let subtotal = 0;
        await sleep(700);

        for (const item of items) {
          await whenVisible();
          if (/^\d/.test(item.query)) {
            scanText.textContent = "Scanning…";
            scanBox.classList.add("is-scanning");
            await sleep(1100);
            scanBox.classList.remove("is-scanning");
            scanText.textContent = item.query;
          } else {
            await type(item.query);
          }
          await sleep(380);
          const li = document.createElement("li");
          li.className = "is-new";
          li.innerHTML = `<span class="bl-swatch" style="--sw:${item.color}"></span><span class="bl-name">${item.name}<small>${item.meta}</small></span><b>${rupees(item.price)}</b>`;
          lines.appendChild(li);
          scanBox.classList.remove("is-typing");
          scanText.textContent = "Scan or search item";
          const before = subtotal;
          subtotal += item.price;
          await Promise.all([
            tween(subtotalEl, before, subtotal, 600, rupees),
            tween(totalEl, before, subtotal, 600, rupees)
          ]);
          pay.textContent = `Collect ${rupees(subtotal)}`;
          await sleep(650);
        }

        await tween(discountEl, 0, discount, 500, (n) => `−${rupees(n)}`);
        await tween(totalEl, subtotal, subtotal - discount, 500, rupees);
        pay.textContent = `Collect ${rupees(subtotal - discount)}`;
        await sleep(900);
        pay.classList.add("is-pressed");
        await sleep(180);
        pay.classList.remove("is-pressed");
        pay.classList.add("is-done");
        pay.textContent = "Paid ✓";
        await sleep(450);
        toast.classList.add("is-shown");
        stockValue.textContent = "5 → 4";
        stockChip.classList.remove("is-flash");
        void stockChip.offsetWidth;
        stockChip.classList.add("is-flash");
        await sleep(3200);
      }
    }
    run();
  }

  /* ---------- Tabs ---------- */
  $$("[data-tabs]").forEach((tabs) => {
    const buttons = $$('[role="tab"]', tabs);
    function select(button, focus) {
      buttons.forEach((b) => {
        const on = b === button;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(b.getAttribute("aria-controls"));
        if (!panel) return;
        panel.hidden = !on;
        if (on) {
          panel.classList.remove("is-entering");
          void panel.offsetWidth;
          panel.classList.add("is-entering");
        }
      });
      if (focus) button.focus();
      button.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    }
    buttons.forEach((button, index) => {
      button.addEventListener("click", () => select(button, false));
      button.addEventListener("keydown", (event) => {
        const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
        if (event.key in keys) {
          event.preventDefault();
          select(buttons[(index + keys[event.key] + buttons.length) % buttons.length], true);
        } else if (event.key === "Home") {
          event.preventDefault();
          select(buttons[0], true);
        } else if (event.key === "End") {
          event.preventDefault();
          select(buttons[buttons.length - 1], true);
        }
      });
    });
  });

  /* ---------- FAQ: smooth open and close, one at a time ---------- */
  $$(".faq").forEach((faq) => {
    const items = $$("details", faq);
    items.forEach((details) => {
      const summary = $("summary", details);
      const body = $(".faq-body", details);
      summary.addEventListener("click", (event) => {
        if (reduceMotion || !body.animate) return;
        event.preventDefault();
        if (details.open) {
          const anim = body.animate([{ height: `${body.offsetHeight}px`, opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 320, easing: "cubic-bezier(.2,.7,.2,1)" });
          anim.onfinish = () => { details.open = false; };
        } else {
          items.forEach((other) => {
            if (other !== details && other.open) $("summary", other).click();
          });
          details.open = true;
          const height = body.offsetHeight;
          body.animate([{ height: "0px", opacity: 0 }, { height: `${height}px`, opacity: 1 }], { duration: 420, easing: "cubic-bezier(.2,.7,.2,1)" });
        }
      });
    });
  });

  /* ---------- Join form ---------- */
  const form = $("[data-join-form]");
  if (form) {
    const errorBox = $("[data-form-error]", form);
    const success = $("[data-form-success]");
    const submitLabel = $(".btn-label", form);
    const select = $("select", form);
    select?.addEventListener("change", () => select.classList.toggle("has-value", !!select.value));

    const showError = (message) => {
      errorBox.textContent = message;
      errorBox.hidden = false;
    };
    const fieldsOf = () => Object.fromEntries(new FormData(form).entries());

    function validate() {
      let firstBad = null;
      $$("input[required], select[required]", form).forEach((input) => {
        const bad = !input.checkValidity();
        input.closest(".field")?.classList.toggle("is-invalid", bad);
        if (bad && !firstBad) firstBad = input;
      });
      const phone = $("#f-phone", form);
      const digits = phone.value.replace(/\D/g, "");
      if (phone.value && (digits.length < 10 || digits.length > 13)) {
        phone.closest(".field").classList.add("is-invalid");
        firstBad = firstBad || phone;
      }
      return firstBad;
    }
    form.addEventListener("input", (event) => event.target.closest(".field")?.classList.remove("is-invalid"));

    function fallback(data) {
      const text = [
        "Hi WowCity, I want to make my shop digital.",
        `Shop: ${data["Shop name"]}`,
        `Name: ${data["Owner name"]}`,
        `Mobile: ${data["Mobile (WhatsApp)"]}`,
        `City: ${data.City}`,
        `Sells: ${data["Shop type"]}`,
        `Stores: ${data.Stores}`,
        data.Message ? `Note: ${data.Message}` : ""
      ].filter(Boolean).join("\n");
      if (form.dataset.whatsapp) {
        const base = form.dataset.whatsapp.split("?")[0];
        window.open(`${base}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
        return true;
      }
      if (form.dataset.email) {
        window.location.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent("Join WowCity")}&body=${encodeURIComponent(text)}`;
        return true;
      }
      return false;
    }

    function showSuccess(name) {
      $("[data-success-name]", success).textContent = name || "friend";
      form.hidden = true;
      success.hidden = false;
      success.focus();
      success.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorBox.hidden = true;
      const bad = validate();
      if (bad) {
        showError("Please fill the highlighted fields.");
        bad.focus();
        return;
      }
      const data = fieldsOf();
      if (data._honey) return;
      form.classList.add("is-sending");
      submitLabel.textContent = "Sending…";
      try {
        if (!form.dataset.email) throw new Error("no-endpoint");
        const response = await fetch(`https://formsubmit.co/ajax/${form.dataset.email}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(data)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || String(result.success) !== "true") throw new Error(result.message || "send-failed");
        showSuccess(data["Owner name"]);
      } catch (error) {
        if (fallback(data)) showSuccess(data["Owner name"]);
        else showError("We couldn't send that just now. Please try again in a minute.");
      } finally {
        form.classList.remove("is-sending");
        submitLabel.textContent = "Join free today";
      }
    });
  }

  /* ---------- Smooth page transitions ---------- */
  if (!reduceMotion) {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[href]");
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (link.target && link.target !== "_self") return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || !/\.html$|\/$/.test(url.pathname) || (url.pathname === location.pathname && url.hash)) return;
      if (url.href === location.href) return;
      event.preventDefault();
      document.body.classList.add("is-leaving");
      setTimeout(() => { location.href = url.href; }, 260);
    });
    window.addEventListener("pageshow", () => document.body.classList.remove("is-leaving"));
  }

  /* ---------- Back to top ---------- */
  $("[data-to-top]")?.addEventListener("click", (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });
})();
