/* ============================================================
   OCEAN PHARMACY — Branch Locator · script.js
   Live data from Google Sheets via opensheet.elk.sh
   ============================================================ */

'use strict';

/* ── Sheet API ───────────────────────────────────────────── */
const SHEET_URL = 'https://opensheet.elk.sh/1grir_i5EwEXcSqES2Ay2IfF0BomtZ12vp-_8ngRMa7E/Sheet1';

/* ── City Coordinates Lookup ─────────────────────────────── */
const CITY_COORDS = {
  'الرياض':            { lat: 24.7136,  lng: 46.6753 },
  'الرياص':            { lat: 24.7136,  lng: 46.6753 },
  'مكة الكرمة':        { lat: 21.3891,  lng: 39.8579 },
  'مكة المكرمة':       { lat: 21.3891,  lng: 39.8579 },
  'الطائف':            { lat: 21.2703,  lng: 40.4158 },
  'الدوادمي':          { lat: 24.4991,  lng: 44.3888 },
  'حوطة بني تميم':     { lat: 22.9949,  lng: 46.8312 },
  'ضرماء':             { lat: 24.6585,  lng: 45.6221 },
  'حريملاء':           { lat: 25.0000,  lng: 46.1167 },
  'القويعية':          { lat: 24.0622,  lng: 45.2788 },
  'المزاحمية':         { lat: 24.4989,  lng: 46.1028 },
  'شقراء':             { lat: 25.2422,  lng: 45.7255 },
  'الخرج':             { lat: 24.1481,  lng: 47.3028 },
  'العيينة':           { lat: 24.9166,  lng: 46.4183 },
  'ثادق':              { lat: 25.5833,  lng: 45.7167 },
  'الأرطاوية':         { lat: 26.5333,  lng: 45.3333 },
  'حوطة سدير':         { lat: 25.5500,  lng: 45.6167 },
  'مرات':              { lat: 23.9000,  lng: 44.8000 },
  'الجمش':             { lat: 20.9833,  lng: 42.9000 },
  'الجلة':             { lat: 20.9500,  lng: 40.3000 },
};

/* ── Brand Meta ──────────────────────────────────────────── */
const BRAND_META = {
  'صيدلية أوشن':     { color: '#00c896', icon: '⚕' },
  'عناية أوشن':      { color: '#00a8e0', icon: '🌿' },
  'السعودية الرائدة': { color: '#e0a800', icon: '🏥' },
};

/* ── State ───────────────────────────────────────────────── */
let state = {
  branches: [],
  userLat: null,
  userLng: null,
  located: false,
  sortMode: 'default',
  query: '',
  activeBranch: null,
  branchesWithDist: []
};

/* ── DOM ─────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const el = {
  overlay:       $('loadingOverlay'),
  skeleton:      $('skeletonGrid'),
  grid:          $('branchesGrid'),
  empty:         $('emptyState'),
  denied:        $('permissionDenied'),
  statusBar:     $('statusBar'),
  statusInner:   $('statusInner'),
  searchInput:   $('searchInput'),
  clearSearch:   $('clearSearch'),
  clearSearchBtn:$('clearSearchBtn'),
  mapLinkInput:  $('mapLinkInput'),
  clearMapLink:  $('clearMapLink'),
  pasteMapLinkBtn:$('pasteMapLinkBtn'),
  findNearestFromLinkBtn:$('findNearestFromLinkBtn'),
  linkResult:    $('linkResult'),
  locateBtn:     $('locateBtn'),
  heroLocateBtn: $('heroLocateBtn'),
  floatNearest:  $('floatNearest'),
  mbarLocate:    $('mbarLocate'),
  mbarAll:       $('mbarAll'),
  headerStat:    $('branchCount'),
  sectionTitle:  $('sectionTitle'),
  modalOverlay:  $('modalOverlay'),
  modalClose:    $('modalClose'),
  modalCode:     $('modalCode'),
  modalDelivery: $('modalDelivery'),
  modalName:     $('modalName'),
  modalAddress:  $('modalAddress'),
  modalCity:     $('modalCity'),
  modalDist:     $('modalDist'),
  modalCall:     $('modalCall'),
  modalWhatsapp: $('modalWhatsapp'),
  modalMaps:     $('modalMaps'),
  modalCover:    $('modalCover'),
};

/* ── Normalize Sheet Row ─────────────────────────────────── */
function normalizeHeaderKey(key) {
  return String(key || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-\/]+/g, '');
}

