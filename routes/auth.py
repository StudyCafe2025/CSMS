from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from models import User, Student, Faculty
from app import db

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    """Handle user login"""
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        remember = request.form.get('remember_me')
        
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password):
            # Set session
            session['user_id'] = user.id
            session['username'] = user.username
            session['role'] = user.role
            session['name'] = user.name
            session.permanent = bool(remember)
            
            # Redirect based on role
            if user.role == 'admin':
                return redirect(url_for('admin.dashboard'))
            elif user.role == 'faculty':
                return redirect(url_for('faculty.dashboard'))
            elif user.role == 'student':
                return redirect(url_for('student.dashboard'))
        else:
            flash('Invalid username or password', 'error')
    
    return render_template('auth/login.html')

@auth_bp.route('/logout')
def logout():
    """Handle user logout"""
    session.clear()
    flash('You have been logged out successfully', 'success')
    return redirect(url_for('auth.login'))

@auth_bp.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    """Handle password reset request"""
    if request.method == 'POST':
        email = request.form.get('email')
        user = User.query.filter_by(email=email).first()
        
        if user:
            # In production, send email with reset link
            flash('Password reset instructions have been sent to your email', 'success')
        else:
            flash('Email address not found', 'error')
    
    return render_template('auth/forgot_password.html')

def login_required(f):
    """Decorator to require login"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in to access this page', 'warning')
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function

def role_required(role):
    """Decorator to require specific role"""
    from functools import wraps
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                flash('Please log in to access this page', 'warning')
                return redirect(url_for('auth.login'))
            if session.get('role') != role:
                flash('You do not have permission to access this page', 'error')
                return redirect(url_for('auth.login'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator
