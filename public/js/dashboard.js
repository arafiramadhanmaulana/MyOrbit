// Ambil data referral dari sessionStorage dan parsing ke format objek JavaScript
const allData = JSON.parse(sessionStorage.getItem('referralData') || "[]");
// Ambil profil pertama dari data atau gunakan objek kosong jika tidak ada
const profile = allData[0] || {};

// Tampilkan data profil ke elemen-elemen HTML versi desktop
document.getElementById('userName').textContent = profile.referral_name || '-';
document.getElementById('userReferral').textContent = profile.referral_code || '-';
document.getElementById('userRegion').textContent = profile.region || '-';
document.getElementById('userBranch').textContent = profile.branch || '-';
document.getElementById('userCluster').textContent = profile.cluster || '-';
// Tampilkan data profil ke elemen-elemen HTML versi mobile
document.getElementById('mobileUserName').textContent = profile.referral_name || '-';
document.getElementById('mobileUserReferral').querySelector('span').textContent = profile.referral_code || '-';
document.getElementById('mobileUserRegion').textContent = profile.region || '-';
document.getElementById('mobileUserBranch').textContent = profile.branch || '-';
document.getElementById('mobileUserCluster').textContent = profile.cluster || '-';

// Jika data kosong, tampilkan alert dan redirect ke halaman login
if (!allData.length) {
  alert("Data tidak ditemukan, kembali ke login.");
  window.location.href = 'index.html';
}
// Konstanta target penjualan
const SALES_TARGET = 45;
const PERSONAL_MAX = 70;
const BRANCH_MAX = 50;
const FINAL_TARGET = 120;
// Ambil elemen dropdown untuk filter bulan
const bulanSelect = document.getElementById('bulanSelectDashboard');
const bulanSelectDetail = document.getElementById('bulanSelectDetail');
// Tambahkan event listener saat dropdown detail diubah
bulanSelectDetail.addEventListener("change", () => {
  const selectedMonth = bulanSelectDetail.value;
  renderDetailTable(selectedMonth);
});
// Ambil daftar bulan unik dari data berdasarkan active_date
const months = [...new Set(allData.map(d => d.active_date?.slice(0, 7)).filter(Boolean))].sort();
// Ambil elemen tempat menampilkan detail fee
const feeDetails = document.getElementById('feeDetails');
// Tambahkan opsi "Semua Bulan" ke dropdown dashboard
const allOption1 = document.createElement('option');
allOption1.value = 'all';
allOption1.textContent = 'Semua Bulan';
bulanSelect.appendChild(allOption1);
// Tambahkan opsi bulan ke kedua dropdown (dashboard & detail)
months.forEach(m => {
  const opt1 = document.createElement('option');
  opt1.value = m;
  opt1.textContent = formatMonth(m);
  bulanSelect.appendChild(opt1);

  const opt2 = document.createElement('option');
  opt2.value = m;
  opt2.textContent = formatMonth(m);
  bulanSelectDetail.appendChild(opt2);
});

// Tambahkan opsi "Semua Bulan" untuk dropdown bulan versi mobile
const allOptionMobile = document.createElement('option');
allOptionMobile.value = 'all';
allOptionMobile.textContent = 'Semua Bulan';
bulanSelectMobile.appendChild(allOptionMobile);
// Tambahkan opsi bulan yang tersedia ke dropdown mobile
months.forEach(m => {
  const opt = document.createElement('option');
  opt.value = m;
  opt.textContent = formatMonth(m);
  bulanSelectMobile.appendChild(opt);
});
bulanSelectMobile.value = sessionStorage.getItem('dashboardMonth') || 'all';
// Dropdown bulan di mobile detail
const bulanSelectMobileDetail = document.getElementById('bulanSelectMobileDetail');
// Buat opsi bulan untuk mobile detail (hanya jika belum diisi)
months.forEach(m => {
  const opt = document.createElement('option');
  opt.value = m;
  opt.textContent = formatMonth(m);
  bulanSelectMobileDetail.appendChild(opt);
});
bulanSelectMobileDetail.addEventListener("change", () => {
  const selectedMonth = bulanSelectMobileDetail.value;
  renderDetailTableMobile(selectedMonth); 
});
bulanSelectMobile.addEventListener('change', () => updateDashboard(bulanSelectMobile.value));


