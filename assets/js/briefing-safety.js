/* Shared browser/server publication contract. Fail closed on legacy or malformed data. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BriefingSafety = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_AGE_MS = 18 * 60 * 60 * 1000;
  const FUTURE_SKEW_MS = 5 * 60 * 1000;
  const PUBLISHERS = ['reuters.com','apnews.com','bloomberg.com','cnbc.com','wsj.com','ft.com','marketwatch.com','finance.yahoo.com','krx.co.kr','bok.or.kr','fss.or.kr','dart.fss.or.kr','kosis.kr','kofia.or.kr','yna.co.kr','yonhapnewstv.co.kr','hankyung.com','mk.co.kr','sedaily.com','newsis.com','edaily.co.kr','fnnews.com','mt.co.kr','infomax.co.kr','samsung.com','news.samsung.com','skhynix.com','news.skhynix.com','federalreserve.gov','bls.gov','bea.gov','sec.gov'];
  const plain = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const text = (x, min = 1, max = 600) => typeof x === 'string' && x.trim().length >= min && x.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(x);
  function safeSourceUrl(value) {
    if (typeof value !== 'string' || value.length > 4096) return null;
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:' || u.username || u.password || u.port || u.hash || u.hostname.endsWith('.')) return null;
      if (!PUBLISHERS.some(h => u.hostname === h || u.hostname.endsWith('.' + h))) return null;
      if (!u.pathname || u.pathname === '/' || /(?:example|placeholder|sample|source[0-9])(?:[./_-]|$)/i.test(u.pathname)) return null;
      return u.href;
    } catch { return null; }
  }
  function iso(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  }
  function unavailable(now = new Date()) {
    return { schemaVersion: 2, status: 'unavailable', generatedAt: now.toISOString(), summary: [], sources: [] };
  }
  function safeSummary(value, generated) {
    if (!text(value, 15, 600)) return false;
    // This is a conservative publication filter, not independent fact checking.
    if (/매수|매도|보유|비중|손절|익절|진입|추천|권장|해야\s*(한다|합니다)|하시기|하세요|목표\s*주가|buy|sell|hold|recommend/i.test(value)) return false;
    const dates = value.match(/\d{4}-\d{2}-\d{2}/g);
    if (!dates?.length || !Number.isFinite(generated)) return false;
    const kstDay = new Date(generated + 9 * 3600000).toISOString().slice(0, 10);
    const day = Date.parse(kstDay + 'T00:00:00.000Z');
    return dates.every(d => {
      const time = Date.parse(d + 'T00:00:00.000Z');
      return Number.isFinite(time) && new Date(time).toISOString().slice(0,10) === d && time <= day && time >= day - 86400000;
    });
  }
  function validateReport(report, now = Date.now()) {
    if (!plain(report) || report.schemaVersion !== 2 || report.status !== 'ready') return false;
    if (!iso(report.generatedAt) || !iso(report.expiresAt)) return false;
    const generated = Date.parse(report.generatedAt), expires = Date.parse(report.expiresAt);
    if (generated > now + FUTURE_SKEW_MS || expires <= now || expires <= generated || expires - generated > MAX_AGE_MS || now - generated > MAX_AGE_MS) return false;
    if (!Array.isArray(report.sources) || report.sources.length < 2 || report.sources.length > 8 || !Array.isArray(report.summary) || report.summary.length < 3 || report.summary.length > 6) return false;
    const urls = new Set();
    for (const source of report.sources) {
      if (!plain(source) || !text(source.title, 2, 300) || /가상|출처\s*\d|placeholder|example/i.test(source.title) || !safeSourceUrl(source.url) || !iso(source.checkedAt)) return false;
      const checked = Date.parse(source.checkedAt);
      if (checked > now + FUTURE_SKEW_MS || Math.abs(generated - checked) > 15 * 60 * 1000 || urls.has(source.url)) return false;
      urls.add(source.url);
    }
    for (const item of report.summary) {
      if (!plain(item) || !safeSummary(item.text, generated) || item.grounded !== true || !Array.isArray(item.sourceIndexes) || !item.sourceIndexes.length || item.sourceIndexes.length > 8) return false;
      if (!item.sourceIndexes.every(i => Number.isInteger(i) && i >= 0 && i < report.sources.length)) return false;
      if (new Set(item.sourceIndexes).size !== item.sourceIndexes.length) return false;
    }
    return true;
  }
  return { MAX_AGE_MS, FUTURE_SKEW_MS, PUBLISHERS, safeSourceUrl, safeSummary, iso, unavailable, validateReport };
});
