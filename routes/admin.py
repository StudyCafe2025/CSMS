from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, session
from models import (User, Student, Faculty, Department, Subject, ClassOffering,
                    Attendance, Mark, Announcement, Fee, Timetable)
from app import db
from routes.auth import role_required
from sqlalchemy import func
from datetime import datetime

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/dashboard')
@role_required('admin')
def dashboard():
    """Admin dashboard with statistics"""
    # Get statistics
    total_students = Student.query.filter_by(status='active').count()
    total_faculty = Faculty.query.count()
    total_departments = Department.query.count()
    total_subjects = Subject.query.count()
    
    # Get recent activities (last 10 students added)
    recent_students = Student.query.order_by(Student.created_at.desc()).limit(5).all()
    
    # Get announcements
    announcements = Announcement.query.filter_by(is_active=True).order_by(
        Announcement.is_pinned.desc(), Announcement.created_at.desc()
    ).limit(5).all()
    
    # Get department-wise student count
    dept_stats = db.session.query(
        Student.branch, func.count(Student.id).label('count')
    ).filter_by(status='active').group_by(Student.branch).all()
    
    return render_template('admin/dashboard.html',
                         total_students=total_students,
                         total_faculty=total_faculty,
                         total_departments=total_departments,
                         total_subjects=total_subjects,
                         recent_students=recent_students,
                         announcements=announcements,
                         dept_stats=dept_stats)

@admin_bp.route('/students')
@role_required('admin')
def students():
    """List all students"""
    # Get filter parameters
    branch = request.args.get('branch', '')
    year = request.args.get('year', '')
    section = request.args.get('section', '')
    search = request.args.get('search', '')
    
    # Build query
    query = Student.query
    
    if branch:
        query = query.filter_by(branch=branch)
    if year:
        query = query.filter_by(year=int(year))
    if section:
        query = query.filter_by(section=section)
    if search:
        query = query.filter(
            (Student.name.contains(search)) |
            (Student.student_id.contains(search)) |
            (Student.email.contains(search))
        )
    
    students = query.order_by(Student.student_id).all()
    
    # Get unique branches for filter
    branches = db.session.query(Student.branch).distinct().all()
    branches = [b[0] for b in branches]
    
    return render_template('admin/students.html',
                         students=students,
                         branches=branches,
                         selected_branch=branch,
                         selected_year=year,
                         selected_section=section,
                         search=search)

@admin_bp.route('/students/add', methods=['GET', 'POST'])
@role_required('admin')
def add_student():
    """Add new student"""
    if request.method == 'POST':
        try:
            # Create user account
            user = User(
                username=request.form['username'],
                email=request.form['email'],
                role='student',
                name=request.form['name']
            )
            user.set_password(request.form['password'])
            db.session.add(user)
            db.session.flush()
            
            # Create student record
            student = Student(
                user_id=user.id,
                student_id=request.form['student_id'],
                name=request.form['name'],
                email=request.form['email'],
                branch=request.form['branch'],
                year=int(request.form['year']),
                semester=int(request.form['semester']),
                section=request.form['section'],
                phone=request.form.get('phone', ''),
                address=request.form.get('address', ''),
                father_name=request.form.get('father_name', ''),
                mother_name=request.form.get('mother_name', ''),
                parents_phone=request.form.get('parents_phone', ''),
                date_of_birth=datetime.strptime(request.form['date_of_birth'], '%Y-%m-%d').date() if request.form.get('date_of_birth') else None,
                admission_date=datetime.strptime(request.form['admission_date'], '%Y-%m-%d').date() if request.form.get('admission_date') else None,
                status='active'
            )
            db.session.add(student)
            db.session.commit()
            
            flash('Student added successfully', 'success')
            return redirect(url_for('admin.students'))
        except Exception as e:
            db.session.rollback()
            flash(f'Error adding student: {str(e)}', 'error')
    
    # Get departments for dropdown
    departments = Department.query.all()
    return render_template('admin/add_student.html', departments=departments)

