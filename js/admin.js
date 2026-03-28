let allUsers = [];
let allPromoCodes = [];
let allAnnouncements = [];
let allGroupLinks = [];
let selectedUser = null;

// The logic will now purely check against admin_config table
async function initAdmin() {
  // Check if verified in this session
  if (sessionStorage.getItem('admin_access_allowed') === 'true') {
    hideLock();
    await refreshData();
  } else {
    showLock();
  }
}

function showLock() {
  const lock = document.getElementById('adminLockScreen');
  lock.classList.add('active');
  document.getElementById('unlockBtn').onclick = verifyAdminAccess;
}

function hideLock() {
  const lock = document.getElementById('adminLockScreen');
  lock.classList.remove('active');
}

async function verifyAdminAccess() {
  const adminId = document.getElementById('adminIdInput').value;
  const adminSecret = document.getElementById('adminSecretInput').value;
  const msg = document.getElementById('lockMsg');

  if (!adminId || !adminSecret) {
    msg.textContent = 'Please enter both ID and Secret Key.';
    msg.className = 'lock-msg error';
    return;
  }

  try {
    msg.textContent = 'Verifying...';
    msg.className = 'lock-msg loading';

    // Check if DB credentials match
    const { data: configRows, error } = await window.supabaseClient
      .from('admin_config')
      .select('key_name, key_value');

    if (error) throw error;

    const dbId = configRows.find(r => r.key_name === 'admin_id')?.key_value;
    const dbSecret = configRows.find(r => r.key_name === 'admin_secret')?.key_value;

    if (adminId === dbId && adminSecret === dbSecret) {
      sessionStorage.setItem('admin_access_allowed', 'true');
      hideLock();
      await refreshData();
    } else {
      msg.textContent = 'Invalid Admin ID or Secret Key.';
      msg.className = 'lock-msg error';
    }
  } catch (err) {
    console.error(err);
    msg.textContent = 'Database error: ' + err.message;
    msg.className = 'lock-msg error';
  }
}

async function refreshData() {
  try {
    // 1. Fetch Stats & Users
    const { data: users, error: userError } = await window.supabaseClient
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (userError) throw userError;
    allUsers = users;

    document.getElementById('stat-total-users').textContent = users.length;
    document.getElementById('stat-pending-users').textContent = users.filter(u => u.status === 'Pending').length;
    document.getElementById('stat-active-users').textContent = users.filter(u => u.status === 'Active').length;

    // 2. Fetch Promo Codes
    const { data: promoCodes, error: promoError } = await window.supabaseClient
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (promoError) throw promoError;
    allPromoCodes = promoCodes;

    // 3. Fetch Announcements
    const { data: announcements, error: annError } = await window.supabaseClient
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (annError) throw annError;
    allAnnouncements = announcements;

    // 4. Fetch Group Links from admin_config
    const { data: configData, error: configError } = await window.supabaseClient
      .from('admin_config')
      .select('key_value')
      .eq('key_name', 'group_links')
      .single();

    if (configData && configData.key_value) {
      try {
        allGroupLinks = JSON.parse(configData.key_value);
      } catch (e) {
        allGroupLinks = [];
      }
    } else {
      allGroupLinks = [];
    }

    updateDashboard();
    updateUserTable();
    updatePromoTable();
    updateAnnouncementTable();
    updateLinksTable();
  } catch (err) {
    console.error('Refresh error:', err);
  }
}

function updateDashboard() {
  const leaderboard = allPromoCodes.map(promo => {
    const signups = allUsers.filter(u => u.promo_code_used === promo.code).length;
    const activeUsers = allUsers.filter(u => u.promo_code_used === promo.code && (u.status === 'Active')).length;
    const convRate = signups > 0 ? (activeUsers / signups * 100).toFixed(1) : 0;
    return { ...promo, signups, activeUsers, convRate };
  }).sort((a, b) => b.signups - a.signups);

  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = leaderboard.map(p => `
    <tr>
      <td>${p.code}</td>
      <td>${p.owner_name}</td>
      <td>${p.signups}</td>
      <td>${p.activeUsers}</td>
      <td>${p.convRate}%</td>
    </tr>
  `).join('');
}

