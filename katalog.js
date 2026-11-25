(function() {
  const $ = s => document.querySelector(s);
  const cfg = Object.assign({
    store: 'Katalog Sepatu',
    wa: '6281234567890',
    tagline: 'Pilih merk, size, dan warna. Tekan ORDER untuk memesan lewat WhatsApp.',
    slides: []
  }, window.STORE_CFG || {});

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rupiah = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

  function normWA(n) {
    n = String(n).replace(/\D/g, '');
    return n.startsWith('0') ? '62' + n.slice(1) : n;
  }

  function shoeSVG(hex) {
    return `<svg viewBox="0 0 200 120" role="img" aria-label="Sepatu">
      <path d="M14 94h176c5 0 8 3 8 8v2c0 6-4 10-10 10H20c-6 0-10-4-10-10v-2c0-5 1-8 4-8z" fill="#fff" stroke="#101820" stroke-width="3" stroke-linejoin="round"/>
      <path d="M16 94c0-24 12-42 28-50l26-14c8-4 16-2 20 4 6 10 18 14 32 18 28 8 64 14 66 42z" fill="${esc(hex)}" stroke="#101820" stroke-width="3" stroke-linejoin="round"/>
      <path d="M94 40l12 10M80 46l12 10M66 52l12 10" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".85"/>
    </svg>`;
  }

  function productVisual(p) {
    return p.img
      ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" data-hex="${esc(p.hex)}" loading="lazy">`
      : shoeSVG(p.hex);
  }

  // ================= SLIDER BANNER =================
  function initSlider(products) {
    const wrap = $('#sliderWrap');
    const track = $('#slidesTrack');
    const dotsBox = $('#sliderDots');
    if (!wrap || !track) return;

    // Gunakan slides dari STORE_CFG, jika kosong ambil otomatis dari 3-5 produk berfoto
    let slideItems = Array.isArray(cfg.slides) && cfg.slides.length ? cfg.slides.slice(0, 5) : [];
    if (!slideItems.length && products.length) {
      slideItems = products.slice(0, 5).map(p => ({
        badge: p.brand,
        title: p.name,
        subtitle: `${p.color} — ${rupiah(p.price)}`,
        img: p.img || '',
        hex: p.hex,
        productId: p.id
      }));
    }

    if (!slideItems.length) {
      wrap.hidden = true;
      return;
    }

    wrap.hidden = false;
    track.innerHTML = slideItems.map((sl, i) => {
      const bgStyle = sl.img
        ? `background-image:url('${esc(sl.img)}')`
        : `background-color:${esc(sl.hex || '#1f4fe0')}`;
      const href = sl.link ? `href="${esc(sl.link)}"` : 'href="javascript:void(0)"';
      const pidAttr = sl.productId ? `data-open-id="${esc(sl.productId)}"` : '';
      return `<a class="slide" ${href} ${pidAttr} style="${bgStyle}">
        <div class="slide-info">
          ${sl.badge ? `<span class="slide-badge">${esc(sl.badge)}</span>` : ''}
          <h2>${esc(sl.title || '')}</h2>
          ${sl.subtitle ? `<p>${esc(sl.subtitle)}</p>` : ''}
        </div>
      </a>`;
    }).join('');

    if (dotsBox) {
      dotsBox.innerHTML = slideItems.map((_, i) =>
        `<button type="button" class="s-dot${i === 0 ? ' on' : ''}" data-idx="${i}" aria-label="Slide ${i + 1}"></button>`
      ).join('');
    }

    let cur = 0;
    const total = slideItems.length;
    function go(idx) {
      cur = (idx + total) % total;
      track.style.transform = `translateX(-${cur * 100}%)`;
      if (dotsBox) {
        dotsBox.querySelectorAll('.s-dot').forEach((d, i) => d.classList.toggle('on', i === cur));
      }
    }

    const prevBtn = $('#sliderPrev');
    const nextBtn = $('#sliderNext');
    if (prevBtn) prevBtn.onclick = () => { go(cur - 1); resetTimer(); };
    if (nextBtn) nextBtn.onclick = () => { go(cur + 1); resetTimer(); };
    if (dotsBox) {
      dotsBox.onclick = e => {
        const dot = e.target.closest('.s-dot');
        if (dot) { go(Number(dot.dataset.idx)); resetTimer(); }
      };
    }

    track.onclick = e => {
      const sl = e.target.closest('.slide');
      if (sl && sl.dataset.openId) {
        e.preventDefault();
        openModal(sl.dataset.openId);
      }
    };

    let timer = setInterval(() => go(cur + 1), 4500);
    function resetTimer() {
      clearInterval(timer);
      timer = setInterval(() => go(cur + 1), 4500);
    }
  }

  // ================= PARSER POSTINGAN BLOGSPOT =================
  function parseBloggerEntry(entry, idx) {
    const title = entry.title ? entry.title.$t.trim() : 'Produk ' + (idx + 1);
    const html = entry.content ? entry.content.$t : (entry.summary ? entry.summary.$t : '');
    const linkObj = (entry.link || []).find(l => l.rel === 'alternate');
    const url = linkObj ? linkObj.href : '#';

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const imgEl = doc.querySelector('img');
    let img = imgEl ? imgEl.src : '';
    if (!img && entry.media$thumbnail) {
      img = entry.media$thumbnail.url.replace(/\/s[0-9]+(-c)?\//, '/s800/');
    }

    doc.querySelectorAll('br, p, div, li, tr').forEach(el => el.after('\n'));
    const text = doc.body.textContent || '';
    const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);

    const meta = {};
    const descLines = [];
    lines.forEach(line => {
      const m = line.match(/^(merk|brand|harga|price|size|ukuran|warna|color|hex|kode\s*warna|deskripsi|desc)\s*:\s*(.+)$/i);
      if (m) {
        const key = m[1].toLowerCase().replace(/\s+/g, '');
        meta[key] = m[2].trim();
        if (key === 'deskripsi' || key === 'desc') descLines.push(m[2].trim());
      } else {
        descLines.push(line);
      }
    });

    const labels = (entry.category || []).map(c => c.term);
    const brand = meta.merk || meta.brand || labels[0] || 'Umum';
    const rawPrice = (meta.harga || meta.price || '0').replace(/[^0-9]/g, '');
    const price = Number(rawPrice) || 0;
    const rawSizes = meta.size || meta.ukuran || '39, 40, 41, 42';
    const sizes = [...new Set(
      rawSizes.split(/[\s,;/]+/).filter(Boolean).map(v => (isNaN(v) ? v : Number(v)))
    )].sort((a, b) => (a > b ? 1 : -1));
    const color = meta.warna || meta.color || 'Standar';
    let hex = meta.hex || meta.kodewarna || '#1c1c1c';
    if (!hex.startsWith('#')) hex = '#' + hex;

    return {
      id: entry.id ? entry.id.$t : 'p' + idx,
      name: title,
      brand,
      sizes: sizes.length ? sizes : [40],
      color,
      hex: /^#[0-9A-Fa-f]{3,6}$/.test(hex) ? hex : '#1c1c1c',
      price,
      img,
      url,
      desc: descLines.join(' ')
    };
  }

  let allProducts = [];

  const uniq = arr => [...new Set(arr)];
  function fillSelect(sel, label, vals) {
    if (!sel) return;
    sel.innerHTML = `<option value="">${label}</option>` + vals.map(v => `<option>${esc(v)}</option>`).join('');
  }

  function orderWhatsApp(p, selectedSize) {
    const msg = [
      `Halo ${cfg.store}, saya mau order:`,
      `Produk: ${p.name}`,
      `Merk: ${p.brand}`,
      `Size: ${selectedSize}`,
      `Warna: ${p.color}`,
      `Harga: ${rupiah(p.price)}`,
      '',
      'Apakah masih tersedia?'
    ].join('\n');
    window.open(`https://wa.me/${normWA(cfg.wa)}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  }

  // ================= POPUP DETAIL PRODUK =================
  function openModal(productId) {
    const p = allProducts.find(x => x.id === productId);
    const modal = $('#productModal');
    const body = $('#modalBody');
    if (!p || !modal || !body) return;

    const preSize = p.sizes.length === 1 ? String(p.sizes[0]) : '';
    body.innerHTML = `
      <div class="modal-visual" style="--c:${esc(p.hex)}">${productVisual(p)}</div>
      <div class="modal-detail" style="--c:${esc(p.hex)}">
        <p class="brand">${esc(p.brand)}</p>
        <h2>${esc(p.name)}</h2>
        <p class="color"><i class="dot"></i>${esc(p.color)}</p>
        <p class="modal-price">${rupiah(p.price)}</p>
        <div class="sizes" role="group" aria-label="Pilih size">
          ${p.sizes.map(z => `<button type="button" class="chip${String(z) === preSize ? ' on' : ''}" data-size="${esc(z)}" aria-pressed="${String(z) === preSize}">${esc(z)}</button>`).join('')}
        </div>
        <p class="hint" id="modalHint" aria-live="polite"></p>
        <div class="buy" style="margin-top:8px">
          <button type="button" class="order" id="modalOrderBtn" style="width:100%">ORDER VIA WHATSAPP</button>
        </div>
        ${p.desc ? `<div class="modal-desc"><p>${esc(p.desc)}</p></div>` : ''}
      </div>
    `;

    // Handle gambar gagal dimuat di dalam modal
    const modalImg = body.querySelector('img');
    if (modalImg) {
      modalImg.onerror = () => { modalImg.outerHTML = shoeSVG(p.hex); };
    }

    // Pilih size di modal
    body.querySelectorAll('.chip').forEach(chip => {
      chip.onclick = () => {
        body.querySelectorAll('.chip').forEach(c => {
          const on = c === chip;
          c.classList.toggle('on', on);
          c.setAttribute('aria-pressed', on);
        });
        $('#modalHint').textContent = '';
      };
    });

    // Tombol order di modal
    $('#modalOrderBtn').onclick = () => {
      const on = body.querySelector('.chip.on');
      if (!on) {
        $('#modalHint').textContent = 'Pilih size dulu sebelum order.';
        return;
      }
      orderWhatsApp(p, on.dataset.size);
    };

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal = $('#productModal');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
  }

  // ================= RENDER KATALOG 2 KOLOM =================
  function card(p) {
    const fSizeVal = $('#fSize') ? $('#fSize').value : '';
    const pre = p.sizes.length === 1 ? String(p.sizes[0]) : fSizeVal;
    return `<article class="card" data-id="${esc(p.id)}" style="--c:${esc(p.hex)}">
      <div class="visual" data-open="1" title="Klik untuk detail ${esc(p.name)}">${productVisual(p)}</div>
      <div class="info">
        <p class="brand">${esc(p.brand)}</p>
        <h2><a href="javascript:void(0)" data-open="1">${esc(p.name)}</a></h2>
        <p class="color"><i class="dot"></i>${esc(p.color)}</p>
        <div class="sizes" role="group" aria-label="Pilih size">
          ${p.sizes.map(z => `<button type="button" class="chip${String(z) === pre ? ' on' : ''}" data-size="${esc(z)}" aria-pressed="${String(z) === pre}">${esc(z)}</button>`).join('')}
        </div>
        <p class="hint" aria-live="polite"></p>
        <div class="buy">
          <strong>${rupiah(p.price)}</strong>
          <button type="button" class="order">ORDER</button>
        </div>
      </div>
    </article>`;
  }

  function render() {
    const q = ($('#q') ? $('#q').value : '').trim().toLowerCase();
    const b = $('#fBrand') ? $('#fBrand').value : '';
    const s = $('#fSize') ? $('#fSize').value : '';
    const c = $('#fColor') ? $('#fColor').value : '';

    const list = allProducts.filter(p =>
      (!q || (p.name + ' ' + p.brand + ' ' + p.color).toLowerCase().includes(q)) &&
      (!b || p.brand === b) &&
      (!s || p.sizes.map(String).includes(s)) &&
      (!c || p.color === c)
    );

    if ($('#count')) $('#count').textContent = list.length + ' produk';
    if ($('#grid')) {
      $('#grid').innerHTML = list.length
        ? list.map(card).join('')
        : '<p class="empty">Tidak ada sepatu yang cocok. Ubah atau reset filter.</p>';
    }
  }

  function setupUI() {
    // Pastikan judul & footer tampil bersih (tidak menimpa jika sudah dirender Blogger)
    const storeEl = $('#storeName');
    if (storeEl && (!storeEl.textContent.trim() || storeEl.textContent.includes('data:blog'))) {
      storeEl.textContent = cfg.store;
    }
    const footEl = $('#footerStore');
    if (footEl && (!footEl.textContent.trim() || footEl.textContent.includes('data:blog'))) {
      footEl.textContent = cfg.store;
    }
    if ($('#storeTagline') && cfg.tagline) $('#storeTagline').textContent = cfg.tagline;

    initSlider(allProducts);

    fillSelect($('#fBrand'), 'Semua merk', uniq(allProducts.map(p => p.brand)).sort());
    fillSelect($('#fSize'), 'Semua size', uniq(allProducts.flatMap(p => p.sizes)).sort((a, b) => a - b));
    fillSelect($('#fColor'), 'Semua warna', uniq(allProducts.map(p => p.color)).sort());

    const filters = $('#filters');
    if (filters) {
      filters.addEventListener('input', render);
      filters.addEventListener('change', render);
      filters.addEventListener('reset', () => setTimeout(render));
    }

    const grid = $('#grid');
    if (grid) {
      grid.addEventListener('click', e => {
        const cardEl = e.target.closest('.card');
        if (!cardEl) return;

        // Klik gambar atau judul produk -> buka popup
        if (e.target.closest('[data-open]')) {
          e.preventDefault();
          openModal(cardEl.dataset.id);
          return;
        }

        // Klik pilih size
        const chip = e.target.closest('.chip');
        if (chip) {
          cardEl.querySelectorAll('.chip').forEach(c => {
            const on = c === chip;
            c.classList.toggle('on', on);
            c.setAttribute('aria-pressed', on);
          });
          cardEl.querySelector('.hint').textContent = '';
          return;
        }

        // Klik tombol ORDER
        if (e.target.closest('.order')) {
          const p = allProducts.find(x => x.id === cardEl.dataset.id);
          const on = cardEl.querySelector('.chip.on');
          if (!p) return;
          if (!on) {
            cardEl.querySelector('.hint').textContent = 'Pilih size dulu sebelum order.';
            return;
          }
          orderWhatsApp(p, on.dataset.size);
        }
      });

      grid.addEventListener('error', e => {
        if (e.target.tagName === 'IMG') {
          e.target.outerHTML = shoeSVG(e.target.dataset.hex || '#cccccc');
        }
      }, true);
    }

    // Event tutup modal
    const modal = $('#productModal');
    if (modal) {
      modal.addEventListener('click', e => {
        if (e.target === modal || e.target.closest('#modalClose')) closeModal();
      });
    }
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });

    render();
  }

  async function loadFromBloggerFeed() {
    if ($('#count')) $('#count').textContent = 'Memuat katalog...';
    try {
      const res = await fetch('/feeds/posts/default?alt=json&max-results=500');
      const data = await res.json();
      const entries = (data.feed && data.feed.entry) ? data.feed.entry : [];
      allProducts = entries.map(parseBloggerEntry);
    } catch (err) {
      console.error('Gagal memuat feed Blogger:', err);
      allProducts = [];
    }
    setupUI();
  }

  document.addEventListener('DOMContentLoaded', loadFromBloggerFeed);
})();
