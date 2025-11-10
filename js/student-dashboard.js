// Student Dashboard JavaScript
class StudentDashboard {
  constructor() {
    this.studentData = null;
    this.subjects = [];
    this.attendance = [];
    this.marks = [];
    this.fees = [];
    this.allTimetableEntries = []; // NEW: To fetch timetable data
    this.allFaculty = []; // NEW: To get faculty names for timetable
    this.marksCalculator = window.marksCalculator; // Use the global MarksCalculator instance
    this.init();
  }

  init() {
    console.log('StudentDashboard: Initializing...');
    // Check authentication
    if (!requireAuth() || !requireRole('student')) {
      return;
    }

    this.loadStudentData();
    this.updateDateTime();
    this.displayUserWelcome();
    
    // Update time every minute
    setInterval(() => this.updateDateTime(), 60000);
  }

  loadStudentData() {
    try {
      const currentUser = getCurrentUser();
      this.studentData = campusDB.getStudentByUserId(currentUser.id);
      
      if (!this.studentData) {
        console.error('StudentDashboard: Student data not found for current user:', currentUser);
        return;
      }
      console.log('StudentDashboard: Student data loaded:', this.studentData);

      this.allTimetableEntries = campusDB.getStorageData('timetables'); // Load all timetable entries
      this.allFaculty = campusDB.getStorageData('faculty'); // Load all faculty for lookup

      this.loadDashboardData();
    } catch (error) {
      console.error('StudentDashboard: Error loading student data:', error);
    }
  }

  loadDashboardData() {
    // Get subjects for the student's current class (branch, year, semester, section)
    // Subjects now have branch, year, semester, type directly
    this.subjects = campusDB.getSubjectsForClass(
      this.studentData.branch, 
      this.studentData.year, 
      this.studentData.semester, 
      this.studentData.section,
      true // Only active subjects
    );
    this.attendance = campusDB.getAttendance(this.studentData.id);
    this.marks = campusDB.getMarks(this.studentData.id);
    this.fees = campusDB.getStorageData('fees').filter(f => f.student_id === this.studentData.id);


    this.loadAcademicOverview();
    this.loadTodayClasses();
    this.loadRecentUpdates();
    this.loadAnnouncements();
    this.loadAttendanceChart();
    this.loadPerformanceChart();
    this.loadUpcomingEvents();
    this.checkNewUpdatesAlert(); // New: Check for new updates and show alert
  }

  loadAcademicOverview() {
    try {
      // Calculate overall attendance
      const totalClasses = this.attendance.length;
      const presentCount = this.attendance.filter(a => a.status === 'present').length;
      const overallAttendance = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0; // Rounded

      // Calculate current CGPA (simplified)
      const currentCGPA = this.calculateCGPA();

      // Calculate credits completed (based on current semester)
      const creditsCompleted = this.calculateCreditsCompleted();

      // Calculate pending fees
      const pendingFees = this.calculatePendingFees();

      // Update DOM elements
      document.getElementById('overallAttendance').textContent = `${overallAttendance}%`;
      document.getElementById('currentCGPA').textContent = currentCGPA !== 'N/A' ? currentCGPA.toFixed(2) : 'N/A'; // CGPA typically has decimals
      document.getElementById('creditsCompleted').textContent = creditsCompleted !== 'N/A' ? creditsCompleted : 'N/A';
      document.getElementById('pendingFees').textContent = `₹${pendingFees.toLocaleString()}`;

      // Update card colors based on values
      this.updateCardColors(overallAttendance, currentCGPA, pendingFees);

      console.log('StudentDashboard: Academic Overview - Overall Attendance:', overallAttendance, 'CGPA:', currentCGPA, 'Credits Completed:', creditsCompleted, 'Pending Fees:', pendingFees);

    } catch (error) {
      console.error('StudentDashboard: Error loading academic overview:', error);
    }
  }

