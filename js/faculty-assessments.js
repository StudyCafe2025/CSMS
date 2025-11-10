// Faculty Assignments Management (Typed Questions & File Uploads)
class FacultyAssessments {
  constructor() {
    this.facultyData = null;
    this.subjectsTaught = [];
    this.assignments = [];
    this.filteredAssignments = [];
    this.allResources = []; // To link assignment_question_paper to resource file
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.currentAssignmentResource = null; // Store resource for download
    this.init();
  }

  init() {
    if (!requireAuth() || !requireRole('faculty')) {
      return;
    }
    this.loadFacultyData();
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', () => this.filterAssignments());
    document.getElementById('subjectFilter').addEventListener('change', () => this.filterAssignments());
    document.getElementById('typeFilter').addEventListener('change', () => this.filterAssignments());
    document.getElementById('statusFilter').addEventListener('change', () => this.filterAssignments());

    document.getElementById('assignmentForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveAssignment();
    });

    document.getElementById('assignmentType').addEventListener('change', () => this.handleAssignmentTypeChange());
  }

  loadFacultyData() {
    try {
      const currentUser = getCurrentUser();
      this.facultyData = campusDB.getFacultyByUserId(currentUser.id);
      
      if (!this.facultyData) {
        this.showAlert('Faculty data not found.', 'error');
        return;
      }

      this.subjectsTaught = campusDB.getSubjectsTaughtByFaculty(this.facultyData.id, true);
      this.allResources = campusDB.getStorageData('resources'); // Load all resources for linking
      this.populateSubjectDropdowns();
      this.loadAssignments();
    } catch (error) {
      console.error('Error loading faculty data for assignments:', error);
      this.showAlert('Error loading faculty data.', 'error');
    }
  }

  populateSubjectDropdowns() {
    const subjectFilter = document.getElementById('subjectFilter');
    const assignmentSubject = document.getElementById('assignmentSubject');
    
    const optionsHtml = this.subjectsTaught.map(subject => 
      `<option value="${subject.id}_${subject.branch}_${subject.year}_${subject.semester}_${subject.section}">` +
      `${subject.name} (${subject.code}) - Y${subject.year} S${subject.semester} Sec ${subject.section}` +
      `</option>`
    ).join('');

    subjectFilter.innerHTML = '<option value="">All My Subjects</option>' + optionsHtml;
    assignmentSubject.innerHTML = '<option value="">Select Subject & Class</option>' + optionsHtml;
  }

  loadAssignments() {
    try {
      this.assignments = campusDB.getStorageData('assignments').filter(a => a.created_by === this.facultyData.id);
      this.filteredAssignments = [...this.assignments];
      this.renderAssignmentsTable();
      this.updateTotalCount();
    } catch (error) {
      console.error('Error loading assignments:', error);
      this.showAlert('Error loading assignments', 'error');
    }
  }

  filterAssignments() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const subjectFilter = document.getElementById('subjectFilter').value;
    const typeFilter = document.getElementById('typeFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const now = new Date();

    this.filteredAssignments = this.assignments.filter(assignment => {
      const subject = this.subjectsTaught.find(s => 
        `${s.id}_${s.branch}_${s.year}_${s.semester}_${s.section}` === assignment.subject_class_id
      );
      const subjectName = subject ? subject.name.toLowerCase() : '';

      const matchesSearch = !searchTerm || 
                            assignment.title.toLowerCase().includes(searchTerm) ||
                            assignment.description.toLowerCase().includes(searchTerm) ||
                            subjectName.includes(searchTerm) ||
                            (assignment.questions && JSON.parse(assignment.questions).some(q => q.toLowerCase().includes(searchTerm)));
      const matchesSubject = !subjectFilter || assignment.subject_class_id === subjectFilter;
      const matchesType = !typeFilter || assignment.type === typeFilter;
      
      let matchesStatus = true;
      if (statusFilter) {
        const dueDate = new Date(assignment.due_date);
        if (statusFilter === 'upcoming') {
          matchesStatus = dueDate > now;
        } else if (statusFilter === 'active') {
          matchesStatus = dueDate <= now;
        } else if (statusFilter === 'overdue') {
          matchesStatus = dueDate < now;
        }
      }

      return matchesSearch && matchesSubject && matchesType && matchesStatus;
    });

    this.currentPage = 1;
    this.renderAssignmentsTable();
    this.updateTotalCount();
  }

  renderAssignmentsTable() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageAssignments = this.filteredAssignments.slice(startIndex, endIndex);
    const tbody = document.getElementById('assignmentsTableBody');
    const now = new Date();

    if (pageAssignments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No assignments found</td></tr>';
      this.renderPagination();
      return;
    }

    tbody.innerHTML = pageAssignments.map(assignment => {
      const subject = this.subjectsTaught.find(s => 
        `${s.id}_${s.branch}_${s.year}_${s.semester}_${s.section}` === assignment.subject_class_id
      );
      const subjectDisplay = subject ? `${subject.name} (${subject.code})` : 'N/A';
      const dueDate = new Date(assignment.due_date);

      let statusText = '';
      let statusBadgeClass = '';
      if (dueDate < now) {
        statusText = 'Overdue';
        statusBadgeClass = 'badge-error';
      } else if (dueDate > now) {
        statusText = 'Upcoming';
        statusBadgeClass = 'badge-warning';
      } else {
        statusText = 'Active';
        statusBadgeClass = 'badge-info';
      }

      let typeText = assignment.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      if (assignment.type === 'typed_questions') {
          typeText = 'Typed Questions';
      } else if (assignment.type === 'assignment_question_paper') {
          typeText = 'File Upload';
      }

      return `
        <tr>
          <td><strong>${assignment.title}</strong></td>
          <td>${subjectDisplay}</td>
          <td>${typeText}</td>
          <td>${assignment.max_marks}</td>
          <td>${dueDate.toLocaleDateString()}</td>
          <td>
            <span class="badge ${statusBadgeClass}">${statusText}</span>
          </td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="facultyAssessments.viewAssignmentDetails(${assignment.id})" style="margin-right: 5px;">
              <span>👁️</span> View
            </button>
            <button class="btn btn-primary btn-sm" onclick="facultyAssessments.editAssignment(${assignment.id})" style="margin-right: 5px;">
              <span>✏️</span> Edit
            </button>
            <button class="btn btn-danger btn-sm" onclick="facultyAssessments.deleteAssignment(${assignment.id})">
              <span>🗑️</span> Delete
            </button>
          </td>
        </tr>
      `;
    }).join('');
    this.renderPagination();
  }

  renderPagination() {
    const totalPages = Math.ceil(this.filteredAssignments.length / this.itemsPerPage);
    const pagination = document.getElementById('pagination');
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    let paginationHTML = '';
    paginationHTML += `
      <button ${this.currentPage === 1 ? 'disabled' : ''} onclick="facultyAssessments.goToPage(${this.currentPage - 1})">
        Previous
      </button>
    `;
    for (let i = 1; i <= totalPages; i++) {
      paginationHTML += `
        <button class="${i === this.currentPage ? 'active' : ''}" onclick="facultyAssessments.goToPage(${i})">
          ${i}
        </button>
      `;
    }
    paginationHTML += `
      <button ${this.currentPage === totalPages ? 'disabled' : ''} onclick="facultyAssessments.goToPage(${this.currentPage + 1})">
        Next
      </button>
    `;
    pagination.innerHTML = paginationHTML;
  }

  goToPage(page) {
    this.currentPage = page;
    this.renderAssignmentsTable();
  }

  updateTotalCount() {
    document.getElementById('totalAssignmentsCount').textContent = `${this.filteredAssignments.length} assignments`;
  }

  showCreateAssignmentModal() {
    document.getElementById('assignmentModalTitle').textContent = 'Create New Assignment';
    document.getElementById('assignmentForm').reset();
    document.getElementById('assignmentId').value = '';
    document.getElementById('assignmentModal').style.display = 'flex';
    
    // Reset and hide dynamic sections
    document.getElementById('assignmentQuestionsSection').style.display = 'none';
    document.getElementById('questionsContainer').innerHTML = `
        <div class="question-input-group">
            <textarea class="form-textarea assignment-question-input" placeholder="Type question 1 here..." required></textarea>
            <button type="button" class="btn btn-danger btn-sm" onclick="facultyAssessments.removeQuestionField(this)">🗑️</button>
        </div>
    `;
    document.getElementById('assignmentResourceSection').style.display = 'none';
    document.getElementById('assignmentResourceFile').value = '';
    document.getElementById('assignmentResourceFile').required = false;
    document.getElementById('assignmentType').value = ''; // Clear type selection
  }

  hideCreateAssignmentModal() {
    document.getElementById('assignmentModal').style.display = 'none';
  }

  // NEW: Handle assignment type change to show/hide relevant sections
  handleAssignmentTypeChange() {
    const assignmentType = document.getElementById('assignmentType').value;
    const questionsSection = document.getElementById('assignmentQuestionsSection');
    const resourceSection = document.getElementById('assignmentResourceSection');
    const resourceFileInput = document.getElementById('assignmentResourceFile');

    // Hide all by default
    questionsSection.style.display = 'none';
    resourceSection.style.display = 'none';
    resourceFileInput.required = false;
    
    // Set required for questions if type is typed_questions
    document.querySelectorAll('.assignment-question-input').forEach(input => {
        input.required = false;
    });

    if (assignmentType === 'typed_questions') {
      questionsSection.style.display = 'block';
      document.querySelectorAll('.assignment-question-input').forEach(input => {
          input.required = true;
      });
    } else if (assignmentType === 'assignment_question_paper') {
      resourceSection.style.display = 'block';
      resourceFileInput.required = true;
    }
  }

  // NEW: Add dynamic question field
  addQuestionField() {
    const questionsContainer = document.getElementById('questionsContainer');
    const newQuestionGroup = document.createElement('div');
    newQuestionGroup.className = 'question-input-group';
    newQuestionGroup.innerHTML = `
        <textarea class="form-textarea assignment-question-input" placeholder="Type question ${questionsContainer.children.length + 1} here..." required></textarea>
        <button type="button" class="btn btn-danger btn-sm" onclick="facultyAssessments.removeQuestionField(this)">🗑️</button>
    `;
    questionsContainer.appendChild(newQuestionGroup);
  }

  // NEW: Remove dynamic question field
  removeQuestionField(buttonElement) {
    const questionGroup = buttonElement.closest('.question-input-group');
    if (questionGroup) {
      questionGroup.remove();
      // Re-index placeholders if needed (optional, but good for UX)
      const questionsContainer = document.getElementById('questionsContainer');
      Array.from(questionsContainer.children).forEach((group, index) => {
          const textarea = group.querySelector('textarea');
          if (textarea) {
              textarea.placeholder = `Type question ${index + 1} here...`;
          }
      });
    }
  }

  editAssignment(id) {
    const assignment = this.assignments.find(a => a.id === id);
    if (!assignment) return;

    document.getElementById('assignmentModalTitle').textContent = 'Edit Assignment';
    document.getElementById('assignmentId').value = assignment.id;
    document.getElementById('assignmentTitle').value = assignment.title || '';
    document.getElementById('assignmentSubject').value = assignment.subject_class_id || '';
    document.getElementById('assignmentType').value = assignment.type || '';
    document.getElementById('assignmentMaxMarks').value = assignment.max_marks || '';
    document.getElementById('assignmentDueDate').value = assignment.due_date || '';
    document.getElementById('assignmentDescription').value = assignment.description || '';

    // Handle dynamic sections based on assignment type
    this.handleAssignmentTypeChange(); // This will show/hide sections and set required status

    if (assignment.type === 'typed_questions' && assignment.questions) {
      const questions = JSON.parse(assignment.questions);
      const questionsContainer = document.getElementById('questionsContainer');
      questionsContainer.innerHTML = ''; // Clear existing inputs

      questions.forEach((q, index) => {
        const newQuestionGroup = document.createElement('div');
        newQuestionGroup.className = 'question-input-group';
        newQuestionGroup.innerHTML = `
            <textarea class="form-textarea assignment-question-input" placeholder="Type question ${index + 1} here..." required>${q}</textarea>
            <button type="button" class="btn btn-danger btn-sm" onclick="facultyAssessments.removeQuestionField(this)">🗑️</button>
        `;
        questionsContainer.appendChild(newQuestionGroup);
      });
    } else if (assignment.type === 'assignment_question_paper' && assignment.resource_id) {
        // For file-based assignments, we don't pre-fill the file input for security reasons
        // but we can indicate that a file is already linked.
        const resource = this.allResources.find(r => r.id === assignment.resource_id);
        if (resource) {
            // Optionally display current file name
            // document.getElementById('assignmentResourceFile').placeholder = `Current file: ${resource.file_name}`;
        }
    }

    document.getElementById('assignmentModal').style.display = 'flex';
  }

  saveAssignment() {
    const assignmentId = document.getElementById('assignmentId').value;
    const title = document.getElementById('assignmentTitle').value;
    const subjectClassId = document.getElementById('assignmentSubject').value;
    const type = document.getElementById('assignmentType').value;
    const maxMarks = parseInt(document.getElementById('assignmentMaxMarks').value);
    const dueDate = document.getElementById('assignmentDueDate').value;
    const description = document.getElementById('assignmentDescription').value;

    if (!title || !subjectClassId || !type || isNaN(maxMarks) || !dueDate) {
      this.showAlert('Please fill all required fields.', 'error');
      return;
    }

    let questions = null;
    let resourceId = null;
    let fileToUpload = null;

    if (type === 'typed_questions') {
      const questionInputs = document.querySelectorAll('#questionsContainer .assignment-question-input');
      questions = Array.from(questionInputs).map(input => input.value.trim()).filter(q => q !== '');
      if (questions.length === 0) {
        this.showAlert('Please add at least one question for this assignment type.', 'error');
        return;
      }
    } else if (type === 'assignment_question_paper') {
      const fileInput = document.getElementById('assignmentResourceFile');
      if (fileInput.files.length > 0) {
        fileToUpload = fileInput.files[0];
        const maxFileSize = 5 * 1024 * 1024; // 5MB
        const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'];

        if (fileToUpload.size > maxFileSize) {
          this.showAlert('File size exceeds 5MB limit.', 'error');
          return;
        }
        if (!allowedTypes.includes(fileToUpload.type)) {
          this.showAlert('Unsupported file type. Please upload PDF, DOCX, PPTX, or ZIP.', 'error');
          return;
        }
      } else if (!assignmentId || !this.assignments.find(a => a.id == assignmentId)?.resource_id) {
          // If creating new or editing and no existing resource, file is required
          this.showAlert('Please upload a file for this assignment type.', 'error');
          return;
      }
    }

    const assignmentData = {
      title: title,
      subject_class_id: subjectClassId,
      type: type,
      max_marks: maxMarks,
      due_date: dueDate,
      description: description,
      created_by: this.facultyData.id,
      created_by_name: this.facultyData.name,
      created_at: new Date().toISOString(),
      is_completed: false, // Default to not completed
      questions: questions ? JSON.stringify(questions) : null, // Store questions as JSON string
      resource_id: null // Will be set if a file is uploaded
    };

    try {
      if (assignmentId) {
        // If editing, check if resource_id needs to be updated/removed
        const existingAssignment = this.assignments.find(a => a.id == assignmentId);
        if (existingAssignment && existingAssignment.resource_id && type !== 'assignment_question_paper') {
            // If type changed from file-based, remove old resource link
            campusDB.delete('resources', existingAssignment.resource_id);
            assignmentData.resource_id = null;
        } else if (existingAssignment && existingAssignment.resource_id && type === 'assignment_question_paper' && !fileToUpload) {
            // If type is still file-based and no new file uploaded, keep existing resource_id
            assignmentData.resource_id = existingAssignment.resource_id;
        }

        if (fileToUpload) {
            // Create new resource entry for the file
            const newResource = {
                title: `${title} Question Paper`,
                subject_class_id: subjectClassId,
                type: 'assignment_question_paper',
                description: `Question paper for assignment: ${title}`,
                file_name: fileToUpload.name,
                file_type: fileToUpload.type,
                file_size: fileToUpload.size,
                file_url: URL.createObjectURL(fileToUpload),
                uploaded_by: this.facultyData.id,
                uploaded_by_name: this.facultyData.name,
                uploaded_at: new Date().toISOString()
            };
            const createdResource = campusDB.create('resources', newResource);
            assignmentData.resource_id = createdResource.id;
        }

        campusDB.update('assignments', parseInt(assignmentId), assignmentData);
        this.showAlert('Assignment updated successfully', 'success');
      } else {
        if (fileToUpload) {
            // Create new resource entry for the file
            const newResource = {
                title: `${title} Question Paper`,
                subject_class_id: subjectClassId,
                type: 'assignment_question_paper',
                description: `Question paper for assignment: ${title}`,
                file_name: fileToUpload.name,
                file_type: fileToUpload.type,
                file_size: fileToUpload.size,
                file_url: URL.createObjectURL(fileToUpload),
                uploaded_by: this.facultyData.id,
                uploaded_by_name: this.facultyData.name,
                uploaded_at: new Date().toISOString()
            };
            const createdResource = campusDB.create('resources', newResource);
            assignmentData.resource_id = createdResource.id;
        }
        campusDB.create('assignments', assignmentData);
        this.showAlert('Assignment created successfully', 'success');
      }
      authSystem.logActivity('create_assignment', this.facultyData.user_id, `Created assignment: ${title}`);
      this.hideCreateAssignmentModal();
      this.loadAssignments();
    } catch (error) {
      console.error('Error saving assignment:', error);
      this.showAlert('Error saving assignment', 'error');
    }
  }

  deleteAssignment(id) {
    if (!confirm('Are you sure you want to delete this assignment? This action cannot be undone.')) {
      return;
    }
    try {
      const assignmentToDelete = this.assignments.find(a => a.id === id);
      if (assignmentToDelete && assignmentToDelete.resource_id) {
          // If it's a file-based assignment, delete the associated resource file
          campusDB.delete('resources', assignmentToDelete.resource_id);
      }
      campusDB.delete('assignments', id);
      this.showAlert('Assignment deleted successfully', 'success');
      this.loadAssignments();
    } catch (error) {
      console.error('Error deleting assignment:', error);
      this.showAlert('Error deleting assignment', 'error');
    }
  }

  // NEW: View Assignment Details Modal (for both typed questions and file uploads)
  viewAssignmentDetails(id) {
    const assignment = this.assignments.find(a => a.id === id);
    if (!assignment) {
      this.showAlert('Assignment not found.', 'error');
      return;
    }

    document.getElementById('viewAssignmentModalTitle').textContent = assignment.title;
    document.getElementById('viewTitle').textContent = assignment.title;
    
    const subject = this.subjectsTaught.find(s => 
        `${s.id}_${s.branch}_${s.year}_${s.semester}_${s.section}` === assignment.subject_class_id
    );
    document.getElementById('viewSubject').textContent = subject ? `${subject.name} (${subject.code})` : 'N/A';
    
    let typeText = assignment.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    if (assignment.type === 'typed_questions') {
        typeText = 'Typed Questions';
    } else if (assignment.type === 'assignment_question_paper') {
        typeText = 'File Upload';
    }
    document.getElementById('viewType').textContent = typeText;

    document.getElementById('viewDueDate').textContent = new Date(assignment.due_date).toLocaleDateString();
    document.getElementById('viewMaxMarks').textContent = assignment.max_marks;
    document.getElementById('viewUploadedBy').textContent = assignment.created_by_name;
    document.getElementById('viewDescription').textContent = assignment.description || 'No description provided.';

    // Handle questions section
    const questionsSection = document.getElementById('viewQuestionsSection');
    const questionsList = document.getElementById('viewQuestionsList');
    questionsSection.style.display = 'none';
    questionsList.innerHTML = '';

    if (assignment.type === 'typed_questions' && assignment.questions) {
      const questions = JSON.parse(assignment.questions);
      questions.forEach(q => {
        const li = document.createElement('li');
        li.textContent = q;
        questionsList.appendChild(li);
      });
      questionsSection.style.display = 'block';
    }

    // Handle resource section
    const resourceSection = document.getElementById('viewResourceSection');
    const resourceFileName = document.getElementById('viewResourceFileName');
    const resourceDownloadBtn = document.getElementById('viewResourceDownloadBtn');
    resourceSection.style.display = 'none';

    if (assignment.type === 'assignment_question_paper' && assignment.resource_id) {
        const resource = this.allResources.find(r => r.id === assignment.resource_id);
        if (resource) {
            resourceFileName.textContent = `File: ${resource.file_name}`;
            this.currentAssignmentResource = resource; // Store for download
            resourceDownloadBtn.style.display = 'inline-block';
            resourceSection.style.display = 'block';
        } else {
            resourceFileName.textContent = 'File not found.';
            resourceDownloadBtn.style.display = 'none';
            this.currentAssignmentResource = null;
            resourceSection.style.display = 'block';
        }
    }

    document.getElementById('viewAssignmentModal').style.display = 'flex';
  }

  hideViewAssignmentModal() {
    document.getElementById('viewAssignmentModal').style.display = 'none';
    this.currentAssignmentResource = null; // Clear stored resource
  }

  // NEW: Download resource from view modal
  downloadAssignmentResource() {
    if (!this.currentAssignmentResource || !this.currentAssignmentResource.file_url) {
        this.showAlert('Resource file not found or URL is invalid.', 'error');
        return;
    }

    const a = document.createElement('a');
    a.href = this.currentAssignmentResource.file_url;
    a.download = this.currentAssignmentResource.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    this.showAlert(`Downloading "${this.currentAssignmentResource.file_name}"...`, 'info');
  }

  showAlert(message, type) {
    const existingAlerts = document.querySelectorAll('#assignmentsAlert .alert');
    existingAlerts.forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    const alertContainer = document.getElementById('assignmentsAlert');
    alertContainer.innerHTML = ''; // Clear previous alerts
    alertContainer.appendChild(alert);
    alertContainer.style.display = 'block';

    setTimeout(() => {
      if (alert.parentNode) {
        alertContainer.style.display = 'none';
        alert.remove();
      }
    }, 5000);
  }
}

// Global functions for inline event handlers
function showCreateAssignmentModal() {
  facultyAssessments.showCreateAssignmentModal();
}

function hideCreateAssignmentModal() {
  facultyAssessments.hideCreateAssignmentModal();
}

function saveAssignment() {
  facultyAssessments.saveAssignment();
}

function hideViewAssignmentModal() {
    facultyAssessments.hideViewAssignmentModal();
}

// Initialize when DOM is loaded
let facultyAssessments;
document.addEventListener('DOMContentLoaded', () => {
  facultyAssessments = new FacultyAssessments();
});