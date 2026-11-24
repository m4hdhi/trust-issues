(() => {
  const LINKS = [
    '#rcnt a[href]',
    '#search a[href]',
    '#rso a[href]',
    '#taw a[href]',
    '#tads a[href]',
    '#tadsb a[href]',
    '#bottomads a[href]',
    '#botstuff a[href]',
    '#rhs a[href]',
  ].join(', ');
  const HEADING = 'h3, [role="heading"]';
  const WEBSITE_LABEL = /^(website|الموقع الإلكتروني|الموقع|موقع الويب)$/i;
  const CAROUSEL = 'g-scrolling-carousel, g-inner-card';

  function destination(a) {
    const pcu = (a.getAttribute('data-pcu') || '').split(',')[0].trim();
    return pcu || a.href;
  }

  function isPrimary(a) {
    if (a.closest(CAROUSEL)) return false;
    if (a.querySelector(HEADING)) return true;
    return Boolean(a.closest('#rhs')) && WEBSITE_LABEL.test(a.textContent.trim());
  }

  function placeAfter(a) {
    return (host) => {
      const parent = a.parentElement;
      if (!parent) return;
      const display = getComputedStyle(parent).display;
      if (display.includes('flex') || display.includes('grid')) return;
      host.dataset.display = 'block';
      a.after(host);
    };
  }

  globalThis.TrustIssues?.start({
    collect() {
      return Array.from(document.querySelectorAll(LINKS), (a) => ({
        el: a,
        href: destination(a),
        place: isPrimary(a) ? placeAfter(a) : null,
      }));
    },
  });
})();
