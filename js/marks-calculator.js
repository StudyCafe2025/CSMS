// Generic Marks Calculation Utility
class MarksCalculator {
  constructor() {
    // This utility class does not need to load student/faculty data itself.
    // It operates on data passed to its methods.
    // It needs access to all subjects for context, which can be passed or fetched globally.
    this.allSubjects = window.campusDB ? window.campusDB.getStorageData('subjects') : [];
  }

  /**
   * Calculates the final internal marks for a given student and subject based on defined rules.
   * @param {number} studentId
   * @param {number} subjectId
   * @param {Array<Object>} allMarks - All marks records for the student.
   * @param {string} subjectType - The type of the subject ('theory', 'lab', 'skill_course').
   * @returns {{totalInternal: number, maxInternal: number, allInternalMarksEntered: boolean}} Calculated internal marks and max possible internal marks.
   */
  calculateSubjectInternalMarks(studentId, subjectId, allMarks, subjectType) {
    const subject = this.allSubjects.find(s => s.id === subjectId);
    if (!subject) {
      console.warn(`MarksCalculator: Subject with ID ${subjectId} not found.`);
      return { totalInternal: 0, maxInternal: 0, allInternalMarksEntered: false };
    }

    const studentSubjectMarks = allMarks.filter(m => m.student_id === studentId && m.subject_id === subjectId);

    // --- Special case for Engineering Graphics (existing logic) ---
    if (subject.name.includes('Engineering Graphics') || subject.name.includes('Engineering Graphics & Design')) {
      const internalExamMarks = studentSubjectMarks.filter(m => m.assessment_type === 'mid1');
      const dayToDayMarks = studentSubjectMarks.filter(m => ['assignment', 'quiz'].includes(m.assessment_type));

      const mid1Score = internalExamMarks.length > 0 ? internalExamMarks[0].marks : 0;
      const dayToDaySum = dayToDayMarks.reduce((sum, m) => sum + m.marks, 0);
      
      const finalInternalExamScore = Math.round(Math.min(mid1Score, 10)); // Cap at 10, rounded
      const finalDayToDayScore = Math.round(Math.min(dayToDaySum, 20)); // Cap at 20, rounded

      const totalInternal = finalInternalExamScore + finalDayToDayScore;
      
      // For EG, assume internal marks are "entered" if mid1 and at least one day-to-day mark exists.
      const allInternalMarksEntered = internalExamMarks.length > 0 && dayToDayMarks.length > 0;

      console.log(`MarksCalculator: EG Calc for ${subject.name} (ID:${subjectId}) - Mid1:${mid1Score}, DayToDaySum:${dayToDaySum} -> Final Internal: ${totalInternal}/30, All Internal Entered: ${allInternalMarksEntered}`);
      return {
        totalInternal: totalInternal,
        maxInternal: 30,
        allInternalMarksEntered: allInternalMarksEntered
      };

    } else if (subjectType === 'lab') {
      // --- Lab Course: 30 internal marks (Mid-term 10, Day-to-Day 20) ---
      const mid1Record = studentSubjectMarks.find(m => m.assessment_type === 'mid1');
      const mid2Record = studentSubjectMarks.find(m => m.assessment_type === 'mid2');

      const mid1Score = mid1Record ? mid1Record.marks : 0;
      const mid2Score = mid2Record ? mid2Record.marks : 0;
      const labMidMaxMarks = 10;

      let labMidTermComponent = 0;
      let midTermsPresent = 0;
      if (mid1Record) midTermsPresent++;
      if (mid2Record) midTermsPresent++;

      if (midTermsPresent === 2) {
        labMidTermComponent = Math.max(mid1Score, mid2Score);
      } else if (midTermsPresent === 1) {
        labMidTermComponent = (mid1Score > 0 ? mid1Score : mid2Score);
      }
      labMidTermComponent = Math.round(Math.min(labMidTermComponent, labMidMaxMarks)); // Cap at 10, rounded

      const labDayToDayMaxMarks = 20;
      let totalDayToDayObtained = 0;
      let totalDayToDayMaxPossible = 0;
      let hasLabAssignmentsOrDayToDay = false;

      const assignmentRecords = studentSubjectMarks.filter(m => m.assessment_type === 'assignment' && m.assignment_number >= 1 && m.assignment_number <= 5);
      const assignmentMaxPerAssignment = 5;

      if (assignmentRecords.length > 0) {
          hasLabAssignmentsOrDayToDay = true;
          const uniqueAssignments = new Map();
          assignmentRecords.forEach(assign => {
              if (!uniqueAssignments.has(assign.assignment_number) || uniqueAssignments.get(assign.assignment_number).marks < assign.marks) {
                  uniqueAssignments.set(assign.assignment_number, assign);
              }
          });
          const finalAssignments = Array.from(uniqueAssignments.values());

          let totalObtainedForAssignments = 0;
          let totalMaxForAssignments = 0;

          finalAssignments.forEach(assign => {
              totalObtainedForAssignments += assign.marks;
              totalMaxForAssignments += assignmentMaxPerAssignment;
          });

          if (totalMaxForAssignments > 0) {
              const assignmentAveragePercentage = (totalObtainedForAssignments / totalMaxForAssignments);
              totalDayToDayObtained += assignmentAveragePercentage * 5;
              totalDayToDayMaxPossible += 5;
          }
      }

      const otherLabActivityRecords = studentSubjectMarks.filter(m => ['quiz', 'lab_day_to_day'].includes(m.assessment_type));
      if (otherLabActivityRecords.length > 0) {
        hasLabAssignmentsOrDayToDay = true;
        const consolidatedLabDayToDay = otherLabActivityRecords.find(m => m.assessment_type === 'lab_day_to_day');
        if (consolidatedLabDayToDay) {
          totalDayToDayObtained += consolidatedLabDayToDay.marks;
          totalDayToDayMaxPossible += consolidatedLabDayToDay.max_marks;
        } else {
          otherLabActivityRecords.forEach(rec => {
            totalDayToDayObtained += rec.marks;
            totalDayToDayMaxPossible += rec.max_marks;
          });
        }
      }
      
      let dayToDayComponent = 0;
      if (totalDayToDayMaxPossible > 0) {
        dayToDayComponent = (totalDayToDayObtained / totalDayToDayMaxPossible) * labDayToDayMaxMarks;
      }
      dayToDayComponent = Math.round(Math.min(dayToDayComponent, labDayToDayMaxMarks)); // Cap at 20, rounded

      const totalInternal = labMidTermComponent + dayToDayComponent;
      const maxInternal = labMidMaxMarks + labDayToDayMaxMarks;

      const allInternalMarksEntered = (mid1Record && mid2Record && hasLabAssignmentsOrDayToDay);

      console.log(`MarksCalculator: Lab Calc for ${subject.name} (ID:${subjectId}) - Mid1:${mid1Score}, Mid2:${mid2Score}, Assignments: ${assignmentRecords.length} -> Lab Mid Comp: ${labMidTermComponent}/${labMidMaxMarks}, Day-to-Day Comp: ${dayToDayComponent}/${labDayToDayMaxMarks} -> Final Internal: ${totalInternal}/${maxInternal}, All Internal Entered: ${allInternalMarksEntered}`);
      return {
        totalInternal: totalInternal,
        maxInternal: maxInternal,
        allInternalMarksEntered: allInternalMarksEntered
      };

    } else {
      // --- Default theory/skill_course: 30 internal marks (Mid-term 25, Assignment 5) ---
      const mid1Record = studentSubjectMarks.find(m => m.assessment_type === 'mid1');
      const mid2Record = studentSubjectMarks.find(m => m.assessment_type === 'mid2');
      console.log(`MarksCalculator: Subject ${subject.name} (ID:${subjectId}) - Mid1 Record:`, !!mid1Record, `Mid2 Record:`, !!mid2Record); // DEBUG
      
      const assignmentRecords = studentSubjectMarks.filter(m => m.assessment_type === 'assignment' && m.assignment_number >= 1 && m.assignment_number <= 5);
      console.log(`MarksCalculator: Subject ${subject.name} (ID:${subjectId}) - Assignment Records (1-5) count:`, assignmentRecords.length); // DEBUG

      const theoryMidMaxMarks = 25;

      let midTermComponent = 0;
      let midTermsPresent = 0;
      if (mid1Record) midTermsPresent++;
      if (mid2Record) midTermsPresent++;

      if (midTermsPresent >= 1) {
        const mid1Score = mid1Record ? mid1Record.marks : 0;
        const mid2Score = mid2Record ? mid2Record.marks : 0;
        const bestMidScore = Math.max(mid1Score, mid2Score);
        const otherMidScore = Math.min(mid1Score, mid2Score);
        midTermComponent = (bestMidScore * 0.8) + (otherMidScore * 0.2);
      }
      midTermComponent = Math.round(Math.min(midTermComponent, theoryMidMaxMarks)); // Cap at 25, rounded
      console.log(`MarksCalculator: Subject ${subject.name} (ID:${subjectId}) - Mid-term component calculated: ${midTermComponent}`); // DEBUG


      const assignmentMaxPerComponent = 5;

      let assignmentComponent = 0;
      let hasAtLeastOneAssignment = false;

      if (assignmentRecords.length > 0) {
          hasAtLeastOneAssignment = true;
          const uniqueAssignments = new Map();
          assignmentRecords.forEach(assign => {
              if (!uniqueAssignments.has(assign.assignment_number) || uniqueAssignments.get(assign.assignment_number).marks < assign.marks) {
                  uniqueAssignments.set(assign.assignment_number, assign);
              }
          });
          const finalAssignments = Array.from(uniqueAssignments.values());

          let totalObtainedForAssignments = 0;
          finalAssignments.forEach(assign => {
              totalObtainedForAssignments += assign.marks;
          });

          if (finalAssignments.length > 0) {
              const averageOfIndividualAssignments = totalObtainedForAssignments / finalAssignments.length;
              assignmentComponent = averageOfIndividualAssignments;
          }
      }
      assignmentComponent = Math.round(Math.min(assignmentComponent, assignmentMaxPerComponent)); // Cap at 5, rounded
      console.log(`MarksCalculator: Subject ${subject.name} (ID:${subjectId}) - Has at least one assignment (1-5):`, hasAtLeastOneAssignment); // DEBUG
      console.log(`MarksCalculator: Subject ${subject.name} (ID:${subjectId}) - Assignment component calculated: ${assignmentComponent}`); // DEBUG


      const totalInternal = midTermComponent + assignmentComponent;
      const maxInternal = theoryMidMaxMarks + assignmentMaxPerComponent;

      // Internal marks are considered "entered" if both mids are present and at least one assignment is present.
      const allInternalMarksEntered = (mid1Record && mid2Record && hasAtLeastOneAssignment);
      console.log(`MarksCalculator: Subject ${subject.name} (ID:${subjectId}) - All Internal Marks Entered (calculated):`, allInternalMarksEntered); // DEBUG

      console.log(`MarksCalculator: Theory Calc for ${subject.name} (ID:${subjectId}) - Mid1:${mid1Record ? mid1Record.marks : 'N/A'}, Mid2:${mid2Record ? mid2Record.marks : 'N/A'}, Assignments: ${assignmentRecords.length} -> Mid-term Comp: ${midTermComponent}/${theoryMidMaxMarks}, Assign Comp: ${assignmentComponent}/${assignmentMaxPerComponent} -> Final Internal: ${totalInternal}/${maxInternal}, All Internal Entered: ${allInternalMarksEntered}`);
      return {
        totalInternal: totalInternal,
        maxInternal: maxInternal,
        allInternalMarksEntered: allInternalMarksEntered
      };
    }
  }

