// Faculty Marks Management
class FacultyMarks {
  constructor() {
    this.facultyData = null;
    this.subjectsTaught = [];
    this.studentsInClass = [];
    this.marks = [];
    this.allAssignments = []; // To fetch assignments for dynamic input
    this.marksCalculator = window.marksCalculator; // Use the global MarksCalculator instance
    console.log('FacultyMarks: Initializing...');
    this.init();
  }

  init() {
    console.log('FacultyMarks: init() called.');
    const currentUserBeforeAuthCheck = getCurrentUser(); // ADDED LOG
    console.log('FacultyMarks: Current User BEFORE permission check:', currentUserBeforeAuthCheck); // ADDED LOG
    console.log('FacultyMarks: Current User Role BEFORE permission check:', currentUserBeforeAuthCheck ? currentUserBeforeAuthCheck.role : 'No user logged in'); // ADDED LOG

    // Check authentication
    if (!requireAuth() || !requireRole('faculty')) {
      console.log('FacultyMarks: Authentication or role check failed. Redirecting.');
      return;
    }
    console.log('FacultyMarks: Authentication and role check passed.');

    this.loadFacultyData();
    this.setupEventListeners();
  }

  loadFacultyData() {
    console.log('FacultyMarks: loadFacultyData() called.');
    try {
      const currentUser = getCurrentUser();
      this.facultyData = campusDB.getFacultyByUserId(currentUser.id);
      
      if (!this.facultyData) {
        console.error('FacultyMarks: Faculty data not found for user ID:', currentUser.id);
        this.showAlert('Faculty data not found. Please ensure your user account is linked to a faculty profile.', 'error');
        return;
      }
      console.log('FacultyMarks: Faculty data loaded:', this.facultyData);

      // Load subjects taught by this faculty
      this.subjectsTaught = campusDB.getSubjectsTaughtByFaculty(this.facultyData.id, true);
      console.log('FacultyMarks: Subjects Taught by this faculty:', this.subjectsTaught);
      this.allAssignments = campusDB.getStorageData('assignments'); // Load all assignments
      this.loadSubjectsDropdown();
    } catch (error) {
      console.error('FacultyMarks: Error loading faculty data:', error);
      this.showAlert('Error loading faculty data.', 'error');
    }
  }

  setupEventListeners() {
    console.log('FacultyMarks: setupEventListeners() called.');
    document.getElementById('marksForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveMarks();
    });

    // New: Event listener for subject change in Mark Attendance modal
    document.getElementById('marksSubject').addEventListener('change', () => this.handleSubjectChange());
    document.getElementById('marksAssessment').addEventListener('change', () => this.handleAssessmentChange());
    // New: Event listener for assignment number change
    document.getElementById('marksAssignmentNumber').addEventListener('change', () => this.handleAssignmentNumberChange());