function updateUserTable() {
  const filterStatus = document.getElementById('status-filter').value;
  const query = document.getElementById('user-search').value.toLowerCase();

  const filtered = allUsers.filter(u => {
    const sMatch = filterStatus === 'all' || u.status === filterStatus;
    const qMatch = !query ||
      u.email.toLowerCase().includes(query) ||
      (u.name && u.name.toLowerCase().includes(query)) ||
      (u.display_id && u.display_id.toString().includes(query));
    return sMatch && qMatch;
  });

  const tbody = document.getElementById('user-table-body');
  tbody.innerHTML = filtered.map(u => `
    <tr data-id="${u.id}">
      <td>
        <div class="user-row">
          <img src="${u.avatar_url || 'assets/logo.jpg'}" class="table-avatar" onerror="this.src='assets/logo.jpg'">
          <div>
            <strong>${u.name || 'User'}</strong> <small>(ID: ${u.display_id || 'N/A'})</small><br>
            <small>${u.email}</small>
          </div>
        </div>
      </td>
      <td><span class="badge ${u.status.toLowerCase()}">${u.status}</span></td>
      <td>${u.active_package || 'None'}</td>
      <td><strong>${u.referral_points || 0}</strong> Pts</td>
      <td>
        <button class="btn-manage" onclick="openUserModal('${u.id}')"><i class="fas fa-edit"></i> Manage</button>
      </td>
    </tr>
  `).join('');
}

function openUserModal(id) {
  selectedUser = allUsers.find(u => u.id === id);
  if (!selectedUser) return;

  const details = document.getElementById('modal-user-details');
  details.innerHTML = `
    <div class="modal-user-header">
        <img src="${selectedUser.avatar_url || 'assets/logo.jpg'}" class="modal-avatar">
        <h3>${selectedUser.name || 'User'}</h3>
        <p>User ID: <strong>${selectedUser.display_id || 'N/A'}</strong></p>
        <p>Referral Points: <strong>${selectedUser.referral_points || 0}</strong></p>
    </div>
    <div class="modal-user-info">
        <p><strong>Email:</strong> ${selectedUser.email}</p>
        <p><strong>Referred By (ID):</strong> ${selectedUser.referred_by || 'Organic'}</p>
        <div class="field">
            <label>Current Status</label>
            <select id="user-status-edit">
                <option value="Registered" ${selectedUser.status === 'Registered' ? 'selected' : ''}>Registered</option>
                <option value="Pending" ${selectedUser.status === 'Pending' ? 'selected' : ''}>Pending (Awaiting Payment)</option>
                <option value="Active" ${selectedUser.status === 'Active' ? 'selected' : ''}>Active (Premium)</option>
                <option value="Banned" ${selectedUser.status === 'Banned' ? 'selected' : ''}>Banned</option>
            </select>
        </div>
        <div class="field">
            <label>Active Package</label>
            <select id="user-package-edit">
                <option value="Free" ${selectedUser.active_package === 'Free' ? 'selected' : ''}>Free Plan</option>
                <option value="Crypto VIP" ${selectedUser.active_package === 'Crypto VIP' ? 'selected' : ''}>Crypto VIP</option>
                <option value="Forex VIP" ${selectedUser.active_package === 'Forex VIP' ? 'selected' : ''}>Forex VIP</option>
                <option value="All-in-One VIP" ${selectedUser.active_package === 'All-in-One VIP' ? 'selected' : ''}>All-in-One VIP</option>
            </select>
        </div>
    </div>
    `;

  document.getElementById('expiry-date').value = selectedUser.expiry_date ? selectedUser.expiry_date.split('T')[0] : '';
  document.getElementById('admin-notes').value = selectedUser.admin_notes || '';

  const activateBtn = document.getElementById('activate-confirm-btn');
  activateBtn.onclick = async () => {
    const status = document.getElementById('user-status-edit').value;
    const pkg = document.getElementById('user-package-edit').value;
    const expiry = document.getElementById('expiry-date').value;
    const notes = document.getElementById('admin-notes').value;

    const { error } = await window.supabaseClient
      .from('users')
      .update({
        status: status,
        active_package: pkg,
        expiry_date: expiry || null,
        admin_notes: notes
      })
      .eq('id', selectedUser.id);

    if (error) {
      window.showToast('Error: ' + error.message, 'error');
    } else {
      // Log this action
      await window.supabaseClient.from('activity_logs').insert({
        user_id: selectedUser.id,
        action: 'Admin Update',
        details: `Changed status to ${status}, pkg to ${pkg}`
      });
      closeModal();
      refreshData();
    }
  };

  document.getElementById('userModal').classList.add('active');
}

function closeModal() {
  document.getElementById('userModal').classList.remove('active');
}