  calculateCGPA() {
    if (this.subjects.length === 0 || this.marks.length === 0) return 'N/A'; // Changed from 0.0

    let totalGradePoints = 0;
    let totalCredits = 0;
    let allSubjectsFullyMarked = true;

    this.subjects.forEach(subject => {
      const allMarksEnteredForSubject = this.marksCalculator.areAllMarksEntered(this.studentData.id, subject.id, this.marks, subject.type);
      if (!allMarksEnteredForSubject) {
        allSubjectsFullyMarked = false;
        return; 
      }

      const internalMarksResult = this.marksCalculator.calculateSubjectInternalMarks(this.studentData.id, subject.id, this.marks, subject.type);
      const internalScore = internalMarksResult.totalInternal;
      const maxInternalScore = internalMarksResult.maxInternal;

      const externalMarkRecord = this.marks.find(m => m.student_id === this.studentData.id && m.subject_id === subject.id && m.assessment_type === 'external_exam');
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
      console.log(`StudentDashboard: CGPA Calc for ${subject.name}: Internal=${internalScore}/${maxInternalScore}, External=${externalScore}/${maxExternalScore}, Combined=${combinedScore}/${maxCombinedScore}, Percentage=${percentage.toFixed(2)}%, Grade Point=${gradePoint}, Credits=${subject.credits}`);
    });

    if (!allSubjectsFullyMarked) {
      return 'N/A'; 
    }

    const cgpaValue = totalCredits > 0 ? (totalGradePoints / totalCredits) : 0.0;
    return Math.round(cgpaValue * 100) / 100; // Keep 2 decimals for CGPA, as it's standard
  }

  calculateCreditsCompleted() {
    // Sum credits of all subjects in current and previous semesters that are marked as 'cleared'
    const allClassOfferings = campusDB.getStorageData('class_offerings');
    const allSubjects = campusDB.getStorageData('subjects');
    let allSubjectsFullyMarked = true;

    const completedOfferings = allClassOfferings.filter(co => 
      co.branch === this.studentData.branch &&
      co.year <= this.studentData.year &&
      co.semester <= this.studentData.semester &&
      co.section === this.studentData.section &&
      co.is_cleared // Only count cleared subjects
    );

    let credits = 0;
    completedOfferings.forEach(co => {
      const subject = allSubjects.find(s => s.id === co.subject_id);
      if (subject) {
        // Check if all marks are entered for this cleared subject before counting credits
        if (!this.marksCalculator.areAllMarksEntered(this.studentData.id, subject.id, this.marks, subject.type)) {
          allSubjectsFullyMarked = false;
          return; // Skip this subject if marks are not complete
        }
        credits += subject.credits;
      }
    });

    if (!allSubjectsFullyMarked) {
      return 'N/A';
    }

    console.log('StudentDashboard: Credits Completed:', credits);
    return credits;
  }

  calculatePendingFees() {
    const pending = this.fees.reduce((total, fee) => total + (fee.due_amount || 0), 0);
    console.log('StudentDashboard: Pending Fees:', pending);
    return Math.round(pending); // Rounded
  }

  updateCardColors(attendance, cgpa, pendingFees) {
    // Update attendance card color
    const attendanceCard = document.getElementById('overallAttendance').closest('.stat-card');
    attendanceCard.className = `stat-card ${attendance >= 75 ? 'success' : attendance >= 60 ? 'warning' : 'error'}`;

    // Update CGPA card color
    const cgpaCard = document.getElementById('currentCGPA').closest('.stat-card');
    cgpaCard.className = `stat-card ${cgpa !== 'N/A' && cgpa >= 8.0 ? 'success' : cgpa !== 'N/A' && cgpa >= 6.0 ? 'warning' : 'error'}`;

    // Update fees card color
    const feesCard = document.getElementById('pendingFees').closest('.stat-card');
    feesCard.className = `stat-card ${pendingFees === 0 ? 'success' : 'error'}`;
  }

  loadTodayClasses() {
    try {
      const today = new Date();
      const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
      
      document.getElementById('todayDate').textContent = today.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Generate today's schedule from timetable entries
      const schedule = this.generateTodaySchedule(dayName);
      const container = document.getElementById('todayClasses');

      if (schedule.length === 0) {
        container.innerHTML = '<p style="color: var(--gray-500); text-align: center; padding: 20px;">No classes scheduled for today</p>';
        return;
      }

      container.innerHTML = schedule.map(class_ => `
        <div class="class-item" style="display: flex; justify-content: space-between; align-items: center; padding: 15px; margin-bottom: 10px; border-left: 4px solid var(--primary); background: var(--gray-50); border-radius: 6px;">
          <div>
            <h4 style="margin: 0; color: var(--gray-800);">${class_.subject}</h4>
            <p style="margin: 5px 0; color: var(--gray-600);"> ${class_.room} (${class_.faculty})</p>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 600; color: var(--primary);">${class_.time}</div>
            <div style="font-size: 0.8rem; color: var(--gray-500);">(${class_.duration})</div>
          </div>
        </div>
      `).join('');
      console.log('StudentDashboard: Today\'s Classes loaded:', schedule);

    } catch (error) {
      console.error('StudentDashboard: Error loading today classes:', error);
      document.getElementById('todayClasses').innerHTML = '<p class="text-red-500">Error loading schedule</p>';
    }
  }

