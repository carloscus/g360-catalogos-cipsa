export function getCatalogYearRange() {
  const year = new Date().getFullYear();
  return { year, nextYear: year + 1 };
}

function applyYearToText(text, year, range) {
  return text.replace(/\b20\d{2}\s*-\s*20\d{2}\b|\b20\d{2}\b/g, (match) => {
    return match.includes('-') ? range : String(year);
  });
}

export function applyReactiveYear() {
  const { year, nextYear } = getCatalogYearRange();
  const range = `${year} - ${nextYear}`;

  const replacements = [
    document.title,
    ...Array.from(document.querySelectorAll('meta[property="og:title"], meta[name="twitter:title"]')).map(m => m.getAttribute('content'))
  ];

  replacements.forEach((text, i) => {
    const updated = applyYearToText(text, year, range);
    if (i === 0) {
      document.title = updated;
    } else {
      const meta = document.querySelectorAll('meta[property="og:title"], meta[name="twitter:title"]')[i - 1];
      meta.setAttribute('content', updated);
    }
  });

  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = el.dataset.year === 'range' ? range : String(year);
  });
}