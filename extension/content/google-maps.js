(() => {
  const LINKS = 'div[role="main"] a[href], div[role="feed"] a[href], a[data-item-id="authority"]';
  const PHONE = '[data-item-id^="phone:tel:"]';

  function labelOf(node) {
    const styled = node.querySelector('.fontBodyMedium');
    if (styled) return styled;
    const leaves = [...node.querySelectorAll('div, span')].filter((n) => !n.firstElementChild && n.textContent.trim());
    return leaves.at(-1) || null;
  }

  function inRow(node) {
    return (host) => {
      host.dataset.display = 'block';
      const label = labelOf(node);
      if (label) label.after(host);
      else node.append(host);
    };
  }

  function besideChip(a) {
    return (host) => a.after(host);
  }

  function isFlagged(result) {
    return Boolean(result && !result.official && (result.verdict === 'scam' || result.verdict === 'suspicious'));
  }

  globalThis.TrustIssues?.start({
    collect() {
      return Array.from(document.querySelectorAll(LINKS), (a) => {
        let place = null;
        if (a.matches('[data-item-id]')) place = inRow(a);
        else if (a.closest('div[role="feed"]')) place = besideChip(a);
        return { el: a, href: a.href, place };
      });
    },
    afterFlush(ti) {
      for (const site of document.querySelectorAll('a[data-item-id="authority"]')) {
        const panel = site.closest('div[role="main"]');
        const phone = panel?.querySelector(PHONE);
        if (!phone) continue;
        const result = ti.resultFor(site);
        if (isFlagged(result)) ti.badge(phone, inRow(phone), result, { kind: 'phone', source: site });
        else ti.unbadge(phone);
      }
    },
  });
})();
