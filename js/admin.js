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

  const NEW_CAMPAIGN_VALUE = '__new__';

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

  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob(
          (blob) => {
            const reader2 = new FileReader();
            reader2.onload = () => {
              const base64 = reader2.result.split(',')[1];
              resolve({ base64, contentType: outType });
            };
            reader2.onerror = reject;
            reader2.readAsDataURL(blob);
          },
          outType,
          JPEG_QUALITY
        );
      };
      img.onerror = reject;
      reader.readAsDataURL(file);
    });
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
      const { base64, contentType } = await resizeImage(file);
      thumb.src = 'data:' + contentType + ';base64,' + base64;
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
      img.src = '/api/image?id=' + entry.id;
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
