(function() {
  const $ = s => document.querySelector(s);
  const cfg = Object.assign({
    store: document.title || 'Katalog Sepatu',
    wa: '6281234567890',
    tagline: 'Pilih merk, size, dan warna. Tekan ORDER untuk memesan lewat WhatsApp.'
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

  // Parser format isi postingan Blogspot
  // Format di dalam Postingan Blogger:
  // Merk: Nike
  // Harga: 850000
  // Size: 39, 40, 41, 42
  // Warna: Putih
  // Hex: #f2f2f2
  function parseBloggerEntry(entry, idx) {
    const title = entry.title ? entry.title.$t.trim() : 'Produk ' + (idx + 1);
    const html = entry.content ? entry.content.$t : (entry.summary ? entry.summary.$t : '');
    const linkObj = (entry.link || []).find(l => l.rel === 'alternate');
    const url = linkObj ? linkObj.href : '#';

    // Ambil gambar pertama dari postingan (jika ada)
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const imgEl = doc.querySelector('img');
    let img = imgEl ? imgEl.src : '';
    if (!img && entry.media$thumbnail) {
      img = entry.media$thumbnail.url.replace(/\/s[0-9]+(-c)?\//, '/s800/');
    }

    // Ubah HTML postingan jadi baris teks bersih
    doc.querySelectorAll('br, p, div, li, tr').forEach(el => el.after('\n'));
    const text = doc.body.textContent || '';
    const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);

    const meta = {};
    lines.forEach(line => {
      const m = line.match(/^(merk|brand|harga|price|size|ukuran|warna|color|hex|kode\s*warna)\s*:\s*(.+)$/i);
      if (m) {
        meta[m[1].toLowerCase().replace(/\s+/g, '')] = m[2].trim();
      }
    });

    // Ambil label postingan sebagai cadangan Merk jika tidak ditulis di isi postingan
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
      url
    };
  }

  let allProducts = [];

  const uniq = arr => [...new Set(arr)];
  function fillSelect(sel, label, vals) {
    if (!sel) return;
    sel.innerHTML = `<option value="">${label}</option>` + vals.map(v => `<option>${esc(v)}</option>`).join('');
  }

  function card(p) {
    const fSizeVal = $('#fSize') ? $('#fSize').value : '';
    const pre = p.sizes.length === 1 ? String(p.sizes[0]) : fSizeVal;
    return `<article class="card" data-id="${esc(p.id)}" style="--c:${esc(p.hex)}">
      <div class="visual">${productVisual(p)}</div>
      <div class="info">
        <p class="brand">${esc(p.brand)}</p>
        <h2><a href="${esc(p.url)}" title="Lihat detail ${esc(p.name)}">${esc(p.name)}</a></h2>
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
    if ($('#storeName') && cfg.store) $('#storeName').textContent = cfg.store;
    if ($('#storeTagline') && cfg.tagline) $('#storeTagline').textContent = cfg.tagline;

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

        if (e.target.closest('.order')) {
          const p = allProducts.find(x => x.id === cardEl.dataset.id);
          const on = cardEl.querySelector('.chip.on');
          if (!p) return;
          if (!on) {
            cardEl.querySelector('.hint').textContent = 'Pilih size dulu sebelum order.';
            return;
          }
          const msg = [
            `Halo ${cfg.store}, saya mau order:`,
            `Produk: ${p.name}`,
            `Merk: ${p.brand}`,
            `Size: ${on.dataset.size}`,
            `Warna: ${p.color}`,
            `Harga: ${rupiah(p.price)}`,
            '',
            'Apakah masih tersedia?'
          ].join('\n');
          window.open(`https://wa.me/${normWA(cfg.wa)}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
        }
      });

      grid.addEventListener('error', e => {
        if (e.target.tagName === 'IMG') {
          e.target.outerHTML = shoeSVG(e.target.dataset.hex || '#cccccc');
        }
      }, true);
    }

    render();
  }

  // Ambil seluruh produk dari Feed JSON Blogger (maksimal 500 produk)
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
