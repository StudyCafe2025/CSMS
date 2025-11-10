// Authentication and Session Management
class AuthenticationSystem {
  constructor() {
    console.log('AuthSystem: Initializing...');
    this.currentUser = null;
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    this.sessionTimer = null;
    this.init();
  }

  init() {
    console.log('AuthSystem: Initializing...');
    this.loadSession();
    this.setupSessionManagement();
  }

  loadSession() {
    console.log('AuthSystem: Attempting to load session...');
    const sessionData = localStorage.getItem('campusiq_session');
    if (sessionData) {
      try {
        const session = JSON.parse(sessionData);
        const now = new Date().getTime();
        
        console.log('AuthSystem: Session data found. Expires:', new Date(session.expires).toLocaleString(), 'Current time:', new Date(now).toLocaleString());
        console.log('AuthSystem: Session user object:', session.user);
        console.log('AuthSystem: Session user role:', session.user ? session.user.role : 'N/A');
        
        // Check if session is still valid
        if (session.expires > now) {
          console.log('AuthSystem: Session is valid. Setting currentUser and extending.');
          this.currentUser = session.user;
          this.extendSession(); // IMPORTANT: Extend session on successful load/refresh
          this.startSessionTimer();
          return true;
        } else {
          console.log('AuthSystem: Session expired. Clearing session.');
          this.clearSession();
        }
      } catch (error) {
        console.error('AuthSystem: Error parsing session data:', error);
        this.clearSession();
      }
    } else {
      console.log('AuthSystem: No session data found in localStorage.');
    }
    return false;
  }

  login(username, password) {
    console.log('AuthSystem: Attempting login for user:', username);
    console.log('AuthSystem: Checking window.campusDB state before login:', window.campusDB); // ADDED LOG
    if (!window.campusDB) {
      console.error('AuthSystem: campusDB is not available. Database not connected.');
      return { success: false, error: 'Database not connected. Please try again later.' };
    }
    try {
      // Authenticate with database
      const user = campusDB.authenticate(username, password);
      console.log('AuthSystem: Result from campusDB.authenticate:', user);
      
      if (!user) {
        throw new Error('Invalid username or password');
      }

      // Create session
      const session = {
        user: user,
        loginTime: new Date().getTime(),
        expires: new Date().getTime() + this.sessionTimeout
      };
      console.log('AuthSystem: Creating session with user role:', session.user.role);

      localStorage.setItem('campusiq_session', JSON.stringify(session));
      this.currentUser = user;
      this.startSessionTimer();
      console.log('AuthSystem: Login successful. Session expires:', new Date(session.expires).toLocaleString());

      // Log login activity
      this.logActivity('login', user.id);

      return { success: true, user: user };
    } catch (error) {
      console.error('AuthSystem: Login error:', error);
      return { success: false, error: error.message };
    }
  }

