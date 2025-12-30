// --- script.js (Modern E-commerce Logic) ---
let auth, db;
let confirmationResult = null;
let currentLang = localStorage.getItem('lang') || 'en';
let currentOrder = { itemId: null, itemName: null, basePrice: 0, qty: 1 };
let currentUser = null;
let products = []; // Dynamic products from Firestore

// 1. Initialize Firebase (Compat Mode)
try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        console.log("Firebase initialized successfully");
    } else {
        console.error("Firebase SDK not loaded.");
    }
} catch (e) { console.error("Firebase Init Error:", e); }

document.addEventListener('DOMContentLoaded', () => {
    initSettings();
    initGravityBg();
    setupRecaptcha();

    // Listeners
    if (auth) {
        auth.onAuthStateChanged((u) => {
            currentUser = u;
            checkLoginState();
        });

        // Load products from Firestore
        loadProducts();

        // Load posters for hero slider
        loadPosters();
    }

    // --- Modern Interaction Listeners ---
    const attach = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); }

    attach('login-btn', handleLoginClick);
    attach('theme-toggle', toggleTheme);
    attach('settings-btn', () => openModal('settings-modal'));
    attach('share-btn', shareApp);
    attach('browse-catalog-btn', () => openModal('pdf-catalog-modal'));

    // Fix Google Sign-In button
    const googleBtn = document.getElementById('google-signin-btn');
    if (googleBtn) {
        googleBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            googleLogin();
        });
    }

    // Fix Admin Login button  
    const adminLoginBtn = document.getElementById('admin-login-submit');
    if (adminLoginBtn) {
        adminLoginBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            adminLogin();
        });
    }

    // My Orders and Wishlist buttons
    attach('my-orders-btn', () => openMyOrders());
    attach('wishlist-btn', () => openWishlist());

    // Modal Closers
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(overlay.id);
        });
        const closeBtn = overlay.querySelector('.close-modal');
        if (closeBtn) closeBtn.addEventListener('click', () => closeModal(overlay.id));
    });
});

// --- UI Interaction Logic ---

// Sidebar Toggle
window.toggleSidebar = function () {
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar) sidebar.classList.toggle('active');
}

// Category Scroll
window.scrollToCategory = function (catId) {
    const el = document.getElementById('cat-' + catId);
    if (el) {
        // Scroll into view within the content-scroll container
        el.scrollIntoView({ behavior: 'smooth' });

        // Mobile: close sidebar
        if (window.innerWidth <= 768) toggleSidebar();

        // Active visual state
        document.querySelectorAll('.filter-list a').forEach(a => a.classList.remove('active'));
        // Find links that call this function
        const link = document.querySelector(`.filter-list a[onclick*="${catId}"]`);
        if (link) link.classList.add('active');
    }
}

