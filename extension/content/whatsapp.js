(() => {
  const LINKS = '#main a[href], [data-pre-plain-text] a[href], .copyable-text a[href]';

  function inlineAfter(a) {
    return (host) => {
      if (!getComputedStyle(a).display.startsWith('inline')) return;
      a.after(host);
    };
  }

  globalThis.TrustIssues?.start({
    collect() {
      return Array.from(document.querySelectorAll(LINKS), (a) => ({ el: a, href: a.href, place: inlineAfter(a) }));
    },
  });
})();