  logout() {
    console.log('AuthSystem: Logging out user:', this.currentUser ? this.currentUser.username : 'N/A');
    try {
      if (this.currentUser) {
        this.logActivity('logout', this.currentUser.id);
      }
      
      this.clearSession();
      
      // Redirect to login page
      if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
        window.location.href = '/index.html';
      }
      return { success: true };
    } catch (error) {
      console.error('AuthSystem: Logout error:', error);
      return { success: false, error: error.message };
    }
  }

  clearSession() {
    console.log('AuthSystem: Clearing session from localStorage.');
    localStorage.removeItem('campusiq_session');
    this.currentUser = null;
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
      console.log('AuthSystem: Session timer cleared.');
    }
  }

  startSessionTimer() {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }

    this.sessionTimer = setTimeout(() => {
      console.log('AuthSystem: Session timer expired. Showing alert and logging out.');
      this.showSessionExpiredAlert();
      this.logout();
    }, this.sessionTimeout);
    console.log('AuthSystem: Session timer started/restarted. Timeout in', this.sessionTimeout / 1000, 'seconds.');
  }

  extendSession() {
    if (this.currentUser) {
      const session = {
        user: this.currentUser,
        loginTime: new Date().getTime(),
        expires: new Date().getTime() + this.sessionTimeout
      };
      
      localStorage.setItem('campusiq_session', JSON.stringify(session));
      this.startSessionTimer();
      console.log('AuthSystem: Session extended. New expiration:', new Date(session.expires).toLocaleString());
    } else {
      console.log('AuthSystem: Cannot extend session, no currentUser.');
    }
  }

  setupSessionManagement() {
    // Extend session on user activity
    const activities = ['click', 'keypress', 'mousemove', 'scroll'];
    let lastActivity = new Date().getTime();

    activities.forEach(activity => {
      document.addEventListener(activity, () => {
        const now = new Date().getTime();
        // Only extend session if 5 minutes have passed since last activity
        if (now - lastActivity > 5 * 60 * 1000) {
          console.log('AuthSystem: User activity detected. Extending session.');
          this.extendSession();
          lastActivity = now;
        }
      });
    });

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.currentUser) {
        console.log('AuthSystem: Page visible again. Extending session.');
        this.extendSession();
      }
    });
  }

  showSessionExpiredAlert() {
    alert('Your session has expired. Please log in again.');
  }

  getCurrentUser() {
    // ADDED: Make getCurrentUser more resilient
    if (this.currentUser) {
      return this.currentUser;
    }
    // If currentUser is null, try to load from session storage
    const sessionData = localStorage.getItem('campusiq_session');
    if (sessionData) {
      try {
        const session = JSON.parse(sessionData);
        const now = new Date().getTime();
        if (session.expires > now) {
          this.currentUser = session.user; // Re-set currentUser
          console.log('AuthSystem: getCurrentUser() re-loaded currentUser from session.');
          return this.currentUser;
        } else {
          this.clearSession();
        }
      } catch (error) {
        console.error('AuthSystem: Error parsing session data in getCurrentUser:', error);
        this.clearSession();
      }
    }
    return null;
  }

  isAuthenticated() {
    const authenticated = this.getCurrentUser() !== null; // Use resilient getCurrentUser
    console.log('AuthSystem: isAuthenticated() returning:', authenticated);
    return authenticated;
  }

  hasRole(role) {
    const user = this.getCurrentUser(); // Use resilient getCurrentUser
    const hasRequiredRole = user && user.role === role;
    console.log(`AuthSystem: hasRole('${role}') check. Current user role: ${user ? user.role : 'N/A'}, Result: ${hasRequiredRole}`);
    return hasRequiredRole;
  }

  requireAuth() {
    if (!this.isAuthenticated()) {
      console.log('AuthSystem: requireAuth failed. User not authenticated. Redirecting to login.');
      window.location.href = '/index.html';
      return false;
    }
    console.log('AuthSystem: requireAuth successful. User is authenticated.');
    return true;
  }

  requireRole(role) {
    if (!this.requireAuth()) {
      return false;
    }
    
    if (!this.hasRole(role)) {
      console.warn('AuthSystem: Access denied. Insufficient permissions for role:', role);
      alert('Access denied. Insufficient permissions.');
      window.location.href = '/index.html';
      return false;
    }
    console.log('AuthSystem: requireRole successful. User has role:', role);
    return true;
  }

  logActivity(action, userId) {
    try {
      const activities = JSON.parse(localStorage.getItem('campusiq_activities') || '[]');
      const activity = {
        id: Date.now(),
        action: action,
        userId: userId,
        timestamp: new Date().toISOString(),
        ip: 'localhost', // In real app, get actual IP
        userAgent: navigator.userAgent
      };
      
      activities.push(activity);
      
      // Keep only last 100 activities
      if (activities.length > 100) {
        activities.splice(0, activities.length - 100);
      }
      
      localStorage.setItem('campusiq_activities', JSON.stringify(activities));
      console.log('AuthSystem: Activity logged:', action, 'by user:', userId);
    } catch (error) {
      console.error('AuthSystem: Error logging activity:', error);
    }
  }

  getRecentActivities() {
    try {
      return JSON.parse(localStorage.getItem('campusiq_activities') || '[]');
    } catch (error) {
      console.error('AuthSystem: Error getting activities:', error);
      return [];
    }
  }

  changePassword(currentPassword, newPassword) {
    console.log('AuthSystem: Attempting password change for user:', this.currentUser ? this.currentUser.username : 'N/A');
    try {
      if (!this.currentUser) {
        throw new Error('User not authenticated');
      }

      // Verify current password
      const user = campusDB.authenticate(this.currentUser.username, currentPassword);
      if (!user) {
        throw new Error('Current password is incorrect');
      }

      // Update password in database
      campusDB.update('users', this.currentUser.id, { password: newPassword });
      
      // Log password change
      this.logActivity('password_change', this.currentUser.id);
      
      console.log('AuthSystem: Password changed successfully.');
      return { success: true };
    } catch (error) {
      console.error('AuthSystem: Password change error:', error);
      return { success: false, error: error.message };
    }
  }

  resetPassword(username, email) {
    console.log('AuthSystem: Attempting password reset for user:', username);
    if (!window.campusDB) {
      console.error('AuthSystem: campusDB is not available for password reset. Database not connected.');
      return { success: false, error: 'Database not connected. Please try again later.' };
    };
    try {
      const users = campusDB.getStorageData('users');
      const user = users.find(u => u.username === username && u.email === email);
      
      if (!user) {
        throw new Error('User not found with provided username and email');
      }

      // In a real app, you would send an email with reset link
      // For demo, we'll generate a temporary password
      const tempPassword = this.generateTempPassword();
      
      campusDB.update('users', user.id, { password: tempPassword });
      
      this.logActivity('password_reset', user.id);
      
      console.log('AuthSystem: Password reset successful. Temporary password generated.');
      return { 
        success: true, 
        message: `Temporary password generated: ${tempPassword}\nPlease change it after login.` 
      };
    } catch (error) {
      console.error('AuthSystem: Password reset error:', error);
      return { success: false, error: error.message };
    }
  }

  generateTempPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