// Search Filter
window.filterServices = function (query) {
    query = query.toLowerCase();
    const cards = document.querySelectorAll('.product-card');
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        if (text.includes(query)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

// --- Order System (Original Logic Preserved) ---

window.initiateOrder = function (id, name, price) {
    currentOrder = { itemId: id, itemName: name, basePrice: price, qty: 1 };
    openOrderDetails();
}

window.openOrderDetails = function () {
    const pType = document.getElementById('order-product-type');
    if (pType) pType.value = currentOrder.itemName;

    const phoneInput = document.getElementById('order-phone');
    if (phoneInput && currentUser?.phoneNumber) {
        phoneInput.value = currentUser.phoneNumber;
    }
    updatePrice();
    openModal('order-details-modal');
}

window.updatePrice = function () {
    const qEl = document.getElementById('order-qty');
    const pEl = document.getElementById('total-price');
    if (qEl && pEl) {
        const qty = parseInt(qEl.value) || 1;
        const total = currentOrder.basePrice * qty;
        pEl.innerText = `₹${total}`;
    }
}

window.goToPayment = function () {
    console.log('[ORDER] goToPayment called');
    console.log('[ORDER] Current mockupData before validation:', currentOrder.mockupData);

    // Basic validations
    currentOrder.quality = document.getElementById('order-quality').value;
    if (!currentOrder.quality) return showToast('Quality Required');

    currentOrder.contactPhone = document.getElementById('order-phone').value;
    if (!currentOrder.contactPhone) return showToast('Phone Required');

    currentOrder.size = document.getElementById('order-size').value;
    currentOrder.color = document.getElementById('order-color').value;
    currentOrder.address = document.getElementById('order-address').value;
    currentOrder.printType = document.getElementById('order-print-type').value;
    currentOrder.qty = parseInt(document.getElementById('order-qty').value) || 1;

    // Calculate bulk discount
    const discountInfo = calculateBulkDiscount(currentOrder.qty, currentOrder.basePrice);
    currentOrder.totalAmount = Math.round(discountInfo.finalTotal);
    currentOrder.discountApplied = discountInfo.discountAmount;
    currentOrder.discountLabel = discountInfo.discountLabel;

    // Calculate delivery estimate
    const deliveryDate = calculateDeliveryDate();
    currentOrder.estimatedDelivery = formatDeliveryDate(deliveryDate);

    // Store file reference (design file)
    currentOrder.designFile = document.getElementById('order-design-file').files[0] || null;

    // IMPORTANT: Preserve mockupData (don't overwrite if it exists)
    if (currentOrder.mockupData) {
        console.log('[ORDER] ✅ Mockup data preserved:', {
            hasImage: !!currentOrder.mockupData.mockupImage,
            imageUrl: currentOrder.mockupData.mockupImage?.substring(0, 50)
        });
    } else {
        console.log('[ORDER] ⚠️ No mockup data found in currentOrder');
    }

    console.log('[ORDER] Order data:', currentOrder);
    console.log('[ORDER] Closing order modal, opening payment modal');

    closeModal('order-details-modal');
    openModal('payment-modal');
}

// === HELPER FUNCTIONS ===

// Generate unique Order ID
function generateOrderID() {
    const prefix = 'PX';
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `${prefix}-${year}-${random}`;
}

// Upload design file to Firebase Storage
async function uploadDesignFile(file) {
    try {
        const storage = firebase.storage();
        const storageRef = storage.ref();
        const timestamp = Date.now();
        const fileName = `designs/${timestamp}_${file.name}`;
        const fileRef = storageRef.child(fileName);

        await fileRef.put(file);
        const downloadURL = await fileRef.getDownloadURL();

        showToast('Design uploaded successfully');
        return downloadURL;
    } catch (error) {
        console.error('File upload error:', error);
        showToast('File upload failed');
        return null;
    }
}

// --- Payment & Firebase ---
window.confirmPayment = async function (method) {
    const btn = document.querySelector('#payment-modal .buy-btn');
    if (btn) { btn.innerText = "Processing..."; btn.disabled = true; }

    try {
        // Upload design file if exists
        let designFileUrl = null;
        if (currentOrder.designFile) {
            showToast("Uploading original design...");
            const storageRef = firebase.storage().ref();
            const fileRef = storageRef.child(`designs/${Date.now()}_${currentOrder.designFile.name}`);
            await fileRef.put(currentOrder.designFile);
            designFileUrl = await fileRef.getDownloadURL();
            console.log("Original design uploaded:", designFileUrl);
        }

        // Generate unique Order ID
        const orderId = generateOrderID();

        // Create order data without File objects
        const { designFile, ...orderDetailsWithoutFile } = currentOrder;

        const orderData = {
            orderId: orderId,
            userId: currentUser ? currentUser.uid : null, // Link to user
            customerName: currentUser?.displayName || "Guest",
            customerPhone: currentOrder.contactPhone,
            product: currentOrder.itemName,
            quantity: currentOrder.qty,
            totalAmount: currentOrder.totalAmount,
            selectedColor: currentOrder.color || 'N/A',
            originalDesignUrl: designFileUrl, // Store High-Res URL
            paymentMode: (method === 'COD') ? 'PAY_LATER' : 'ONLINE',
            paymentStatus: (method === 'COD') ? 'PENDING' : 'PAID',
            orderStatus: 'ORDER_PLACED',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            details: orderDetailsWithoutFile,
            mockupData: currentOrder.mockupData || null,
            // New fields for enhanced features
            discountApplied: currentOrder.discountApplied || 0,
            discountLabel: currentOrder.discountLabel || '',
            estimatedDelivery: currentOrder.estimatedDelivery || '',
            orderHistory: [{
                status: 'ORDER_PLACED',
                timestamp: new Date().toISOString(),
                note: 'Order placed successfully'
            }]
        };

        // Debug logging
        if (currentOrder.mockupData) {
            console.log('[ORDER] ✅ Mockup data present');
        }

        console.log('[ORDER] Submitting to Firestore:', orderData);

        await db.collection("orders").add(orderData);
        closeModal('payment-modal');

        // Display Order ID and delivery estimate
        document.getElementById('order-id-display').textContent = orderId;

        // Add delivery estimate to success modal if element exists
        const successModal = document.getElementById('success-modal');
        if (successModal && currentOrder.estimatedDelivery) {
            const deliveryInfo = successModal.querySelector('#delivery-info');
            if (!deliveryInfo) {
                const orderIdDiv = document.getElementById('order-id-display').parentElement;
                orderIdDiv.insertAdjacentHTML('afterend', `
                    <div id="delivery-info" style="margin-top: 16px; padding: 12px; background: var(--bg-page); border-radius: 12px; text-align: center;">
                        <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 4px;">📦 Expected Delivery</p>
                        <p style="font-size: 1rem; font-weight: 600; color: var(--primary);">${currentOrder.estimatedDelivery}</p>
                    </div>
                `);
            }
        }

        showToast("Order Placed Successfully!");
        openModal('success-modal');

    } catch (e) {
        console.error('[ORDER] Failed:', e);
        showToast("Order Failed: " + e.message);
    }

    if (btn) { btn.innerText = "Pay Now"; btn.disabled = false; }
}

window.confirmWhatsAppOrder = function () {
    const msg = `Order: ${currentOrder.itemName}\nPrice: ${currentOrder.totalAmount}\nPhone: ${currentOrder.contactPhone}`;
    const url = `https://wa.me/919314421119?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    closeModal('payment-modal');
}


// --- Auth Logic (Condensed) ---
window.setupRecaptcha = function () {
    if (!window.recaptchaVerifier && auth) {
        if (document.getElementById('recaptcha-container')) {
            window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { size: 'invisible' });
        }
    }
}

window.sendOTP = function () {
    const phone = document.getElementById('login-mobile').value;
    auth.signInWithPhoneNumber(phone, window.recaptchaVerifier)
        .then((res) => { confirmationResult = res; document.getElementById('login-step-1').style.display = 'none'; document.getElementById('login-step-2').style.display = 'block'; })
        .catch(e => showToast(e.message));
}

window.verifyOTP = function () {
    const code = document.getElementById('login-otp').value;
    confirmationResult.confirm(code).then(res => {
        currentUser = res.user;
        closeModal('login-modal');
        showToast("Logged In");

        // Sync user to Firestore
        syncUserToFirestore(currentUser);
        checkLoginState();
    }).catch(e => {
        console.error(e);
        showToast("Invalid OTP or Error");
    });
}

window.googleLogin = function () {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then((result) => {
            currentUser = result.user;
            closeModal('login-modal');
            showToast('Signed in with Google');

            // Sync user to Firestore
            syncUserToFirestore(currentUser);
            checkLoginState();
        })
        .catch((error) => {
            showToast('Google sign-in failed: ' + error.message);
        });
}

// Toggle between phone and admin login
window.toggleAdminLogin = function () {
    const step1 = document.getElementById('login-step-1');
    const stepAdmin = document.getElementById('login-step-admin');

    if (stepAdmin.style.display === 'none') {
        step1.style.display = 'none';
        stepAdmin.style.display = 'block';
        document.getElementById('login-title').innerText = 'Admin Login';
    } else {
        stepAdmin.style.display = 'none';
        step1.style.display = 'block';
        document.getElementById('login-title').innerText = 'Login';
    }
}

// Admin login with email/password
window.adminLogin = function () {
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-pass').value;

    if (!email || !password) {
        showToast('Please enter email and password');
        return;
    }

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            currentUser = userCredential.user;
            closeModal('login-modal');

            // Redirect to admin dashboard if admin email
            if (email === 'faroofalam@gmail.com') {
                // Show success message
                showToast('✅ Admin Login Successfully!');

                // Mark admin login in sessionStorage for admin.js to verify
                sessionStorage.setItem('adminLoginPending', 'true');
                sessionStorage.setItem('adminEmail', email);

                // Redirect after showing success message
                setTimeout(() => {
                    showToast('Loading admin dashboard...');
                    window.location.href = 'admin.html';
                }, 800);
            } else {
                showToast('Logged in successfully');
                syncUserToFirestore(currentUser);
                checkLoginState();
            }
        })
        .catch((error) => {
            showToast('Login failed: ' + error.message);
        });
}

function syncUserToFirestore(user) {
    if (!db || !user) return;
    const userRef = db.collection('users').doc(user.uid);
    userRef.set({
        uid: user.uid,
        name: user.displayName || 'Guest',
        email: user.email || '',
        phone: user.phoneNumber || '',
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
        photoURL: user.photoURL || ''
    }, { merge: true }).then(() => {
        console.log("User synced to Firestore");
    }).catch(e => console.error("User sync error:", e));
}

// Open My Orders
window.openMyOrders = function () {
    if (!currentUser) {
        showToast("Please Login to view orders");
        openModal('login-modal');
        return;
    }
    openModal('my-orders-modal');
    loadMyOrders();
};

window.openWishlist = function () {
    if (!currentUser) {
        showToast("Please Login to view wishlist");
        openModal('login-modal');
        return;
    }
    openModal('wishlist-modal');
    // loadWishlist(); // To be implemented if needed
}

function loadMyOrders() {
    const container = document.getElementById('orders-container');
    if (!container) return;

    container.innerHTML = '<p class="loading-text">Loading your orders...</p>';

    // Query orders where 'userId' matches current user OR phone matches (fallback)
    // Complex query might require index. Let's try simple first, or client-side filter if list is small?
    // Safer to index 'userId'.

    // We'll trust that 'userId' is saved in orders (we need to ensure that in confirmPayment too)

    // For now, let's try querying by customerPhone first if userId isn't widely used yet, 
    // BUT we should transition to userId. 
    // Let's us userId if we have it.

    let query = db.collection('orders');

    // Check if we can just use userId (best practice)
    // NOTE: In confirmPayment (script.js), we need to ensure userId is saved!

    query = query.where('userId', '==', currentUser.uid);

    query.orderBy('createdAt', 'desc').limit(20).get()
        .then(snapshot => {
            if (snapshot.empty) {
                container.innerHTML = `
                <div style="text-align:center; padding:40px; color:var(--text-muted)">
                    <i class="ph ph-shopping-bag" style="font-size:48px; margin-bottom:10px;"></i>
                    <p>No orders found.</p>
                    <button class="small-buy-btn" onclick="closeModal('my-orders-modal')" style="margin-top:10px;">Start Shopping</button>
                </div>
             `;
                return;
            }

            container.innerHTML = snapshot.docs.map(doc => {
                const o = doc.data();
                const date = o.createdAt ? (o.createdAt.toDate ? o.createdAt.toDate().toLocaleDateString() : new Date(o.createdAt).toLocaleDateString()) : 'N/A';
                return `
                <div class="order-card-item" style="background:var(--bg-page); padding:16px; border-radius:12px; margin-bottom:12px; border:1px solid var(--card-border);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                        <span style="font-weight:700;">#${o.orderId || o.id}</span>
                        <span class="status-badge status-${o.orderStatus}">${o.orderStatus}</span>
                    </div>
                    <div style="display:flex; gap:12px;">
                        ${o.mockupData && o.mockupData.mockupImage
                        ? `<img src="${o.mockupData.mockupImage}" style="width:60px; height:60px; object-fit:cover; border-radius:8px; border:1px solid #ddd;">`
                        : `<div style="width:60px; height:60px; background:#eee; border-radius:8px; display:flex; align-items:center; justify-content:center;"><i class="ph ph-image"></i></div>`
                    }
                        <div>
                            <div style="font-weight:600;">${o.product || 'Custom Order'}</div>
                            <div style="font-size:0.85rem; color:var(--text-muted);">
                                Qty: ${o.quantity} • ₹${o.totalAmount}
                            </div>
                            <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">
                                ${date}
                            </div>
                        </div>
                    </div>
                    ${o.orderStatus === 'ORDER_PLACED' ?
                        `<div style="margin-top:12px; text-align:right;">
                            <button class="small-buy-btn" onclick="cancelOrder('${doc.id}')" style="background:#fee2e2; color:#dc2626; border:none;">Cancel Order</button>
                         </div>` : ''
                    }
                </div>
            `;
            }).join('');
        })
        .catch(err => {
            console.error("My Orders Error:", err);
            container.innerHTML = '<p class="error-text">Failed to load orders. Please try again.</p>';
        });
}

// Reset login (back to phone number)
window.resetLogin = function () {
    document.getElementById('login-step-2').style.display = 'none';
    document.getElementById('login-step-1').style.display = 'block';
    document.getElementById('login-mobile').value = '+91';
}

window.checkLoginState = function () {
    const btn = document.getElementById('login-btn');
    if (currentUser) {
        btn.innerHTML = `<i class="ph ph-user"></i>`;
        btn.onclick = () => {
            if (confirm("Logout?")) auth.signOut().then(() => {
                currentUser = null;
                window.location.reload();
            });
        };
    } else {
        btn.innerHTML = `<span data-i18n="login">Login</span>`;
        btn.onclick = handleLoginClick;
    }
}

window.handleLoginClick = function () {
    if (!currentUser) openModal('login-modal');
}

// --- Utils ---
window.openModal = function (id) { document.getElementById(id).classList.add('active'); }
window.closeModal = function (id) { document.getElementById(id).classList.remove('active'); }
window.showToast = function (msg) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div'); t.className = 'toast show'; t.innerText = msg;
    t.style.cssText = "background: #333; color: white; padding: 12px; border-radius: 8px; margin-bottom: 10px; animation: fadeIn 0.3s forwards;";
    c.appendChild(t); setTimeout(() => t.remove(), 3000);
}

function initSettings() {
    if (localStorage.getItem('theme') === 'dark') document.body.setAttribute('data-theme', 'dark');
}

function toggleTheme() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    if (isDark) { document.body.removeAttribute('data-theme'); localStorage.setItem('theme', 'light'); }
    else { document.body.setAttribute('data-theme', 'dark'); localStorage.setItem('theme', 'dark'); }
}

// ============================================
// DYNAMIC PRODUCT LOADING & RENDERING
// ============================================
function loadProducts() {
    if (!db) {
        console.error("[FRONTEND] Firestore not available");
        return;
    }

    console.log("[FRONTEND] Loading products from Firestore...");
    db.collection("products").where("inStock", "==", true).onSnapshot((snapshot) => {
        products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[FRONTEND] Products loaded:", products.length);
        renderProducts();
    }, (error) => {
        console.error("[FRONTEND] Product load error:", error);
    });
}

function renderProducts() {
    const categories = {
        'tshirts': products.filter(p => p.category === 'tshirts'),
        'corporate': products.filter(p => p.category === 'corporate'),
        'personalized': products.filter(p => p.category === 'personalized')
    };

    // Render each category
    Object.keys(categories).forEach(catKey => {
        const container = document.getElementById(`category-${catKey}`);
        if (!container) return;

        const itemsGrid = container.querySelector('.items-grid');
        if (!itemsGrid) return;

        const items = categories[catKey];
        if (items.length === 0) {
            itemsGrid.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">No products available</p>';
            return;
        }

        itemsGrid.innerHTML = items.map(item => {
            const colorDots = (item.colors && item.colors.length > 0)
                ? `<div style="display:flex; gap:4px; justify-content:center; margin-top:4px;">
                    ${item.colors.slice(0, 4).map(c => `<span style="width:16px; height:16px; border-radius:50%; background:${c}; border:1px solid #ddd;"></span>`).join('')}
                   </div>`
                : '';

            return `
                <button class="item-card" onclick="initiateOrder('${item.id}', '${escapeHtml(item.name)}', ${item.price})">
                    <div class="item-image">
                        ${item.image ? `<img src="${item.image}" alt="${escapeHtml(item.name)}">` : `<i class="ph ph-package"></i>`}
                    </div>
                    <div class="item-details">
                        <span class="item-name">${escapeHtml(item.name)}</span>
                        <span class="item-desc">${escapeHtml(item.description || '')}</span>
                        ${colorDots}
                        <span class="item-price">₹${item.price}</span>
                    </div>
                </button>
            `;
        }).join('');
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function initGravityBg() { /* Keep subtle blobs if needed, or remove for clean look */ }
function shareApp() { if (navigator.share) navigator.share({ title: 'Creative Printers', url: window.location.href }); }

// ============================================
// DYNAMIC PRODUCT LOADING & RENDERING
// ============================================

function loadProducts() {
    if (!db) {
        console.error("[FRONTEND] Firestore not available");
        return;
    }

    console.log("[FRONTEND] Loading products from Firestore...");
    db.collection("products").where("inStock", "==", true).onSnapshot((snapshot) => {
        products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[FRONTEND] Products loaded:", products.length);
        renderProducts();
    }, (error) => {
        console.error("[FRONTEND] Product load error:", error);
    });
}

function renderProducts() {
    const categories = {
        'tshirts': { containerId: 'cat-tshirts', products: products.filter(p => p.category === 'tshirts') },
        'corporate': { containerId: 'cat-corporate', products: products.filter(p => p.category === 'corporate') },
        'personalized': { containerId: 'cat-personalized', products: products.filter(p => p.category === 'personalized') }
    };

    Object.keys(categories).forEach(catKey => {
        const { containerId, products: catProducts } = categories[catKey];
        const section = document.getElementById(containerId);
        if (!section) return;

        const grid = section.querySelector('.modern-grid');
        if (!grid) return;

        if (catProducts.length === 0) {
            grid.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">No products available</p>';
            return;
        }

        grid.innerHTML = catProducts.map(item => {
            const colorDots = (item.colors && item.colors.length > 0)
                ? `<div class="color-swatches" style="display:flex; gap:4px; margin-top:6px;">
                    ${item.colors.slice(0, 5).map(c => `<span style="width:18px; height:18px; border-radius:50%; background:${c}; border:2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"></span>`).join('')}
                   </div>`
                : '';

            return `
                <button class="product-card" onclick="initiateOrder('${item.id}', '${escapeHtml(item.name)}', ${item.price})">
                    <div class="card-img">
                        ${item.image ?
                    `<img src="${item.image}" alt="${escapeHtml(item.name)}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">` :
                    `<div class="icon-placeholder"><i class="ph ph-package"></i></div>`
                }
                        <div class="badge">₹${item.price}</div>
                        <div class="fav-icon" onclick="event.stopPropagation(); toggleWishlist('${item.id}', '${escapeHtml(item.name)}', ${item.price})">
                            <i class="ph ph-heart"></i>
                        </div>
                    </div>
                    <div class="card-info">
                        <h5>${escapeHtml(item.name)}</h5>
                        <p>${escapeHtml(item.description || 'Premium Quality')}</p>
                        ${colorDots}
                        <div class="price-tag" style="margin-top:8px; font-size:1.1rem; font-weight:700; color:var(--primary);">₹${item.price}</div>
                    </div>
                </button>
            `;
        }).join('');
    });

    // Update wishlist UI after rendering
    if (typeof updateWishlistUI === 'function') {
        updateWishlistUI();
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Call loadProducts when Firebase is ready
if (db) {
    loadProducts();
}

// ============================================
// MOCKUP EDITOR SYSTEM
// ============================================
let mockupState = {
    canvas: null,
    ctx: null,
    tshirtImg: null,
    designImg: null,
    tshirtColor: '#FFFFFF',
    isFront: true,
    designX: 250,
    designY: 200,
    designWidth: 150,
    designHeight: 150,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0
};

window.initiateOrder = function (productId, productName, price) {
    console.log("[ORDER] Initiating order:", { productId, productName, price });

    // RESET currentOrder completely to avoid old data (like mockupData) persisting
    currentOrder = {
        itemId: productId,
        itemName: productName,
        basePrice: price,
        qty: 1,
        totalAmount: price,
        mockupData: null, // Explicitly clear mockup data
        designFile: null // Reset design file
    };

    const modal = document.getElementById('order-details-modal');
    if (!modal) {
        console.error("[ORDER] Modal not found!");
        return;
    }

    // Set product details
    const nameEl = document.getElementById('order-product-name');
    if (nameEl) nameEl.value = productName;

    // Total price
    const totalEl = document.getElementById('total-price');
    if (totalEl) totalEl.innerText = '₹' + price;

    // Reset quantity
    const qtyEl = document.getElementById('order-qty');
    if (qtyEl) qtyEl.value = 1;

    // Reset mockup
    if (typeof mockupState !== 'undefined') {
        mockupState.designImg = null;
        mockupState.tshirtColor = '#ffffff';
    }
    const mockupSection = document.getElementById('mockup-editor-section');
    if (mockupSection) {
        mockupSection.style.display = 'none';
    }

    // Show modal
    modal.classList.add('active');
};

function resetMockupEditor() {
    mockupState.designImg = null;
    mockupState.designX = 250;
    mockupState.designY = 200;
    mockupState.designWidth = 150;
    mockupState.designHeight = 150;
    mockupState.tshirtColor = '#FFFFFF';
    mockupState.isFront = true;

    document.getElementById('mockup-editor-section').style.display = 'none';
    document.getElementById('order-design-file').value = '';
    document.getElementById('tshirt-color-picker').value = '#FFFFFF';
    document.getElementById('design-size-slider').value = 150;
}

window.handleDesignUpload = function (input) {
    const file = input.files[0];
    if (!file) return;

    // Validate (Image/PDF)
    // For now we allow images for mockup. PDF/AI/PSD should be allowed for 'Original File'
    if (!file.type.match('image/(png|jpeg)')) {
        showToast('Only PNG and JPG files are supported for mockup preview');
        return;
    }

    // Check size (e.g. 10MB limit)
    if (file.size > 10 * 1024 * 1024) {
        showToast("File too large (Max 10MB)");
        return;
    }

    // Store original file for upload later
    currentOrder.designFile = file;

    const editorSection = document.getElementById('mockup-editor-section');
    editorSection.style.display = 'block';

    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            mockupState.designImg = img;
            // Reset position/scale for new image
            mockupState.designX = 150; // Center X (canvas width 300)
            mockupState.designY = 150; // Center Y (canvas height 400 - center roughly)
            mockupState.designWidth = 150; // Default size
            mockupState.designHeight = 150; // Default size

            initMockupCanvas();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    showToast("Design uploaded! Drag to position.");
};

function initMockupCanvas() {
    const canvas = document.getElementById('mockup-canvas');
    if (!canvas) return;

    mockupState.canvas = canvas;
    mockupState.ctx = canvas.getContext('2d');

    // Ensure high resolution
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    mockupState.ctx.scale(dpr, dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    // Update internal state width/height to logical pixels
    mockupState.logicalWidth = rect.width;
    mockupState.logicalHeight = rect.height;

    // Load t-shirt mockup image
    const tshirt = new Image();
    tshirt.crossOrigin = "anonymous"; // Fix for tainted canvas if needed
    tshirt.onload = function () {
        mockupState.tshirtImg = tshirt;

        // Fix aspect ratio for design if exists
        if (mockupState.designImg) {
            const ratio = mockupState.designImg.width / mockupState.designImg.height;
            if (ratio > 1) {
                // Landscape
                mockupState.designWidth = 150;
                mockupState.designHeight = 150 / ratio;
            } else {
                // Portrait
                mockupState.designHeight = 150;
                mockupState.designWidth = 150 * ratio;
            }
        }

        renderMockup();
        setupCanvasInteraction();
    };
    tshirt.src = 'images/tshirt-mockup.png';
}

function renderMockup() {
    const { canvas, ctx, tshirtImg, designImg, tshirtColor, designX, designY, designWidth, designHeight, logicalWidth, logicalHeight } = mockupState;
    if (!ctx || !tshirtImg) return;

    // Use logical width/height for clearing
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    // 1. Draw T-Shirt base (White/Color)
    // We assume the t-shirt image is transparent where the shirt is? No, usually it's a white shirt.
    // To colorize: Draw color, then draw shirt with 'multiply' blend.

    ctx.save();

    // Fill background with selected color
    ctx.fillStyle = tshirtColor;
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    // Draw shadows/highlights (The Mockup Image should be a transparent PNG with shadows)
    // Using 'multiply' allows the color to show through the darker parts (shadows)
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(tshirtImg, 0, 0, logicalWidth, logicalHeight);

    // Restore for drawing design
    ctx.restore();

    // 2. Draw Design
    if (designImg) {
        ctx.save();

        // Start Clipping Region (Optional: restricts design to shirt area)
        // For simplicity, we just draw on top for now.

        // Draw the design image
        ctx.globalCompositeOperation = 'normal'; // Normal blending for the print
        ctx.drawImage(designImg, designX - designWidth / 2, designY - designHeight / 2, designWidth, designHeight);

        // Draw Selection Box (if dragging or active)
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(designX - designWidth / 2, designY - designHeight / 2, designWidth, designHeight);

        // Draw resize handles (corners)
        ctx.fillStyle = '#8b5cf6';
        const handleSize = 8;
        // Bottom-Right Handle
        ctx.fillRect(designX + designWidth / 2 - handleSize / 2, designY + designHeight / 2 - handleSize / 2, handleSize, handleSize);

        ctx.restore();
    }
}

function setupCanvasInteraction() {
    const canvas = mockupState.canvas;

    // Helper to get pointer position
    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const handleStart = (e) => {
        if (!mockupState.designImg) return;

        e.preventDefault();
        const { x, y } = getPos(e);
        const { designX, designY, designWidth, designHeight } = mockupState;

        // Check resize handle collision (Bottom-Right)
        const handleSize = 10;
        const handleX = designX + designWidth / 2;
        const handleY = designY + designHeight / 2;
        if (Math.abs(x - handleX) < handleSize && Math.abs(y - handleY) < handleSize) {
            mockupState.isResizing = true;
            mockupState.lastX = x;
            mockupState.lastY = y;
            return;
        }

        // Check design body collision
        if (x >= designX - designWidth / 2 && x <= designX + designWidth / 2 &&
            y >= designY - designHeight / 2 && y <= designY + designHeight / 2) {
            mockupState.isDragging = true;
            mockupState.dragStartX = x - designX;
            mockupState.dragStartY = y - designY;
        }
    };

    const handleMove = (e) => {
        if (!mockupState.isDragging && !mockupState.isResizing) return;

        e.preventDefault();
        const { x, y } = getPos(e);

        if (mockupState.isDragging) {
            mockupState.designX = x - mockupState.dragStartX;
            mockupState.designY = y - mockupState.dragStartY;
        } else if (mockupState.isResizing) {
            // Simple resize logic (maintain aspect ratio)
            const dx = x - mockupState.lastX;
            // Scale based on X movement
            const scaleFactor = 1 + (dx / mockupState.designWidth);

            mockupState.designWidth *= scaleFactor;
            mockupState.designHeight *= scaleFactor;

            mockupState.lastX = x;
            mockupState.lastY = y;
        }

        requestAnimationFrame(renderMockup);
    };

    const handleEnd = (e) => {
        mockupState.isDragging = false;
        mockupState.isResizing = false;
    };

    // Mouse Events
    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseup', handleEnd);
    canvas.addEventListener('mouseleave', handleEnd);

    // Touch Events (Passive false to allow preventing default)
    canvas.addEventListener('touchstart', handleStart, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    canvas.addEventListener('touchend', handleEnd);
}

window.changeTshirtColor = function (color) {
    mockupState.tshirtColor = color;
    renderMockup();
};

window.resizeDesign = function (size) {
    mockupState.designWidth = parseInt(size);
    mockupState.designHeight = parseInt(size);
    renderMockup();
};

window.toggleMockupView = function () {
    mockupState.isFront = !mockupState.isFront;
    // For simplicity, we're using the same image rotated/flipped
    // In production, you'd load a different image for front/back
    showToast(mockupState.isFront ? 'Showing Front View' : 'Showing Back View');
};

window.resetMockup = function () {
    mockupState.designX = 250;
    mockupState.designY = 200;
    mockupState.designWidth = 150;
    mockupState.designHeight = 150;
    document.getElementById('design-size-slider').value = 150;
    renderMockup();
};

window.saveMockup = async function () {
    if (!mockupState.canvas || !mockupState.designImg) {
        showToast('Please upload a design first');
        return;
    }

    showToast('Uploading mockup to cloud...', 'info');

    try {
        // Convert canvas to blob
        const blob = await new Promise(resolve => {
            mockupState.canvas.toBlob(resolve, 'image/png');
        });

        // Upload to ImgBB
        const formData = new FormData();
        formData.append('image', blob);
        formData.append('key', '1a28c6bc9aed175908ea7b66ee2f7404');

        console.log('[MOCKUP] Uploading to ImgBB...');

        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            const mockupImageUrl = result.data.display_url;
            console.log('[MOCKUP] Upload successful! URL:', mockupImageUrl);

            // Store mockup data with ImgBB URL
            currentOrder.mockupData = {
                mockupImage: mockupImageUrl, // ImgBB URL instead of base64
                tshirtColor: mockupState.tshirtColor,
                isFront: mockupState.isFront,
                designPosition: {
                    x: mockupState.designX,
                    y: mockupState.designY,
                    width: mockupState.designWidth,
                    height: mockupState.designHeight
                },
                uploadedAt: new Date().toISOString(),
                imageId: result.data.id,
                deleteUrl: result.data.delete_url
            };

            console.log('[MOCKUP] ✅ Mockup data saved to currentOrder.mockupData');
            console.log('[MOCKUP] Verification - currentOrder.mockupData:', currentOrder.mockupData);
            console.log('[MOCKUP] Verification - mockupImage URL:', mockupImageUrl);

            showToast('✅ Mockup saved successfully!');

            // Hide mockup editor
            document.getElementById('mockup-editor-section').style.display = 'none';
        } else {
            throw new Error('ImgBB upload failed: ' + (result.error?.message || 'Unknown error'));
        }

    } catch (error) {
        console.error('[MOCKUP] Upload error:', error);
        showToast('❌ Failed to upload mockup: ' + error.message);

        // Fallback: Save as base64 if upload fails
        console.log('[MOCKUP] Falling back to base64 storage');
        const mockupDataURL = mockupState.canvas.toDataURL('image/png');
        currentOrder.mockupData = {
            mockupImage: mockupDataURL,
            tshirtColor: mockupState.tshirtColor,
            isFront: mockupState.isFront,
            designPosition: {
                x: mockupState.designX,
                y: mockupState.designY,
                width: mockupState.designWidth,
                height: mockupState.designHeight
            }
        };
        showToast('Mockup saved locally (upload failed)');
        document.getElementById('mockup-editor-section').style.display = 'none';
    }
};


// === FORM VALIDATION FUNCTIONS ===

// Note: toggleWishlist and openMyOrders are now handled by features.js
// to avoid conflicts and ensure single source of truth

// Price Range Filter
window.filterByPriceRange = function (min, max) {
    const cards = document.querySelectorAll('.product-card');
    cards.forEach(card => {
        const badge = card.querySelector('.badge');
        if (!badge) return;

        const priceText = badge.textContent.replace('₹', '').trim();
        const price = parseInt(priceText);

        if (price >= min && price <= max) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

// Update price filter with slider sync
window.updatePriceFilter = function () {
    const minSlider = document.getElementById('price-min');
    const maxSlider = document.getElementById('price-max');
    const minLabel = document.getElementById('price-min-label');
    const maxLabel = document.getElementById('price-max-label');

    let minVal = parseInt(minSlider.value);
    let maxVal = parseInt(maxSlider.value);

    // Ensure min doesn't exceed max
    if (minVal > maxVal) {
        minSlider.value = maxVal;
        minVal = maxVal;
    }

    // Update labels
    minLabel.textContent = `₹${minVal}`;
    maxLabel.textContent = `₹${maxVal}`;

    // Apply filter
    filterByPriceRange(minVal, maxVal);
}

// Language Change
const translations = {
    en: {
        login: 'Login',
        services_title: 'Categories',
        footer_tagline: 'Unique and Simple Page for Better Customer Understanding'
    },
    hi: {
        login: 'लॉगिन',
        services_title: 'श्रेणियाँ',
        footer_tagline: 'बेहतर ग्राहक समझ के लिए अनूठा और सरल पृष्ठ'
    }
};

window.changeLanguage = function (lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);

    const trans = translations[lang] || translations.en;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (trans[key]) {
            el.textContent = trans[key];
        }
    });

    showToast('Language changed to ' + (lang === 'en' ? 'English' : 'Hindi'));
}

// === FORM VALIDATION FUNCTIONS ===

// Phone validation (10 digits only)
window.validatePhone = function (input) {
    const value = input.value.replace(/\D/g, ''); // Remove non-digits
    input.value = value.substring(0, 10); // Limit to 10 digits

    const errorEl = document.getElementById('phone-error');
    if (value.length > 0 && value.length < 10) {
        errorEl.style.display = 'block';
    } else {
        errorEl.style.display = 'none';
    }
}

// Color display update
window.updateColorDisplay = function (color) {
    const colorNames = {
        '#000000': 'Black',
        '#ffffff': 'White',
        '#ff0000': 'Red',
        '#00ff00': 'Green',
        '#0000ff': 'Blue',
        '#ffff00': 'Yellow',
        '#ff00ff': 'Magenta',
        '#00ffff': 'Cyan',
        '#ffa500': 'Orange',
        '#800080': 'Purple',
        '#ffc0cb': 'Pink',
        '#808080': 'Gray',
        '#a52a2a': 'Brown'
    };

    // ============================================
    // MODAL HELPER FUNCTIONS (Essential)
    // ============================================
    window.openModal = function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            console.log('[MODAL] Opened:', modalId);
        } else {
            console.error('[MODAL] Not found:', modalId);
        }
    };

    window.closeModal = function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            console.log('[MODAL] Closed:', modalId);
        } else {
            console.error('[MODAL] Not found:', modalId);
        }
    };

    const colorInput = document.getElementById('order-color');
    colorInput.value = colorNames[color.toLowerCase()] || color;
}
