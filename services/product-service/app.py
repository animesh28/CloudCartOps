from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from sqlalchemy import create_engine, Column, Integer, String, Numeric, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.sql import func
from datetime import datetime
from kafka_producer import publish_event
import prometheus_metrics
import os
import time

app = Flask(__name__)
CORS(app)

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://cloudcart:cloudcart123@postgres:5432/cloudcart")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

# Product Model
class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    price = Column(Numeric(10, 2), nullable=False)
    stock = Column(Integer, nullable=False, default=0)
    category = Column(String(100), index=True)
    image_url = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

# Create tables
Base.metadata.create_all(bind=engine)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "product-service",
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route('/metrics', methods=['GET'])
def metrics():
    start_time = time.time()
    """Prometheus metrics endpoint"""
    return Response(prometheus_metrics.get_metrics(), 
                   mimetype=prometheus_metrics.get_content_type())

@app.route('/products', methods=['GET'])
def get_products():
    db = SessionLocal()
    try:
        category = request.args.get('category')
        search = request.args.get('search')
        
        query = db.query(Product)
        
        if category:
          sponse = jsonify([{
            'id': p.id,
            'name': p.name,
            'description': p.description,
            'price': float(p.price),
            'stock': p.stock,
            'category': p.category,
            'image_url': p.image_url,
            'created_at': p.created_at.isoformat(),
            'updated_at': p.updated_at.isoformat()
        } for p in products])
        
        # Record metrics
        duration = time.time() - start_time
        prometheus_metrics.product_list_time.labels(category=category or 'all').observe(duration)
        prometheus_metrics.http_requests_total.labels(method='GET', endpoint='/products', status='200').inc()
        prometheus_metrics.request_duration_seconds.labels(method='GET', endpoint='/products').observe(duration)
        
        return response
    except Exception as e:
        prometheus_metrics.errors_total.labels(error_type=type(e).__name__, endpoint='/products').inc()
        prometheus_metrics.http_requests_total.labels(method='GET', endpoint='/products', status='500').inc()
        raisedescription,
            'price': float(p.price),
            'stock': p.stock,
            'category': p.category,
            'image_url': p.image_url,
            'created_at': p.created_at.isoformat(),
            'updated_at': p.updated_at.isoformat()
        } for p in products])
    finally:
        db.close()

