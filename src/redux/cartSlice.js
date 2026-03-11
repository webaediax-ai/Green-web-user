// src/redux/cartSlice.js
import { createSlice } from '@reduxjs/toolkit';
import CartService from '../utils/cartService';

const initialState = {
  items: [], // Array of { productId, quantity }
  coupon: null,
  appliedCoupon: null,
  syncing: false,
  lastSync: null
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    setCart: (state, action) => {
      console.log("Setting cart in Redux:", action.payload);
      state.items = action.payload;
      state.lastSync = new Date().toISOString();
    },
    
    addToCart: (state, action) => {
      const { productId, quantity = 1 } = action.payload;
      const existingItem = state.items.find(item => item.productId === productId);
      
      if (existingItem) {
        existingItem.quantity += quantity;
        console.log(`Added ${quantity} more of product ${productId}, new quantity: ${existingItem.quantity}`);
      } else {
        state.items.push({ productId, quantity });
        console.log(`Added new product ${productId} with quantity ${quantity}`);
      }
    },
    
    removeFromCart: (state, action) => {
      console.log("Removing product from cart:", action.payload);
      state.items = state.items.filter(item => item.productId !== action.payload);
    },
    
    removePurchasedFromCart: (state, action) => {
      const purchasedProductIds = action.payload;
      console.log("Removing purchased items:", purchasedProductIds);
      state.items = state.items.filter(item => !purchasedProductIds.includes(item.productId));
    },
    
    updateQuantity: (state, action) => {
      const { productId, quantity } = action.payload;
      const item = state.items.find(item => item.productId === productId);
      if (item) {
        item.quantity = quantity;
        console.log(`Updated product ${productId} quantity to ${quantity}`);
      }
    },
    
    clearCart: (state) => {
      console.log("Clearing cart");
      state.items = [];
      state.coupon = null;
      state.appliedCoupon = null;
    },
    
    applyCoupon: (state, action) => {
      const couponData = action.payload;
      state.coupon = couponData;
      state.appliedCoupon = couponData;
    },
    
    removeCoupon: (state) => {
      state.coupon = null;
      state.appliedCoupon = null;
    },
    
    setSyncing: (state, action) => {
      state.syncing = action.payload;
    }
  },
});

// Async thunk to sync cart with Firestore
export const syncCartWithDB = (userId) => async (dispatch, getState) => {
  if (!userId) return;
  
  const state = getState();
  const { items } = state.cart;
  
  try {
    dispatch(setSyncing(true));
    console.log("Syncing cart with DB for user:", userId, "Items:", items);
    await CartService.saveCart(userId, items);
    dispatch(setSyncing(false));
    console.log("Cart sync complete");
  } catch (error) {
    console.error("Error syncing cart:", error);
    dispatch(setSyncing(false));
  }
};

// Async thunk to load cart from Firestore
export const loadCartFromDB = (userId) => async (dispatch) => {
  if (!userId) return;
  
  try {
    console.log("Loading cart from Firestore for user:", userId);
    const cart = await CartService.getUserCart(userId);
    console.log("Cart loaded from Firestore:", cart);
    dispatch(setCart(cart));
  } catch (error) {
    console.error("Error loading cart:", error);
  }
};

