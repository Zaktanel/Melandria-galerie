(function () {
  const grid = document.getElementById('grid');
  const campaignBar = document.getElementById('campaignBar');
  const filterBar = document.getElementById('filterBar');
  const emptyState = document.getElementById('emptyState');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const lightboxPosition = document.getElementById('lightboxPosition');
  const lightboxClose = document.getElementById('lightboxClose');
  const lightboxPrev = document.getElementById('lightboxPrev');
  const lightboxNext = document.getElementById('lightboxNext');
  const readBar = document.getElementById('readBar');
  const readFromStartBtn = document.getElementById('readFromStartBtn');

  const UNCATEGORIZED = 'Non classé';

  let entries = [];
  let activeCampaign = null;
  let activeFilters = {}; // catKey (minuscules) -> valeur sélectionnée (minuscules) ou null
  let currentDisplay = [];
  let currentIndex = -1;

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

  // Découpe un tag "Catégorie: Valeur" -> { category, value }.
  // Un tag sans ":" tombe dans la catégorie "Autres".
  function parseTag(tagRaw) {
    const idx = tagRaw.indexOf(':');
    if (idx === -1) return { category: 'Autres', value: tagRaw.trim() };
    const category = tagRaw.slice(0, idx).trim() || 'Autres';
    const value = tagRaw.slice(idx + 1).trim() || tagRaw.trim();
    return { category, value };
  }

  // Construit, pour la campagne active, une carte catégorie -> valeurs possibles.
  function buildCategoryMap() {
    const map = {};
    entriesInActiveCampaign().forEach((e) =>
      (e.tags || []).forEach((t) => {
        const { category, value } = parseTag(t);
        const catKey = category.toLowerCase();
        if (!map[catKey]) map[catKey] = { label: category, values: new Map() };
        map[catKey].values.set(value.toLowerCase(), value);
      })
    );
    return map;
  }

  // Repère un numéro en début de nom de fichier : "1. Introduction.jpg",
  // "12 - Bataille.png", "03) Feu du ciel.jpeg" -> renvoie 1, 12, 3, ou null si absent.
  function extractOrder(entry) {
    const match = (entry.filename || '').match(/^\s*(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  function sortWithinCampaign(list) {
    return list.slice().sort((a, b) => {
      const na = extractOrder(a);
      const nb = extractOrder(b);
      if (na !== null && nb !== null && na !== nb) return na - nb;
      if (na !== null && nb === null) return -1;
      if (na === null && nb !== null) return 1;
      // Pas de numéro (ou numéros identiques) : on retombe sur l'ordre de dépôt (le plus ancien d'abord)
      return new Date(a.uploadedAt) - new Date(b.uploadedAt);
    });
  }

  // Construit la liste à afficher, avec un numéro de planche qui repart à 1
  // pour chaque campagne (même en vue "Toutes les campagnes").
  function buildDisplayList(filtered) {
    const groups = {};
    const order = [];
    filtered.forEach((e) => {
      const c = campaignOf(e);
      if (!groups[c]) { groups[c] = []; order.push(c); }
      groups[c].push(e);
    });
    if (!activeCampaign) order.sort((a, b) => a.localeCompare(b, 'fr'));

    const display = [];
    order.forEach((c) => {
      sortWithinCampaign(groups[c]).forEach((entry, idx) => {
        display.push({ entry, plateNumber: idx + 1 });
      });
    });
    return display;
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
    allTab.onclick = () => { activeCampaign = null; activeFilters = {}; buildCampaignTabs(); buildFilters(); render(); };
    campaignBar.appendChild(allTab);

    campaigns.forEach((camp) => {
      const tab = document.createElement('button');
      tab.className = 'campaign-tab' + (activeCampaign === camp ? ' active' : '');
      tab.textContent = camp;
      tab.onclick = () => { activeCampaign = camp; activeFilters = {}; buildCampaignTabs(); buildFilters(); render(); };
      campaignBar.appendChild(tab);
    });
  }

  function buildFilters() {
    filterBar.innerHTML = '';
    const catMap = buildCategoryMap();
    const catKeys = Object.keys(catMap).sort((a, b) => {
      if (a === 'autres') return 1;
      if (b === 'autres') return -1;
      return catMap[a].label.localeCompare(catMap[b].label, 'fr');
    });

    if (catKeys.length === 0) {
      filterBar.style.display = 'none';
      return;
    }
    filterBar.style.display = 'flex';

    const label = document.createElement('span');
    label.className = 'filter-label';
    label.textContent = 'Filtrer';
    filterBar.appendChild(label);

    catKeys.forEach((catKey) => {
      const group = catMap[catKey];
      const wrapper = document.createElement('div');
      wrapper.className = 'filter-group';

      const groupLabel = document.createElement('span');
      groupLabel.className = 'filter-select-label';
      groupLabel.textContent = group.label;
      wrapper.appendChild(groupLabel);

      const select = document.createElement('select');
      select.className = 'filter-select';

      const optAll = document.createElement('option');
      optAll.value = '';
      optAll.textContent = 'Tous';
      select.appendChild(optAll);

      Array.from(group.values.entries())
        .sort((a, b) => a[1].localeCompare(b[1], 'fr'))
        .forEach(([valueKey, valueLabel]) => {
          const opt = document.createElement('option');
          opt.value = valueKey;
          opt.textContent = valueLabel;
          select.appendChild(opt);
        });

      select.value = activeFilters[catKey] || '';
      select.addEventListener('change', () => {
        activeFilters[catKey] = select.value || null;
        render();
      });

      wrapper.appendChild(select);
      filterBar.appendChild(wrapper);
    });

    const resetBtn = document.createElement('button');
    resetBtn.className = 'filter-reset';
    resetBtn.textContent = 'Réinitialiser';
    resetBtn.onclick = () => { activeFilters = {}; buildFilters(); render(); };
    filterBar.appendChild(resetBtn);
  }

  function render() {
    grid.innerHTML = '';
    let filtered = entriesInActiveCampaign();

    Object.keys(activeFilters).forEach((catKey) => {
      const val = activeFilters[catKey];
      if (!val) return;
      filtered = filtered.filter((e) =>
        (e.tags || []).some((t) => {
          const p = parseTag(t);
          return p.category.toLowerCase() === catKey && p.value.toLowerCase() === val;
        })
      );
    });

    const display = buildDisplayList(filtered);
    currentDisplay = display;

    emptyState.style.display = display.length === 0 ? 'block' : 'none';
    readBar.style.display = display.length === 0 ? 'none' : 'flex';

    display.forEach(({ entry, plateNumber }, i) => {
      const plate = document.createElement('div');
      plate.className = 'plate';

      const index = document.createElement('div');
      index.className = 'plate-index';
      index.textContent = 'Pl. ' + String(plateNumber).padStart(3, '0');
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
          chip.textContent = parseTag(t).value;
          tagRow.appendChild(chip);
        });
        captionWrap.appendChild(tagRow);
      }

      plate.appendChild(captionWrap);

      plate.addEventListener('click', () => openLightboxAt(i));

      grid.appendChild(plate);
    });
  }

  function openLightboxAt(index) {
    currentIndex = index;
    renderLightbox();
    lightbox.classList.add('open');
  }

  function renderLightbox() {
    if (currentIndex < 0 || currentIndex >= currentDisplay.length) return;
    const { entry, plateNumber } = currentDisplay[currentIndex];
    lightboxImg.src = '/api/image?id=' + entry.id;
    lightboxImg.alt = entry.caption || entry.filename || '';
    lightboxCaption.textContent = entry.caption || '';
    lightboxPosition.textContent = 'Planche ' + plateNumber + ' — ' + (currentIndex + 1) + ' / ' + currentDisplay.length;

    lightboxPrev.disabled = currentIndex <= 0;
    lightboxNext.disabled = currentIndex >= currentDisplay.length - 1;
  }

  function showPrev() {
    if (currentIndex > 0) { currentIndex--; renderLightbox(); }
  }

  function showNext() {
    if (currentIndex < currentDisplay.length - 1) { currentIndex++; renderLightbox(); }
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
  }

  lightboxClose.addEventListener('click', closeLightbox);
  lightboxPrev.addEventListener('click', showPrev);
  lightboxNext.addEventListener('click', showNext);
  readFromStartBtn.addEventListener('click', () => { if (currentDisplay.length > 0) openLightboxAt(0); });
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') showPrev();
    else if (e.key === 'ArrowRight') showNext();
  });

  load();
})();
