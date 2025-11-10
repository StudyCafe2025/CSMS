// Student Profile Management
class StudentProfile {
  constructor() {
    this.studentData = null;
    this.originalData = {};
    this.editMode = false;
    this.marksCalculator = window.marksCalculator; // Use the global MarksCalculator instance
    this.init();
  }

  init() {
    // Check authentication
    if (!requireAuth() || !requireRole('student')) {
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
    document.getElementById('showAcademicDetailsBtn').addEventListener('click', () => {
      this.showSection('academic');
    });

    // Edit/Save/Cancel buttons for personal details
    document.getElementById('toggleEditPersonalBtn').addEventListener('click', () => this.toggleEditMode());
    document.getElementById('savePersonalBtn').addEventListener('click', () => this.saveProfile());
    document.getElementById('cancelPersonalBtn').addEventListener('click', () => this.cancelEdit());
  }

  loadProfileData() {
    try {
      const currentUser = getCurrentUser();
      this.studentData = campusDB.getStudentByUserId(currentUser.id);
      
      if (!this.studentData) {
        this.showAlert('Student data not found.', 'error');
        return;
      }

      this.displayProfileData();
      this.loadAcademicInfo();
    } catch (error) {
      console.error('Error loading profile data:', error);
      this.showAlert('Error loading profile data.', 'error');
    }
  }

  displayProfileData() {
    // Store original data for cancel functionality
    this.originalData = { ...this.studentData };

    // Profile header
    const initials = this.studentData.name ? 
      this.studentData.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'ST';
    document.getElementById('profileInitials').textContent = initials;
    document.getElementById('profileName').textContent = this.studentData.name || '';
    document.getElementById('profileStudentId').textContent = this.studentData.student_id || '';
    document.getElementById('profileBranch').textContent = this.studentData.branch || '';
    document.getElementById('profileYearSem').textContent = 
      `${this.getOrdinalYear(this.studentData.year)} Year • Semester ${this.studentData.semester} • Section ${this.studentData.section}`;
    document.getElementById('profileStatus').textContent = 
      (this.studentData.status || 'active').charAt(0).toUpperCase() + (this.studentData.status || 'active').slice(1);

    // Personal Information Form
    document.getElementById('name').value = this.studentData.name || '';
    document.getElementById('email').value = this.studentData.email || '';
    document.getElementById('phone').value = this.studentData.phone || '';
    document.getElementById('dateOfBirth').value = this.studentData.date_of_birth || '';
    document.getElementById('address').value = this.studentData.address || '';
    document.getElementById('fatherName').value = this.studentData.father_name || '';
    document.getElementById('motherName').value = this.studentData.mother_name || '';
    document.getElementById('parentsPhone').value = this.studentData.parents_phone || '';

    this.setPersonalFormReadonly(true);
  }

  loadAcademicInfo() {
    const allSubjects = campusDB.getSubjectsForClass(
      this.studentData.branch,
      this.studentData.year,
      this.studentData.semester,
      this.studentData.section,
      false // Include all subjects for academic history
    );
    const allMarks = campusDB.getMarks(this.studentData.id);
    const allAttendance = campusDB.getAttendance(this.studentData.id);

    const cgpa = this.calculateCGPA(allSubjects, allMarks);
    const creditsEarned = this.calculateCreditsEarned(allSubjects, allMarks);
    const overallAttendance = this.calculateOverallAttendance(allAttendance);
    const backlogSubjects = this.calculateBacklogSubjects(allSubjects, allMarks);

    // Academic Details Display
    document.getElementById('academicStudentId').textContent = this.studentData.student_id || 'N/A';
    document.getElementById('academicBranch').textContent = this.studentData.branch || 'N/A';
    document.getElementById('academicYear').textContent = this.studentData.year ? this.getOrdinalYear(this.studentData.year) : 'N/A';
    document.getElementById('academicSemester').textContent = this.studentData.semester || 'N/A';
    document.getElementById('academicSection').textContent = this.studentData.section || 'N/A';
    
    document.getElementById('currentCGPA').textContent = cgpa !== 'N/A' ? cgpa.toFixed(2) : 'N/A';
    document.getElementById('creditsEarned').textContent = creditsEarned !== 'N/A' ? creditsEarned : 'N/A';
    document.getElementById('overallAttendance').textContent = overallAttendance !== 'N/A' ? `${overallAttendance}%` : 'N/A';
    document.getElementById('backlogSubjects').textContent = backlogSubjects !== 'N/A' ? backlogSubjects : 'N/A';

    // Update card colors
    document.getElementById('currentCGPA').closest('.stat-card').className = `stat-card ${cgpa !== 'N/A' && cgpa >= 8.0 ? 'success' : cgpa !== 'N/A' && cgpa >= 6.0 ? 'warning' : 'error'}`;
    document.getElementById('creditsEarned').closest('.stat-card').className = `stat-card ${creditsEarned !== 'N/A' && creditsEarned > 0 ? 'success' : 'warning'}`;
    document.getElementById('overallAttendance').closest('.stat-card').className = `stat-card ${overallAttendance !== 'N/A' && overallAttendance >= 75 ? 'success' : overallAttendance !== 'N/A' && overallAttendance >= 60 ? 'warning' : 'error'}`;
    document.getElementById('backlogSubjects').closest('.stat-card').className = `stat-card ${backlogSubjects === 0 ? 'success' : 'error'}`;
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
      date_of_birth: document.getElementById('dateOfBirth').value,
      address: document.getElementById('address').value,
      father_name: document.getElementById('fatherName').value,
      mother_name: document.getElementById('motherName').value,
      parents_phone: document.getElementById('parentsPhone').value,
    };

    // Basic validation
    if (!updatedData.name || !updatedData.email) {
      this.showAlert('Name and Email are required fields.', 'error');
      return;
    }

    try {
      // Update student record
      campusDB.update('students', this.studentData.id, updatedData);

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

      this.studentData = { ...this.studentData, ...updatedData }; // Update local studentData
      this.displayProfileData(); // Re-render with new data
      this.setPersonalFormReadonly(true);
      this.editMode = false;
      this.showAlert('Profile updated successfully', 'success');
    } catch (error) {
      console.error('Error saving profile:', error);
      this.showAlert('Error saving profile', 'error');
    }
  }

