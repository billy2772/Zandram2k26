// --- Navigation Smooth Scroll ---
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });    
});

// --- Countdown Timer ---
// Set symposium date, e.g., April 20, 2026
const symposiumDate = new Date("April 20, 2026 09:00:00").getTime();

function updateCountdown() {
    const now = new Date().getTime();
    const distance = symposiumDate - now;

    if (distance < 0) {
        document.getElementById("countdown").innerHTML = "<h3>SYMPOSIUM HAS STARTED</h3>";
        return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    document.getElementById("days").innerText = days < 10 ? '0' + days : days;
    document.getElementById("hours").innerText = hours < 10 ? '0' + hours : hours;
    document.getElementById("minutes").innerText = minutes < 10 ? '0' + minutes : minutes;
    document.getElementById("seconds").innerText = seconds < 10 ? '0' + seconds : seconds;
}

setInterval(updateCountdown, 1000);
updateCountdown();

// --- Form Submission Logic ---
const form = document.getElementById('registrationForm');
const msgBox = document.getElementById('formMessage');
const submitBtn = document.getElementById('submitBtn');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Check if at least one event is selected
    const selectedEvents = document.querySelectorAll('input[name="selectedEvents"]:checked');
    if (selectedEvents.length === 0) {
        showMessage('Please select at least one event to participate.', 'error');
        return;
    }
    
    submitBtn.innerText = 'PROCESSING REQUEST...';
    submitBtn.disabled = true;
    
    const formData = new FormData(form);
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage(data.message, 'success');
            form.reset();
        } else {
            showMessage(data.error || 'Registration failed.', 'error');
        }
    } catch (error) {
        showMessage('Unable to connect to the server. Please check your connection.', 'error');
        console.error('Error:', error);
    } finally {
        submitBtn.innerHTML = 'Submit Registration <span class="btn-glitch"></span>';
        submitBtn.disabled = false;
    }
});

function showMessage(msg, type) {
    msgBox.textContent = msg;
    msgBox.className = type === 'success' ? 'success-msg' : 'error-msg';
    msgBox.classList.remove('hidden');
    
    // Scroll to message
    msgBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Hide after 6 seconds
    setTimeout(() => {
        msgBox.classList.add('hidden');
    }, 6000);
}
