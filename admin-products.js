// Admin Product Management Features

// Product Image Upload to Firebase Storage
window.uploadProductImage = async function (productId, fileInput) {
    if (!fileInput.files || !fileInput.files[0]) {
        showToast('Please select an image');
        return null;
    }

    const file = fileInput.files[0];

    // Validate file type
    if (!file.type.match('image.*')) {
        showToast('Please select a valid image file');
        return null;
    }

    try {
        const storageRef = firebase.storage().ref();
        const imageRef = storageRef.child(`products/${productId}/${Date.now()}_${file.name}`);

        showToast('Uploading image...');

        // Upload file
        const snapshot = await imageRef.put(file);

        // Get download URL
        const downloadURL = await snapshot.ref.getDownloadURL();

        showToast('Image uploaded successfully!');
        return downloadURL;

    } catch (error) {
        console.error('Upload error:', error);
        showToast('Upload failed: ' + error.message);
        return null;
    }
}

// Update product with new image
window.updateProductImage = async function (productId) {
    const fileInput = document.getElementById('product-image-upload');
    const imageURL = await uploadProductImage(productId, fileInput);

    if (imageURL) {
        // Update product in database
        try {
            await db.collection('products').doc(productId).update({
                imageURL: imageURL,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            showToast('Product image updated!');

            // Show preview
            const preview = document.getElementById('image-preview');
            if (preview) {
                preview.src = imageURL;
                preview.style.display = 'block';
            }

        } catch (error) {
            console.error('Database update error:', error);
            showToast('Failed to update product');
        }
    }
}

// Initialize product image preview on file select
function initProductImagePreview() {
    const fileInput = document.getElementById('product-image-upload');
    if (fileInput) {
        fileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    const preview = document.getElementById('image-preview');
                    if (preview) {
                        preview.src = event.target.result;
                        preview.style.display = 'block';
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProductImagePreview);
} else {
    initProductImagePreview();
}
