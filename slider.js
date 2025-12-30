// ============================================
// POSTER SLIDER FUNCTIONALITY (PHASE 2)
// ============================================

let posters = [];
let currentSlide = 0;
let slideInterval = null;

// Load posters from Firestore
function loadPosters() {
    if (!db) return;

    db.collection("posters").orderBy("order", "asc").onSnapshot((snapshot) => {
        posters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[SLIDER] Posters loaded:", posters.length);
        renderSlider();
        startAutoSlide();
    }, (error) => {
        console.error("[SLIDER] Error loading posters:", error);
    });
}

// Render slider content
function renderSlider() {
    const container = document.getElementById('slider-container');
    const dotsContainer = document.getElementById('slider-dots');

    if (!container || !dotsContainer) return;

    if (posters.length === 0) {
        // Default placeholder if no posters
        container.innerHTML = `
            <div class="slider-item">
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:white;">
                    <i class="ph ph-image" style="font-size:64px; margin-bottom:16px;"></i>
                    <p style="font-size:1.2rem; font-weight:600;">No Posters Available</p>
                    <p style="font-size:0.9rem; opacity:0.8;">Admin can add posters from dashboard</p>
                </div>
            </div>
        `;
        return;
    }

    // Render poster slides
    container.innerHTML = posters.map(poster => `
        <div class="slider-item">
            <img src="${poster.imageUrl}" alt="${poster.title || 'Poster'}">
        </div>
    `).join('');

    // Render dots
    dotsContainer.innerHTML = posters.map((_, idx) => `
        <div class="slider-dot ${idx === 0 ? 'active' : ''}" onclick="goToSlide(${idx})"></div>
    `).join('');

    updateSlidePosition();
}

// Update slide position
function updateSlidePosition() {
    const container = document.getElementById('slider-container');
    if (container) {
        container.style.transform = `translateX(-${currentSlide * 100}%)`;
    }

    // Update active dot
    document.querySelectorAll('.slider-dot').forEach((dot, idx) => {
        dot.classList.toggle('active', idx === currentSlide);
    });
}

// Navigate to specific slide
window.goToSlide = function (index) {
    currentSlide = index;
    updateSlidePosition();
    resetAutoSlide();
}

// Previous slide
window.slidePrevious = function () {
    currentSlide = (currentSlide - 1 + posters.length) % posters.length;
    updateSlidePosition();
    resetAutoSlide();
}

// Next slide
window.slideNext = function () {
    currentSlide = (currentSlide + 1) % posters.length;
    updateSlidePosition();
    resetAutoSlide();
}

// Auto-slide every 5 seconds
function startAutoSlide() {
    if (posters.length <= 1) return; // No need if only 1 or 0 posters

    slideInterval = setInterval(() => {
        slideNext();
    }, 5000);
}

// Reset auto-slide timer
function resetAutoSlide() {
    if (slideInterval) {
        clearInterval(slideInterval);
    }
    startAutoSlide();
}
