const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

// Get all messages
router.get('/', async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new message
router.post('/', async (req, res) => {
  try {
    const message = new Message({
      content: req.body.content
    });
    
    const newMessage = await message.save();
    res.status(201).json(newMessage);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});






 


// Delete message
router.delete('/:id', async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    await Message.findByIdAndDelete(req.params.id);
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

















// Get all messages - HTML view with edit functionality
router.get('/view-edit', async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 });
    
    // HTML response with CSS and edit functionality
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Messages - View & Edit</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            
            body {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                padding: 20px;
            }
            
            .container {
                max-width: 1200px;
                margin: 0 auto;
                background: white;
                border-radius: 15px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                overflow: hidden;
            }
            
            .header {
                background: linear-gradient(to right, #4f46e5, #7c3aed);
                color: white;
                padding: 30px;
                text-align: center;
            }
            
            .header h1 {
                font-size: 2.5rem;
                margin-bottom: 10px;
            }
            
            .header p {
                opacity: 0.9;
                font-size: 1.1rem;
            }
            
            .messages-container {
                padding: 30px;
            }
            
            .message-card {
                background: #f8fafc;
                border-radius: 10px;
                padding: 20px;
                margin-bottom: 20px;
                border-left: 5px solid #4f46e5;
                transition: all 0.3s ease;
                box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            }
            
            .message-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 15px rgba(0,0,0,0.1);
            }
            
            .message-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid #e2e8f0;
            }
            
            .message-id {
                background: #4f46e5;
                color: white;
                padding: 5px 12px;
                border-radius: 20px;
                font-size: 0.9rem;
                font-weight: 500;
            }
            
            .message-date {
                color: #64748b;
                font-size: 0.9rem;
            }
            
            .message-content {
                width: 100%;
                padding: 15px;
                border: 2px solid #e2e8f0;
                border-radius: 8px;
                font-size: 1rem;
                resize: vertical;
                min-height: 100px;
                margin-bottom: 15px;
                transition: border-color 0.3s ease;
            }
            
            .message-content:focus {
                outline: none;
                border-color: #4f46e5;
                box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
            }
            
            .message-actions {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            
            .btn {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 0.95rem;
            }
            
            .btn-save {
                background: #10b981;
                color: white;
            }
            
            .btn-save:hover {
                background: #059669;
                transform: translateY(-1px);
            }
            
            .btn-cancel {
                background: #ef4444;
                color: white;
            }
            
            .btn-cancel:hover {
                background: #dc2626;
                transform: translateY(-1px);
            }
            
            .btn-edit {
                background: #f59e0b;
                color: white;
            }
            
            .btn-edit:hover {
                background: #d97706;
                transform: translateY(-1px);
            }
            
            .btn-delete {
                background: #ef4444;
                color: white;
                padding: 5px 15px;
                border-radius: 6px;
                text-decoration: none;
                font-size: 0.9rem;
                display: inline-block;
                margin-top: 10px;
            }
            
            .btn-delete:hover {
                background: #dc2626;
            }
            
            .empty-state {
                text-align: center;
                padding: 60px 20px;
                color: #64748b;
            }
            
            .empty-state h2 {
                font-size: 1.8rem;
                margin-bottom: 10px;
                color: #475569;
            }
            
            .status-message {
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
                text-align: center;
                font-weight: 500;
                display: none;
            }
            
            .success {
                background: #d1fae5;
                color: #065f46;
                border: 1px solid #a7f3d0;
                display: block;
            }
            
            .error {
                background: #fee2e2;
                color: #991b1b;
                border: 1px solid #fecaca;
                display: block;
            }
            
            .timestamp {
                font-size: 0.8rem;
                color: #94a3b8;
                margin-top: 5px;
            }
            
            .original-content {
                background: white;
                padding: 15px;
                border-radius: 8px;
                border: 1px solid #e2e8f0;
                margin-bottom: 15px;
                white-space: pre-wrap;
                word-wrap: break-word;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📝 Messages Management</h1>
                <p>View and edit all messages in one place</p>
            </div>
            
            <div id="statusMessage" class="status-message"></div>
            
            <div class="messages-container">
                ${messages.length === 0 ? 
                    '<div class="empty-state"><h2>No messages found</h2><p>Start by adding some messages!</p></div>' : 
                    messages.map(message => `
                    <div class="message-card" id="message-${message._id}">
                        <div class="message-header">
                            <span class="message-id">ID: ${message._id.toString().substring(0, 8)}...</span>
                            <span class="message-date">Created: ${new Date(message.createdAt).toLocaleString()}</span>
                        </div>
                        
                        <div id="content-${message._id}" class="original-content">
                            ${message.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                        </div>
                        
                        <div id="edit-form-${message._id}" style="display: none;">
                            <textarea 
                                id="edit-content-${message._id}" 
                                class="message-content"
                                placeholder="Edit message content...">${message.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                            <div class="message-actions">
                                <button onclick="saveMessage('${message._id}')" class="btn btn-save">💾 Save Changes</button>
                                <button onclick="cancelEdit('${message._id}')" class="btn btn-cancel">❌ Cancel</button>
                            </div>
                        </div>
                        
                        <div id="actions-${message._id}">
                            <button onclick="editMessage('${message._id}')" class="btn btn-edit">✏️ Edit Message</button>
                            <a href="/api/messages/${message._id}" onclick="return confirm('Delete this message?')" 
                               class="btn-delete">🗑️ Delete</a>
                        </div>
                        
                        <div class="timestamp">
                            Last updated: ${new Date(message.updatedAt).toLocaleString()}
                        </div>
                    </div>
                    `).join('')}
            </div>
        </div>
        
        <script>
            function editMessage(messageId) {
                document.getElementById('content-' + messageId).style.display = 'none';
                document.getElementById('edit-form-' + messageId).style.display = 'block';
                document.getElementById('actions-' + messageId).style.display = 'none';
            }
            
            function cancelEdit(messageId) {
                document.getElementById('content-' + messageId).style.display = 'block';
                document.getElementById('edit-form-' + messageId).style.display = 'none';
                document.getElementById('actions-' + messageId).style.display = 'block';
            }
            
            async function saveMessage(messageId) {
                const content = document.getElementById('edit-content-' + messageId).value;
                const statusDiv = document.getElementById('statusMessage');
                
                if (!content.trim()) {
                    showMessage('Message content cannot be empty!', 'error');
                    return;
                }
                
                try {
                    const response = await fetch('/api/messages/' + messageId, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ content: content })
                    });
                    
                    if (response.ok) {
                        const updatedMessage = await response.json();
                        document.getElementById('content-' + messageId).innerHTML = 
                            updatedMessage.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        document.querySelector('#message-' + messageId + ' .timestamp').innerHTML = 
                            'Last updated: ' + new Date(updatedMessage.updatedAt).toLocaleString();
                        
                        cancelEdit(messageId);
                        showMessage('Message updated successfully!', 'success');
                        
                        // Auto-hide success message after 3 seconds
                        setTimeout(() => {
                            statusDiv.style.display = 'none';
                        }, 3000);
                    } else {
                        const error = await response.json();
                        showMessage('Error: ' + error.message, 'error');
                    }
                } catch (error) {
                    showMessage('Network error: ' + error.message, 'error');
                }
            }
            
            function showMessage(text, type) {
                const statusDiv = document.getElementById('statusMessage');
                statusDiv.textContent = text;
                statusDiv.className = 'status-message ' + type;
                statusDiv.style.display = 'block';
            }
            
            // Auto-hide status messages after 5 seconds
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(() => {
                    const statusDiv = document.getElementById('statusMessage');
                    if (statusDiv.style.display === 'block') {
                        statusDiv.style.display = 'none';
                    }
                }, 5000);
            });
        </script>
    </body>
    </html>
    `;
    
    res.send(html);
  } catch (error) {
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Error</title></head>
      <body>
        <h1>Error loading messages</h1>
        <p>${error.message}</p>
      </body>
      </html>
    `);
  }
});

// PUT route for updating message (required for the edit functionality)
router.put('/:id', async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    if (req.body.content) {
      message.content = req.body.content;
    }
    
    const updatedMessage = await message.save();
    res.json(updatedMessage);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

 












module.exports = router;