// Initialize authentication system
const authSystem = new AuthenticationSystem();
console.log('AuthSystem: authSystem instance created.');

// Global functions for backward compatibility
function getCurrentUser() {
  return authSystem.getCurrentUser();
}

function requireAuth() {
  return authSystem.requireAuth();
}

function requireRole(role) {
  return authSystem.requireRole(role);
}

function logout() {
  return authSystem.logout();
}

// DOM event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Handle login form if present
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleLogin();
    });
  }

  // Handle password toggle if present
  const togglePassword = document.getElementById('togglePassword');
  if (togglePassword) {
    togglePassword.addEventListener('click', () => {
      const passwordField = document.getElementById('password');
      const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordField.setAttribute('type', type);
      togglePassword.textContent = type === 'password' ? '👁️' : '🙈';
    });
  }

  // Handle logout buttons
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('logout-btn') || e.target.closest('.logout-btn')) {
      e.preventDefault();
      if (confirm('Are you sure you want to logout?')) {
        authSystem.logout();
      }
    }
  });

  // Handle forgot password if present
  const forgotPassword = document.getElementById('forgotPassword');
  if (forgotPassword) {
    forgotPassword.addEventListener('click', (e) => {
      e.preventDefault();
      handleForgotPassword();
    });
  }

  // Removed addDemoAccountButtons() call
});

function handleLogin() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const rememberMe = document.getElementById('rememberMe').checked;

  if (!username || !password) {
    showAlert('Please enter both username and password', 'error');
    return;
  }

  const loginButton = document.querySelector('.login-btn');
  const originalText = loginButton.textContent;
  
  // Show loading state
  loginButton.textContent = 'Logging in...';
  loginButton.disabled = true;

  // Simulate network delay
  setTimeout(() => {
    const result = authSystem.login(username, password);
    
    loginButton.textContent = originalText;
    loginButton.disabled = false;

    if (result.success) {
      // Redirect based on user role
      const user = result.user;
      let redirectUrl = '/';
      
      switch (user.role) {
        case 'admin':
          redirectUrl = '/admin/dashboard.html';
          break;
        case 'faculty':
          redirectUrl = '/faculty/dashboard.html';
          break;
        case 'student':
          redirectUrl = '/student/dashboard.html';
          break;
        default:
          redirectUrl = '/';
      }
      
      window.location.href = redirectUrl;
    } else {
      showAlert(result.error, 'error');
      
      // Clear password field on error
      document.getElementById('password').value = '';
    }
  }, 500);
}

function handleForgotPassword() {
  const username = prompt('Enter your username:');
  if (!username) return;
  
  const email = prompt('Enter your email address:');
  if (!email) return;
  
  const result = authSystem.resetPassword(username, email);
  
  if (result.success) {
    alert(result.message);
  } else {
    alert(result.error);
  }
}

// Removed addDemoAccountButtons() and fillDemoCredentials() functions

function showAlert(message, type) {
  // Remove existing alerts
  const existingAlerts = document.querySelectorAll('.alert');
  existingAlerts.forEach(alert => alert.remove());

  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  alert.style.position = 'fixed';
  alert.style.top = '20px';
  alert.style.right = '20px';
  alert.style.zIndex = '10000';
  alert.style.maxWidth = '400px';

  document.body.appendChild(alert);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (alert.parentNode) {
      alert.remove();
    }
  }, 5000);
}