  generateTodaySchedule(dayName) {
    const schedule = [];
    
    // Filter timetable entries for the student's class and today's day
    const studentTimetableEntries = campusDB.getTimetableEntries({
      branch: this.studentData.branch,
      year: this.studentData.year,
      semester: this.studentData.semester,
      section: this.studentData.section,
      day_of_week: dayName
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));

    studentTimetableEntries.forEach(entry => {
      const subject = this.subjects.find(s => s.id === entry.subject_id);
      const faculty = this.allFaculty.find(f => f.id === entry.faculty_id);

      if (subject && faculty) {
        schedule.push({
          subject: `${subject.name} (${subject.code})`,
          faculty: faculty.name,
          time: `${entry.start_time} - ${entry.end_time}`,
          duration: this.calculateDuration(entry.start_time, entry.end_time),
          room: entry.room_number
        });
      }
    });

    return schedule;
  }

  calculateDuration(startTime, endTime) {
    const start = new Date(`2000/01/01 ${startTime}`);
    const end = new Date(`2000/01/01 ${endTime}`);
    const diffMs = end - start;
    const diffMinutes = Math.round(diffMs / 60000); // Rounded

    if (diffMinutes < 60) {
      return `${diffMinutes} mins`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours} hr ${minutes > 0 ? `${minutes} mins` : ''}`.trim();
    }
  }

  loadRecentUpdates() {
    try {
      const updates = this.generateRecentUpdates();
      const container = document.getElementById('recentUpdates');
      
      if (updates.length === 0) {
        container.innerHTML = '<p style="color: var(--gray-500); text-align: center; padding: 20px;">No recent updates</p>';
        return;
      }

      container.innerHTML = updates.map(update => `
        <div class="update-item" style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--gray-200);">
          <span class="update-icon" style="margin-right: 10px; font-size: 1.2rem;">${update.icon}</span>
          <div style="flex: 1;">
            <div style="font-weight: 500; color: var(--gray-800);">${update.title}</div>
            <div style="font-size: 0.8rem; color: var(--gray-600); margin-top: 2px;">${update.description}</div>
          </div>
          <div style="font-size: 0.8rem; color: var(--gray-500);"></div>
        </div>
      `).join('');
      console.log('StudentDashboard: Recent Updates loaded:', updates);

    } catch (error) {
      console.error('StudentDashboard: Error loading recent updates:', error);
      document.getElementById('recentUpdates').innerHTML = '<p class="text-red-500">Error loading updates</p>';
    }
  }

  generateRecentUpdates() {
    const updates = [];
    const now = new Date();

    // Filter student's own attendance and marks for recent updates
    const recentAttendance = this.attendance.filter(a => new Date(a.created_at) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    const recentMarks = this.marks.filter(m => new Date(m.created_at) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    // Removed recentSubmissions as per new workflow (no digital submissions)
    const recentResources = campusDB.getStorageData('resources').filter(r => {
      const subjectClassId = r.subject_class_id;
      return this.subjects.some(s => `${s.id}_${s.branch}_${s.year}_${s.semester}_${s.section}` === subjectClassId) && new Date(r.uploaded_at) > lastLoginDate;
    });
    const recentAnnouncements = campusDB.getAnnouncements('student').filter(a => new Date(a.created_at) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));


    recentAttendance.forEach(rec => {
      const subject = this.subjects.find(s => s.id === rec.subject_id);
      updates.push({
        icon: '✅',
        title: 'Attendance Marked',
        description: `${subject ? subject.name : 'Unknown Subject'} on ${new Date(rec.date).toLocaleDateString()} - ${rec.status}`,
        time: this.formatRelativeTime(new Date(rec.created_at))
      });
    });

    recentMarks.forEach(rec => {
      const subject = this.subjects.find(s => s.id === rec.subject_id);
      updates.push({
        icon: '📊',
        title: 'Marks Updated',
        description: `${subject ? subject.name : 'Unknown Subject'} - ${rec.assessment_type} marks: ${Math.round(rec.marks)}/${Math.round(rec.max_marks)}`, // Rounded
        time: this.formatRelativeTime(new Date(rec.created_at))
      });
    });

    // Removed recentSubmissions as per new workflow
    // recentSubmissions.forEach(rec => {
    //   const assignment = campusDB.findById('assignments', rec.assignment_id);
    //   updates.push({
    //     icon: '📝',
    //     title: 'Assignment Submitted',
    //     description: `${assignment ? assignment.title : 'Unknown Assignment'}`,
    //     time: this.formatRelativeTime(new Date(rec.submitted_at))`
    //   });
    // });

