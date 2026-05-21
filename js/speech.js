/* =========================================================
   Boston Transit Adventure — READ ALOUD (text-to-speech)
   ---------------------------------------------------------
   Thin wrapper around the browser SpeechSynthesis API. Used
   for the "Read aloud" buttons. Fails quietly when a browser
   has no speech support.
   ========================================================= */
const Speech = (function () {
  const supported = (typeof window !== 'undefined') && ('speechSynthesis' in window);

  function speak(text) {
    if (!supported || !text) return;
    try {
      window.speechSynthesis.cancel(); // stop anything already talking
      const u = new SpeechSynthesisUtterance(String(text));
      u.rate = 0.92;   // a touch slower for clarity
      u.pitch = 1.0;
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignore — speech is a nice-to-have */ }
  }

  function stop() {
    if (!supported) return;
    try { window.speechSynthesis.cancel(); } catch (e) {}
  }

  // Build a small "🔊 Read aloud" button that speaks getText() when clicked.
  function button(getText, label) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn secondary small read-aloud-btn';
    b.innerHTML = '🔊 ' + (label || 'Read aloud');
    b.setAttribute('aria-label', 'Read this part aloud');
    b.addEventListener('click', function () {
      const t = (typeof getText === 'function') ? getText() : getText;
      speak(t);
    });
    return b;
  }

  return { supported: supported, speak: speak, stop: stop, button: button };
})();