  /**
   * Checks if all required marks (internal components AND external exam) for a subject are entered for a student.
   * This is the comprehensive check for overall subject completeness.
   * @param {number} studentId
   * @param {number} subjectId
   * @param {Array<Object>} allMarks
   * @param {string} subjectType - The type of the subject ('theory', 'lab', 'skill_course').
   * @returns {boolean} True if all marks are present, false otherwise.
   */
  areAllMarksEntered(studentId, subjectId, allMarks, subjectType) {
    const subject = this.allSubjects.find(s => s.id === subjectId);
    if (!subject) {
      console.warn(`MarksCalculator: areAllMarksEntered - Subject with ID ${subjectId} not found.`); // DEBUG
      return false;
    }

    const hasExternal = allMarks.some(m => m.student_id === studentId && m.subject_id === subjectId && m.assessment_type === 'external_exam');
    console.log(`MarksCalculator: Subject ${subject.name} (ID:${subjectId}) - Has External Exam Record:`, hasExternal); // DEBUG
    
    const internalMarksResult = this.calculateSubjectInternalMarks(studentId, subjectId, allMarks, subjectType);
    const allInternalMarksEntered = internalMarksResult.allInternalMarksEntered;
    console.log(`MarksCalculator: Subject ${subject.name} (ID:${subjectId}) - All Internal Marks Entered (from internal calc):`, allInternalMarksEntered); // DEBUG

    const finalCheck = allInternalMarksEntered && hasExternal;
    console.log(`MarksCalculator: Subject ${subject.name} (ID:${subjectId}) - Final areAllMarksEntered check:`, finalCheck); // DEBUG
    return finalCheck;
  }

  getPercentageBadgeClass(percentage) {
    if (percentage >= 70) return 'badge-success';
    if (percentage >= 50) return 'badge-warning';
    return 'badge-error';
  }

  getAssessmentText(assessmentType) {
    const assessmentTexts = {
      mid1: 'Mid-1 Exam',
      mid2: 'Mid-2 Exam',
      assignment: 'Assignment',
      quiz: 'Quiz',
      lab_exam: 'Lab Exam',
      project: 'Project',
      external_exam: 'External Exam',
      lab_day_to_day: 'Lab Day-to-Day'
    };
    return assessmentTexts[assessmentType] || assessmentType;
  }
}

// Instantiate the calculator globally for easy access
window.marksCalculator = new MarksCalculator();