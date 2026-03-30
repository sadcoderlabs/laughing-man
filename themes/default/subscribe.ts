interface SubscribeElements {
  formId: string;
  inputId: string;
  messageId: string;
}

export function subscribeScript({ formId, inputId, messageId }: SubscribeElements): string {
  return `<script>
    const subscribeSection = document.getElementById('subscribe');
    const subscribeForm = document.getElementById('${formId}');
    const subscribeInput = document.getElementById('${inputId}');

    function focusSubscribe() {
      window.history.replaceState(null, '', '#subscribe');
      const previousScrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      subscribeSection.scrollIntoView({ block: 'center' });
      document.documentElement.style.scrollBehavior = previousScrollBehavior;
      subscribeInput.focus({ preventScroll: true });
      subscribeInput.select();
      subscribeForm.classList.remove('is-targeted');
      void subscribeForm.offsetWidth;
      subscribeForm.classList.add('is-targeted');
      setTimeout(() => subscribeForm.classList.remove('is-targeted'), 1200);
    }

    document.querySelectorAll('a[href="#subscribe"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        focusSubscribe();
      });
    });

    subscribeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const msg = document.getElementById('${messageId}');
      const email = form.email.value;
      form.querySelector('button').disabled = true;
      try {
        const res = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (data.ok) {
          msg.textContent =
            data.result === 'already_subscribed'
              ? "You're already subscribed."
              : data.result === 'resubscribed'
                ? "Welcome back \u2014 you're subscribed again."
                : 'Subscribed';
          msg.className = 'subscribe-message success';
          form.reset();
        } else {
          msg.textContent = data.error || 'something went wrong';
          msg.className = 'subscribe-message error';
        }
      } catch {
        msg.textContent = 'Something went wrong';
        msg.className = 'subscribe-message error';
      }
      msg.hidden = false;
      form.querySelector('button').disabled = false;
    });
  </script>`;
}
