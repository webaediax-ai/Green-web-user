import React, { useEffect, useState } from "react";
import { db } from "../firebase/config";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { addToCart } from "../redux/cartSlice";
import { toast } from "react-toastify";
import {
  Truck,
  ShieldCheck,
  ArrowLeft,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  Star,
  Globe,
  Award,
  Minus,
  Plus,
  Loader2,
  Package,
  Battery,
  Bluetooth,
  Weight,
  Headphones,
  CheckCircle,
  Gift,
  Zap,
  Shield,
  Clock,
  MapPin,
  FileText,
  Info,
  Calendar,
  Tag,
  Box,
  CreditCard,
  BadgeCheck,
  Cpu,
  Wifi,
  Mic,
  Music,
  Repeat,
  Volume2,
  Settings,
  Store,
  RepeatIcon,
} from "lucide-react";
import { m } from "framer-motion";
import WishlistButton from "../components/WishlistButton";
import { Helmet } from "react-helmet-async";
import ProductReviews from "../components/ProductReviews";
import ProductReviewForm from "../components/ProductReviewForm";
import ProductCard from "../components/ProductCard";

function ProductView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Redux selector FIRST - before any state that might use it
  const user = useSelector((state) => state.user?.currentUser);

  // State declarations SECOND
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [activeImage, setActiveImage] = useState(null);
  const [activeDetail, setActiveDetail] = useState("features");
  const [showAllDetails, setShowAllDetails] = useState(true);
  const [deliveryDate, setDeliveryDate] = useState(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [userAddresses, setUserAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null); // Initialize as null
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  const [expandedSections, setExpandedSections] = useState({
    description: true,
    features: true,
    specifications: true,
    additionalInfo: false,
    shipping: false,
    warranty: false,
    guarantee: false,
    importDetails: false,
  });

  // Calculate delivery date (7 days from today)
  useEffect(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    setDeliveryDate(date);
  }, []);

  // Set selected address when user data is available
  useEffect(() => {
    if (user?.address) {
      setSelectedAddress(user.address);
    }
  }, [user]);

