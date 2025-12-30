// Enhanced E-Commerce Features for Printing Business
// Features: Order Tracking, Delivery Estimation, Bulk Discounts, Re-Order, Size Chart, Reviews, Stock Management

// ============================================
// FEATURE: DELIVERY ESTIMATION
// ============================================
window.calculateDeliveryDate = function (orderDate = new Date()) {
    const deliveryDate = new Date(orderDate);
    // Add 5-7 business days (use 6 as average)
    let daysToAdd = 6;
    let addedDays = 0;

    while (addedDays < daysToAdd) {
        deliveryDate.setDate(deliveryDate.getDate() + 1);
        // Skip weekends
        if (deliveryDate.getDay() !== 0 && deliveryDate.getDay() !== 6) {
            addedDays++;
        }
    }

    return deliveryDate;
};

window.formatDeliveryDate = function (date) {
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('en-IN', options);
};

// ============================================
// FEATURE: BULK ORDER DISCOUNTS
// ============================================
const BULK_DISCOUNT_TIERS = [
    { min: 50, discount: 0.20, label: '20% off on 50+ items' },
    { min: 25, discount: 0.15, label: '15% off on 25+ items' },
    { min: 10, discount: 0.10, label: '10% off on 10+ items' }
];

window.calculateBulkDiscount = function (quantity, basePrice) {
    let discountRate = 0;
    let discountLabel = '';

    for (const tier of BULK_DISCOUNT_TIERS) {
        if (quantity >= tier.min) {
            discountRate = tier.discount;
            discountLabel = tier.label;
            break;
        }
    }

    const subtotal = quantity * basePrice;
    const discountAmount = subtotal * discountRate;
    const finalTotal = subtotal - discountAmount;

    return {
        subtotal,
        discountRate,
        discountAmount,
        finalTotal,
        discountLabel
    };
};

// Apply bulk discount to order
window.updatePriceWithDiscount = function () {
    const qtyEl = document.getElementById('order-qty');
    const priceEl = document.getElementById('total-price');

    if (!qtyEl || !priceEl || !currentOrder.basePrice) return;

    const qty = parseInt(qtyEl.value) || 1;
    currentOrder.qty = qty;

    const discount = calculateBulkDiscount(qty, currentOrder.basePrice);

    // Update display
    if (discount.discountAmount > 0) {
        priceEl.innerHTML = `
            <div style="text-align: right;">
                <div style="text-decoration: line-through; color: var(--text-muted); font-size: 0.9rem;">₹${discount.subtotal}</div>
                <div style="color: #16a34a; font-size: 0.85rem; margin: 2px 0;">${discount.discountLabel}</div>
                <div style="font-size: 1.2rem; font-weight: 700; color: var(--primary);">₹${Math.round(discount.finalTotal)}</div>
            </div>
        `;
    } else {
        priceEl.innerText = `₹${discount.subtotal}`;
    }

    currentOrder.totalAmount = Math.round(discount.finalTotal);
    currentOrder.discountApplied = discount.discountAmount;
};

// ============================================
// FEATURE: SIZE CHART MODAL
// ============================================
window.openSizeChart = function () {
    const overlay = document.getElementById('size-chart-modal');
    if (overlay) {
        overlay.classList.add('active');
    } else {
        // Create modal if doesn't exist
        createSizeChartModal();
    }
};

function createSizeChartModal() {
    const modal = document.createElement('div');
    modal.id = 'size-chart-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="bottom-sheet" style="max-width: 600px;">
            <div class="modal-header">
                <h3 class="modal-title">T-Shirt Size Guide</h3>
                <button class="close-modal" onclick="closeModal('size-chart-modal')"><i class="ph ph-x"></i></button>
            </div>
            <div style="overflow-x: auto; padding: 16px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: var(--bg-page); font-weight: 600;">
                            <th style="padding: 12px; border: 1px solid var(--card-border);">Size</th>
                            <th style="padding: 12px; border: 1px solid var(--card-border);">Chest (inches)</th>
                            <th style="padding: 12px; border: 1px solid var(--card-border);">Length (inches)</th>
                            <th style="padding: 12px; border: 1px solid var(--card-border);">Shoulder (inches)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 12px; border: 1px solid var(--card-border); font-weight: 600;">S</td>
                            <td style="padding: 12px; border: 1px solid var(--card-border);">36-38</td>
                            <td style="padding: 12px; border: 1px solid var(--card-border);">27</td>
                            <td style="padding: 12px; border: 1px solid var(--card-border);">16</td>
                        </tr>
                        <tr style="background: var(--bg-page);">
                            <td style="padding: 12px; border: 1px solid var(--card-border); font-weight: 600;">M</td>
                            <td style="padding: 12px; border: 1px solid var(--card-border);">38-40</td>
                            <td style="padding: 12px; border: 1px solid var(--card-border);">28</td>
                            <td style="padding: 12px; border: 1px solid var(--card-border);">17</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid var(--card-border); font-weight: 600;">L</td>
                            <td style="padding: 12px; border: 1px solid var(--card-border);">40-42</td>
                            <td style="padding: 12px; border: 1px solid var(--card-border);">29</td>
                            <td style="padding: 12px; border: 1px solid var(--card-border);">18</td>
                        </tr>
                        <tr style="background: var(--bg-page);">
                            <td style="padding: 12px; border: 1px solid var(--card-border); font-weight: 600;">XL</td>
                            <td style="padding: 12px; border: 1px solid var(--card-border);">42-44</td>
                            <td style="padding: 12px; border: 1px solid var(--card-border);">30</td>
                            <td style="padding: 12px; border: 1px solid var(--card-border);">19</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid var(--card-border); font-weight: 600;">XXL</td>
                            <td style="padding: 12px; border: 1px solid var(--card-border);">44-46</td>
                            <td style="padding: 12px; border: 1px solid var(--card-border);">31</td>
                            <td style="padding: 12px; border: 1px solid var(--card-border);">20</td>
                        </tr>
                    </tbody>
                </table>
                <p style="margin-top: 16px; font-size: 0.85rem; color: var(--text-muted); text-align: center;">
                    <i class="ph ph-info"></i> Measurements may vary by ±1 inch
                </p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
}