function updatePromoTable() {
  const tbody = document.getElementById('promo-table-body');
  tbody.innerHTML = allPromoCodes.map(p => `
    <tr>
      <td><strong>${p.code}</strong></td>
      <td>${p.owner_name}</td>
      <td>${p.whatsapp_number}</td>
      <td>
        <div class="price-tags">
          <span>C: $${p.crypto_price}</span>
          <span>F: $${p.forex_price}</span>
          <span>A: $${p.all_price}</span>
        </div>
      </td>
      <td>
        <button class="btn-edit-promo" onclick="editPromo('${p.code}')"><i class="fas fa-edit"></i> Edit</button>
      </td>
    </tr>
  `).join('');
}

function openPromoModal(code = null) {
  const modal = document.getElementById('promoModal');
  const title = document.getElementById('promo-modal-title');
  const codeInp = document.getElementById('promo-code-input');

  if (code) {
    const p = allPromoCodes.find(x => x.code === code);
    title.innerHTML = '<i class="fas fa-edit"></i> Edit Promo Code';
    codeInp.value = p.code;
    codeInp.disabled = true;
    document.getElementById('promo-owner-input').value = p.owner_name;
    
    // Parse bank details JSON
    let banks = [];
    let binanceId = '';
    let otherBank = '';
    
    try {
        const parsed = JSON.parse(p.bank_details);
        if (Array.isArray(parsed)) {
            banks = parsed;
        } else if (parsed && typeof parsed === 'object') {
            banks = parsed.banks || [];
            binanceId = parsed.binance || '';
            otherBank = parsed.other || '';
        }
    } catch(e) {
      if (typeof p.bank_details === 'string') {
          banks = [{ bank: p.bank_details, branch: '', accName: '', accNo: '' }];
      } else {
          banks = [];
      }
    }
    
    document.getElementById('dynamic-banks-container').innerHTML = '';
    
    if (banks.length > 0) {
        banks.forEach(b => addBankForm(b));
    } else {
        addBankForm(); // add at least one empty form
    }

    document.getElementById('promo-binance-id').value = binanceId;
    document.getElementById('promo-bank-input').value = otherBank;

    document.getElementById('promo-crypto-price').value = p.crypto_price;
    document.getElementById('promo-forex-price').value = p.forex_price;
    document.getElementById('promo-all-price').value = p.all_price;
  } else {
    title.innerHTML = '<i class="fas fa-plus-circle"></i> Add New Promo Code';
    codeInp.value = '';
    codeInp.disabled = false;
    document.getElementById('promo-owner-input').value = '';
    document.getElementById('promo-whatsapp-input').value = '';
    document.getElementById('dynamic-banks-container').innerHTML = '';
    addBankForm();
    document.getElementById('promo-binance-id').value = '';
    document.getElementById('promo-bank-input').value = '';
    document.getElementById('promo-crypto-price').value = 30;
    document.getElementById('promo-forex-price').value = 40;
    document.getElementById('promo-all-price').value = 60;
  }

  modal.classList.add('active');
  document.getElementById('save-promo-btn').onclick = () => savePromo(code);
}

async function savePromo(isEdit = null) {
  const code = document.getElementById('promo-code-input').value.toUpperCase();
  if (!code) return window.showToast('Code is required', 'error');

  const bBinance = document.getElementById('promo-binance-id').value;
  const bOther = document.getElementById('promo-bank-input').value;
  
  // Gather dynamic bank details
  const bankItems = document.querySelectorAll('.dynamic-bank-item');
  const banks = [];
  
  bankItems.forEach(item => {
    const bank = item.querySelector('.bank-name').value.trim();
    const branch = item.querySelector('.bank-branch').value.trim();
    const accName = item.querySelector('.bank-acc-name').value.trim();
    const accNo = item.querySelector('.bank-acc-no').value.trim();
    
    if (bank || branch || accName || accNo) {
        banks.push({ bank, branch, accName, accNo });
    }
  });

  const combinedBank = JSON.stringify({
      banks: banks,
      binance: bBinance,
      other: bOther
  });

  const payload = {
    code: code,
    owner_name: document.getElementById('promo-owner-input').value,
    whatsapp_number: document.getElementById('promo-whatsapp-input').value,
    bank_details: combinedBank,
    crypto_price: parseFloat(document.getElementById('promo-crypto-price').value),
    forex_price: parseFloat(document.getElementById('promo-forex-price').value),
    all_price: parseFloat(document.getElementById('promo-all-price').value)
  };

  const { error } = await window.supabaseClient.from('promo_codes').upsert(payload);

  if (error) {
    window.showToast('Error: ' + error.message, 'error');
  } else {
    closePromoModal();
    window.showToast('Promo code saved!', 'success');
    refreshData();
  }
}

