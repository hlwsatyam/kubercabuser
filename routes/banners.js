const express = require('express');
const router = express.Router();
const Banner = require('../models/Banner');
const {upload} = require('../config/multer');
const fs = require('fs');
const path = require('path');

// Get all banners
router.get('/', async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new banner with image upload
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Pleasez upload an image' });
    }

    if (!req.body.header) {
      // Delete uploaded file if header is missing
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Header is required' });
    }

    const banner = new Banner({
      image: req.file.filename,
      header: req.body.header
    });
    
    const newBanner = await banner.save();
    res.status(201).json(newBanner);
  } catch (error) {
    // Delete uploaded file in case of error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({ message: error.message });
  }
});

// Delete banner
router.delete('/:id', async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' });
    }
    
    // Delete image file from uploads folder
    const imagePath = path.join(__dirname, '../uploads', banner.image);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
    
    await Banner.findByIdAndDelete(req.params.id);
    res.json({ message: 'Banner deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Serve uploaded images
router.get('/image/:filename', (req, res) => {
  const filename = req.params.filename;
  const imagePath = path.join(__dirname, '../uploads', filename);
  
  if (fs.existsSync(imagePath)) {
    res.sendFile(imagePath);
  } else {
    res.status(404).json({ message: 'Image not found' });
  }
});













 
// Helper function to escape HTML
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}









// SINGLE VIEW AND EDIT ROUTE
router.get('/manage', async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    // Reusable HTML template function
    const generateHTML = (banners, baseUrl) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Banners Management</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: system-ui; }
            body { background: #f5f5f5; padding: 20px; }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { background: white; padding: 25px; border-radius: 10px; margin-bottom: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #333; margin-bottom: 10px; }
            .subtitle { color: #666; }
            #status { padding: 12px; border-radius: 6px; margin-bottom: 20px; display: none; }
            .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; display: block !important; }
            .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; display: block !important; }
            .add-form { background: white; padding: 25px; border-radius: 10px; margin-bottom: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .form-group { margin-bottom: 20px; }
            label { display: block; margin-bottom: 8px; font-weight: 600; color: #444; }
            input[type="text"], textarea { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px; }
            textarea { min-height: 100px; resize: vertical; }
            .btn { padding: 12px 25px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.3s; font-size: 16px; }
            .btn-primary { background: #007bff; color: white; }
            .btn-primary:hover { background: #0056b3; }
            .btn-success { background: #28a745; color: white; }
            .btn-success:hover { background: #1e7e34; }
            .btn-danger { background: #dc3545; color: white; }
            .btn-danger:hover { background: #bd2130; }
            .btn-warning { background: #ffc107; color: #212529; }
            .btn-warning:hover { background: #e0a800; }
            .banners-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 25px; }
            .banner-card { background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 3px 15px rgba(0,0,0,0.1); transition: transform 0.3s; }
            .banner-card:hover { transform: translateY(-5px); }
            .banner-img { width: 100%; height: 200px; object-fit: cover; border-bottom: 1px solid #eee; }
            .banner-content { padding: 20px; }
            .banner-header { font-size: 18px; font-weight: 600; margin-bottom: 10px; color: #333; }
            .banner-meta { font-size: 12px; color: #888; margin-bottom: 15px; }
            .banner-actions { display: flex; gap: 10px; flex-wrap: wrap; }
            .btn-sm { padding: 8px 16px; font-size: 14px; }
            .btn-block { width: 100%; }
            .empty-state { text-align: center; padding: 60px 20px; background: white; border-radius: 10px; }
            .edit-form { display: none; margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 6px; }
            .current-img { max-width: 200px; border-radius: 6px; margin: 10px 0; }
            .img-preview { max-width: 200px; margin: 10px 0; display: none; }
            .file-input { padding: 10px; border: 2px dashed #ddd; border-radius: 6px; cursor: pointer; }
            .form-row { display: flex; gap: 15px; margin-bottom: 15px; }
            .form-row > * { flex: 1; }
            @media (max-width: 768px) {
                .form-row { flex-direction: column; }
                .banners-grid { grid-template-columns: 1fr; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎯 Banners Management</h1>
                <p class="subtitle">View, edit and manage all banners</p>
            </div>
            
            <div id="status"></div>
            
            <!-- Add New Banner Form -->
            <div class="add-form">
                <h2 style="margin-bottom: 20px;">➕ Add New Banner</h2>
                <form id="addForm" enctype="multipart/form-data">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="header">Header Text *</label>
                            <input type="text" id="header" name="header" required placeholder="Enter banner header">
                        </div>
                        <div class="form-group">
                            <label for="image">Banner Image *</label>
                            <input type="file" id="image" name="image" accept="image/*" required class="file-input">
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">Create Banner</button>
                </form>
            </div>
            
            <!-- Banners List -->
            <div>
                <h2 style="margin-bottom: 20px;">📋 All Banners (${banners.length})</h2>
                ${banners.length === 0 ? 
                    '<div class="empty-state"><h3>No banners found</h3><p>Start by adding your first banner above</p></div>' : 
                    `<div class="banners-grid">
                        ${banners.map(banner => `
                        <div class="banner-card" id="banner-${banner._id}">
                            <img src="${baseUrl}/api/banners/image/${banner.image}" alt="${banner.header}" class="banner-img">
                            <div class="banner-content">
                                <div class="banner-header" id="header-${banner._id}">${escapeHtml(banner.header)}</div>
                                <div class="banner-meta">
                                    Created: ${new Date(banner.createdAt).toLocaleDateString()}<br>
                                    Last updated: ${new Date(banner.updatedAt).toLocaleDateString()}
                                </div>
                                
                                <!-- Display Mode -->
                                <div class="banner-actions" id="actions-${banner._id}">
                                    <button onclick="enableEdit('${banner._id}')" class="btn btn-warning btn-sm">✏️ Edit</button>
                                    <button onclick="deleteBanner('${banner._id}')" class="btn btn-danger btn-sm">🗑️ Delete</button>
                                </div>
                                
                                <!-- Edit Mode -->
                                <div class="edit-form" id="edit-form-${banner._id}">
                                    <div class="form-group">
                                        <label>Current Image:</label><br>
                                        <img src="${baseUrl}/api/banners/image/${banner.image}" class="current-img">
                                    </div>
                                    <div class="form-group">
                                        <label for="edit-header-${banner._id}">Header:</label>
                                        <input type="text" id="edit-header-${banner._id}" value="${escapeHtml(banner.header)}">
                                    </div>
                                    <div class="form-group">
                                        <label for="edit-image-${banner._id}">New Image (optional):</label>
                                        <input type="file" id="edit-image-${banner._id}" class="file-input" accept="image/*" onchange="previewImage(this, '${banner._id}')">
                                        <img id="preview-${banner._id}" class="img-preview">
                                    </div>
                                    <div class="banner-actions">
                                        <button onclick="saveBanner('${banner._id}')" class="btn btn-success btn-sm">💾 Save</button>
                                        <button onclick="cancelEdit('${banner._id}')" class="btn btn-danger btn-sm">❌ Cancel</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        `).join('')}
                    </div>`
                }
            </div>
        </div>
        
        <script>
            // Helper function to escape HTML
            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }
            
            // Show status message
            function showStatus(message, type) {
                const statusDiv = document.getElementById('status');
                statusDiv.textContent = message;
                statusDiv.className = type;
                statusDiv.style.display = 'block';
                setTimeout(() => statusDiv.style.display = 'none', 5000);
            }
            
            // Add new banner
            document.getElementById('addForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData();
                formData.append('header', document.getElementById('header').value);
                formData.append('image', document.getElementById('image').files[0]);
                
                try {
                    const response = await fetch('/api/banners', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        showStatus('Banner created successfully!', 'success');
                        document.getElementById('addForm').reset();
                        setTimeout(() => location.reload(), 1000);
                    } else {
                        const error = await response.json();
                        showStatus('Error: ' + error.message, 'error');
                    }
                } catch (error) {
                    showStatus('Network error: ' + error.message, 'error');
                }
            });
            
            // Enable edit mode
            function enableEdit(id) {
                document.getElementById('actions-' + id).style.display = 'none';
                document.getElementById('edit-form-' + id).style.display = 'block';
            }
            
            // Cancel edit
            function cancelEdit(id) {
                document.getElementById('actions-' + id).style.display = 'flex';
                document.getElementById('edit-form-' + id).style.display = 'none';
                document.getElementById('preview-' + id).style.display = 'none';
            }
            
            // Image preview
            function previewImage(input, id) {
                const preview = document.getElementById('preview-' + id);
                if (input.files && input.files[0]) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        preview.src = e.target.result;
                        preview.style.display = 'block';
                    }
                    reader.readAsDataURL(input.files[0]);
                }
            }
            
            // Save banner changes
            async function saveBanner(id) {
                const header = document.getElementById('edit-header-' + id).value;
                const imageFile = document.getElementById('edit-image-' + id).files[0];
                
                if (!header.trim()) {
                    showStatus('Header is required', 'error');
                    return;
                }
                
                const formData = new FormData();
                formData.append('header', header);
                if (imageFile) {
                    formData.append('image', imageFile);
                }
                
                try {
                    const response = await fetch('/api/banners/' + id, {
                        method: 'PUT',
                        body: formData
                    });
                    
                    if (response.ok) {
                        showStatus('Banner updated successfully!', 'success');
                        setTimeout(() => location.reload(), 1000);
                    } else {
                        const error = await response.json();
                        showStatus('Error: ' + error.message, 'error');
                    }
                } catch (error) {
                    showStatus('Network error: ' + error.message, 'error');
                }
            }
            
            // Delete banner
            async function deleteBanner(id) {
                if (!confirm('Are you sure you want to delete this banner?')) return;
                
                try {
                    const response = await fetch('/api/banners/' + id, {
                        method: 'DELETE'
                    });
                    
                    if (response.ok) {
                        showStatus('Banner deleted successfully!', 'success');
                        document.getElementById('banner-' + id).remove();
                        
                        // If no banners left, show empty state
                        if (document.querySelectorAll('.banner-card').length === 0) {
                            location.reload();
                        }
                    } else {
                        const error = await response.json();
                        showStatus('Error: ' + error.message, 'error');
                    }
                } catch (error) {
                    showStatus('Network error: ' + error.message, 'error');
                }
            }
        </script>
    </body>
    </html>
    `;
    
    res.send(generateHTML(banners, baseUrl));
  } catch (error) {
    res.status(500).send(`
      <html><body style="padding: 20px;">
        <h1 style="color: #dc3545;">Error</h1>
        <p>${error.message}</p>
      </body></html>
    `);
  }
});

// PUT route for updating banner (required for edit)
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' });
    }
    
    // Update header
    if (req.body.header) {
      banner.header = req.body.header;
    }
    
    // Update image if new one uploaded
    if (req.file) {
      // Delete old image
      const oldImagePath = path.join(__dirname, '../uploads', banner.image);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
      banner.image = req.file.filename;
    }
    
    const updatedBanner = await banner.save();
    res.json(updatedBanner);
  } catch (error) {
    // Delete uploaded file in case of error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({ message: error.message });
  }
});





module.exports = router;