    // Event listener for assessment filter in the main view
    document.getElementById('assessmentFilter').addEventListener('change', () => this.handleMainAssessmentFilterChange());
  }

  loadSubjectsDropdown() {
    console.log('FacultyMarks: loadSubjectsDropdown() called.');
    try {
      const subjectOptions = this.subjectsTaught.map(subject => 
        `<option value="${subject.id}_${subject.branch}_${subject.year}_${subject.semester}_${subject.section}_${subject.type}">` +
        `${subject.name} (${subject.code}) - Y${subject.year} S${subject.semester} Sec ${subject.section} (${subject.type.charAt(0).toUpperCase() + subject.type.slice(1)})` +
        `</option>`
      ).join('');

      document.getElementById('subjectFilter').innerHTML = '<option value="">Select Subject & Class</option>' + subjectOptions;
      document.getElementById('marksSubject').innerHTML = '<option value="">Select Subject & Class</option>' + subjectOptions;
      console.log('FacultyMarks: Subject dropdowns populated.');
    } catch (error) {
      console.error('FacultyMarks: Error loading subjects dropdown:', error); // More specific log
      this.showAlert('Error populating subject dropdowns.', 'error');
    }
  }

  handleMainAssessmentFilterChange() {
    console.log('FacultyMarks: handleMainAssessmentFilterChange triggered.'); // DEBUG
    const assessmentFilter = document.getElementById('assessmentFilter').value;
    const assignmentNumberFilterSelect = document.getElementById('assignmentNumberFilter');
    const selectedSubjectValue = document.getElementById('subjectFilter').value;

    if (assessmentFilter === 'assignment' && selectedSubjectValue) {
        assignmentNumberFilterSelect.style.display = 'inline-block';
        const [subjectId, branch, year, semester, section, subjectType] = selectedSubjectValue.split('_');
        console.log('FacultyMarks: Main filter - Parsed subjectType:', subjectType); // DEBUG
        
        let assignmentOptionsHtml = '<option value="">Select Assignment</option>';
        // Always populate Assignment 1-5 for any subject type when 'assignment' is selected
        console.log('FacultyMarks: Main filter - Populating 1-5 assignments for any subject type.'); // DEBUG
        for (let i = 1; i <= 5; i++) {
            assignmentOptionsHtml += `<option value="${i}">Assignment ${i}</option>`;
        }
        assignmentNumberFilterSelect.innerHTML = assignmentOptionsHtml;
        assignmentNumberFilterSelect.disabled = false; // Always enable
    } else {
        assignmentNumberFilterSelect.style.display = 'none';
        assignmentNumberFilterSelect.innerHTML = '<option value="">Select Assignment</option>';
    }
    this.loadMarks(); // Always reload marks after filter change
  }

  loadMarks() {
    console.log('FacultyMarks: loadMarks() called.');
    const selectedValue = document.getElementById('subjectFilter').value;
    const assessmentFilter = document.getElementById('assessmentFilter').value;
    const assignmentNumberFilter = document.getElementById('assignmentNumberFilter')?.value; // New filter

    if (!selectedValue) {
      this.showAlert('Please select a subject/class', 'warning');
      document.getElementById('marksStats').style.display = 'none';
      document.getElementById('performanceAnalysis').style.display = 'none';
      document.getElementById('marksTableBody').innerHTML = '<tr><td colspan="8" class="text-center">Select subject and assessment to view marks</td></tr>'; // Adjusted colspan
      return;
    }

    const [subjectId, branch, year, semester, section, subjectType] = selectedValue.split('_');
    const subject = this.subjectsTaught.find(s => 
      s.id == subjectId && s.branch === branch && s.year == parseInt(year) && s.semester == parseInt(semester) && s.section === section
    );

    if (!subject) {
      console.error('FacultyMarks: Subject not found for selected filter value:', selectedValue);
      this.showAlert('Selected subject not found.', 'error');
      return;
    }

    // Get students for this class
    const filters = { branch: branch, year: parseInt(year), semester: parseInt(semester), section: section };
    const students = campusDB.getStudents(filters);

    // Get marks records
    let marksRecords = campusDB.getStorageData('marks').filter(m => m.subject_id == subjectId);
    
    if (assessmentFilter) {
      marksRecords = marksRecords.filter(m => m.assessment_type === assessmentFilter);
      if (assessmentFilter === 'assignment' && assignmentNumberFilter) {
        // Filter by assignment_number for assignments
        marksRecords = marksRecords.filter(m => m.assignment_number == assignmentNumberFilter);
      }
    }
    console.log('FacultyMarks: Marks records after filtering:', marksRecords);

    this.renderMarksTable(students, marksRecords, subject, assessmentFilter, assignmentNumberFilter); // Pass assignmentNumberFilter
    this.showMarksStats(students, marksRecords);
    this.showPerformanceAnalysis(marksRecords);

    // Update selected indicators
    document.getElementById('selectedSubjectMarks').textContent = subject.name;
    let selectedAssessmentText = assessmentFilter ? this.marksCalculator.getAssessmentText(assessmentFilter) : 'All Assessments';
    if (assessmentFilter === 'assignment' && assignmentNumberFilter) {
        selectedAssessmentText += ` (Assignment ${assignmentNumberFilter})`;
    }
    document.getElementById('selectedAssessment').textContent = selectedAssessmentText;
  }

  renderMarksTable(students, marksRecords, subject, assessmentFilter, assignmentNumberFilter) {
    console.log('FacultyMarks: renderMarksTable() called.');
    const tbody = document.getElementById('marksTableBody');
    
    if (students.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">No students found for this subject/class</td></tr>'; // Adjusted colspan
      return;
    }

    // Create a map of student marks grouped by student and assessment
    const studentMarksMap = new Map();
    students.forEach(student => {
      studentMarksMap.set(student.id, []);
    });

    marksRecords.forEach(record => {
      if (studentMarksMap.has(record.student_id)) {
        studentMarksMap.get(record.student_id).push(record);
      }
    });

    let tableRows = '';
    students.forEach(student => {
      const recordsForStudent = studentMarksMap.get(student.id);
      
      // Calculate internal marks for display using marksCalculator
      const internalMarksResult = this.marksCalculator.calculateSubjectInternalMarks(student.id, subject.id, campusDB.getStorageData('marks'), subject.type);
      const calculatedInternal = internalMarksResult.totalInternal;
      const maxInternal = internalMarksResult.maxInternal;
      const internalDisplay = `${calculatedInternal} / ${maxInternal}`;

      if (assessmentFilter === 'assignment' && assignmentNumberFilter) {
        // Display marks for a specific assignment number
        const fixedAssignmentMaxMarks = 5; // Each assignment is out of 5
        const record = recordsForStudent.find(r => r.assessment_type === 'assignment' && r.assignment_number == assignmentNumberFilter);
        const marks = record ? record.marks : 'N/A';
        const maxMarks = fixedAssignmentMaxMarks;
        const percentage = marks !== 'N/A' && maxMarks > 0 ? Math.round((marks / maxMarks) * 100) : 'N/A';

        tableRows += `
          <tr>
            <td>${student.student_id}</td>
            <td>${student.name}</td>
            <td>Assignment ${assignmentNumberFilter}</td>
            <td>${marks}</td>
            <td>${maxMarks}</td>
            <td>
              <span class="badge ${this.marksCalculator.getPercentageBadgeClass(percentage)}">${percentage !== 'N/A' ? `${percentage}%` : '-%'}</span>
            </td>
            <td>${internalDisplay}</td>
            <td>
              <button class="btn btn-primary btn-sm" onclick="facultyMarks.addStudentMarks(${student.id}, ${subject.id}, 'assignment', ${assignmentNumberFilter})">
                <span>✏️</span> Edit
              </button>
            </td>
          </tr>
        `;
      } else if (assessmentFilter === 'lab_day_to_day') {
        const record = recordsForStudent.find(r => r.assessment_type === 'lab_day_to_day');
        const marks = record ? record.marks : 'N/A';
        const maxMarks = record ? record.max_marks : 20; // Default max for lab day-to-day
        const percentage = marks !== 'N/A' && maxMarks > 0 ? Math.round((marks / maxMarks) * 100) : 'N/A';

        tableRows += `
          <tr>
            <td>${student.student_id}</td>
            <td>${student.name}</td>
            <td>${this.marksCalculator.getAssessmentText(assessmentFilter)}</td>
            <td>${marks}</td>
            <td>${maxMarks}</td>
            <td>
              <span class="badge ${this.marksCalculator.getPercentageBadgeClass(percentage)}">${percentage !== 'N/A' ? `${percentage}%` : '-%'}</span>
            </td>
            <td>${internalDisplay}</td>
            <td>
              <button class="btn btn-primary btn-sm" onclick="facultyMarks.addStudentMarks(${student.id}, ${subject.id}, 'lab_day_to_day')">
                <span>✏️</span> Edit
              </button>
            </td>
          </tr>
        `;
      } else if (recordsForStudent.length === 0) {
        tableRows += `
          <tr>
            <td>${student.student_id}</td>
            <td>${student.name}</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>${internalDisplay}</td>
            <td>
              <button class="btn btn-primary btn-sm" onclick="facultyMarks.addStudentMarks(${student.id}, ${subject.id}, '${assessmentFilter}')">
                <span>➕</span> Add
              </button>
            </td>
          </tr>
        `;
      } else {
        recordsForStudent.forEach((record, index) => {
          const percentage = record.max_marks > 0 ? Math.round((record.marks / record.max_marks) * 100) : 0;
          
          tableRows += `
            <tr>
              <td>${index === 0 ? student.student_id : ''}</td>
              <td>${index === 0 ? student.name : ''}</td>
              <td>${this.marksCalculator.getAssessmentText(record.assessment_type)}${record.assignment_number ? ` (Assignment ${record.assignment_number})` : ''}</td>
              <td>${record.marks}</td>
              <td>${record.max_marks}</td>
              <td>
                <span class="badge ${this.marksCalculator.getPercentageBadgeClass(percentage)}">${percentage}%</span>
              </td>
              <td>${internalDisplay}</td>
              <td>
                <button class="btn btn-primary btn-sm" onclick="facultyMarks.editMarks(${record.id})">
                  <span>✏️</span>
                </button>
              </td>
            </tr>
          `;
        });
      }
    });

    tbody.innerHTML = tableRows;
  }

  // Use marksCalculator's method
  getAssessmentText(assessmentType) {
    return this.marksCalculator.getAssessmentText(assessmentType);
  }

  // Use marksCalculator's method
  getPercentageBadgeClass(percentage) {
    return this.marksCalculator.getPercentageBadgeClass(percentage);
  }

  showMarksStats(students, marksRecords) {
    console.log('FacultyMarks: showMarksStats() called.');
    if (marksRecords.length === 0) {
      document.getElementById('marksStats').style.display = 'none';
      return;
    }

    const totalMarks = marksRecords.reduce((sum, record) => sum + record.marks, 0);
    const totalMaxMarks = marksRecords.reduce((sum, record) => sum + record.max_marks, 0);
    const avgMarks = marksRecords.length > 0 ? Math.round(totalMarks / marksRecords.length) : 0;
    const avgPercentage = totalMaxMarks > 0 ? Math.round((totalMarks / totalMaxMarks) * 100) : 0;
    const highestMarks = marksRecords.length > 0 ? Math.max(...marksRecords.map(r => r.marks)) : 0;
    // Removed passedStudents calculation as grades are removed

    document.getElementById('totalStudents').textContent = students.length;
    document.getElementById('avgMarks').textContent = `${avgMarks} (${avgPercentage}%)`;
    document.getElementById('highestMarks').textContent = highestMarks;
    // document.getElementById('passedStudents').textContent = `${passedStudents}/${marksRecords.length}`; // Removed

    document.getElementById('marksStats').style.display = 'grid';
  }

  showPerformanceAnalysis(marksRecords) {
    console.log('FacultyMarks: showPerformanceAnalysis() called.');
    if (marksRecords.length === 0) {
      document.getElementById('performanceAnalysis').style.display = 'none';
      return;
    }

    // Removed Grade distribution
    const gradeContainer = document.getElementById('gradeDistribution');
    if (gradeContainer) gradeContainer.innerHTML = '<p class="text-center text-gray-500">Grade distribution not available (grades removed).</p>';


    // Performance insights
    const totalMarks = marksRecords.reduce((sum, record) => sum + record.marks, 0);
    const totalMaxMarks = marksRecords.reduce((sum, record) => sum + record.max_marks, 0);
    const avgPercentage = totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0;
    // Removed passRate calculation

    const insights = [];
    if (avgPercentage >= 80) {
      insights.push({ icon: '🎉', text: 'Excellent class performance!', color: 'var(--success)' });
    } else if (avgPercentage >= 60) {
      insights.push({ icon: '👍', text: 'Good class performance', color: 'var(--primary)' });
    } else {
      insights.push({ icon: '⚠️', text: 'Class needs improvement', color: 'var(--warning)' });
    }

    const insightsContainer = document.getElementById('performanceInsights');
    insightsContainer.innerHTML = insights.map(insight => `
      <div style="padding: 10px; margin-bottom: 10px; background: var(--gray-50); border-left: 4px solid ${insight.color}; border-radius: 4px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1.2rem;">${insight.icon}</span>
          <span>${insight.text}</span>
        </div>
      </div>
    `).join('');

    document.getElementById('performanceAnalysis').style.display = 'block';
  }

  showAddMarksModal() {
    console.log('FacultyMarks: showAddMarksModal triggered.'); // DEBUG
    try {
      document.getElementById('marksModalTitle').textContent = 'Add Marks';
      document.getElementById('marksForm').reset();
      document.getElementById('marksId').value = '';
      document.getElementById('studentsMarksList').style.display = 'none';
      this.loadSubjectsDropdown(); // Refresh dropdown
      document.getElementById('marksModal').style.display = 'flex'; // This line should make it visible
      document.getElementById('marksMaxMarks').readOnly = false; // Reset to editable by default
      document.getElementById('marksAssessment').innerHTML = `
        <option value="">Select Assessment</option>
        <option value="mid1">Mid-1 Exam</option>
        <option value="mid2">Mid-2 Exam</option>
        <option value="assignment">Assignment</option>
        <option value="quiz">Quiz</option>
        <option value="lab_exam">Lab Exam</option>
        <option value="project">Project</option>
        <option value="lab_day_to_day">Lab Day-to-Day</option>
      `; // Ensure all options are present
      document.getElementById('assignmentNumberGroup').style.display = 'none'; // Hide assignment number dropdown
      document.getElementById('marksAssignmentNumber').innerHTML = '<option value="">Select Assignment</option>';
      console.log('FacultyMarks: showAddMarksModal completed successfully.');
    } catch (error) {
      console.error('FacultyMarks: Error in showAddMarksModal:', error);
      this.showAlert('Error opening Add Marks modal. Check console for details.', 'error');
    }
  }

  addStudentMarks(studentId, subjectId, assessmentType = '', assignmentNumber = null) {
    console.log('FacultyMarks: addStudentMarks triggered for student:', studentId, 'subject:', subjectId, 'assessmentType:', assessmentType, 'assignmentNumber:', assignmentNumber); // DEBUG
    const subject = this.subjectsTaught.find(s => s.id === subjectId);
    if (!subject) {
      console.error('FacultyMarks: Subject not found for addStudentMarks:', subjectId);
      this.showAlert('Subject not found for marks entry.', 'error');
      return;
    }

    const selectedValue = `${subject.id}_${subject.branch}_${subject.year}_${subject.semester}_${subject.section}_${subject.type}`;
    
    document.getElementById('marksModalTitle').textContent = `Add Marks for ${subject.name}`;
    document.getElementById('marksForm').reset();
    document.getElementById('marksId').value = '';
    document.getElementById('marksSubject').value = selectedValue;
    document.getElementById('marksAssessment').value = assessmentType;

    // Filter studentsInClass to only include the specific student being edited
    this.studentsInClass = campusDB.getStudents({
      branch: subject.branch,
      year: subject.year,
      semester: subject.semester,
      section: subject.section
    }).filter(s => s.id === studentId);

    if (assessmentType === 'assignment') {
        this._handleAssignmentSelection(selectedValue, assignmentNumber);
    } else {
        document.getElementById('assignmentNumberGroup').style.display = 'none';
        this.handleAssessmentChange(); // This will render the inputs for the single student
    }
    document.getElementById('marksModal').style.display = 'flex';
  }

  handleSubjectChange() {
    console.log('FacultyMarks: handleSubjectChange triggered.'); // DEBUG
    const selectedValue = document.getElementById('marksSubject').value;
    const assessmentSelect = document.getElementById('marksAssessment');
    
    if (!selectedValue) {
      document.getElementById('studentsMarksList').style.display = 'none';
      assessmentSelect.innerHTML = '<option value="">Select Assessment</option>'; // Clear assessment options
      document.getElementById('assignmentNumberGroup').style.display = 'none'; // Hide assignment dropdown
      return;
    }

    const [subjectId, branch, year, semester, section, subjectType] = selectedValue.split('_');
    console.log('FacultyMarks: handleSubjectChange - Parsed subjectType:', subjectType); // DEBUG
    const filters = { branch: branch, year: parseInt(year), semester: parseInt(semester), section: section };
    this.studentsInClass = campusDB.getStudents(filters);

    // Dynamically populate assessment types based on subject type
    let assessmentOptions = `
      <option value="">Select Assessment</option>
      <option value="mid1">Mid-1 Exam</option>
      <option value="mid2">Mid-2 Exam</option>
      <option value="assignment">Assignment</option>
      <option value="quiz">Quiz</option>
      <option value="project">Project</option>
    `;
    if (subjectType === 'lab') {
      assessmentOptions += `<option value="lab_day_to_day">Lab Day-to-Day</option>`;
    } else { // Theory or skill_course
      // No specific lab_day_to_day for theory
    }
    assessmentSelect.innerHTML = assessmentOptions;

    document.getElementById('assignmentNumberGroup').style.display = 'none'; // Hide assignment number dropdown by default
    this.handleAssessmentChange(); // Trigger assessment change to render inputs
  }

  handleAssessmentChange() {
    console.log('FacultyMarks: handleAssessmentChange triggered.'); // DEBUG
    const selectedValue = document.getElementById('marksSubject').value;
    const assessmentType = document.getElementById('marksAssessment').value;
    const maxMarksInput = document.getElementById('marksMaxMarks');
    const studentsMarksList = document.getElementById('studentsMarksList');
    const bulkMarksInput = document.getElementById('bulkMarks');
    const applyBulkBtn = document.querySelector('#studentsMarksList button:nth-of-type(1)');
    const markAllAbsentBtn = document.querySelector('#studentsMarksList button:nth-of-type(2)');
    const assignmentNumberGroup = document.getElementById('assignmentNumberGroup');


    if (!selectedValue || !assessmentType) {
      studentsMarksList.style.display = 'none';
      assignmentNumberGroup.style.display = 'none';
      return;
    }

    const [subjectId, branch, year, semester, section, subjectType] = selectedValue.split('_');
    console.log('FacultyMarks: handleAssessmentChange - Parsed subjectType:', subjectType); // DEBUG
    const subjectClassId = `${subjectId}_${branch}_${year}_${semester}_${section}`;

    // Handle assignment type specifically
    if (assessmentType === 'assignment') {
        this._handleAssignmentSelection(selectedValue);
        return; // Exit here, further logic handled by _handleAssignmentSelection and handleAssignmentNumberChange
    } else {
        assignmentNumberGroup.style.display = 'none'; // Hide if not assignment
        document.getElementById('marksAssignmentNumber').innerHTML = '<option value="">Select Assignment</option>'; // Clear assignment dropdown
    }

    // Set default max marks based on assessment type and subject type
    if (assessmentType === 'mid1' || assessmentType === 'mid2') {
      maxMarksInput.value = subjectType === 'lab' ? 10 : 25;
      maxMarksInput.readOnly = false;
      bulkMarksInput.style.display = 'inline-block';
      applyBulkBtn.style.display = 'inline-block';
      markAllAbsentBtn.style.display = 'inline-block';
    } else if (assessmentType === 'lab_day_to_day') {
      maxMarksInput.value = 20; // Fixed for lab day-to-day
      maxMarksInput.readOnly = true;
      bulkMarksInput.style.display = 'inline-block';
      applyBulkBtn.style.display = 'inline-block';
      markAllAbsentBtn.style.display = 'inline-block';
    } else if (assessmentType === 'quiz') {
      maxMarksInput.value = 10; // Default for quiz
      maxMarksInput.readOnly = false;
      bulkMarksInput.style.display = 'inline-block';
      applyBulkBtn.style.display = 'inline-block';
      markAllAbsentBtn.style.display = 'inline-block';
    } else if (assessmentType === 'lab_exam') {
      maxMarksInput.value = 50;
      maxMarksInput.readOnly = false;
      bulkMarksInput.style.display = 'inline-block';
      applyBulkBtn.style.display = 'inline-block';
      markAllAbsentBtn.style.display = 'inline-block';
    } else if (assessmentType === 'project') {
      maxMarksInput.value = 100;
      maxMarksInput.readOnly = false;
      bulkMarksInput.style.display = 'inline-block';
      applyBulkBtn.style.display = 'inline-block';
      markAllAbsentBtn.style.display = 'inline-block';
    } else {
      maxMarksInput.value = '';
      maxMarksInput.readOnly = false;
      bulkMarksInput.style.display = 'none'; // Hide bulk entry if no assessment selected
      applyBulkBtn.style.display = 'none';
      markAllAbsentBtn.style.display = 'none';
    }

    this.renderStudentsMarksInputs(subjectClassId, assessmentType, subjectType);
    studentsMarksList.style.display = 'block';
  }

  _handleAssignmentSelection(selectedValue, preselectedAssignmentNumber = null) {
    console.log('FacultyMarks: _handleAssignmentSelection called with selectedValue:', selectedValue); // DEBUG
    const assignmentNumberGroup = document.getElementById('assignmentNumberGroup');
    const marksAssignmentNumberSelect = document.getElementById('marksAssignmentNumber');
    const maxMarksInput = document.getElementById('marksMaxMarks');
    const studentsMarksList = document.getElementById('studentsMarksList');
    const bulkMarksInput = document.getElementById('bulkMarks');
    const applyBulkBtn = document.querySelector('#studentsMarksList button:nth-of-type(1)');
    const markAllAbsentBtn = document.querySelector('#studentsMarksList button:nth-of-type(2)');

    assignmentNumberGroup.style.display = 'block';
    marksAssignmentNumberSelect.innerHTML = '<option value="">Select Assignment</option>';
    maxMarksInput.readOnly = true; // Max marks for assignments are fixed by the assignment itself

    const [subjectId, branch, year, semester, section, subjectType] = selectedValue.split('_');
    console.log('FacultyMarks: Parsed subjectType in _handleAssignmentSelection:', subjectType); // DEBUG
    
    // Always populate Assignment 1 to 5 for any subject type
    console.log('FacultyMarks: Populating 1-5 assignments for any subject type.'); // DEBUG
    for (let i = 1; i <= 5; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Assignment ${i}`;
        marksAssignmentNumberSelect.appendChild(option);
    }
    marksAssignmentNumberSelect.disabled = false;
    maxMarksInput.value = 5; // Fixed max marks for each assignment is 5
    

    if (preselectedAssignmentNumber) {
        marksAssignmentNumberSelect.value = preselectedAssignmentNumber;
    } else {
        marksAssignmentNumberSelect.value = ''; // Clear selection if no preselected
    }
    this.handleAssignmentNumberChange(); // Trigger to load students and set max marks
  }

  handleAssignmentNumberChange() {
    console.log('FacultyMarks: handleAssignmentNumberChange() called.');
    const selectedAssignmentNumber = document.getElementById('marksAssignmentNumber').value;
    const maxMarksInput = document.getElementById('marksMaxMarks');
    const studentsMarksList = document.getElementById('studentsMarksList');
    const bulkMarksInput = document.getElementById('bulkMarks');
    const applyBulkBtn = document.querySelector('#studentsMarksList button:nth-of-type(1)');
    const markAllAbsentBtn = document.querySelector('#studentsMarksList button:nth-of-type(2)');

    if (!selectedAssignmentNumber) {
      maxMarksInput.value = '';
      studentsMarksList.style.display = 'none';
      bulkMarksInput.style.display = 'none';
      applyBulkBtn.style.display = 'none';
      markAllAbsentBtn.style.display = 'none';
      return;
    }

    // For assignments 1-5, max marks is fixed at 5
    const fixedAssignmentMaxMarks = 5; 
    maxMarksInput.value = fixedAssignmentMaxMarks;
    maxMarksInput.readOnly = true; // Max marks for these assignments are fixed
    bulkMarksInput.style.display = 'inline-block';
    applyBulkBtn.style.display = 'inline-block';
    markAllAbsentBtn.style.display = 'inline-block';
    
    const selectedSubjectValue = document.getElementById('marksSubject').value;
    const [subjectId, branch, year, semester, section, subjectType] = selectedSubjectValue.split('_');
    const subjectClassId = `${subjectId}_${branch}_${year}_${semester}_${section}`;
    this.renderStudentsMarksInputs(subjectClassId, 'assignment', subjectType, selectedAssignmentNumber);
    studentsMarksList.style.display = 'block';
  }

  renderStudentsMarksInputs(subjectClassId, assessmentType, subjectType, selectedAssignmentNumber = null) {
    console.log('FacultyMarks: renderStudentsMarksInputs() called.');
    const tbody = document.getElementById('studentsMarksBody');
    const maxMarks = parseInt(document.getElementById('marksMaxMarks').value);
    const currentSubjectId = subjectClassId.split('_')[0];
    
    if (this.studentsInClass.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No students found for this class</td></tr>';
      return;
    }

    let inputsHtml = '';

    if (assessmentType === 'assignment' && selectedAssignmentNumber) {
      // For a specific assignment number (1-5)
      inputsHtml = this.studentsInClass.map(student => {
        const existingMark = campusDB.getStorageData('marks').find(m => 
          m.student_id === student.id && 
          m.subject_id == currentSubjectId && 
          m.assessment_type === 'assignment' &&
          m.assignment_number == selectedAssignmentNumber // Use assignment_number
        );
        const marksValue = existingMark ? existingMark.marks : '';
        const isAbsent = existingMark && existingMark.marks === 0 && existingMark.max_marks > 0;

        return `
          <tr data-student-id="${student.id}">
            <td>${student.student_id}</td>
            <td>${student.name}</td>
            <td>
              <input type="number" class="form-input marks-input" id="marks_${student.id}_${selectedAssignmentNumber}" 
                     min="0" max="${maxMarks}" value="${marksValue}" 
                     onchange="facultyMarks.updatePercentage(${student.id}, ${selectedAssignmentNumber})" ${isAbsent ? 'disabled' : ''}>
            </td>
            <td>
              <span id="percentage_${student.id}_${selectedAssignmentNumber}" class="badge ${this.marksCalculator.getPercentageBadgeClass(isAbsent ? 0 : (marksValue / maxMarks) * 100)}">${isAbsent ? 'Absent' : (marksValue !== '' ? Math.round((marksValue / maxMarks) * 100) + '%' : '-%')}</span>
            </td>
            <td>
              <input type="checkbox" id="absent_${student.id}_${selectedAssignmentNumber}" onchange="facultyMarks.toggleAbsent(${student.id}, ${selectedAssignmentNumber})" ${isAbsent ? 'checked' : ''}>
            </td>
          </tr>
        `;
      }).join('');

    } else {
      // For other assessment types (mid1, mid2, lab_day_to_day, lab_exam, project, quiz)
      inputsHtml = this.studentsInClass.map(student => {
        const existingMark = campusDB.getStorageData('marks').find(m => 
          m.student_id === student.id && 
          m.subject_id == currentSubjectId && 
          m.assessment_type === assessmentType
        );
        const marksValue = existingMark ? existingMark.marks : '';
        const isAbsent = existingMark && existingMark.marks === 0 && existingMark.max_marks > 0;
        const percentage = existingMark && existingMark.max_marks > 0 ? Math.round((existingMark.marks / existingMark.max_marks) * 100) : 0;

        return `
          <tr data-student-id="${student.id}">
            <td>${student.student_id}</td>
            <td>${student.name}</td>
            <td>
              <input type="number" class="form-input marks-input" id="marks_${student.id}" 
                     min="0" max="${maxMarks}" value="${marksValue}" 
                     onchange="facultyMarks.updatePercentage(${student.id})" ${isAbsent ? 'disabled' : ''}>
            </td>
            <td>
              <span id="percentage_${student.id}" class="badge ${this.marksCalculator.getPercentageBadgeClass(percentage)}">${isAbsent ? 'Absent' : percentage + '%'}</span>
            </td>
            <td>
              <input type="checkbox" id="absent_${student.id}" onchange="facultyMarks.toggleAbsent(${student.id})" ${isAbsent ? 'checked' : ''}>
            </td>
          </tr>
        `;
      }).join('');
    }
    tbody.innerHTML = inputsHtml;
  }

  updatePercentage(studentId, assignmentNumber = null) {
    console.log('FacultyMarks: updatePercentage() called.');
    const idSuffix = assignmentNumber ? `_${assignmentNumber}` : '';
    const marksInput = document.getElementById(`marks_${studentId}${idSuffix}`);
    const assessmentType = document.getElementById('marksAssessment').value;
    const selectedSubjectValue = document.getElementById('marksSubject').value;
    const [subjectId, branch, year, semester, section, subjectType] = selectedSubjectValue.split('_');

    let maxMarks;
    if (assignmentNumber) {
      maxMarks = 5; // Fixed max marks for assignments 1-5
    } else if (assessmentType === 'mid1' || assessmentType === 'mid2') {
      maxMarks = subjectType === 'lab' ? 10 : 25;
    } else if (assessmentType === 'lab_day_to_day') {
      maxMarks = 20;
    } else if (assessmentType === 'quiz') {
      maxMarks = 10;
    } else if (assessmentType === 'lab_exam') {
      maxMarks = 50;
    } else if (assessmentType === 'project') {
      maxMarks = 100;
    } else {
      maxMarks = parseInt(document.getElementById('marksMaxMarks').value) || 100;
    }
    
    const marks = parseInt(marksInput.value) || 0;
    const percentage = maxMarks > 0 ? Math.round((marks / maxMarks) * 100) : 0;
    
    const percentageSpan = document.getElementById(`percentage_${studentId}${idSuffix}`);
    percentageSpan.textContent = `${percentage}%`;
    percentageSpan.className = `badge ${this.marksCalculator.getPercentageBadgeClass(percentage)}`;
  }

  updateAllPercentages() {
    console.log('FacultyMarks: updateAllPercentages() called.');
    const assessmentType = document.getElementById('marksAssessment').value;
    const selectedAssignmentNumber = document.getElementById('marksAssignmentNumber').value;

    if (assessmentType === 'assignment' && selectedAssignmentNumber) {
      this.studentsInClass.forEach(student => {
        this.updatePercentage(student.id, selectedAssignmentNumber);
      });
    } else if (assessmentType !== 'assignment') {
      this.studentsInClass.forEach(student => {
        this.updatePercentage(student.id);
      });
    }
  }

  toggleAbsent(studentId, assignmentNumber = null) {
    console.log('FacultyMarks: toggleAbsent() called.');
    const idSuffix = assignmentNumber ? `_${assignmentNumber}` : '';
    const absentCheckbox = document.getElementById(`absent_${studentId}${idSuffix}`);
    const marksInput = document.getElementById(`marks_${studentId}${idSuffix}`);
    const percentageSpan = document.getElementById(`percentage_${studentId}${idSuffix}`);
    
    if (absentCheckbox.checked) {
      marksInput.value = '';
      marksInput.disabled = true;
      percentageSpan.textContent = 'Absent';
      percentageSpan.className = 'badge badge-error';
    } else {
      marksInput.disabled = false;
      this.updatePercentage(studentId, assignmentNumber);
    }
  }

  applyBulkMarks() {
    console.log('FacultyMarks: applyBulkMarks() called.');
    const bulkMarks = document.getElementById('bulkMarks').value;
    if (bulkMarks === '' || isNaN(bulkMarks)) {
      this.showAlert('Please enter a valid marks value', 'error');
      return;
    }
    const assessmentType = document.getElementById('marksAssessment').value;
    const maxMarks = parseInt(document.getElementById('marksMaxMarks').value) || 100;
    const parsedBulkMarks = parseInt(bulkMarks);

    if (parsedBulkMarks < 0 || parsedBulkMarks > maxMarks) {
      this.showAlert(`Bulk marks must be between 0 and ${maxMarks}`, 'error');
      return;
    }

    const selectedAssignmentNumber = document.getElementById('marksAssignmentNumber').value;

    if (assessmentType === 'assignment' && selectedAssignmentNumber) {
      this.studentsInClass.forEach(student => {
        const marksInput = document.getElementById(`marks_${student.id}_${selectedAssignmentNumber}`);
        const absentCheckbox = document.getElementById(`absent_${student.id}_${selectedAssignmentNumber}`);
        if (!absentCheckbox.checked) {
          marksInput.value = parsedBulkMarks;
          this.updatePercentage(student.id, selectedAssignmentNumber);
        }
      });
    } else if (assessmentType !== 'assignment') {
      this.studentsInClass.forEach(student => {
        const marksInput = document.getElementById(`marks_${student.id}`);
        const absentCheckbox = document.getElementById(`absent_${student.id}`);
        
        if (!absentCheckbox.checked) {
          marksInput.value = parsedBulkMarks;
          this.updatePercentage(student.id);
        }
      });
    }

    document.getElementById('bulkMarks').value = '';
  }

  setAllAbsent() {
    console.log('FacultyMarks: setAllAbsent() called.');
    const assessmentType = document.getElementById('marksAssessment').value;
    const selectedAssignmentNumber = document.getElementById('marksAssignmentNumber').value;

    if (assessmentType === 'assignment' && selectedAssignmentNumber) {
      this.studentsInClass.forEach(student => {
        const absentCheckbox = document.getElementById(`absent_${student.id}_${selectedAssignmentNumber}`);
        absentCheckbox.checked = true;
        this.toggleAbsent(student.id, selectedAssignmentNumber);
      });
    } else if (assessmentType !== 'assignment') {
      this.studentsInClass.forEach(student => {
        const absentCheckbox = document.getElementById(`absent_${student.id}`);
        absentCheckbox.checked = true;
        this.toggleAbsent(student.id);
      });
    }
  }

  saveMarks() {
    console.log('FacultyMarks: saveMarks() called.');
    const selectedValue = document.getElementById('marksSubject').value;
    const assessmentType = document.getElementById('marksAssessment').value;
    const maxMarks = parseInt(document.getElementById('marksMaxMarks').value);
    const selectedAssignmentNumber = document.getElementById('marksAssignmentNumber').value;

    if (!selectedValue || !assessmentType || !maxMarks) {
      this.showAlert('Please fill all required fields', 'error');
      return;
    }
    if (assessmentType === 'assignment' && !selectedAssignmentNumber) {
        this.showAlert('Please select a specific assignment number.', 'error');
        return;
    }

    const [subjectId, branch, year, semester, section, subjectType] = selectedValue.split('_');
    const subjectClassId = `${subjectId}_${branch}_${year}_${semester}_${section}`;

    try {
      let savedCount = 0;
      const errors = [];
      const currentUser = getCurrentUser();

      if (assessmentType === 'assignment') {
        // For assignments, max marks is fixed at 5
        const fixedAssignmentMaxMarks = 5; 

        this.studentsInClass.forEach(student => {
          const marksInput = document.getElementById(`marks_${student.id}_${selectedAssignmentNumber}`);
          const absentCheckbox = document.getElementById(`absent_${student.id}_${selectedAssignmentNumber}`);
          
          const marks = absentCheckbox.checked ? 0 : parseInt(marksInput.value) || 0;
          
          if (!absentCheckbox.checked && !marksInput.value) {
            return; // Skip students without marks entered for this specific assignment
          }

          if (marks < 0 || marks > fixedAssignmentMaxMarks) {
            errors.push(`Marks for ${student.name}'s Assignment ${selectedAssignmentNumber} (${marks}) are out of range (0-${fixedAssignmentMaxMarks}).`);
            return;
          }

          const markData = {
            student_id: student.id,
            subject_id: parseInt(subjectId),
            assessment_type: assessmentType,
            assignment_number: parseInt(selectedAssignmentNumber), // Store assignment number
            marks: marks,
            max_marks: fixedAssignmentMaxMarks, // Use fixed max marks
            date: new Date().toISOString().split('T')[0],
            entered_by: currentUser.id
          };

          try {
            const existingMark = campusDB.getStorageData('marks').find(m => 
              m.student_id === student.id && 
              m.subject_id == subjectId && 
              m.assessment_type === assessmentType &&
              m.assignment_number == selectedAssignmentNumber // Look up by assignment_number
            );

            if (existingMark) {
              campusDB.update('marks', existingMark.id, markData);
            } else {
              campusDB.create('marks', markData);
            }
            savedCount++;
          } catch (error) {
            errors.push(`Error saving marks for ${student.name}'s Assignment ${selectedAssignmentNumber}: ${error.message}`);
          }
        });

      } else {
        this.studentsInClass.forEach(student => {
          const marksInput = document.getElementById(`marks_${student.id}`);
          const absentCheckbox = document.getElementById(`absent_${student.id}`);
          
          const marks = absentCheckbox.checked ? 0 : parseInt(marksInput.value) || 0;
          
          if (!absentCheckbox.checked && !marksInput.value) {
            return; // Skip students without marks entered
          }

          if (marks < 0 || marks > maxMarks) {
            errors.push(`Marks for ${student.name} (${marks}) are out of range (0-${maxMarks}).`);
            return;
          }

          // Check if marks already exist for this student and assessment
          const existingMark = campusDB.getStorageData('marks').find(m => 
            m.student_id === student.id && 
            m.subject_id == subjectId && 
            m.assessment_type === assessmentType
          );

          const markData = {
            student_id: student.id,
            subject_id: parseInt(subjectId),
            assessment_type: assessmentType,
            marks: marks,
            max_marks: maxMarks,
            date: new Date().toISOString().split('T')[0],
            entered_by: currentUser.id
          };

          try {
            if (existingMark) {
              campusDB.update('marks', existingMark.id, markData);
            } else {
              campusDB.create('marks', markData);
            }
            savedCount++;
          } catch (error) {
            errors.push(`Error saving marks for ${student.name}: ${error.message}`);
            }
        });
      }

      if (errors.length === 0) {
        this.showAlert(`Marks saved successfully for ${savedCount} records`, 'success');
        this.hideMarksModal();
        this.loadMarks(); // Refresh the marks view
      } else {
        this.showAlert(`Partially saved. ${errors.length} errors occurred.`, 'warning');
        console.error('Marks save errors:', errors);
      }

    } catch (error) {
      console.error('FacultyMarks: Error saving marks:', error);
      this.showAlert('Error saving marks', 'error');
    }
  }

  // New function to edit marks for a specific student's assignments
  editMarksForStudentAssignments(studentId, subjectId, assignmentNumber) {
    console.log('FacultyMarks: editMarksForStudentAssignments triggered for student:', studentId, 'subject:', subjectId, 'assignmentNumber:', assignmentNumber); // DEBUG
    const subject = this.subjectsTaught.find(s => s.id === subjectId);
    if (!subject) {
      console.error('FacultyMarks: Subject not found for editMarksForStudentAssignments:', subjectId);
      this.showAlert('Subject not found for marks entry.', 'error');
      return;
    }

    const selectedValue = `${subject.id}_${subject.branch}_${subject.year}_${subject.semester}_${subject.section}_${subject.type}`;
    
    document.getElementById('marksModalTitle').textContent = 'Edit Assignment Marks';
    document.getElementById('marksForm').reset();
    document.getElementById('marksSubject').value = selectedValue;
    document.getElementById('marksAssessment').value = 'assignment';
    
    // Filter studentsInClass to only include the specific student being edited
    this.studentsInClass = campusDB.getStudents({
      branch: subject.branch,
      year: subject.year,
      semester: subject.semester,
      section: subject.section
    }).filter(s => s.id === studentId);

    this._handleAssignmentSelection(selectedValue, assignmentNumber); // Pass preselected assignment NUMBER
    document.getElementById('marksModal').style.display = 'flex';
  }

  // New function to edit marks for a specific student's lab day-to-day
  editMarksForStudentLabDayToDay(studentId, subjectId) {
    console.log('FacultyMarks: editMarksForStudentLabDayToDay() called.');
    const subject = this.subjectsTaught.find(s => s.id === subjectId);
    if (!subject) {
      console.error('FacultyMarks: Subject not found for editMarksForStudentLabDayToDay:', subjectId);
      this.showAlert('Subject not found for marks entry.', 'error');
      return;
    }

    const selectedValue = `${subject.id}_${subject.branch}_${subject.year}_${subject.semester}_${subject.section}_${subject.type}`;
    
    document.getElementById('marksModalTitle').textContent = 'Edit Lab Day-to-Day Marks';
    document.getElementById('marksForm').reset();
    document.getElementById('marksSubject').value = selectedValue;
    document.getElementById('marksAssessment').value = 'lab_day_to_day';
    document.getElementById('marksMaxMarks').value = 20; // Fixed for lab day-to-day
    document.getElementById('marksMaxMarks').readOnly = true;

    // Filter studentsInClass to only include the specific student being edited
    this.studentsInClass = campusDB.getStudents({
      branch: subject.branch,
      year: subject.year,
      semester: subject.semester,
      section: subject.section
    }).filter(s => s.id === studentId);

    this.handleAssessmentChange(); // This will render the lab day-to-day inputs for the single student
    document.getElementById('marksModal').style.display = 'flex';
  }

  hideMarksModal() {
    console.log('FacultyMarks: hideMarksModal() called.');
    document.getElementById('marksModal').style.display = 'none';
  }

  exportMarks() {
    console.log('FacultyMarks: exportMarks() called.');
    const selectedValue = document.getElementById('subjectFilter').value;
    const assessmentFilter = document.getElementById('assessmentFilter').value;
    const assignmentNumberFilter = document.getElementById('assignmentNumberFilter')?.value;

    if (!selectedValue) {
      this.showAlert('Please select a subject/class', 'warning');
      return;
    }

    const [subjectId, branch, year, semester, section, subjectType] = selectedValue.split('_');
    const subject = this.subjectsTaught.find(s => 
      s.id == subjectId && s.branch === branch && s.year == parseInt(year) && s.semester == parseInt(semester) && s.section === section
    );

    if (!subject) {
      console.error('FacultyMarks: Subject not found for export:', selectedValue);
      this.showAlert('Selected subject not found for export.', 'error');
      return;
    }

    // Get students and marks data
    const filters = { branch: branch, year: parseInt(year), semester: parseInt(semester), section: section };
    const students = campusDB.getStudents(filters);
    let marksRecords = campusDB.getStorageData('marks').filter(m => m.subject_id == subjectId);
    
    // Include internal marks calculation in export
    const exportData = [];
    students.forEach(student => {
      const studentMarks = marksRecords.filter(m => m.student_id === student.id);
      const internalMarksResult = this.marksCalculator.calculateSubjectInternalMarks(student.id, subject.id, campusDB.getStorageData('marks'), subject.type);
      const calculatedInternal = internalMarksResult.totalInternal;
      const maxInternal = internalMarksResult.maxInternal;

      if (assessmentFilter === 'assignment' && assignmentNumberFilter) {
        const fixedAssignmentMaxMarks = 5; // Each assignment is out of 5
        const record = studentMarks.find(r => r.assessment_type === 'assignment' && r.assignment_number == assignmentNumberFilter);
        const marks = record ? record.marks : 'N/A';
        const max_marks = fixedAssignmentMaxMarks;
        const percentage = marks !== 'N/A' && max_marks > 0 ? Math.round((marks / max_marks) * 100) : 'N/A';
        exportData.push({
          student_id: student.student_id,
          name: student.name,
          assessment: `Assignment ${assignmentNumberFilter}`,
          marks: marks,
          max_marks: max_marks,
          percentage: percentage,
          calculated_internal: calculatedInternal,
          max_internal: maxInternal
        });
      } else if (assessmentFilter === 'lab_day_to_day') {
        const record = studentMarks.find(r => r.assessment_type === 'lab_day_to_day');
        const marks = record ? record.marks : 'N/A';
        const max_marks = record ? record.max_marks : 20;
        const percentage = marks !== 'N/A' && max_marks > 0 ? Math.round((marks / max_marks) * 100) : 'N/A';
        exportData.push({
          student_id: student.student_id,
          name: student.name,
          assessment: 'Lab Day-to-Day',
          marks: marks,
          max_marks: max_marks,
          percentage: percentage,
          calculated_internal: calculatedInternal,
          max_internal: maxInternal
        });
      }
      else if (assessmentFilter) { // Specific assessment type (excluding assignment with number)
        const mark = studentMarks.find(m => m.assessment_type === assessmentFilter);
        const marks = mark ? mark.marks : 'N/A';
        const max_marks = mark ? mark.max_marks : 'N/A';
        const percentage = marks !== 'N/A' && max_marks > 0 ? Math.round((marks / max_marks) * 100) : 'N/A';
        exportData.push({
          student_id: student.student_id,
          name: student.name,
          assessment: this.marksCalculator.getAssessmentText(assessmentFilter),
          marks: marks,
          max_marks: max_marks,
          percentage: percentage,
          calculated_internal: calculatedInternal,
          max_internal: maxInternal
        });
      } else { // All assessments
        studentMarks.forEach(mark => {
          const percentage = mark.max_marks > 0 ? Math.round((mark.marks / mark.max_marks) * 100) : 0;
          exportData.push({
            student_id: student.student_id,
            name: student.name,
            assessment: this.marksCalculator.getAssessmentText(mark.assessment_type) + (mark.assignment_number ? ` (Assignment ${mark.assignment_number})` : ''),
            marks: mark.marks,
            max_marks: mark.max_marks,
            percentage: percentage,
            calculated_internal: calculatedInternal,
            max_internal: maxInternal
          });
        });
      }
    });

    // Convert to CSV
    const headers = Object.keys(exportData[0] || {});
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marks_${subject.code}_${branch}_Y${year}_S${semester}_Sec${section}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    this.showAlert('Marks exported successfully', 'success');
  }

  showAlert(message, type) {
    console.log(`FacultyMarks: showAlert() called with message: "${message}", type: "${type}"`);
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.content-area .alert');
    existingAlerts.forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    const contentArea = document.querySelector('.content-area');
    contentArea.insertBefore(alert, contentArea.firstChild);

    setTimeout(() => {
      if (alert.parentNode) {
        alert.remove();
      }
    }, 5000);
  }
}

// Global functions for inline event handlers
function showAddMarksModal() {
  facultyMarks.showAddMarksModal();
}

function hideMarksModal() {
  facultyMarks.hideMarksModal();
}

function saveMarks() {
  facultyMarks.saveMarks();
}

function loadMarks() {
  facultyMarks.loadMarks();
}

function exportMarks() {
  facultyMarks.exportMarks();
}

// Initialize when DOM is loaded
let facultyMarks;
document.addEventListener('DOMContentLoaded', () => {
  facultyMarks = new FacultyMarks();
});