@admin_bp.route('/students/edit/<int:id>', methods=['GET', 'POST'])
@role_required('admin')
def edit_student(id):
    """Edit student details"""
    student = Student.query.get_or_404(id)
    
    if request.method == 'POST':
        try:
            # Update student record
            student.name = request.form['name']
            student.email = request.form['email']
            student.branch = request.form['branch']
            student.year = int(request.form['year'])
            student.semester = int(request.form['semester'])
            student.section = request.form['section']
            student.phone = request.form.get('phone', '')
            student.address = request.form.get('address', '')
            student.father_name = request.form.get('father_name', '')
            student.mother_name = request.form.get('mother_name', '')
            student.parents_phone = request.form.get('parents_phone', '')
            student.status = request.form.get('status', 'active')
            
            if request.form.get('date_of_birth'):
                student.date_of_birth = datetime.strptime(request.form['date_of_birth'], '%Y-%m-%d').date()
            if request.form.get('admission_date'):
                student.admission_date = datetime.strptime(request.form['admission_date'], '%Y-%m-%d').date()
            
            # Update user record
            student.user.name = request.form['name']
            student.user.email = request.form['email']
            
            db.session.commit()
            flash('Student updated successfully', 'success')
            return redirect(url_for('admin.students'))
        except Exception as e:
            db.session.rollback()
            flash(f'Error updating student: {str(e)}', 'error')
    
    departments = Department.query.all()
    return render_template('admin/edit_student.html', student=student, departments=departments)

