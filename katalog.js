(function() {
  const $ = s => document.querySelector(s);
  const cfg = Object.assign({
    store: 'YEKA',
    logoText: '',
    wa: '6285163233482',
    categories: ['Semua', 'Sepatu', 'Pakaian', 'Tas', 'Aksesoris'],
    sliderIntervalMs: 3800
  }, window.STORE_CFG || {});

  const CART_KEY = 'yeka_catalog_cart_v1';
  const THEME_KEY = 'yeka_catalog_theme_v1';

  const esc = s => String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const rupiah = n => 'Rp' + Number(n || 0).toLocaleString('id-ID');

  function normWA(n) {
    n = String(n).replace(/\D/g, '');
    return n.startsWith('0') ? '62' + n.slice(1) : n;
  }

  function readCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function saveCart(list) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(list)); } catch (e) {}
    updateBagBadge();
  }

  let cart = readCart();
  let allProducts = [];
  let activeCat = 'Semua';
  let activeProduct = null;
  let selectedModalSize = '';
  let sliderTimer = null;

  function updateBagBadge() {
    const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    const badge = $('#bagCount');
    if (badge) badge.textContent = totalQty;
  }

  function fallbackVisual(p) {
    const hex = esc(p.hex || '#141714');
    return `<svg viewBox="0 0 200 130" role="img" aria-label="${esc(p.name)}">
      <ellipse cx="100" cy="112" rx="54" ry="8" fill="rgba(0,0,0,.12)"/>
      <path d="M22 92h156c5 0 8 3 8 7v2c0 6-4 10-10 10H28c-6 0-10-4-10-10v-2c0-4 1-7 4-7z" fill="#ffffff" stroke="#141714" stroke-width="3.5"/>
      <path d="M24 92c0-22 12-38 27-46l25-13c8-4 15-2 19 4 6 9 17 13 30 17 26 7 59 13 61 38z" fill="${hex}" stroke="#141714" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M96 42l11 9M83 48l11 9M70 54l11 9" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity=".85"/>
    </svg>`;
  }

  function visualHTML(p) {
    return p.img
      ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">`
      : fallbackVisual(p);
  }

  function parseEntry(entry, idx) {
    const title = entry.title ? entry.title.$t.trim() : 'Produk ' + (idx + 1);
    const html = entry.content ? entry.content.$t : (entry.summary ? entry.summary.$t : '');

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const imgEl = doc.querySelector('img');
    let img = imgEl ? imgEl.src : '';
    if (!img && entry.media$thumbnail) {
      img = entry.media$thumbnail.url.replace(/\/s[0-9]+(-c)?\//, '/s800/');
    }

    doc.querySelectorAll('br, p, div, li, tr').forEach(el => el.after('\n'));
    const lines = (doc.body.textContent || '').split(/\n+/).map(l => l.trim()).filter(Boolean);

    const meta = {};
    const descLines = [];
    lines.forEach(line => {
      const m = line.match(/^(kategori|category|merk|brand|harga|price|hargacoret|diskon|size|ukuran|warna|color|warnaCount|badge|tag|hex|deskripsi|desc)\s*:\s*(.+)$/i);
      if (m) {
        const key = m[1].toLowerCase().replace(/\s+/g, '');
        meta[key] = m[2].trim();
        if (key === 'deskripsi' || key === 'desc') descLines.push(m[2].trim());
      } else {
        descLines.push(line);
      }
    });

    const labels = (entry.category || []).map(c => c.term);
    const category = meta.kategori || meta.category || labels[0] || 'Produk';
    const price = Number((meta.harga || meta.price || '0').replace(/[^0-9]/g, '')) || 0;
    const strikePrice = Number((meta.hargacoret || meta.diskon || '0').replace(/[^0-9]/g, '')) || 0;

    const rawSizes = meta.size || meta.ukuran || '39, 40, 41, 42';
    const sizes = [...new Set(
      rawSizes.split(/[\s,;/]+/).filter(Boolean).map(v => (isNaN(v) ? v : Number(v)))
    )];

    const rawColors = meta.warna || meta.color || '1 warna';
    const colorList = rawColors.split(/[,;/]+/).map(c => c.trim()).filter(Boolean);
    const colorLabel = colorList.length > 1
      ? `${colorList.length} warna`
      : (colorList[0] || '1 warna');

    let hex = meta.hex || '#141714';
    if (!hex.startsWith('#')) hex = '#' + hex;

    return {
      id: entry.id ? entry.id.$t : 'p-' + idx,
      name: title,
      category,
      brand: meta.merk || meta.brand || category,
      price,
      strikePrice,
      sizes: sizes.length ? sizes : ['All Size'],
      colors: colorList.length ? colorList : ['Standar'],
      colorLabel,
      badge: meta.badge || meta.tag || (labels[1] || ''),
      hex: /^#[0-9A-Fa-f]{3,6}$/.test(hex) ? hex : '#141714',
      img,
      desc: descLines.join(' ')
    };
  }

  // ================= SLIDER OTOMATIS 3 POSTINGAN TERBARU =================
  function renderAutoSlider() {
    const wrap = $('#autoSlider');
    const track = $('#autoSlidesTrack');
    const dotsEl = $('#autoSliderDots');
    if (!wrap || !track) return;

    const latestThree = allProducts.slice(0, 3);
    if (!latestThree.length) {
      wrap.hidden = true;
      return;
    }

    wrap.hidden = false;
    track.innerHTML = latestThree.map(p => `
      <div class="auto-slide" data-open-id="${esc(p.id)}">
        <div class="auto-slide-text">
          <span class="auto-slide-tag">Terbaru · ${esc(p.category)}</span>
          <h2 class="auto-slide-title">${esc(p.name)}</h2>
          <p class="auto-slide-sub">${rupiah(p.price)} · ${esc(p.colorLabel)}</p>
        </div>
        <div class="auto-slide-thumb">${visualHTML(p)}</div>
      </div>
    `).join('');

    track.querySelectorAll('.auto-slide-thumb img').forEach((img, idx) => {
      img.onerror = () => { img.outerHTML = fallbackVisual(latestThree[idx] || {}); };
    });

    if (dotsEl) {
      dotsEl.innerHTML = latestThree.map((_, i) =>
        `<span class="auto-dot${i === 0 ? ' on' : ''}"></span>`
      ).join('');
    }

    track.onclick = e => {
      const slideEl = e.target.closest('.auto-slide');
      if (slideEl && slideEl.dataset.openId) {
        openProductModal(slideEl.dataset.openId);
      }
    };

    if (sliderTimer) clearInterval(sliderTimer);
    if (latestThree.length > 1) {
      let idx = 0;
      const interval = Number(cfg.sliderIntervalMs) || 3800;
      sliderTimer = setInterval(() => {
        idx = (idx + 1) % latestThree.length;
        track.style.transform = `translateX(-${idx * 100}%)`;
        if (dotsEl) {
          dotsEl.querySelectorAll('.auto-dot').forEach((d, i) => d.classList.toggle('on', i === idx));
        }
      }, interval);
    }
  }

  function renderCategories() {
    const bar = $('#categoryBar');
    if (!bar) return;

    const fromPosts = allProducts.map(p => p.category).filter(Boolean);
    const baseCats = cfg.categories && cfg.categories.length ? cfg.categories : ['Semua', ...fromPosts];
    const merged = ['Semua', ...new Set([...baseCats.filter(c => c !== 'Semua'), ...fromPosts])];

    bar.innerHTML = merged.map(cat =>
      `<button type="button" class="cat-pill${cat === activeCat ? ' on' : ''}" data-cat="${esc(cat)}">${esc(cat)}</button>`
    ).join('');

    bar.onclick = e => {
      const btn = e.target.closest('.cat-pill');
      if (!btn) return;
      activeCat = btn.dataset.cat;
      bar.querySelectorAll('.cat-pill').forEach(b => b.classList.toggle('on', b === btn));
      renderGrid();
    };
  }

  function cardHTML(p) {
    return `<article class="p-card" data-id="${esc(p.id)}">
      <div class="p-box" data-open="1">
        ${p.badge ? `<span class="p-tag">${esc(p.badge)}</span>` : ''}
        ${visualHTML(p)}
        <button type="button" class="p-add" data-quick-add="1" aria-label="Tambah ${esc(p.name)} ke keranjang">+</button>
      </div>
      <div class="p-meta">
        <p class="p-sub">${esc(p.category)} · ${esc(p.colorLabel)}</p>
        <h2 class="p-title" data-open="1">${esc(p.name)}</h2>
        <div class="p-price-row">
          <span class="p-price">${rupiah(p.price)}</span>
          ${p.strikePrice > p.price ? `<span class="p-strike">${rupiah(p.strikePrice)}</span>` : ''}
        </div>
      </div>
    </article>`;
  }

  function renderGrid() {
    const q = ($('#searchInput') ? $('#searchInput').value : '').trim().toLowerCase();
    const list = allProducts.filter(p => {
      const matchCat = activeCat === 'Semua' || p.category.toLowerCase() === activeCat.toLowerCase();
      const matchQ = !q || (p.name + ' ' + p.category + ' ' + p.brand + ' ' + p.colors.join(' ')).toLowerCase().includes(q);
      return matchCat && matchQ;
    });

    if ($('#statusLine')) {
      $('#statusLine').textContent = `${list.length} produk${activeCat !== 'Semua' ? ` · ${activeCat}` : ''}`;
    }

    const grid = $('#productGrid');
    if (grid) {
      grid.innerHTML = list.length
        ? list.map(cardHTML).join('')
        : '<p class="empty">Produk tidak ditemukan.</p>';

      grid.querySelectorAll('img').forEach(img => {
        img.onerror = () => {
          const cardEl = img.closest('.p-card');
          const prod = allProducts.find(x => x.id === (cardEl && cardEl.dataset.id));
          img.outerHTML = fallbackVisual(prod || {});
        };
      });
    }
  }

  function addToCart(p, size) {
    const chosenSize = size || (p.sizes && p.sizes[0]) || 'All Size';
    const key = `${p.id}__${chosenSize}`;
    const existing = cart.find(i => i.key === key);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({
        key,
        id: p.id,
        name: p.name,
        price: p.price,
        size: chosenSize,
        color: p.colors[0] || '',
        qty: 1
      });
    }
    saveCart(cart);
  }

  function openProductModal(id) {
    const p = allProducts.find(x => x.id === id);
    const modal = $('#productModal');
    if (!p || !modal) return;

    activeProduct = p;
    selectedModalSize = p.sizes.length === 1 ? String(p.sizes[0]) : '';

    $('#detailTitle').textContent = p.name;
    $('#detailBody').innerHTML = `
      <div class="detail-grid">
        <div class="detail-img">${visualHTML(p)}</div>
        <div class="detail-info">
          <p class="p-sub">${esc(p.category)} · ${esc(p.colors.join(', '))}</p>
          <div class="p-price-row">
            <span class="p-price" style="font-size:1.15rem">${rupiah(p.price)}</span>
            ${p.strikePrice > p.price ? `<span class="p-strike">${rupiah(p.strikePrice)}</span>` : ''}
          </div>
          <span style="font-size:.82rem;font-weight:700;margin-top:4px">Pilih Ukuran / Size:</span>
          <div class="sizes">
            ${p.sizes.map(sz =>
              `<button type="button" class="sz-btn${String(sz) === selectedModalSize ? ' on' : ''}" data-sz="${esc(sz)}">${esc(sz)}</button>`
            ).join('')}
          </div>
          <p class="hint" id="detailHint"></p>
          <button type="button" class="primary-btn" id="detailAddBtn">Tambah ke Keranjang</button>
        </div>
      </div>
      ${p.desc ? `<div class="detail-desc">${esc(p.desc)}</div>` : ''}
    `;

    const dImg = $('#detailBody img');
    if (dImg) {
      dImg.onerror = () => { dImg.outerHTML = fallbackVisual(p); };
    }

    $('#detailBody').querySelectorAll('.sz-btn').forEach(btn => {
      btn.onclick = () => {
        selectedModalSize = btn.dataset.sz;
        $('#detailBody').querySelectorAll('.sz-btn').forEach(b => b.classList.toggle('on', b === btn));
        $('#detailHint').textContent = '';
      };
    });

    $('#detailAddBtn').onclick = () => {
      if (p.sizes.length > 1 && !selectedModalSize) {
        $('#detailHint').textContent = 'Pilih ukuran dulu ya.';
        return;
      }
      addToCart(p, selectedModalSize || p.sizes[0]);
      closeAllModals();
      openCartModal();
    };

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function renderCartModal() {
    const listEl = $('#cartList');
    const totalEl = $('#cartTotal');
    const checkoutBtn = $('#checkoutWaBtn');
    if (!listEl || !totalEl) return;

    if (!cart.length) {
      listEl.innerHTML = '<p class="empty" style="padding:18px 8px">Keranjang masih kosong. Klik tombol <b>+</b> pada produk.</p>';
      totalEl.textContent = rupiah(0);
      if (checkoutBtn) checkoutBtn.disabled = true;
      return;
    }

    if (checkoutBtn) checkoutBtn.disabled = false;
    listEl.innerHTML = cart.map((item, idx) => `
      <div class="cart-item">
        <div class="cart-item-info">
          <strong>${esc(item.name)}</strong>
          <span>Size: ${esc(item.size)} · ${rupiah(item.price)}</span>
        </div>
        <div class="qty-box">
          <button type="button" class="qty-btn" data-act="dec" data-idx="${idx}">-</button>
          <span style="min-width:18px;text-align:center;font-weight:700">${item.qty}</span>
          <button type="button" class="qty-btn" data-act="inc" data-idx="${idx}">+</button>
        </div>
      </div>
    `).join('');

    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    totalEl.textContent = rupiah(total);

    listEl.onclick = e => {
      const btn = e.target.closest('.qty-btn');
      if (!btn) return;
      const idx = Number(btn.dataset.idx);
      const item = cart[idx];
      if (!item) return;
      if (btn.dataset.act === 'inc') item.qty += 1;
      if (btn.dataset.act === 'dec') item.qty -= 1;
      if (item.qty <= 0) cart.splice(idx, 1);
      saveCart(cart);
      renderCartModal();
    };
  }

  function openCartModal() {
    const modal = $('#cartModal');
    if (!modal) return;
    renderCartModal();
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeAllModals() {
    ['#productModal', '#cartModal'].forEach(sel => {
      const el = $(sel);
      if (el) el.hidden = true;
    });
    document.body.style.overflow = '';
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark') document.body.classList.add('dark');
    const btn = $('#themeToggle');
    if (!btn) return;
    const syncIcon = () => {
      btn.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
    };
    syncIcon();
    btn.onclick = () => {
      document.body.classList.toggle('dark');
      localStorage.setItem(THEME_KEY, document.body.classList.contains('dark') ? 'dark' : 'light');
      syncIcon();
    };
  }

  function initHeader() {
    const storeName = cfg.store || 'YEKA';
    if ($('#storeTitle')) $('#storeTitle').textContent = storeName;
    if ($('#footerStore')) $('#footerStore').textContent = storeName;
    if ($('#brandLogo')) {
      $('#brandLogo').textContent = cfg.logoText || storeName.trim().charAt(0).toUpperCase() || 'Y';
    }
    updateBagBadge();

    if ($('#openBagBtn')) $('#openBagBtn').onclick = openCartModal;
    if ($('#closeProductModal')) $('#closeProductModal').onclick = closeAllModals;
    if ($('#closeCartModal')) $('#closeCartModal').onclick = closeAllModals;

    ['#productModal', '#cartModal'].forEach(sel => {
      const m = $(sel);
      if (m) {
        m.onclick = e => {
          if (e.target === m) closeAllModals();
        };
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeAllModals();
    });

    if ($('#searchInput')) {
      $('#searchInput').addEventListener('input', renderGrid);
    }

    const grid = $('#productGrid');
    if (grid) {
      grid.addEventListener('click', e => {
        const cardEl = e.target.closest('.p-card');
        if (!cardEl) return;
        const p = allProducts.find(x => x.id === cardEl.dataset.id);
        if (!p) return;

        if (e.target.closest('[data-quick-add]')) {
          e.stopPropagation();
          addToCart(p);
          return;
        }

        if (e.target.closest('[data-open]')) {
          openProductModal(p.id);
        }
      });
    }

    if ($('#checkoutWaBtn')) {
      $('#checkoutWaBtn').onclick = () => {
        if (!cart.length) return;
        const lines = cart.map((item, i) =>
          `${i + 1}. ${item.name} (Size: ${item.size}) x${item.qty} = ${rupiah(item.price * item.qty)}`
        );
        const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const text = [
          `Halo ${storeName}, saya mau pesan:`,
          ...lines,
          `Total: ${rupiah(total)}`
        ].join('\n');
        window.open(`https://wa.me/${normWA(cfg.wa)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      };
    }
  }

  async function loadFeed() {
    if ($('#statusLine')) $('#statusLine').textContent = 'Memuat produk...';
    try {
      const res = await fetch('/feeds/posts/default?alt=json&max-results=500');
      const data = await res.json();
      const entries = (data.feed && data.feed.entry) ? data.feed.entry : [];
      allProducts = entries.map(parseEntry);
    } catch (err) {
      console.error('Feed error:', err);
      allProducts = [];
    }
    renderAutoSlider();
    renderCategories();
    renderGrid();
  }

  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initHeader();
    loadFeed();
  });
})();