function closePromoModal() {
  document.getElementById('promoModal').classList.remove('active');
}

// Announcements Logic
function updateAnnouncementTable() {
  const tbody = document.getElementById('announcement-table-body');
  tbody.innerHTML = allAnnouncements.map(a => `
    <tr>
        <td>${a.content}</td>
        <td><span class="badge ${a.type}">${a.type}</span></td>
        <td>${a.is_active ? 'Active' : 'Expired'}</td>
        <td>${new Date(a.created_at).toLocaleDateString()}</td>
        <td>
            <button class="btn-manage danger" onclick="deleteAnnouncement('${a.id}')"><i class="fas fa-trash"></i></button>
        </td>
    </tr>
    `).join('');
}

function openAnnouncementModal() {
  document.getElementById('announcementModal').classList.add('active');
}

function closeAnnouncementModal() {
  document.getElementById('announcementModal').classList.remove('active');
}

async function saveAnnouncement() {
  const content = document.getElementById('ann-content-input').value;
  const type = document.getElementById('ann-type-input').value;

  if (!content) return window.showToast('Please enter announcement content', 'error');

  const { error } = await window.supabaseClient
    .from('announcements')
    .insert({ content, type });

  if (error) window.showToast(error.message, 'error');
  else {
    closeAnnouncementModal();
    window.showToast('Announcement posted!', 'success');
    refreshData();
  }
}

async function deleteAnnouncement(id) {
  if (!confirm('Are you sure you want to delete this announcement?')) return;
  const { error } = await window.supabaseClient.from('announcements').delete().eq('id', id);
  if (error) window.showToast(error.message, 'error');
  else { window.showToast('Announcement deleted', 'success'); refreshData(); }
}

function editPromo(code) {
  openPromoModal(code);
}

function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
  document.getElementById(`${tabId}-tab`).classList.remove('hidden');

  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  document.querySelector(`.sidebar-nav a[href="#${tabId}"]`).classList.add('active');

  const titleMap = {
    analytics: 'Analytics Overview',
    users: 'User Management',
    promo: 'Promo Codes',
    links: 'Group Links',
    announcements: 'Global Announcements',
    settings: 'Admin Settings'
  };
  document.getElementById('tab-title').textContent = titleMap[tabId] || 'Dashboard';
  
  // Close sidebar on mobile after clicking
  if (window.innerWidth <= 1024) {
    document.getElementById('adminSidebar').classList.remove('active');
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) overlay.classList.remove('active');
  }
}

function saveAdminSettings() {
    const email = document.getElementById('admin-display-email-input').value;
    document.getElementById('admin-email').textContent = email;
    window.showToast('Settings saved locally! (DB implementation required)', 'success');
}

// Sidebar Toggle with overlay
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (window.innerWidth <= 1024) {
        sidebar.classList.toggle('active');
        if (overlay) overlay.classList.toggle('active');
    } else {
        document.body.classList.toggle('sidebar-collapsed');
    }
});

// Close sidebar when overlay is clicked
document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
    document.getElementById('adminSidebar').classList.remove('active');
    document.getElementById('sidebarOverlay').classList.remove('active');
});

window.onload = async () => {
    await initAdmin();
};
document.getElementById('user-search').addEventListener('input', updateUserTable);
document.getElementById('status-filter').addEventListener('change', updateUserTable);

// Export for window access
window.openAnnouncementModal = openAnnouncementModal;
window.closeAnnouncementModal = closeAnnouncementModal;
window.saveAnnouncement = saveAnnouncement;
window.deleteAnnouncement = deleteAnnouncement;

function toggleTheme() {
  document.body.classList.toggle('light-theme');
}

window.showTab = showTab;
window.openPromoModal = openPromoModal;
window.closePromoModal = closePromoModal;
window.savePromo = savePromo;
window.openUserModal = openUserModal;
window.closeModal = closeModal;
window.toggleTheme = toggleTheme;
window.saveAdminSettings = saveAdminSettings;
window.editPromo = editPromo;