    recentResources.forEach(rec => {
      const subject = this.subjects.find(s => `${s.id}_${s.branch}_${s.year}_${s.semester}_${s.section}` === rec.subject_class_id);
      updates.push({
        icon: '📚',
        title: 'New Resource Available',
        description: `${rec.title} for ${subject ? subject.name : 'Unknown Subject'}`,
        time: this.formatRelativeTime(new Date(rec.uploaded_at))
      });
    });

    recentAnnouncements.forEach(ann => {
      updates.push({
        icon: '📣',
        title: 'New Announcement',
        description: ann.title,
        time: this.formatRelativeTime(new Date(ann.created_at))
      });
    });

    return updates.sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5); // Show top 5 recent updates
  }

  loadAnnouncements() {
    try {
      const announcements = campusDB.getAnnouncements('student');
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
      console.log('StudentDashboard: Announcements loaded:', announcements);

    } catch (error) {
      console.error('StudentDashboard: Error loading announcements:', error);
      document.getElementById('announcements').innerHTML = '<p class="text-red-500">Error loading announcements</p>';
    }
  }

  loadAttendanceChart() {
    try {
      const container = document.getElementById('attendanceBars');
      const subjectAttendance = new Map();

      // Calculate attendance for each subject
      this.subjects.forEach(subject => {
        const subjectAttendanceRecords = this.attendance.filter(a => a.subject_id === subject.id);
        const totalClasses = subjectAttendanceRecords.length;
        const presentCount = subjectAttendanceRecords.filter(a => a.status === 'present').length;
        const percentage = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0; // Rounded
        
        subjectAttendance.set(subject.name, percentage);
      });

      if (subjectAttendance.size === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 20px;">No attendance data available</p>';
        return;
      }

      container.innerHTML = Array.from(subjectAttendance.entries()).map(([subject, percentage]) => `
        <div style="margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <span style="font-size: 0.9rem; font-weight: 500;">${subject}</span>
            <span style="font-size: 0.9rem; color: var(--gray-600);">${percentage}%</span>
          </div>
          <div style="background: var(--gray-200); height: 8px; border-radius: 4px; overflow: hidden;">
            <div style="background: ${percentage >= 75 ? 'var(--success)' : percentage >= 60 ? 'var(--warning)' : 'var(--error)'}; height: 100%; width: ${percentage}%; transition: width 0.3s ease;"></div>
          </div>
        </div>
      `).join('');
      console.log('StudentDashboard: Attendance Chart data loaded:', Array.from(subjectAttendance.entries()));

    } catch (error) {
      console.error('StudentDashboard: Error loading attendance chart:', error);
      document.getElementById('attendanceBars').innerHTML = '<p class="text-red-500">Error loading attendance chart</p>';
    }
  }

  loadPerformanceChart() {
    try {
      const container = document.getElementById('performanceBars');
      const subjectPerformance = new Map();

      // Calculate performance for each subject using the new internal marks logic
      this.subjects.forEach(subject => {
        const allMarksEnteredForSubject = this.marksCalculator.areAllMarksEntered(this.studentData.id, subject.id, this.marks, subject.type);
        
        let percentage = 0;
        if (allMarksEnteredForSubject) {
          const internalMarksResult = this.marksCalculator.calculateSubjectInternalMarks(this.studentData.id, subject.id, this.marks, subject.type);
          const internalScore = internalMarksResult.totalInternal;
          const maxInternalScore = internalMarksResult.maxInternal;
          
          const externalMarkRecord = this.marks.find(m => m.student_id === this.studentData.id && m.subject_id === subject.id && m.assessment_type === 'external_exam');
          const externalScore = externalMarkRecord ? externalMarkRecord.marks : 0;
          const maxExternalScore = externalMarkRecord ? externalMarkRecord.max_marks : 70;

          const combinedScore = internalScore + externalScore;
          const maxCombinedScore = maxInternalScore + maxExternalScore;

          percentage = maxCombinedScore > 0 ? Math.round((combinedScore / maxCombinedScore) * 100) : 0; // Rounded
        } else {
          percentage = 'N/A'; // Indicate pending marks
        }
        
        subjectPerformance.set(subject.name, percentage);
      });

      if (subjectPerformance.size === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 20px;">No performance data available</p>';
        return;
      }

      container.innerHTML = Array.from(subjectPerformance.entries()).map(([subject, percentage]) => `
        <div style="margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <span style="font-size: 0.9rem; font-weight: 500;">${subject}</span>
            <span style="font-size: 0.9rem; color: var(--gray-600);">${percentage !== 'N/A' ? `${percentage}%` : 'N/A'}</span>
          </div>
          <div style="background: var(--gray-200); height: 8px; border-radius: 4px; overflow: hidden;">
            <div style="background: ${percentage !== 'N/A' && percentage >= 70 ? 'var(--success)' : percentage !== 'N/A' && percentage >= 50 ? 'var(--warning)' : 'var(--error)'}; height: 100%; width: ${percentage !== 'N/A' ? percentage : 0}%; transition: width 0.3s ease;\"></div>
          </div>
        </div>
      `).join('');
      console.log('StudentDashboard: Performance Chart data loaded:', Array.from(subjectPerformance.entries()));

    } catch (error) {
      console.error('StudentDashboard: Error loading performance chart:', error);
      document.getElementById('performanceBars').innerHTML = '<p class="text-red-500">Error loading performance chart</p>';
    }
  }

  loadUpcomingEvents() {
    try {
      const events = this.generateUpcomingEvents();
      const container = document.getElementById('upcomingEvents');
      
      if (events.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="text-center">No upcoming events</td></tr>';
        return;
      }

      container.innerHTML = events.map(event => `
        <tr>
          <td><strong>${event.title}</strong></td>
          <td>${event.subject}</td>
          <td>${event.date}</td>
          <td>
            <span class="badge ${event.status === 'upcoming' ? 'badge-warning' : event.status === 'overdue' ? 'badge-error' : 'badge-success'}">
              ${event.status}
            </span>
          </td>
          <td>
            <span class="badge ${event.priority === 'high' ? 'badge-error' : event.priority === 'medium' ? 'badge-warning' : 'badge-info'}">
              ${event.priority}
            </span>
          </td>
        </tr>
      `).join('');
      console.log('StudentDashboard: Upcoming Events loaded:', events);

    } catch (error) {
      console.error('StudentDashboard: Error loading upcoming events:', error);
      document.getElementById('upcomingEvents').innerHTML = '<tr><td colspan="5" class="text-red-500">Error loading events</td></tr>';
    }
  }

  generateUpcomingEvents() {
    const events = [];
    const now = new Date();

    // Get assignments relevant to the student
    // Filter for assignments of type 'assignment_question_paper' or 'typed_questions'
    const studentAssignments = campusDB.getStorageData('assignments').filter(a => 
      this.subjects.some(s => `${s.id}_${s.branch}_${s.year}_${s.semester}_${s.section}` === a.subject_class_id) &&
      (a.type === 'assignment_question_paper' || a.type === 'typed_questions' || a.type === 'project' || a.type === 'quiz' || a.type === 'assignment')
    );

    studentAssignments.forEach(assignment => {
      const dueDate = new Date(assignment.due_date);
      if (dueDate > now) { // Only upcoming assignments
        const subject = this.subjects.find(s => `${s.id}_${s.branch}_${s.year}_${s.semester}_${s.section}` === assignment.subject_class_id);
        events.push({
          title: assignment.title,
          subject: subject ? subject.name : 'N/A',
          date: this.formatFutureDate(dueDate),
          status: 'upcoming',
          priority: 'medium' // All downloadable/typed assignments are medium priority
        });
      }
    });

    return events.sort((a, b) => new Date(a.date) - new Date(b.date));
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

  formatFutureDate(date) {
    const now = new Date();
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    return date.toLocaleDateString();
  }

  checkNewUpdatesAlert() {
    const lastLoginTime = localStorage.getItem('lastLoginTime');
    if (!lastLoginTime) return;

    const lastLoginDate = new Date(parseInt(lastLoginTime));
    const newAnnouncements = campusDB.getAnnouncements('student').filter(a => new Date(a.created_at) > lastLoginDate);
    const newResources = campusDB.getStorageData('resources').filter(r => {
      const subjectClassId = r.subject_class_id;
      return this.subjects.some(s => `${s.id}_${s.branch}_${s.year}_${s.semester}_${s.section}` === subjectClassId) && new Date(r.uploaded_at) > lastLoginDate;
    });

    const alertContainer = document.getElementById('dashboardAlert');
    if (newAnnouncements.length > 0 || newResources.length > 0) {
      let message = 'New updates since your last login:';
      if (newAnnouncements.length > 0) {
        message += ` ${newAnnouncements.length} new announcement(s).`;
      }
      if (newResources.length > 0) {
        message += ` ${newResources.length} new resource(s).`;
      }
      alertContainer.innerHTML = `<div class="alert alert-info"><strong>🔔 New Updates!</strong> ${message}</div>`;
      alertContainer.style.display = 'block';
    } else {
      alertContainer.style.display = 'none';
    }
    // Update last login time after checking for new updates
    localStorage.setItem('lastLoginTime', new Date().getTime().toString());
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new StudentDashboard();
});