function getCell(row, aliases) {
  const wanted = aliases.map(normalizeHeaderKey);
  for (const key of Object.keys(row || {})) {
    if (wanted.includes(normalizeHeaderKey(key))) return row[key];
  }
  return '';
}

function buildCoordinateMapsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lat + ',' + lng)}`;
}

function parseCoordinate(value) {
  if (value === undefined || value === null) return null;

  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const easternDigits = '۰۱۲۳۴۵۶۷۸۹';

  let cleaned = String(value)
    .trim()
    .replace(/[,،]/g, '.')
    .replace(/[٠-٩]/g, d => String(arabicDigits.indexOf(d)))
    .replace(/[۰-۹]/g, d => String(easternDigits.indexOf(d)))
    .replace(/[^0-9.\-]/g, '');

  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}


function normalizeImageUrl(value) {
  let raw = String(value || '').trim();
  if (!raw) return null;

  // Remove accidental wrapping quotes/spaces from Google Sheets cells.
  raw = raw.replace(/^['"“”‘’]+|['"“”‘’]+$/g, '').replace(/\s+/g, '');
  if (!raw) return null;

  // Keep already-usable inline/blob URLs.
  if (/^(data:image\/|blob:)/i.test(raw)) return raw;

  // Add protocol if the sheet value starts with a domain only.
  if (/^\/\//.test(raw)) raw = 'https:' + raw;
  if (!/^https?:\/\//i.test(raw)) return null;

  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();

    // Googleusercontent image links normally work without extensions.
    // If no size directive exists, append =s1000 to request a usable image size.
    if (host.endsWith('googleusercontent.com')) {
      const full = url.toString();
      if (/[=\-]s\d+($|[?&#])/.test(full) || /=w\d+-h\d+/.test(full)) return full;
      return full.replace(/[?#]$/, '') + '=s1000';
    }

    // Google Drive share links -> direct thumbnail image URL.
    if (host === 'drive.google.com') {
      const m = raw.match(/\/file\/d\/([^/]+)/) || raw.match(/[?&]id=([^&]+)/);
      if (m && m[1]) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(m[1])}&sz=w1000`;
    }

    // Dropbox share links -> raw image.
    if (host.endsWith('dropbox.com')) {
      url.searchParams.set('raw', '1');
      url.searchParams.delete('dl');
      return url.toString();
    }

    // Accept any normal URL as an image candidate even if it has no extension.
    return url.toString();
  } catch (_) {
    return null;
  }
}

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function imageFallbackHTML(color, icon) {
  return `<div class="card-cover-placeholder" style="--brand-color:${color}"><div class="cover-icon">${icon}</div></div>`;
}

