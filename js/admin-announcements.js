// Admin Announcements Management
class AdminAnnouncements {
  constructor() {
    this.announcements = [];
    this.filteredAnnouncements = [];
    this.init();
  }

  init() {
    // Check authentication
    if (!requireAuth() || !requireRole('admin')) {
      return;
    }
    this.loadAnnouncements();
    this.setupEventListeners();
    this.handleURLParams();
  }

  setupEventListeners() {
    // Search and filter
    document.getElementById('searchInput').addEventListener('input', () => this.filterAnnouncements());
    document.getElementById('audienceFilter').addEventListener('change', () => this.filterAnnouncements());
    document.getElementById('statusFilter').addEventListener('change', () => this.filterAnnouncements());

    // Form submission
    document.getElementById('announcementForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.publishAnnouncement();
    });
  }

  handleURLParams() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'create') {
      this.showCreateAnnouncementModal();
    }
  }

  loadAnnouncements() {
    try {
      this.announcements = campusDB.getStorageData('announcements');
      this.filteredAnnouncements = [...this.announcements];
      this.updateStats();
      this.renderAnnouncements();
    } catch (error) {
      console.error('Error loading announcements:', error);
      this.showAlert('Error loading announcements', 'error');
    }
  }

  updateStats() {
    const now = new Date();
    const total = this.announcements.length;
    const active = this.announcements.filter(a => a.is_active && (!a.expires_at || new Date(a.expires_at) > now)).length;
    const draft = this.announcements.filter(a => a.status === 'draft').length;
    const scheduled = this.announcements.filter(a => a.scheduled_at && new Date(a.scheduled_at) > now).length;

    document.getElementById('totalAnnouncements').textContent = total;
    document.getElementById('activeAnnouncements').textContent = active;
    document.getElementById('draftAnnouncements').textContent = draft;
    document.getElementById('scheduledAnnouncements').textContent = scheduled;
  }

  filterAnnouncements() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const audienceFilter = document.getElementById('audienceFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;

    this.filteredAnnouncements = this.announcements.filter(announcement => {
      const matchesSearch = !searchTerm || announcement.title.toLowerCase().includes(searchTerm) || announcement.content.toLowerCase().includes(searchTerm);
      const matchesAudience = !audienceFilter || announcement.target_audience === audienceFilter;
      let matchesStatus = true;

      if (statusFilter) {
        const now = new Date();
        switch (statusFilter) {
          case 'active':
            matchesStatus = announcement.is_active && (!announcement.expires_at || new Date(announcement.expires_at) > now);
            break;
          case 'draft':
            matchesStatus = announcement.status === 'draft';
            break;
          case 'scheduled':
            matchesStatus = announcement.scheduled_at && new Date(announcement.scheduled_at) > now;
            break;
          case 'expired':
            matchesStatus = announcement.expires_at && new Date(announcement.expires_at) <= now;
            break;
        }
      }
      return matchesSearch && matchesAudience && matchesStatus;
    });
    this.renderAnnouncements();
  }

  renderAnnouncements() {
    const container = document.getElementById('announcementsList');
    if (this.filteredAnnouncements.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 40px;">No announcements found</p>';
      return;
    }

    container.innerHTML = this.filteredAnnouncements.map(announcement => {
      const createdDate = new Date(announcement.created_at);
      const now = new Date();
      const isExpired = announcement.expires_at && new Date(announcement.expires_at) <= now;
      const isPinned = announcement.is_pinned;

      return `
        <div class="announcement-item" style="padding: 20px; margin-bottom: 15px; border: 1px solid var(--gray-200); border-radius: 8px; ${isPinned ? 'border-left: 4px solid var(--primary);' : ''}">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
            <div>
              <h3 style="margin: 0; color: var(--gray-800); display: flex; align-items: center; gap: 10px;">
                ${isPinned ? '<span style="background: var(--primary); color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.7rem;">PINNED</span>' : ''}
                ${announcement.title}
                <span class="badge ${this.getPriorityBadgeClass(announcement.priority || 'normal')}">
                  ${(announcement.priority || 'normal').toUpperCase()}
                </span>
              </h3>
              <div style="margin: 5px 0; color: var(--gray-600); font-size: 0.9rem;">
                <span>🎯 ${this.getAudienceText(announcement.target_audience)}</span>
                <span style="margin-left: 15px;">📅 ${createdDate.toLocaleDateString()}</span>
                ${announcement.expires_at ? `<span style="margin-left: 15px;">⏰ Expires: ${new Date(announcement.expires_at).toLocaleDateString()}</span>` : ''}
              </div>
            </div>
            <div>
              <span class="badge ${this.getStatusBadgeClass(announcement, isExpired)}">
                ${this.getStatusText(announcement, isExpired)}
              </span>
            </div>
          </div>
          <div style="color: var(--gray-700); margin-bottom: 15px; line-height: 1.5;">
            ${announcement.content.length > 200 ? announcement.content.substring(0, 200) + '...' : announcement.content}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 0.8rem; color: var(--gray-500);">
              Created by: ${announcement.created_by_name || 'Admin'}
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary btn-sm" onclick="adminAnnouncements.previewAnnouncement(${announcement.id})">
                <span>👁️</span> Preview
              </button>
              <button class="btn btn-primary btn-sm" onclick="adminAnnouncements.editAnnouncement(${announcement.id})">
                <span>✏️</span> Edit
              </button>
              <button class="btn btn-${announcement.is_active ? 'warning' : 'success'} btn-sm" onclick="adminAnnouncements.toggleAnnouncementStatus(${announcement.id})">
                <span>${announcement.is_active ? '⏸️' : '▶️'}</span> ${announcement.is_active ? 'Disable' : 'Enable'}
              </button>
              <button class="btn btn-danger btn-sm" onclick="adminAnnouncements.deleteAnnouncement(${announcement.id})">
                <span>🗑️</span> Delete
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  getPriorityBadgeClass(priority) {
    switch (priority) {
      case 'urgent':
        return 'badge-error';
      case 'high':
        return 'badge-warning';
      default:
        return 'badge-info';
    }
  }

  getAudienceText(audience) {
    switch (audience) {
      case 'all':
        return 'All Users';
      case 'student':
        return 'Students Only';
      case 'faculty':
        return 'Faculty Only';
      case 'admin':
        return 'Admin Only';
      default:
        return 'Unknown';
    }
  }

  getStatusBadgeClass(announcement, isExpired) {
    if (isExpired) return 'badge-error';
    if (announcement.status === 'draft') return 'badge-secondary';
    if (announcement.is_active) return 'badge-success';
    return 'badge-warning';
  }

  getStatusText(announcement, isExpired) {
    if (isExpired) return 'Expired';
    if (announcement.status === 'draft') return 'Draft';
    if (announcement.is_active) return 'Active';
    return 'Inactive';
  }

  showCreateAnnouncementModal() {
    document.getElementById('announcementModalTitle').textContent = 'Create Announcement';
    document.getElementById('announcementForm').reset();
    document.getElementById('announcementId').value = '';
    document.getElementById('announcementModal').style.display = 'flex';
  }

  editAnnouncement(id) {
    const announcement = this.announcements.find(a => a.id === id);
    if (!announcement) return;

    document.getElementById('announcementModalTitle').textContent = 'Edit Announcement';
    document.getElementById('announcementId').value = announcement.id;
    document.getElementById('announcementTitle').value = announcement.title;
    document.getElementById('announcementContent').value = announcement.content;
    document.getElementById('announcementAudience').value = announcement.target_audience;
    document.getElementById('announcementPriority').value = announcement.priority || 'normal';
    if (announcement.expires_at) {
      document.getElementById('announcementExpiry').value = announcement.expires_at.split('T')[0];
    }
    document.getElementById('sendEmail').checked = announcement.send_email !== false;
    document.getElementById('pinAnnouncement').checked = announcement.is_pinned || false;

    document.getElementById('announcementModal').style.display = 'flex';
  }

  previewAnnouncement(id) {
    const announcement = this.announcements.find(a => a.id === id);
    if (!announcement) return;

    const previewContent = document.getElementById('previewContent');
    const createdDate = new Date(announcement.created_at);

    previewContent.innerHTML = `
      <div style="border: 1px solid var(--gray-200); border-radius: 8px; padding: 20px; background: white;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
          <div>
            <h2 style="margin: 0; color: var(--gray-800);">
              ${announcement.is_pinned ? '<span style="background: var(--primary); color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.7rem; margin-right: 10px;">PINNED</span>' : ''}
              ${announcement.title}
            </h2>
            <div style="margin-top: 5px; color: var(--gray-600); font-size: 0.9rem;">
              <span>📅 ${createdDate.toLocaleDateString()}</span>
              <span style="margin-left: 15px;">🎯 ${this.getAudienceText(announcement.target_audience)}</span>
              ${announcement.expires_at ? `<span style="margin-left: 15px;">⏰ Expires: ${new Date(announcement.expires_at).toLocaleDateString()}</span>` : ''}
            </div>
          </div>
          <div>
            <span class="badge ${this.getPriorityBadgeClass(announcement.priority || 'normal')}">
              ${(announcement.priority || 'normal').toUpperCase()}
            </span>
          </div>
        </div>
        <div style="color: var(--gray-700); line-height: 1.6; white-space: pre-wrap;">
          ${announcement.content}
        </div>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid var(--gray-200);">
        <div style="display: flex; justify-content: between; align-items: center; color: var(--gray-500); font-size: 0.8rem;">
          <span>Published by: ${announcement.created_by_name || 'Admin'}</span>
        </div>
      </div>
    `;
    document.getElementById('previewModal').style.display = 'flex';
  }

  saveDraft() {
    this.saveAnnouncement('draft');
  }

  publishAnnouncement() {
    this.saveAnnouncement('published');
  }

  saveAnnouncement(status) {
    const currentUser = getCurrentUser();
    const formData = {
      title: document.getElementById('announcementTitle').value,
      content: document.getElementById('announcementContent').value,
      target_audience: document.getElementById('announcementAudience').value,
      priority: document.getElementById('announcementPriority').value || 'normal',
      expires_at: document.getElementById('announcementExpiry').value || null,
      send_email: document.getElementById('sendEmail').checked,
      is_pinned: document.getElementById('pinAnnouncement').checked,
      status: status,
      is_active: status === 'published',
      created_by: currentUser.id,
      created_by_name: currentUser.name
    };

    try {
      const announcementId = document.getElementById('announcementId').value;
      if (announcementId) {
        // Update existing announcement
        campusDB.update('announcements', parseInt(announcementId), formData);
        this.showAlert(`Announcement ${status === 'draft' ? 'saved as draft' : 'updated'} successfully`, 'success');
      } else {
        // Create new announcement
        campusDB.create('announcements', formData);
        this.showAlert(`Announcement ${status === 'draft' ? 'saved as draft' : 'published'} successfully`, 'success');
      }
      this.hideAnnouncementModal();
      this.loadAnnouncements();

      // Simulate email notification if enabled
      if (formData.send_email && status === 'published') {
        this.showAlert('Email notifications sent to target audience', 'info');
      }
    } catch (error) {
      console.error('Error saving announcement:', error);
      this.showAlert('Error saving announcement', 'error');
    }
  }

  toggleAnnouncementStatus(id) {
    try {
      const announcement = this.announcements.find(a => a.id === id);
      if (!announcement) return;

      const newStatus = !announcement.is_active;
      campusDB.update('announcements', id, {
        is_active: newStatus
      });
      this.showAlert(`Announcement ${newStatus ? 'enabled' : 'disabled'} successfully`, 'success');
      this.loadAnnouncements();
    } catch (error) {
      console.error('Error updating announcement status:', error);
      this.showAlert('Error updating announcement status', 'error');
    }
  }

  deleteAnnouncement(id) {
    const announcement = this.announcements.find(a => a.id === id);
    if (!announcement) return;

    if (!confirm(`Are you sure you want to delete the announcement "${announcement.title}"? This action cannot be undone.`)) {
      return;
    }
    try {
      campusDB.delete('announcements', id);
      this.showAlert('Announcement deleted successfully', 'success');
      this.loadAnnouncements();
    } catch (error) {
      console.error('Error deleting announcement:', error);
      this.showAlert('Error deleting announcement', 'error');
    }
  }

  hideAnnouncementModal() {
    document.getElementById('announcementModal').style.display = 'none';
  }

  hidePreviewModal() {
    document.getElementById('previewModal').style.display = 'none';
  }

  showAlert(message, type) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.content-area .alert');
    existingAlerts.forEach(alert => alert.remove());

    // Create new alert
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    // Insert at top of content area
    const contentArea = document.querySelector('.content-area');
    contentArea.insertBefore(alert, contentArea.firstChild);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (alert.parentNode) {
        alert.remove();
      }
    }, 5000);
  }
}

// Global functions for inline event handlers
function showCreateAnnouncementModal() {
  adminAnnouncements.showCreateAnnouncementModal();
}

function hideAnnouncementModal() {
  adminAnnouncements.hideAnnouncementModal();
}

function hidePreviewModal() {
  adminAnnouncements.hidePreviewModal();
}

function saveDraft() {
  adminAnnouncements.saveDraft();
}

function publishAnnouncement() {
  adminAnnouncements.publishAnnouncement();
}

// Initialize when DOM is loaded
let adminAnnouncements;
document.addEventListener('DOMContentLoaded', () => {
  adminAnnouncements = new AdminAnnouncements();
});