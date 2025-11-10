// Faculty Dashboard JavaScript
class FacultyDashboard {
  constructor() {
    this.facultyData = null;
    this.subjectsTaught = []; // Renamed to reflect new structure
    this.students = [];
    this.init();
  }

  init() {
    // Check authentication
    if (!requireAuth() || !requireRole('faculty')) {
      return;
    }

    this.loadFacultyData();
    this.updateDateTime();
    this.displayUserWelcome();
    
    // Update time every minute
    setInterval(() => this.updateDateTime(), 60000);
  }

  loadFacultyData() {
    try {
      const currentUser = getCurrentUser();
      console.log('FacultyDashboard: Current User:', currentUser); // ADDED LOG
      this.facultyData = campusDB.getFacultyByUserId(currentUser.id);
      
      if (!this.facultyData) {
        console.error('FacultyDashboard: Faculty data not found for user ID:', currentUser.id); // ADDED LOG
        return;
      }
      console.log('FacultyDashboard: Faculty data loaded:', this.facultyData); // ADDED LOG

      // Load subjects taught by this faculty from class_offerings
      this.subjectsTaught = campusDB.getSubjectsTaughtByFaculty(this.facultyData.id, true);
      console.log('FacultyDashboard: Subjects Taught by this faculty:', this.subjectsTaught); // ADDED LOG

      this.loadDashboardData();
    } catch (error) {
      console.error('Error loading faculty data:', error);
    }
  }

  loadDashboardData() {
    this.loadTodaySchedule();
    this.loadStatistics();
    this.loadRecentActivities();
    this.loadAnnouncements();
    this.loadPerformanceOverview();
  }

  loadTodaySchedule() {
    try {
      const today = new Date();
      const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
      
      const schedule = this.generateTodaySchedule(dayName);
      
      const container = document.getElementById('todaySchedule');
      document.getElementById('todayDate').textContent = today.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      if (schedule.length === 0) {
        container.innerHTML = '<p style="color: var(--gray-500); text-align: center; padding: 20px;">No classes scheduled for today</p>';
        return;
      }

      container.innerHTML = schedule.map(class_ => `
        <div class="schedule-item" style="display: flex; justify-content: space-between; align-items: center; padding: 15px; margin-bottom: 10px; border-left: 4px solid var(--primary); background: var(--gray-50); border-radius: 6px;">
          <div>
            <h4 style="margin: 0; color: var(--gray-800);">${class_.subject_name} (${class_.subject_code})</h4>
            <p style="margin: 5px 0; color: var(--gray-600);">Year ${class_.year}, Sem ${class_.semester}, Sec ${class_.section} • ${class_.room} • ${class_.students} students</p>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 600; color: var(--primary);">${class_.time}</div>
            <div style="font-size: 0.8rem; color: var(--gray-500);">(${class_.duration})</div>
          </div>
        </div>
      `).join('');

    } catch (error) {
      console.error('Error loading today schedule:', error);
      document.getElementById('todaySchedule').innerHTML = '<p class="text-red-500">Error loading schedule</p>';
    }
  }

  generateTodaySchedule(dayName) {
    if (!this.facultyData || this.subjectsTaught.length === 0) return [];

    const schedule = [];
    const allTimetableEntries = campusDB.getStorageData('timetables'); // Get all timetable entries

    this.subjectsTaught.forEach(subject => {
      // Find timetable entries for this specific subject taught by this faculty on this day
      const relevantTimetableEntries = allTimetableEntries.filter(entry =>
        entry.subject_id === subject.id &&
        entry.faculty_id === this.facultyData.id &&
        entry.branch === subject.branch &&
        entry.year === subject.year &&
        entry.semester === subject.semester &&
        entry.section === subject.section &&
        entry.day_of_week === dayName
      ).sort((a, b) => a.start_time.localeCompare(b.start_time));

      relevantTimetableEntries.forEach(entry => {
        const filters = { branch: subject.branch, year: subject.year, semester: subject.semester, section: subject.section };
        const students = campusDB.getStudents(filters); // Get students for this specific class

        schedule.push({
          subject_name: subject.name,
          subject_code: subject.code,
          year: subject.year,
          semester: subject.semester,
          section: subject.section,
          time: `${entry.start_time} - ${entry.end_time}`,
          duration: this.calculateDuration(entry.start_time, entry.end_time),
          room: entry.room_number,
          students: students.length
        });
      });
    });

    return schedule.sort((a, b) => a.time.localeCompare(b.time));
  }