function normalizeRow(row, index) {
  const city = String(getCell(row, ['Locality', 'City', 'المدينة']) || '').trim();
  const cityCoord = CITY_COORDS[city] || null;
  const phone = String(getCell(row, ['Primary phone', 'Phone', 'Mobile', 'رقم الهاتف']) || '').replace(/\s+/g, '');
  const delivery = String(getCell(row, ['delevery', 'delivery', 'توصيل']) || '').toLowerCase() === 'yes';
  const whatsapp = String(getCell(row, ['whats app link', 'whatsapp', 'whatsapp link', 'واتساب']) || '').replace(/\s+/g, '') || null;
  const rawMaps = String(getCell(row, ['google maps location', 'google maps', 'maps', 'location link', 'رابط اللوكيشن']) || '').trim() || null;
  const name = String(getCell(row, ['Business name', 'Name', 'اسم الفرع']) || '').trim();
  const coverPhoto = normalizeImageUrl(getCell(row, ['cover photo', 'cover', 'photo', 'image', 'branch photo', 'صورة الفرع', 'صورة']));

  const sheetLat = parseCoordinate(getCell(row, ['Latitude', 'Lat', 'خط العرض']));
  const sheetLng = parseCoordinate(getCell(row, ['Longitude', 'Lng', 'Long', 'خط الطول']));
  const hasValidLatLng =
    sheetLat !== null && sheetLng !== null &&
    sheetLat >= -90 && sheetLat <= 90 &&
    sheetLng >= -180 && sheetLng <= 180;

  // IMPORTANT: city coordinates are NOT branch coordinates.
  // We keep branches without exact coordinates visible, but we do NOT use city fallback
  // in nearest-branch calculations because it creates fake distances like 5.4 km for many branches.
  const finalLat = hasValidLatLng ? sheetLat : null;
  const finalLng = hasValidLatLng ? sheetLng : null;
  // IMPORTANT: coordinates are used ONLY for distance / nearest sorting.
  // The Maps/Directions button should keep the original Google Maps place link
  // so Google shows the branch/place card and photo instead of raw coordinates.
  const maps = rawMaps || (hasValidLatLng ? buildCoordinateMapsUrl(finalLat, finalLng) : null);

  return {
    _id:          index,
    store_code:   String(getCell(row, ['Store code', 'Store Code', 'code', 'كود الفرع']) || '').trim(),
    business_name: name,
    address1:     String(getCell(row, ['Address line 1', 'Address1', 'العنوان 1']) || '').trim(),
    address2:     String(getCell(row, ['Address line 2', 'Address2', 'العنوان 2']) || '').trim(),
    city,
    country:      String(getCell(row, ['Country / Region', 'Country', 'الدولة']) || 'Saudi Arabia').trim(),
    phone,
    delivery,
    whatsapp,
    maps,
    lat:          finalLat,
    lng:          finalLng,
    coord_source: hasValidLatLng ? 'sheet' : 'missing',
    cover_photo:   coverPhoto,
    dist:         null,
  };
}

/* ── Fetch Sheet ─────────────────────────────────────────── */
async function fetchBranches() {
  const res = await fetch(SHEET_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.map((row, i) => normalizeRow(row, i));
}

/* ── Haversine ───────────────────────────────────────────── */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function formatDist(km) {
  return km < 1 ? `${Math.round(km*1000)} م` : `${km.toFixed(1)} كم`;
}

/* ── Paste Google Maps Link / Coordinates Locator ────────── */
function isValidLatLng(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function tryDecode(value) {
  let out = String(value || '').trim();
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(out);
      if (decoded === out) break;
      out = decoded;
    } catch (_) { break; }
  }
  return out;
}

