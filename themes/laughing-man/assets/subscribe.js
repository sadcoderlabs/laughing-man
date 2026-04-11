(() => {
  const subscribeSection = document.getElementById("subscribe");
  const subscribeForm = document.querySelector("[data-subscribe-form]");
  const subscribeInput = document.querySelector("[data-subscribe-input]");
  const subscribeMessage = document.querySelector("[data-subscribe-message]");

  if (
    !(subscribeSection instanceof HTMLElement) ||
    !(subscribeForm instanceof HTMLFormElement) ||
    !(subscribeInput instanceof HTMLInputElement) ||
    !(subscribeMessage instanceof HTMLElement)
  ) {
    return;
  }

  function focusSubscribe() {
    window.history.replaceState(null, "", "#subscribe");
    const previousScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    subscribeSection.scrollIntoView({ block: "center" });
    document.documentElement.style.scrollBehavior = previousScrollBehavior;
    subscribeInput.focus({ preventScroll: true });
    subscribeInput.select();
    subscribeForm.classList.remove("is-targeted");
    void subscribeForm.offsetWidth;
    subscribeForm.classList.add("is-targeted");
    setTimeout(() => subscribeForm.classList.remove("is-targeted"), 1200);
  }

  document.querySelectorAll('a[href="#subscribe"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      focusSubscribe();
    });
  });

  subscribeForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = subscribeForm.querySelector("button");
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = true;
    }

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: subscribeInput.value }),
      });
      const data = await res.json();
      if (data.ok) {
        subscribeMessage.textContent =
          data.result === "already_subscribed"
            ? "You're already subscribed."
            : data.result === "resubscribed"
              ? "Welcome back \u2014 you're subscribed again."
              : "Subscribed";
        subscribeMessage.className = "subscribe-message success";
        subscribeForm.reset();
      } else {
        subscribeMessage.textContent = data.error || "something went wrong";
        subscribeMessage.className = "subscribe-message error";
      }
    } catch {
      subscribeMessage.textContent = "Something went wrong";
      subscribeMessage.className = "subscribe-message error";
    }

    subscribeMessage.hidden = false;

    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = false;
    }
  });
})();
