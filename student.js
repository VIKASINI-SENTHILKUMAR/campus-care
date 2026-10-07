document.addEventListener('DOMContentLoaded', () => {
  let user = window.CampusCare.currentUser();

  if (!user || user.role !== 'student') {
    alert('Please log in as a student');
    window.location.href = 'index.html';
    return;
  }

  const listEl = document.getElementById('issues-list');
  const form = document.getElementById('issue-form');

  const titleSelect = document.getElementById('issue-title');
  const titleOther = document.getElementById('issue-title-other');

  const locationType = document.getElementById('location-type');
  const blockLocationRow = document.getElementById('block-location-row');
  const campusLocationRow = document.getElementById('campus-location-row');

  const blockSelect = document.getElementById('issue-block');
  const roomSelect = document.getElementById('issue-room');
  const campusLocation = document.getElementById('campus-location');
  const locationInput = document.getElementById('issue-location');

  const fileInput = document.getElementById('issue-image');
  const reporterVerify = document.getElementById('photo-verify-reporter');
  const previewEl = document.getElementById('photo-preview');
  const aiCheckBtn = document.getElementById('student-ai-check');
  const aiStatusEl = document.getElementById('student-ai-status');
  const submitIssueBtn = document.getElementById('submit-issue-btn');
  const blockedMessage = document.getElementById('blocked-message');

  const profilePhotoInput = document.getElementById('profile-photo-input');
  const profilePhotoPreview = document.getElementById('profile-photo-preview');
  const profilePhotoPreviewLarge = document.getElementById('profile-photo-preview-large');
  const sideStudentName = document.getElementById('side-student-name');

  const rooms = [
    'Classroom 101',
    'Classroom 102',
    'Classroom 103',
    'Classroom 201',
    'Classroom 202',
    'Classroom 203',
    'Restroom 1',
    'Restroom 2'
  ];

  const navButtons = document.querySelectorAll('.nav-btn[data-section]');
  const profileNav = document.querySelector('.nav-profile');
  const sections = document.querySelectorAll('.page-section');

  function showSection(sectionId) {
    navButtons.forEach(b => b.classList.remove('active'));
    sections.forEach(section => section.classList.remove('active-section'));

    const target = document.getElementById(sectionId);
    if (target) target.classList.add('active-section');

    const activeBtn = document.querySelector(`.nav-btn[data-section="${sectionId}"]`);
    if (activeBtn) activeBtn.classList.add('active');
  }

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      showSection(btn.dataset.section);
    });
  });

  if (profileNav) {
    profileNav.addEventListener('click', e => {
      if (e.target.id === 'profile-photo-input') return;
      showSection('profile-section');
    });
  }

  const profileLogout = document.getElementById('profile-logout');
  if (profileLogout) {
    profileLogout.addEventListener('click', () => window.CampusCare.logout());
  }

  function loadProfilePhoto() {
    const savedPhoto = localStorage.getItem('profile_photo_' + user.username);

    if (savedPhoto) {
      if (profilePhotoPreview) profilePhotoPreview.src = savedPhoto;
      if (profilePhotoPreviewLarge) profilePhotoPreviewLarge.src = savedPhoto;
    }
  }

  if (profilePhotoInput) {
    loadProfilePhoto();

    profilePhotoInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = () => {
        localStorage.setItem('profile_photo_' + user.username, reader.result);

        if (profilePhotoPreview) profilePhotoPreview.src = reader.result;
        if (profilePhotoPreviewLarge) profilePhotoPreviewLarge.src = reader.result;
      };

      reader.readAsDataURL(file);
    });
  }

  if (user.blocked) {
    if (blockedMessage) blockedMessage.classList.remove('hidden');

    const reasonEl = document.getElementById('student-block-reason');
    if (reasonEl && user.blockReason) {
      reasonEl.textContent = 'Reason: ' + user.blockReason;
      reasonEl.classList.remove('hidden');
    }

    if (form) {
      form.querySelectorAll('input, textarea, select, button').forEach(el => {
        el.disabled = true;
      });
    }

    render();
    renderProfile();
    return;
  }

  if (titleSelect && titleOther) {
    titleSelect.addEventListener('change', () => {
      if (titleSelect.value === 'Other') {
        titleOther.classList.remove('hidden');
        titleOther.required = true;
      } else {
        titleOther.classList.add('hidden');
        titleOther.required = false;
        titleOther.value = '';
      }
    });
  }

  if (locationType) {
    locationType.addEventListener('change', () => {
      locationInput.value = '';

      if (locationType.value === 'block') {
        blockLocationRow.classList.remove('hidden');
        campusLocationRow.classList.add('hidden');

        blockSelect.required = true;
        roomSelect.required = true;
        campusLocation.required = false;

        campusLocation.value = '';
      } else if (locationType.value === 'campus') {
        campusLocationRow.classList.remove('hidden');
        blockLocationRow.classList.add('hidden');

        campusLocation.required = true;
        blockSelect.required = false;
        roomSelect.required = false;

        blockSelect.value = '';
        roomSelect.innerHTML = '<option value="">Select block first</option>';
        roomSelect.disabled = true;
      } else {
        blockLocationRow.classList.add('hidden');
        campusLocationRow.classList.add('hidden');

        blockSelect.required = false;
        roomSelect.required = false;
        campusLocation.required = false;
      }
    });
  }

  if (blockSelect && roomSelect && locationInput) {
    blockSelect.addEventListener('change', () => {
      const block = blockSelect.value;

      roomSelect.innerHTML = '<option value="">Select Classroom / Restroom</option>';

      if (!block) {
        roomSelect.disabled = true;
        locationInput.value = '';
        return;
      }

      rooms.forEach(room => {
        const option = document.createElement('option');
        option.value = room;
        option.textContent = room;
        roomSelect.appendChild(option);
      });

      roomSelect.disabled = false;
      locationInput.value = '';
    });

    roomSelect.addEventListener('change', () => {
      if (blockSelect.value && roomSelect.value) {
        locationInput.value = `${blockSelect.value} - ${roomSelect.value}`;
      } else {
        locationInput.value = '';
      }
    });
  }

  if (campusLocation) {
    campusLocation.addEventListener('change', () => {
      locationInput.value = campusLocation.value || '';
    });
  }

  let selectedFiles = [];
  let aiPhotoChecks = [];
  let aiCheckSignature = '';

  function currentPhotoSignature() {
    return selectedFiles.map(f => `${f.name}:${f.size}:${f.lastModified}`).join('|');
  }

  function resetStudentAiCheck() {
    aiPhotoChecks = [];
    aiCheckSignature = '';
    if (aiStatusEl) aiStatusEl.innerHTML = '<p class="muted-text">AI check pending.</p>';
  }

  function renderStudentAiResults(results) {
    if (!aiStatusEl) return;
    if (!results || !results.length) {
      aiStatusEl.innerHTML = '<p class="muted-text">Upload photos and click AI Check Photos.</p>';
      return;
    }
    const allValid = results.every(r => r.valid);
    aiStatusEl.innerHTML = `
      <div class="ai-photo-result ${allValid ? 'valid' : 'invalid'}">
        <strong>${allValid ? 'All photos passed AI check ✅' : 'Some photos failed AI check ❌'}</strong>
        <p>${allValid ? 'You can submit the complaint now.' : 'Remove or replace invalid photos before submitting.'}</p>
      </div>
      ${results.map((r, index) => `
        <div class="ai-photo-result ${r.valid ? 'valid' : 'invalid'}">
          <strong>Photo ${index + 1}: ${r.valid ? 'Related ✅' : 'Unrelated ❌'}</strong>
          <p><b>Category:</b> ${escapeHtml(r.detectedCategory || 'General')} • <b>Confidence:</b> ${escapeHtml(String(r.confidence || 0))}%</p>
          <p>${escapeHtml(r.reason || 'AI check completed.')}</p>
        </div>
      `).join('')}
    `;
  }

  if (fileInput) {
    fileInput.addEventListener('change', e => {
      const files = Array.from(e.target.files || []);

      if (files.length === 0) return;

      const remaining = 5 - selectedFiles.length;

      if (remaining <= 0) {
        alert('You have reached the maximum of 5 photos');
        fileInput.value = '';
        return;
      }

      if (files.length > remaining) {
        alert(`Only ${remaining} more photo(s) can be added`);
        files.splice(remaining);
      }

      selectedFiles = selectedFiles.concat(files);
      resetStudentAiCheck();
      renderPreview();
      fileInput.value = '';
    });
  }

  if (previewEl) {
    previewEl.addEventListener('click', e => {
      if (!e.target.matches('.remove-photo')) return;

      const index = Number(e.target.dataset.index);
      selectedFiles.splice(index, 1);
      resetStudentAiCheck();
      renderPreview();
    });
  }

  function renderPreview() {
    if (!previewEl) return;

    if (selectedFiles.length === 0) {
      previewEl.innerHTML = '';
      return;
    }

    previewEl.innerHTML = selectedFiles.map((file, index) => {
      const url = URL.createObjectURL(file);

      return `
        <div class="preview-item">
          <img src="${url}" alt="${escapeHtml(file.name)}">
          <div style="padding:8px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <small>${escapeHtml(file.name)}</small>
            <button type="button" class="btn ghost remove-photo" data-index="${index}">
              Remove
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function compressImage(file, maxSize = 700, quality = 0.55) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const img = new Image();

        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            } else {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          resolve(canvas.toDataURL(mime, quality));
        };

        img.onerror = () => reject(new Error('Invalid image file'));
        img.src = reader.result;
      };

      reader.onerror = () => reject(reader.error || new Error('File read error'));
      reader.readAsDataURL(file);
    });
  }


  function countBy(items, getter) {
    return items.reduce((acc, item) => {
      const key = getter(item) || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  function renderMiniBars(elId, counts, options = {}) {
    const el = document.getElementById(elId);
    if (!el) return;
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...entries.map(([, v]) => v));
    el.innerHTML = entries.length ? entries.map(([label, value], index) => `
      <button class="mini-bar-row clickable-row" type="button" data-${options.type || 'filter'}="${escapeHtml(label)}" style="--bar-index:${index}">
        <span class="mini-bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
        <span class="mini-bar-track"><span class="mini-bar-fill" style="width:${Math.round((value / max) * 100)}%"></span></span>
        <strong>${value}</strong>
      </button>
    `).join('') : '<div class="mini-empty">No data yet</div>';
  }

  function openComplaintsFromDashboard(filter = {}) {
    showSection('complaints-section');
    const cards = [...document.querySelectorAll('#issues-list .issue')];
    cards.forEach(card => card.classList.remove('highlight-issue'));
    if (filter.id) {
      const target = document.querySelector(`#issues-list .issue[data-id="${CSS.escape(filter.id)}"]`);
      if (target) {
        target.classList.add('highlight-issue');
        setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
      }
      return;
    }
    const issues = window.CampusCare.getIssues().filter(i => i.reporter === user.username);
    let first = issues.find(i => {
      if (filter.status && i.status !== filter.status) return false;
      if (filter.category && (i.category || 'General') !== filter.category) return false;
      return true;
    });
    if (first) {
      const target = document.querySelector(`#issues-list .issue[data-id="${CSS.escape(first.id)}"]`);
      if (target) {
        target.classList.add('highlight-issue');
        setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
      }
    }
  }

  function renderRecentStudentComplaints(issues) {
    const el = document.getElementById('student-recent-complaints');
    if (!el) return;
    const recent = [...issues].sort((a,b)=> new Date(b.updated || b.created || 0) - new Date(a.updated || a.created || 0)).slice(0,5);
    el.innerHTML = recent.length ? recent.map(i => `
      <button class="recent-item" type="button" data-id="${escapeHtml(i.id)}">
        <span><b>${escapeHtml(i.title || 'Untitled')}</b><small>${escapeHtml(i.location || 'Unknown location')}</small></span>
        <em class="status-badge ${getStatusClass(i.status)}">${escapeHtml(i.status || 'Open')}</em>
      </button>
    `).join('') : '<div class="mini-empty">No recent complaints yet</div>';
  }

  function renderStudentReport(issues) {
    const total = issues.length;
    const progress = issues.filter(i => i.status === 'In Progress').length;
    const resolved = issues.filter(i => i.status === 'Resolved').length;
    const topCategory = Object.entries(countBy(issues, i => i.category || 'General')).sort((a,b)=>b[1]-a[1])[0];
    setText('student-report-title', total ? `${total} complaint${total === 1 ? '' : 's'} tracked` : 'No complaints yet');
    setText('student-report-summary', total ? `${progress} in progress, ${resolved} resolved. Most reported type: ${topCategory ? topCategory[0] : 'None'}.` : 'Submit your first complaint to see analytics.');
  }

  function render() {
    const issues = window.CampusCare
      .getIssues()
      .filter(i => i.reporter === user.username);

    setText('stat-total', issues.length);
    setText('stat-new', issues.filter(i => i.status === 'Open').length);
    setText('stat-progress', issues.filter(i => i.status === 'In Progress').length);
    setText('stat-completed', issues.filter(i => i.status === 'Resolved').length);
    renderMiniBars('student-status-chart', countBy(issues, i => i.status || 'Open'), { type: 'status' });
    renderMiniBars('student-category-chart', countBy(issues, i => i.category || 'General'), { type: 'category' });
    renderRecentStudentComplaints(issues);
    renderStudentReport(issues);

    if (!listEl) return;

    listEl.innerHTML = issues.map(i => {
      const photos = (i.photos || [])
        .map(p => `<img class="thumb" src="${p}" alt="photo">`)
        .join('');

      const reporterBadge = i.photoVerifiedByReporter
        ? '<span class="badge verified">Reporter Verified ✅</span>'
        : '';

      const adminBadge = i.photoVerifiedByAdmin
        ? '<span class="badge verified-admin">Photo Verified ✅</span>'
        : '';

      const photoRejected = i.photoRejectedByAdmin
        ? '<span class="badge rejected">Photo Rejected ❌</span>'
        : '';

      const adminComment = i.adminComment
        ? `
          <div class="admin-comment-box">
            <strong>Admin Comment:</strong>
            <p>${escapeHtml(i.adminComment)}</p>
          </div>
        `
        : '';

      const rejectReason = i.rejectReason
        ? `
          <div class="rejected-box">
            <strong>Reject Reason:</strong>
            <p>${escapeHtml(i.rejectReason)}</p>
          </div>
        `
        : '';

      const reopenButton = i.status === 'Resolved'
        ? `
          <button class="btn ghost btn-student-reopen" data-id="${escapeHtml(i.id)}">
            Reopen Request
          </button>
        `
        : '';

      const editButton = i.status === 'Open'
        ? `
          <button class="btn ghost btn-edit-issue" data-id="${escapeHtml(i.id)}">
            Edit Complaint / Add Photos
          </button>
        `
        : '';

      return `
        <div class="issue" data-id="${escapeHtml(i.id)}">
          <div class="photos">
            ${photos || '<div class="no-photo">No Image Uploaded</div>'}
          </div>

          <div class="meta">
            <b>${escapeHtml(i.title)}</b>

            ${reporterBadge}
            ${adminBadge}
            ${photoRejected}

            <div class="badge-row">
              <span class="cat-badge">${escapeHtml(i.category || 'General')}</span>
              <span class="status-badge ${getStatusClass(i.status)}">${escapeHtml(i.status || 'Open')}</span>
            </div>

            <small>
              ${escapeHtml(i.location || 'Unknown location')}
              •
              ${new Date(i.created || Date.now()).toLocaleString()}
            </small>

            <p>${escapeHtml(i.description)}</p>

            ${adminComment}
            ${rejectReason}

            <div class="issue-actions">
              ${editButton}
              ${reopenButton}
            </div>
          </div>
        </div>
      `;
    }).join('') || '<div class="muted">No reports yet</div>';

    renderProfile();
  }


  async function runStudentAiCheck() {
    const title = titleSelect.value.trim() === 'Other' ? titleOther.value.trim() : titleSelect.value.trim();
    const description = document.getElementById('issue-desc').value.trim();
    const category = document.getElementById('issue-category').value.trim();
    const location = locationInput.value.trim();

    if (!selectedFiles.length) {
      alert('Please upload at least one complaint photo for AI checking.');
      return;
    }

    if (!title || !description || !category || !location) {
      alert('Please fill category, issue type, description and location before AI checking.');
      return;
    }

    const oldText = aiCheckBtn ? aiCheckBtn.textContent : '';
    try {
      if (aiCheckBtn) {
        aiCheckBtn.disabled = true;
        aiCheckBtn.textContent = 'Checking photos...';
      }
      if (aiStatusEl) aiStatusEl.innerHTML = '<p class="muted-text">AI is checking all photos. Please wait...</p>';

      const compressed = await Promise.all(selectedFiles.slice(0, 5).map(f => compressImage(f, 700, 0.55)));
      const results = [];

      for (const imageData of compressed) {
        const response = await fetch('/api/verify-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData, title, description, category, location })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || 'AI photo check failed.');
        results.push({
          ...data.result,
          checkedAt: Date.now()
        });
      }

      aiPhotoChecks = results;
      aiCheckSignature = currentPhotoSignature();
      renderStudentAiResults(results);
    } catch (error) {
      aiPhotoChecks = [];
      aiCheckSignature = '';
      if (aiStatusEl) aiStatusEl.innerHTML = `<div class="ai-photo-result invalid"><strong>AI check failed</strong><p>${escapeHtml(error.message || 'Try again.')}</p></div>`;
      alert(error.message || 'AI photo check failed.');
    } finally {
      if (aiCheckBtn) {
        aiCheckBtn.disabled = false;
        aiCheckBtn.textContent = oldText || '🤖 AI Check Photos';
      }
    }
  }

  if (aiCheckBtn) {
    aiCheckBtn.addEventListener('click', runStudentAiCheck);
    renderStudentAiResults([]);
  }

  if (form) {
    form.addEventListener('submit', async e => {
      try {
        e.preventDefault();

        const rawTitle = titleSelect.value.trim();

        const title = rawTitle === 'Other'
          ? titleOther.value.trim()
          : rawTitle;

        const desc = document.getElementById('issue-desc').value.trim();
        const category = document.getElementById('issue-category').value.trim();
        const location = locationInput.value.trim();

        if (!title || !desc || !category || !location) {
          alert('Please fill all required fields');
          return;
        }

        const allIssues = window.CampusCare.getIssues();

        const duplicate = allIssues.find(i =>
          String(i.title || '').toLowerCase() === title.toLowerCase() &&
          String(i.location || '').toLowerCase() === location.toLowerCase() &&
          i.status !== 'Resolved' &&
          i.status !== 'Rejected'
        );

        if (duplicate) {
          alert('This issue has already been reported for this location and is being processed.');
          return;
        }

        if (!selectedFiles.length) {
          alert('Please upload at least one complaint photo.');
          return;
        }

        if (!aiPhotoChecks.length || aiCheckSignature !== currentPhotoSignature()) {
          alert('Please click AI Check Photos after selecting the final photos.');
          return;
        }

        if (aiPhotoChecks.some(r => !r.valid)) {
          alert('One or more photos are unrelated. Remove/replace invalid photos and run AI Check Photos again.');
          return;
        }

        try {
          const results = await Promise.all(selectedFiles.slice(0, 5).map(f => compressImage(f, 700, 0.55)));
          saveIssue(results);
        } catch (err) {
          console.error(err);
          alert('Error reading files: ' + err.message);
        }

      } catch (err) {
        console.error('Submit error', err);
        alert('Submit failed: ' + (err && err.message ? err.message : String(err)));
      }
    });
  }

  function saveIssue(base64) {
    const rawTitle = titleSelect.value.trim();

    const issue = {
      id: 'i_' + Date.now(),
      title: rawTitle === 'Other' ? titleOther.value.trim() : rawTitle,
      description: document.getElementById('issue-desc').value.trim(),
      category: document.getElementById('issue-category').value.trim(),
      photos: Array.isArray(base64) ? base64 : [],
      reporter: user.username,
      status: 'Open',
      location: locationInput.value.trim(),
      photoVerifiedByReporter: !!reporterVerify.checked,
      photoVerifiedByAdmin: false,
      photoRejectedByAdmin: false,
      aiVerification: {
        source: 'student',
        allPhotosValid: true,
        photos: aiPhotoChecks,
        checkedAt: Date.now()
      },
      adminComment: '',
      rejectReason: '',
      reopened: false,
      reopenNotification: false,
      reopenMessage: '',
      created: Date.now(),
      history: [
        {
          status: 'Open',
          date: Date.now()
        }
      ]
    };

    const removed = window.CampusCare.addIssue(issue);

    form.reset();
    selectedFiles = [];
    aiPhotoChecks = [];
    aiCheckSignature = '';
    previewEl.innerHTML = '';
    renderStudentAiResults([]);

    titleOther.classList.add('hidden');
    titleOther.required = false;

    blockLocationRow.classList.add('hidden');
    campusLocationRow.classList.add('hidden');

    roomSelect.innerHTML = '<option value="">Select block first</option>';
    roomSelect.disabled = true;

    locationInput.value = '';
    reporterVerify.checked = false;

    if (removed) {
      alert(`Issue submitted successfully! ${removed} older report${removed === 1 ? '' : 's'} were removed to free storage.`);
    } else {
      alert('Issue submitted successfully!');
    }

    render();
    renderProfile();
  }

  if (listEl) {
    listEl.addEventListener('click', e => {
      if (e.target.matches('.btn-student-reopen')) {
        const id = e.target.dataset.id;

        window.CampusCare.updateIssue(id, {
          status: 'Open',
          reopened: true,
          reopenNotification: true,
          reopenMessage: 'Student reopened this complaint. Please review again.',
          reopenedAt: Date.now()
        });

        alert('Request reopened and sent back to admin');
        render();
        renderProfile();
      }

      if (e.target.matches('.btn-edit-issue')) {
        const id = e.target.dataset.id;
        openEditIssueModal(id);
      }
    });
  }


  function openEditIssueModal(id) {
    const issues = window.CampusCare.getIssues();
    const issue = issues.find(i => i.id === id);

    if (!issue) return;

    const issueTypes = [
      'Fan not working',
      'Light not working',
      'Switch board issue',
      'Water leak',
      'Tap not working',
      'Restroom issue',
      'Dirty classroom',
      'Dustbin full',
      'Broken bench / desk',
      'Door / window damage',
      'Security concern',
      'Other'
    ];
    const isKnownIssueType = issueTypes.includes(issue.title);

    const existingPhotos = Array.isArray(issue.photos) ? [...issue.photos] : [];
    let newFiles = [];

    const overlay = document.createElement('div');
    overlay.className = 'edit-issue-overlay';

    overlay.innerHTML = `
      <div class="edit-issue-modal" role="dialog" aria-modal="true">
        <div class="edit-modal-header">
          <div>
            <h2>Edit Complaint</h2>
            <p>Remove wrong photos, add new photos, and update the complaint details.</p>
          </div>
          <button type="button" class="modal-x edit-close" aria-label="Close">×</button>
        </div>

        <label>
          Issue Type
          <select id="edit-issue-title">
            <option value="">Select Issue</option>
            ${issueTypes.map(type => `
              <option value="${escapeAttribute(type)}" ${type === issue.title || (!isKnownIssueType && type === 'Other') ? 'selected' : ''}>${escapeHtml(type)}</option>
            `).join('')}
          </select>
        </label>

        <input
          id="edit-issue-title-other"
          class="${isKnownIssueType ? 'hidden' : ''}"
          placeholder="Type the issue name here"
          value="${escapeAttribute(isKnownIssueType ? '' : (issue.title || ''))}">

        <label>
          Category
          <select id="edit-issue-category">
            ${['Electrical', 'Plumbing', 'Sanitation', 'Security', 'Infrastructure', 'Other'].map(cat => `
              <option ${cat === issue.category ? 'selected' : ''}>${cat}</option>
            `).join('')}
          </select>
        </label>

        <label>
          Location
          <input id="edit-issue-location" value="${escapeAttribute(issue.location || '')}" />
        </label>

        <label>
          Description
          <textarea id="edit-issue-desc" rows="4">${escapeHtml(issue.description || '')}</textarea>
        </label>

        <div class="edit-photo-topbar">
          <strong>Photos</strong>
          <span id="edit-photo-count"></span>
        </div>

        <div id="edit-existing-photos" class="edit-photo-grid"></div>
        <div id="edit-new-photos" class="edit-photo-grid"></div>

        <label class="edit-add-photo-box">
          + Add Photos
          <input id="edit-add-photo-input" type="file" accept="image/*" multiple hidden>
        </label>

        <p class="muted small-note">Maximum 5 photos allowed. Removing an existing photo will create space for a new one.</p>

        <div class="edit-modal-actions">
          <button type="button" class="btn ghost edit-close">Cancel</button>
          <button type="button" class="btn" id="save-edit-issue">Save Changes</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const existingWrap = overlay.querySelector('#edit-existing-photos');
    const newWrap = overlay.querySelector('#edit-new-photos');
    const filePicker = overlay.querySelector('#edit-add-photo-input');
    const countEl = overlay.querySelector('#edit-photo-count');
    const editTitleSelect = overlay.querySelector('#edit-issue-title');
    const editTitleOther = overlay.querySelector('#edit-issue-title-other');

    if (editTitleSelect && editTitleOther) {
      editTitleSelect.addEventListener('change', () => {
        if (editTitleSelect.value === 'Other') {
          editTitleOther.classList.remove('hidden');
          editTitleOther.required = true;
          editTitleOther.focus();
        } else {
          editTitleOther.classList.add('hidden');
          editTitleOther.required = false;
          editTitleOther.value = '';
        }
      });
    }

    function closeModal() {
      overlay.remove();
    }

    function totalPhotos() {
      return existingPhotos.length + newFiles.length;
    }

    function renderEditPhotos() {
      countEl.textContent = `${totalPhotos()} / 5 selected`;

      existingWrap.innerHTML = existingPhotos.map((photo, index) => `
        <div class="edit-photo-card">
          <img src="${photo}" alt="Existing complaint photo ${index + 1}">
          <button type="button" class="remove-existing-photo" data-index="${index}">Remove</button>
        </div>
      `).join('') || '<div class="no-photo small-no-photo">No old photos</div>';

      newWrap.innerHTML = newFiles.map((file, index) => {
        const url = URL.createObjectURL(file);
        return `
          <div class="edit-photo-card">
            <img src="${url}" alt="New complaint photo ${index + 1}">
            <button type="button" class="remove-new-photo" data-index="${index}">Remove</button>
          </div>
        `;
      }).join('');
    }

    overlay.addEventListener('click', e => {
      if (e.target === overlay || e.target.matches('.edit-close')) {
        closeModal();
        return;
      }

      if (e.target.matches('.remove-existing-photo')) {
        const index = Number(e.target.dataset.index);
        const ok = confirm('Remove this photo from the complaint?');
        if (!ok) return;
        existingPhotos.splice(index, 1);
        renderEditPhotos();
        return;
      }

      if (e.target.matches('.remove-new-photo')) {
        const index = Number(e.target.dataset.index);
        newFiles.splice(index, 1);
        renderEditPhotos();
      }
    });

    filePicker.addEventListener('change', () => {
      const files = Array.from(filePicker.files || []);
      const remaining = 5 - totalPhotos();

      if (remaining <= 0) {
        alert('Maximum 5 photos already selected. Remove one photo before adding another.');
        filePicker.value = '';
        return;
      }

      if (files.length > remaining) {
        alert(`Only ${remaining} more photo(s) can be added.`);
      }

      newFiles = newFiles.concat(files.slice(0, remaining));
      filePicker.value = '';
      renderEditPhotos();
    });

    overlay.querySelector('#save-edit-issue').addEventListener('click', async () => {
      const selectedTitle = overlay.querySelector('#edit-issue-title').value.trim();
      const title = selectedTitle === 'Other'
        ? overlay.querySelector('#edit-issue-title-other').value.trim()
        : selectedTitle;
      const category = overlay.querySelector('#edit-issue-category').value.trim();
      const location = overlay.querySelector('#edit-issue-location').value.trim();
      const description = overlay.querySelector('#edit-issue-desc').value.trim();

      if (!title || !category || !location || !description) {
        alert('Please fill issue type, category, location, and description.');
        return;
      }

      try {
        const compressedNewPhotos = await Promise.all(
          newFiles.map(file => compressImage(file, 700, 0.55))
        );

        window.CampusCare.updateIssue(id, {
          title,
          category,
          location,
          description,
          photos: existingPhotos.concat(compressedNewPhotos),
          photoVerifiedByReporter: totalPhotos() > 0 ? true : !!issue.photoVerifiedByReporter,
          photoVerifiedByAdmin: false,
          photoRejectedByAdmin: false,
          editedAt: Date.now()
        });

        alert('Complaint updated successfully');
        closeModal();
        render();
      } catch (err) {
        console.error(err);
        alert('Could not save photo changes. Please try again.');
      }
    });

    renderEditPhotos();
  }

  document.addEventListener('blur', e => {
    if (!e.target.matches('.editable-profile')) return;

    const field = e.target.dataset.field;
    const value = e.target.textContent.trim();

    if (!field) return;

    window.CampusCare.updateUser(user.username, {
      [field]: value
    });

    user = window.CampusCare.currentUser();
    renderProfile();
  }, true);

  function renderProfile() {
    user = window.CampusCare.currentUser();

    if (sideStudentName) {
      sideStudentName.textContent = user.name || user.username;
    }

    setText('profile-name', user.name || '-');
    setText('profile-roll', user.roll || '-');
    setText('profile-department', user.department || '-');
    setText('profile-year', user.year || '-');
    setText('profile-section-text', user.section || '-');
    setText('profile-email', user.username || '-');

    loadProfilePhoto();
  }

  let zoomLevel = 1;

  document.addEventListener('click', e => {
    if (!e.target.matches('.thumb')) return;

    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-image');

    if (!modal || !modalImg) return;

    zoomLevel = 1;
    modalImg.src = e.target.src;
    modalImg.style.transform = `scale(${zoomLevel})`;
    modal.classList.remove('hidden');
  });

  const closeBtn = document.getElementById('modal-close');
  const zoomIn = document.getElementById('zoom-in');
  const zoomOut = document.getElementById('zoom-out');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.getElementById('image-modal').classList.add('hidden');
    });
  }

  if (zoomIn) {
    zoomIn.addEventListener('click', () => {
      zoomLevel += 0.2;
      document.getElementById('modal-image').style.transform = `scale(${zoomLevel})`;
    });
  }

  if (zoomOut) {
    zoomOut.addEventListener('click', () => {
      zoomLevel = Math.max(0.5, zoomLevel - 0.2);
      document.getElementById('modal-image').style.transform = `scale(${zoomLevel})`;
    });
  }

  function getStatusClass(status) {
    if (status === 'Resolved') return 'resolved';
    if (status === 'In Progress') return 'in-progress';
    if (status === 'Rejected') return 'rejected';
    return '';
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function escapeAttribute(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }


  document.addEventListener('click', e => {
    const stat = e.target.closest('.dash-filter');
    if (stat) {
      const status = stat.dataset.status;
      openComplaintsFromDashboard(status && status !== 'all' ? { status } : {});
      return;
    }
    const statusRow = e.target.closest('[data-status]');
    if (statusRow && statusRow.closest('#student-status-chart')) {
      openComplaintsFromDashboard({ status: statusRow.dataset.status });
      return;
    }
    const categoryRow = e.target.closest('[data-category]');
    if (categoryRow && categoryRow.closest('#student-category-chart')) {
      openComplaintsFromDashboard({ category: categoryRow.dataset.category });
      return;
    }
    const recent = e.target.closest('#student-recent-complaints .recent-item');
    if (recent) openComplaintsFromDashboard({ id: recent.dataset.id });
  });

  render();
  renderProfile();
});