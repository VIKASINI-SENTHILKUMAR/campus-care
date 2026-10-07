(function () {
  const KEY_USERS = 'cc_users';
  const KEY_ISSUES = 'cc_issues';
  const KEY_CURRENT = 'cc_currentUser';
  const KEY_THEME = 'cc_theme';
  const KEY_REMEMBER = 'cc_rememberUser';

  function read(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch (e) {
      return null;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function ensureDefaults() {
    let users = read(KEY_USERS);

    if (!users) {
      users = [
        {
          username: 'admin@campus.edu',
          password: 'admin123',
          role: 'admin',
          blocked: false,
          name: 'Campus Admin',
          roll: '',
          department: '',
          year: '',
          section: ''
        }
      ];
    }

    users = users.map(u => ({
      username: u.username || '',
      password: u.password || '',
      role: u.role || 'student',
      blocked: !!u.blocked,
      blockReason: u.blockReason || '',
      name: u.name || '',
      roll: u.roll || '',
      department: u.department || '',
      year: u.year || '',
      section: u.section || ''
    }));

    write(KEY_USERS, users);

    if (!read(KEY_ISSUES)) {
      write(KEY_ISSUES, []);
    }
  }

  function createUser(username, password, role, details = {}) {
    if (!username || !password) {
      return { ok: false, msg: 'Missing fields' };
    }

    if (!username.match(/^[^@]+@campus\.edu$/)) {
      return {
        ok: false,
        msg: 'Username must be in format: name@campus.edu'
      };
    }

    const users = read(KEY_USERS) || [];

    if (users.find(u => u.username === username)) {
      return { ok: false, msg: 'Username already taken' };
    }

    const newUser = {
      username,
      password,
      role,
      blocked: false,
      blockReason: '',
      name: details.name || '',
      roll: details.roll || '',
      department: details.department || '',
      year: details.year || '',
      section: details.section || ''
    };

    users.push(newUser);
    write(KEY_USERS, users);

    write(KEY_CURRENT, {
      username,
      role
    });

    return { ok: true };
  }

  function login(username, password, role, remember = false) {
    const users = read(KEY_USERS) || [];

    const user = users.find(u =>
      u.username === username &&
      u.password === password &&
      u.role === role
    );

    if (!user) {
      return { ok: false, msg: 'Invalid credentials' };
    }

    if (user.blocked) {
      return {
        ok: false,
        msg: user.blockReason
          ? 'Account blocked by admin. Reason: ' + user.blockReason
          : 'Account blocked by admin. Contact support.'
      };
    }

    write(KEY_CURRENT, {
      username: user.username,
      role: user.role
    });

    if (remember) {
      write(KEY_REMEMBER, {
        username: user.username,
        password: user.password,
        role: user.role
      });
    } else {
      localStorage.removeItem(KEY_REMEMBER);
    }

    return { ok: true };
  }

  function getRememberedUser() {
    return read(KEY_REMEMBER);
  }

  function logout() {
    localStorage.removeItem(KEY_CURRENT);
    window.location.href = 'index.html';
  }

  function currentUser() {
    const current = read(KEY_CURRENT);

    if (!current) return null;

    const users = read(KEY_USERS) || [];
    const fullUser = users.find(u => u.username === current.username);

    if (!fullUser) return current;

    return {
      ...fullUser,
      role: current.role
    };
  }

  function getUsers() {
    return read(KEY_USERS) || [];
  }

  function updateUser(username, patch) {
    const users = read(KEY_USERS) || [];
    const index = users.findIndex(u => u.username === username);

    if (index === -1) return false;

    users[index] = {
      ...users[index],
      ...patch
    };

    write(KEY_USERS, users);
    return true;
  }

  function getIssues() {
    return read(KEY_ISSUES) || [];
  }

  function writeIssues(issues) {
    try {
      write(KEY_ISSUES, issues);
      return 0;
    } catch (err) {
      const isQuota =
        err &&
        (
          err.name === 'QuotaExceededError' ||
          err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          String(err.message || '').toLowerCase().includes('quota')
        );

      if (!isQuota) throw err;
      if (issues.length <= 1) throw err;

      issues.pop();
      const removed = writeIssues(issues);
      return removed + 1;
    }
  }

  function addIssue(issue) {
    const issues = read(KEY_ISSUES) || [];

    const newIssue = {
      id: issue.id || 'i_' + Date.now(),
      title: issue.title || 'Untitled',
      description: issue.description || '',
      category: issue.category || 'Other',
      location: issue.location || '',
      photos: Array.isArray(issue.photos) ? issue.photos : [],
      reporter: issue.reporter || '',
      status: issue.status || 'Open',
      photoVerifiedByReporter: !!issue.photoVerifiedByReporter,
      photoVerifiedByAdmin: !!issue.photoVerifiedByAdmin,
      photoRejectedByAdmin: !!issue.photoRejectedByAdmin,
      photoVerifiedByAi: !!issue.photoVerifiedByAi,
      aiVerification: issue.aiVerification || null,
      adminComment: issue.adminComment || '',
      rejectReason: issue.rejectReason || '',
      reopened: !!issue.reopened,
      reopenNotification: !!issue.reopenNotification,
      reopenMessage: issue.reopenMessage || '',
      created: issue.created || Date.now(),
      history: [
        {
          status: 'Open',
          date: Date.now()
        }
      ]
    };

    issues.unshift(newIssue);
    return writeIssues(issues);
  }

  function updateIssue(id, patch) {
    const issues = read(KEY_ISSUES) || [];
    const index = issues.findIndex(i => i.id === id);

    if (index === -1) return false;

    issues[index] = {
      ...issues[index],
      ...patch
    };

    write(KEY_ISSUES, issues);
    return true;
  }

  function setTheme(theme) {
    localStorage.setItem(KEY_THEME, theme);
    applyTheme(theme);
  }

  function getTheme() {
    return localStorage.getItem(KEY_THEME) || 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  function init() {
    ensureDefaults();
    applyTheme(getTheme());
  }

  window.CampusCare = {
    init,
    createUser,
    login,
    logout,
    currentUser,
    getUsers,
    updateUser,
    getIssues,
    addIssue,
    updateIssue,
    setTheme,
    getTheme,
    getRememberedUser
  };

  init();
})();