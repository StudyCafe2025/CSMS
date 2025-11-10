// Faculty Profile Management
class FacultyProfile {
  constructor() {
    this.facultyData = null;
    this.originalData = {};
    this.editMode = false;
    this.init();
  }

  init() {
    // Check authentication
    if (!requireAuth() || !requireRole('faculty')) {
      return;
    }

    this.loadProfileData();
    this.setupEventListeners();
    this.showSection('personal'); // Default to showing personal details
  }

  setupEventListeners() {
    // Password form submission
    document.getElementById('passwordForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.changePassword();
    });

    // Section navigation buttons
    document.getElementById('showPersonalDetailsBtn').addEventListener('click', () => {
      this.showSection('personal');
    });
    document.getElementById('showAcademicProfessionalDetailsBtn').addEventListener('click', () => {
      this.showSection('academic-professional');
    });

    // Edit/Save/Cancel buttons for personal details
    document.getElementById('toggleEditPersonalBtn').addEventListener('click', () => this.toggleEditMode());
    document.getElementById('savePersonalBtn').addEventListener('click', () => this.saveProfile());
    document.getElementById('cancelPersonalBtn').addEventListener('click', () => this.cancelEdit());
  }

  loadProfileData() {
    try {
      const currentUser = getCurrentUser();
      this.facultyData = campusDB.getFacultyByUserId(currentUser.id);
      
      if (!this.facultyData) {
        this.showAlert('Faculty data not found.', 'error');
        return;
      }

      this.displayProfileData();
      this.loadAcademicProfessionalInfo();
    } catch (error) {
      console.error('Error loading profile data:', error);
      this.showAlert('Error loading profile data.', 'error');
    }
  }

  displayProfileData() {
    // Store original data for cancel functionality
    this.originalData = { ...this.facultyData };

    // Profile header
    const initials = this.facultyData.name ? 
      this.facultyData.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'FA';
    document.getElementById('profileInitials').textContent = initials;
    document.getElementById('profileName').textContent = this.facultyData.name || '';
    document.getElementById('profileFacultyId').textContent = this.facultyData.faculty_id || '';
    document.getElementById('profileDepartment').textContent = this.facultyData.department || '';
    document.getElementById('profileDesignation').textContent = this.facultyData.designation || '';

    // Personal Information Form
    document.getElementById('name').value = this.facultyData.name || '';
    document.getElementById('email').value = this.facultyData.email || '';
    document.getElementById('phone').value = this.facultyData.phone || '';
    document.getElementById('qualification').value = this.facultyData.qualification || '';
    document.getElementById('experience').value = this.facultyData.experience || '';
    document.getElementById('address').value = this.facultyData.address || '';

    this.setPersonalFormReadonly(true);
  }

  loadAcademicProfessionalInfo() {
    // Academic/Professional Details Display
    document.getElementById('academicFacultyId').textContent = this.facultyData.faculty_id || 'N/A';
    document.getElementById('academicDepartment').textContent = this.facultyData.department || 'N/A';
    document.getElementById('academicDesignation').textContent = this.facultyData.designation || 'N/A';

    // Subjects Taught
    const subjectsTaught = campusDB.getSubjectsTaughtByFaculty(this.facultyData.id, false); // Get all subjects, active or not
    const subjectsTaughtList = document.getElementById('subjectsTaughtList');
    subjectsTaughtList.innerHTML = ''; // Clear previous list

    if (subjectsTaught.length === 0) {
      subjectsTaughtList.innerHTML = '<li>No subjects currently allocated.</li>';
    } else {
      subjectsTaught.forEach(subject => {
        const listItem = document.createElement('li');
        listItem.textContent = `${subject.name} (${subject.code}) - Year ${subject.year}, Sem ${subject.semester}, Sec ${subject.section} (${subject.type.charAt(0).toUpperCase() + subject.type.slice(1)})`;
        subjectsTaughtList.appendChild(listItem);
      });
    }
  }

  setPersonalFormReadonly(readonly) {
    const editableInputs = document.querySelectorAll('#personalDetailsForm input, #personalDetailsForm textarea');
    editableInputs.forEach(input => {
      input.readOnly = readonly;
    });
    document.getElementById('personalEditActions').style.display = readonly ? 'none' : 'block';
    
    const toggleEditPersonalIcon = document.getElementById('toggleEditPersonalIcon');
    const toggleEditPersonalText = document.getElementById('toggleEditPersonalText');

    if (toggleEditPersonalIcon) {
      toggleEditPersonalIcon.textContent = readonly ? '✏️' : '❌';
    }
    if (toggleEditPersonalText) {
      toggleEditPersonalText.textContent = readonly ? 'Edit Personal Details' : 'Cancel Edit';
    }
  }

  toggleEditMode() {
    this.editMode = !this.editMode;
    if (this.editMode) {
      this.setPersonalFormReadonly(false);
    } else {
      this.cancelEdit(); // If toggling off, cancel changes
    }
  }

  cancelEdit() {
    this.editMode = false;
    this.displayProfileData(); // Revert to original data
    this.setPersonalFormReadonly(true);
    this.showAlert('Edit cancelled. Changes discarded.', 'info');
  }

  saveProfile() {
    const updatedData = {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      phone: document.getElementById('phone').value,
      qualification: document.getElementById('qualification').value,
      experience: parseInt(document.getElementById('experience').value) || 0,
      address: document.getElementById('address').value,
    };

    // Basic validation
    if (!updatedData.name || !updatedData.email) {
      this.showAlert('Name and Email are required fields.', 'error');
      return;
    }

    try {
      // Update faculty record
      campusDB.update('faculty', this.facultyData.id, updatedData);

      // Also update the associated user record (name and email)
      const currentUser = getCurrentUser();
      if (currentUser) {
        campusDB.update('users', currentUser.id, {
          name: updatedData.name,
          email: updatedData.email
        });
        // Update the current user in authSystem as well
        authSystem.currentUser.name = updatedData.name;
        authSystem.currentUser.email = updatedData.email;
        authSystem.extendSession(); // Extend session to save updated user info
      }

      this.facultyData = { ...this.facultyData, ...updatedData }; // Update local facultyData
      this.displayProfileData(); // Re-render with new data
      this.setPersonalFormReadonly(true);
      this.editMode = false;
      this.showAlert('Profile updated successfully', 'success');
    } catch (error) {
      console.error('Error saving profile:', error);
      this.showAlert('Error saving profile', 'error');
    }
  }

  changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      this.showAlert('Please fill all password fields.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      this.showAlert('New password and confirm password do not match.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      this.showAlert('New password must be at least 6 characters long.', 'error');
      return;
    }

    try {
      const result = authSystem.changePassword(currentPassword, newPassword);
      if (result.success) {
        this.showAlert('Password changed successfully!', 'success');
        document.getElementById('passwordForm').reset();
      } else {
        this.showAlert(result.error, 'error');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      this.showAlert('Error changing password.', 'error');
    }
  }

  showSection(sectionName) {
    const personalSection = document.getElementById('personalDetailsSection');
    const academicProfessionalSection = document.getElementById('academicProfessionalDetailsSection');
    const personalBtn = document.getElementById('showPersonalDetailsBtn');
    const academicProfessionalBtn = document.getElementById('showAcademicProfessionalDetailsBtn');

    if (personalSection) personalSection.style.display = 'none';
    if (academicProfessionalSection) academicProfessionalSection.style.display = 'none';

    if (personalBtn) {
      personalBtn.classList.remove('btn-primary');
      personalBtn.classList.add('btn-secondary');
    }
    if (academicProfessionalBtn) {
      academicProfessionalBtn.classList.remove('btn-primary');
      academicProfessionalBtn.classList.add('btn-secondary');
    }

    if (sectionName === 'personal') {
      if (personalSection) personalSection.style.display = 'block';
      if (personalBtn) {
        personalBtn.classList.remove('btn-secondary');
        personalBtn.classList.add('btn-primary');
      }
    } else if (sectionName === 'academic-professional') {
      if (academicProfessionalSection) academicProfessionalSection.style.display = 'block';
      if (academicProfessionalBtn) {
        academicProfessionalBtn.classList.remove('btn-secondary');
        academicProfessionalBtn.classList.add('btn-primary');
      }
    }
  }

  showAlert(message, type) {
    const existingAlerts = document.querySelectorAll('#profileAlert .alert');
    existingAlerts.forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    const alertContainer = document.getElementById('profileAlert');
    alertContainer.innerHTML = ''; // Clear previous alerts
    alertContainer.appendChild(alert);
    alertContainer.style.display = 'block';

    setTimeout(() => {
      if (alert.parentNode) {
        alert.remove();
      }
    }, 5000);
  }
}

// Initialize facultyProfile when DOM is loaded
let facultyProfile;
document.addEventListener('DOMContentLoaded', () => {
  facultyProfile = new FacultyProfile();
});