function extractCoordsFromText(input) {
  const raw = tryDecode(input)
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/،/g, ',');

  if (!raw) return null;

  const patterns = [
    /@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)(?:,|z|\/|$)/i,
    /!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/i,
    /[?&](?:q|query|ll|center|destination|daddr)=(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/i,
    /(?:maps\/search\/|maps\/dir\/)(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/i,
    /(^|[^\d.-])(-?\d{1,2}\.\d{3,})\s*[, ]\s*(-?\d{1,3}\.\d{3,})(?![\d.])/i,
  ];

  for (const re of patterns) {
    const m = raw.match(re);
    if (!m) continue;
    const lat = Number(m.length === 3 ? m[1] : m[2]);
    const lng = Number(m.length === 3 ? m[2] : m[3]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  return null;
}

function getNearestBranch() {
  return [...state.branchesWithDist]
    .filter(b => b.dist !== null)
    .sort((a, b) => a.dist - b.dist)[0] || null;
}

function showLinkResult(html) {
  if (!el.linkResult) return;
  el.linkResult.hidden = false;
  el.linkResult.innerHTML = html;
}

function applyExternalLocation(lat, lng, sourceLabel = 'الرابط') {
  state.userLat = lat;
  state.userLng = lng;
  state.located = true;
  state.sortMode = 'distance';
  computeDistances();
  updateChips();
  render();

  const nearest = getNearestBranch();
  if (!nearest) {
    showLinkResult('<span class="warn">⚠️ لا توجد فروع لديها إحداثيات دقيقة في الشيت لحساب الأقرب.</span>');
    showStatus('⚠️ لا توجد إحداثيات فروع كافية لحساب الأقرب');
    return;
  }

  const mapsUrl = nearest.maps || buildCoordinateMapsUrl(nearest.lat, nearest.lng);
  const addr = [nearest.address2, nearest.address1, nearest.city].filter(Boolean).join(' — ');
  showLinkResult(`
    ✅ أقرب فرع من ${sourceLabel}:
    <strong>${escapeAttr(nearest.store_code)} — ${escapeAttr(nearest.business_name)}</strong><br>
    ${escapeAttr(addr)}<br>
    المسافة التقريبية: <strong>${formatDist(nearest.dist)}</strong>
    ${mapsUrl ? ` · <a href="${escapeAttr(mapsUrl)}" target="_blank" rel="noopener">فتح الفرع على الخريطة</a>` : ''}
  `);
  showStatus(`✅ أقرب فرع للرابط: ${nearest.store_code} — ${formatDist(nearest.dist)}`);
  scrollToBranches();
}

function findNearestFromMapLink() {
  const value = el.mapLinkInput ? el.mapLinkInput.value.trim() : '';
  if (!value) {
    showLinkResult('<span class="warn">⚠️ الصق رابط Google Maps أو الإحداثيات أولاً.</span>');
    return;
  }

  const coords = extractCoordsFromText(value);
  if (coords) {
    applyExternalLocation(coords.lat, coords.lng, 'رابط الموقع');
    return;
  }

  const looksShort = /maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs/i.test(value);
  if (looksShort) {
    showLinkResult(`
      <span class="warn">⚠️ الرابط المختصر لا يظهر الإحداثيات داخل الصفحة.</span><br>
      الحل الأسرع: افتح الرابط في المتصفح، وبعد ما يفتح Google Maps انسخ الرابط الطويل من شريط العنوان، أو الصق الإحداثيات مباشرة بالشكل: <strong>24.7136,46.6753</strong>.
    `);
  } else {
    showLinkResult(`
      <span class="warn">⚠️ لم أستطع استخراج الإحداثيات من الرابط.</span><br>
      الروابط المدعومة: رابط فيه <strong>@lat,lng</strong> أو <strong>!3d...!4d...</strong> أو إحداثيات مباشرة مثل <strong>24.7136,46.6753</strong>.
    `);
  }
}

async function pasteMapLinkFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (el.mapLinkInput) {
      el.mapLinkInput.value = text || '';
      el.clearMapLink.hidden = !el.mapLinkInput.value.trim();
    }
    if (text) findNearestFromMapLink();
  } catch (_) {
    showLinkResult('<span class="warn">⚠️ المتصفح منع القراءة من الحافظة. الصق الرابط يدويًا داخل الخانة.</span>');
  }
}

/* ── Compute Distances ───────────────────────────────────── */
function computeDistances() {
  state.branchesWithDist = state.branches.map(b => ({
    ...b,
    dist: (state.userLat !== null && b.coord_source === 'sheet' && Number.isFinite(b.lat) && Number.isFinite(b.lng))
      ? haversine(state.userLat, state.userLng, b.lat, b.lng)
      : null
  }));
}

/* ── Filter + Sort ───────────────────────────────────────── */
function getFiltered() {
  let list = [...state.branchesWithDist];
  if (state.query.trim()) {
    const q = state.query.trim().toLowerCase();
    list = list.filter(b =>
      b.address1.toLowerCase().includes(q) ||
      b.address2.toLowerCase().includes(q) ||
      b.city.toLowerCase().includes(q) ||
      b.business_name.toLowerCase().includes(q) ||
      b.store_code.toLowerCase().includes(q)
    );
  }
  if (state.sortMode === 'distance' && state.located)
    list.sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));
  else if (state.sortMode === 'delivery')
    list.sort((a, b) => Number(b.delivery) - Number(a.delivery));
  return list;
}

/* ── Render ──────────────────────────────────────────────── */
function render() {
  const list = getFiltered();
  el.skeleton.style.display = 'none';
  el.grid.innerHTML = '';

  if (!list.length) {
    el.grid.style.display = 'none';
    el.empty.hidden = false;
    el.denied.hidden = true;
    el.sectionTitle.textContent = 'لا توجد نتائج';
    return;
  }

  el.grid.style.display = '';
  el.empty.hidden = true;
  el.denied.hidden = true;

  let nearestId = null;
  if (state.located) {
    const s = [...list].filter(b => b.dist !== null).sort((a,b) => a.dist - b.dist);
    if (s.length) nearestId = s[0]._id;
  }

  list.forEach(branch => {
    el.grid.appendChild(createCard(branch, state.located && branch._id === nearestId));
  });

  el.sectionTitle.textContent = state.query
    ? `نتائج البحث (${list.length})`
    : `جميع الفروع (${list.length})`;
  el.headerStat.textContent = state.branches.length;
}