  calculateCGPA(subjects, marks) {
    if (subjects.length === 0 || marks.length === 0) return 'N/A';

    let totalGradePoints = 0;
    let totalCredits = 0;
    let allSubjectsFullyMarked = true;

    subjects.forEach(subject => {
      const allMarksEnteredForSubject = this.marksCalculator.areAllMarksEntered(this.studentData.id, subject.id, marks, subject.type);
      if (!allMarksEnteredForSubject) {
        allSubjectsFullyMarked = false;
        return; 
      }

      const internalMarksResult = this.marksCalculator.calculateSubjectInternalMarks(this.studentData.id, subject.id, marks, subject.type);
      const internalScore = internalMarksResult.totalInternal;
      const maxInternalScore = internalMarksResult.maxInternal;

      const externalMarkRecord = marks.find(m => m.student_id === this.studentData.id && m.subject_id === subject.id && m.assessment_type === 'external_exam');
      const externalScore = externalMarkRecord ? externalMarkRecord.marks : 0;
      const maxExternalScore = externalMarkRecord ? externalMarkRecord.max_marks : 70; 

      const combinedScore = internalScore + externalScore;
      const maxCombinedScore = maxInternalScore + maxExternalScore; 

      let percentage = 0;
      if (maxCombinedScore > 0) {
        percentage = (combinedScore / maxCombinedScore) * 100;
      }
      
      let gradePoint = 0;
      if (percentage >= 90) gradePoint = 10;
      else if (percentage >= 80) gradePoint = 9;
      else if (percentage >= 70) gradePoint = 8;
      else if (percentage >= 60) gradePoint = 7;
      else if (percentage >= 50) gradePoint = 6;
      else if (percentage >= 40) gradePoint = 5;
      else gradePoint = 0;

      totalGradePoints += gradePoint * subject.credits;
      totalCredits += subject.credits;
    });

    if (!allSubjectsFullyMarked) {
      return 'N/A'; 
    }

    return totalCredits > 0 ? totalGradePoints / totalCredits : 0.0;
  }

