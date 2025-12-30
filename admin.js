// --- admin.js (Enhanced with comprehensive field handling) ---

// Ensure auth/db are initialized (relying on script.js primarily)
// We do NOT redeclare auth/db with 'var' or 'let' to avoid conflicts with script.js
if (typeof firebase !== 'undefined' && (typeof auth === 'undefined' || !auth)) {
    // Fallback if script.js didn't run or didn't export them
    if (firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
    }
    // Checking if auth/db are defined on window might differ from 'let' usage
    if (typeof auth === 'undefined') {
        window.auth = firebase.auth();
        window.db = firebase.firestore();
    }
}

let orders = [];
let users = [];
let filteredOrders = [];

// Storage for products (Renamed to avoid conflict with script.js)
let adminProducts = [];

document.addEventListener('DOMContentLoaded', () => {
    console.log("[ADMIN] Page loaded, checking auth...");

    // Safety timeout - force hide loader if still visible after 3 seconds
    setTimeout(() => {
        const loader = document.getElementById('loading-screen');
        if (loader && loader.style.display !== 'none') {
            console.warn("[ADMIN] Safety timeout reached, force hiding loader");
            hideLoadingScreen();
        }
    }, 3000);

    // Check for pending admin login from sessionStorage
    const adminLoginPending = sessionStorage.getItem('adminLoginPending');
    const adminEmail = sessionStorage.getItem('adminEmail');

    if (adminLoginPending === 'true' && adminEmail === 'faroofalam@gmail.com') {
        console.log("[ADMIN] Admin login pending, waiting for auth state...");
        // Clear the flag immediately
        sessionStorage.removeItem('adminLoginPending');
        sessionStorage.removeItem('adminEmail');

        // Show success message
        showToast('✅ Admin Login Successfully!');

        // Single auth check with proper timeout
        const authTimeout = setTimeout(() => {
            console.error("[ADMIN] Auth state timeout");
            hideLoadingScreen();
            showToast('Please wait, loading dashboard...');
        }, 2000);

        auth.onAuthStateChanged((user) => {
            clearTimeout(authTimeout);
            console.log("[ADMIN] Auth state:", user ? user.email : "No user");

            if (user && user.email === 'faroofalam@gmail.com') {
                console.log("[ADMIN] ✅ Admin authenticated");
                hideLoadingScreen();
                initDashboard();
            } else {
                console.warn("[ADMIN] Auth failed");
                hideLoadingScreen();
                showToast('Authentication failed');
                setTimeout(() => window.location.href = 'index.html', 1500);
            }
        });
        return;
    }

    // Auth Guard - check if already authenticated
    const currentAuthUser = auth.currentUser;
    if (currentAuthUser) {
        console.log("[ADMIN] User already authenticated:", currentAuthUser.email);
        if (currentAuthUser.email === 'faroofalam@gmail.com') {
            console.log("[ADMIN] ✅ Admin verified");
            hideLoadingScreen();
            initDashboard();
        } else {
            console.warn("[ADMIN] Unauthorized:", currentAuthUser.email);
            hideLoadingScreen();
            showToast('Access Denied: Admins Only');
            setTimeout(() => window.location.href = 'index.html', 1500);
        }
        return;
    }

    // Wait for auth state if not already authenticated
    console.log("[ADMIN] Waiting for authentication...");
    auth.onAuthStateChanged((user) => {
        console.log("[ADMIN] Auth state:", user ? user.email : "No user");

        if (!user) {
            console.warn("[ADMIN] No user");
            hideLoadingScreen();
            showToast('Please Login First');
            setTimeout(() => window.location.href = 'index.html', 1500);
            return;
        }

        if (user.email !== 'faroofalam@gmail.com') {
            console.warn("[ADMIN] Unauthorized:", user.email);
            hideLoadingScreen();
            showToast('Access Denied: Admins Only');
            setTimeout(() => window.location.href = 'index.html', 1500);
            return;
        }

        console.log("[ADMIN] ✅ Admin authenticated");
        hideLoadingScreen();
        initDashboard();
    });

    // Apply saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    }
});

