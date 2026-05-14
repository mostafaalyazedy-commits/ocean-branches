/* ============================================================
   OCEAN PHARMACY — Branch Locator · script.js
   v2.1 — Anti-cache · Live Refresh · Column Aliasing · Debug
   ============================================================ */

'use strict';

/* ── Sheet API ───────────────────────────────────────────── */
const SHEET_URL = 'https://opensheet.elk.sh/1grir_i5EwEXcSqES2Ay2IfF0BomtZ12vp-_8ngRMa7E/Sheet1';

/* ── Column Aliases — handles any casing/naming from sheet ── */
// Each key = what we call it internally, values = possible sheet header names
const COL = {
  store_code:   ['Store code', 'store_code', 'StoreCode', 'store code'],
  business_name:['Business name', 'business_name', 'BusinessName', 'name', 'Name'],
  address1:     ['Address line 1', 'address1', 'Address1', 'address line 1'],
  address2:     ['Address line 2', 'address2', 'Address2', 'address line 2'],
  city:         ['Locality', 'city', 'City', 'locality'],
  country:      ['Country / Region', 'country', 'Country', 'region'],
  phone:        ['Primary phone', 'phone', 'Phone', 'primary_phone', 'mobile'],
  delivery:     ['delevery', 'delivery', 'Delivery', 'Delevery', 'has_delivery'],
  whatsapp:     ['whats app link', 'whatsapp', 'WhatsApp', 'whatsapp_link', 'whats_app_link'],
  maps:         ['google maps location', 'maps', 'Maps', 'google_maps_link', 'Google Maps', 'map_link'],
  lat:          ['Latitude', 'latitude', 'lat', 'Lat'],
  lng:          ['Longitude', 'longitude', 'lng', 'Lng', 'long', 'Long'],
};

/* ── City Fallback Coordinates ───────────────────────────── */
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
  'صيدلية أوشن':      { color: '#00c896', icon: '⚕' },
  'عناية أوشن':       { color: '#00a8e0', icon: '🌿' },
  'السعودية الرائدة': { color: '#e0a800', icon: '🏥' },
};

/* ── App State ───────────────────────────────────────────── */
let state = {
  branches:         [],
  branchesWithDist: [],
  userLat:    null,
  userLng:    null,
  located:    false,
  sortMode:   'default',
  query:      '',
  activeBranch: null,
  lastLoaded:   null,   // Date object of last successful fetch
};

/* ── DOM refs ────────────────────────────────────────────── */
const $  = id => document.getElementById(id);
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
  lastUpdated:   $('lastUpdated'),    // injected below if missing
  refreshBtn:    $('refreshBtn'),     // injected below if missing
};