// Fetch user addresses function with better error handling
const fetchUserAddresses = async () => {
  if (!user?.uid) {
    toast.error("Please sign in to view your addresses");
    return;
  }
  
  setLoadingAddresses(true);
  try {
    console.log("Fetching addresses for user:", user.uid);
    
    // Try multiple possible address locations
    let addresses = [];
    
    // Option 1: Check if addresses are in a subcollection
    try {
      const addressesRef = collection(db, "users", user.uid, "addresses");
      const querySnapshot = await getDocs(addressesRef);
      
      if (!querySnapshot.empty) {
        addresses = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log("Found addresses in subcollection:", addresses);
      }
    } catch (subcollectionError) {
      console.log("No addresses subcollection or error accessing it:", subcollectionError);
    }
    
    // Option 2: If no addresses found in subcollection, check if address is in user document
    if (addresses.length === 0) {
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          
          // Check for addresses array in user document
          if (userData.addresses && Array.isArray(userData.addresses)) {
            addresses = userData.addresses.map((addr, index) => ({
              id: `addr-${index}`,
              ...addr
            }));
            console.log("Found addresses in user document array:", addresses);
          }
          // Check for single address object in user document
          else if (userData.address) {
            addresses = [{
              id: 'default-address',
              ...userData.address
            }];
            console.log("Found single address in user document:", addresses);
          }
        }
      } catch (userDocError) {
        console.log("Error fetching user document:", userDocError);
      }
    }
    
    // Option 3: Use address from Redux user state as fallback
    if (addresses.length === 0 && user.address) {
      addresses = [{
        id: 'user-address',
        ...user.address
      }];
      console.log("Using address from Redux state:", addresses);
    }
    
    if (addresses.length > 0) {
      setUserAddresses(addresses);
      
      // If there's a default address, select it automatically
      const defaultAddress = addresses.find(addr => addr.isDefault) || addresses[0];
      if (defaultAddress && !selectedAddress) {
        setSelectedAddress(defaultAddress);
      }
    } else {
      setUserAddresses([]);
      toast.info("No saved addresses found. Please add a new address.");
    }
    
  } catch (error) {
    console.error("Detailed error fetching addresses:", error);
    toast.error(`Failed to load addresses: ${error.message}`);
  } finally {
    setLoadingAddresses(false);
  }
};

  // Load addresses when modal opens
  useEffect(() => {
    if (showAddressModal && user?.uid) {
      fetchUserAddresses();
    }
  }, [showAddressModal, user]);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const docRef = doc(db, "products", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const productData = { id: docSnap.id, ...docSnap.data() };
          setProduct(productData);
          setActiveImage(productData.image);

          // Fetch similar products
          const productsRef = collection(db, "products");
          const typeQuery = query(
            productsRef,
            where("type", "==", productData.type),
            limit(5),
          );
          const querySnapshot = await getDocs(typeQuery);
          const similar = querySnapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .filter((prod) => prod.id !== productData.id);
          setSimilarProducts(similar);
        } else {
          toast.error("Product not found!");
          navigate("/products");
        }
      } catch (error) {
        console.error("Error fetching product:", error);
        toast.error("An error occurred while fetching the product.");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, navigate]);

  const formatPrice = (price) => {
    if (!price) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const calculateDiscount = (mrp, price) => {
    if (!mrp || !price) return 0;
    return Math.round(((mrp - price) / mrp) * 100);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";

    // Handle Firebase Timestamp
    if (timestamp.seconds) {
      const date = new Date(timestamp.seconds * 1000);
      return date.toLocaleString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }

    // Handle string dates
    if (typeof timestamp === "string") {
      return timestamp;
    }

    return "N/A";
  };

  const formatDeliveryDate = (date) => {
    if (!date) return "";
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const handleAddToCart = () => {
    if (!user) {
      toast.error("Please sign in to add items to your cart");
      navigate("/signin");
      return;
    }

    if (!product?.stock || product.stock <= 0) {
      toast.warning("This product is currently out of stock");
      return;
    }

    dispatch(addToCart({ productId: product.id, quantity }));
    toast.success(`Added ${quantity} item(s) to cart!`);
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const getFeatureIcon = (feature) => {
    if (feature.toLowerCase().includes("noise"))
      return <Volume2 className="w-5 h-5" />;
    if (feature.toLowerCase().includes("battery"))
      return <Battery className="w-5 h-5" />;
    if (feature.toLowerCase().includes("touch"))
      return <Settings className="w-5 h-5" />;
    if (feature.toLowerCase().includes("bluetooth"))
      return <Bluetooth className="w-5 h-5" />;
    if (feature.toLowerCase().includes("audio"))
      return <Music className="w-5 h-5" />;
    return <CheckCircle className="w-5 h-5" />;
  };

  const getSpecIcon = (key) => {
    if (key.toLowerCase().includes("driver"))
      return <Cpu className="w-5 h-5" />;
    if (key.toLowerCase().includes("battery"))
      return <Battery className="w-5 h-5" />;
    if (key.toLowerCase().includes("connect"))
      return <Wifi className="w-5 h-5" />;
    if (key.toLowerCase().includes("weight"))
      return <Weight className="w-5 h-5" />;
    return <Info className="w-5 h-5" />;
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <Loader2 className="w-12 h-12 text-gray-900 animate-spin mb-4" />
        <p className="text-gray-600">Loading product...</p>
      </div>
    );
  }

  const handleBuyNow = (product) => {
    navigate("/checkout", {
      state: { product, quantity: 1 },
    });
  };

  if (!product) return null;

  return (
    <>
      <Helmet>
        <title>{product.name} | aediax</title>
        <meta
          name="description"
          content={product.description || product.name}
        />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Back Button */}
          <m.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </m.button>

          {/* Product Main Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mb-12">
            {/* Left - Image Gallery */}
            <m.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-4"
            >
              {/* Main Image */}
              <div className="relative bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-100 h-[550px] max-[500px]:h-[350px] flex items-center justify-center">
                <div className="absolute top-4 right-4 z-10">
                  <WishlistButton product={product} size="lg" />
                </div>

                <img
                  src={activeImage || product.image}
                  alt={product.name}
                  className="w-full h-full object-contain transition-all duration-300 p-10"
                />
              </div>

              {/* Thumbnail Images */}
              <div className="flex gap-4">
                {[product.image, product.image2, product.image3]
                  .filter(Boolean)
                  .map((img, index) => (
                    <div
                      key={index}
                      onMouseEnter={() => setActiveImage(img)}
                      onClick={() => setActiveImage(img)}
                      className={`cursor-pointer bg-white rounded-xl overflow-hidden border
          ${activeImage === img ? "border-gray-900" : "border-gray-200"}
          hover:border-gray-900 transition-all`}
                    >
                      <img
                        src={img}
                        alt={`${product.name} ${index}`}
                        className="w-20 h-20 object-contain p-2"
                      />
                    </div>
                  ))}
              </div>
            </m.div>

            {/* Right - Product Info */}
            <m.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              {/* Title */}
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
                {product.name}
              </h1>

              {/* Rating */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-amber-50 px-3 rounded-lg">
                  <Star className="w-6 h-5 fill-amber-500 stroke-amber-500" />
                  <span className="text-sm font-semibold text-amber-700">
                    4.5
                  </span>
                </div>
                <span className="text-sm text-gray-600">(128 reviews)</span>
              </div>

              {/* Price */}
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl px-6 py-3 border border-gray-200">
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {formatPrice(product.sellingPrice || product.price)}
                  </span>
                  {product.mrp &&
                    product.mrp > (product.sellingPrice || product.price) && (
                      <>
                        <span className="text-xl text-gray-400 line-through">
                          {formatPrice(product.mrp)}
                        </span>
                        <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                          {calculateDiscount(
                            product.mrp,
                            product.sellingPrice || product.price,
                          )}
                          % OFF
                        </span>
                      </>
                    )}
                </div>
                {product.mrp &&
                  product.mrp > (product.sellingPrice || product.price) && (
                    <p className="text-sm text-green-600 font-semibold">
                      You save{" "}
                      {formatPrice(
                        product.mrp - (product.sellingPrice || product.price),
                      )}
                    </p>
                  )}
                <p className="text-xs text-gray-500 mt-2">
                  Inclusive of all taxes
                </p>
              </div>

              {/* Stock Status & Tags */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 bg-white rounded-lg px-4 py-3 border border-gray-200">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${product.stock > 0 ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
                  />
                  <span
                    className={`text-sm font-semibold ${product.stock > 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {product.stock > 0
                      ? `${product.stock} units in stock`
                      : "Out of stock"}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {/* Add to Cart */}
                <button
                  onClick={handleAddToCart}
                  disabled={!product.stock || product.stock <= 0}
                  className="flex-1 bg-gray-900 text-white py-4 px-5 rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <ShoppingCart className="w-5 h-5" />
                  Add to Cart
                </button>

                {/* Buy Now */}
                <button
                  onClick={() => handleBuyNow(product)}
                  disabled={!product.stock || product.stock <= 0}
                  className="flex-1 bg-yellow-600 text-white py-4 px-5 rounded-xl font-bold hover:bg-gold-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  Buy Now ₹{product.price}
                </button>
              </div>

              {/* Delivery Details Section */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="p-5 space-y-4">
                  {/* Location */}
                  <div className="flex items-start gap-3">
                    <MapPin className="w-6 h-6 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-500">Delivery location</p>
                      {selectedAddress ? (
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              {selectedAddress.addressLine1}
                              {selectedAddress.addressLine2 &&
                                `, ${selectedAddress.addressLine2}`}
                            </p>
                            <p className="text-sm text-gray-600">
                              {selectedAddress.city}, {selectedAddress.state}{" "}
                              {selectedAddress.pincode}
                            </p>
                            {selectedAddress.landmark && (
                              <p className="text-xs text-gray-500 mt-1">
                                Landmark: {selectedAddress.landmark}
                              </p>
                            )}

                          </div>
                          <button
                            onClick={() => setShowAddressModal(true)}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium ml-2 flex-shrink-0"
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowAddressModal(true)}
                          className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 group"
                        >
                          <span>Select delivery location</span>
                          <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Delivery Date */}
                  <div className="flex items-start gap-3">
                    <Calendar className="w-6 h-6 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-500">Delivery by</p>
                      <p className="font-medium text-gray-900">
                        {deliveryDate
                          ? formatDeliveryDate(deliveryDate)
                          : "Calculating..."}
                      </p>
                    </div>
                  </div>

                  {/* Fulfilled By */}
                  <div className="flex items-start gap-3">
                    <Store className="w-6 h-6 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-500">Fulfilled by</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">
                          {product?.brand}
                        </span>
                        <span className="flex items-center gap-1 text-sm bg-amber-50 px-2 py-0.5 rounded">
                          <Star className="w-3.5 h-3.5 fill-amber-500 stroke-amber-500" />
                          4.3
                        </span>
                        <span className="text-xs text-gray-500">
                          · 10 years on Flipkart
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Section - Replacement & Payment Options */}
                <div className="border-t border-gray-100 bg-gray-50 p-4">
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <RepeatIcon className="w-4 h-4 text-gray-600" />
                      <span className="text-gray-700">7 Days Replacement</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-gray-600" />
                      <span className="text-gray-700">Cash on Delivery</span>
                    </div>
                  </div>
                </div>
              </div>
            </m.div>
          </div>

          {/* Product Details Accordion */}
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-12"
          >
            {/* Description */}
            <div className="border-b border-gray-100">
              <button
                onClick={() => toggleSection("description")}
                className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-600" />
                  <h2 className="text-lg font-bold text-gray-900">
                    Product Description
                  </h2>
                </div>
                {expandedSections.description ? (
                  <ChevronUp className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                )}
              </button>
              {expandedSections.description && (
                <div className="px-6 pb-6">
                  <p className="text-gray-700 leading-relaxed">
                    {product.description || "No description available."}
                  </p>
                </div>
              )}
            </div>

            {/* All Details Header */}
            <div className="border-b border-gray-200">
              <button
                onClick={() => setShowAllDetails(!showAllDetails)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-600" />
                  <h2 className="text-lg font-bold text-gray-900">
                    Product Details
                  </h2>
                </div>

                {showAllDetails ? (
                  <ChevronUp className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                )}
              </button>
            </div>

            {showAllDetails && (
              <div className="flex divide-y">
                {/* Key Features */}
                {product.features && product.features.length > 0 && (
                  <div className="py-4">
                    <div className="flex flex-wrap gap-4 px-6 py-4 border-b">
                      <button
                        onClick={() => setActiveDetail("features")}
                        className={`px-5 py-2 rounded-xl text-sm font-medium transition
${
  activeDetail === "features"
    ? "bg-black text-white"
    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
}`}
                      >
                        Key Features
                      </button>

                      <button
                        onClick={() => setActiveDetail("specifications")}
                        className={`px-5 py-2 rounded-xl text-sm font-medium transition
${
  activeDetail === "specifications"
    ? "bg-black text-white"
    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
}`}
                      >
                        Technical Specifications
                      </button>

                      <button
                        onClick={() => setActiveDetail("additional")}
                        className={`px-5 py-2 rounded-xl text-sm font-medium transition
${
  activeDetail === "additional"
    ? "bg-black text-white"
    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
}`}
                      >
                        Additional Information
                      </button>

                      <button
                        onClick={() => setActiveDetail("warranty")}
                        className={`px-5 py-2 rounded-xl text-sm font-medium transition
${
  activeDetail === "warranty"
    ? "bg-black text-white"
    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
}`}
                      >
                        Warranty Information
                      </button>
                    </div>

                    {activeDetail === "features" && product.features && (
                      <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {product.features.map((feature, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                            >
                              <div className="p-2 bg-white rounded-lg shadow-sm">
                                {getFeatureIcon(feature)}
                              </div>

                              <span className="text-gray-700">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeDetail === "specifications" &&
                      product.specifications && (
                        <div className="p-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {product.specifications.map((spec, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                              >
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                  {getSpecIcon(spec.key)}
                                </div>

                                <div>
                                  <p className="text-xs text-gray-500">
                                    {spec.key}
                                  </p>
                                  <p className="font-semibold text-gray-900">
                                    {spec.value}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {activeDetail === "additional" &&
                      product.additionalInfo && (
                        <div className="p-6">
                          <p className="text-gray-700">
                            {product.additionalInfo}
                          </p>
                        </div>
                      )}

                    {activeDetail === "warranty" &&
                      product.warranty?.available && (
                        <div className="p-6">
                          <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-xl">
                            <div className="p-3 bg-amber-100 rounded-lg">
                              <Award className="w-6 h-6 text-amber-600" />
                            </div>

                            <div>
                              <p className="font-bold text-gray-900 pt-2">
                                {product.warranty.period} Manufacturer Warranty
                              </p>

                              {product.warranty.details && (
                                <p className="text-sm text-gray-600 mt-1">
                                  {product.warranty.details}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}
            {/* Guarantee */}
            {product.guarantee && product.guarantee.available && (
              <div className="border-b border-gray-100">
                <button
                  onClick={() => toggleSection("guarantee")}
                  className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-gray-600" />
                    <h2 className="text-lg font-bold text-gray-900">
                      Guarantee
                    </h2>
                  </div>
                  {expandedSections.guarantee ? (
                    <ChevronUp className="w-5 h-5 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                  )}
                </button>
                {expandedSections.guarantee && (
                  <div className="px-6 pb-6">
                    <div className="flex items-start gap-4 p-4 bg-green-50 rounded-xl">
                      <div className="p-3 bg-green-100 rounded-lg">
                        <ShieldCheck className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">
                          Product Guarantee Available
                        </p>
                        {product.guarantee.period && (
                          <p className="text-sm text-gray-600 mt-1">
                            Period: {product.guarantee.period}
                          </p>
                        )}
                        {product.guarantee.details && (
                          <p className="text-sm text-gray-600 mt-1">
                            {product.guarantee.details}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Import Details */}
            {product.importDetails?.isImported && (
              <div className="border-b border-gray-100">
                <button
                  onClick={() => toggleSection("importDetails")}
                  className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-gray-600" />
                    <h2 className="text-lg font-bold text-gray-900">
                      Shipping & Import Details
                    </h2>
                  </div>
                  {expandedSections.importDetails ? (
                    <ChevronUp className="w-5 h-5 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                  )}
                </button>
                {expandedSections.importDetails && (
                  <div className="px-6 pb-6">
                    <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-xl">
                      <div className="p-3 bg-purple-100 rounded-lg">
                        <Globe className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">
                          Imported Product
                        </p>
                        {product.importDetails.country && (
                          <p className="text-sm text-gray-600 mt-1">
                            Country of Origin: {product.importDetails.country}
                          </p>
                        )}
                        {product.importDetails.deliveryNote && (
                          <p className="text-sm text-gray-600 mt-1">
                            {product.importDetails.deliveryNote}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </m.div>

          {/* Key Features Grid - 3 Cards in One Row (Conditional) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 mx-4 md:mx-20">
            {/* Free Shipping Card */}
            <div className="group relative bg-gradient-to-br from-white to-blue-50/30 rounded-xl p-4 border border-gray-200 hover:border-blue-200 hover:shadow-md transition-all duration-300 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/0 to-blue-600/0 group-hover:from-blue-600/5 transition-all duration-500"></div>
              <div className="relative flex flex-col items-center text-center gap-2">
                <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
                  <Truck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">
                    Free Shipping
                  </h4>
                  <p className="text-xs text-gray-600 mt-0.5">
                    On orders over ₹500
                  </p>
                </div>
                <BadgeCheck className="w-4 h-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2" />
              </div>
            </div>

            {/* Secure Payment Card */}
            <div className="group relative bg-gradient-to-br from-white to-green-50/30 rounded-xl p-4 border border-gray-200 hover:border-green-200 hover:shadow-md transition-all duration-300 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-green-600/0 via-green-600/0 to-green-600/0 group-hover:from-green-600/5 transition-all duration-500"></div>
              <div className="relative flex flex-col items-center text-center gap-2">
                <div className="p-2.5 bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-sm">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">
                    Secure Payment
                  </h4>
                  <p className="text-xs text-gray-600 mt-0.5">100% encrypted</p>
                </div>
                <BadgeCheck className="w-4 h-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2" />
              </div>
            </div>

            {/* Additional Info Card - Only shown if exists */}
          </div>

          {/* Reviews Section */}
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-12"
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Customer Reviews
            </h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <ProductReviewForm productId={product.id} />
              <div className="mt-8">
                <ProductReviews productId={product.id} />
              </div>
            </div>
          </m.div>

          {/* Similar Products */}
          {similarProducts.length > 0 && (
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                You May Also Like
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {similarProducts.map((similarProduct) => (
                  <ProductCard
                    key={similarProduct.id}
                    product={similarProduct}
                    onAddToCart={(product) => {
                      dispatch(
                        addToCart({ productId: product.id, quantity: 1 }),
                      );
                      toast.success("Added to cart!");
                    }}
                  />
                ))}
              </div>
            </m.div>
          )}
        </div>
      </div>

      {/* Address Selection Modal - Moved outside the main container but still in the component */}
{/* Address Selection Modal */}
{showAddressModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddressModal(false)}>
    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
      {/* Modal Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-900">Select Delivery Address</h3>
        <button
          onClick={() => setShowAddressModal(false)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Modal Body */}
      <div className="p-6 overflow-y-auto max-h-[60vh]">
        {loadingAddresses ? (
          <div className="flex flex-col justify-center items-center py-12">
            <Loader2 className="w-8 h-8 text-gray-900 animate-spin mb-4" />
            <p className="text-gray-600">Loading your addresses...</p>
          </div>
        ) : userAddresses.length > 0 ? (
          <div className="space-y-4">
            {userAddresses.map((address, index) => (
              <div
                key={address.id || index}
                className={`border rounded-xl p-4 cursor-pointer transition-all ${
                  selectedAddress?.id === address.id
                    ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-200"
                    : "border-gray-200 hover:border-blue-200 hover:bg-gray-50"
                }`}
                onClick={() => {
                  setSelectedAddress(address);
                  setShowAddressModal(false);
                  toast.success("Delivery address updated");
                }}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    selectedAddress?.id === address.id
                      ? "bg-blue-100"
                      : "bg-gray-100"
                  }`}>
                    <MapPin className={`w-5 h-5 ${
                      selectedAddress?.id === address.id
                        ? "text-blue-600"
                        : "text-gray-600"
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-gray-900">
                        {address.name || `Address ${index + 1}`}
                      </span>
                      {address.type && (
                        <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full text-gray-700">
                          {address.type}
                        </span>
                      )}
                      {address.isDefault && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700">
                      {address.addressLine1}
                      {address.addressLine2 && `, ${address.addressLine2}`}
                    </p>
                    <p className="text-gray-700">
                      {address.city}, {address.state} - {address.pin}
                    </p>
                    {address.landmark && (
                      <p className="text-sm text-gray-500 mt-1">
                        Landmark: {address.landmark}
                      </p>
                    )}
                  </div>
                  {selectedAddress?.id === address.id && (
                    <BadgeCheck className="w-6 h-6 text-blue-500 flex-shrink-0" />
                  )}
                </div>
              </div>
            ))}
            
            {/* Add New Address Button */}
            <button
              onClick={() => {
                setShowAddressModal(false);
                navigate("/profile/addresses/add");
              }}
              className="w-full mt-4 border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>Add New Address</span>
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-gray-900 mb-2">No addresses found</h4>
            <p className="text-gray-600 mb-6">You haven't added any delivery addresses yet.</p>
            
            {/* Debug Info - Remove in production */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mb-4 p-3 bg-gray-100 rounded-lg text-left text-xs">
                <p className="font-mono">User ID: {user?.uid || 'Not logged in'}</p>
                <p className="font-mono">User Email: {user?.email || 'N/A'}</p>
              </div>
            )}
            
            <button
              onClick={() => {
                setShowAddressModal(false);
                navigate("/profile/addresses/add");
              }}
              className="bg-gray-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add New Address
            </button>
          </div>
        )}
      </div>

      {/* Modal Footer */}
      <div className="border-t border-gray-200 p-6">
        <button
          onClick={() => setShowAddressModal(false)}
          className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
    </>
  );
}

export default ProductView;