bulanSelect.value = sessionStorage.getItem('dashboardMonth') || 'all';

let progressChartInstance = null;
let finalScoreChartInstance = null;

bulanSelect.addEventListener('change', () => updateDashboard(bulanSelect.value));
updateDashboard(bulanSelect.value);

function formatMonth(m) {
  const [y, mo] = m.split('-');
  const bulanNama = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return `${bulanNama[parseInt(mo)-1]} ${y}`;
}

function renderProgressChart(ach, remaining) {
  const ctx = document.getElementById('progressChart').getContext('2d');
  if (progressChartInstance) progressChartInstance.destroy();
  progressChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Sales Regular', 'Sisa Target'],
      datasets: [{
        data: [ach, remaining],
        backgroundColor: ['#ff0000', '#e5e7eb'],
        borderWidth: 1
      }]
    },
    options: {
      cutout: '70%',
      plugins: {
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed}` } },
        legend: { display: false },
        title: { display: false }

      }
    }
  });
}

function renderFinalScoreChart(score) {
  const ctx = document.getElementById('finalScoreChart').getContext('2d');
  if (finalScoreChartInstance) finalScoreChartInstance.destroy();
  finalScoreChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Final Score', 'Sisa Target'],
      datasets: [{
        data: [score, Math.max(0, FINAL_TARGET - score)],
        backgroundColor: ['#2ecc71', '#e5e7eb'],
        borderWidth: 1
      }]
    },
    options: {
      cutout: '70%',
      plugins: {
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed.toFixed(1)}%` } },
        legend: { display: false },
        title: { display: false }
      }
    }
  });
}

function updateDashboard(month) {
  const filtered = month === 'all' ? allData : allData.filter(d => d.active_date?.startsWith(month));
  const SALES_COUNT = filtered.length;
  const PERSONAL_SCORE = month === 'all'
    ? (SALES_COUNT / SALES_TARGET) * PERSONAL_MAX
    : (SALES_COUNT >= SALES_TARGET ? PERSONAL_MAX : (SALES_COUNT / SALES_TARGET) * PERSONAL_MAX);

  sessionStorage.setItem('dashboardMonth', month);

  const referralCode = allData[0]?.referral_code;
  const currentBranch = allData[0]?.branch?.trim()?.toLowerCase() || "";

  const branchSales = allData.filter(d => 
    (d.branch || "").trim().toLowerCase() === currentBranch
  );
  const branchSalesFiltered = month === 'all'
    ? branchSales
    : branchSales.filter(d => d.active_date?.startsWith(month));

  fetch(`/user-summary/${referralCode}?month=${month}`)
    .then(res => res.json())
    .then(data => {
      const totalTarget = data.total_target || 0;
      const totalSales = data.total_sales || 0; // ✅ Gunakan dari backend
      const UMK = data.umk || 0;

      const branchScore = totalTarget > 0 ? (totalSales / totalTarget) * BRANCH_MAX : 0;
      const finalScore = PERSONAL_SCORE + branchScore;

      renderProgressChart(SALES_COUNT, Math.max(0, SALES_TARGET - SALES_COUNT));
      renderFinalScoreChart(finalScore);

      const branchCtx = document.getElementById('branchChart').getContext('2d');
      if (window.branchChartInstance) window.branchChartInstance.destroy();
      window.branchChartInstance = new Chart(branchCtx, {
        type: 'doughnut',
        data: {
          labels: ['Total Sales', 'Sisa Target'],
          datasets: [{
            data: [totalSales, Math.max(0, totalTarget - totalSales)],
            backgroundColor: ['#ffff00 ', '#e5e7eb'],
            borderWidth: 1
          }]
        },
        options: {
          cutout: '70%',
          plugins: {
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.label}: ${ctx.parsed}`
              }
            },
            legend: { display: false },
            title: { display: false }
          }
        }
      });
      
      // Statistik Personal - Mobile
      document.getElementById("mobileStatTarget").textContent = SALES_TARGET;
      document.getElementById("mobileStatAchieved").textContent = SALES_COUNT;
      document.getElementById("mobileStatPersonal").textContent = PERSONAL_SCORE.toFixed(2) + '%';

      // Statistik Branch - Mobile
      document.getElementById("mobileBranchTarget").textContent = totalTarget;
      document.getElementById("mobileBranchAchieved").textContent = totalSales;
      document.getElementById("mobileBranchScore").textContent = branchScore.toFixed(2) + '%';

      // Statistik Final - Mobile
      document.getElementById("mobileFinalPersonal").textContent = PERSONAL_SCORE.toFixed(2) + '%';
      document.getElementById("mobileFinalBranch").textContent = branchScore.toFixed(2) + '%';
      document.getElementById("mobileFinalTotal").textContent = finalScore.toFixed(2) + '%';

      // Chart: Personal - Mobile
      const mProgressCtx = document.getElementById('mobileProgressChart').getContext('2d');
      if (window.mobileProgressChartInstance) window.mobileProgressChartInstance.destroy();
      window.mobileProgressChartInstance = new Chart(mProgressCtx, {
        type: 'doughnut',
        data: {
          labels: ['Sales Regular', 'Sisa Target'],
          datasets: [{
            data: [SALES_COUNT, Math.max(0, SALES_TARGET - SALES_COUNT)],
            backgroundColor: ['#ff0000', '#e5e7eb'],
            borderWidth: 1
          }]
        },
        options: {
          cutout: '70%',
          plugins: {
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.label}: ${ctx.parsed}`
              }
            },
            legend: { display: false },
            title: { display: false }
          }
        }
      });

      const mBranchCtx = document.getElementById('mobileBranchChart').getContext('2d');
      if (window.mobileBranchChartInstance) window.mobileBranchChartInstance.destroy();
      window.mobileBranchChartInstance = new Chart(mBranchCtx, {
        type: 'doughnut',
        data: {
          labels: ['Total Sales', 'Sisa Target'],
          datasets: [{
            data: [totalSales, Math.max(0, totalTarget - totalSales)],
            backgroundColor: ['#ffff00', '#e5e7eb'],
            borderWidth: 1
          }]
        },
        options: {
          cutout: '70%',
          plugins: {
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.label}: ${ctx.parsed}`
              }
            },
            legend: { display: false },
            title: { display: false }
          }
        }
      });

      const mFinalCtx = document.getElementById('mobileFinalScoreChart').getContext('2d');
      if (window.mobileFinalScoreChartInstance) window.mobileFinalScoreChartInstance.destroy();
      window.mobileFinalScoreChartInstance = new Chart(mFinalCtx, {
        type: 'doughnut',
        data: {
          labels: ['Final Score', 'Sisa Target'],
          datasets: [{
            data: [finalScore, Math.max(0, FINAL_TARGET - finalScore)],
            backgroundColor: ['#2ecc71', '#e5e7eb'],
            borderWidth: 1
          }]
        },
        options: {
          cutout: '70%',
          plugins: {
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.label}: ${ctx.parsed.toFixed(1)}%`
              }
            },
            legend: { display: false },
            title: { display: false }
          }
        }
      });

      document.getElementById("mobileProgressValue").textContent = `${SALES_COUNT} terjual dari target personal ${SALES_TARGET}`;
      document.getElementById("mobileFinalScoreValue").textContent = `${finalScore.toFixed(2)}% terjual dari target branch ${FINAL_TARGET}%`;
      document.getElementById("mobileBranchValue").textContent = `${totalSales} tercapai dari target skor ${totalTarget}`;

      document.getElementById("progressValue").textContent = `${SALES_COUNT} terjual dari target personal ${SALES_TARGET}`;
      document.getElementById("finalScoreValue").textContent = `${finalScore.toFixed(2)}% tercapai dari target skor ${FINAL_TARGET}%`;
      document.getElementById("branchValue").textContent = `${totalSales} terjual dari target branch ${totalTarget}`;

      document.getElementById("statTarget").textContent = SALES_TARGET;
      document.getElementById("statAchieved").textContent = SALES_COUNT;
      document.getElementById("statPersonal").textContent = PERSONAL_SCORE.toFixed(2) + '%';

      document.getElementById("branchTarget").textContent = totalTarget;
      document.getElementById("branchAchieved").textContent = totalSales;
      document.getElementById("branchScore").textContent = branchScore.toFixed(2) + '%';

      document.getElementById("finalPersonal").textContent = PERSONAL_SCORE.toFixed(2) + '%';
      document.getElementById("finalBranch").textContent = branchScore.toFixed(2) + '%';
      document.getElementById("finalTotal").textContent = finalScore.toFixed(2) + '%';

      let totalFee = 0;

      if (month === 'all') {
        months.forEach(m => {
          const monthlySales = allData.filter(d =>
            d.active_date?.startsWith(m) &&
            d.referral_code === referralCode
          ).length;

          let monthlyBase = 0;
          if (monthlySales >= 1 && monthlySales <= 2) monthlyBase = 150000;
          else if (monthlySales <= 5) monthlyBase = 225000;
          else if (monthlySales <= 8) monthlyBase = 600000;
          else if (monthlySales <= 11) monthlyBase = 1100000;
          else if (monthlySales <= 15) monthlyBase = 0.5 * UMK;
          else if (monthlySales <= 18) monthlyBase = 0.6 * UMK;
          else if (monthlySales <= 23) monthlyBase = 0.7 * UMK;
          else if (monthlySales <= 26) monthlyBase = 0.8 * UMK;
          else if (monthlySales >= 27) monthlyBase = 1.0 * UMK;

          let monthlyFinalScore = (monthlySales / SALES_TARGET) * PERSONAL_MAX;
          if (monthlyFinalScore > PERSONAL_MAX) monthlyFinalScore = PERSONAL_MAX;

          const branchScoreMonthly = totalTarget > 0 ? (totalSales / totalTarget) * BRANCH_MAX : 0;
          const scoreTotal = monthlyFinalScore + branchScoreMonthly;

          let monthlyBonus = 0;
          if (scoreTotal >= 120) monthlyBonus = monthlyBase;
          else if (scoreTotal >= 100) monthlyBonus = 0.5 * monthlyBase;
          if (monthlySales >= 45) monthlyBonus += 1000000;

          totalFee += monthlyBase + monthlyBonus;
        });
      } else {
        let baseFee = 0;
        if (SALES_COUNT >= 1 && SALES_COUNT <= 2) baseFee = 150000;
        else if (SALES_COUNT <= 5) baseFee = 225000;
        else if (SALES_COUNT <= 8) baseFee = 600000;
        else if (SALES_COUNT <= 11) baseFee = 1100000;
        else if (SALES_COUNT <= 15) baseFee = 0.5 * UMK;
        else if (SALES_COUNT <= 18) baseFee = 0.6 * UMK;
        else if (SALES_COUNT <= 23) baseFee = 0.7 * UMK;
        else if (SALES_COUNT <= 26) baseFee = 0.8 * UMK;
        else if (SALES_COUNT >= 27) baseFee = 1.0 * UMK;

        let bonus = 0;
        if (finalScore >= 120) bonus = baseFee;
        else if (finalScore >= 100) bonus = 0.5 * baseFee;
        if (SALES_COUNT >= 45) bonus += 1000000;

        totalFee = baseFee + bonus;
      }

      feeDetails.innerHTML = `
        <p class="text-xs font-semibold text-black-600 mb-1">UMK Branch</p>
        <p class="text-base font-bold text-[#3498db]" id="umkBranch">Rp${UMK.toLocaleString('id-ID')}</p>
      `;

      document.getElementById("feeAmount").textContent = `Rp${Math.round(totalFee).toLocaleString('id-ID')}`;
      document.getElementById("mobileUmkBranch").textContent = `Rp${UMK.toLocaleString('id-ID')}`;
      document.getElementById("mobileFeeAmount").textContent = `Rp${Math.round(totalFee).toLocaleString('id-ID')}`
      
    })
    .catch(err => {
      console.error("❌ Gagal ambil /user-summary", err);
    });
}