@app.route('/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    start_time = time.time()
    db = SessionLocal()
    try:
        product = db.query(Product).filter(Product.id == product_id).first()
        
        if not product:
            prometheus_metrics.http_requests_total.labels(method='GET', endpoint='/products/<id>', status='404').inc()
            return jsonify({'error': 'Product not found'}), 404
        
        prometheus_metrics.product_views_total.labels(
            product_id=str(product_id), 
            category=product.category or 'unknown'
        ).inc()
        
        response = jsonify({
            'id': product.id,
            'name': product.name,
            'description': product.description,
            'price': float(product.price),
            'stock': product.stock,
            'category': product.category,
            'image_url': product.image_url,
            'created_at': product.created_at.isoformat(),
            'updated_at': product.updated_at.isoformat()
        })
        
        # Record metrics
        duration = time.time() - start_time
        prometheus_metrics.http_requests_total.labels(method='GET', endpoint='/products/<id>', status='200').inc()
        prometheus_metrics.request_duration_seconds.labels(method='GET', endpoint='/products/<id>').observe(duration)
        
        return response
    except Exception as e:
        prometheus_metrics.errors_total.labels(error_type=type(e).__name__, endpoint='/products/<id>').inc()
        prometheus_metrics.http_requests_total.labels(method='GET', endpoint='/products/<id>', status='500').inc()
        raise
    finally:
        db.close()

@app.route('/products/category/<category>', methods=['GET'])
def get_products_by_category(category):
    db = SessionLocal()
    try:
        products = db.query(Product).filter(Product.category == category).all()
        
        return jsonify([{
            'id': p.id,
            'name': p.name,
            'description': p.description,
            'price': float(p.price),
            'stock': p.stock,
            'category': p.category,
            'image_url': p.image_url,
            'created_at': p.created_at.isoformat(),
            'updated_at': p.updated_at.isoformat()
        } for p in products])
    finally:
        db.close()

@app.route('/products', methods=['POST'])
def create_product():
    db = SessionLocal()
    try:
        data = request.json
        
        product = Product(
            name=data['name'],
            description=data.get('description'),
            price=data['price'],
            stock=data.get('stock', 0),
            category=data.get('category'),
            image_url=data.get('image_url')
        )
        
        db.add(product)
        db.commit()
        db.refresh(product)
        
        return jsonify({
            'id': product.id,
            'name': product.name,
            'description': product.description,
            'price': float(product.price),
            'stock': product.stock,
            'category': product.category,
            'image_url': product.image_url,
            'created_at': product.created_at.isoformat(),
            'updated_at': product.updated_at.isoformat()
        }), 201
    finally:
        db.close()

@app.route('/products/<int:product_id>/stock', methods=['PATCH'])
def update_stock(product_id):
    start_time = time.time()
    db = SessionLocal()
    try:
        data = request.json
        product = db.query(Product).filter(Product.id == product_id).first()
        
        if not product:
            prometheus_metrics.http_requests_total.labels(method='PATCH', endpoint='/products/<id>/stock', status='404').inc()
            return jsonify({'error': 'Product not found'}), 404
        
        old_stock = product.stock
        product.stock = data.get('stock', product.stock)
        product.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(product)
        
        # Record stock update metric
        prometheus_metrics.product_stock_updates.labels(
            product_id=str(product_id),
            reason='manual_update'
        ).inc()
        
        # Check for low stock
        if product.stock < 10 and old_stock >= 10:
            prometheus_metrics.inventory_alerts_total.labels(
                product_id=str(product_id),
                severity='warning'
            ).inc()
            publish_event('stock.low', {
                'product_id': product.id,
                'product_name': product.name,
                'stock': product.stock,
                'timestamp': datetime.utcnow().isoformat()
            })
        
        response = jsonify({
            'id': product.id,
            'name': product.name,
            'stock': product.stock,
            'message': 'Stock updated successfully'
        })
        
        # Record metrics
        duration = time.time() - start_time
        prometheus_metrics.http_requests_total.labels(method='PATCH', endpoint='/products/<id>/stock', status='200').inc()
        prometheus_metrics.request_duration_seconds.labels(method='PATCH', endpoint='/products/<id>/stock').observe(duration)
        
        return response
    except Exception as e:
        prometheus_metrics.errors_total.labels(error_type=type(e).__name__, endpoint='/products/<id>/stock').inc()
        prometheus_metrics.http_requests_total.labels(method='PATCH', endpoint='/products/<id>/stock', status='500').inc()
        raise
    finally:
        db.close()

@app.route('/products/<int:product_id>', methods=['PUT'])
def update_product(product_id):
    db = SessionLocal()
    try:
        data = request.json
        product = db.query(Product).filter(Product.id == product_id).first()
        
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        product.name = data.get('name', product.name)
        product.description = data.get('description', product.description)
        product.price = data.get('price', product.price)
        product.stock = data.get('stock', product.stock)
        product.category = data.get('category', product.category)
        product.image_url = data.get('image_url', product.image_url)
        product.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(product)
        
        return jsonify({
            'id': product.id,
            'name': product.name,
            'description': product.description,
            'price': float(product.price),
            'stock': product.stock,
            'category': product.category,
            'image_url': product.image_url,
            'updated_at': product.updated_at.isoformat()
        })
    finally:
        db.close()

@app.route('/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    db = SessionLocal()
    try:
        product = db.query(Product).filter(Product.id == product_id).first()
        
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        db.delete(product)
        db.commit()
        
        return jsonify({'message': 'Product deleted successfully'})
    finally:
        db.close()

if __name__ == '__main__':
    port = int(os.getenv('PORT', 8002))
    app.run(host='0.0.0.0', port=port, debug=False)
