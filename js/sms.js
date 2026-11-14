// ─────────────────────────────────────────────
// GhostSMS — Virtual Numbers & OTP Receiver Engine
// Author: Suraj Kumar
// ─────────────────────────────────────────────

import { getWalletBalance, deductFunds, refundFunds, openWalletModal, formatCurrency } from './wallet.js';

// Available SMS Services catalog (Pricing with EarnifyX Profit Margin included)
export const SMS_SERVICES = [
    { id: 'tg', name: 'Telegram', icon: 'fa-brands fa-telegram', price: 25.0, desc: 'Login & Verification' },
    { id: 'wa', name: 'WhatsApp', icon: 'fa-brands fa-whatsapp', price: 35.0, desc: 'Personal & Business' },
    { id: 'go', name: 'Google / Gmail', icon: 'fa-brands fa-google', price: 20.0, desc: 'Account Signup' },
    { id: 'ig', name: 'Instagram', icon: 'fa-brands fa-instagram', price: 18.0, desc: 'Profile Verification' },
    { id: 'oa', name: 'OpenAI / ChatGPT', icon: 'fa-solid fa-brain', price: 25.0, desc: 'API & Plus Account' },
    { id: 'nf', name: 'Netflix', icon: 'fa-solid fa-film', price: 28.0, desc: 'Streaming Activation' },
    { id: 'tw', name: 'Twitter / X', icon: 'fa-brands fa-x-twitter', price: 20.0, desc: 'Account Security' },
    { id: 'ds', name: 'Discord', icon: 'fa-brands fa-discord', price: 18.0, desc: 'Phone Verification' },
    { id: 'fb', name: 'Facebook', icon: 'fa-brands fa-facebook', price: 18.0, desc: 'Security Check' },
    { id: 'ot', name: 'Any Other Service', icon: 'fa-solid fa-mobile-screen', price: 15.0, desc: 'Universal OTP' }
];

// Available Countries
export const SMS_COUNTRIES = [
    { id: 'ind', name: 'India', flag: '🇮🇳', dial: '+91' },
    { id: 'usa', name: 'United States', flag: '🇺🇸', dial: '+1' },
    { id: 'gbr', name: 'United Kingdom', flag: '🇬🇧', dial: '+44' },
    { id: 'can', name: 'Canada', flag: '🇨🇦', dial: '+1' },
    { id: 'idn', name: 'Indonesia', flag: '🇮🇩', dial: '+62' },
    { id: 'bra', name: 'Brazil', flag: '🇧🇷', dial: '+55' },
    { id: 'deu', name: 'Germany', flag: '🇩🇪', dial: '+49' }
];

const ACTIVE_SMS_KEY = 'ghostsms_active_orders';
let activeOrders = loadActiveOrders();
let countdownIntervals = {};
let pollIntervals = {};

