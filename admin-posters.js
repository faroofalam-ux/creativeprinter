/*  ============================================
    ADMIN POSTER MANAGEMENT (Phase 2)
    Add this code to the end of admin.js
    ============================================ */

let adminPosters = [];

// Load posters in admin dashboard
function loadAdminPosters() {
    console.log("[ADMIN] Loading posters...");
    db.collection("posters").orderBy("order", "asc").onSnapshot((snapshot) => {
        adminPosters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[ADMIN] Posters loaded:", adminPosters.length);
        renderAdminPosters();
    }, (error) => {
        console.error("[ADMIN] Posters load error:", error);
        showToast("Error loading posters: " + error.message);
    });
}

function renderAdminPosters() {
    const tbody = document.querySelector('#posters-table');
    if (!tbody) return;

    if (adminPosters.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--text-muted)">No posters added yet</td></tr>';
        return;
    }

    tbody.innerHTML = adminPosters.map(p => `
        <tr>
            <td>
                <img src="${p.imageUrl}" alt="${p.title || 'Poster'}" style="width: 80px; height: 50px; object-fit: cover; border-radius: 8px;">
            </td>
            <td style="font-weight: 600;">${p.title || 'Untitled'}</td>
            <td>${p.order || 1}</td>
            <td><span style="padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; background: #d1fae5; color: #059669;">Active</span></td>
            <td>
                <button class="icon-btn" onclick="editPoster('${p.id}')" title="Edit"><i class="ph ph-pencil-simple"></i></button>
                <button class="icon-btn" onclick="deletePoster('${p.id}')" title="Delete" style="color: #dc2626;"><i class="ph ph-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

window.previewPosterImage = function (input) {
    const preview = document.getElementById('poster-image-preview');
    const previewImg = document.getElementById('poster-preview-img');

    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            previewImg.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.openPosterModal = function (posterId = null) {
    const modal = document.getElementById('poster-modal');
    const title = document.getElementById('poster-modal-title');
    const preview = document.getElementById('poster-image-preview');

    if (posterId) {
        const poster = adminPosters.find(p => p.id === posterId);
        if (poster) {
            title.innerText = 'Edit Poster';
            document.getElementById('poster-id').value = poster.id;
            document.getElementById('poster-title').value = poster.title || '';
            document.getElementById('poster-order').value = poster.order || 1;
            if (poster.imageUrl) {
                document.getElementById('poster-preview-img').src = poster.imageUrl;
                preview.style.display = 'block';
            }
        }
    } else {
        title.innerText = 'Add New Poster';
        document.getElementById('poster-id').value = '';
        document.getElementById('poster-title').value = '';
        document.getElementById('poster-order').value = (adminPosters.length + 1);
        document.getElementById('poster-image-file').value = '';
        preview.style.display = 'none';
    }

    modal.classList.add('active');
}

window.editPoster = function (posterId) {
    openPosterModal(posterId);
}

window.deletePoster = async function (posterId) {
    if (!confirm('Are you sure you want to delete this poster?')) return;
    try {
        await db.collection("posters").doc(posterId).delete();
        showToast('Poster deleted successfully');
    } catch (error) {
        console.error("[ADMIN] Delete poster error:", error);
        showToast('Error deleting poster: ' + error.message);
    }
}

window.savePoster = async function () {
    const id = document.getElementById('poster-id').value;
    const title = document.getElementById('poster-title').value.trim();
    const order = parseInt(document.getElementById('poster-order').value) || 1;
    const imageFile = document.getElementById('poster-image-file').files[0];

    let imageUrl = '';

    if (id && !imageFile) {
        // Editing existing, no new image
        const existingPoster = adminPosters.find(p => p.id === id);
        imageUrl = existingPoster?.imageUrl || '';
    } else if (imageFile) {
        // Upload new image to ImgBB
        showToast('Uploading poster image...');
        try {
            const formData = new FormData();
            formData.append('image', imageFile);
            formData.append('key', '1a28c6bc9aed175908ea7b66ee2f7404');

            const response = await fetch('https://api.imgbb.com/1/upload', {
                method: 'POST',
                body: formData
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
            showToast('❌ Image upload failed');
            return;
        }
    } else {
        showToast('Please select an image');
        return;
    }

    const posterData = {
        title,
        order,
        imageUrl,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (id) {
            await db.collection("posters").doc(id).update(posterData);
            showToast('Poster updated successfully');
        } else {
            posterData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection("posters").add(posterData);
            showToast('Poster added successfully');
        }
        closeModal('poster-modal');
    } catch (error) {
        console.error("[ADMIN] Save poster error:", error);
        showToast('Error saving poster: ' + error.message);
    }
}

// Call loadAdminPosters in initDashboard
// Add this line to the initDashboard function in admin.js:
// loadAdminPosters();