function goBack() {
  window.location.href = 'index.html';
}

function showDashboard() {
  const isMobile = window.innerWidth < 768;

  if (isMobile) {
    document.getElementById("mobileDashboard").classList.remove("hidden");
    document.getElementById("mobileDetailPage").classList.add("hidden");

    updateDashboard(document.getElementById('bulanSelectMobile').value);
  } else {
    const dashboard = document.getElementById('dashboardMain');
    const resultPage = document.getElementById('resultPage');
    dashboard.classList.remove('hidden');
    resultPage.classList.add('hidden');
    updateDashboard(document.getElementById('bulanSelectDashboard').value);
  }
}

function backToDashboardMobile() {
  document.getElementById("mobileDetailPage").classList.add("hidden");
  document.getElementById("mobileDashboard").classList.remove("hidden");
}

function showDetail() {
  const isMobile = window.innerWidth < 768;

  if (isMobile) {
    document.getElementById("mobileDashboard").classList.add("hidden");
    document.getElementById("mobileDetailPage").classList.remove("hidden");

    const selectedMonth = document.getElementById("bulanSelectMobileDetail").value;
    renderDetailTableMobile(selectedMonth);
  } else {
    const dashboard = document.getElementById('dashboardMain');
    const resultPage = document.getElementById('resultPage');
    dashboard.classList.add('hidden');
    resultPage.classList.remove('hidden');

    const selectedMonth = document.getElementById('bulanSelectDetail').value;
    renderDetailTable(selectedMonth);
  }
}