function hideLoadingScreen() {
    const loader = document.getElementById('loading-screen');
    if (loader) {
        console.log("[ADMIN] 🚀 HIDING LOADING SCREEN");
        loader.style.display = 'none';
        loader.style.opacity = '0';
        loader.style.visibility = 'hidden';
        loader.classList.add('hidden');
    }
}

function initDashboard() {
    console.log("[ADMIN] ========================================");
    console.log("[ADMIN] Initializing dashboard...");
    console.log("[ADMIN] Auth user:", auth.currentUser ? auth.currentUser.email : "None");
    console.log("[ADMIN] Firestore:", db ? "Connected" : "Not connected");
    console.log("[ADMIN] ========================================");

    // Load Products (Renamed to avoid conflict)
    loadAdminProducts();

    // Load Posters for slider management
    if (typeof loadAdminPosters === 'function') {
        loadAdminPosters();
    }

    // Auto-migrate products if collection is empty
    db.collection("products").limit(1).get()
        .then((snapshot) => {
            if (snapshot.empty) {
                console.log("[ADMIN] Products collection empty - running migration");
                showToast("Migrating products to database...");
                migrateProducts();
            } else {
                console.log("[ADMIN] Products already exist in database");
            }
        })
        .catch((e) => {
            console.error("[ADMIN] Product migration check error:", e);
        });

    // CRITICAL: Fetch orders WITHOUT orderBy first (orderBy needs Firestore index)
    console.log("[ADMIN] Fetching orders collection...");

    db.collection("orders")
        .onSnapshot((snapshot) => {
            console.log("[ADMIN] ===== ORDERS SNAPSHOT =====");
            console.log("[ADMIN] Snapshot received");
            console.log("[ADMIN] Size:", snapshot.size);
            console.log("[ADMIN] Empty:", snapshot.empty);

            if (snapshot.empty) {
                console.warn("[ADMIN] ⚠️  No orders found in database");
                console.warn("[ADMIN] This could mean:");
                orders = [];
                filteredOrders = [];
            } else {
                console.log("[ADMIN] ✅ Orders found, processing...");
                orders = snapshot.docs.map(doc => {
                    const data = doc.data();
                    // Normalize field names
                    return {
                        id: doc.id,
                        customerName: data.customerName || 'Guest',
                        customerPhone: data.customerPhone || data.phone || 'N/A',
                        customerEmail: data.customerEmail || data.email || '',
                        product: data.product || data.item || 'N/A',
                        item: data.item || data.product || 'N/A',
                        printType: data.printType || 'Standard',
                        quantity: data.quantity || data.qty || 1,
                        qty: data.qty || data.quantity || 1,
                        totalAmount: data.totalAmount || data.price || 0,
                        paymentStatus: data.paymentStatus || data.status || 'PENDING',
                        paymentMode: data.paymentMode || 'ONLINE',
                        orderStatus: data.orderStatus || data.status || 'ORDER_PLACED',
                        status: data.status || data.orderStatus || 'ORDER_PLACED',
                        createdAt: data.createdAt || data.date || null,
                        loginType: data.loginType || data.userType || 'guest',
                        userId: data.userId || 'guest',
                        details: data.details || {},
                        mockupData: data.mockupData || null,
                        orderId: data.orderId || null,
                        estimatedDelivery: data.estimatedDelivery || null,
                        discountApplied: data.discountApplied || 0
                    };
                });

                // Sort by createdAt (newest first)
                orders.sort((a, b) => {
                    if (!a.createdAt) return 1;
                    if (!b.createdAt) return -1;
                    const timeA = a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
                    const timeB = b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
                    return timeB - timeA;
                });

                filteredOrders = [...orders];
                console.log("[ADMIN] ✅ Total orders loaded:", orders.length);
            }

            renderStats();
            renderOrders();

        }, (error) => {
            console.error("[ADMIN] ❌ ORDERS FETCH ERROR!", error);
            if (error.code === 'permission-denied') {
                showToast("Permission Denied! Update Firestore Rules");
                alert("🚨 FIRESTORE PERMISSION ERROR!\\n\\nAdmin cannot read orders.");
            } else {
                showToast("Error: " + error.message);
            }
            orders = [];
            filteredOrders = [];
            renderStats();
            renderOrders();
        });

    // Users collection
    db.collection("users")
        .onSnapshot((snapshot) => {
            console.log("[ADMIN] Users snapshot:", snapshot.size, "documents");
            users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderUsers();
        }, (error) => {
            console.log("[ADMIN] Users error (optional):", error.message);
        });
}

