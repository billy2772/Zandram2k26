// Admin Dashboard Logic

const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const studentTableBody = document.getElementById('studentTableBody');
const searchInput = document.getElementById('searchInput');

let registrationsData = [];
let currentToken = localStorage.getItem('adminToken');

// Check Login Status on Load
if (currentToken) {
    showDashboard();
    fetchRegistrations();
}

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('adminToken', data.token);
            currentToken = data.token;
            loginError.classList.add('hidden');
            showDashboard();
            fetchRegistrations();
        } else {
            loginError.classList.remove('hidden');
        }
    } catch (err) {
        console.error('Login Error:', err);
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    currentToken = null;
    hideDashboard();
});

function showDashboard() {
    loginSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    logoutBtn.classList.remove('hidden');
}

function hideDashboard() {
    loginSection.style.display = 'flex';
    dashboardSection.style.display = 'none';
    logoutBtn.classList.add('hidden');
}

// Fetch Registrations
async function fetchRegistrations() {
    try {
        const response = await fetch('/api/admin/registrations', {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        
        if (response.status === 403 || response.status === 401) {
            hideDashboard();
            return;
        }

        registrationsData = await response.json();
        updateStats();
        renderTable(registrationsData);
    } catch (err) {
        console.error('Failed to fetch data', err);
    }
}

// Update Dashboard Stats
function updateStats() {
    const total = registrationsData.length;
    const verified = registrationsData.filter(r => r.paymentStatus === 'Verified').length;
    const pending = registrationsData.filter(r => r.paymentStatus === 'Pending Verification').length;
    const rejected = registrationsData.filter(r => r.paymentStatus === 'Rejected').length;

    document.getElementById('statTotal').innerText = total;
    document.getElementById('statVerified').innerText = verified;
    document.getElementById('statPending').innerText = pending;
    document.getElementById('statRejected').innerText = rejected;
}

// Render Table
function renderTable(data) {
    studentTableBody.innerHTML = '';
    
    data.forEach(reg => {
        const tr = document.createElement('tr');
        
        // Format Status
        let statusClass = 'status-pending';
        if (reg.paymentStatus === 'Verified') statusClass = 'status-verified';
        if (reg.paymentStatus === 'Rejected') statusClass = 'status-rejected';

        tr.innerHTML = `
            <td>
                <strong>${reg.fullName}</strong><br>
                <small>${reg.collegeName} (${reg.department})</small><br>
                <small>${reg.email} | ${reg.phone}</small>
            </td>
            <td>
                <small>${reg.selectedEvents.join('<br>')}</small>
            </td>
            <td>
                <small>${new Date(reg.registrationTime).toLocaleString()}</small>
            </td>
            <td>
                <span class="highlight">${reg.transactionId}</span>
            </td>
            <td>
                <span class="status-badge ${statusClass}">${reg.paymentStatus}</span>
            </td>
            <td class="action-btns">
                <button class="btn-sm btn-view" onclick="viewScreenshot('${reg.screenshotPath}', '${reg.transactionId}', '${reg._id}')">View</button>
                <button class="btn-sm btn-approve" onclick="updateStatus('${reg._id}', 'Verified')" ${reg.paymentStatus === 'Verified' ? 'disabled' : ''}>Approve</button>
                <button class="btn-sm btn-reject" onclick="updateStatus('${reg._id}', 'Rejected')" ${reg.paymentStatus === 'Rejected' ? 'disabled' : ''}>Reject</button>
                <button class="btn-sm btn-delete" onclick="deleteReg('${reg._id}')">Delete</button>
            </td>
        `;
        studentTableBody.appendChild(tr);
    });
}

// Update Payment Status
async function updateStatus(id, status) {
    if (!confirm(`Are you sure you want to mark this payment as ${status}?`)) return;

    try {
        const response = await fetch(`/api/admin/registrations/${id}/status`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}` 
            },
            body: JSON.stringify({ status })
        });

        if (response.ok) {
            closeModal();
            fetchRegistrations();
        } else {
            alert('Failed to update status');
        }
    } catch (err) {
        console.error(err);
    }
}

// Delete Registration
async function deleteReg(id) {
    if (!confirm('Are you sure you want to delete this registration completely? This action cannot be undone.')) return;

    try {
        const response = await fetch(`/api/admin/registrations/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });

        if (response.ok) {
            fetchRegistrations();
        } else {
            alert('Failed to delete registration');
        }
    } catch (err) {
        console.error(err);
    }
}

// Search / Filter
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = registrationsData.filter(reg => {
        return (
            reg.fullName.toLowerCase().includes(term) ||
            reg.email.toLowerCase().includes(term) ||
            reg.transactionId.toLowerCase().includes(term)
        );
    });
    renderTable(filtered);
});

// Export Data
document.getElementById('exportBtn').addEventListener('click', async () => {
    try {
        const response = await fetch('/api/admin/export', {
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'Zantram2K26_Registrations.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } else {
            alert('Export failed due to Unauthorized Access or Server Error');
        }
    } catch (err) {
        console.error('Export Error:', err);
        alert('An error occurred during export');
    }
});

// Modal Logic
const modal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const modalTxn = document.getElementById('modalTxn');
const closeModalBtn = document.querySelector('.close-modal');

let currentModalId = null;

function viewScreenshot(path, txnId, id) {
    currentModalId = id;
    modalImage.src = path;
    modalTxn.innerText = txnId;
    modal.style.display = 'flex';
}

function closeModal() {
    modal.style.display = 'none';
    currentModalId = null;
}

closeModalBtn.addEventListener('click', closeModal);

window.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeModal();
    }
});

// Modal action buttons
document.getElementById('modalApproveBtn').addEventListener('click', () => {
    if (currentModalId) updateStatus(currentModalId, 'Verified');
});

document.getElementById('modalRejectBtn').addEventListener('click', () => {
    if (currentModalId) updateStatus(currentModalId, 'Rejected');
});