// ============================================
// FEATURE: RE-ORDER FUNCTIONALITY
// ============================================
window.reorderProduct = function (orderId) {
    if (!db) {
        showToast('Database not available');
        return;
    }

    db.collection('orders').doc(orderId).get()
        .then((doc) => {
            if (!doc.exists) {
                showToast('Order not found');
                return;
            }

            const orderData = doc.data();

            // Pre-fill order form with previous order data
            currentOrder = {
                itemId: orderData.details?.itemId || null,
                itemName: orderData.product || '',
                basePrice: orderData.totalAmount / orderData.quantity || 0,
                qty: orderData.quantity || 1,
                mockupData: orderData.mockupData || null
            };

            // Open order modal
            openModal('order-details-modal');

            // Fill form fields
            if (document.getElementById('order-product-name')) {
                document.getElementById('order-product-name').value = currentOrder.itemName;
            }
            if (document.getElementById('order-phone')) {
                document.getElementById('order-phone').value = orderData.customerPhone || '';
            }
            if (document.getElementById('order-size')) {
                document.getElementById('order-size').value = orderData.details?.size || 'M';
            }
            if (document.getElementById('order-color')) {
                document.getElementById('order-color').value = orderData.selectedColor || orderData.details?.color || 'White';
            }
            if (document.getElementById('order-quality')) {
                document.getElementById('order-quality').value = orderData.details?.quality || 'Standard';
            }
            if (document.getElementById('order-print-type')) {
                document.getElementById('order-print-type').value = orderData.details?.printType || 'Digital';
            }
            if (document.getElementById('order-qty')) {
                document.getElementById('order-qty').value = currentOrder.qty;
            }
            if (document.getElementById('order-address')) {
                document.getElementById('order-address').value = orderData.details?.address || '';
            }

            // Update total price
            if (typeof updatePrice === 'function') {
                updatePrice();
            } else if (typeof updatePriceWithDiscount === 'function') {
                updatePriceWithDiscount();
            }

            showToast('✅ Order details loaded! You can modify before placing.');
        })
        .catch((error) => {
            console.error('Re-order error:', error);
            showToast('Failed to load order details');
        });
};

// ============================================
// FEATURE: ENHANCED WHATSAPP INTEGRATION
// ============================================
window.sendWhatsAppFollowup = function (orderId, orderData) {
    if (!orderData) return;

    const phone = orderData.customerPhone || '';
    if (!phone) {
        showToast('Phone number not available');
        return;
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');

    // Format message with order details
    const message = `Hello! 👋\n\nRegarding your order *${orderId}*:\n\n📦 Product: ${orderData.product || 'N/A'}\n📊 Quantity: ${orderData.quantity || 1}\n💰 Amount: ₹${orderData.totalAmount || 0}\n📍 Status: ${orderData.orderStatus || 'Processing'}\n💳 Payment: ${orderData.paymentStatus || 'Pending'}\n\nThank you for choosing Creative Printers!\n\nNeed any help? Feel free to ask.`;

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
};

// Initialize features on page load
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[FEATURES] Enhanced e-commerce features loaded');

        // Override updatePrice if it exists to include bulk discounts
        const qtyInput = document.getElementById('order-qty');
        if (qtyInput && typeof updatePriceWithDiscount === 'function') {
            qtyInput.addEventListener('input', updatePriceWithDiscount);
        }
    });
}
