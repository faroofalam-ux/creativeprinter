// === NEW FEATURES ===

// 1. PDF Catalog Viewer
window.viewPDF = function (filename) {
    // Open PDF in new tab for viewing
    window.open(`pdfs/${filename}`, '_blank');
    closeModal('pdf-catalog-modal');
}

// 2. Wishlist Management
let wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');

window.toggleWishlist = function (productId, productName, productPrice) {
    console.log('[WISHLIST] Toggle called:', productId, productName, productPrice);

    const index = wishlist.findIndex(item => item.id === productId);

    if (index === -1) {
        // Add to wishlist
        wishlist.push({ id: productId, name: productName, price: productPrice });
        showToast('❤️ Added to Wishlist');
    } else {
        // Remove from wishlist
        wishlist.splice(index, 1);
        showToast('Removed from Wishlist');
    }

    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    console.log('[WISHLIST] Updated. Total items:', wishlist.length);
    updateWishlistUI();

    // Also update wishlist container if modal is open
    const container = document.getElementById('wishlist-container');
    if (container && document.getElementById('wishlist-modal').classList.contains('active')) {
        renderWishlistModal();
    }
}

window.openWishlist = function () {
    openModal('wishlist-modal');
    renderWishlistModal();
}

function renderWishlistModal() {
    const container = document.getElementById('wishlist-container');
    if (!container) {
        console.error('[WISHLIST] Container not found');
        return;
    }

    if (wishlist.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-muted)">💔 Your wishlist is empty</p>';
    } else {
        container.innerHTML = wishlist.map(item => `
            <div class="wishlist-item" style="display:flex; justify-content:space-between; align-items:center; padding:16px; border-bottom:1px solid var(--card-border); background: var(--bg-container); margin-bottom: 8px; border-radius: 8px;">
                <div>
                    <h5 style="margin:0 0 4px 0;">${item.name}</h5>
                    <p style="color:var(--primary); font-weight:600; margin:0;">₹${item.price}</p>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="small-buy-btn" onclick="initiateOrder('${item.id}', '${escapeHtml(item.name)}', ${item.price}); closeModal('wishlist-modal');" style="padding: 8px 16px;">Order Now</button>
                    <button class="icon-btn" onclick="toggleWishlist('${item.id}', '${escapeHtml(item.name)}', ${item.price})" style="color:#ef4444;" title="Remove from wishlist">
                        <i class="ph-fill ph-heart"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
}

function updateWishlistUI() {
    // Update heart icons on product cards to show filled/unfilled state
    document.querySelectorAll('.product-card').forEach(card => {
        const onclick = card.getAttribute('onclick');
        if (onclick) {
            const matches = onclick.match(/initiateOrder\('([^']+)',/);
            if (matches) {
                const productId = matches[1];
                const favIcon = card.querySelector('.fav-icon i');
                if (favIcon) {
                    const isInWishlist = wishlist.some(item => item.id === productId);
                    if (isInWishlist) {
                        favIcon.className = 'ph-fill ph-heart';
                        favIcon.parentElement.style.color = '#ef4444';
                        favIcon.parentElement.style.opacity = '1';
                    } else {
                        favIcon.className = 'ph ph-heart';
                        favIcon.parentElement.style.color = '';
                    }
                }
            }
        }
    });

    console.log('[WISHLIST] UI updated. Total items:', wishlist.length);
}

// 3. My Orders Functionality
window.openMyOrders = async function () {
    if (!currentUser) {
        showToast('Please login to view orders');
        return openModal('login-modal');
    }

    // Use correct container ID from HTML
    const container = document.getElementById('orders-container');
    if (!container) {
        console.error('[MY ORDERS] Container not found');
        showToast('My Orders feature loading...');
        return;
    }

    container.innerHTML = '<p style="text-align:center; padding:20px;">Loading orders...</p>';
    openModal('my-orders-modal');

    try {
        console.log('[MY ORDERS] Fetching orders for user:', currentUser.phoneNumber || currentUser.email);

        // Query by customerPhone (phone or email)
        const customerIdentifier = currentUser.phoneNumber || currentUser.email;

        const snapshot = await db.collection('orders')
            .where('customerPhone', '==', customerIdentifier)
            .get();

        console.log('[MY ORDERS] Query complete. Found:', snapshot.size, 'orders');

        if (snapshot.empty) {
            container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-muted)">📦 No orders found</p>';
        } else {
            const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Sort by createdAt descending
            orders.sort((a, b) => {
                if (!a.createdAt) return 1;
                if (!b.createdAt) return -1;
                return b.createdAt.toDate() - a.createdAt.toDate();
            });

            container.innerHTML = orders.map(order => `
                <div class="order-item" style="padding:16px; border-bottom:1px solid var(--card-border); background: var(--bg-container); margin-bottom: 8px; border-radius: 8px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                        <strong style="color:var(--primary);">${order.orderId || '#CP-' + order.id.slice(-6).toUpperCase()}</strong>
                        <span class="status-badge status-${order.orderStatus}">${order.orderStatus || 'ORDER_PLACED'}</span>
                    </div>
                    <p style="margin:4px 0;"><strong>${order.product}</strong> x ${order.quantity}</p>
                    <p style="margin:4px 0; font-size:0.9rem; color:var(--text-muted);">
                        ${order.createdAt ? new Date(order.createdAt.toDate()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                    </p>
                    <p style="margin:4px 0; color:var(--primary); font-weight:600;">₹${order.totalAmount}</p>
                    <p style="margin:4px 0; font-size: 0.85rem;">
                        Payment: <span class="payment-badge payment-badge-${order.paymentStatus}">${order.paymentStatus || 'PENDING'}</span>
                    </p>
                    ${order.estimatedDelivery ? `<p style="margin:4px 0; font-size: 0.85rem; color:var(--text-muted);">📦 ${order.estimatedDelivery}</p>` : ''}
                </div>
            `).join('');

            console.log('[MY ORDERS] Rendered', orders.length, 'orders');
        }
    } catch (error) {
        console.error('[MY ORDERS] Error fetching orders:', error);
        container.innerHTML = '<p style="text-align:center; padding:20px; color:#ef4444;">⚠️ Error loading orders. Please try again.</p>';
        showToast('Error loading orders');
    }
}

// Initialize wishlist UI on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(updateWishlistUI, 500);
    });
} else {
    setTimeout(updateWishlistUI, 500);
}