/* ── Brand helper ────────────────────────────────────────── */
function getBrand(name) {
  return BRAND_META[name] || { color: '#00c896', icon: '⚕' };
}

/* ── Create Card ─────────────────────────────────────────── */
function createCard(branch, isNearest) {
  const card = document.createElement('article');
  card.className = `branch-card${isNearest ? ' nearest' : ''}`;
  card.setAttribute('role', 'listitem');
  card.setAttribute('tabindex', '0');

  const { color, icon } = getBrand(branch.business_name);
  const addrText = [branch.address2, branch.address1].filter(Boolean).join(' — ');
  const distHTML = branch.dist !== null
    ? `<div class="distance-badge">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
         ${formatDist(branch.dist)} منك
       </div>` : '';

  const dis = (ok) => ok ? '' : 'style="opacity:0.35;pointer-events:none"';
  const coverHTML = branch.cover_photo
    ? `<div class="cover-with-image"><img class="card-cover" src="${escapeAttr(branch.cover_photo)}" alt="${escapeAttr(branch.business_name || 'Branch photo')}" loading="lazy" referrerpolicy="no-referrer" onerror="this.classList.add('is-hidden')">${imageFallbackHTML(color, icon)}</div>`
    : imageFallbackHTML(color, icon);

  card.innerHTML = `
    ${coverHTML}
    <div class="card-body">
      <div class="card-meta">
        <span class="store-code">${branch.store_code}</span>
        <span class="delivery-badge ${branch.delivery ? 'yes':'no'}">
          ${branch.delivery ? '🚚 توصيل' : '🚫 بدون توصيل'}
        </span>
      </div>
      <h3 class="card-name">${branch.business_name}</h3>
      ${addrText ? `<p class="card-area">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        ${addrText}</p>` : ''}
      <p class="card-city">${branch.city}</p>
      ${distHTML}
      ${branch.coord_source === 'sheet' ? '<p class="card-city" style="font-size:11px;opacity:.7">📍 إحداثيات دقيقة من الشيت</p>' : '<p class="card-city" style="font-size:11px;opacity:.55">⚠️ لا توجد إحداثيات دقيقة</p>'}
      <div class="card-actions">
        <a href="tel:${branch.phone}" class="card-btn call" onclick="event.stopPropagation()" ${dis(branch.phone)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.77 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          اتصال
        </a>
        <a href="${branch.whatsapp||'#'}" target="_blank" rel="noopener" class="card-btn wa" onclick="event.stopPropagation()" ${dis(branch.whatsapp)}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          واتساب
        </a>
        <a href="${branch.maps||'#'}" target="_blank" rel="noopener" class="card-btn maps" onclick="event.stopPropagation()" ${dis(branch.maps)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          خرائط
        </a>
      </div>
    </div>`;

  card.addEventListener('click', () => openModal(branch));
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openModal(branch); });
  return card;
}

