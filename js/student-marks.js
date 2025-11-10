// Student Marks Management
class StudentMarks {
  constructor() {
    this.studentData = null;
    this.allSubjects = []; // All subjects for the student's class
    this.allMarks = []; // All marks for the student
    this.filteredSubjectsWithMarks = []; // Filtered subjects for card view
    this.currentPage = 1;
    this.itemsPerPage = 5; // Show 5 subjects per page
    this.marksCalculator = window.marksCalculator; // Use the global MarksCalculator instance
    console.log('StudentMarks: Constructor initialized.');
    this.init();
  }

  init() {
    console.log('StudentMarks: init() called.');
    if (!requireAuth() || !requireRole('student')) {
      console.log('StudentMarks: Authentication or role check failed. Redirecting.');
      return;
    }
    this.loadStudentData();
    this.setupEventListeners();
  }

  setupEventListeners() {
    console.log('StudentMarks: setupEventListeners() called.');
    // Populate semester filter dropdown dynamically
    this.populateSemesterFilterDropdown();

    document.getElementById('semesterFilter').addEventListener('change', () => this.filterMarks());
    document.getElementById('subjectFilter').addEventListener('change', () => this.filterMarks());
  }

  populateSemesterFilterDropdown() {
    console.log('StudentMarks: populateSemesterFilterDropdown() called.');
    const semesterFilter = document.getElementById('semesterFilter');
    semesterFilter.innerHTML = '<option value="">All Semesters</option>';
    // Assuming a student can have marks from semesters up to their current year * 2
    // Ensure studentData is loaded before trying to access it
    const maxSemester = this.studentData ? this.studentData.year * 2 : 8; // Max 8 semesters
    for (let i = 1; i <= maxSemester; i++) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = `Semester ${i}`;
      semesterFilter.appendChild(option);
    }
    console.log('StudentMarks: Semester filter dropdown populated.');
  }

  loadStudentData() {
    console.log('StudentMarks: loadStudentData() called.');
    try {
      const currentUser = getCurrentUser();
      this.studentData = campusDB.getStudentByUserId(currentUser.id);
      
      if (!this.studentData) {
        this.showAlert('Student data not found.', 'error');
        console.error('StudentMarks: Student data not found for current user:', currentUser);
        return;
      }
      console.log('StudentMarks: Student data loaded:', this.studentData);

      this.loadMarksData();
    } catch (error) {
      console.error('StudentMarks: Error loading student data for marks:', error);
      this.showAlert('Error loading student data.', 'error');
    }
  }

  loadMarksData() {
    console.log('StudentMarks: loadMarksData() called.');
    try {
      // Fetch all subjects relevant to the student's current class (branch, year, semester, section)
      // Including inactive subjects for academic history purposes
      this.allSubjects = campusDB.getSubjectsForClass(
        this.studentData.branch,
        this.studentData.year,
        this.studentData.semester,
        this.studentData.section,
        false // Include all subjects for academic history
      );
      // Fetch all marks for the current student
      this.allMarks = campusDB.getMarks(this.studentData.id);
      console.log('StudentMarks: All subjects for student:', this.allSubjects);
      console.log('StudentMarks: All marks for student:', this.allMarks);

      this.populateSubjectFilter();
      this.calculateAcademicOverview();
      this.filterMarks(); // Initial filter and render
      this.renderSubjectSummaryTable();
    } catch (error) {
      console.error('StudentMarks: Error loading marks data:', error);
      this.showAlert('Error loading marks data.', 'error');
    }
  }

  populateSubjectFilter() {
    console.log('StudentMarks: populateSubjectFilter() called.');
    const subjectFilter = document.getElementById('subjectFilter');
    subjectFilter.innerHTML = '<option value="">All Subjects</option>';
    this.allSubjects.forEach(subject => {
      const option = document.createElement('option');
      option.value = subject.id;
      option.textContent = `${subject.name} (${subject.code})`;
      subjectFilter.appendChild(option);
    });
    console.log('StudentMarks: Subject filter dropdown populated.');
  }

  calculateAcademicOverview() {
    console.log('StudentMarks: calculateAcademicOverview() called.');
    const cgpa = this.calculateCGPA(this.allSubjects, this.allMarks);
    const creditsEarned = this.calculateCreditsEarned(this.allSubjects, this.allMarks);
    const overallPercentage = this.calculateOverallPercentage(this.allSubjects, this.allMarks);
    const backlogSubjects = this.calculateBacklogSubjects(this.allSubjects, this.allMarks);

    document.getElementById('currentCGPA').textContent = cgpa !== 'N/A' ? cgpa.toFixed(2) : 'N/A'; // CGPA typically has decimals
    document.getElementById('creditsEarned').textContent = creditsEarned !== 'N/A' ? creditsEarned : 'N/A';
    document.getElementById('overallPercentage').textContent = overallPercentage !== 'N/A' ? `${overallPercentage}%` : 'N/A';
    document.getElementById('backlogSubjects').textContent = backlogSubjects !== 'N/A' ? backlogSubjects : 'N/A';

    // Update card colors
    document.getElementById('currentCGPA').closest('.stat-card').className = `stat-card ${cgpa !== 'N/A' && cgpa >= 8.0 ? 'success' : cgpa !== 'N/A' && cgpa >= 6.0 ? 'warning' : 'error'}`;
    document.getElementById('creditsEarned').closest('.stat-card').className = `stat-card ${creditsEarned !== 'N/A' && creditsEarned > 0 ? 'success' : 'warning'}`;
    document.getElementById('overallPercentage').closest('.stat-card').className = `stat-card ${overallPercentage !== 'N/A' && overallPercentage >= 70 ? 'success' : overallPercentage !== 'N/A' && overallPercentage >= 50 ? 'warning' : 'error'}`;
    document.getElementById('backlogSubjects').closest('.stat-card').className = `stat-card ${backlogSubjects === 0 ? 'success' : 'error'}`;
  }

  calculateCGPA(subjects, marks) {
    console.log('StudentMarks: calculateCGPA() called.');
    if (subjects.length === 0 || marks.length === 0) {
      console.log('StudentMarks: No subjects or marks for CGPA calculation. Returning N/A.');
      return 'N/A';
    }

    let totalGradePoints = 0;
    let totalCredits = 0;
    let allSubjectsFullyMarked = true;

    subjects.forEach(subject => {
      const allMarksEnteredForSubject = this.marksCalculator.areAllMarksEntered(this.studentData.id, subject.id, this.allMarks, subject.type);
      if (!allMarksEnteredForSubject) {
        allSubjectsFullyMarked = false;
        console.log(`StudentMarks: CGPA - Marks not fully entered for subject ${subject.name}.`);
        return; 
      }

      const internalMarksResult = this.marksCalculator.calculateSubjectInternalMarks(this.studentData.id, subject.id, this.allMarks, subject.type);
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
      console.log(`StudentMarks: CGPA Calc for ${subject.name} (ID:${subject.id}) - Internal=${internalScore}/${maxInternalScore}, External=${externalScore}/${maxExternalScore}, Combined=${combinedScore}/${maxCombinedScore}, Percentage=${percentage.toFixed(2)}%, Grade Point=${gradePoint}, Credits=${subject.credits}`);
    });

    if (!allSubjectsFullyMarked) {
      console.log('StudentMarks: CGPA returning N/A because not all subjects have full marks entered.');
      return 'N/A'; 
    }

    const cgpaValue = totalCredits > 0 ? (totalGradePoints / totalCredits) : 0.0;
    console.log('StudentMarks: Calculated CGPA:', cgpaValue);
    return Math.round(cgpaValue * 100) / 100; // Keep 2 decimals for CGPA, as it's standard
  }

  calculateCreditsEarned(subjects, marks) {
    console.log('StudentMarks: calculateCreditsEarned() called.');
    const passedSubjects = new Set();
    let allSubjectsFullyMarked = true;
    
    subjects.forEach(subject => {
      const allMarksEnteredForSubject = this.marksCalculator.areAllMarksEntered(this.studentData.id, subject.id, this.allMarks, subject.type);
      if (!allMarksEnteredForSubject) {
        allSubjectsFullyMarked = false;
        console.log(`StudentMarks: Credits Earned - Marks not fully entered for subject ${subject.name}.`);
        return; 
      }

      const internalMarksResult = this.marksCalculator.calculateSubjectInternalMarks(this.studentData.id, subject.id, this.allMarks, subject.type);
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
      console.log('StudentMarks: Credits Earned returning N/A because not all subjects have full marks entered.');
      return 'N/A'; 
    }

    const earnedCredits = subjects.reduce((total, subject) => {
      return passedSubjects.has(subject.id) ? total + subject.credits : total;
    }, 0);
    console.log('StudentMarks: Credits Earned:', earnedCredits);
    return earnedCredits;
  }

  calculateOverallPercentage(subjects, marks) {
    console.log('StudentMarks: calculateOverallPercentage() called.');
    if (subjects.length === 0 || marks.length === 0) {
      console.log('StudentMarks: No subjects or marks for overall percentage calculation. Returning N/A.');
      return 'N/A';
    }
    
    let totalCombinedMarksObtained = 0;
    let totalPossibleCombinedMarks = 0;
    let allSubjectsFullyMarked = true;

    subjects.forEach(subject => {
      const allMarksEnteredForSubject = this.marksCalculator.areAllMarksEntered(this.studentData.id, subject.id, this.allMarks, subject.type);
      if (!allMarksEnteredForSubject) {
        allSubjectsFullyMarked = false;
        console.log(`StudentMarks: Overall Percentage - Marks not fully entered for subject ${subject.name}.`);
        return; 
      }

      const internalMarksResult = this.marksCalculator.calculateSubjectInternalMarks(this.studentData.id, subject.id, this.allMarks, subject.type);
      const internalScore = internalMarksResult.totalInternal;
      const maxInternalScore = internalMarksResult.maxInternal;

      const externalMarkRecord = this.allMarks.find(m => m.student_id === this.studentData.id && m.subject_id === subject.id && m.assessment_type === 'external_exam');
      const externalScore = externalMarkRecord ? externalMarkRecord.marks : 0;
      const maxExternalScore = externalMarkRecord ? externalMarkRecord.max_marks : 70;

      totalCombinedMarksObtained += (internalScore + externalScore);
      totalPossibleCombinedMarks += (maxInternalScore + maxExternalScore);
    });

    if (!allSubjectsFullyMarked) {
      console.log('StudentMarks: Overall Percentage returning N/A because not all subjects have full marks entered.');
      return 'N/A'; 
    }

    const overallPercentage = totalPossibleCombinedMarks > 0 ? Math.round((totalCombinedMarksObtained / totalPossibleCombinedMarks) * 100) : 0; // Rounded
    console.log('StudentMarks: Overall Percentage - Total Combined Marks Obtained:', totalCombinedMarksObtained, 'Total Possible Combined Marks:', totalPossibleCombinedMarks, 'Overall %:', overallPercentage);
    return overallPercentage;
  }

  calculateBacklogSubjects(subjects, marks) {
    console.log('StudentMarks: calculateBacklogSubjects() called.');
    const passedSubjects = new Set();
    let allSubjectsFullyMarked = true;
    
    subjects.forEach(subject => {
      const allMarksEnteredForSubject = this.marksCalculator.areAllMarksEntered(this.studentData.id, subject.id, this.allMarks, subject.type);
      if (!allMarksEnteredForSubject) {
        allSubjectsFullyMarked = false;
        console.log(`StudentMarks: Backlog Subjects - Marks not fully entered for subject ${subject.name}.`);
        return; 
      }

      const internalMarksResult = this.marksCalculator.calculateSubjectInternalMarks(this.studentData.id, subject.id, this.allMarks, subject.type);
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
      console.log('StudentMarks: Backlog Subjects returning N/A because not all subjects have full marks entered.');
      return 'N/A'; 
    }

    const currentSemester = this.studentData.semester;
    const backlogCount = subjects.filter(subject => 
      subject.semester < currentSemester && !passedSubjects.has(subject.id)
    ).length;
    console.log('StudentMarks: Backlog Subjects:', backlogCount);
    return backlogCount;
  }

  // Expose marksCalculator's method for external use (e.g., faculty-marks.js)
  calculateSubjectInternalMarks(studentId, subjectId, allMarks, subjectType) {
    console.log('StudentMarks: Delegating calculateSubjectInternalMarks to marksCalculator.');
    return this.marksCalculator.calculateSubjectInternalMarks(studentId, subjectId, allMarks, subjectType);
  }

  // Expose marksCalculator's method for external use (e.g., faculty-marks.js)
  areAllMarksEntered(studentId, subjectId, allMarks, subjectType) {
    console.log('StudentMarks: Delegating areAllMarksEntered to marksCalculator.');
    return this.marksCalculator.areAllMarksEntered(studentId, subjectId, allMarks, subjectType);
  }

  filterMarks() {
    console.log('StudentMarks: filterMarks() called.');
    const semesterFilter = document.getElementById('semesterFilter').value;
    const subjectFilter = document.getElementById('subjectFilter').value;

    this.filteredSubjectsWithMarks = this.allSubjects.filter(subject => {
      const matchesSemester = !semesterFilter || subject.semester.toString() === semesterFilter;
      const matchesSubject = !subjectFilter || subject.id.toString() === subjectFilter;
      return matchesSemester && matchesSubject;
    });
    console.log('StudentMarks: Filtered subjects for cards:', this.filteredSubjectsWithMarks);

    this.currentPage = 1;
    this.renderSubjectMarksCards(); 
  }

  renderSubjectMarksCards() { 
    console.log('StudentMarks: renderSubjectMarksCards() called.');
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageSubjects = this.filteredSubjectsWithMarks.slice(startIndex, endIndex);
    const cardsContainer = document.getElementById('detailedMarksCards'); 

    document.getElementById('filteredMarksCount').textContent = `${this.filteredSubjectsWithMarks.length} subjects`;

    if (pageSubjects.length === 0) {
      cardsContainer.innerHTML = '<p class="text-center text-gray-500" style="grid-column: 1 / -1;">No subjects found for the selected criteria</p>';
      this.renderPagination();
      return;
    }

    cardsContainer.innerHTML = pageSubjects.map(subject => {
      console.log(`StudentMarks: Rendering card for subject: ${subject.name} (ID: ${subject.id}, Type: ${subject.type})`); // DEBUG
      const studentSubjectMarks = this.allMarks.filter(m => m.student_id === this.studentData.id && m.subject_id === subject.id);
      console.log(`StudentMarks: Marks found for ${subject.name}:`, studentSubjectMarks); // DEBUG
      
      const marksByType = {};
      studentSubjectMarks.forEach(mark => {
          const type = mark.assessment_type;
          if (!marksByType[type]) {
              marksByType[type] = [];
          }
          marksByType[type].push(mark);
      });

      let detailedMarksHtml = '';

      // Define a display order for assessment types
      const displayOrder = ['mid1', 'mid2', 'assignment', 'quiz', 'lab_exam', 'project', 'lab_day_to_day', 'external_exam'];

      // Get internal marks calculation result
      const internalMarksResult = this.marksCalculator.calculateSubjectInternalMarks(this.studentData.id, subject.id, this.allMarks, subject.type);
      const allInternalMarksEntered = internalMarksResult.allInternalMarksEntered;
      
      let totalInternalObtained = internalMarksResult.totalInternal;
      let totalInternalMax = internalMarksResult.maxInternal;
      
      const externalMarkRecord = studentSubjectMarks.find(m => m.assessment_type === 'external_exam');
      let externalMarksObtained = externalMarkRecord ? externalMarkRecord.marks : 'N/A';
      let externalMarksMax = externalMarkRecord ? externalMarkRecord.max_marks : 70;

      let totalCombinedObtained = 'N/A';
      let totalCombinedMax = 'N/A';
      let overallPercentage = 'N/A';
      let percentageBadgeClass = 'badge-secondary';

      // Calculate combined and overall percentage only if ALL marks (internal + external) are entered
      if (this.marksCalculator.areAllMarksEntered(this.studentData.id, subject.id, this.allMarks, subject.type)) {
          totalCombinedObtained = Math.round(totalInternalObtained + (externalMarkRecord ? externalMarkRecord.marks : 0)); // Rounded
          totalCombinedMax = Math.round(totalInternalMax + (externalMarkRecord ? externalMarkRecord.max_marks : 70)); // Rounded
          overallPercentage = totalCombinedMax > 0 ? Math.round((totalCombinedObtained / totalCombinedMax) * 100) : 0; // Rounded
          percentageBadgeClass = this.marksCalculator.getPercentageBadgeClass(overallPercentage);
      }


      displayOrder.forEach(type => {
          if (marksByType[type] && marksByType[type].length > 0) {
              if (type === 'assignment') {
                  // Sort assignments by number and display each
                  marksByType[type].sort((a, b) => a.assignment_number - b.assignment_number);
                  marksByType[type].forEach(mark => {
                      detailedMarksHtml += `<div><strong>${this.marksCalculator.getAssessmentText(type)} ${mark.assignment_number}:</strong> ${Math.round(mark.marks)} / ${Math.round(mark.max_marks)}</div>`; // Rounded
                  });
              } else {
                  // For other types, display each entry. If multiple quizzes, list all.
                  marksByType[type].forEach(mark => {
                      detailedMarksHtml += `<div><strong>${this.marksCalculator.getAssessmentText(type)}:</strong> ${Math.round(mark.marks)} / ${Math.round(mark.max_marks)}</div>`; // Rounded
                  });
              }
          } else {
              // Display N/A for missing assessment types, but only for common ones
              if (['mid1', 'mid2'].includes(type) || (type === 'assignment' && subject.type === 'theory') || (type === 'lab_day_to_day' && subject.type === 'lab')) {
                  // Only show N/A if the specific mark is missing
                  const isMarkMissing = !studentSubjectMarks.some(m => m.assessment_type === type);
                  if (isMarkMissing) {
                      detailedMarksHtml += `<div><strong>${this.marksCalculator.getAssessmentText(type)}:</strong> N/A</div>`;
                  }
              } else if (type === 'external_exam' && externalMarksObtained === 'N/A') {
                  detailedMarksHtml += `<div><strong>${this.marksCalculator.getAssessmentText(type)}:</strong> N/A</div>`;
              }
          }
      });

      // Display calculated internal and combined totals
      const displayInternal = allInternalMarksEntered ? `${Math.round(totalInternalObtained)} / ${Math.round(totalInternalMax)}` : 'Pending'; // Rounded
      const displayExternal = externalMarksObtained !== 'N/A' ? `${Math.round(externalMarksObtained)} / ${Math.round(externalMarksMax)}` : 'Pending'; // Rounded
      const displayTotalCombined = overallPercentage !== 'N/A' ? `${Math.round(totalCombinedObtained)} / ${Math.round(totalCombinedMax)}` : 'Pending'; // Rounded
      const displayOverallPercentage = overallPercentage !== 'N/A' ? `${overallPercentage}%` : 'Pending';


      console.log(`StudentMarks: Final calculated values for ${subject.name} - Total Internal: ${displayInternal}, Total Combined: ${displayTotalCombined}, Overall %: ${displayOverallPercentage}, All Marks Entered: ${this.marksCalculator.areAllMarksEntered(this.studentData.id, subject.id, this.allMarks, subject.type)}`); // DEBUG

      return `
        <div class="mark-card">
            <div class="mark-card-header">
                <h3>${subject.name} (${subject.code})</h3>
                <span class="badge ${percentageBadgeClass}">${displayOverallPercentage}</span>
            </div>
            <div class="mark-card-body">
                <div><strong>Subject Type:</strong> ${subject.type.charAt(0).toUpperCase() + subject.type.slice(1)}</div>
                <hr style="margin: 10px 0; border: none; border-top: 1px dashed var(--gray-200);">
                ${detailedMarksHtml}
                <hr style="margin: 10px 0; border: none; border-top: 1px dashed var(--gray-200);">
                <div><strong>Calculated Internal:</strong> ${displayInternal}</div>
                <div><strong>External Marks:</strong> ${displayExternal}</div>
                <div><strong>Total Combined:</strong> ${displayTotalCombined}</div>
            </div>
            <div class="mark-card-footer">
                <span>Semester ${subject.semester}</span>
                <span>Year ${subject.year}</span>
            </div>
        </div>
      `;
    }).join('');
    this.renderPagination();
  }

  renderPagination() {
    console.log('StudentMarks: renderPagination() called.');
    const totalPages = Math.ceil(this.filteredSubjectsWithMarks.length / this.itemsPerPage);
    const pagination = document.getElementById('pagination');
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    let paginationHTML = '';
    paginationHTML += `
      <button ${this.currentPage === 1 ? 'disabled' : ''} onclick="studentMarks.goToPage(${this.currentPage - 1})">
        Previous
      </button>
    `;
    for (let i = 1; i <= totalPages; i++) {
      paginationHTML += `
        <button class="${i === this.currentPage ? 'active' : ''}" onclick="studentMarks.goToPage(${i})">
          ${i}
        </button>
      `;
    }
    paginationHTML += `
      <button ${this.currentPage === totalPages ? 'disabled' : ''} onclick="studentMarks.goToPage(${this.currentPage + 1})">
        Next
      </button>
    `;
    pagination.innerHTML = paginationHTML;
    console.log('StudentMarks: Pagination rendered.');
  }

  goToPage(page) {
    console.log('StudentMarks: goToPage() called with page:', page);
    this.currentPage = page;
    this.renderSubjectMarksCards(); 
  }

  renderSubjectSummaryTable() {
    console.log('StudentMarks: renderSubjectSummaryTable() called.');
    const tbody = document.getElementById('subjectSummaryTableBody');
    if (this.allSubjects.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No subjects found</td></tr>'; // Adjusted colspan
      return;
    }

    const summaryData = this.allSubjects.map(subject => {
      console.log(`StudentMarks: Rendering summary for subject: ${subject.name} (ID: ${subject.id}, Type: ${subject.type})`); // DEBUG
      const allMarksEnteredForSubject = this.marksCalculator.areAllMarksEntered(this.studentData.id, subject.id, this.allMarks, subject.type);
      
      let totalCombinedObtained = 'N/A';
      let totalCombinedMax = 'N/A';
      let overallPercentage = 'N/A';
      let status = 'Pending';
      let statusBadgeClass = 'badge-secondary';

      if (allMarksEnteredForSubject) {
        const internalMarks = this.marksCalculator.calculateSubjectInternalMarks(this.studentData.id, subject.id, this.allMarks, subject.type);
        const externalMarkRecord = this.allMarks.find(m => m.student_id === this.studentData.id && m.subject_id === subject.id && m.assessment_type === 'external_exam');
        
        const totalInternalObtained = internalMarks.totalInternal;
        const totalInternalMax = internalMarks.maxInternal;
        const totalExternalObtained = externalMarkRecord ? externalMarkRecord.marks : 0;
        const totalExternalMax = externalMarkRecord ? externalMarkRecord.max_marks : 70; 

        totalCombinedObtained = Math.round(totalInternalObtained + totalExternalObtained); // Rounded
        totalCombinedMax = Math.round(totalInternalMax + totalExternalMax); // Rounded

        overallPercentage = totalCombinedMax > 0 ? Math.round((totalCombinedObtained / totalCombinedMax) * 100) : 0; // Rounded
        status = overallPercentage >= 40 ? 'Passed' : 'Failed'; 
        statusBadgeClass = status === 'Passed' ? 'badge-success' : 'badge-error';
      }

      console.log(`StudentMarks: Summary for ${subject.name} - Internal: ${allMarksEnteredForSubject ? `${internalMarks.totalInternal}/${internalMarks.maxInternal}` : 'N/A'}, External: ${allMarksEnteredForSubject ? `${totalExternalObtained}/${totalExternalMax}` : 'N/A'}, Combined: ${totalCombinedObtained}/${totalCombinedMax}, %: ${overallPercentage}, Status: ${status}`);

      return `
        <tr>
          <td><strong>${subject.name} (${subject.code})</strong></td>
          <td>${totalCombinedObtained}</td>
          <td>${totalCombinedMax}</td>
          <td>
            <span class="badge ${allMarksEnteredForSubject ? this.marksCalculator.getPercentageBadgeClass(overallPercentage) : 'badge-secondary'}">${overallPercentage !== 'N/A' ? `${overallPercentage}%` : 'N/A'}</span>
          </td>
          <td>
            <span class="badge ${statusBadgeClass}">${status}</span>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = summaryData;
    console.log('StudentMarks: Subject summary table rendered.');
  }

  // Use marksCalculator's method
  getAssessmentText(assessmentType) {
    return this.marksCalculator.getAssessmentText(assessmentType);
  }

  // Use marksCalculator's method
  getPercentageBadgeClass(percentage) {
    return this.marksCalculator.getPercentageBadgeClass(percentage);
  }

  showAlert(message, type) {
    console.log(`StudentMarks: showAlert() called with message: "${message}", type: "${type}"`);
    const existingAlerts = document.querySelectorAll('#studentMarksAlert .alert');
    existingAlerts.forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    const alertContainer = document.getElementById('studentMarksAlert');
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

// Initialize studentMarks immediately so it's available for other scripts
const studentMarks = new StudentMarks();