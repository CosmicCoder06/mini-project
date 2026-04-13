/* ─── THEME ────────────────────────────────────────────────── */
const themeBtn = document.getElementById('themeBtn');
let theme = localStorage.getItem('sb-theme') || 'dark';
document.documentElement.setAttribute('data-theme', theme);
themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
themeBtn.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('sb-theme', theme);
  themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  if (currentData) drawGauge(currentScore);
});

/* ─── STATE ─────────────────────────────────────────────────── */
let priceChartInstance = null;
let currentData = null;
let currentScore = 0;

/* ─── ELEMENTS ──────────────────────────────────────────────── */
const analyzeBtn  = document.getElementById('analyzeBtn');
const asinInput   = document.getElementById('asinInput');
const skeleton    = document.getElementById('skeleton');
const emptyState  = document.getElementById('emptyState');
const dashboard   = document.getElementById('dashboard');
const errorBanner = document.getElementById('errorBanner');

/* ─── ANALYZE ───────────────────────────────────────────────── */
analyzeBtn.addEventListener('click', runAnalysis);
asinInput.addEventListener('keydown', e => { if (e.key === 'Enter') runAnalysis(); });

function extractAsin(raw) {
  // Accept bare ASIN or any Amazon URL containing /dp/ASINCODE
  const urlMatch = raw.match(/\/dp\/([A-Z0-9]{10})/i);
  if (urlMatch) return urlMatch[1].toUpperCase();
  // Plain ASIN — 10 alphanumeric chars
  const plain = raw.trim().toUpperCase();
  if (/^[A-Z0-9]{10}$/.test(plain)) return plain;
  return null;
}

// Auto-detect backend: if opened via file:// or a different port (e.g. Live Server),
// point API calls at the Express server on port 3000.
const API_BASE = (location.port === '3000' || location.protocol === 'file:')
  ? 'http://localhost:3000'
  : (location.port && location.port !== '3000' ? 'http://localhost:3000' : '');

