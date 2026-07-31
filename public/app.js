(function() {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const tabBtns = $$('.nav-btn');
  const tabSearch = $('#tab-search');
  const tabSalary = $('#tab-salary');
  const tabAnalytics = $('#tab-analytics');

  const searchQuery = $('#search-query');
  const searchLocation = $('#search-location');
  const searchRemote = $('#search-remote');
  const btnSearch = $('#btn-search');
  const jobsContainer = $('#jobs-container');
  const searchInfo = $('#search-info');
  const searchError = $('#search-error');
  const searchLoader = $('#search-loader');

  const salaryRole = $('#salary-role');
  const salaryLoc = $('#salary-loc');
  const btnSalary = $('#btn-salary');
  const salaryResult = $('#salary-result');
  const salaryError = $('#salary-error');
  const salaryLoader = $('#salary-loader');

  const analyticsContent = $('#analytics-content');
  const analyticsError = $('#analytics-error');
  const analyticsLoader = $('#analytics-loader');

  function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ── Tabs ──
  tabBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const tab = this.dataset.tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      tabSearch.style.display = 'none';
      tabSalary.style.display = 'none';
      tabAnalytics.style.display = 'none';
      if (tab === 'search') tabSearch.style.display = 'block';
      if (tab === 'salary') tabSalary.style.display = 'block';
      if (tab === 'analytics') { tabAnalytics.style.display = 'block'; loadAnalytics(); }
    });
  });

  // ── Search ──
  async function doSearch() {
    const q = searchQuery.value.trim();
    if (!q) { searchError.textContent = 'Please enter a search term.'; searchError.style.display = 'block'; return; }
    const loc = searchLocation.value;
    const remote = searchRemote.checked;
    jobsContainer.innerHTML = ''; searchInfo.textContent = ''; searchError.style.display = 'none'; searchLoader.style.display = 'block';
    try {
      const p = new URLSearchParams({ q, loc }); if (remote) p.set('remote', 'true');
      const res = await fetch('/api/jobs/search?' + p.toString());
      if (!res.ok) throw new Error('Status ' + res.status);
      const data = await res.json();
      searchLoader.style.display = 'none';
      if (!data.jobs || !data.jobs.length) {
        jobsContainer.innerHTML = '<div class="empty-state">No jobs found for &ldquo;' + esc(q) + '&rdquo;. Try a different search.</div>';
        return;
      }
      searchInfo.textContent = data.jobs.length + ' results for &ldquo;' + esc(q) + '&rdquo;' + (data.cached ? ' (cached)' : '');
      jobsContainer.innerHTML = data.jobs.map(j => `
        <div class="job-card">
          <div class="job-card-header">
            <div>
              <div class="job-title">${esc(j.title)}</div>
              <div class="job-company">${esc(j.company)}</div>
            </div>
            <div class="job-salary">${esc(j.salary)}</div>
          </div>
          <div class="job-meta">
            <span>${esc(j.location)}</span>
            <span>${esc(j.type)}</span>
            ${j.remote ? '<span>Remote</span>' : ''}
            <span>${esc(j.postedDate || j.posted)}</span>
          </div>
          <div class="job-snippet">${esc(j.snippet)}</div>
          ${j.skills && j.skills.length ? '<div class="job-skills">' + j.skills.slice(0,6).map(s => '<span class="skill-tag">' + esc(s) + '</span>').join('') + '</div>' : ''}
          <a href="${esc(j.url)}" target="_blank" rel="noopener" class="job-apply">Apply &rarr;</a>
        </div>
      `).join('');
    } catch (err) {
      searchLoader.style.display = 'none';
      searchError.textContent = 'Unable to load jobs. Please try again.'; searchError.style.display = 'block';
    }
  }

  // ── Salary ──
  async function doSalary() {
    const role = salaryRole.value.trim(), loc = salaryLoc.value.trim();
    if (!role || !loc) { salaryError.textContent = 'Please enter both job title and location.'; salaryError.style.display = 'block'; return; }
    salaryResult.innerHTML = ''; salaryError.style.display = 'none'; salaryLoader.style.display = 'block';
    try {
      const res = await fetch('/api/jobs/salary?job_title=' + encodeURIComponent(role) + '&location=' + encodeURIComponent(loc));
      if (!res.ok) throw new Error('Status ' + res.status);
      const data = await res.json();
      salaryLoader.style.display = 'none';
      if (!data.salaries || !data.salaries.length) {
        salaryResult.innerHTML = '<div class="empty-state">No salary data found. Try a broader title or different location.</div>';
        return;
      }
      const s = data.salaries[0];
      salaryResult.innerHTML = `
        <div class="salary-card">
          <h3 style="font-weight:600;">${esc(s.jobTitle)}</h3>
          <p style="color:var(--text-muted);font-size:0.9rem;">${esc(s.location)}</p>
          <div class="salary-amount">$${s.medianSalary.toLocaleString()}</div>
          <p style="color:var(--text-muted);">Median ${(s.period || 'annual').toLowerCase()} salary</p>
          <dl class="salary-details">
            <div><dt>Range</dt><dd>$${s.salaryRange.min.toLocaleString()} &ndash; $${s.salaryRange.max.toLocaleString()}</dd></div>
            <div><dt>Base Pay</dt><dd>$${s.baseSalary.median.toLocaleString()}</dd></div>
            <div><dt>Additional</dt><dd>$${s.additionalPay.median.toLocaleString()}</dd></div>
          </dl>
          <p style="margin-top:1.25rem;font-size:0.78rem;color:var(--text-muted);">
            Based on ${s.sampleSize} salaries &middot; ${esc(s.publisher)} &middot; ${s.confidence} confidence
          </p>
        </div>`;
    } catch (err) {
      salaryLoader.style.display = 'none';
      salaryError.textContent = 'Request timed out. Try a simpler location.'; salaryError.style.display = 'block';
    }
  }

  // ── Analytics ──
  async function loadAnalytics() {
    analyticsContent.innerHTML = ''; analyticsError.style.display = 'none'; analyticsLoader.style.display = 'block';
    try {
      const res = await fetch('/api/jobs/analytics');
      if (!res.ok) throw new Error('Status ' + res.status);
      const data = await res.json();
      analyticsLoader.style.display = 'none';
      const skillMax = data.topSkills?.length ? data.topSkills[0].count : 1;
      const compMax = data.topCompanies?.length ? data.topCompanies[0].count : 1;
      analyticsContent.innerHTML = `
        <div class="stats-row">
          <div class="stat-card"><div class="stat-label">Jobs Analyzed</div><div class="stat-value">${data.totalJobsAnalyzed || 0}</div><div class="stat-sub">Current sample</div></div>
          <div class="stat-card"><div class="stat-label">Average Salary</div><div class="stat-value">$${(data.avgSalary || 0).toLocaleString()}</div><div class="stat-sub">Based on ${data.salarySampleSize || 0} listings</div></div>
          <div class="stat-card"><div class="stat-label">Remote Share</div><div class="stat-value">${data.remotePercentage || 0}%</div><div class="stat-sub">Of total listings</div></div>
        </div>
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-label" style="margin-bottom:0.75rem;">Top Skills in Demand</div>
            ${(data.topSkills || []).slice(0,8).map(s => `
              <div class="skill-row">
                <span class="skill-name">${esc(s.skill)}</span>
                <div class="bar-track"><div class="bar-fill" style="width:${Math.max((s.count/skillMax)*100,3)}%"></div></div>
                <span class="skill-count">${s.count}</span>
              </div>`).join('')}
          </div>
          <div class="stat-card">
            <div class="stat-label" style="margin-bottom:0.75rem;">Top Hiring Companies</div>
            ${(data.topCompanies || []).slice(0,8).map(c => `
              <div class="skill-row">
                <span class="skill-name">${esc(c.company)}</span>
                <div class="bar-track"><div class="bar-fill" style="width:${Math.max((c.count/compMax)*100,3)}%"></div></div>
                <span class="skill-count">${c.count}</span>
              </div>`).join('')}
          </div>
        </div>
        <p style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-top:1rem;">
          Updated ${new Date(data.sampleDate).toLocaleString()}${data.cached ? ' (cached)' : ''}
        </p>`;
    } catch (err) {
      analyticsLoader.style.display = 'none';
      analyticsError.textContent = 'Analytics temporarily unavailable.'; analyticsError.style.display = 'block';
    }
  }

  btnSearch.addEventListener('click', doSearch);
  btnSalary.addEventListener('click', doSalary);
  searchQuery.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  salaryRole.addEventListener('keydown', e => { if (e.key === 'Enter') doSalary(); });
  salaryLoc.addEventListener('keydown', e => { if (e.key === 'Enter') doSalary(); });

  doSearch();
})();
