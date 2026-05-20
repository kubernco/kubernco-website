(() => {
  // Scroll-reveal via IntersectionObserver
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
  );

  document.querySelectorAll(".anim").forEach((el) => observer.observe(el));

  // Contact form
  const form = document.getElementById("contact-form");
  const status = form.querySelector(".form-status");
  const btn = form.querySelector("button[type=submit]");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.className = "form-status";
    status.textContent = "";

    const email = form.querySelector("[name=email]").value.trim();
    const message = form.querySelector("[name=message]").value.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status.className = "form-status error";
      status.textContent = "A valid email address is required.";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Sending…";

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, message }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      status.className = "form-status";
      status.textContent = "Sent. I'll be in touch.";
      form.reset();
    } catch {
      status.className = "form-status error";
      status.textContent = "Something went wrong. Email hello@kubernco.com directly.";
    } finally {
      btn.disabled = false;
      btn.textContent = "Send";
    }
  });
})();
