const express = require('express');
const router = express.Router();
const Package = require('../models/Package');
const {upload} = require('../config/multer');
const fs = require('fs');
const path = require('path');






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
    const packages = await Package.find().sort({ createdAt: -1 });
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    // Predefined options for dropdowns
    const vehicleTypes = ['Sedan', 'SUV', 'Hatchback', 'MUV', 'Luxury', 'Tempo Traveller', 'Bus'];
    const capacityOptions = ['2-3 Persons', '4-5 Persons', '6-7 Persons', '8-10 Persons', '12-15 Persons', '20+ Persons'];
    const durationOptions = ['1 Day', '2 Days / 1 Night', '3 Days / 2 Nights', '4 Days / 3 Nights', '5 Days / 4 Nights', '7 Days / 6 Nights'];
    
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Packages Management</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: system-ui; }
            body { background: #f8f9fa; padding: 20px; }
            .container { max-width: 1400px; margin: 0 auto; }
            .header { background: white; padding: 25px; border-radius: 10px; margin-bottom: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #2c3e50; margin-bottom: 10px; }
            .subtitle { color: #666; }
            #status { padding: 12px; border-radius: 6px; margin-bottom: 20px; display: none; }
            .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; display: block !important; }
            .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; display: block !important; }
            .add-form { background: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .form-group { margin-bottom: 20px; }
            label { display: block; margin-bottom: 8px; font-weight: 600; color: #444; }
            .form-row { display: flex; gap: 20px; margin-bottom: 15px; }
            .form-row > * { flex: 1; }
            input[type="text"], input[type="number"], select, textarea { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px; }
            textarea { min-height: 100px; resize: vertical; }
            .checkbox-group { display: flex; align-items: center; gap: 10px; }
            .checkbox-group input { width: auto; }
            .btn { padding: 12px 25px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.3s; font-size: 16px; }
            .btn-primary { background: #3498db; color: white; }
            .btn-primary:hover { background: #2980b9; }
            .btn-success { background: #2ecc71; color: white; }
            .btn-success:hover { background: #27ae60; }
            .btn-danger { background: #e74c3c; color: white; }
            .btn-danger:hover { background: #c0392b; }
            .btn-warning { background: #f39c12; color: white; }
            .btn-warning:hover { background: #d68910; }
            .packages-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 25px; }
            .package-card { background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 3px 15px rgba(0,0,0,0.1); transition: transform 0.3s; }
            .package-card:hover { transform: translateY(-5px); }
            .package-img { width: 100%; height: 200px; object-fit: cover; border-bottom: 1px solid #eee; }
            .package-content { padding: 20px; }
            .package-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
            .package-name { font-size: 20px; font-weight: 700; color: #2c3e50; }
            .package-price { background: #2ecc71; color: white; padding: 5px 15px; border-radius: 20px; font-weight: 600; }
            .package-details { display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 15px; }
            .detail-item { display: flex; align-items: center; gap: 5px; color: #555; }
            .detail-item i { color: #3498db; }
            .package-actions { display: flex; gap: 10px; margin-top: 15px; }
            .btn-sm { padding: 8px 16px; font-size: 14px; }
            .empty-state { text-align: center; padding: 60px 20px; background: white; border-radius: 10px; }
            .edit-form { display: none; margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 10px; }
            .current-img { max-width: 200px; border-radius: 6px; margin: 10px 0; }
            .img-preview { max-width: 200px; margin: 10px 0; display: none; }
            .file-input { padding: 10px; border: 2px dashed #ddd; border-radius: 6px; cursor: pointer; }
            .array-field { margin-bottom: 15px; }
            .array-item { display: flex; gap: 10px; margin-bottom: 10px; }
            .array-input { flex: 1; }
            .add-item-btn { background: #95a5a6; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; }
            .remove-item-btn { background: #e74c3c; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; }
            .inclusion-item { background: #ecf0f1; padding: 8px 15px; border-radius: 4px; margin-bottom: 5px; display: inline-block; margin-right: 5px; }
            @media (max-width: 768px) {
                .form-row, .package-details, .array-item { flex-direction: column; }
                .packages-grid { grid-template-columns: 1fr; }
            }
        </style>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚗 Packages Management</h1>
                <p class="subtitle">View, edit and manage all tour packages</p>
            </div>
            
            <div id="status"></div>
            
            <!-- Add New Package Form -->
            <div class="add-form">
                <h2 style="margin-bottom: 20px;">➕ Add New Package</h2>
                <form id="addForm" enctype="multipart/form-data">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="name">Package Name *</label>
                            <input type="text" id="name" name="name" required placeholder="e.g., Shimla Manali Tour">
                        </div>
                        <div class="form-group">
                            <label for="vehicleType">Vehicle Type *</label>
                            <select id="vehicleType" name="vehicleType" required>
                                <option value="">Select Vehicle Type</option>
                                ${vehicleTypes.map(type => `<option value="${type}">${type}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="capacity">Capacity *</label>
                            <select id="capacity" name="capacity" required>
                                <option value="">Select Capacity</option>
                                ${capacityOptions.map(cap => `<option value="${cap}">${cap}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="duration">Duration *</label>
                            <select id="duration" name="duration" required>
                                <option value="">Select Duration</option>
                                ${durationOptions.map(dur => `<option value="${dur}">${dur}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="price">Price (₹) *</label>
                            <input type="number" id="price" name="price" required placeholder="e.g., 15000" min="0">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <div class="checkbox-group">
                            <input type="checkbox" id="ac" name="ac" checked>
                            <label for="ac">Air Conditioned</label>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="image">Package Image *</label>
                        <input type="file" id="image" name="image" accept="image/*" required class="file-input">
                    </div>
                    
                    <div class="form-group">
                        <label>Itinerary (Day-wise details)</label>
                        <div id="itineraryContainer">
                            <div class="array-item">
                                <input type="text" class="array-input" placeholder="Day (e.g., Day 1)" name="itineraryDay[]">
                                <textarea class="array-input" placeholder="Description" name="itineraryDesc[]" rows="2"></textarea>
                                <button type="button" class="add-item-btn" onclick="addItineraryField()">+</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Inclusions (What's included)</label>
                        <div id="inclusionsContainer">
                            <div class="array-item">
                                <input type="text" class="array-input" placeholder="e.g., Breakfast" name="inclusions[]">
                                <button type="button" class="add-item-btn" onclick="addInclusionField()">+</button>
                            </div>
                        </div>
                    </div>
                    
                    <button type="submit" class="btn btn-primary btn-block">Create Package</button>
                </form>
            </div>
            
            <!-- Packages List -->
            <div>
                <h2 style="margin-bottom: 20px;">📦 All Packages (${packages.length})</h2>
                ${packages.length === 0 ? 
                    '<div class="empty-state"><h3>No packages found</h3><p>Start by adding your first package above</p></div>' : 
                    `<div class="packages-grid">
                        ${packages.map(pkg => {
                          const itineraryHTML = pkg.itinerary && pkg.itinerary.length > 0 
                            ? pkg.itinerary.map(item => 
                                `<div><strong>${escapeHtml(item.day)}:</strong> ${escapeHtml(item.description)}</div>`
                              ).join('') 
                            : '<div>No itinerary details</div>';
                          
                          const inclusionsHTML = pkg.inclusions && pkg.inclusions.length > 0 
                            ? pkg.inclusions.map(inc => 
                                `<span class="inclusion-item">${escapeHtml(inc)}</span>`
                              ).join('') 
                            : '<div>No inclusions listed</div>';
                          
                          return `
                        <div class="package-card" id="package-${pkg._id}">
                            <img src="${baseUrl}/api/packages/image/${pkg.image}" alt="${escapeHtml(pkg.name)}" class="package-img">
                            <div class="package-content">
                                <div class="package-header">
                                    <div class="package-name">${escapeHtml(pkg.name)}</div>
                                    <div class="package-price">₹${pkg.price}</div>
                                </div>
                                
                                <div class="package-details">
                                    <div class="detail-item">
                                        <i class="fas fa-car"></i> ${escapeHtml(pkg.vehicleType)}
                                    </div>
                                    <div class="detail-item">
                                        <i class="fas fa-users"></i> ${escapeHtml(pkg.capacity)}
                                    </div>
                                    <div class="detail-item">
                                        <i class="fas fa-clock"></i> ${escapeHtml(pkg.duration)}
                                    </div>
                                    <div class="detail-item">
                                        <i class="fas fa-snowflake"></i> ${pkg.ac ? 'AC' : 'Non-AC'}
                                    </div>
                                </div>
                                
                                <div style="margin-bottom: 15px;">
                                    <strong>Itinerary:</strong>
                                    <div style="margin-top: 5px; font-size: 14px; color: #555;">
                                        ${itineraryHTML}
                                    </div>
                                </div>
                                
                                <div style="margin-bottom: 15px;">
                                    <strong>Inclusions:</strong>
                                    <div style="margin-top: 5px;">
                                        ${inclusionsHTML}
                                    </div>
                                </div>
                                
                                <!-- Display Mode -->
                                <div class="package-actions" id="actions-${pkg._id}">
                                    <button onclick="enableEdit('${pkg._id}')" class="btn btn-warning btn-sm">
                                        <i class="fas fa-edit"></i> Edit
                                    </button>
                                    <button onclick="deletePackage('${pkg._id}')" class="btn btn-danger btn-sm">
                                        <i class="fas fa-trash"></i> Delete
                                    </button>
                                </div>
                                
                                <!-- Edit Mode -->
                                <div class="edit-form" id="edit-form-${pkg._id}">
                                    <h4 style="margin-bottom: 15px;">✏️ Edit Package</h4>
                                    
                                    <div class="form-group">
                                        <label>Current Image:</label><br>
                                        <img src="${baseUrl}/api/packages/image/${pkg.image}" class="current-img">
                                    </div>
                                    
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label for="edit-name-${pkg._id}">Package Name:</label>
                                            <input type="text" id="edit-name-${pkg._id}" value="${escapeHtml(pkg.name)}">
                                        </div>
                                        <div class="form-group">
                                            <label for="edit-vehicleType-${pkg._id}">Vehicle Type:</label>
                                            <select id="edit-vehicleType-${pkg._id}">
                                                ${vehicleTypes.map(type => 
                                                  `<option value="${type}" ${type === pkg.vehicleType ? 'selected' : ''}>${type}</option>`
                                                ).join('')}
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label for="edit-capacity-${pkg._id}">Capacity:</label>
                                            <select id="edit-capacity-${pkg._id}">
                                                ${capacityOptions.map(cap => 
                                                  `<option value="${cap}" ${cap === pkg.capacity ? 'selected' : ''}>${cap}</option>`
                                                ).join('')}
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label for="edit-duration-${pkg._id}">Duration:</label>
                                            <select id="edit-duration-${pkg._id}">
                                                ${durationOptions.map(dur => 
                                                  `<option value="${dur}" ${dur === pkg.duration ? 'selected' : ''}>${dur}</option>`
                                                ).join('')}
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label for="edit-price-${pkg._id}">Price (₹):</label>
                                            <input type="number" id="edit-price-${pkg._id}" value="${pkg.price}">
                                        </div>
                                    </div>
                                    
                                    <div class="form-group">
                                        <div class="checkbox-group">
                                            <input type="checkbox" id="edit-ac-${pkg._id}" ${pkg.ac ? 'checked' : ''}>
                                            <label for="edit-ac-${pkg._id}">Air Conditioned</label>
                                        </div>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label for="edit-image-${pkg._id}">New Image (optional):</label>
                                        <input type="file" id="edit-image-${pkg._id}" class="file-input" accept="image/*" onchange="previewImage(this, '${pkg._id}')">
                                        <img id="preview-${pkg._id}" class="img-preview">
                                    </div>
                                    
                                    <div class="form-group">
                                        <label>Itinerary:</label>
                                        <div id="edit-itinerary-container-${pkg._id}">
                                            ${pkg.itinerary && pkg.itinerary.length > 0 ? 
                                              pkg.itinerary.map((item, index) => `
                                                <div class="array-item">
                                                    <input type="text" class="array-input" value="${escapeHtml(item.day)}" placeholder="Day" id="edit-itinerary-day-${pkg._id}-${index}">
                                                    <textarea class="array-input" placeholder="Description" id="edit-itinerary-desc-${pkg._id}-${index}" rows="2">${escapeHtml(item.description)}</textarea>
                                                    ${index === 0 ? 
                                                      '<button type="button" class="add-item-btn" onclick="addEditItineraryField(\'' + pkg._id + '\')">+</button>' : 
                                                      '<button type="button" class="remove-item-btn" onclick="removeArrayItem(this)">-</button>'}
                                                </div>
                                              `).join('') : 
                                              `<div class="array-item">
                                                <input type="text" class="array-input" placeholder="Day" id="edit-itinerary-day-${pkg._id}-0">
                                                <textarea class="array-input" placeholder="Description" id="edit-itinerary-desc-${pkg._id}-0" rows="2"></textarea>
                                                <button type="button" class="add-item-btn" onclick="addEditItineraryField('${pkg._id}')">+</button>
                                              </div>`
                                            }
                                        </div>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label>Inclusions:</label>
                                        <div id="edit-inclusions-container-${pkg._id}">
                                            ${pkg.inclusions && pkg.inclusions.length > 0 ? 
                                              pkg.inclusions.map((inc, index) => `
                                                <div class="array-item">
                                                    <input type="text" class="array-input" value="${escapeHtml(inc)}" placeholder="Inclusion" id="edit-inclusion-${pkg._id}-${index}">
                                                    ${index === 0 ? 
                                                      '<button type="button" class="add-item-btn" onclick="addEditInclusionField(\'' + pkg._id + '\')">+</button>' : 
                                                      '<button type="button" class="remove-item-btn" onclick="removeArrayItem(this)">-</button>'}
                                                </div>
                                              `).join('') : 
                                              `<div class="array-item">
                                                <input type="text" class="array-input" placeholder="Inclusion" id="edit-inclusion-${pkg._id}-0">
                                                <button type="button" class="add-item-btn" onclick="addEditInclusionField('${pkg._id}')">+</button>
                                              </div>`
                                            }
                                        </div>
                                    </div>
                                    
                                    <div class="package-actions">
                                        <button onclick="savePackage('${pkg._id}')" class="btn btn-success">
                                            <i class="fas fa-save"></i> Save Changes
                                        </button>
                                        <button onclick="cancelEdit('${pkg._id}')" class="btn btn-danger">
                                            <i class="fas fa-times"></i> Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        `}).join('')}
                    </div>`
                }
            </div>
        </div>
        
        <script>
            // Show status message
            function showStatus(message, type) {
                const statusDiv = document.getElementById('status');
                statusDiv.textContent = message;
                statusDiv.className = type;
                statusDiv.style.display = 'block';
                setTimeout(() => statusDiv.style.display = 'none', 5000);
            }
            
            // Add itinerary field for new package
            function addItineraryField() {
                const container = document.getElementById('itineraryContainer');
                const div = document.createElement('div');
                div.className = 'array-item';
                div.innerHTML = \`
                    <input type="text" class="array-input" placeholder="Day" name="itineraryDay[]">
                    <textarea class="array-input" placeholder="Description" name="itineraryDesc[]" rows="2"></textarea>
                    <button type="button" class="remove-item-btn" onclick="removeArrayItem(this)">-</button>
                \`;
                container.appendChild(div);
            }
            
            // Add inclusion field for new package
            function addInclusionField() {
                const container = document.getElementById('inclusionsContainer');
                const div = document.createElement('div');
                div.className = 'array-item';
                div.innerHTML = \`
                    <input type="text" class="array-input" placeholder="Inclusion" name="inclusions[]">
                    <button type="button" class="remove-item-btn" onclick="removeArrayItem(this)">-</button>
                \`;
                container.appendChild(div);
            }
            
            // Add itinerary field for edit mode
            function addEditItineraryField(packageId) {
                const container = document.getElementById('edit-itinerary-container-' + packageId);
                const index = container.children.length;
                const div = document.createElement('div');
                div.className = 'array-item';
                div.innerHTML = \`
                    <input type="text" class="array-input" placeholder="Day" id="edit-itinerary-day-\${packageId}-\${index}">
                    <textarea class="array-input" placeholder="Description" id="edit-itinerary-desc-\${packageId}-\${index}" rows="2"></textarea>
                    <button type="button" class="remove-item-btn" onclick="removeArrayItem(this)">-</button>
                \`;
                container.appendChild(div);
            }
            
            // Add inclusion field for edit mode
            function addEditInclusionField(packageId) {
                const container = document.getElementById('edit-inclusions-container-' + packageId);
                const index = container.children.length;
                const div = document.createElement('div');
                div.className = 'array-item';
                div.innerHTML = \`
                    <input type="text" class="array-input" placeholder="Inclusion" id="edit-inclusion-\${packageId}-\${index}">
                    <button type="button" class="remove-item-btn" onclick="removeArrayItem(this)">-</button>
                \`;
                container.appendChild(div);
            }
            
            // Remove array item
            function removeArrayItem(button) {
                button.parentElement.remove();
            }
            
            // Add new package
            document.getElementById('addForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                // Collect itinerary data
                const itineraryDays = document.getElementsByName('itineraryDay[]');
                const itineraryDescs = document.getElementsByName('itineraryDesc[]');
                const itinerary = [];
                for (let i = 0; i < itineraryDays.length; i++) {
                    if (itineraryDays[i].value.trim() && itineraryDescs[i].value.trim()) {
                        itinerary.push({
                            day: itineraryDays[i].value,
                            description: itineraryDescs[i].value
                        });
                    }
                }
                
                // Collect inclusions data
                const inclusionInputs = document.getElementsByName('inclusions[]');
                const inclusions = [];
                for (let i = 0; i < inclusionInputs.length; i++) {
                    if (inclusionInputs[i].value.trim()) {
                        inclusions.push(inclusionInputs[i].value);
                    }
                }
                
                const formData = new FormData();
                formData.append('name', document.getElementById('name').value);
                formData.append('vehicleType', document.getElementById('vehicleType').value);
                formData.append('capacity', document.getElementById('capacity').value);
                formData.append('duration', document.getElementById('duration').value);
                formData.append('price', document.getElementById('price').value);
                formData.append('ac', document.getElementById('ac').checked);
                formData.append('itinerary', JSON.stringify(itinerary));
                formData.append('inclusions', JSON.stringify(inclusions));
                formData.append('image', document.getElementById('image').files[0]);
                
                try {
                    const response = await fetch('/api/packages', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        showStatus('Package created successfully!', 'success');
                        document.getElementById('addForm').reset();
                        // Reset arrays
                        document.getElementById('itineraryContainer').innerHTML = \`
                            <div class="array-item">
                                <input type="text" class="array-input" placeholder="Day" name="itineraryDay[]">
                                <textarea class="array-input" placeholder="Description" name="itineraryDesc[]" rows="2"></textarea>
                                <button type="button" class="add-item-btn" onclick="addItineraryField()">+</button>
                            </div>
                        \`;
                        document.getElementById('inclusionsContainer').innerHTML = \`
                            <div class="array-item">
                                <input type="text" class="array-input" placeholder="Inclusion" name="inclusions[]">
                                <button type="button" class="add-item-btn" onclick="addInclusionField()">+</button>
                            </div>
                        \`;
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
                document.getElementById('edit-image-' + id).value = '';
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
                } else {
                    preview.style.display = 'none';
                }
            }
            
            // Save package changes
            async function savePackage(id) {
                // Collect itinerary data
                const itineraryContainer = document.getElementById('edit-itinerary-container-' + id);
                const itineraryInputs = itineraryContainer.querySelectorAll('input[id^="edit-itinerary-day-' + id + '"], textarea[id^="edit-itinerary-desc-' + id + '"]');
                const itinerary = [];
                for (let i = 0; i < itineraryInputs.length; i += 2) {
                    const day = itineraryInputs[i].value.trim();
                    const desc = itineraryInputs[i + 1] ? itineraryInputs[i + 1].value.trim() : '';
                    if (day || desc) {
                        itinerary.push({ day, description: desc });
                    }
                }
                
                // Collect inclusions data
                const inclusionsContainer = document.getElementById('edit-inclusions-container-' + id);
                const inclusionInputs = inclusionsContainer.querySelectorAll('input[id^="edit-inclusion-' + id + '"]');
                const inclusions = [];
                inclusionInputs.forEach(input => {
                    if (input.value.trim()) {
                        inclusions.push(input.value.trim());
                    }
                });
                
                const name = document.getElementById('edit-name-' + id).value;
                const vehicleType = document.getElementById('edit-vehicleType-' + id).value;
                const capacity = document.getElementById('edit-capacity-' + id).value;
                const duration = document.getElementById('edit-duration-' + id).value;
                const price = document.getElementById('edit-price-' + id).value;
                const ac = document.getElementById('edit-ac-' + id).checked;
                const imageFile = document.getElementById('edit-image-' + id).files[0];
                
                if (!name || !vehicleType || !capacity || !duration || !price) {
                    showStatus('Please fill all required fields', 'error');
                    return;
                }
                
                const formData = new FormData();
                formData.append('name', name);
                formData.append('vehicleType', vehicleType);
                formData.append('capacity', capacity);
                formData.append('duration', duration);
                formData.append('price', price);
                formData.append('ac', ac);
                formData.append('itinerary', JSON.stringify(itinerary));
                formData.append('inclusions', JSON.stringify(inclusions));
                if (imageFile) {
                    formData.append('image', imageFile);
                }
                
                try {
                    const response = await fetch('/api/packages/' + id, {
                        method: 'PUT',
                        body: formData
                    });
                    
                    if (response.ok) {
                        showStatus('Package updated successfully!', 'success');
                        setTimeout(() => location.reload(), 1000);
                    } else {
                        const error = await response.json();
                        showStatus('Error: ' + error.message, 'error');
                    }
                } catch (error) {
                    showStatus('Network error: ' + error.message, 'error');
                }
            }
            
            // Delete package
            async function deletePackage(id) {
                if (!confirm('Are you sure you want to delete this package?')) return;
                
                try {
                    const response = await fetch('/api/packages/' + id, {
                        method: 'DELETE'
                    });
                    
                    if (response.ok) {
                        showStatus('Package deleted successfully!', 'success');
                        document.getElementById('package-' + id).remove();
                        
                        // If no packages left, show empty state
                        if (document.querySelectorAll('.package-card').length === 0) {
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
    
    res.send(html);
  } catch (error) {
    res.status(500).send(`
      <html>
        <body style="padding: 20px; font-family: system-ui;">
          <h1 style="color: #dc3545;">Error</h1>
          <p>${escapeHtml(error.message)}</p>
          <a href="/api/packages/manage" style="color: #007bff;">Go Back</a>
        </body>
      </html>
    `);
  }
});

// PUT route for updating package (required for edit)
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const package = await Package.findById(req.params.id);
    if (!package) {
      return res.status(404).json({ message: 'Package not found' });
    }
    
    // Update fields
    const fields = ['name', 'vehicleType', 'capacity', 'duration', 'price'];
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'price') {
          package[field] = Number(req.body[field]);
        } else if (field === 'ac') {
          package[field] = req.body[field] === 'true';
        } else {
          package[field] = req.body[field];
        }
      }
    });
    
    // Handle ac separately
    if (req.body.ac !== undefined) {
      package.ac = req.body.ac === 'true';
    }
    
    // Parse itinerary and inclusions
    if (req.body.itinerary) {
      const itineraryArray = typeof req.body.itinerary === 'string' ? JSON.parse(req.body.itinerary) : req.body.itinerary;
      package.itinerary = itineraryArray;
    }
    
    if (req.body.inclusions) {
      const inclusionsArray = typeof req.body.inclusions === 'string' ? JSON.parse(req.body.inclusions) : req.body.inclusions;
      package.inclusions = inclusionsArray;
    }
    
    // Update image if new one uploaded
    if (req.file) {
      // Delete old image
      const oldImagePath = path.join(__dirname, '../uploads', package.image);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
      package.image = req.file.filename;
    }
    
    const updatedPackage = await package.save();
    res.json(updatedPackage);
  } catch (error) {
    // Delete uploaded file in case of error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({ message: error.message });
  }
});













// Get all packages
router.get('/', async (req, res) => {
  try {
    const packages = await Package.find().sort({ createdAt: -1 });
    res.json(packages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new package
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image' });
    }

    const {
      name,
      vehicleType,
      capacity,
      ac,
      itinerary,
      inclusions,
      price,
      duration
    } = req.body;

    // Parse itinerary and inclusions from string to array
    const itineraryArray = typeof itinerary === 'string' ? JSON.parse(itinerary) : itinerary;
    const inclusionsArray = typeof inclusions === 'string' ? JSON.parse(inclusions) : inclusions;

    const package = new Package({
      name,
      vehicleType,
      capacity,
      ac: ac === 'true',
      itinerary: itineraryArray,
      inclusions: inclusionsArray,
      price: Number(price),
      duration,
      image: req.file.filename
    });
    
    const newPackage = await package.save();
    res.status(201).json(newPackage);
  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({ message: error.message });
  }
});

// Delete package
router.delete('/:id', async (req, res) => {
  try {
    const package = await Package.findById(req.params.id);
    if (!package) {
      return res.status(404).json({ message: 'Package not found' });
    }
    
    // Delete image file
    const imagePath = path.join(__dirname, '../uploads', package.image);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
    
    await Package.findByIdAndDelete(req.params.id);
    res.json({ message: 'Package deleted successfully' });
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

module.exports = router;