// Async thunk to add to cart and sync with Firestore immediately
export const addToCartAndSync = (item) => async (dispatch, getState) => {
  console.log("📦 addToCartAndSync called with item:", item);
  
  // First update Redux state
  dispatch(addToCart(item));
  
  const state = getState();
  const user = state.user.user;
  console.log("👤 Current user from state:", user);
  
  // If user is logged in, immediately sync with Firestore
  if (user?.uid) {
    try {
      dispatch(setSyncing(true));
      console.log("🔄 Syncing add to cart with Firestore for user:", user.uid);
      
      // Use the service to add to cart in Firestore
      const updatedCart = await CartService.addToCart(user.uid, item);
      console.log("✅ Firestore sync complete, updated cart:", updatedCart);
      
      // Verify the cart was saved by reading it back
      const verifiedCart = await CartService.getUserCart(user.uid);
      console.log("🔍 Verified cart from Firestore:", verifiedCart);
      
      dispatch(setSyncing(false));
      
      // If the verified cart doesn't match what we expect, there might be an issue
      if (verifiedCart.length === 0) {
        console.warn("⚠️ Cart is empty in Firestore after sync!");
      }
    } catch (error) {
      console.error("❌ Error syncing add to cart with Firestore:", error);
      dispatch(setSyncing(false));
    }
  } else {
    console.log("👤 User not logged in, saving to localStorage instead");
    // For guest users, save to localStorage
    try {
      const guestCart = JSON.parse(localStorage.getItem('guestCart') || '[]');
      const existingItem = guestCart.find(i => i.productId === item.productId);
      
      if (existingItem) {
        existingItem.quantity += item.quantity || 1;
      } else {
        guestCart.push({ productId: item.productId, quantity: item.quantity || 1 });
      }
      
      localStorage.setItem('guestCart', JSON.stringify(guestCart));
      console.log("✅ Saved to localStorage:", guestCart);
    } catch (e) {
      console.error("Error saving to localStorage:", e);
    }
  }
};

// Async thunk to remove from cart and sync with Firestore immediately
export const removeFromCartAndSync = (productId) => async (dispatch, getState) => {
  // First update Redux state
  dispatch(removeFromCart(productId));
  
  const state = getState();
  const user = state.user.user;
  
  // If user is logged in, immediately sync with Firestore
  if (user?.uid) {
    try {
      dispatch(setSyncing(true));
      console.log("Syncing remove from cart with Firestore for user:", user.uid);
      
      await CartService.removeFromCart(user.uid, productId);
      
      dispatch(setSyncing(false));
    } catch (error) {
      console.error("Error syncing remove from cart with Firestore:", error);
      dispatch(setSyncing(false));
    }
  }
};

// Async thunk to update quantity and sync with Firestore immediately
export const updateQuantityAndSync = (productId, quantity) => async (dispatch, getState) => {
  // First update Redux state
  dispatch(updateQuantity({ productId, quantity }));
  
  const state = getState();
  const user = state.user.user;
  
  // If user is logged in, immediately sync with Firestore
  if (user?.uid) {
    try {
      dispatch(setSyncing(true));
      console.log("Syncing quantity update with Firestore for user:", user.uid);
      
      await CartService.updateQuantity(user.uid, productId, quantity);
      
      dispatch(setSyncing(false));
    } catch (error) {
      console.error("Error syncing quantity update with Firestore:", error);
      dispatch(setSyncing(false));
    }
  }
};

// Async thunk to clear cart and sync with Firestore immediately
export const clearCartAndSync = () => async (dispatch, getState) => {
  // First update Redux state
  dispatch(clearCart());
  
  const state = getState();
  const user = state.user.user;
  
  // If user is logged in, immediately sync with Firestore
  if (user?.uid) {
    try {
      dispatch(setSyncing(true));
      console.log("Clearing Firestore cart for user:", user.uid);
      
      await CartService.clearCart(user.uid);
      
      dispatch(setSyncing(false));
    } catch (error) {
      console.error("Error syncing clear cart with Firestore:", error);
      dispatch(setSyncing(false));
    }
  }
};

export const { 
  setCart, 
  addToCart, 
  removeFromCart, 
  removePurchasedFromCart,
  updateQuantity, 
  clearCart,
  applyCoupon,
  removeCoupon,
  setSyncing
} = cartSlice.actions;

// Selectors
export const selectCartItems = (state) => state.cart.items;
export const selectCartCount = (state) => {
  return state.cart.items.reduce((count, item) => count + item.quantity, 0);
};
export const selectAppliedCoupon = (state) => state.cart.appliedCoupon;
export const selectCoupon = (state) => state.cart.coupon;
export const selectCartSyncing = (state) => state.cart.syncing;

export default cartSlice.reducer;