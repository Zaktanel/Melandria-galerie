(function () {
  const gate = document.getElementById('gate');
  const adminShell = document.getElementById('adminShell');
  const passwordInput = document.getElementById('passwordInput');
  const unlockBtn = document.getElementById('unlockBtn');
  const gateError = document.getElementById('gateError');

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const uploadQueue = document.getElementById('uploadQueue');
  const defaultTags = document.getElementById('defaultTags');
  const campaignSelect = document.getElementById('campaignSelect');
  const campaignNewInput = document.getElementById('campaignNewInput');
  const captionInput = document.getElementById('captionInput');
  const manageSearch = document.getElementById('manageSearch');
  const manageList = document.getElementById('manageList');
  const optimizeBtn = document.getElementById('optimizeBtn');
  const optimizeStatus = document.getElementById('optimizeStatus');

  const NEW_CAMPAIGN_VALUE = '__new__';

  // Construit l'URL d'une image en incluant son numéro de version (voir gallery.js).
  function imageUrl(entry, size) {
    let url = '/api/image?id=' + entry.id;
    if (size) url += '&size=' + size;
    const version = entry.imageVersion || entry.uploadedAt;
    if (version) url += '&v=' + encodeURIComponent(version);
    return url;
  }

  function wireCampaignSelect(selectEl, newInputEl) {
    selectEl.addEventListener('change', () => {
      if (selectEl.value === NEW_CAMPAIGN_VALUE) {
        newInputEl.style.display = 'block';
        newInputEl.value = '';
        newInputEl.focus();
      } else {
        newInputEl.style.display = 'none';
      }
    });
  }

  function refreshCampaignSelect(selectEl) {
    const previousValue = selectEl.value;
    const campaigns = new Set();
    managedEntries.forEach((e) => { if (e.campaign) campaigns.add(e.campaign); });
    const sorted = Array.from(campaigns).sort((a, b) => a.localeCompare(b, 'fr'));

    selectEl.innerHTML = '';
    const optNone = document.createElement('option');
    optNone.value = '';
    optNone.textContent = '(Aucune)';
    selectEl.appendChild(optNone);

    sorted.forEach((camp) => {
      const opt = document.createElement('option');
      opt.value = camp;
      opt.textContent = camp;
      selectEl.appendChild(opt);
    });

    const optNew = document.createElement('option');
    optNew.value = NEW_CAMPAIGN_VALUE;
    optNew.textContent = '+ Nouvelle campagne...';
    selectEl.appendChild(optNew);

    if (previousValue && (previousValue === NEW_CAMPAIGN_VALUE || sorted.includes(previousValue))) {
      selectEl.value = previousValue;
    } else {
      selectEl.value = '';
    }
  }

  function getCampaignValue(selectEl, newInputEl) {
    if (selectEl.value === NEW_CAMPAIGN_VALUE) {
      return newInputEl.value.trim();
    }
    return selectEl.value;
  }

  wireCampaignSelect(campaignSelect, campaignNewInput);

  const MAX_DIMENSION = 1920;
  const JPEG_QUALITY = 0.85;

  function getPassword() {
    return sessionStorage.getItem('adminPassword');
  }

  function setPassword(pw) {
    sessionStorage.setItem('adminPassword', pw);
  }

  async function tryUnlock(pw) {
    // On vérifie le mot de passe via un appel léger à /api/list-check en tentant un upload à vide
    // Plus simple : on le valide au premier vrai appel (upload/delete). On déverrouille l'UI directement.
    setPassword(pw);
    gate.style.display = 'none';
    adminShell.style.display = 'block';
    loadManageList();
  }

  unlockBtn.addEventListener('click', () => {
    const pw = passwordInput.value.trim();
    if (!pw) return;
    tryUnlock(pw);
  });
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') unlockBtn.click();
  });

  // Si un mot de passe est déjà en session, on tente directement
  if (getPassword()) {
    gate.style.display = 'none';
    adminShell.style.display = 'block';
    loadManageList();
  }

  function parseTags(str) {
    return (str || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  const THUMB_DIMENSION = 240;
  const THUMB_QUALITY = 0.7;

  // Charge un fichier dans un <img> une seule fois, réutilisé pour produire
  // la version complète ET la vignette sans redécoder le fichier deux fois.
  function loadImageElement(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.onerror = reject;
      img.onload = () => resolve(img);
      img.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function drawToJpeg(img, maxDimension, quality) {
    return new Promise((resolve, reject) => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        quality
      );
    });
  }

  // Produit systématiquement du JPEG (quel que soit le format d'origine),
  // en pleine résolution ET en vignette légère.
  async function resizeImage(file) {
    const img = await loadImageElement(file);
    const [fullBase64, thumbBase64] = await Promise.all([
      drawToJpeg(img, MAX_DIMENSION, JPEG_QUALITY),
      drawToJpeg(img, THUMB_DIMENSION, THUMB_QUALITY),
    ]);
    return {
      base64: fullBase64,
      contentType: 'image/jpeg',
      thumbBase64,
      thumbContentType: 'image/jpeg',
    };
  }

  async function uploadFile(file) {
    const row = document.createElement('div');
    row.className = 'upload-item';
    const thumb = document.createElement('img');
    row.appendChild(thumb);
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = file.name;
    row.appendChild(name);
    const status = document.createElement('div');
    status.className = 'status pending';
    status.textContent = 'Traitement…';
    row.appendChild(status);
    uploadQueue.prepend(row);

    try {
      const { base64, contentType, thumbBase64, thumbContentType } = await resizeImage(file);
      thumb.src = 'data:' + thumbContentType + ';base64,' + thumbBase64;
      status.textContent = 'Envoi…';

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-password': getPassword(),
        },
        body: JSON.stringify({
          filename: file.name,
          contentType,
          dataBase64: base64,
          thumbContentType,
          thumbDataBase64: thumbBase64,
          tags: parseTags(defaultTags.value),
          caption: captionInput.value.trim(),
          campaign: getCampaignValue(campaignSelect, campaignNewInput),
        }),
      });

      if (res.status === 401) {
        status.textContent = 'Mot de passe refusé';
        status.className = 'status error';
        sessionStorage.removeItem('adminPassword');
        setTimeout(() => location.reload(), 1200);
        return;
      }

      const data = await res.json();
      if (data.success) {
        status.textContent = 'Déposé ✓';
        status.className = 'status done';
        loadManageList();
      } else {
        status.textContent = data.error || 'Échec';
        status.className = 'status error';
      }
    } catch (e) {
      status.textContent = 'Échec';
      status.className = 'status error';
    }
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    for (const file of files) {
      await uploadFile(file);
    }
  }

  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

  ['dragenter', 'dragover'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    })
  );
  dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  });

  let managedEntries = [];

  async function loadManageList() {
    try {
      const res = await fetch('/api/list');
      managedEntries = await res.json();
    } catch (e) {
      managedEntries = [];
    }

    refreshCampaignSelect(campaignSelect);
    renderManageList();
    updateOptimizeStatus();
  }

  function matchesSearch(entry, query) {
    if (!query) return true;
    const haystack = [
      entry.filename || '',
      entry.caption || '',
      entry.campaign || '',
      ...(entry.tags || []),
    ].join(' ').toLowerCase();
    return haystack.includes(query.toLowerCase());
  }

  function renderManageList() {
    manageList.innerHTML = '';
    const query = manageSearch.value.trim();
    const visibleEntries = managedEntries.filter((e) => matchesSearch(e, query));

    if (visibleEntries.length === 0) {
      const empty = document.createElement('p');
      empty.style.color = 'var(--text-muted)';
      empty.style.fontFamily = 'var(--font-mono)';
      empty.style.fontSize = '0.8rem';
      empty.textContent = managedEntries.length === 0
        ? 'Aucune illustration déposée pour l\'instant.'
        : 'Aucun résultat pour cette recherche.';
      manageList.appendChild(empty);
      return;
    }

    visibleEntries.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'manage-row';

      const img = document.createElement('img');
      img.src = imageUrl(entry, 'thumb');
      row.appendChild(img);

      const info = document.createElement('div');
      info.className = 'info';

      const filenameLabel = document.createElement('div');
      filenameLabel.className = 'tags';
      filenameLabel.textContent = entry.filename;
      info.appendChild(filenameLabel);

      const campaignEditSelect = document.createElement('select');
      campaignEditSelect.className = 'tags-edit-input';
      const campaignEditNewInput = document.createElement('input');
      campaignEditNewInput.type = 'text';
      campaignEditNewInput.className = 'tags-edit-input';
      campaignEditNewInput.placeholder = 'Nom de la nouvelle campagne';
      campaignEditNewInput.style.display = 'none';
      wireCampaignSelect(campaignEditSelect, campaignEditNewInput);
      refreshCampaignSelect(campaignEditSelect);
      campaignEditSelect.value = entry.campaign || '';
      info.appendChild(campaignEditSelect);
      info.appendChild(campaignEditNewInput);

      const captionEdit = document.createElement('input');
      captionEdit.type = 'text';
      captionEdit.className = 'tags-edit-input';
      captionEdit.value = entry.caption || '';
      captionEdit.placeholder = 'Légende (optionnel)';
      info.appendChild(captionEdit);

      const tagsEdit = document.createElement('input');
      tagsEdit.type = 'text';
      tagsEdit.className = 'tags-edit-input';
      tagsEdit.value = (entry.tags || []).join(', ');
      tagsEdit.placeholder = 'Catégorie: Valeur, Catégorie: Valeur...';
      info.appendChild(tagsEdit);
      row.appendChild(info);

      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn-ghost';
      saveBtn.textContent = 'Enregistrer';
      saveBtn.onclick = () => saveMetadata(entry.id, tagsEdit, captionEdit, campaignEditSelect, campaignEditNewInput, saveBtn);
      row.appendChild(saveBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-ghost';
      delBtn.textContent = 'Retirer';
      delBtn.onclick = () => deleteEntry(entry.id);
      row.appendChild(delBtn);

      manageList.appendChild(row);
    });
  }

  manageSearch.addEventListener('input', renderManageList);

  async function saveMetadata(id, tagsInput, captionInput, campaignSelectEl, campaignNewInputEl, button) {
    const originalLabel = button.textContent;
    button.textContent = 'Enregistrement…';
    button.disabled = true;
    try {
      const res = await fetch('/api/update', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-password': getPassword(),
        },
        body: JSON.stringify({
          id,
          tags: parseTags(tagsInput.value),
          caption: captionInput.value.trim(),
          campaign: getCampaignValue(campaignSelectEl, campaignNewInputEl),
        }),
      });
      if (res.status === 401) {
        sessionStorage.removeItem('adminPassword');
        location.reload();
        return;
      }
      const data = await res.json();
      if (data.success) {
        button.textContent = 'Enregistré ✓';
        setTimeout(() => { button.textContent = originalLabel; button.disabled = false; }, 1500);
      } else {
        button.textContent = 'Échec';
        button.disabled = false;
      }
    } catch (e) {
      button.textContent = 'Échec';
      button.disabled = false;
    }
  }

  function updateOptimizeStatus() {
    const remaining = managedEntries.filter((e) => e.contentType !== 'image/jpeg').length;
    optimizeStatus.textContent = remaining > 0
      ? `${remaining} image(s) restent à optimiser.`
      : 'Toutes les images sont déjà optimisées.';
  }

  function loadImageFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function optimizeEntry(entry) {
    const imgRes = await fetch(imageUrl(entry), { cache: 'no-store' });
    const blob = await imgRes.blob();
    const img = await loadImageFromBlob(blob);
    const [fullBase64, thumbBase64] = await Promise.all([
      drawToJpeg(img, MAX_DIMENSION, JPEG_QUALITY),
      drawToJpeg(img, THUMB_DIMENSION, THUMB_QUALITY),
    ]);

    const res = await fetch('/api/reencode-image', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-password': getPassword(),
      },
      body: JSON.stringify({
        id: entry.id,
        contentType: 'image/jpeg',
        dataBase64: fullBase64,
        thumbContentType: 'image/jpeg',
        thumbDataBase64: thumbBase64,
      }),
    });

    if (res.status === 401) {
      const err = new Error('unauthorized');
      err.code = 'unauthorized';
      throw err;
    }
    const data = await res.json();
    return !!data.success;
  }

  optimizeBtn.addEventListener('click', async () => {
    const toProcess = managedEntries.filter((e) => e.contentType !== 'image/jpeg');
    if (toProcess.length === 0) {
      optimizeStatus.textContent = 'Toutes les images sont déjà optimisées.';
      return;
    }

    optimizeBtn.disabled = true;
    let done = 0;
    let failed = 0;

    for (const entry of toProcess) {
      optimizeStatus.textContent = `Optimisation en cours… ${done + failed} / ${toProcess.length}`;
      try {
        const ok = await optimizeEntry(entry);
        if (ok) done++; else failed++;
      } catch (e) {
        if (e.code === 'unauthorized') {
          sessionStorage.removeItem('adminPassword');
          location.reload();
          return;
        }
        failed++;
      }
    }

    optimizeStatus.textContent = `Terminé : ${done} image(s) optimisée(s)` + (failed ? `, ${failed} en échec.` : '.');
    optimizeBtn.disabled = false;
    loadManageList();
  });

  async function deleteEntry(id) {
    if (!confirm('Retirer définitivement cette illustration ?')) return;
    const res = await fetch('/api/delete', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-password': getPassword(),
      },
      body: JSON.stringify({ id }),
    });
    if (res.status === 401) {
      sessionStorage.removeItem('adminPassword');
      location.reload();
      return;
    }
    loadManageList();
  }
})();