/* ── Modal ───────────────────────────────────────────────── */
function openModal(branch) {
  state.activeBranch = branch;
  const { icon } = getBrand(branch.business_name);

  if (branch.cover_photo) {
    el.modalCover.innerHTML = `<img src="${escapeAttr(branch.cover_photo)}" alt="${escapeAttr(branch.business_name || 'Branch photo')}" referrerpolicy="no-referrer" onerror="this.classList.add('is-hidden')"><span class="modal-cover-icon">${icon}</span>`;
    el.modalCover.style.opacity = '1';
  } else {
    el.modalCover.innerHTML = '';
    el.modalCover.textContent = icon;
    el.modalCover.style.opacity = '0.4';
  }
  el.modalCode.textContent = branch.store_code;
  el.modalDelivery.textContent = branch.delivery ? '🚚 توصيل متاح' : '🚫 بدون توصيل';
  el.modalDelivery.className = `modal-delivery-badge ${branch.delivery ? 'yes':'no'}`;
  el.modalName.textContent = branch.business_name;
  el.modalAddress.textContent = [branch.address1, branch.address2].filter(Boolean).join(' — ') || branch.city;
  el.modalCity.querySelector('span').textContent = `${branch.city} · ${branch.country}`;

  const distEl = el.modalDist.querySelector('span');
  if (branch.dist !== null) {
    distEl.textContent = `على بُعد تقريبي ${formatDist(branch.dist)} من موقعك`;
    el.modalDist.style.display = '';
  } else {
    el.modalDist.style.display = 'none';
  }

  const setBtn = (btn, href, ok) => {
    btn.href = href || '#';
    btn.style.opacity = ok ? '' : '0.35';
    btn.style.pointerEvents = ok ? '' : 'none';
  };
  setBtn(el.modalCall,      `tel:${branch.phone}`, !!branch.phone);
  setBtn(el.modalWhatsapp,  branch.whatsapp, !!branch.whatsapp);
  setBtn(el.modalMaps,      branch.maps, !!branch.maps);

  el.modalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  el.modalOverlay.hidden = true;
  document.body.style.overflow = '';
}

el.modalClose.addEventListener('click', closeModal);
el.modalOverlay.addEventListener('click', e => { if (e.target === el.modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !el.modalOverlay.hidden) closeModal(); });

/* ── Geolocation ─────────────────────────────────────────── */
function locate() {
  if (!navigator.geolocation) { showStatus('⚠️ المتصفح لا يدعم تحديد الموقع'); return; }
  setLocateLoading(true);
  showStatus('📡 جارٍ تحديد موقعك...');

  navigator.geolocation.getCurrentPosition(
    pos => {
      state.userLat = pos.coords.latitude;
      state.userLng = pos.coords.longitude;
      state.located = true;
      setLocateLoading(false);
      computeDistances();
      if (state.sortMode === 'default') state.sortMode = 'distance';
      updateChips();
      render();
      showStatus('✅ تم تحديد موقعك — الفروع مرتبة حسب المسافة');
      scrollToBranches();
    },
    err => {
      setLocateLoading(false);
      if (err.code === err.PERMISSION_DENIED) {
        showStatus('❌ تم رفض إذن الموقع');
        el.denied.hidden = false;
        el.empty.hidden = true;
        el.grid.style.display = 'none';
      } else {
        showStatus('⚠️ تعذّر الحصول على الموقع');
        computeDistances(); render();
      }
    },
    { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
  );
}

function setLocateLoading(on) { el.locateBtn.classList.toggle('loading', on); }
function showStatus(msg) { el.statusBar.hidden = false; el.statusInner.textContent = msg; }
function scrollToBranches() {
  document.querySelector('.branches-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Buttons ─────────────────────────────────────────────── */
[el.locateBtn, el.heroLocateBtn, el.floatNearest, el.mbarLocate].forEach(b => b && b.addEventListener('click', locate));
el.mbarAll && el.mbarAll.addEventListener('click', () => {
  state.query = ''; el.searchInput.value = ''; el.clearSearch.hidden = true;
  computeDistances(); render(); scrollToBranches();
});

/* ── Search ──────────────────────────────────────────────── */
let searchTimer;
el.searchInput.addEventListener('input', () => {
  state.query = el.searchInput.value;
  el.clearSearch.hidden = !state.query;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(render, 220);
});
el.clearSearch.addEventListener('click', () => {
  state.query = ''; el.searchInput.value = ''; el.clearSearch.hidden = true;
  el.searchInput.focus(); render();
});
el.clearSearchBtn && el.clearSearchBtn.addEventListener('click', () => {
  state.query = ''; el.searchInput.value = ''; el.clearSearch.hidden = true; render();
});

/* ── Map Link Locator ────────────────────────────────────── */
el.findNearestFromLinkBtn && el.findNearestFromLinkBtn.addEventListener('click', findNearestFromMapLink);
el.pasteMapLinkBtn && el.pasteMapLinkBtn.addEventListener('click', pasteMapLinkFromClipboard);
el.mapLinkInput && el.mapLinkInput.addEventListener('input', () => {
  el.clearMapLink.hidden = !el.mapLinkInput.value.trim();
});
el.mapLinkInput && el.mapLinkInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') findNearestFromMapLink();
});
el.clearMapLink && el.clearMapLink.addEventListener('click', () => {
  el.mapLinkInput.value = '';
  el.clearMapLink.hidden = true;
  el.linkResult.hidden = true;
  el.mapLinkInput.focus();
});

/* ── Sort Chips ──────────────────────────────────────────── */
document.querySelectorAll('.chip').forEach(chip =>
  chip.addEventListener('click', () => { state.sortMode = chip.dataset.sort; updateChips(); render(); })
);
function updateChips() {
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.sort === state.sortMode));
}

