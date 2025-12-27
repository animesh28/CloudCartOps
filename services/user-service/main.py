from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from datetime import datetime
import bcrypt
import time

from database import get_db, engine
import models
import schemas
from kafka_producer import publish_event
import prometheus_metrics

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="User Service", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "user-service",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/metrics")
def metrics():
    start_time = time.time()
    try:
        # Check if user exists
        existing_user = db.query(models.User).filter(
            (models.User.username == user.username) | (models.User.email == user.email)
        ).first()
        
        if existing_user:
            prometheus_metrics.user_registrations_total.labels(status='failed_duplicate').inc()
            prometheus_metrics.http_requests_total.labels(method='POST', endpoint='/users', status='400').inc()
            raise HTTPException(status_code=400, detail="Username or email already exists")
        
        # Hash the password
        hash_start = time.time()
        hashed_password = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        hash_duration = time.time() - hash_start
        prometheus_metrics.password_hashing_duration_seconds.observe(hash_duration)
        
        # Create user
        db_user = models.User(
            username=user.username,
            email=user.email,
            password_hash=hashed_password,
            full_name=user.full_name
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
        # Publish event to Kafka
        publish_event('user.created', {
            'user_id': db_user.id,
            'username': db_user.username,
            'email': db_user.email,
            'timestamp': datetime.utcnow().isoformat()
        })
        
        # Record metrics
        prometheus_metrics.user_registrations_total.labels(status='success').inc()
        prometheus_metrics.kafka_events_published_total.labels(event_type='user.created', status='success').inc()
        
        duration = time.time() - start_time
        prometheus_metrics.http_requests_total.labels(method='POST', endpoint='/users', status='201').inc()
        prometheus_metrics.request_duration_seconds.labels(method='POST', endpoint='/users').observe(duration)
        
        return db_user
    except HTTPException:
        raise
    except Exception as e:
        prometheus_metrics.user_registrations_total.labels(status='failed_error').inc()
        prometheus_metrics.errors_total.labels(error_type=type(e).__name__, endpoint='/users').inc()
        prometheus_metrics.http_requests_total.labels(method='POST', endpoint='/users', status='500').inc()
        raiset to Kafka
    publish_event('user.created', {
        'user_id': db_user.id,
        'username': db_user.username,
        'email': db_user.email,
        'timestamp': datetime.utcnow().isoformat()
    })
    
    return db_user

@appstart_time = time.time()
    try:
        user = db.query(models.User).filter(models.User.username == creds.username).first()
        
        if not user:
            prometheus_metrics.user_logins_total.labels(success='false').inc()
            prometheus_metrics.auth_failures_total.labels(reason='user_not_found').inc()
            return {"valid": False, "user": None}
        
        # Verify password
        try:
            validate_start = time.time()
            is_valid = bcrypt.checkpw(creds.password.encode('utf-8'), user.password_hash.encode('utf-8'))
            validate_duration = time.time() - validate_start
            prometheus_metrics.password_validation_duration_seconds.observe(validate_duration)
        except Exception:
            prometheus_metrics.user_logins_total.labels(success='false').inc()
            prometheus_metrics.auth_failures_total.labels(reason='validation_error').inc()
            return {"valid": False, "user": None}
        
        if not is_valid:
            prometheus_metrics.user_logins_total.labels(success='false').inc()
            prometheus_metrics.auth_failures_total.labels(reason='invalid_password').inc()
            return {"valid": False, "user": None}
        
        # Record successful authentication
        prometheus_metrics.user_logins_total.labels(success='true').inc()
        prometheus_metrics.auth_success_total.inc()
        
        duration = time.time() - start_time
        prometheus_metrics.http_requests_total.labels(method='POST', endpoint='/auth/validate-password', status='200').inc()
        prometheus_metrics.request_duration_seconds.labels(method='POST', endpoint='/auth/validate-password').observe(duration)
        
        # Return user data if password is valid
        return {
            "valid": True,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
                "is_admin": user.is_admin
            }
        }
    except Exception as e:
        prometheus_metrics.errors_total.labels(error_type=type(e).__name__, endpoint='/auth/validate-password').inc()
        prometheus_metrics.http_requests_total.labels(method='POST', endpoint='/auth/validate-password', status='500').inc()
        raisef not user:
        return {"valid": False, "user": None}
    
    # Verify password
    try:
        is_valid = bcrypt.checkpw(creds.password.encode('utf-8'), user.password_hash.encode('utf-8'))
    except Exception:
        return {"valid": False, "user": None}
    
    if not is_valid:
        return {"valid": False, "user": None}
    
    # Return user data if password is valid
    return {
        "valid": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_admin": user.is_admin
        }
    }

@app.put("/users/{user_id}", response_model=schemas.UserResponse)
def update_user(user_id: int, user: schemas.UserUpdate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_user, field, value)
    
    db_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_user)
    
    return db_user

@app.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(db_user)
    db.commit()
    
    return {"message": "User deleted successfully"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
