// Admin Dashboard Management
class AdminDashboard {
  constructor() {
    this.statistics = {
      students: 0,
      faculty: 0,
      departments: 0,
      pendingFees: 0
    };
    this.recentActivities = [];
    this.systemOverview = [];
    this.init();
  }

  init() {
    // Check authentication
    if (!requireAuth() || !requireRole('admin')) {
      return;
    }

    this.loadDashboardData();
    this.updateDateTime();
    this.displayUserWelcome();
    
    // Update time every minute
    setInterval(() => this.updateDateTime(), 60000);
  }

  loadDashboardData() {
    try {
      this.loadStatistics();
      this.loadRecentActivities();
      this.loadSystemOverview();
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.showAlert('Error loading dashboard data', 'error');
    }
  }

  loadStatistics() {
    try {
      const students = campusDB.getStorageData('students');
      const faculty = campusDB.getStorageData('faculty');
      const departments = campusDB.getStorageData('departments');
      const fees = campusDB.getStorageData('fees');

      this.statistics.students = students.length;
      this.statistics.faculty = faculty.length;
      this.statistics.departments = departments.length;
      this.statistics.pendingFees = fees.reduce((total, fee) => {
        return total + (fee.status !== 'paid' ? fee.due_amount : 0);
      }, 0);

      // Update DOM elements
      document.getElementById('totalStudents').textContent = this.statistics.students;
      document.getElementById('totalFaculty').textContent = this.statistics.faculty;
      document.getElementById('totalDepartments').textContent = this.statistics.departments;
      document.getElementById('pendingFees').textContent = `₹${this.statistics.pendingFees.toLocaleString()}`;

    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  }

  loadRecentActivities() {
    try {
      const activities = authSystem.getRecentActivities();
      const users = campusDB.getStorageData('users');
      const students = campusDB.getStorageData('students');
      const faculty = campusDB.getStorageData('faculty');

      // Get recent 10 activities
      this.recentActivities = activities
        .slice(-10)
        .reverse()
        .map(activity => {
          const user = users.find(u => u.id === activity.userId);
          const userName = user ? user.name : 'Unknown User';
          const userRole = user ? user.role : 'unknown';

          return {
            ...activity,
            userName: userName,
            userRole: userRole,
            formattedTime: this.formatRelativeTime(new Date(activity.timestamp))
          };
        });

      this.renderRecentActivities();

    } catch (error) {
      console.error('Error loading recent activities:', error);
      this.renderRecentActivitiesError();
    }
  }

  renderRecentActivities() {
    const container = document.getElementById('recentActivities');
    
    if (this.recentActivities.length === 0) {
      container.innerHTML = '<p style="color: var(--gray-500); text-align: center; padding: 20px;">No recent activities</p>';
      return;
    }

    container.innerHTML = this.recentActivities.map(activity => {
      const actionIcon = this.getActionIcon(activity.action);
      const actionText = this.getActionText(activity.action);
      const roleColor = this.getRoleColor(activity.userRole);

      return `
        <div class="activity-item" style="padding: 12px 0; border-bottom: 1px solid var(--gray-200); display: flex; align-items: center;">
          <span style="margin-right: 10px; font-size: 1.2rem;">${actionIcon}</span>
          <div style="flex: 1;">
            <div style="font-weight: 500; color: var(--gray-800);">
              ${actionText}
            </div>
            <div style="font-size: 0.8rem; color: var(--gray-600); margin-top: 2px;">
              by <span style="color: ${roleColor}; font-weight: 500;">${activity.userName}</span> (${activity.userRole})
            </div>
          </div>
          <div style="font-size: 0.8rem; color: var(--gray-500);">
            ${activity.formattedTime}
          </div>
        </div>
      `;
    }).join('');
  }

  renderRecentActivitiesError() {
    const container = document.getElementById('recentActivities');
    container.innerHTML = '<p style="color: var(--error); text-align: center; padding: 20px;">Error loading activities</p>';
  }

  getActionIcon(action) {
    const icons = {
      login: '🔑',
      logout: '🚪',
      password_change: '🔐',
      password_reset: '🔄',
      create: '➕',
      update: '✏️',
      delete: '🗑️',
      import: '📥',
      export: '📤'
    };
    return icons[action] || '📝';
  }

  getActionText(action) {
    const texts = {
      login: 'User logged in',
      logout: 'User logged out',
      password_change: 'Password changed',
      password_reset: 'Password reset',
      create: 'Record created',
      update: 'Record updated',
      delete: 'Record deleted',
      import: 'Data imported',
      export: 'Data exported'
    };
    return texts[action] || 'Activity performed';
  }

  getRoleColor(role) {
    const colors = {
      admin: 'var(--error)',
      faculty: 'var(--success)',
      student: 'var(--primary)',
      unknown: 'var(--gray-500)'
    };
    return colors[role] || 'var(--gray-500)';
  }

  loadSystemOverview() {
    try {
      const departments = campusDB.getStorageData('departments');
      const students = campusDB.getStorageData('students');
      const faculty = campusDB.getStorageData('faculty');
      const attendance = campusDB.getStorageData('attendance');
      const fees = campusDB.getStorageData('fees');

      this.systemOverview = departments.map(dept => {
        // Count students in this department
        const deptStudents = students.filter(s => s.branch === dept.name);
        
        // Count faculty in this department
        const deptFaculty = faculty.filter(f => f.department === dept.name);
        
        // Calculate attendance rate for this department
        const deptStudentIds = deptStudents.map(s => s.id);
        const deptAttendance = attendance.filter(a => deptStudentIds.includes(a.student_id));
        const presentCount = deptAttendance.filter(a => a.status === 'present').length;
        const attendanceRate = deptAttendance.length > 0 
          ? Math.round((presentCount / deptAttendance.length) * 100) 
          : 0;

        // Calculate fee collection for this department
        const deptFees = fees.filter(f => deptStudentIds.includes(f.student_id));
        const totalFees = deptFees.reduce((sum, f) => sum + f.total_fee, 0);
        const paidFees = deptFees.reduce((sum, f) => sum + f.paid_amount, 0);
        const collectionRate = totalFees > 0 
          ? Math.round((paidFees / totalFees) * 100) 
          : 100;

        return {
          department: dept.name,
          students: deptStudents.length,
          faculty: deptFaculty.length,
          attendanceRate: attendanceRate,
          feeCollection: collectionRate
        };
      });

      this.renderSystemOverview();

    } catch (error) {
      console.error('Error loading system overview:', error);
      this.renderSystemOverviewError();
    }
  }

  renderSystemOverview() {
    const tbody = document.getElementById('systemOverview');
    
    if (this.systemOverview.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No departments found</td></tr>';
      return;
    }

    tbody.innerHTML = this.systemOverview.map(dept => `
      <tr>
        <td><strong>${dept.department}</strong></td>
        <td>${dept.students}</td>
        <td>${dept.faculty}</td>
        <td>
          <span class="badge ${dept.attendanceRate >= 75 ? 'badge-success' : dept.attendanceRate >= 60 ? 'badge-warning' : 'badge-error'}">
            ${dept.attendanceRate}%
          </span>
        </td>
        <td>
          <span class="badge ${dept.feeCollection >= 90 ? 'badge-success' : dept.feeCollection >= 70 ? 'badge-warning' : 'badge-error'}">
            ${dept.feeCollection}%
          </span>
        </td>
      </tr>
    `).join('');
  }

  renderSystemOverviewError() {
    const tbody = document.getElementById('systemOverview');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500">Error loading system overview</td></tr>';
  }

  updateDateTime() {
    const now = new Date();
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit'
    };
    
    const dateTimeElement = document.getElementById('currentDateTime');
    if (dateTimeElement) {
      dateTimeElement.textContent = now.toLocaleDateString('en-US', options);
    }
  }

  displayUserWelcome() {
    const user = getCurrentUser();
    const welcomeElement = document.getElementById('userWelcome');
    if (user && welcomeElement) {
      welcomeElement.textContent = `Welcome, ${user.name}`;
    }
  }

  formatRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  showAlert(message, type) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.content-area .alert');
    existingAlerts.forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
      contentArea.insertBefore(alert, contentArea.firstChild);
    }

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (alert.parentNode) {
        alert.remove();
      }
    }, 5000);
  }

  // Method to refresh dashboard data
  refreshDashboard() {
    this.loadDashboardData();
    this.showAlert('Dashboard refreshed', 'success');
  }

  // Method to export dashboard data
  exportDashboardData() {
    try {
      const dashboardData = {
        statistics: this.statistics,
        systemOverview: this.systemOverview,
        exportDate: new Date().toISOString(),
        exportedBy: getCurrentUser()?.name || 'Admin'
      };

      const dataStr = JSON.stringify(dashboardData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `dashboard_data_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      this.showAlert('Dashboard data exported successfully', 'success');

    } catch (error) {
      console.error('Error exporting dashboard data:', error);
      this.showAlert('Error exporting dashboard data', 'error');
    }
  }
}

// Initialize dashboard when DOM is loaded
let adminDashboard;
document.addEventListener('DOMContentLoaded', () => {
  adminDashboard = new AdminDashboard();
});

// Global functions for dashboard actions
function refreshDashboard() {
  if (adminDashboard) {
    adminDashboard.refreshDashboard();
  }
}

function exportDashboardData() {
  if (adminDashboard) {
    adminDashboard.exportDashboardData();
  }
}