// Group Links Functions
function updateLinksTable() {
  const filter = document.getElementById('link-package-filter').value;
  let filtered = allGroupLinks;
  if (filter !== 'All') {
    filtered = allGroupLinks.filter(l => l.package === filter);
  }
  
  const tbody = document.getElementById('links-table-body');
  tbody.innerHTML = filtered.map(l => `
    <tr>
      <td><span class="badge ${l.package.split(' ')[0].toLowerCase()}">${l.package}</span></td>
      <td><strong>${l.name}</strong></td>
      <td><a href="${l.url}" target="_blank">${l.url}</a></td>
      <td>
        <button class="btn-manage" onclick="editLink('${l.id}')"><i class="fas fa-edit"></i> Edit</button>
        <button class="btn-manage danger" onclick="deleteLink('${l.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

function openLinkModal(id = null) {
  const modal = document.getElementById('linkModal');
  const title = document.getElementById('link-modal-title');
  const idInp = document.getElementById('link-id-input');
  
  if (id) {
    const l = allGroupLinks.find(x => x.id === id);
    title.innerHTML = '<i class="fas fa-edit"></i> Edit Link';
    idInp.value = l.id;
    document.getElementById('link-package-input').value = l.package;
    document.getElementById('link-name-input').value = l.name;
    document.getElementById('link-url-input').value = l.url;
  } else {
    title.innerHTML = '<i class="fas fa-plus-circle"></i> Add New Link';
    idInp.value = '';
    document.getElementById('link-package-input').value = 'Free';
    document.getElementById('link-name-input').value = '';
    document.getElementById('link-url-input').value = '';
  }
  modal.classList.add('active');
}

function closeLinkModal() {
  document.getElementById('linkModal').classList.remove('active');
}

async function saveLink() {
  const idValue = document.getElementById('link-id-input').value;
  const pkg = document.getElementById('link-package-input').value;
  const name = document.getElementById('link-name-input').value.trim();
  const url = document.getElementById('link-url-input').value.trim();

  if (!name || !url) return window.showToast('Please fill all fields', 'error');

  const newLink = {
    id: idValue || Date.now().toString(),
    package: pkg,
    name: name,
    url: url
  };

  let newArray = [...allGroupLinks];
  if (idValue) {
    const idx = newArray.findIndex(l => l.id === idValue);
    if (idx !== -1) newArray[idx] = newLink;
  } else {
    newArray.push(newLink);
  }

  const { error } = await window.supabaseClient.from('admin_config').upsert({
    key_name: 'group_links',
    key_value: JSON.stringify(newArray)
  });

  if (error) {
    window.showToast(error.message, 'error');
  } else {
    window.showToast('Link Saved', 'success');
    closeLinkModal();
    refreshData();
  }
}

async function deleteLink(id) {
  if (!confirm('Are you sure you want to delete this link?')) return;
  const newArray = allGroupLinks.filter(l => l.id !== id);
  const { error } = await window.supabaseClient.from('admin_config').upsert({
    key_name: 'group_links',
    key_value: JSON.stringify(newArray)
  });
  if (error) window.showToast(error.message, 'error');
  else {
    window.showToast('Link Deleted', 'success');
    refreshData();
  }
}

function editLink(id) {
  openLinkModal(id);
}

window.updateLinksTable = updateLinksTable;
window.openLinkModal = openLinkModal;
window.closeLinkModal = closeLinkModal;
window.saveLink = saveLink;
window.deleteLink = deleteLink;
window.editLink = editLink;

function addBankForm(data = { bank: '', branch: '', accName: '', accNo: '' }) {
    const container = document.getElementById('dynamic-banks-container');
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    
    const html = `
        <div class="dynamic-bank-item admin-section" id="bank-${id}" style="position: relative; padding: 1rem; margin-bottom: 1rem;">
            <button type="button" class="btn-manage danger" style="position: absolute; top: 10px; right: 10px; padding: 0.3rem 0.6rem;" onclick="removeBankForm('bank-${id}')"><i class="fas fa-times"></i></button>
            <h4 style="margin-bottom: 0.8rem; font-size: 0.95rem;">Bank Detail</h4>
            <div class="field-grid">
                <div class="field">
                    <label>Bank Name</label>
                    <input type="text" class="bank-name" placeholder="e.g. HNB Bank" value="${data.bank}">
                </div>
                <div class="field">
                    <label>Branch</label>
                    <input type="text" class="bank-branch" placeholder="e.g. Colombo 01" value="${data.branch}">
                </div>
                <div class="field">
                    <label>Account Name</label>
                    <input type="text" class="bank-acc-name" placeholder="e.g. John Doe" value="${data.accName}">
                </div>
                <div class="field">
                    <label>Account Number</label>
                    <input type="text" class="bank-acc-no" placeholder="e.g. 12345678" value="${data.accNo}">
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
}

window.addBankForm = addBankForm;
window.removeBankForm = function(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
};
