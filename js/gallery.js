(function () {
  const grid = document.getElementById('grid');
  const campaignBar = document.getElementById('campaignBar');
  const filterBar = document.getElementById('filterBar');
  const emptyState = document.getElementById('emptyState');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const lightboxClose = document.getElementById('lightboxClose');

  const UNCATEGORIZED = 'Non classé';

  let entries = [];
  let activeCampaign = null;
  let activeTag = null;

  async function load() {
    try {
      const res = await fetch('/api/list');
      entries = await res.json();
    } catch (e) {
      entries = [];
    }
    buildCampaignTabs();
    buildFilters();
    render();
  }

  function campaignOf(entry) {
    return entry.campaign && entry.campaign.trim() ? entry.campaign.trim() : UNCATEGORIZED;
  }

  function allCampaigns() {
    const set = new Set();
    entries.forEach((e) => set.add(campaignOf(e)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }

  function entriesInActiveCampaign() {
    return activeCampaign
      ? entries.filter((e) => campaignOf(e) === activeCampaign)
      : entries;
  }

  function allTags() {
    const set = new Set();
    entriesInActiveCampaign().forEach((e) => (e.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }

  function buildCampaignTabs() {
    const campaigns = allCampaigns();
    campaignBar.innerHTML = '';

    if (campaigns.length <= 1) {
      campaignBar.style.display = 'none';
      return;
    }
    campaignBar.style.display = 'flex';

    const allTab = document.createElement('button');
    allTab.className = 'campaign-tab' + (activeCampaign === null ? ' active' : '');
    allTab.textContent = 'Toutes les campagnes';
    allTab.onclick = () => { activeCampaign = null; activeTag = null; buildCampaignTabs(); buildFilters(); render(); };
    campaignBar.appendChild(allTab);

    campaigns.forEach((camp) => {
      const tab = document.createElement('button');
      tab.className = 'campaign-tab' + (activeCampaign === camp ? ' active' : '');
      tab.textContent = camp;
      tab.onclick = () => { activeCampaign = camp; activeTag = null; buildCampaignTabs(); buildFilters(); render(); };
      campaignBar.appendChild(tab);
    });
  }

  function buildFilters() {
    const tags = allTags();
    filterBar.querySelectorAll('.tag-pill').forEach((el) => el.remove());

    if (tags.length === 0) {
      filterBar.style.display = 'none';
      return;
    }
    filterBar.style.display = 'flex';

    const allPill = document.createElement('button');
    allPill.className = 'tag-pill' + (activeTag === null ? ' active' : '');
    allPill.textContent = 'Tout';
    allPill.onclick = () => { activeTag = null; buildFilters(); render(); };
    filterBar.appendChild(allPill);

    tags.forEach((tag) => {
      const pill = document.createElement('button');
      pill.className = 'tag-pill' + (activeTag === tag ? ' active' : '');
      pill.textContent = tag;
      pill.onclick = () => { activeTag = tag; buildFilters(); render(); };
      filterBar.appendChild(pill);
    });
  }

  function render() {
    grid.innerHTML = '';
    let filtered = entriesInActiveCampaign();
    if (activeTag) {
      filtered = filtered.filter((e) => (e.tags || []).includes(activeTag));
    }

    emptyState.style.display = filtered.length === 0 ? 'block' : 'none';

    filtered.forEach((entry, idx) => {
      const plate = document.createElement('div');
      plate.className = 'plate';

      const index = document.createElement('div');
      index.className = 'plate-index';
      index.textContent = 'Pl. ' + String(entries.length - entries.indexOf(entry)).padStart(3, '0');
      plate.appendChild(index);

      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = '/api/image?id=' + entry.id;
      img.alt = entry.caption || entry.filename || 'Illustration';
      plate.appendChild(img);

      const captionWrap = document.createElement('div');
      captionWrap.className = 'plate-caption';

      if (entry.caption) {
        const cap = document.createElement('p');
        cap.className = 'caption-text';
        cap.textContent = entry.caption;
        captionWrap.appendChild(cap);
      }

      if ((entry.tags || []).length) {
        const tagRow = document.createElement('div');
        tagRow.className = 'tag-row';
        entry.tags.forEach((t) => {
          const chip = document.createElement('span');
          chip.className = 'tag-chip';
          chip.textContent = t;
          tagRow.appendChild(chip);
        });
        captionWrap.appendChild(tagRow);
      }

      plate.appendChild(captionWrap);

      plate.addEventListener('click', () => openLightbox(entry));

      grid.appendChild(plate);
    });
  }

  function openLightbox(entry) {
    lightboxImg.src = '/api/image?id=' + entry.id;
    lightboxImg.alt = entry.caption || entry.filename || '';
    lightboxCaption.textContent = entry.caption || '';
    lightbox.classList.add('open');
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
  }

  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

  load();
})();