/* ── Inject Refresh Button + Last-Updated bar if not in HTML  */
(function injectRefreshUI() {
  // Last-updated label — goes inside the status bar
  if (!el.lastUpdated) {
    const span = document.createElement('span');
    span.id = 'lastUpdated';
    span.style.cssText = 'margin-right:auto;font-size:0.78rem;opacity:0.7;';
    el.statusInner && el.statusInner.appendChild(span);
    el.lastUpdated = span;
  }

  // Refresh button — inject next to sort chips
  if (!el.refreshBtn) {
    const btn = document.createElement('button');
    btn.id = 'refreshBtn';
    btn.className = 'refresh-btn';
    btn.innerHTML = `
      <svg id="refreshIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="15" height="15">
        <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
      تحديث البيانات`;
    el.refreshBtn = btn;

    // Append to section-header sort-chips row
    const chips = document.querySelector('.sort-chips');
    if (chips) chips.parentElement.appendChild(btn);
  }

  // Inject CSS for the button
  if (!document.getElementById('refreshStyle')) {
    const style = document.createElement('style');
    style.id = 'refreshStyle';
    style.textContent = `
      .refresh-btn {
        display: inline-flex; align-items: center; gap: 7px;
        background: rgba(0,200,150,0.08); border: 1px solid rgba(0,200,150,0.3);
        color: #00c896; padding: 7px 14px; border-radius: 99px;
        font-family: 'IBM Plex Sans Arabic', sans-serif; font-size: 0.8rem; font-weight: 600;
        cursor: pointer; transition: 0.25s ease; white-space: nowrap;
      }
      .refresh-btn:hover { background: rgba(0,200,150,0.18); border-color: #00c896; }
      .refresh-btn:active { transform: scale(0.96); }
      .refresh-btn.spinning svg { animation: spin 0.8s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }
})();

/* ── Column resolver — picks first matching key from a row ── */
function col(row, field) {
  const aliases = COL[field] || [field];
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null) return row[alias];
  }
  return '';
}

/* ── Normalize Sheet Row → Branch Object ─────────────────── */
function normalizeRow(row, index) {
  const city = col(row, 'city').trim();
  const cityCoord = CITY_COORDS[city] || { lat: 24.7136, lng: 46.6753 };

  // Lat / Lng — prefer sheet values, fall back to city center
  const rawLat = parseFloat(col(row, 'lat'));
  const rawLng = parseFloat(col(row, 'lng'));
  const hasCoords = !isNaN(rawLat) && !isNaN(rawLng) && rawLat !== 0 && rawLng !== 0;

  if (!hasCoords && col(row, 'store_code')) {
    console.warn(`[OPH] ⚠️ No coords for ${col(row, 'store_code')} (${city}) — using city center`);
  }

  const lat = hasCoords ? rawLat : cityCoord.lat;
  const lng = hasCoords ? rawLng : cityCoord.lng;
  const coordSource = hasCoords ? 'sheet' : 'city-fallback';

  const phone    = col(row, 'phone').replace(/\s+/g, '');
  const delivery = col(row, 'delivery').toLowerCase() === 'yes';
  const whatsapp = col(row, 'whatsapp').replace(/\s+/g, '') || null;
  const maps     = col(row, 'maps').trim() || null;
  const name     = col(row, 'business_name').trim();

  return {
    _id:           index,
    store_code:    col(row, 'store_code').trim(),
    business_name: name,
    address1:      col(row, 'address1').trim(),
    address2:      col(row, 'address2').trim(),
    city,
    country:       col(row, 'country').trim() || 'Saudi Arabia',
    phone,
    delivery,
    whatsapp,
    maps,
    lat,
    lng,
    coordSource,
    dist: null,
  };
}

/* ── Fetch (no-cache, cache-busted URL) ──────────────────── */
async function fetchBranches() {
  // 1. Nuke any browser storage (just in case someone stored data before)
  try { localStorage.clear(); } catch(_) {}
  try { sessionStorage.clear(); } catch(_) {}

  // 2. Cache-busted URL + fetch with cache: 'no-store'
  const url = `${SHEET_URL}?t=${Date.now()}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  // 3. Debug diagnostics
  const normalized = data.map((row, i) => normalizeRow(row, i));
  const now = new Date();
  console.group('%c[OPH] ✅ Data loaded', 'color:#00c896;font-weight:bold');
  console.log('Branches loaded:', normalized.length);
  console.log('First branch:', normalized[0]);
  console.log('First branch lat:', normalized[0]?.lat, '| lng:', normalized[0]?.lng);
  console.log('Data loaded at:', now.toISOString());
  const fromSheet = normalized.filter(b => b.coordSource === 'sheet').length;
  const fromCity  = normalized.filter(b => b.coordSource === 'city-fallback').length;
  console.log(`Coord sources: ${fromSheet} from sheet, ${fromCity} from city fallback`);
  console.groupEnd();

  return { branches: normalized, loadedAt: now };
}

/* ── Haversine Distance ──────────────────────────────────── */
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

/* ── Compute Distances ───────────────────────────────────── */
function computeDistances() {
  state.branchesWithDist = state.branches.map(b => ({
    ...b,
    dist: state.userLat !== null ? haversine(state.userLat, state.userLng, b.lat, b.lng) : null
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

  // Update last-updated label
  if (state.lastLoaded && el.lastUpdated) {
    el.lastUpdated.textContent =
      `آخر تحديث: ${state.lastLoaded.toLocaleTimeString('ar-SA', { hour:'2-digit', minute:'2-digit' })}`;
  }
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
  const distLabel = branch.dist !== null
    ? `${formatDist(branch.dist)}${branch.coordSource === 'city-fallback' ? ' (تقريبي)' : ''}` : null;

  const distHTML = distLabel
    ? `<div class="distance-badge">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
         ${distLabel} منك
       </div>` : '';

  const dis = ok => ok ? '' : 'style="opacity:0.35;pointer-events:none"';

  card.innerHTML = `
    <div class="card-cover-placeholder" style="--brand-color:${color}">
      <div class="cover-icon">${icon}</div>
    </div>
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

  el.modalCover.textContent = icon;
  el.modalCode.textContent  = branch.store_code;
  el.modalDelivery.textContent  = branch.delivery ? '🚚 توصيل متاح' : '🚫 بدون توصيل';
  el.modalDelivery.className    = `modal-delivery-badge ${branch.delivery ? 'yes':'no'}`;
  el.modalName.textContent      = branch.business_name;
  el.modalAddress.textContent   = [branch.address1, branch.address2].filter(Boolean).join(' — ') || branch.city;
  el.modalCity.querySelector('span').textContent = `${branch.city} · ${branch.country}`;

  const distEl = el.modalDist.querySelector('span');
  if (branch.dist !== null) {
    const tag = branch.coordSource === 'city-fallback' ? ' (مسافة تقريبية)' : '';
    distEl.textContent = `على بُعد ${formatDist(branch.dist)} من موقعك${tag}`;
    el.modalDist.style.display = '';
  } else {
    el.modalDist.style.display = 'none';
  }

  const setBtn = (btn, href, ok) => {
    btn.href = href || '#';
    btn.style.opacity      = ok ? '' : '0.35';
    btn.style.pointerEvents = ok ? '' : 'none';
  };
  setBtn(el.modalCall,     `tel:${branch.phone}`, !!branch.phone);
  setBtn(el.modalWhatsapp, branch.whatsapp, !!branch.whatsapp);
  setBtn(el.modalMaps,     branch.maps, !!branch.maps);

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
        el.empty.hidden  = true;
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

function showStatus(msg, autohide = 0) {
  el.statusBar.hidden = false;
  el.statusInner.childNodes[0]
    ? (el.statusInner.childNodes[0].textContent = msg)
    : el.statusInner.prepend(document.createTextNode(msg));
  if (autohide) setTimeout(() => { el.statusBar.hidden = true; }, autohide);
}

function scrollToBranches() {
  document.querySelector('.branches-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Refresh Data ────────────────────────────────────────── */
async function refreshData() {
  if (!el.refreshBtn) return;
  el.refreshBtn.classList.add('spinning');
  el.refreshBtn.disabled = true;
  showStatus('🔄 جارٍ تحديث البيانات من الشيت...');

  try {
    const { branches, loadedAt } = await fetchBranches();
    state.branches   = branches;
    state.lastLoaded = loadedAt;

    // Re-compute distances with existing user location (if any)
    computeDistances();
    render();

    showStatus(`✅ تم تحديث البيانات — ${branches.length} فرع`, 5000);
  } catch (err) {
    console.error('[OPH] Refresh failed:', err);
    showStatus('⚠️ فشل التحديث — تحقق من الاتصال', 6000);
  } finally {
    el.refreshBtn.classList.remove('spinning');
    el.refreshBtn.disabled = false;
  }
}

/* ── Wire up Refresh button (created or existing) ────────── */
document.addEventListener('click', e => {
  if (e.target.closest('#refreshBtn')) refreshData();
});

/* ── Locate buttons ──────────────────────────────────────── */
[el.locateBtn, el.heroLocateBtn, el.floatNearest, el.mbarLocate]
  .forEach(b => b && b.addEventListener('click', locate));

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

/* ── Sort Chips ──────────────────────────────────────────── */
document.querySelectorAll('.chip').forEach(chip =>
  chip.addEventListener('click', () => { state.sortMode = chip.dataset.sort; updateChips(); render(); })
);
function updateChips() {
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.sort === state.sortMode));
}

/* ── Retry (location denied) ─────────────────────────────── */
$('retryBtn') && $('retryBtn').addEventListener('click', () => {
  el.denied.hidden = true; el.grid.style.display = ''; locate();
});

/* ── Float button on scroll ──────────────────────────────── */
window.addEventListener('scroll', () => {
  const show = window.scrollY > (document.querySelector('.hero')?.offsetHeight || 400) * 0.4;
  el.floatNearest.style.opacity      = show ? '1' : '0';
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
  if (!canvas) return;
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
  const dir = ['ArrowDown','ArrowRight'].includes(e.key) ? 'next'
             : ['ArrowUp','ArrowLeft'].includes(e.key)   ? 'prev' : null;
  if (!dir) return;
  const sib = dir === 'next'
    ? document.activeElement.nextElementSibling
    : document.activeElement.previousElementSibling;
  if (sib?.classList.contains('branch-card')) sib.focus();
});

/* ── INIT ────────────────────────────────────────────────── */
async function init() {
  el.skeleton.style.display = '';
  el.grid.style.display = 'none';
  el.headerStat.textContent = '…';
  if (el.floatNearest) {
    el.floatNearest.style.opacity = '0';
    el.floatNearest.style.transition = 'opacity 0.4s ease';
  }

  try {
    const { branches, loadedAt } = await fetchBranches();
    state.branches   = branches;
    state.lastLoaded = loadedAt;
    computeDistances();

    setTimeout(() => {
      el.overlay?.classList.add('hidden');
      render();
      document.querySelector('.map-section')?.classList.add('reveal');
      document.querySelector('.section-header')?.classList.add('reveal');
      observeReveal();
      initParticles();
      showStatus(`✅ تم تحميل ${branches.length} فرع`, 5000);
    }, 1400);

  } catch (err) {
    console.error('[OPH] Init fetch error:', err);
    el.overlay?.classList.add('hidden');
    el.skeleton.style.display = 'none';
    el.grid.style.display = 'none';
    el.empty.hidden = false;
    showStatus('⚠️ تعذّر تحميل البيانات — تحقق من الاتصال');
    initParticles();
  }
}

document.addEventListener('DOMContentLoaded', init);