function renderStats() {
    setText('stat-total', orders.length);

    const pendingCount = orders.filter(o =>
        o.paymentStatus === 'PENDING' || o.status === 'pending' || o.status === 'Pending'
    ).length;
    setText('stat-pending', pendingCount);

    const paidCount = orders.filter(o =>
        o.paymentStatus === 'PAID' || o.paymentStatus === 'paid'
    ).length;
    setText('stat-paid', paidCount);

    const revenue = orders.reduce((acc, c) => acc + (c.totalAmount || c.price || 0), 0);
    setText('stat-revenue', '₹' + revenue);
    setText('stat-customers', users.length);

    // Today's orders
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaysOrders = orders.filter(o => {
        if (!o.createdAt) return false;
        const orderDate = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === today.getTime();
    }).length;
    setText('stat-today', todaysOrders);

    // Recent Orders Table
    const recent = filteredOrders.slice(0, 5);
    const tbody = document.querySelector('#recent-orders-table tbody');
    if (tbody) {
        if (recent.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--text-muted)">📦 No orders yet</td></tr>';
        } else {
            tbody.innerHTML = recent.map(o => `
                <tr>
                    <td>#CP-${o.id.slice(-6).toUpperCase()}</td>
                    <td>${o.customerPhone || 'N/A'}</td>
                    <td>₹${o.totalAmount || 0}</td>
                    <td><span class="payment-badge payment-badge-${o.paymentStatus}">${o.paymentStatus || 'PENDING'}</span></td>
                    <td><span class="status-badge status-${o.orderStatus}">${o.orderStatus || 'ORDER_PLACED'}</span></td>
                    <td>${formatDate(o.createdAt)}</td>
                </tr>
            `).join('');
        }
    }
}