  calculateCreditsEarned(subjects, marks) {
    const passedSubjects = new Set();
    let allSubjectsFullyMarked = true;
    
    subjects.forEach(subject => {
      const allMarksEnteredForSubject = this.marksCalculator.areAllMarksEntered(this.studentData.id, subject.id, marks, subject.type);
      if (!allMarksEnteredForSubject) {
        allSubjectsFullyMarked = false;
        return; 
      }

      const internalMarksResult = this.marksCalculator.calculateSubjectInternalMarks(this.studentData.id, subject.id, marks, subject.type);
      const internalScore = internalMarksResult.totalInternal;
      const maxInternalScore = internalMarksResult.maxInternal;

      const externalMarkRecord = marks.find(m => m.student_id === this.studentData.id && m.subject_id === subject.id && m.assessment_type === 'external_exam');
      const externalScore = externalMarkRecord ? externalMarkRecord.marks : 0;
      const maxExternalScore = externalMarkRecord ? externalMarkRecord.max_marks : 70;

      const combinedScore = internalScore + externalScore;
      const maxCombinedScore = maxInternalScore + maxExternalScore;

      let percentage = 0;
      if (maxCombinedScore > 0) {
        percentage = (combinedScore / maxCombinedScore) * 100;
      }
        
      if (percentage >= 40) { 
        passedSubjects.add(subject.id);
      }
    });

    if (!allSubjectsFullyMarked) {
      return 'N/A'; 
    }

    const earnedCredits = subjects.reduce((total, subject) => {
      return passedSubjects.has(subject.id) ? total + subject.credits : total;
    }, 0);
    return earnedCredits;
  }

  calculateOverallAttendance(attendance) {
    const totalClasses = attendance.length;
    const presentCount = attendance.filter(a => a.status === 'present').length;
    return totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 'N/A';
  }

  calculateBacklogSubjects(subjects, marks) {
    const passedSubjects = new Set();
    let allSubjectsFullyMarked = true;
    
    subjects.forEach(subject => {
      const allMarksEnteredForSubject = this.marksCalculator.areAllMarksEntered(this.studentData.id, subject.id, marks, subject.type);
      if (!allMarksEnteredForSubject) {
        allSubjectsFullyMarked = false;
        return; 
      }

      const internalMarksResult = this.marksCalculator.calculateSubjectInternalMarks(this.studentData.id, subject.id, marks, subject.type);
      const internalScore = internalMarksResult.totalInternal;
      const maxInternalScore = internalMarksResult.maxInternal;

      const externalMarkRecord = marks.find(m => m.student_id === this.studentData.id && m.subject_id === subject.id && m.assessment_type === 'external_exam');
      const externalScore = externalMarkRecord ? externalMarkRecord.marks : 0;
      const maxExternalScore = externalMarkRecord ? externalMarkRecord.max_marks : 70;

      const combinedScore = internalScore + externalScore;
      const maxCombinedScore = maxInternalScore + maxExternalScore;

      let percentage = 0;
      if (maxCombinedScore > 0) {
        percentage = (combinedScore / maxCombinedScore) * 100;
      }
        
      if (percentage >= 40) { 
        passedSubjects.add(subject.id);
      }
    });

    if (!allSubjectsFullyMarked) {
      return 'N/A'; 
    }

    const currentSemester = this.studentData.semester;
    const backlogCount = subjects.filter(subject => 
      subject.semester < currentSemester && !passedSubjects.has(subject.id)
    ).length;
    return backlogCount;
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

  getOrdinalYear(year) {
    const s = ["th", "st", "nd", "rd"];
    const v = year % 100;
    return year + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  showSection(sectionName) {
    const personalSection = document.getElementById('personalDetailsSection');
    const academicSection = document.getElementById('academicDetailsSection');
    const personalBtn = document.getElementById('showPersonalDetailsBtn');
    const academicBtn = document.getElementById('showAcademicDetailsBtn');

    if (personalSection) personalSection.style.display = 'none';
    if (academicSection) academicSection.style.display = 'none';

    if (personalBtn) {
      personalBtn.classList.remove('btn-primary');
      personalBtn.classList.add('btn-secondary');
    }
    if (academicBtn) {
      academicBtn.classList.remove('btn-primary');
      academicBtn.classList.add('btn-secondary');
    }

    if (sectionName === 'personal') {
      if (personalSection) personalSection.style.display = 'block';
      if (personalBtn) {
        personalBtn.classList.remove('btn-secondary');
        personalBtn.classList.add('btn-primary');
      }
    } else if (sectionName === 'academic') {
      if (academicSection) academicSection.style.display = 'block';
      if (academicBtn) {
        academicBtn.classList.remove('btn-secondary');
        academicBtn.classList.add('btn-primary');
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

// Initialize studentProfile when DOM is loaded
let studentProfile;
document.addEventListener('DOMContentLoaded', () => {
  studentProfile = new StudentProfile();
});