// Student Assignment Details View
class StudentAssignmentDetails {
  constructor() {
    this.studentData = null;
    this.assignmentId = null;
    this.assignment = null;
    this.subject = null;
    this.faculty = null;
    this.resource = null;
    this.init();
  }

  init() {
    if (!requireAuth() || !requireRole('student')) {
      return;
    }
    this.getAssignmentIdFromUrl();
    if (this.assignmentId) {
      this.loadAssignmentDetails();
    } else {
      this.showAlert('Assignment ID not found in URL.', 'error');
      document.getElementById('assignmentDetailsTitle').textContent = 'Assignment Not Found';
    }
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('backToAssignmentsBtn').addEventListener('click', () => {
      window.location.href = 'assignments.html';
    });

    const downloadBtn = document.getElementById('downloadAssignmentBtn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => this.downloadAssignmentFile());
    }
  }

  getAssignmentIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    this.assignmentId = parseInt(params.get('id'));
  }

  loadAssignmentDetails() {
    try {
      this.studentData = campusDB.getStudentByUserId(getCurrentUser().id);
      if (!this.studentData) {
        this.showAlert('Student data not found.', 'error');
        return;
      }

      this.assignment = campusDB.findById('assignments', this.assignmentId);
      if (!this.assignment) {
        this.showAlert('Assignment not found.', 'error');
        document.getElementById('assignmentDetailsTitle').textContent = 'Assignment Not Found';
        return;
      }

      // Parse subject_class_id to get individual components
      const [subjectId, branch, year, semester, section] = this.assignment.subject_class_id.split('_');
      
      // Fetch the full subject object using its ID
      this.subject = campusDB.findById('subjects', parseInt(subjectId));
      
      // Fetch faculty details
      this.faculty = campusDB.findById('faculty', this.assignment.created_by);

      // If it's a file-based assignment, fetch the resource
      if (this.assignment.type === 'assignment_question_paper' && this.assignment.resource_id) {
        this.resource = campusDB.findById('resources', this.assignment.resource_id);
      }

      this.renderAssignmentDetails();
    } catch (error) {
      console.error('Error loading assignment details:', error);
      this.showAlert('Error loading assignment details.', 'error');
    }
  }

  renderAssignmentDetails() {
    document.getElementById('assignmentDetailsTitle').textContent = this.assignment.title;
    document.getElementById('detailTitle').textContent = this.assignment.title;
    document.getElementById('detailSubject').textContent = this.subject ? `${this.subject.name} (${this.subject.code})` : 'N/A';
    document.getElementById('detailClass').textContent = this.subject ? `Year ${this.subject.year}, Sem ${this.subject.semester}, Sec ${this.assignment.subject_class_id.split('_')[4]}` : 'N/A';
    
    let typeText = this.assignment.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    if (this.assignment.type === 'typed_questions') {
        typeText = 'Typed Questions';
    } else if (this.assignment.type === 'assignment_question_paper') {
        typeText = 'File Upload';
    }
    document.getElementById('detailType').textContent = typeText;

    document.getElementById('detailDueDate').textContent = this.assignment.due_date ? new Date(this.assignment.due_date).toLocaleDateString() : 'N/A';
    document.getElementById('detailMaxMarks').textContent = this.assignment.max_marks || 'N/A';
    document.getElementById('detailUploadedBy').textContent = this.faculty ? this.faculty.name : 'N/A';
    document.getElementById('detailUploadedOn').textContent = new Date(this.assignment.created_at).toLocaleDateString();
    document.getElementById('detailDescription').textContent = this.assignment.description || 'No description provided.';

    // Handle questions section
    const questionsSection = document.getElementById('detailQuestionsSection');
    const questionsList = document.getElementById('detailQuestionsList');
    questionsSection.style.display = 'none';
    questionsList.innerHTML = '';

    if (this.assignment.type === 'typed_questions' && this.assignment.questions) {
      const questions = JSON.parse(this.assignment.questions);
      questions.forEach((q) => {
        const li = document.createElement('li');
        // Remove any leading numbering (e.g., "1.1.", "2.2.", "1.") from the question text
        const cleanedQuestion = q.replace(/^\d+\.?\d*\.?\s*/, '');
        li.textContent = cleanedQuestion;
        questionsList.appendChild(li);
      });
      questionsSection.style.display = 'block';
    }

    // Handle download section
    const downloadSection = document.getElementById('downloadSection');
    const downloadFileName = document.getElementById('downloadFileName');
    const downloadAssignmentBtn = document.getElementById('downloadAssignmentBtn');
    downloadSection.style.display = 'none';

    if (this.assignment.type === 'assignment_question_paper' && this.resource) {
      downloadFileName.textContent = `File: ${this.resource.file_name}`;
      downloadAssignmentBtn.style.display = 'inline-block';
      downloadSection.style.display = 'block';
    } else if (this.assignment.type === 'assignment_question_paper' && !this.resource) {
      downloadFileName.textContent = 'File not found or linked resource missing.';
      downloadAssignmentBtn.style.display = 'none';
      downloadSection.style.display = 'block';
    }
  }

  downloadAssignmentFile() {
    if (!this.resource || !this.resource.file_url) {
      this.showAlert('Assignment file not found or URL is invalid.', 'error');
      return;
    }

    const a = document.createElement('a');
    a.href = this.resource.file_url;
    a.download = this.resource.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    this.showAlert(`Downloading "${this.resource.file_name}"...`, 'info');
  }

  showAlert(message, type) {
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

// Initialize when DOM is loaded
let studentAssignmentDetails;
document.addEventListener('DOMContentLoaded', () => {
  studentAssignmentDetails = new StudentAssignmentDetails();
});