function renderOrders() {
    const tbody = document.querySelector('#all-orders-table tbody');
    if (!tbody) return;

    if (filteredOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:40px; color:var(--text-muted)">📦 No orders found</td></tr>';
    } else {
        tbody.innerHTML = filteredOrders.map(o => {
            const hasMockupData = !!(o.mockupData && o.mockupData.mockupImage);
            const displayOrderId = o.orderId || `PX-2025-${o.id.slice(-6).toUpperCase()}`;
            const deliveryEstimate = o.estimatedDelivery || 'N/A';

            return `
            <tr>
                <td style="font-weight:600">${displayOrderId}</td>
                <td>
                    <div>${o.customerName || 'Guest'}</div>
                    <div style="font-size:0.8em; color:var(--text-muted)">${o.customerPhone || o.customerEmail || ''}</div>
                </td>
                <td>${o.product || o.item || 'N/A'} (x${o.quantity || o.qty || 1})</td>
                <td style="font-size:0.85em;">
                    ${(o.details && o.details.quality) || 'N/A'}, ${(o.details && o.details.size) || 'N/A'}
                </td>
                <td>
                    ${hasMockupData
                    ? `<div>
                            <img src="${o.mockupData.mockupImage}" alt="Mockup" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 2px solid #ddd;" title="Customer Mockup">
                            <div style="font-size: 0.7rem; margin-top: 4px;">   
                                <span style="display: inline-block; width: 12px; height: 12px; background: ${o.mockupData.tshirtColor || '#fff'}; border: 1px solid #999; border-radius: 2px; vertical-align: middle;"></span>
                                ${o.mockupData.isFront ? 'Front' : 'Back'}
                            </div>
                          </div>`
                    : `<div style="color: var(--text-muted); font-size: 0.75rem;">
                            <div>No mockup</div>
                      </div>`
                }
                </td>
                <td style="font-weight:600">
                    ₹${o.totalAmount || 0}
                    ${o.discountApplied > 0 ? `<div style="font-size: 0.7rem; color: #16a34a;">-₹${Math.round(o.discountApplied)} saved</div>` : ''}
                </td>
                <td><span class="payment-badge payment-badge-${o.paymentStatus}">${o.paymentStatus || 'PENDING'}</span></td>
                <td><span class="payment-mode-badge">${o.paymentMode || 'ONLINE'}</span></td>
                <td><span class="status-badge status-${o.orderStatus}">${o.orderStatus || 'ORDER_PLACED'}</span></td>
                <td>
                    <div>${formatDate(o.createdAt)}</div>
                    ${deliveryEstimate !== 'N/A' ? `<div style="font-size: 0.7rem; color: var(--text-muted);">📦 ${deliveryEstimate}</div>` : ''}
                </td>
                <td>
                    <div style="display: flex; gap: 4px; align-items: center;">
                        <button class="icon-btn" onclick="openEditModal('${o.id}', '${o.orderStatus || 'ORDER_PLACED'}', '${o.paymentStatus || 'PENDING'}')" title="Edit Order">
                            <i class="ph ph-pencil-simple"></i>
                        </button>
                        ${o.originalDesignUrl ?
                    `<a href="${o.originalDesignUrl}" target="_blank" class="icon-btn" title="Download Original Design" style="color: #2563eb;">
                                <i class="ph ph-download-simple"></i>
                             </a>` : ''
                }
                        <button class="icon-btn" onclick="sendWhatsAppFollowup('${displayOrderId}', ${JSON.stringify(o).replace(/"/g, '&quot;')})" title="WhatsApp Follow-up" style="color: #25D366;">
                            <i class="ph ph-whatsapp-logo"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        }).join('');
    }
}

function renderUsers() {
    const tbody = document.querySelector('#customers-table tbody');
    if (tbody) {
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:40px; color:var(--text-muted)">No registered users</td></tr>';
        } else {
            tbody.innerHTML = users.map(u => `
                <tr>
                    <td>${u.name || 'Guest'}</td>
                    <td>${u.email || u.phone || 'N/A'}</td>
                    <td>${u.phone || 'N/A'}</td>
                    <td>${formatDate(u.lastLogin || u.joined)}</td>
                </tr>
            `).join('');
        }
    }
}

window.filterOrders = function () {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const paymentFilter = document.getElementById('filter-payment').value;
    const orderFilter = document.getElementById('filter-order').value;

    filteredOrders = orders.filter(o => {
        const matchesSearch = !searchTerm ||
            o.id.toLowerCase().includes(searchTerm) ||
            (o.customerPhone && o.customerPhone.includes(searchTerm));

        const matchesPayment = !paymentFilter || o.paymentStatus === paymentFilter;
        const matchesOrder = !orderFilter || o.orderStatus === orderFilter;

        return matchesSearch && matchesPayment && matchesOrder;
    });

    renderOrders();
    renderStats();
}

window.openWhatsApp = function (phone) {
    if (!phone || phone === 'N/A') return showToast('Phone not available');
    const clean = phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${clean}`, '_blank');
}

window.copyPhone = function (phone) {
    if (!phone || phone === 'N/A') return showToast('Phone not available');
    navigator.clipboard.writeText(phone)
        .then(() => showToast('Phone copied!'))
        .catch(() => showToast('Failed to copy'));
}

window.exportCSV = function () {
    if (orders.length === 0) return showToast('No orders to export');
    const headers = ['Order ID', 'Phone', 'Product', 'Print Type', 'Qty', 'Amount', 'Payment', 'Mode', 'Order Status', 'Date'];
    const rows = orders.map(o => [
        `CP-${o.id.slice(-6).toUpperCase()}`,
        o.customerPhone || 'N/A',
        o.product || o.item || 'N/A',
        o.printType || 'Standard',
        o.quantity || o.qty || 1,
        o.totalAmount || 0,
        o.paymentStatus || 'PENDING',
        o.paymentMode || 'ONLINE',
        o.orderStatus || 'ORDER_PLACED',
        formatDate(o.createdAt)
    ]);
    let csv = headers.join(',') + '\\n' + rows.map(r => r.join(',')).join('\\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('CSV Exported!');
}

window.openEditModal = function (id, orderStatus, paymentStatus) {
    document.getElementById('edit-order-id').value = id;
    document.getElementById('edit-order-status').value = orderStatus || 'ORDER_PLACED';
    document.getElementById('edit-payment-status').value = paymentStatus || 'PENDING';
    document.getElementById('edit-modal').classList.add('active');
}

window.saveOrderChanges = function () {
    const id = document.getElementById('edit-order-id').value;
    const orderStatus = document.getElementById('edit-order-status').value;
    const paymentStatus = document.getElementById('edit-payment-status').value;

    db.collection("orders").doc(id).update({
        orderStatus: orderStatus,
        paymentStatus: paymentStatus
    })
        .then(() => {
            closeModal('edit-modal');
            showToast('Order Updated!');
        })
        .catch(e => {
            console.error(e);
            showToast('Update failed: ' + e.message);
        });
}

window.switchTab = function (tab) {
    ['overview', 'orders', 'customers', 'products', 'posters'].forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        if (el) el.style.display = 'none';
    });
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const target = document.getElementById(`tab-${tab}`);
    if (target) target.style.display = 'block';
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
}

window.handleLogout = function () {
    if (confirm('Logout?')) {
        auth.signOut().then(() => {
            showToast('Logged out');
            setTimeout(() => window.location.href = 'index.html', 1000);
        });
    }
}

window.toggleTheme = function () {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
}

function formatDate(ts) {
    if (!ts) return '-';
    // If it's a Firestore Timestamp, convert it
    const d = (ts && typeof ts.toDate === 'function') ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
    else console.warn("[ADMIN] Element not found:", id);
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function showToast(msg) {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast show';
    t.innerText = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// ============================================
// PRODUCT MANAGEMENT
// ============================================
// Renamed to loadAdminProducts to avoid conflict with script.js loadProducts
function loadAdminProducts() {
    console.log("[ADMIN] Loading products from Firestore...");
    db.collection("products").onSnapshot((snapshot) => {
        adminProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[ADMIN] Products loaded:", adminProducts.length);
        renderAdminProducts();
    }, (error) => {
        console.error("[ADMIN] Products load error:", error);
        showToast("Error loading products: " + error.message);
    });
}

function renderAdminProducts() {
    const tbody = document.querySelector('#products-table tbody');
    if (!tbody) return;

    tbody.innerHTML = adminProducts.map(p => `
        <tr>
            <td>
                ${p.image ? `<img src="${p.image}" alt="${p.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">` : `<i class="ph ph-image" style="font-size: 40px; color: var(--text-muted);"></i>`}
            </td>
            <td style="font-weight: 600;">${p.name || 'N/A'}</td>
            <td style="text-transform: capitalize;">${p.category || 'N/A'}</td>
            <td style="font-weight: 600;">₹${p.price || 0}</td>
            <td>
                ${(p.colors && p.colors.length > 0) ?
            p.colors.map(c => `<span style="display: inline-block; width: 20px; height: 20px; border-radius: 50%; background: ${c}; margin-right: 4px; border: 1px solid #ddd;"></span>`).join('')
            : '<span style="color: var(--text-muted);">N/A</span>'}
            </td>
            <td>
                <span style="padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; ${p.inStock ? 'background: #d1fae5; color: #059669;' : 'background: #fee2e2; color: #dc2626;'}">${p.inStock ? 'In Stock' : 'Out of Stock'}</span>
            </td>
            <td>
                <button class="icon-btn" onclick="editProduct('${p.id}')" title="Edit"><i class="ph ph-pencil-simple"></i></button>
                <button class="icon-btn" onclick="deleteProduct('${p.id}')" title="Delete" style="color: #dc2626;"><i class="ph ph-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

window.previewProductImage = function (input) {
    const preview = document.getElementById('product-image-preview');
    const previewImg = document.getElementById('product-preview-img');

    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            previewImg.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.openProductModal = function (productId = null) {
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('product-modal-title');
    const preview = document.getElementById('product-image-preview');
    const previewImg = document.getElementById('product-preview-img');

    if (productId) {
        // Search in adminProducts
        const product = adminProducts.find(p => p.id === productId);
        if (product) {
            title.innerText = 'Edit Product';
            document.getElementById('product-id').value = product.id;
            document.getElementById('product-name').value = product.name || '';
            document.getElementById('product-category').value = product.category || 'tshirts';
            document.getElementById('product-price').value = product.price || '';
            document.getElementById('product-description').value = product.description || '';
            document.getElementById('product-image').value = product.image || '';
            document.getElementById('product-colors').value = (product.colors || []).join(', ');
            document.getElementById('product-instock').checked = product.inStock !== false;

            if (product.image) {
                previewImg.src = product.image;
                preview.style.display = 'block';
            } else {
                preview.style.display = 'none';
            }
        }
    } else {
        title.innerText = 'Add Product';
        document.getElementById('product-id').value = '';
        document.getElementById('product-name').value = '';
        document.getElementById('product-category').value = 'tshirts';
        document.getElementById('product-price').value = '';
        document.getElementById('product-description').value = '';
        document.getElementById('product-image').value = '';
        document.getElementById('product-colors').value = '';
        document.getElementById('product-instock').checked = true;
        document.getElementById('product-image-file').value = '';
        preview.style.display = 'none';
    }

    modal.classList.add('active');
}

window.editProduct = function (productId) {
    openProductModal(productId);
}

window.deleteProduct = async function (productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
        await db.collection("products").doc(productId).delete();
        showToast('Product deleted successfully');
    } catch (error) {
        console.error("[ADMIN] Delete product error:", error);
        showToast('Error deleting product: ' + error.message);
    }
}

window.saveProduct = async function () {
    const id = document.getElementById('product-id').value;
    const name = document.getElementById('product-name').value.trim();
    const category = document.getElementById('product-category').value;
    const price = parseFloat(document.getElementById('product-price').value) || 0;
    const description = document.getElementById('product-description').value.trim();
    const colorsRaw = document.getElementById('product-colors').value.trim();
    const colors = colorsRaw ? colorsRaw.split(',').map(c => c.trim()).filter(c => c) : [];
    const inStock = document.getElementById('product-instock').checked;

    if (!name) return showToast('Product name is required');

    const imageFile = document.getElementById('product-image-file').files[0];
    let imageUrl = document.getElementById('product-image').value.trim();

    if (imageFile) {
        showToast('Uploading image to cloud...');
        try {
            const formData = new FormData();
            formData.append('image', imageFile);
            formData.append('key', '1a28c6bc9aed175908ea7b66ee2f7404');
            const response = await fetch('https://api.imgbb.com/1/upload', {
                method: 'POST', body: formData
            });
            const result = await response.json();
            if (result.success) {
                imageUrl = result.data.display_url;
                showToast('✅ Image uploaded successfully!');
            } else {
                throw new Error('ImgBB upload failed');
            }
        } catch (error) {
            console.error('[ADMIN] Image upload error:', error);
            showToast('❌ Image upload failed. Proceeding without image.');
        }
    }

    const productData = {
        name, category, price, description, image: imageUrl, colors, inStock,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (id) {
            await db.collection("products").doc(id).update(productData);
            showToast('Product updated successfully');
        } else {
            productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection("products").add(productData);
            showToast('Product added successfully');
        }
        closeModal('product-modal');
    } catch (error) {
        console.error("[ADMIN] Save product error:", error);
        showToast('Error saving product: ' + error.message);
    }
}

async function migrateProducts() {
    const existingProducts = [
        { id: 't1', name: 'Sports T-Shirt', category: 'tshirts', price: 350, description: 'Breathable dry-fit fabric for active sports', image: 'images/sports_tshirt.png', colors: ['#0000FF', '#FFFFFF', '#000000'], inStock: true },
        { id: 't2', name: 'Staff T-Shirt', category: 'tshirts', price: 300, description: 'Professional uniforms for company events', image: '', colors: ['#000080', '#FFFFFF'], inStock: true },
        { id: 't3', name: 'School Uniform', category: 'tshirts', price: 250, description: 'Durable cotton blend for daily wear', image: '', colors: ['#FFFFFF', '#ADD8E6'], inStock: true },
        { id: 't4', name: 'Custom Printed T-Shirt', category: 'tshirts', price: 400, description: 'Your design, high-quality digital print', image: '', colors: ['#FFFFFF', '#000000', '#FF0000'], inStock: true },
        { id: 'c1', name: 'Mug', category: 'corporate', price: 200, description: 'Ceramic mugs with company branding', image: '', colors: ['#FFFFFF'], inStock: true },
        { id: 'c2', name: 'Diary', category: 'corporate', price: 400, description: 'Premium leather-finish executive diaries', image: '', colors: ['#8B4513', '#000000'], inStock: true },
        { id: 'c3', name: 'Pen', category: 'corporate', price: 120, description: 'Metal pens with laser engraving', image: '', colors: ['#C0C0C0', '#FFD700'], inStock: true },
        { id: 'c4', name: 'Keychain', category: 'corporate', price: 80, description: 'Custom shapes in metal or acrylic', image: '', colors: ['#C0C0C0'], inStock: true },
        { id: 'c5', name: 'Badge', category: 'corporate', price: 50, description: 'Pin badges for events and staff', image: '', colors: [], inStock: true },
        { id: 'c6', name: 'Flag', category: 'corporate', price: 500, description: 'Table and outdoor flags with stand', image: '', colors: [], inStock: true },
        { id: 'c7', name: 'ID Card & Lanyard', category: 'corporate', price: 150, description: 'Complete identity solution', image: '', colors: [], inStock: true },
        { id: 'p1', name: 'Photo Frame', category: 'personalized', price: 499, description: 'Preserve memories with elegance', image: '', colors: ['#8B4513', '#C0C0C0'], inStock: true },
        { id: 'p2', name: 'Personalized Mug', category: 'personalized', price: 350, description: 'Your photo on a premium ceramic mug', image: '', colors: ['#FFFFFF'], inStock: true },
        { id: 'p3', name: 'Cushion', category: 'personalized', price: 600, description: 'Soft cushions with custom photo print', image: '', colors: [], inStock: true },
        { id: 'p4', name: 'Customized Gifts', category: 'personalized', price: 800, description: 'Unique gift hampers for any occasion', image: '', colors: [], inStock: true }
    ];

    const batch = db.batch();
    for (const product of existingProducts) {
        const docRef = db.collection("products").doc(product.id);
        batch.set(docRef, { ...product, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    }

    try {
        await batch.commit();
        console.log("[ADMIN] Migration completed: Products added to Firestore");
        showToast('Products migrated successfully!');
    } catch (error) {
        console.error("[ADMIN] Migration error:", error);
        showToast('Migration failed: ' + error.message);
    }
}