/* ── Retry ───────────────────────────────────────────────── */
$('retryBtn') && $('retryBtn').addEventListener('click', () => {
  el.denied.hidden = true; el.grid.style.display = ''; locate();
});

/* ── Float button reveal on scroll ──────────────────────── */
window.addEventListener('scroll', () => {
  const show = window.scrollY > document.querySelector('.hero').offsetHeight * 0.4;
  el.floatNearest.style.opacity = show ? '1' : '0';
  el.floatNearest.style.pointerEvents = show ? '' : 'none';
}, { passive: true });

/* ── Scroll Reveal ───────────────────────────────────────── */
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObs.unobserve(e.target); } });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
function observeReveal() {
  document.querySelectorAll('.reveal').forEach(e => revealObs.observe(e));
}

/* ── Particles ───────────────────────────────────────────── */
function initParticles() {
  const canvas = $('particles');
  const ctx = canvas.getContext('2d');
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  const COUNT = Math.min(65, Math.floor(window.innerWidth / 20));
  class P {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.r = Math.random() * 1.4 + 0.3;
      this.vx = (Math.random() - 0.5) * 0.25;
      this.vy = (Math.random() - 0.5) * 0.25;
      this.a = Math.random() * 0.35 + 0.08;
      this.life = Math.random() * 150;
      this.maxLife = Math.random() * 200 + 120;
    }
    update() {
      this.x += this.vx; this.y += this.vy; this.life++;
      if (this.life > this.maxLife || this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
    }
    draw() {
      const a = this.a * Math.sin(this.life / this.maxLife * Math.PI);
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,200,150,${a})`; ctx.fill();
    }
  }
  const particles = Array.from({ length: COUNT }, () => new P());
  (function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    for (let i = 0; i < particles.length; i++)
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 90) {
          ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0,200,150,${0.04*(1-d/90)})`; ctx.lineWidth = 0.5; ctx.stroke();
        }
      }
    requestAnimationFrame(animate);
  })();
}

/* ── Keyboard nav ────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (!document.activeElement.classList.contains('branch-card')) return;
  const dir = ['ArrowDown','ArrowRight'].includes(e.key) ? 'next' : ['ArrowUp','ArrowLeft'].includes(e.key) ? 'prev' : null;
  if (!dir) return;
  const sib = dir === 'next' ? document.activeElement.nextElementSibling : document.activeElement.previousElementSibling;
  if (sib?.classList.contains('branch-card')) sib.focus();
});

/* ── INIT ────────────────────────────────────────────────── */
async function init() {
  el.skeleton.style.display = '';
  el.grid.style.display = 'none';
  el.headerStat.textContent = '…';
  el.floatNearest.style.opacity = '0';
  el.floatNearest.style.transition = 'opacity 0.4s ease';

  try {
    const fetched = await fetchBranches();
    state.branches = fetched;
    computeDistances();

    setTimeout(() => {
      el.overlay.classList.add('hidden');
      render();
      document.querySelector('.map-section').classList.add('reveal');
      document.querySelector('.section-header').classList.add('reveal');
      observeReveal();
      initParticles();
      showStatus(`✅ تم تحميل ${state.branches.length} فرع`);
      setTimeout(() => { el.statusBar.hidden = true; }, 4000);
    }, 1400);

  } catch (err) {
    console.error('Sheet fetch error:', err);
    el.overlay.classList.add('hidden');
    el.skeleton.style.display = 'none';
    el.grid.style.display = 'none';
    el.empty.hidden = false;
    showStatus('⚠️ تعذّر تحميل البيانات من الشيت — تحقق من الاتصال');
    initParticles();
  }
}

document.addEventListener('DOMContentLoaded', init);
