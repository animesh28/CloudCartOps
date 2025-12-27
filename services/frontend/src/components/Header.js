import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { CartContext } from '../context/CartContext';

function Header() {
  const { user, logout } = useContext(AuthContext);
  const { getItemCount } = useContext(CartContext);

  // Check if user is admin
  const isAdmin = user?.is_admin === true;

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          🛒 CloudCart Ops
        </Link>
        
        <nav className="nav">
          <Link to="/">Products</Link>
          <Link to="/cart">Cart ({getItemCount()})</Link>
          {user && <Link to="/orders">My Orders</Link>}
          {isAdmin && <Link to="/admin" style={{ color: '#f39c12', fontWeight: 'bold' }}>🔧 Admin</Link>}
        </nav>

        <div className="auth-buttons">
          {user ? (
            <>
              <span style={{ color: 'white', marginRight: '1rem' }}>
                Hello, {user.username} {isAdmin && '👑'}
              </span>
              <button onClick={logout} className="btn btn-secondary">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">
                <button className="btn btn-secondary">Login</button>
              </Link>
              <Link to="/register">
                <button className="btn btn-primary">Register</button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
