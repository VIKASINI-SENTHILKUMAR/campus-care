document.addEventListener('DOMContentLoaded', () => {
  let user = window.CampusCare.currentUser();

  if (!user || user.role !== 'admin') {
    alert('Please login as Admin');
    window.location.href = 'index.html';
    return;
  }

  const issueList = document.getElementById('admin-issues');
  const activeList = document.getElementById('active-admin-issues');
  const studentList = document.getElementById('student-list');

  const adminSearch = document.getElementById('admin-search');
  const statusFilter = document.getElementById('filter-status');
  const categoryFilter = document.getElementById('filter-category');
  const placeFilter = document.getElementById('filter-place');
  const studentSearch = document.getElementById('student-search');

  const sideAdminName = document.getElementById('side-admin-name');
  const adminPhotoInput = document.getElementById('admin-profile-photo-input');
  const adminPhotoPreview = document.getElementById('admin-profile-photo-preview');

  const navButtons = document.querySelectorAll('.nav-btn[data-section]');
  const sections = document.querySelectorAll('.page-section');
  const adminBrand = document.querySelector('.sidebar-brand');

  function showSection(sectionId) {
    navButtons.forEach(b => b.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active-section'));

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

  if (adminBrand) {
    adminBrand.addEventListener('click', e => {
      if (e.target.id === 'admin-profile-photo-input') return;
      showSection('admin-profile-section');
    });
  }

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      window.CampusCare.logout();
    });
  }

  function loadAdminPhoto() {
    const savedPhoto = localStorage.getItem('profile_photo_' + user.username);

    if (savedPhoto && adminPhotoPreview) {
      adminPhotoPreview.src = savedPhoto;
    }
  }

  if (adminPhotoInput && adminPhotoPreview) {
    loadAdminPhoto();

    adminPhotoInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = () => {
        adminPhotoPreview.src = reader.result;
        localStorage.setItem('profile_photo_' + user.username, reader.result);
      };

      reader.readAsDataURL(file);
    });
  }

  function getStudent(username) {
    return window.CampusCare.getUsers().find(u => u.username === username);
  }

  function getStudentsWithComplaints() {
    const issues = window.CampusCare.getIssues();
    const reportedUsernames = [...new Set(issues.map(i => i.reporter))];

    return window.CampusCare.getUsers()
      .filter(u => u.role === 'student')
      .filter(u => reportedUsernames.includes(u.username));
  }

  function renderProfile() {
    user = window.CampusCare.currentUser();

    const studentsWithComplaints = getStudentsWithComplaints();

    setText('admin-name', user.name || user.username.split('@')[0]);
    setText('admin-role', 'Campus Administrator');
    setText('student-total', studentsWithComplaints.length);
    setText('student-blocked', studentsWithComplaints.filter(s => s.blocked).length);

    if (sideAdminName) {
      sideAdminName.textContent = user.name || 'Admin Panel';
    }
  }

  document.addEventListener('blur', e => {
    if (!e.target.matches('.editable-admin-profile')) return;

    const field = e.target.dataset.field;
    const value = e.target.textContent.trim();

    if (!field) return;

    window.CampusCare.updateUser(user.username, {
      [field]: value
    });

    user = window.CampusCare.currentUser();
    renderProfile();
  }, true);

  function populateStudentDropdown() {
    if (!studentSearch) return;

    const currentValue = studentSearch.value;
    const students = getStudentsWithComplaints();

    studentSearch.innerHTML = '<option value="">All Students</option>';

    students.forEach(student => {
      const option = document.createElement('option');
      option.value = student.username;
      option.textContent = `${student.name || student.username}${student.roll ? ' - ' + student.roll : ''}`;
      studentSearch.appendChild(option);
    });

    studentSearch.value = currentValue;
  }

  function renderStudents() {
    populateStudentDropdown();

    const selectedStudent = studentSearch ? (studentSearch.value || '') : '';

    const students = getStudentsWithComplaints()
      .filter(student =>
        !selectedStudent || student.username === selectedStudent
      );

    const issues = window.CampusCare.getIssues();

    if (!studentList) return;

    studentList.innerHTML = students.map(student => {
      const studentIssues = issues.filter(i => i.reporter === student.username);

      const open = studentIssues.filter(i => i.status === 'Open').length;
      const progress = studentIssues.filter(i => i.status === 'In Progress').length;
      const resolved = studentIssues.filter(i => i.status === 'Resolved').length;
      const rejected = studentIssues.filter(i => i.status === 'Rejected').length;

      const photo = localStorage.getItem('profile_photo_' + student.username);

      return `
        <div class="student-card">
          <div class="student-info student-info-with-photo">
            <img
              class="mini-profile-photo"
              src="${photo || 'https://via.placeholder.com/80'}"
              alt="Student">

            <div>
              <b>${escapeHtml(student.name || student.username)}</b>
              <small>${escapeHtml(student.username)}</small>

              <p>
                Roll No: ${escapeHtml(student.roll || '-')} •
                Department: ${escapeHtml(student.department || '-')} •
                Year: ${escapeHtml(student.year || '-')} •
                Section: ${escapeHtml(student.section || '-')}
              </p>

              <p>
                <span class="chip">Total: ${studentIssues.length}</span>
                <span class="chip">Open: ${open}</span>
                <span class="chip">Progress: ${progress}</span>
                <span class="chip">Resolved: ${resolved}</span>
                <span class="chip">Rejected: ${rejected}</span>
              </p>

              <p>${student.blocked ? 'Blocked by admin' : 'Active student user'}</p>
              ${student.blocked && student.blockReason ? `
                <p class="block-reason-box"><b>Block Reason:</b> ${escapeHtml(student.blockReason)}</p>
              ` : ''}
            </div>
          </div>

          <div class="student-actions">
            <span class="status-chip ${student.blocked ? 'blocked' : 'active'}">
              ${student.blocked ? 'Blocked' : 'Active'}
            </span>

            <button class="btn ghost btn-block" data-username="${escapeHtml(student.username)}">
              ${student.blocked ? 'Unblock' : 'Block'}
            </button>
          </div>
        </div>
      `;
    }).join('') || '<div class="muted">No students have submitted complaints yet.</div>';
  }

  function populatePlaceFilter() {
    if (!placeFilter) return;

    const currentValue = placeFilter.value;
    const places = [...new Set(
      window.CampusCare.getIssues()
        .map(i => String(i.location || '').trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    placeFilter.innerHTML = '<option value="">All Places / Locations</option>' +
      places.map(place => `
        <option value="${escapeHtml(place)}" ${place === currentValue ? 'selected' : ''}>
          ${escapeHtml(place)}
        </option>
      `).join('');
  }


  function getStudentAiPhoto(issue, index = 0) {
    const result = issue.aiVerification;
    if (!result) return null;
    if (Array.isArray(result.photos)) return result.photos[index] || null;
    return index === 0 ? result : null;
  }

  function getProblemArea(photoResult) {
    const area = photoResult && photoResult.problemArea;
    const valid = area && typeof area === 'object';
    const x = valid ? Number(area.x) : 36;
    const y = valid ? Number(area.y) : 20;
    const width = valid ? Number(area.width) : 36;
    const height = valid ? Number(area.height) : 42;
    return {
      x: Math.max(0, Math.min(100, Number.isFinite(x) ? x : 36)),
      y: Math.max(0, Math.min(100, Number.isFinite(y) ? y : 20)),
      width: Math.max(10, Math.min(72, Number.isFinite(width) ? width : 36)),
      height: Math.max(10, Math.min(72, Number.isFinite(height) ? height : 42))
    };
  }

  function getAnalyzedPhotoHtml(src, issue, index = 0) {
    const photoResult = getStudentAiPhoto(issue, index);
    const hasAi = !!photoResult;
    const area = getProblemArea(photoResult);
    const label = photoResult?.detectedObject || photoResult?.detectedCategory || 'Problem area';
    const areaData = `${area.x},${area.y},${area.width},${area.height}`;
    return `
      <div class="ai-photo-stage ${hasAi && photoResult.valid ? 'has-ai-area' : ''}">
        <img
          class="thumb ai-analyzed-img"
          src="${src}"
          alt="Complaint photo ${index + 1}"
          data-ai-area="${hasAi && photoResult.valid ? escapeAttr(areaData) : ''}"
          data-ai-label="${hasAi && photoResult.valid ? escapeAttr(label) : ''}"
        >
        ${hasAi && photoResult.valid ? `
          <span class="ai-detected-tag">AI Detected: ${escapeHtml(label)}</span>
          <span class="ai-problem-circle" style="left:${area.x}%;top:${area.y}%;width:${area.width}%;height:${area.height}%;"></span>
        ` : ''}
      </div>
    `;
  }

  function getAiVerificationHtml(issue) {
    const result = issue.aiVerification;

    if (!result) {
      return `
        <div class="ai-box ai-pending">
          <strong>🤖 Student AI Photo Check</strong>
          <p class="muted-text">No AI result saved for this complaint.</p>
        </div>
      `;
    }

    if (Array.isArray(result.photos)) {
      const allValid = result.photos.every(p => p.valid);
      const decision = issue.photoVerifiedByAdmin
        ? 'Admin Decision: Photo Verified ✅'
        : issue.photoRejectedByAdmin
          ? 'Admin Decision: Photo Rejected ❌'
          : 'Awaiting Admin Manual Decision';
      return `
        <div class="ai-box ${allValid ? 'ai-valid' : 'ai-invalid'} ai-analysis-card">
          <div class="ai-card-head">
            <strong>🤖 Student AI Photo Analysis</strong>
            <span class="ai-pill ${allValid ? 'good' : 'bad'}">${allValid ? 'All Photos Related ✅' : 'Invalid Photo Found ❌'}</span>
          </div>
          <p class="ai-decision-line"><b>${escapeHtml(decision)}</b></p>
          ${result.photos.map((photo, index) => `
            <div class="ai-photo-result ${photo.valid ? 'valid' : 'invalid'}">
              <strong>Photo ${index + 1}: ${photo.valid ? 'Related ✅' : 'Unrelated ❌'}</strong>
              <p><b>Detected:</b> ${escapeHtml(photo.detectedObject || photo.detectedCategory || 'General')}</p>
              <p><b>Category:</b> ${escapeHtml(photo.detectedCategory || 'General')} • <b>Confidence:</b> ${escapeHtml(String(photo.confidence || 0))}%</p>
              <p><b>Reason:</b> ${escapeHtml(photo.reason || 'AI check completed.')}</p>
            </div>
          `).join('')}
          <small>Checked by student before submission: ${result.checkedAt ? new Date(result.checkedAt).toLocaleString() : '-'}</small>
        </div>
      `;
    }

    const confidence = Number(result.confidence || 0);
    const validClass = result.valid ? 'ai-valid' : 'ai-invalid';
    const validText = result.valid ? 'VALID ✅' : 'INVALID ❌';

    const finalDecisionText = issue.photoVerifiedByAdmin
      ? '<p><b>Admin Decision:</b> Photo Verified ✅</p>'
      : issue.photoRejectedByAdmin
        ? '<p><b>Admin Decision:</b> Photo Rejected ❌</p>'
        : '<p><b>Final Decision:</b> Awaiting admin manual decision.</p>';

    return `
      <div class="ai-box ${validClass}">
        <strong>🤖 AI Verification: ${validText}</strong>
        <p><b>Detected Category:</b> ${escapeHtml(result.detectedCategory || 'General')}</p>
        <p><b>Confidence:</b> ${escapeHtml(String(confidence))}%</p>
        <p><b>Reason:</b> ${escapeHtml(result.reason || 'No reason provided')}</p>
        ${finalDecisionText}
        <small>Checked: ${result.verifiedAt ? new Date(result.verifiedAt).toLocaleString() : '-'}</small>
      </div>
    `;
  }

  async function verifyIssueWithAi(id) {
    const issues = window.CampusCare.getIssues();
    const issue = issues.find(i => i.id === id);

    if (!issue) {
      alert('Complaint not found.');
      return;
    }

    if (!Array.isArray(issue.photos) || issue.photos.length === 0) {
      alert('No complaint photo found for AI verification.');
      return;
    }

    const button = document.querySelector(`.btn-ai-verify[data-id="${CSS.escape(id)}"]`);
    const originalText = button ? button.textContent : '';

    try {
      if (button) {
        button.disabled = true;
        button.textContent = 'Verifying...';
      }

      const response = await fetch('/api/verify-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageData: issue.photos[0],
          title: issue.title || '',
          description: issue.description || '',
          category: issue.category || '',
          location: issue.location || ''
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'AI verification failed. Make sure backend server is running and Gemini API key is added.');
      }

      const aiVerification = {
        valid: !!data.result.valid,
        detectedCategory: data.result.detectedCategory || 'General',
        confidence: Number(data.result.confidence || 0),
        reason: data.result.reason || '',
        verifiedAt: Date.now()
      };

      const needsManualReview = aiVerification.confidence < 60;
      aiVerification.manualReview = needsManualReview;

      window.CampusCare.updateIssue(id, {
        aiVerification,
        photoVerifiedByAi: false,
        photoVerifiedByAdmin: false,
        photoRejectedByAdmin: false
      });

      alert('AI verification completed. Please make the final decision manually: Verify Photo or Reject Photo.');
      renderIssues();
    } catch (error) {
      alert(error.message || 'AI verification failed.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText || '🤖 AI Verify Image';
      }
    }
  }


  function countBy(items, getter) {
    return items.reduce((acc, item) => {
      const key = getter(item) || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  function renderMiniBars(elId, counts, limit = 8, options = {}) {
    const el = document.getElementById(elId);
    if (!el) return;
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
    const max = Math.max(1, ...entries.map(([, v]) => v));
    el.innerHTML = entries.length ? entries.map(([label, value], index) => `
      <button class="mini-bar-row clickable-row" type="button" data-${options.type || 'filter'}="${escapeHtml(label)}" style="--bar-index:${index}">
        <span class="mini-bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
        <span class="mini-bar-track"><span class="mini-bar-fill" style="width:${Math.round((value / max) * 100)}%"></span></span>
        <strong>${value}</strong>
      </button>
    `).join('') : '<div class="mini-empty">No data yet</div>';
  }

  function openAdminComplaintsFromDashboard(filter = {}) {
    showSection('complaints-section');
    if (statusFilter) statusFilter.value = filter.status && filter.status !== 'all' ? filter.status : '';
    if (categoryFilter) categoryFilter.value = filter.category || '';
    if (placeFilter) placeFilter.value = filter.place || '';
    renderIssues();
    setTimeout(() => {
      const cards = [...document.querySelectorAll('#admin-issues .issue')];
      cards.forEach(card => card.classList.remove('highlight-issue'));
      let target = filter.id ? document.querySelector(`#admin-issues .issue[data-id="${CSS.escape(filter.id)}"]`) : cards[0];
      if (target) {
        target.classList.add('highlight-issue');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
  }

  function renderAdminReport(issues) {
    const total = issues.length;
    const progress = issues.filter(i => i.status === 'In Progress').length;
    const rejected = issues.filter(i => i.status === 'Rejected').length;
    const topPlace = Object.entries(countBy(issues, i => i.location || 'Unknown')).sort((a,b)=>b[1]-a[1])[0];
    setText('admin-report-title', total ? `${total} campus complaint${total === 1 ? '' : 's'} recorded` : 'No complaints yet');
    setText('admin-report-summary', total ? `${progress} in progress, ${rejected} rejected. Top reported place: ${topPlace ? topPlace[0] : 'None'}.` : 'Complaint insights will appear here as students report issues.');
  }

  function renderRecentAdminComplaints(issues) {
    const el = document.getElementById('admin-recent-complaints');
    if (!el) return;
    const recent = [...issues].sort((a,b)=> new Date(b.updated || b.created || 0) - new Date(a.updated || a.created || 0)).slice(0,5);
    el.innerHTML = recent.length ? recent.map(i => `
      <button class="recent-item" type="button" data-id="${escapeHtml(i.id)}">
        <span><b>${escapeHtml(i.title || 'Untitled')}</b><small>${escapeHtml(i.location || 'Unknown location')}</small></span>
        <em class="status-badge ${getStatusClass(i.status)}">${escapeHtml(i.status || 'Open')}</em>
      </button>
    `).join('') : '<div class="mini-empty">No recent complaints yet</div>';
  }

  function populateAdminStudentDropdown() {
    if (!adminSearch) return;

    const currentValue = adminSearch.value;
    const reporters = [...new Set(window.CampusCare.getIssues().map(i => i.reporter))];
    const students = window.CampusCare.getUsers()
      .filter(u => u.role === 'student' && reporters.includes(u.username))
      .sort((a, b) => String(a.name || a.username).localeCompare(String(b.name || b.username)));

    adminSearch.innerHTML = '<option value="">All Students</option>';

    students.forEach(student => {
      const option = document.createElement('option');
      option.value = student.username;
      option.textContent = `${student.name || student.username}${student.roll ? ' - ' + student.roll : ''}`;
      adminSearch.appendChild(option);
    });

    adminSearch.value = currentValue;
  }

  function renderIssues() {
    let issues = window.CampusCare.getIssues();
    const users = window.CampusCare.getUsers();

    populateAdminStudentDropdown();
    populatePlaceFilter();

    setText('admin-total', issues.length);
    setText('admin-open', issues.filter(i => i.status === 'Open').length);
    setText('admin-progress', issues.filter(i => i.status === 'In Progress').length);
    setText('admin-resolved', issues.filter(i => i.status === 'Resolved').length);
    renderMiniBars('admin-status-chart', countBy(issues, i => i.status || 'Open'), 8, { type: 'status' });
    renderMiniBars('admin-category-chart', countBy(issues, i => i.category || 'General'), 8, { type: 'category' });
    renderMiniBars('admin-place-chart', countBy(issues, i => i.location || 'Unknown'), 6, { type: 'place' });
    renderAdminReport(issues);
    renderRecentAdminComplaints(issues);

    const active = issues.filter(i => i.status === 'In Progress');

    if (activeList) {
      activeList.innerHTML = active.slice(0, 5).map(i => {
        const student = getStudent(i.reporter);

        return `
          <button class="recent-item active-report-item" type="button" data-id="${escapeHtml(i.id)}">
            <span>
              <b>${escapeHtml(i.title)}</b>

              ${i.reopenNotification ? `
                <div class="reopen-alert">
                  🔔 Student reopened this complaint. Please review again.
                </div>
              ` : ''}

              <div class="badge-row">
                <span class="cat-badge">${escapeHtml(i.category || 'General')}</span>
                <span class="status-badge ${getStatusClass(i.status)}">
                  ${escapeHtml(i.status || 'Open')}
                </span>
              </div>

              <small>
                ${escapeHtml(i.location || 'Unknown location')}
                • by ${escapeHtml(student?.name || i.reporter || 'Unknown')}
              </small>
            </span>
          </button>
        `;
      }).join('') || '<div class="muted">No active complaints.</div>';
    }

    const selectedStudent = adminSearch ? (adminSearch.value || '') : '';
    const status = statusFilter.value;
    const category = categoryFilter.value;
    const place = placeFilter ? placeFilter.value : '';

    if (selectedStudent) {
      issues = issues.filter(i => i.reporter === selectedStudent);
    }

    if (status) {
      issues = issues.filter(i => i.status === status);
    }

    if (category) {
      issues = issues.filter(i => i.category === category);
    }

    if (place) {
      issues = issues.filter(i => String(i.location || '') === place);
    }

    if (!issueList) return;

    issueList.innerHTML = issues.map(i => {
      const student = getStudent(i.reporter);
      const hasPhotos = Array.isArray(i.photos) && i.photos.length > 0;

      const photos = hasPhotos
        ? i.photos.map((p, index) => getAnalyzedPhotoHtml(p, i, index)).join('')
        : '<div class="no-photo">No Image Uploaded</div>';

      const adminCommentBox = i.adminComment
        ? `
          <div class="admin-comment-box">
            <strong>Admin Comment:</strong>
            <p>${escapeHtml(i.adminComment)}</p>
          </div>
        `
        : '';

      const rejectBox = i.rejectReason
        ? `
          <div class="rejected-box">
            <strong>Reject Reason:</strong>
            <p>${escapeHtml(i.rejectReason)}</p>
          </div>
        `
        : '';

      const reopenAlert = i.reopenNotification
        ? `
          <div class="reopen-alert">
            🔔 Student reopened this complaint. Please review again.
          </div>
        `
        : '';

      const photoStatus = hasPhotos
        ? `
          <div class="photo-status">
            ${
              i.photoVerifiedByAdmin
                ? `<span class="badge verified-admin">Photo Verified ✅</span>`
                : i.photoRejectedByAdmin
                  ? `<span class="badge rejected">Photo Rejected ❌</span>`
                  : '<span class="badge">Photo Pending</span>'
            }
          </div>
        `
        : '';

      const photoButtons = hasPhotos && !i.photoVerifiedByAdmin && !i.photoRejectedByAdmin
        ? `
          <button class="btn action-green btn-photo-verify" data-id="${escapeHtml(i.id)}">
            Verify Photo
          </button>

          <button class="btn action-red btn-photo-reject" data-id="${escapeHtml(i.id)}">
            Reject Photo
          </button>
        `
        : '';

      const rejectButton = i.status !== 'Rejected' && i.status !== 'Resolved'
        ? `
          <button class="btn action-red btn-reject" data-id="${escapeHtml(i.id)}">
            Reject
          </button>
        `
        : '';

      const reopenButton = i.status === 'Resolved' || i.status === 'Rejected'
        ? `
          <button class="btn action-orange btn-reopen" data-id="${escapeHtml(i.id)}">
            Reopen
          </button>
        `
        : '';

      return `
        <div class="issue" data-id="${escapeHtml(i.id)}">
          <div class="photos">
            ${photos}
          </div>

          <div class="meta">
            <b>${escapeHtml(i.title)}</b>

            ${reopenAlert}

            <small>
              Student: ${escapeHtml(student?.name || i.reporter || 'Unknown')}
              ${student?.roll ? ' • Roll: ' + escapeHtml(student.roll) : ''}
              • ${escapeHtml(i.location || 'Unknown location')}
            </small>

            <div class="badge-row">
              <span class="cat-badge">${escapeHtml(i.category || 'General')}</span>
              <span class="status-badge ${getStatusClass(i.status)}">
                ${escapeHtml(i.status || 'Open')}
              </span>
            </div>

            <p>${escapeHtml(i.description || '')}</p>

            ${photoStatus}
            ${hasPhotos ? getAiVerificationHtml(i) : ''}
            ${adminCommentBox}
            ${rejectBox}

            <textarea
              class="admin-comment-input"
              data-id="${escapeHtml(i.id)}"
              placeholder="Add admin comment..."
            >${escapeHtml(i.adminComment || '')}</textarea>

            <div class="issue-actions">
              <select class="status-select" data-id="${escapeHtml(i.id)}">
                <option ${i.status === 'Open' ? 'selected' : ''}>Open</option>
                <option ${i.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option ${i.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                <option ${i.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
              </select>

              <button class="btn action-blue btn-save-comment" data-id="${escapeHtml(i.id)}">
                Save Comment
              </button>

              ${photoButtons}
              ${rejectButton}
              ${reopenButton}
            </div>
          </div>
        </div>
      `;
    }).join('') || '<div class="muted">No complaints found.</div>';

    renderNotifications();
  }

  if (studentList) {
    studentList.addEventListener('click', e => {
      if (!e.target.matches('.btn-block')) return;

      const username = e.target.dataset.username;
      const student = window.CampusCare.getUsers().find(s => s.username === username);

      if (!student) return;

      if (student.blocked) {
        const confirmUnblock = confirm('Unblock this student?');
        if (!confirmUnblock) return;

        window.CampusCare.updateUser(username, {
          blocked: false,
          blockReason: '',
          blockedAt: ''
        });
      } else {
        const reason = prompt('Enter reason for blocking this student:');
        if (!reason || !reason.trim()) {
          alert('Block reason is required. Student was not blocked.');
          return;
        }

        window.CampusCare.updateUser(username, {
          blocked: true,
          blockReason: reason.trim(),
          blockedAt: new Date().toISOString()
        });
      }

      renderProfile();
      renderStudents();
    });
  }

  function rejectComplaint(id) {
    if (!id) return false;

    const reason = prompt('Enter rejection reason:');

    if (!reason || !reason.trim()) {
      alert('Reject reason is required. Complaint was not rejected.');
      renderIssues();
      return false;
    }

    const ok = window.CampusCare.updateIssue(id, {
      status: 'Rejected',
      rejectReason: reason.trim(),
      rejectedAt: Date.now(),
      reopenNotification: false
    });

    if (!ok) {
      alert('Unable to reject complaint. Please refresh and try again.');
      renderIssues();
      return false;
    }

    alert('Complaint rejected and saved with reason.');
    renderIssues();
    return true;
  }

  if (issueList) {
    issueList.addEventListener('change', e => {
      if (!e.target.matches('.status-select')) return;

      const id = e.target.dataset.id;
      const newStatus = e.target.value;

      if (newStatus === 'Rejected') {
        rejectComplaint(id);
        return;
      }

      window.CampusCare.updateIssue(id, {
        status: newStatus,
        reopenNotification: false
      });

      renderIssues();
    });

    issueList.addEventListener('click', e => {
      const actionButton = e.target.closest('button[data-id]');
      if (!actionButton || !issueList.contains(actionButton)) return;

      const id = actionButton.dataset.id;

      if (actionButton.matches('.btn-save-comment')) {
        const input = document.querySelector(`.admin-comment-input[data-id="${id}"]`);

        window.CampusCare.updateIssue(id, {
          adminComment: input.value.trim(),
          commentUpdatedAt: Date.now()
        });

        alert('Admin comment saved');
        renderIssues();
        return;
      }

      if (actionButton.matches('.btn-reject')) {
        rejectComplaint(id);
        return;
      }

      if (actionButton.matches('.btn-reopen')) {
        window.CampusCare.updateIssue(id, {
          status: 'Open',
          reopened: true,
          reopenedAt: Date.now(),
          rejectReason: '',
          reopenNotification: false
        });

        alert('Complaint reopened');
        renderIssues();
      }

      if (actionButton.matches('.btn-ai-verify')) {
        verifyIssueWithAi(id);
      }

      if (actionButton.matches('.btn-photo-verify')) {
        window.CampusCare.updateIssue(id, {
          photoVerifiedByAdmin: true,
          photoRejectedByAdmin: false,
          photoVerifiedByAi: false
        });

        alert('Photo verified');
        renderIssues();
      }

      if (actionButton.matches('.btn-photo-reject')) {
        window.CampusCare.updateIssue(id, {
          photoVerifiedByAdmin: false,
          photoRejectedByAdmin: true,
          photoVerifiedByAi: false
        });

        alert('Photo rejected');
        renderIssues();
      }
    });
  }

  function renderNotifications() {
    const notifCount = document.getElementById('notif-count');
    const panel = document.getElementById('notification-panel');

    if (!notifCount || !panel) return;

    const issues = window.CampusCare.getIssues();
    const notifications = issues.filter(i => i.reopenNotification === true);

    notifCount.textContent = notifications.length;

    if (notifications.length === 0) {
      notifCount.style.display = 'none';
      panel.innerHTML = '<div class="notification-empty">No new notifications</div>';
      return;
    }

    notifCount.style.display = 'flex';

    panel.innerHTML = notifications.map(i => `
      <div class="notification-item" data-id="${escapeHtml(i.id)}">
        <strong>Reopened Complaint</strong>
        <p>${escapeHtml(i.reopenMessage || 'Student reopened this complaint')}</p>
        <small>${escapeHtml(i.title || 'Complaint')} • ${escapeHtml(i.location || '')}</small>
      </div>
    `).join('');
  }

  const bell = document.getElementById('notification-bell');
  const panel = document.getElementById('notification-panel');

  if (bell && panel) {
    bell.addEventListener('click', () => {
      panel.classList.toggle('hidden');
      renderNotifications();
    });

    panel.addEventListener('click', e => {
      const item = e.target.closest('.notification-item');

      if (!item) return;

      const id = item.dataset.id;
      const issues = window.CampusCare.getIssues();
      const issue = issues.find(i => i.id === id);

      alert(issue?.reopenMessage || 'Student reopened this complaint. Please review again.');

      window.CampusCare.updateIssue(id, {
        reopenNotification: false
      });

      renderNotifications();
      renderIssues();
    });
  }

  if (adminSearch) adminSearch.addEventListener('change', renderIssues);
  if (statusFilter) statusFilter.addEventListener('change', renderIssues);
  if (categoryFilter) categoryFilter.addEventListener('change', renderIssues);
  if (placeFilter) placeFilter.addEventListener('change', renderIssues);
  if (studentSearch) studentSearch.addEventListener('change', renderStudents);

  const toggle = document.getElementById('admin-theme-toggle');

  if (toggle) {
    toggle.checked =
      window.CampusCare.getTheme &&
      window.CampusCare.getTheme() === 'dark';

    toggle.addEventListener('change', () => {
      if (window.CampusCare.setTheme) {
        window.CampusCare.setTheme(toggle.checked ? 'dark' : 'light');
      } else {
        const theme = toggle.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('cc_theme', theme);
      }
    });
  }

  let zoomLevel = 1;

  document.addEventListener('click', e => {
    if (!e.target.matches('.thumb')) return;

    const modal = document.getElementById('image-modal');
    const modalStage = document.getElementById('modal-image-stage');
    const modalImg = document.getElementById('modal-image');
    const modalCircle = document.getElementById('modal-ai-circle');
    const modalTag = document.getElementById('modal-ai-tag');

    if (!modal || !modalImg || !modalStage) return;

    zoomLevel = 1;
    modalImg.src = e.target.src;
    modalStage.style.transform = `scale(${zoomLevel})`;

    const area = String(e.target.dataset.aiArea || '').split(',').map(Number);
    const label = e.target.dataset.aiLabel || 'Problem area';

    if (modalCircle && area.length === 4 && area.every(Number.isFinite)) {
      modalCircle.style.left = `${area[0]}%`;
      modalCircle.style.top = `${area[1]}%`;
      modalCircle.style.width = `${area[2]}%`;
      modalCircle.style.height = `${area[3]}%`;
      modalCircle.classList.remove('hidden');
    } else if (modalCircle) {
      modalCircle.classList.add('hidden');
    }

    if (modalTag && e.target.dataset.aiArea) {
      modalTag.textContent = `AI Detected: ${label}`;
      modalTag.classList.remove('hidden');
    } else if (modalTag) {
      modalTag.classList.add('hidden');
    }

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
      document.getElementById('modal-image-stage').style.transform = `scale(${zoomLevel})`;
    });
  }

  if (zoomOut) {
    zoomOut.addEventListener('click', () => {
      zoomLevel = Math.max(0.5, zoomLevel - 0.2);
      document.getElementById('modal-image-stage').style.transform = `scale(${zoomLevel})`;
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

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttr(value) {
    return escapeHtml(value)
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }


  document.addEventListener('click', e => {
    const stat = e.target.closest('.admin-dash-filter');
    if (stat) {
      const status = stat.dataset.status;
      openAdminComplaintsFromDashboard(status && status !== 'all' ? { status } : {});
      return;
    }
    const statusRow = e.target.closest('#admin-status-chart [data-status]');
    if (statusRow) { openAdminComplaintsFromDashboard({ status: statusRow.dataset.status }); return; }
    const categoryRow = e.target.closest('#admin-category-chart [data-category]');
    if (categoryRow) { openAdminComplaintsFromDashboard({ category: categoryRow.dataset.category }); return; }
    const placeRow = e.target.closest('#admin-place-chart [data-place]');
    if (placeRow) { openAdminComplaintsFromDashboard({ place: placeRow.dataset.place }); return; }
    const recent = e.target.closest('#admin-recent-complaints .recent-item, #active-admin-issues .recent-item');
    if (recent) openAdminComplaintsFromDashboard({ id: recent.dataset.id });
  });

  renderProfile();
  renderStudents();
  renderIssues();
  renderNotifications();
});