async function runAnalysis() {
  const raw  = asinInput.value.trim();
  const asin = extractAsin(raw);
  if (!asin) {
    showError('Please enter a valid ASIN (10 characters) or a full Amazon product URL.');
    shake(asinInput);
    return;
  }
  // Show the clean ASIN in the input
  asinInput.value = asin;

  setLoading(true);

  try {
    const res  = await fetch(`${API_BASE}/api/analyze?asin=${encodeURIComponent(asin)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    errorBanner.style.display = 'none';
    currentData = data;
    renderDashboard(data);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
}

function setLoading(on) {
  analyzeBtn.disabled = on;
  analyzeBtn.textContent = on ? 'Analyzing…' : 'Analyze →';
  skeleton.classList.toggle('visible', on);
  if (on) {
    emptyState.style.display  = 'none';
    dashboard.style.display   = 'none';
  }
}

function showError(msg) {
  errorBanner.textContent = '⚠️ ' + msg;
  errorBanner.style.display = 'block';
  emptyState.style.display = 'none';
  dashboard.style.display  = 'none';
}

function shake(el) {
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'shake .4s ease';
}

/* ─── RENDER ────────────────────────────────────────────────── */
function fmt(n) { return '₹' + parseFloat(n).toLocaleString('en-IN', {maximumFractionDigits:0}); }

function renderDashboard(d) {
  dashboard.style.display = 'block';
  emptyState.style.display = 'none';

  /* Product */
  document.getElementById('productImg').src = d.productImage || '';
  document.getElementById('productTitle').textContent = d.productTitle;
  document.getElementById('productPrice').textContent = fmt(d.currentPrice);

  const badges = document.getElementById('productBadges');
  badges.innerHTML = `
    <span class="badge badge-neutral">ASIN: ${asinInput.value.trim()}</span>
    <span class="badge badge-neutral">Amazon India</span>
  `;

  /* Recommendation banner */
  const rec   = d.recommendation; // BUY / WAIT / FAIR
  const banner= document.getElementById('recBanner');
  const icon  = document.getElementById('recIcon');
  const label = document.getElementById('recLabel');
  const title = document.getElementById('recTitle');
  const reason= document.getElementById('recReason');

  banner.className = 'rec-banner';
  if (rec === 'BUY') {
    banner.classList.add('buy');
    icon.textContent = '🟢';
    label.textContent = 'Recommended'; label.className = 'rec-label buy';
    title.textContent = 'Buy Now — Great Deal!';
  } else if (rec === 'WAIT') {
    banner.classList.add('over');
    icon.textContent = '🔴';
    label.textContent = 'Overpriced'; label.className = 'rec-label over';
    title.textContent = 'Overpriced — Wait for a Drop';
  } else {
    banner.classList.add('wait');
    icon.textContent = '🟡';
    label.textContent = 'Fair Price'; label.className = 'rec-label wait';
    title.textContent = 'Fair Price — No Rush';
  }
  reason.textContent = d.reason + (d.sellerReliable ? ' Seller is trusted.' : ' Note: seller has limited reviews.');

  /* Stats */
  document.getElementById('statAvg').textContent  = fmt(d.avgPrice);
  document.getElementById('statHigh').textContent = fmt(d.highPrice);
  document.getElementById('statLow').textContent  = fmt(d.lowPrice);
  const dev = parseFloat(d.deviation);
  const devEl = document.getElementById('statDev');
  devEl.textContent = (dev > 0 ? '+' : '') + dev.toFixed(1) + '%';
  devEl.style.color = dev < -10 ? 'var(--green)' : dev > 10 ? 'var(--red)' : 'var(--yellow)';

  /* Seller */
  document.getElementById('sellerRating').textContent = d.sellerRating + ' / 5';
  document.getElementById('sellerReviews').textContent = d.reviewCount.toLocaleString('en-IN') + ' reviews';
  const stars = Math.round(d.sellerRating);
  document.getElementById('starRow').innerHTML = Array(5).fill(0).map((_, i) =>
    `<span style="color:${i < stars ? '#f59e0b' : 'var(--text-muted)'}">★</span>`).join('');
  const rb = document.getElementById('reliabilityBadge');
  if (d.sellerReliable) {
    rb.className = 'reliability-badge rel-trusted';
    rb.innerHTML = '✅ Trusted Seller';
  } else if (d.sellerRating >= 3) {
    rb.className = 'reliability-badge rel-moderate';
    rb.innerHTML = '⚠️ Moderate Trust';
  } else {
    rb.className = 'reliability-badge rel-risky';
    rb.innerHTML = '❌ Low Trust';
  }

  /* Deal score */
  const score = computeScore(d);
  currentScore = score;
  drawGauge(score);

  /* Savings */
  const saving = parseFloat(d.avgPrice) - d.currentPrice;
  const savEl  = document.getElementById('savingsAmt');
  if (saving >= 0) {
    savEl.className = 'savings-amount savings-positive';
    savEl.textContent = '−' + fmt(saving);
    document.getElementById('savingsSub').textContent = 'Cheaper than average — great time to buy!';
  } else {
    savEl.className = 'savings-amount savings-negative';
    savEl.textContent = '+' + fmt(Math.abs(saving));
    document.getElementById('savingsSub').textContent = 'Currently above average price.';
  }

  /* Prediction */
  const pred = predictNextWeek(d.priceHistory, d.currentPrice);
  document.getElementById('predVal').textContent = fmt(pred.lo) + ' – ' + fmt(pred.hi);
  document.getElementById('predTrend').textContent =
    pred.direction === 'up' ? '📈 Trending upward — prices rising' :
    pred.direction === 'down' ? '📉 Trending downward — may get cheaper' :
    '➡️ Prices appear stable';

  /* Chart */
  buildChart(d.priceHistory, parseFloat(d.avgPrice));

  /* Alert autofill */
  document.getElementById('alertInput').value = Math.floor(d.currentPrice * 0.9);
}

/* ─── DEAL SCORE ─────────────────────────────────────────────── */
function computeScore(d) {
  let score = 50;
  const dev = parseFloat(d.deviation);
  // Price component (max ±30)
  if (dev <= -20) score += 30;
  else if (dev <= -10) score += 20;
  else if (dev <= -5)  score += 10;
  else if (dev >= 25)  score -= 30;
  else if (dev >= 15)  score -= 20;
  else if (dev >= 5)   score -= 10;
  // Seller component (max ±20)
  if (d.sellerReliable) score += 15;
  else if (d.sellerRating >= 3) score += 5;
  else score -= 10;
  // Review count
  if (d.reviewCount > 500) score += 5;
  else if (d.reviewCount < 50) score -= 5;
  return Math.min(100, Math.max(0, Math.round(score)));
}

function drawGauge(score) {
  const canvas = document.getElementById('gaugeCanvas');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H - 4;
  const r  = 66, sw = 14;
  const start = Math.PI, end = 2 * Math.PI;
  const angle = Math.PI + (score / 100) * Math.PI;

  // Track
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, end);
  ctx.strokeStyle = theme === 'dark' ? '#1e2233' : '#e8eaf2';
  ctx.lineWidth = sw; ctx.lineCap = 'round';
  ctx.stroke();

  // Color
  const color = score >= 70 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444';

  // Fill
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = sw; ctx.lineCap = 'round';
  ctx.stroke();

  // Needle dot
  const nx = cx + (r) * Math.cos(angle);
  const ny = cy + (r) * Math.sin(angle);
  ctx.beginPath();
  ctx.arc(nx, ny, 6, 0, 2 * Math.PI);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.stroke();

  document.getElementById('gaugeNum').textContent = score;
  document.getElementById('gaugeNum').style.color = color;
  document.getElementById('gaugeLabel').textContent =
    score >= 70 ? '🟢 Great Deal' : score >= 45 ? '🟡 Fair Deal' : '🔴 Overpriced';
}

/* ─── PREDICTION ─────────────────────────────────────────────── */
function predictNextWeek(history, currentPrice) {
  if (!history || history.length < 5) return { lo: currentPrice * 0.97, hi: currentPrice * 1.03, direction: 'stable' };
  const recent = history.slice(-7).map(h => h.price);
  const first  = recent[0], last = recent[recent.length - 1];
  const trend  = (last - first) / recent.length;
  const pred   = currentPrice + trend * 7;
  const lo     = Math.round(pred * 0.97);
  const hi     = Math.round(pred * 1.03);
  return { lo, hi, direction: trend > currentPrice * 0.002 ? 'up' : trend < -currentPrice * 0.002 ? 'down' : 'stable' };
}

/* ─── CHART ──────────────────────────────────────────────────── */
function buildChart(history, avg) {
  const labels = history.map(h => {
    const d = new Date(h.date);
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  });
  const prices = history.map(h => h.price);
  const minIdx = prices.indexOf(Math.min(...prices));
  const maxIdx = prices.indexOf(Math.max(...prices));

  const isDark = theme === 'dark';
  const textColor = isDark ? 'rgba(139,144,167,.8)' : 'rgba(85,89,112,.8)';
  const gridColor = isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)';

  const ctx = document.getElementById('priceChart').getContext('2d');
  if (priceChartInstance) priceChartInstance.destroy();

  const grad = ctx.createLinearGradient(0, 0, 0, 240);
  grad.addColorStop(0, 'rgba(79,127,255,.22)');
  grad.addColorStop(1, 'rgba(79,127,255,0)');

  const pointColors = prices.map((_, i) => {
    if (i === minIdx) return '#22c55e';
    if (i === maxIdx) return '#ef4444';
    return 'transparent';
  });
  const pointRadius = prices.map((_, i) => (i === minIdx || i === maxIdx) ? 6 : 3);
  const pointBorder = prices.map((_, i) => (i === minIdx || i === maxIdx) ? '#fff' : 'rgba(79,127,255,.5)');

  priceChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Price (₹)',
          data: prices,
          borderColor: '#4f7fff',
          backgroundColor: grad,
          borderWidth: 2.5,
          tension: 0.45,
          fill: true,
          pointBackgroundColor: pointColors,
          pointBorderColor: pointBorder,
          pointRadius,
          pointHoverRadius: 7,
          pointHoverBackgroundColor: '#4f7fff',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
        },
        {
          label: 'Avg Price (₹)',
          data: Array(prices.length).fill(avg),
          borderColor: 'rgba(245,158,11,.6)',
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0,
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: textColor, font: { family: 'DM Sans', size: 11 }, boxWidth: 14, padding: 16 }
        },
        tooltip: {
          backgroundColor: isDark ? '#1a1d26' : '#fff',
          borderColor: isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)',
          borderWidth: 1,
          titleColor: isDark ? '#f0f2ff' : '#0d0f1a',
          bodyColor: textColor,
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: ctx => ' ' + ctx.dataset.label + ': ₹' + ctx.parsed.y.toLocaleString('en-IN'),
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'DM Sans', size: 10 }, maxTicksLimit: 8 },
          border: { color: 'transparent' }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor, font: { family: 'DM Sans', size: 10 },
            callback: v => '₹' + v.toLocaleString('en-IN')
          },
          border: { color: 'transparent' }
        }
      }
    }
  });
}

/* ─── ALERT ──────────────────────────────────────────────────── */
document.getElementById('alertBtn').addEventListener('click', () => {
  const val = document.getElementById('alertInput').value;
  if (!val) return;
  const msg = document.getElementById('alertMsg');
  msg.textContent = `✅ Alert set! We'll notify you when price drops below ₹${parseFloat(val).toLocaleString('en-IN')}.`;
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 5000);
});