@admin_bp.route('/students/delete/<int:id>', methods=['POST'])
@role_required('admin')
def delete_student(id):
    """Delete student"""
    try:
        student = Student.query.get_or_404(id)
        user = student.user
        
        db.session.delete(student)
        db.session.delete(user)
        db.session.commit()
        
        flash('Student deleted successfully', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Error deleting student: {str(e)}', 'error')
    
    return redirect(url_for('admin.students'))

@admin_bp.route('/faculty')
@role_required('admin')
def faculty():
    """List all faculty"""
    search = request.args.get('search', '')
    department = request.args.get('department', '')
    
    query = Faculty.query
    
    if department:
        query = query.filter_by(department=department)
    if search:
        query = query.filter(
            (Faculty.name.contains(search)) |
            (Faculty.faculty_id.contains(search)) |
            (Faculty.email.contains(search))
        )
    
    faculty_list = query.order_by(Faculty.faculty_id).all()
    
    # Get unique departments
    departments = db.session.query(Faculty.department).distinct().all()
    departments = [d[0] for d in departments]
    
    return render_template('admin/faculty.html',
                         faculty_list=faculty_list,
                         departments=departments,
                         selected_department=department,
                         search=search)

@admin_bp.route('/faculty/add', methods=['GET', 'POST'])
@role_required('admin')
def add_faculty():
    """Add new faculty"""
    if request.method == 'POST':
        try:
            # Create user account
            user = User(
                username=request.form['username'],
                email=request.form['email'],
                role='faculty',
                name=request.form['name']
            )
            user.set_password(request.form['password'])
            db.session.add(user)
            db.session.flush()
            
            # Create faculty record
            faculty = Faculty(
                user_id=user.id,
                faculty_id=request.form['faculty_id'],
                name=request.form['name'],
                email=request.form['email'],
                department=request.form['department'],
                designation=request.form['designation'],
                phone=request.form.get('phone', ''),
                qualification=request.form.get('qualification', ''),
                experience=int(request.form.get('experience', 0))
            )
            db.session.add(faculty)
            db.session.commit()
            
            flash('Faculty added successfully', 'success')
            return redirect(url_for('admin.faculty'))
        except Exception as e:
            db.session.rollback()
            flash(f'Error adding faculty: {str(e)}', 'error')
    
    departments = Department.query.all()
    return render_template('admin/add_faculty.html', departments=departments)

@admin_bp.route('/departments')
@role_required('admin')
def departments():
    """List all departments"""
    departments = Department.query.all()
    
    # Get student and faculty count for each department
    dept_data = []
    for dept in departments:
        student_count = Student.query.filter_by(branch=dept.name, status='active').count()
        faculty_count = Faculty.query.filter_by(department=dept.name).count()
        dept_data.append({
            'department': dept,
            'student_count': student_count,
            'faculty_count': faculty_count
        })
    
    return render_template('admin/departments.html', dept_data=dept_data)

@admin_bp.route('/subjects')
@role_required('admin')
def subjects():
    """List all subjects"""
    branch = request.args.get('branch', '')
    year = request.args.get('year', '')
    
    query = Subject.query
    
    if branch:
        query = query.filter_by(branch=branch)
    if year:
        query = query.filter_by(year=int(year))
    
    subjects = query.order_by(Subject.code).all()
    
    # Get unique branches
    branches = db.session.query(Subject.branch).distinct().all()
    branches = [b[0] for b in branches]
    
    return render_template('admin/subjects.html',
                         subjects=subjects,
                         branches=branches,
                         selected_branch=branch,
                         selected_year=year)

@admin_bp.route('/announcements')
@role_required('admin')
def announcements():
    """List all announcements"""
    announcements = Announcement.query.order_by(
        Announcement.is_pinned.desc(),
        Announcement.created_at.desc()
    ).all()
    
    return render_template('admin/announcements.html', announcements=announcements)

@admin_bp.route('/announcements/add', methods=['GET', 'POST'])
@role_required('admin')
def add_announcement():
    """Add new announcement"""
    if request.method == 'POST':
        try:
            announcement = Announcement(
                title=request.form['title'],
                content=request.form['content'],
                target_audience=request.form['target_audience'],
                created_by=session['user_id'],
                created_by_name=session['name'],
                is_active=True,
                is_pinned=bool(request.form.get('is_pinned')),
                priority=request.form.get('priority', 'normal'),
                send_email=bool(request.form.get('send_email'))
            )
            
            if request.form.get('expires_at'):
                announcement.expires_at = datetime.strptime(request.form['expires_at'], '%Y-%m-%dT%H:%M')
            
            db.session.add(announcement)
            db.session.commit()
            
            flash('Announcement created successfully', 'success')
            return redirect(url_for('admin.announcements'))
        except Exception as e:
            db.session.rollback()
            flash(f'Error creating announcement: {str(e)}', 'error')
    
    return render_template('admin/add_announcement.html')

@admin_bp.route('/fees')
@role_required('admin')
def fees():
    """List all fee records"""
    status = request.args.get('status', '')
    
    query = Fee.query.join(Student)
    
    if status:
        query = query.filter(Fee.status == status)
    
    fees = query.order_by(Fee.created_at.desc()).all()
    
    return render_template('admin/fees.html', fees=fees, selected_status=status)

@admin_bp.route('/timetable')
@role_required('admin')
def timetable():
    """View and manage timetable"""
    branch = request.args.get('branch', '')
    year = request.args.get('year', '')
    section = request.args.get('section', '')
    
    query = Timetable.query
    
    if branch:
        query = query.filter_by(branch=branch)
    if year:
        query = query.filter_by(year=int(year))
    if section:
        query = query.filter_by(section=section)
    
    timetables = query.order_by(Timetable.day_of_week, Timetable.start_time).all()
    
    # Get unique branches
    branches = db.session.query(Student.branch).distinct().all()
    branches = [b[0] for b in branches]
    
    return render_template('admin/timetable.html',
                         timetables=timetables,
                         branches=branches,
                         selected_branch=branch,
                         selected_year=year,
                         selected_section=section)

@admin_bp.route('/analytics')
@role_required('admin')
def analytics():
    """View analytics and reports"""
    # Get various statistics
    total_students = Student.query.filter_by(status='active').count()
    total_faculty = Faculty.query.count()
    
    # Department-wise distribution
    dept_distribution = db.session.query(
        Student.branch, func.count(Student.id).label('count')
    ).filter_by(status='active').group_by(Student.branch).all()
    
    # Year-wise distribution
    year_distribution = db.session.query(
        Student.year, func.count(Student.id).label('count')
    ).filter_by(status='active').group_by(Student.year).all()
    
    # Fee collection statistics
    total_fees = db.session.query(func.sum(Fee.total_fee)).scalar() or 0
    collected_fees = db.session.query(func.sum(Fee.paid_amount)).scalar() or 0
    pending_fees = total_fees - collected_fees
    
    return render_template('admin/analytics.html',
                         total_students=total_students,
                         total_faculty=total_faculty,
                         dept_distribution=dept_distribution,
                         year_distribution=year_distribution,
                         total_fees=total_fees,
                         collected_fees=collected_fees,
                         pending_fees=pending_fees)
