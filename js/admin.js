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
  const campaignInput = document.getElementById('campaignInput');
  const campaignSuggestions = document.getElementById('campaignSuggestions');
  const manageList = document.getElementById('manageList');

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
          caption: '',
          campaign: campaignInput.value.trim(),
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

  function handleFiles(fileList) {
    Array.from(fileList)
      .filter((f) => f.type.startsWith('image/'))
      .forEach(uploadFile);
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

  async function loadManageList() {
    let entries = [];
    try {
      const res = await fetch('/api/list');
      entries = await res.json();
    } catch (e) {}

    manageList.innerHTML = '';

    const campaigns = new Set();
    entries.forEach((e) => { if (e.campaign) campaigns.add(e.campaign); });
    campaignSuggestions.innerHTML = '';
    Array.from(campaigns).sort((a, b) => a.localeCompare(b, 'fr')).forEach((camp) => {
      const opt = document.createElement('option');
      opt.value = camp;
      campaignSuggestions.appendChild(opt);
    });

    entries.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'manage-row';

      const img = document.createElement('img');
      img.src = '/api/image?id=' + entry.id;
      row.appendChild(img);

      const info = document.createElement('div');
      info.className = 'info';
      const cap = document.createElement('div');
      cap.className = 'cap';
      cap.textContent = entry.caption || entry.filename;
      info.appendChild(cap);
      const tags = document.createElement('div');
      tags.className = 'tags';
      const metaBits = [];
      if (entry.campaign) metaBits.push(entry.campaign);
      metaBits.push(...(entry.tags || []));
      tags.textContent = metaBits.join(' · ');
      info.appendChild(tags);
      row.appendChild(info);

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-ghost';
      delBtn.textContent = 'Retirer';
      delBtn.onclick = () => deleteEntry(entry.id);
      row.appendChild(delBtn);

      manageList.appendChild(row);
    });
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