function renderDetailTable(month) {
  const allData = JSON.parse(sessionStorage.getItem('referralData') || "[]");
  const tableHead = document.getElementById("tableHead");
  const tableBody = document.getElementById("tableBody");

  tableHead.innerHTML = "";
  tableBody.innerHTML = "";

  let filtered = month === "all" ? allData : allData.filter(d => d.active_date?.startsWith(month));

  if (!filtered.length) {
    tableBody.innerHTML = `<tr><td colspan="999" class="text-center py-4 text-red-600">Tidak ada data untuk bulan ini.</td></tr>`;
    return;
  }

  const headers = Object.keys(filtered[0]);
  headers.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h.replace(/_/g, " ").toUpperCase();
    tableHead.appendChild(th);
  });

  filtered.forEach(row => {
    const tr = document.createElement("tr");
    headers.forEach(h => {
      const td = document.createElement("td");
      td.textContent = row[h] ?? "-";
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });
}

function renderDetailTableMobile(month) {
  const allData = JSON.parse(sessionStorage.getItem('referralData') || "[]");
  const tableHead = document.getElementById("mobileTableHead");
  const tableBody = document.getElementById("mobileTableBody");

  tableHead.innerHTML = "";
  tableBody.innerHTML = "";

  let filtered = month === "all" ? allData : allData.filter(d => d.active_date?.startsWith(month));

  if (!filtered.length) {
    tableBody.innerHTML = `<tr><td colspan="999" class="text-center py-4 text-red-600">Tidak ada data untuk bulan ini.</td></tr>`;
    return;
  }

  const headers = Object.keys(filtered[0]);
  headers.forEach(h => {
    const th = document.createElement("th");
    th.className = "text-xs font-bold bg-gray-200 border";
    th.textContent = h.replace(/_/g, " ").toUpperCase();
    tableHead.appendChild(th);
  });

  filtered.forEach(row => {
    const tr = document.createElement("tr");
    headers.forEach(h => {
      const td = document.createElement("td");
      td.className = "text-xs border text-center";
      td.textContent = row[h] ?? "-";
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });
}

  document.addEventListener("DOMContentLoaded", () => {
    showDashboard();
  });