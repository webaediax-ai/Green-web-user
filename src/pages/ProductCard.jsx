// src/components/ProductCard.jsx

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { addToCartAndSync } from '../redux/cartSlice';
import { toast } from 'react-toastify';
import { ShoppingCart, Check, Loader2, AlertCircle } from 'lucide-react';


function ProductCard({ product }) {
  const dispatch = useDispatch();
  const user = useSelector(state => state.user.user);
  const cartItems = useSelector(state => state.cart.items);
  const [addingToCart, setAddingToCart] = useState(false);
  
  const isInCart = cartItems.some(item => item.productId === product.id);
  const cartItem = cartItems.find(item => item.productId === product.id);
  
  const stockStatus = {
    isAvailable: product.stock > 0,
    isLowStock: product.stock > 0 && product.stock < 5,
    isOutOfStock: product.stock <= 0
  };



  const formatPrice = (price) => {

    if (!price || isNaN(price)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(price));
  };

// In your ProductCard component, add this useEffect to check user state:
useEffect(() => {
  console.log("👤 Current user in ProductCard:", user);
  console.log("🛒 Cart items in ProductCard:", cartItems);
}, [user, cartItems]);

// And update your handleAddToCart function:
const handleAddToCart = async () => {
  if (stockStatus.isOutOfStock) {
    toast.error("Product is out of stock");
    return;
  }

  setAddingToCart(true);

  try {
    console.log("🛒 Adding product to cart - Product ID:", product.id);
    console.log("👤 User logged in?:", !!user);
    console.log("👤 User UID:", user?.uid);
    
    // Use the async thunk that adds to Redux and syncs with Firestore
    await dispatch(addToCartAndSync({ 
      productId: product.id, 
      quantity: 1 
    }));

    // Check localStorage for guest cart if user is not logged in
    if (!user) {
      const guestCart = JSON.parse(localStorage.getItem('guestCart') || '[]');
      console.log("📦 Guest cart after addition:", guestCart);
    }

    if (!user) {
      toast.info(
        <div>
          Added to cart! <Link to="/signin" className="underline font-semibold">Sign in</Link> to save items permanently.
        </div>,
        { autoClose: 4000 }
      );
    } else {
      toast.success(
        <div>
          Added to cart! <Link to="/cart" className="underline font-semibold">View Cart</Link>
        </div>,
        { autoClose: 3000 }
      );
    }
  } catch (error) {
    console.error("❌ Error adding to cart:", error);
    toast.error("Failed to add to cart. Please try again.");
  } finally {
    setAddingToCart(false);
  }
};

  return (
    <div className="border rounded-lg shadow-lg p-4 flex flex-col bg-white hover:shadow-xl transition-shadow duration-300 relative group">
      {/* Stock Status Badge */}
      {stockStatus.isOutOfStock && (
        <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-semibold z-10">
          Out of Stock
        </div>
      )}
      {stockStatus.isLowStock && !stockStatus.isOutOfStock && (
        <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-semibold z-10">
          Only {product.stock} left
        </div>
      )}

      {/* Product Image */}
      <div className="relative overflow-hidden rounded-lg mb-4">
        <img 
          src={product.image} 
          alt={product.name} 
          className="h-48 w-full object-contain transition-transform duration-300 group-hover:scale-105"
        />
        
        {/* Quick Add Overlay */}
        {!stockStatus.isOutOfStock && (
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="flex gap-2">
              <button
                onClick={() => handleQuickAdd(1)}
                disabled={addingToCart}
                className="bg-white text-gray-900 p-2 rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                title="Add 1 item"
              >
                {addingToCart ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShoppingCart className="w-4 h-4" />
                )}
              </button>
              {product.stock >= 2 && (
                <button
                  onClick={() => handleQuickAdd(2)}
                  disabled={addingToCart}
                  className="bg-white text-gray-900 px-3 py-1 rounded-full shadow-lg hover:bg-gray-100 transition-colors text-sm font-semibold"
                >
                  +2
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      

      {/* Brand */}
      {product.brand && (
        <div className="mb-1">

          <span className="text-xs uppercase tracking-wider font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
            {product.brand}
          </span>
        </div>
      )}
      
      <h2 className="text-lg font-semibold mb-2 line-clamp-2">{product.name}</h2>
      
      <p className="text-gray-600 text-sm flex-grow mb-4 line-clamp-2">
        {product.description?.substring(0, 100)}...
      </p>

      {/* Price and Action */}
      <div className="mt-auto space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-gray-900 font-bold text-xl">
              {formatPrice(product.price)}
            </span>
            {product.mrp && product.mrp > product.price && (
              <span className="text-gray-400 text-sm line-through ml-2">
                {formatPrice(product.mrp)}
              </span>
            )}
          </div>
        </div>

        {/* Stock indicator */}
        {!stockStatus.isOutOfStock && (
          <div className="text-xs text-gray-500">
            {stockStatus.isLowStock ? (
              <span className="text-orange-600">Hurry! Only {product.stock} left</span>
            ) : (
              <span className="text-green-600">✓ In Stock</span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Link 
            to={`/product/${product.id}`} 
            className="flex-1 bg-gray-100 text-gray-900 px-4 py-2 rounded-lg font-medium transition duration-200 hover:bg-gray-200 text-center"
          >
            Details
          </Link>
          
          <button
            onClick={handleAddToCart}
            disabled={stockStatus.isOutOfStock || addingToCart}
            className={`
              flex-1 px-4 py-2 rounded-lg font-medium transition duration-200
              flex items-center justify-center gap-2
              ${stockStatus.isOutOfStock 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : isInCart 
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {addingToCart ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Adding...
              </>
            ) : stockStatus.isOutOfStock ? (
              <>
                <AlertCircle className="w-4 h-4" />
                Out of Stock
              </>
            ) : isInCart ? (
              <>
                <Check className="w-4 h-4" />
                Added ({cartItem?.quantity})
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                Add to Cart
              </>
            )}
          </button>
        </div>

        {/* Guest user notice */}
        {!user && !stockStatus.isOutOfStock && (
          <p className="text-xs text-gray-500 text-center mt-2">
            <Link to="/signin" className="text-blue-600 hover:underline">Sign in</Link> to save items to your account
          </p>

)}
      </div>
    </div>
  );
}





export default ProductCard;