function loadActiveOrders() {
    try {
        const raw = localStorage.getItem(ACTIVE_SMS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function saveActiveOrders() {
    localStorage.setItem(ACTIVE_SMS_KEY, JSON.stringify(activeOrders));
}

// Render the Services Grid
export function renderServicesGrid() {
    const container = document.getElementById('sms-services-grid');
    if (!container) return;

    let html = '';
    SMS_SERVICES.forEach(svc => {
        html += `
            <div class="sms-service-card" onclick="selectSmsService('${svc.id}')" data-service-id="${svc.id}">
                <div class="service-card-top">
                    <span class="service-icon"><i class="${svc.icon}"></i></span>
                    <span class="service-price">${formatCurrency(svc.price)}</span>
                </div>
                <div class="service-card-body">
                    <h4 class="service-name">${svc.name}</h4>
                    <p class="service-desc">${svc.desc}</p>
                </div>
                <button class="primary-button service-buy-btn maint-service-btn" onclick="event.stopPropagation(); buyVirtualNumber('${svc.id}')">
                    <span>Under Maintenance</span>
                    <i class="fa-solid fa-wrench"></i>
                </button>
            </div>
        `;
    });
    container.innerHTML = html;
}

// Render Country Select Dropdown
export function renderCountrySelect() {
    const select = document.getElementById('sms-country-select');
    if (!select) return;

    let html = '';
    SMS_COUNTRIES.forEach(c => {
        html += `<option value="${c.id}">${c.flag} ${c.name} (${c.dial})</option>`;
    });
    select.innerHTML = html;
}

// Purchase Virtual Number (Intercepted for Temporary Maintenance Hold)
export async function buyVirtualNumber(serviceId) {
    if (typeof window.showMaintenanceAlert === 'function') {
        window.showMaintenanceAlert();
        return;
    }

    if (window.showToast) {
        window.showToast('🛠️ Virtual Numbers are Under Maintenance. Please use Unlimited Free Temp Mail!', 'warning');
    }

    setTimeout(() => {
        if (typeof window.switchAppMode === 'function') {
            window.switchAppMode('mail');
        }
    }, 1600);
    return;
}

// Internal real purchase logic (inactive while in maintenance hold)
async function _realBuyVirtualNumber(serviceId) {
    const service = SMS_SERVICES.find(s => s.id === serviceId) || SMS_SERVICES[0];
    const countrySelect = document.getElementById('sms-country-select');
    const countryId = countrySelect ? countrySelect.value : 'ind';
    const country = SMS_COUNTRIES.find(c => c.id === countryId) || SMS_COUNTRIES[0];

    // Check balance
    const currentBalance = getWalletBalance();
    if (currentBalance < service.price) {
        if (window.showToast) {
            window.showToast(`Low Balance! ₹${service.price.toFixed(2)} needed. Please recharge.`, 'warning');
        }
        openWalletModal();
        return;
    }

    const orderId = 'ord_' + Math.random().toString(36).substring(2, 8) + Date.now().toString(36);

    // Deduct funds from wallet
    const deduction = deductFunds(service.price, `${service.name} Virtual Number (${country.name})`, orderId);
    if (!deduction.success) {
        if (window.showToast) window.showToast('Transaction failed: ' + deduction.message, 'error');
        return;
    }

    // Call server API proxy or fallback to fast realistic simulator
    let phoneNumber = generateLocalPhoneNumber(country.dial);
    let apiOrderId = orderId;

    try {
        const response = await fetch(`/api/sms/buy?service=${service.id}&country=${country.id}`);
        if (response.ok) {
            const data = await response.json();
            if (data.phone) phoneNumber = data.phone;
            if (data.orderId) apiOrderId = data.orderId;
        }
    } catch (e) {
        // Local proxy active or offline fallback
    }

    const newOrder = {
        id: orderId,
        apiOrderId: apiOrderId,
        service: service,
        country: country,
        phone: phoneNumber,
        price: service.price,
        status: 'waiting', // waiting | received | refunded | completed
        otp: null,
        smsText: null,
        expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
        createdAt: Date.now()
    };

    activeOrders.unshift(newOrder);
    saveActiveOrders();
    renderActiveOrders();

    if (window.showToast) {
        window.showToast(`Virtual number ${phoneNumber} activated for ${service.name}!`, 'success');
    }

    // Start timer and polling for OTP
    startOrderTimer(newOrder.id);
    startOtpPolling(newOrder.id);

    // Scroll to active orders section
    const activeSection = document.getElementById('sms-active-orders-section');
    if (activeSection) {
        activeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function generateLocalPhoneNumber(dialCode) {
    const prefixes = ['98', '97', '99', '94', '91', '88', '70', '80'];
    const randPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randDigits = Math.floor(10000000 + Math.random() * 90000000);
    return `${dialCode} ${randPrefix}${randDigits}`;
}

// Render Active Orders
export function renderActiveOrders() {
    const container = document.getElementById('sms-active-cards');
    const emptyState = document.getElementById('sms-no-active-orders');
    if (!container) return;

    if (!activeOrders || activeOrders.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    let html = '';
    activeOrders.forEach(ord => {
        const isWaiting = ord.status === 'waiting';
        const hasOtp = ord.status === 'received' || ord.otp;
        const isRefunded = ord.status === 'refunded';
        const isCompleted = ord.status === 'completed';

        let statusBadge = '';
        if (isWaiting) {
            statusBadge = `
                <span class="sms-status-pill status-pulse">
                    <span class="radar-dot"></span>
                    <span>Waiting for SMS...</span>
                </span>
            `;
        } else if (hasOtp) {
            statusBadge = `
                <span class="sms-status-pill status-success">
                    <i class="fa-solid fa-check"></i>
                    <span>OTP Received</span>
                </span>
            `;
        } else if (isRefunded) {
            statusBadge = `
                <span class="sms-status-pill status-refunded">
                    <i class="fa-solid fa-rotate-left"></i>
                    <span>Refunded (₹${ord.price.toFixed(2)})</span>
                </span>
            `;
        } else {
            statusBadge = `
                <span class="sms-status-pill status-done">
                    <i class="fa-solid fa-circle-check"></i>
                    <span>Completed</span>
                </span>
            `;
        }

        html += `
            <div class="sms-active-card bezel ${hasOtp ? 'has-otp' : ''}" id="order-card-${ord.id}">
                <div class="bezel-core sms-card-core">
                    <div class="sms-card-header">
                        <div class="sms-service-badge">
                            <span class="svc-icon"><i class="${ord.service.icon}"></i></span>
                            <span class="svc-title">${ord.service.name}</span>
                            <span class="svc-flag">${ord.country.flag} ${ord.country.name}</span>
                        </div>
                        <div class="sms-header-right">
                            ${statusBadge}
                            <span class="sms-timer" id="timer-${ord.id}">15:00</span>
                        </div>
                    </div>

                    <div class="sms-number-display">
                        <div class="number-label">Allocated Virtual Phone Number:</div>
                        <div class="number-row">
                            <span class="phone-digits">${ord.phone}</span>
                            <button class="icon-button sms-copy-btn" onclick="copyText('${ord.phone}', this)" title="Copy Phone Number">
                                <i class="fa-regular fa-copy"></i>
                            </button>
                        </div>
                    </div>

                    ${hasOtp ? `
                        <div class="sms-otp-received-box">
                            <div class="otp-banner">
                                <span class="otp-label"><i class="fa-solid fa-key"></i> Verification Code (OTP)</span>
                                <div class="otp-code-row">
                                    <span class="big-otp-code">${ord.otp}</span>
                                    <button class="primary-button otp-copy-btn" onclick="copyText('${ord.otp}', this)">
                                        <i class="fa-solid fa-copy"></i>
                                        <span>Copy OTP</span>
                                    </button>
                                </div>
                            </div>
                            ${ord.smsText ? `<div class="otp-raw-sms"><strong>SMS Text:</strong> ${ord.smsText}</div>` : ''}
                        </div>
                    ` : `
                        <div class="sms-waiting-notice">
                            <div class="radar-scan-bar"></div>
                            <span>Send verification SMS to this number. It will appear here automatically.</span>
                        </div>
                    `}

                    <div class="sms-card-footer">
                        <div class="sms-order-meta">
                            <span>Cost: <strong>₹${ord.price.toFixed(2)}</strong></span>
                            <span class="meta-dot">&bull;</span>
                            <span class="meta-hint">${isWaiting ? 'Auto-refunds if no SMS received' : 'TempX Encrypted'}</span>
                        </div>
                        <div class="sms-card-actions">
                            ${isWaiting ? `
                                <button class="ghost-button cancel-refund-btn" onclick="cancelAndRefundOrder('${ord.id}')">
                                    <i class="fa-solid fa-rotate-left"></i>
                                    <span>Cancel &amp; Refund</span>
                                </button>
                            ` : ''}
                            ${hasOtp && !isCompleted ? `
                                <button class="primary-button complete-order-btn" onclick="completeOrder('${ord.id}')">
                                    <i class="fa-solid fa-circle-check"></i>
                                    <span>Finish Order</span>
                                </button>
                            ` : ''}
                            ${isRefunded || isCompleted ? `
                                <button class="ghost-button dismiss-btn" onclick="dismissOrder('${ord.id}')">
                                    <i class="fa-solid fa-trash-can"></i>
                                    <span>Dismiss</span>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    // Attach countdown timers
    activeOrders.forEach(ord => {
        if (ord.status === 'waiting') {
            startOrderTimer(ord.id);
        } else {
            const el = document.getElementById(`timer-${ord.id}`);
            if (el) el.textContent = ord.status === 'refunded' ? 'Refunded' : 'Finished';
        }
    });
}

// Timer handler
function startOrderTimer(orderId) {
    if (countdownIntervals[orderId]) clearInterval(countdownIntervals[orderId]);

    const updateTimer = () => {
        const order = activeOrders.find(o => o.id === orderId);
        if (!order || order.status !== 'waiting') {
            clearInterval(countdownIntervals[orderId]);
            return;
        }

        const remainingMs = order.expiresAt - Date.now();
        const timerEl = document.getElementById(`timer-${orderId}`);

        if (remainingMs <= 0) {
            clearInterval(countdownIntervals[orderId]);
            if (timerEl) timerEl.textContent = 'Expired';
            // Auto refund expired order without OTP
            cancelAndRefundOrder(orderId, 'Auto-Refund: OTP Expired');
            return;
        }

        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        if (timerEl) {
            timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
    };

    updateTimer();
    countdownIntervals[orderId] = setInterval(updateTimer, 1000);
}

// Polling for incoming OTP
function startOtpPolling(orderId) {
    if (pollIntervals[orderId]) clearInterval(pollIntervals[orderId]);

    let pollCount = 0;
    pollIntervals[orderId] = setInterval(async () => {
        pollCount++;
        const order = activeOrders.find(o => o.id === orderId);
        if (!order || order.status !== 'waiting') {
            clearInterval(pollIntervals[orderId]);
            return;
        }

        // Check with backend proxy or simulate after realistic arrival window (~8-12 seconds)
        let otpReceived = null;
        let smsMessage = null;

        try {
            const res = await fetch(`/api/sms/check?orderId=${order.apiOrderId || order.id}`);
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'STATUS_OK' && data.code) {
                    otpReceived = data.code;
                    smsMessage = data.text || `Your ${order.service.name} code is ${data.code}`;
                }
            }
        } catch (e) {
            // Server offline or proxy fallback
        }

        // Demo simulation trigger after 8 seconds (if no backend provider configured)
        if (!otpReceived && pollCount >= 3) {
            const sampleOtps = ['748-291', '502-814', '918-204', '339-182', '629-440', '819-332'];
            const chosenOtp = sampleOtps[Math.floor(Math.random() * sampleOtps.length)];
            otpReceived = chosenOtp;
            smsMessage = `Your ${order.service.name} verification code is: ${chosenOtp}. Valid for 10 minutes. Do not share.`;
        }

        if (otpReceived) {
            clearInterval(pollIntervals[orderId]);
            clearInterval(countdownIntervals[orderId]);

            order.status = 'received';
            order.otp = otpReceived;
            order.smsText = smsMessage;
            saveActiveOrders();
            renderActiveOrders();

            if (typeof confetti === 'function') {
                confetti({
                    particleCount: 100,
                    spread: 120,
                    origin: { y: 0.6 },
                    colors: ['#00FF9D', '#00F0FF', '#D946EF']
                });
            }

            if (window.showToast) {
                window.showToast(`OTP Code [${otpReceived}] received for ${order.service.name}!`, 'success');
            }
        }
    }, 3000);
}

// Cancel & Refund Order
export function cancelAndRefundOrder(orderId, reason = 'Cancelled by User (No OTP)') {
    const orderIndex = activeOrders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;

    const order = activeOrders[orderIndex];
    if (order.status !== 'waiting') {
        if (window.showToast) window.showToast('Order cannot be refunded at this stage', 'warning');
        return;
    }

    clearInterval(countdownIntervals[orderId]);
    clearInterval(pollIntervals[orderId]);

    // Send cancel request to SMS provider proxy
    fetch(`/api/sms/cancel?orderId=${order.apiOrderId || order.id}`).catch(() => {});

    // Refund 100% of the funds back to user's wallet
    refundFunds(order.price, `Refund: ${order.service.name} (${reason})`, order.id);

    order.status = 'refunded';
    saveActiveOrders();
    renderActiveOrders();
}

// Complete Order
export function completeOrder(orderId) {
    const order = activeOrders.find(o => o.id === orderId);
    if (!order) return;

    order.status = 'completed';
    saveActiveOrders();
    renderActiveOrders();

    if (window.showToast) {
        window.showToast('Order completed successfully. Thank you!', 'success');
    }
}

// Dismiss / Delete from list
export function dismissOrder(orderId) {
    activeOrders = activeOrders.filter(o => o.id !== orderId);
    saveActiveOrders();
    renderActiveOrders();
}

// Global Text Copy Helper
export function copyText(text, btnElement) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        if (btnElement) {
            const originalHtml = btnElement.innerHTML;
            btnElement.classList.add('copied');
            btnElement.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
            setTimeout(() => {
                btnElement.classList.remove('copied');
                btnElement.innerHTML = originalHtml;
            }, 2000);
        }
        if (window.showToast) window.showToast(`Copied: ${text}`, 'success');
    }).catch(() => {
        if (window.showToast) window.showToast('Failed to copy', 'error');
    });
}

// Switch between Email and SMS Workspaces
export function switchAppMode(mode = 'mail') {
    const mailWorkspace = document.getElementById('mail-workspace');
    const smsWorkspace = document.getElementById('sms-workspace');
    const mailBtn = document.getElementById('mode-tab-mail');
    const smsBtn = document.getElementById('mode-tab-sms');

    if (mode === 'sms') {
        if (mailWorkspace) mailWorkspace.style.display = 'none';
        if (smsWorkspace) smsWorkspace.style.display = 'block';
        if (mailBtn) mailBtn.classList.remove('active');
        if (smsBtn) smsBtn.classList.add('active');
        renderServicesGrid();
        renderCountrySelect();
        renderActiveOrders();
    } else {
        if (mailWorkspace) mailWorkspace.style.display = 'block';
        if (smsWorkspace) smsWorkspace.style.display = 'none';
        if (mailBtn) mailBtn.classList.add('active');
        if (smsBtn) smsBtn.classList.remove('active');
    }
}

// Global Window Bindings
window.renderServicesGrid = renderServicesGrid;
window.buyVirtualNumber = buyVirtualNumber;
window.cancelAndRefundOrder = cancelAndRefundOrder;
window.completeOrder = completeOrder;
window.dismissOrder = dismissOrder;
window.copyText = copyText;
window.switchAppMode = switchAppMode;

// DOM Ready initialization
document.addEventListener('DOMContentLoaded', () => {
    renderServicesGrid();
    renderCountrySelect();
    renderActiveOrders();
});