  calculateDuration(startTime, endTime) {
    const start = new Date(`2000/01/01 ${startTime}`);
    const end = new Date(`2000/01/01 ${endTime}`);
    const diffMs = end - start;
    const diffMinutes = Math.round(diffMs / 60000);

    if (diffMinutes < 60) {
      return `${diffMinutes} mins`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours} hr ${minutes > 0 ? `${minutes} mins` : ''}`.trim();
    }
  }

  loadStatistics() {
    try {
      if (!this.facultyData) return;

      const allStudents = campusDB.getStorageData('students'); // All students
      const attendance = campusDB.getStorageData('attendance');
      const marks = campusDB.getStorageData('marks');
      const assignments = campusDB.getStorageData('assignments'); // Get all assignments

      const totalSubjects = this.subjectsTaught.length;
      const subjectIdsTaught = this.subjectsTaught.map(s => s.id);
      
      const assignedStudentIds = new Set();
      console.log('FacultyDashboard: Starting student aggregation for statistics...'); // ADDED LOG
      this.subjectsTaught.forEach(subject => {
        const filters = { branch: subject.branch, year: subject.year, semester: subject.semester, section: subject.section };
        console.log(`FacultyDashboard: Calling getStudents with filters:`, filters); // ADDED LOG
        const studentsForSubject = campusDB.getStudents(filters); // This is the crucial call
        console.log(`FacultyDashboard: Students found for subject ${subject.name} (${subject.code}):`, studentsForSubject.length, studentsForSubject); // ADDED LOG
        studentsForSubject.forEach(s => assignedStudentIds.add(s.id));
      });
      const totalStudents = assignedStudentIds.size;
      console.log('FacultyDashboard: Total unique students for this faculty:', totalStudents); // ADDED LOG

      // Calculate pending tasks based on assignments (excluding assignment_question_paper type)
      const pendingTasks = this.calculatePendingTasks(this.subjectsTaught, allStudents, marks, assignments);
      const lowAttendanceCount = this.calculateLowAttendance(Array.from(assignedStudentIds).map(id => allStudents.find(s => s.id === id)), attendance, subjectIdsTaught);

      document.getElementById('totalSubjects').textContent = totalSubjects;
      document.getElementById('totalStudents').textContent = totalStudents;
      document.getElementById('pendingTasks').textContent = pendingTasks;
      document.getElementById('lowAttendance').textContent = lowAttendanceCount;

    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  }

  calculatePendingTasks(subjectsTaught, allStudents, allMarks, allAssignments) {
    let pendingCount = 0;
    const now = new Date();

    subjectsTaught.forEach(subject => {
      const subjectStudents = allStudents.filter(s => 
        s.branch === subject.branch && s.year === subject.year && s.semester === subject.semester && s.section === subject.section
      );
      
      // Filter for assignments that are NOT 'assignment_question_paper' or 'typed_questions'
      // These are assignments that require faculty to enter marks directly (e.g., projects, quizzes, internal assignments)
      const relevantAssignments = allAssignments.filter(a => 
        a.subject_class_id === `${subject.id}_${subject.branch}_${subject.year}_${subject.semester}_${subject.section}` &&
        a.type !== 'assignment_question_paper' && // Exclude downloadable question papers
        a.type !== 'typed_questions' && // Exclude assignments with typed questions
        !a.is_completed && // Not marked as completed by faculty
        new Date(a.due_date) > now // Still upcoming or active
      );

      // For each relevant assignment, count students who haven't had marks entered
      relevantAssignments.forEach(assignment => {
        subjectStudents.forEach(student => {
          const studentHasMarks = allMarks.some(m => 
            m.student_id === student.id && 
            m.subject_id === subject.id && 
            m.assessment_type === assignment.type &&
            (assignment.type !== 'assignment' || m.assignment_number === assignment.assignment_number) // For specific assignments
          );
          if (!studentHasMarks) {
            pendingCount++;
          }
        });
      });
    });

    return Math.min(pendingCount, 99); // Cap at 99 for display
  }

  calculateLowAttendance(students, attendance, subjectIds) {
    let lowAttendanceCount = 0;
    
    students.forEach(student => {
      const studentAttendance = attendance.filter(a => 
        a.student_id === student.id && subjectIds.includes(a.subject_id)
      );
      
      if (studentAttendance.length > 0) {
        const presentCount = studentAttendance.filter(a => a.status === 'present').length;
        const attendanceRate = (presentCount / studentAttendance.length) * 100;
        
        if (attendanceRate < 75) {
          lowAttendanceCount++;
        }
      }
    });

    return lowAttendanceCount;
  }

  loadRecentActivities() {
    try {
      const activities = authSystem.getRecentActivities();
      const users = campusDB.getStorageData('users');
      
      this.recentActivities = activities
        .filter(activity => {
          const user = users.find(u => u.id === activity.userId);
          return user && user.role === 'faculty' && activity.userId === this.facultyData.user_id;
        })
        .slice(-5) // Get recent 5 activities for this faculty
        .reverse()
        .map(activity => {
          const user = users.find(u => u.id === activity.userId);
          const userName = user ? user.name : 'Unknown User';

          return {
            ...activity,
            userName: userName,
            formattedTime: this.formatRelativeTime(new Date(activity.timestamp))
          };
        });

      this.renderRecentActivities();

    } catch (error) {
      console.error('Error loading recent activities:', error);
      document.getElementById('recentActivities').innerHTML = '<p class="text-red-500">Error loading activities</p>';
    }
  }

  renderRecentActivities() {
    const container = document.getElementById('recentActivities');
    
    if (this.recentActivities.length === 0) {
      container.innerHTML = '<p style="color: var(--gray-500); text-align: center; padding: 20px;">No recent activities</p>';
      return;
    }

    container.innerHTML = this.recentActivities.map(activity => `
        <div class="activity-item" style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--gray-200);">
          <span class="activity-icon" style="margin-right: 10px; font-size: 1.2rem;">${this.getActionIcon(activity.action)}</span>
          <div style="flex: 1;">
            <div style="font-weight: 500; color: var(--gray-800);">${this.getActionText(activity.action)}</div>
            <div style="font-size: 0.8rem; color: var(--gray-600); margin-top: 2px;">${activity.description || ''}</div>
          </div>
          <div style="font-size: 0.8rem; color: var(--gray-500);"></div>
        </div>
      `).join('');
  }

  getActionIcon(action) {
    const icons = {
      login: '🔑',
      logout: '🚪',
      create: '➕',
      update: '✏️',
      delete: '🗑️',
      mark_attendance: '✅',
      enter_marks: '📊',
      upload_resource: '📤',
      create_assignment: '📝' // Updated icon for assignment creation
    };
    return icons[action] || '📄';
  }

  getActionText(action) {
    const texts = {
      login: 'Logged in',
      logout: 'Logged out',
      create: 'Created record',
      update: 'Updated record',
      delete: 'Deleted record',
      mark_attendance: 'Marked attendance',
      enter_marks: 'Entered marks',
      upload_resource: 'Uploaded resource',
      create_assignment: 'Created assignment' // Updated text
    };
    return texts[action] || 'Activity performed';
  }

  loadAnnouncements() {
    try {
      const announcements = campusDB.getAnnouncements('faculty');
      const container = document.getElementById('announcements');
      
      if (announcements.length === 0) {
        container.innerHTML = '<p style="color: var(--gray-500); text-align: center; padding: 20px;">No announcements</p>';
        return;
      }

      container.innerHTML = announcements.slice(0, 3).map(announcement => `
        <div class="announcement-item" style="padding: 12px 0; border-bottom: 1px solid var(--gray-200);">
          <div style="font-weight: 500; color: var(--gray-800); margin-bottom: 5px;">${announcement.title}</div>
          <div style="font-size: 0.9rem; color: var(--gray-600); margin-bottom: 5px;">${announcement.content.substring(0, 100)}...</div>
          <div style="font-size: 0.8rem; color: var(--gray-500);"></div>
        </div>
      `).join('');

    } catch (error) {
      console.error('Error loading announcements:', error);
      document.getElementById('announcements').innerHTML = '<p class="text-red-500">Error loading announcements</p>';
    }
  }

  loadPerformanceOverview() {
    try {
      if (!this.facultyData) return;

      const allStudents = campusDB.getStorageData('students');
      const attendance = campusDB.getStorageData('attendance');
      const marks = campusDB.getStorageData('marks');
      
      const container = document.getElementById('performanceOverview');
      
      if (this.subjectsTaught.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="text-center">No subjects assigned</td></tr>'; // Adjusted colspan
        return;
      }

      const overviewHTML = this.subjectsTaught.map(subject => {
        const subjectStudents = allStudents.filter(s => 
          s.branch === subject.branch && s.semester === subject.semester && s.section === subject.section
        );
        
        const studentIds = subjectStudents.map(s => s.id);

        const subjectAttendance = attendance.filter(a => 
          a.subject_id === subject.id && studentIds.includes(a.student_id)
        );
        const avgAttendance = this.calculateAverageAttendance(subjectAttendance);

        const subjectMarks = marks.filter(m => 
          m.subject_id === subject.id && studentIds.includes(m.student_id)
        );
        const avgPerformance = this.calculateAveragePerformance(subjectMarks);

        const atRiskCount = this.calculateAtRiskStudents(subjectStudents, subjectAttendance, subjectMarks);

        return `
          <tr>
            <td><strong>${subject.name}</strong><br><small>${subject.code} (Y${subject.year}, S${subject.semester}, Sec ${subject.section})</small></td>
            <td>${subjectStudents.length}</td>
            <td>
              <span class="badge ${avgAttendance >= 75 ? 'badge-success' : avgAttendance >= 60 ? 'badge-warning' : 'badge-error'}">
                ${avgAttendance}%
              </span>
            </td>
            <td>
              <span class="badge ${avgPerformance >= 70 ? 'badge-success' : avgPerformance >= 50 ? 'badge-warning' : 'badge-error'}">
                ${avgPerformance}%
              </span>
            </td>
            <td>
              <span class="badge ${atRiskCount === 0 ? 'badge-success' : atRiskCount <= 5 ? 'badge-warning' : 'badge-error'}">
                ${atRiskCount}
              </span>
            </td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="viewSubjectDetails(${subject.id})" style="margin-right: 5px;">
                <span>👁️</span>
              </button>
              <button class="btn btn-primary btn-sm" onclick="window.location.href='marks.html?subject=${subject.id}'">
                <span>📊</span>
              </button>
            </td>
          </tr>
        `;
      }).join('');

      container.innerHTML = overviewHTML;

    } catch (error) {
      console.error('Error loading performance overview:', error);
      document.getElementById('performanceOverview').innerHTML = '<tr><td colspan="5" class="text-center text-red-500">Error loading overview</td></tr>'; // Adjusted colspan
    }
  }

  calculateAverageAttendance(attendanceRecords) {
    if (attendanceRecords.length === 0) return 0;
    
    const presentCount = attendanceRecords.filter(a => a.status === 'present').length;
    return Math.round((presentCount / attendanceRecords.length) * 100);
  }

  calculateAveragePerformance(markRecords) {
    if (markRecords.length === 0) return 0;
    
    const totalMarks = markRecords.reduce((sum, mark) => sum + mark.marks, 0);
    const totalMaxMarks = markRecords.reduce((sum, mark) => sum + mark.max_marks, 0);
    
    return totalMaxMarks > 0 ? Math.round((totalMarks / totalMaxMarks) * 100) : 0;
  }

  calculateAtRiskStudents(students, attendanceRecords, markRecords) {
    let atRiskCount = 0;
    
    students.forEach(student => {
      const studentAttendance = attendanceRecords.filter(a => a.student_id === student.id);
      const studentMarks = markRecords.filter(m => m.student_id === student.id);
      
      let attendanceRisk = false;
      if (studentAttendance.length > 0) {
        const presentCount = studentAttendance.filter(a => a.status === 'present').length;
        const attendanceRate = (presentCount / studentAttendance.length) * 100;
        attendanceRisk = attendanceRate < 75;
      }
      
      let performanceRisk = false;
      if (studentMarks.length > 0) {
        const totalMarks = studentMarks.reduce((sum, mark) => sum + mark.marks, 0);
        const totalMaxMarks = studentMarks.reduce((sum, mark) => sum + mark.max_marks, 0);
        const performanceRate = totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0;
        performanceRisk = performanceRate < 50;
      }
      
      if (attendanceRisk || performanceRisk) {
        atRiskCount++;
      }
    });

    return atRiskCount;
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
    document.getElementById('currentDateTime').textContent = now.toLocaleDateString('en-US', options);
  }

  displayUserWelcome() {
    const user = getCurrentUser();
    if (user) {
      document.getElementById('userWelcome').textContent = `Welcome, ${user.name}`;
    }
  }

  formatRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return `${days}d ago`;
    }
  }
}

// Global functions
function viewSubjectDetails(subjectId) {
  const subject = campusDB.findById('subjects', subjectId); // Subject now has branch, year, semester, type
  if (subject) {
    alert(`Subject Details:\nName: ${subject.name}\nCode: ${subject.code}\nBranch: ${subject.branch}\nYear: ${subject.year}\nSemester: ${subject.semester}\nType: ${subject.type.charAt(0).toUpperCase() + subject.type.slice(1)}\nCredits: ${subject.credits}`);
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new FacultyDashboard();
});