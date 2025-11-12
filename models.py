from app import db, login_manager
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # admin, faculty, student
    name = db.Column(db.String(120), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    student = db.relationship('Student', backref='user', uselist=False, cascade='all, delete-orphan')
    faculty = db.relationship('Faculty', backref='user', uselist=False, cascade='all, delete-orphan')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def __repr__(self):
        return f'<User {self.username}>'

class Student(db.Model):
    __tablename__ = 'students'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    student_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    branch = db.Column(db.String(100), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    section = db.Column(db.String(10), nullable=False)
    phone = db.Column(db.String(20))
    address = db.Column(db.Text)
    father_name = db.Column(db.String(120))
    mother_name = db.Column(db.String(120))
    parents_phone = db.Column(db.String(20))
    date_of_birth = db.Column(db.Date)
    admission_date = db.Column(db.Date)
    status = db.Column(db.String(20), default='active')  # active, inactive, graduated
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    attendance = db.relationship('Attendance', backref='student', lazy='dynamic', cascade='all, delete-orphan')
    marks = db.relationship('Mark', backref='student', lazy='dynamic', cascade='all, delete-orphan')
    fees = db.relationship('Fee', backref='student', lazy='dynamic', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Student {self.student_id}>'

class Faculty(db.Model):
    __tablename__ = 'faculty'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    faculty_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    department = db.Column(db.String(100), nullable=False)
    designation = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20))
    qualification = db.Column(db.String(200))
    experience = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    class_offerings = db.relationship('ClassOffering', backref='faculty', lazy='dynamic')
    attendance_marked = db.relationship('Attendance', backref='marked_by_faculty', lazy='dynamic')
    marks_entered = db.relationship('Mark', backref='entered_by_faculty', lazy='dynamic')
    
    def __repr__(self):
        return f'<Faculty {self.faculty_id}>'

class Department(db.Model):
    __tablename__ = 'departments'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    code = db.Column(db.String(20), unique=True, nullable=False)
    head_of_department = db.Column(db.String(120))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Department {self.code}>'

class Subject(db.Model):
    __tablename__ = 'subjects'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    credits = db.Column(db.Integer, nullable=False)
    branch = db.Column(db.String(100), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    type = db.Column(db.String(50), nullable=False)  # theory, lab, skill_course
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    class_offerings = db.relationship('ClassOffering', backref='subject', lazy='dynamic')
    
    def __repr__(self):
        return f'<Subject {self.code}>'

class ClassOffering(db.Model):
    __tablename__ = 'class_offerings'
    
    id = db.Column(db.Integer, primary_key=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    branch = db.Column(db.String(100), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    section = db.Column(db.String(10), nullable=False)
    subject_type = db.Column(db.String(50), nullable=False)
    faculty_id = db.Column(db.Integer, db.ForeignKey('faculty.id'), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    is_cleared = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<ClassOffering {self.id}>'

class Attendance(db.Model):
    __tablename__ = 'attendance'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    class_time = db.Column(db.String(10), nullable=False)
    status = db.Column(db.String(20), nullable=False)  # present, absent, late
    marked_by = db.Column(db.Integer, db.ForeignKey('faculty.id'), nullable=False)
    reason = db.Column(db.Text)
    reason_for_change = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship to subject
    subject_rel = db.relationship('Subject', backref='attendance_records')
    
    def __repr__(self):
        return f'<Attendance {self.id}>'

class Mark(db.Model):
    __tablename__ = 'marks'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    assessment_type = db.Column(db.String(50), nullable=False)  # mid1, mid2, assignment, quiz, lab_exam, external_exam
    assignment_number = db.Column(db.Integer)
    marks = db.Column(db.Float, nullable=False)
    max_marks = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, nullable=False)
    entered_by = db.Column(db.Integer, db.ForeignKey('faculty.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship to subject
    subject_rel = db.relationship('Subject', backref='marks_records')
    
    def __repr__(self):
        return f'<Mark {self.id}>'

class Announcement(db.Model):
    __tablename__ = 'announcements'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    target_audience = db.Column(db.String(50), nullable=False)  # all, students, faculty, department
    created_by = db.Column(db.Integer, nullable=False)
    created_by_name = db.Column(db.String(120), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    is_pinned = db.Column(db.Boolean, default=False)
    priority = db.Column(db.String(20), default='normal')  # high, normal, low
    expires_at = db.Column(db.DateTime)
    send_email = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Announcement {self.title}>'

class Fee(db.Model):
    __tablename__ = 'fees'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    tuition_fee = db.Column(db.Float, nullable=False)
    development_fee = db.Column(db.Float, nullable=False)
    examination_fee = db.Column(db.Float, nullable=False)
    total_fee = db.Column(db.Float, nullable=False)
    paid_amount = db.Column(db.Float, default=0)
    due_amount = db.Column(db.Float, nullable=False)
    payment_date = db.Column(db.Date)
    status = db.Column(db.String(20), default='pending')  # paid, partially_paid, pending
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Fee {self.id}>'

class Resource(db.Model):
    __tablename__ = 'resources'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    subject_class_id = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # lecture_notes, assignment_question_paper, syllabus
    description = db.Column(db.Text)
    file_name = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(100))
    file_size = db.Column(db.Integer)
    file_url = db.Column(db.String(500), nullable=False)
    uploaded_by = db.Column(db.Integer, nullable=False)
    uploaded_by_name = db.Column(db.String(120), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Resource {self.title}>'

class Assignment(db.Model):
    __tablename__ = 'assignments'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    subject_class_id = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # project, quiz, assignment, assignment_question_paper, typed_questions
    description = db.Column(db.Text)
    max_marks = db.Column(db.Float, nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    created_by = db.Column(db.Integer, nullable=False)
    created_by_name = db.Column(db.String(120), nullable=False)
    is_completed = db.Column(db.Boolean, default=False)
    resource_id = db.Column(db.Integer)
    questions = db.Column(db.Text)  # JSON string for typed questions
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Assignment {self.title}>'

class Timetable(db.Model):
    __tablename__ = 'timetables'
    
    id = db.Column(db.Integer, primary_key=True)
    day_of_week = db.Column(db.String(20), nullable=False)
    start_time = db.Column(db.String(10), nullable=False)
    end_time = db.Column(db.String(10), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    branch = db.Column(db.String(100), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    section = db.Column(db.String(10), nullable=False)
    original_faculty_id = db.Column(db.Integer, db.ForeignKey('faculty.id'), nullable=False)
    current_faculty_id = db.Column(db.Integer, db.ForeignKey('faculty.id'), nullable=False)
    room_number = db.Column(db.String(50))
    status = db.Column(db.String(20), default='scheduled')  # scheduled, cancelled, altered
    reason = db.Column(db.Text)
    alter_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    subject_rel = db.relationship('Subject', backref='timetable_entries')
    original_faculty = db.relationship('Faculty', foreign_keys=[original_faculty_id], backref='original_timetables')
    current_faculty = db.relationship('Faculty', foreign_keys=[current_faculty_id], backref='current_timetables')
    
    def __repr__(self):
        return f'<Timetable {self.id}>'

class Alteration(db.Model):
    __tablename__ = 'alterations'
    
    id = db.Column(db.Integer, primary_key=True)
    timetable_id = db.Column(db.Integer, db.ForeignKey('timetables.id'), nullable=False)
    faculty_id_original = db.Column(db.Integer, db.ForeignKey('faculty.id'), nullable=False)
    faculty_id_new = db.Column(db.Integer, db.ForeignKey('faculty.id'))
    date = db.Column(db.Date, nullable=False)
    reason = db.Column(db.Text, nullable=False)
    period_id = db.Column(db.String(10), nullable=False)
    branch = db.Column(db.String(100), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    sem = db.Column(db.Integer, nullable=False)
    section = db.Column(db.String(10), nullable=False)
    subject = db.Column(db.Integer, nullable=False)
    alter_status = db.Column(db.String(20), nullable=False)  # altered, suspended
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    timetable = db.relationship('Timetable', backref='alterations')
    original_faculty = db.relationship('Faculty', foreign_keys=[faculty_id_original], backref='original_alterations')
    new_faculty = db.relationship('Faculty', foreign_keys=[faculty_id_new], backref='new_alterations')
    
    def __repr__(self):
        return f'<Alteration {self.id}>'
