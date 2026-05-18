// Kubern Co — main.js
(() => {
  // ---------- AOS scroll-reveal ----------
  if (window.AOS) {
    window.AOS.init({
      duration: 800,
      easing: "ease-out-cubic",
      once: true,
      offset: 80,
    });
  }

  // ---------- Nav drawer ----------
  const toggle = document.querySelector(".nav-toggle");
  const nav    = document.getElementById("site-nav");
  const scrim  = document.querySelector(".nav-scrim");
  const close  = document.querySelector(".nav-close");

  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    nav.setAttribute("aria-hidden", String(!open));
    nav.classList.toggle("open", open);
    if (open) {
      scrim.hidden = false;
      requestAnimationFrame(() => scrim.classList.add("visible"));
      document.body.style.overflow = "hidden";
    } else {
      scrim.classList.remove("visible");
      setTimeout(() => { scrim.hidden = true; }, 300);
      document.body.style.overflow = "";
    }
  };

  toggle.addEventListener("click", () => setOpen(nav.getAttribute("aria-hidden") === "true"));
  close.addEventListener("click", () => setOpen(false));
  scrim.addEventListener("click", () => setOpen(false));
  nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("open")) setOpen(false);
  });

  // ---------- Contact form ----------
  const form = document.getElementById("contact-form");
  const status = form.querySelector(".form-status");
  const btn = form.querySelector("button[type=submit]");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.className = "form-status";
    status.textContent = "";

    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.name || !data.organization || !data.email) {
      status.className = "form-status error";
      status.textContent = "Please fill in name, organization, and email.";
      return;
    }

    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = "Sending…";

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      status.className = "form-status success";
      status.textContent = "Thank you. We'll be in touch shortly.";
      form.reset();
    } catch (err) {
      status.className = "form-status error";
      status.textContent = "Something went wrong. Please email hello@kubernco.com.";
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });
})();
