// ─────────────────────────────────────────────
// TempX — Wallet & Multi-Currency Engine
// Author: Suraj Kumar
// ─────────────────────────────────────────────

const WALLET_STORAGE_KEY = 'ghost_wallet_data';
const CURRENCY_STORAGE_KEY = 'tempx_currency';

// Currency Configuration (Base = INR)
export const CURRENCY_CONFIG = {
    INR: { symbol: '₹', rate: 1.0, precision: 2, label: 'INR (₹)' },
    USD: { symbol: '$', rate: 1 / 88.0, precision: 2, label: 'USD ($)' },
    USDT: { symbol: 'USDT', rate: 1 / 88.0, precision: 2, label: 'USDT (₮)' }
};

// Get active currency code
export function getCurrentCurrency() {
    return localStorage.getItem(CURRENCY_STORAGE_KEY) || 'INR';
}

// Set active currency code
export function setCurrentCurrency(curr) {
    if (CURRENCY_CONFIG[curr]) {
        localStorage.setItem(CURRENCY_STORAGE_KEY, curr);
        updateWalletUI();
        if (window.renderServicesGrid) {
            window.renderServicesGrid();
        }
        if (window.showToast) {
            window.showToast(`Display currency switched to ${curr}`, 'info');
        }
    }
}

// Convert INR amount to active currency string
export function formatCurrency(amountInINR, includeSymbol = true) {
    const curr = getCurrentCurrency();
    const cfg = CURRENCY_CONFIG[curr] || CURRENCY_CONFIG.INR;
    const converted = amountInINR * cfg.rate;
    const formatted = converted.toFixed(cfg.precision);
    if (!includeSymbol) return formatted;
    if (curr === 'USDT') return `${formatted} USDT`;
    return `${cfg.symbol}${formatted}`;
}

// Helper: Get wallet object (Enforcing 0.00 balance for all users)
export function getWallet() {
    try {
        const resetKey = 'tempx_balance_zero_v2';
        const raw = localStorage.getItem(WALLET_STORAGE_KEY);
        
        // Force reset existing balances to 0.00
        if (!localStorage.getItem(resetKey)) {
            const zeroWallet = {
                balance: 0.0,
                currency: '₹',
                transactions: []
            };
            localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(zeroWallet));
            localStorage.setItem(resetKey, 'true');
            return zeroWallet;
        }

        if (!raw) {
            const initial = {
                balance: 0.0,
                currency: '₹',
                transactions: []
            };
            saveWallet(initial);
            return initial;
        }
        return JSON.parse(raw);
    } catch (e) {
        return { balance: 0.0, currency: '₹', transactions: [] };
    }
}

// Helper: Save wallet object
export function saveWallet(wallet) {
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(wallet));
    updateWalletUI();
}

// Get numeric balance in INR
export function getWalletBalance() {
    return getWallet().balance || 0.0;
}

// Deduct funds for number purchase (amount in INR)
export function deductFunds(amount, description = 'Virtual Number Purchase', orderId = '') {
    const wallet = getWallet();
    if (wallet.balance < amount) {
        return { success: false, message: 'Insufficient funds in wallet' };
    }

    wallet.balance = parseFloat((wallet.balance - amount).toFixed(2));
    wallet.transactions.unshift({
        id: 'tx_' + Date.now(),
        orderId: orderId,
        type: 'debit',
        title: description,
        amount: -amount,
        date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
        status: 'completed'
    });

    saveWallet(wallet);
    return { success: true, newBalance: wallet.balance };
}

// Refund funds when OTP doesn't arrive or order cancelled
export function refundFunds(amount, description = 'Refund: Order Cancelled', orderId = '') {
    const wallet = getWallet();
    wallet.balance = parseFloat((wallet.balance + amount).toFixed(2));
    wallet.transactions.unshift({
        id: 'tx_ref_' + Date.now(),
        orderId: orderId,
        type: 'refund',
        title: description,
        amount: +amount,
        date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
        status: 'refunded'
    });

    saveWallet(wallet);

    if (window.showToast) {
        window.showToast(`${formatCurrency(amount)} refunded to your wallet!`, 'info');
    }

    return { success: true, newBalance: wallet.balance };
}

// Add funds / recharge (amount in INR)
export function rechargeWallet(amount, method = 'UPI Transfer') {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return { success: false, message: 'Invalid amount' };

    const wallet = getWallet();
    wallet.balance = parseFloat((wallet.balance + num).toFixed(2));
    wallet.transactions.unshift({
        id: 'tx_rec_' + Date.now(),
        type: 'credit',
        title: `Recharge (${method})`,
        amount: +num,
        date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
        status: 'completed'
    });

    saveWallet(wallet);

    if (typeof confetti === 'function') {
        confetti({
            particleCount: 90,
            spread: 100,
            origin: { y: 0.6 },
            colors: ['#00FF9D', '#00F0FF', '#F3BA2F', '#D946EF']
        });
    }

    if (window.showToast) {
        window.showToast(`Wallet credited with ${formatCurrency(num)}!`, 'success');
    }

    return { success: true, newBalance: wallet.balance };
}

// Update Wallet UI elements in header and modal
export function updateWalletUI() {
    const wallet = getWallet();
    const curr = getCurrentCurrency();
    const cfg = CURRENCY_CONFIG[curr] || CURRENCY_CONFIG.INR;

    const balancePill = document.getElementById('wallet-balance-val');
    const currencyPill = document.getElementById('nav-wallet-currency');
    const modalBalance = document.getElementById('modal-wallet-balance');
    const txContainer = document.getElementById('wallet-tx-history');
    const currSelect = document.getElementById('app-currency-select');

    if (currSelect && currSelect.value !== curr) {
        currSelect.value = curr;
    }

    // Convert balance according to current currency
    const convertedBalance = (wallet.balance * cfg.rate).toFixed(cfg.precision);

    if (balancePill) {
        balancePill.textContent = convertedBalance;
    }
    if (currencyPill) {
        currencyPill.textContent = cfg.symbol;
    }
    if (modalBalance) {
        modalBalance.textContent = curr === 'USDT' ? `${convertedBalance} USDT` : `${cfg.symbol}${convertedBalance}`;
    }

    // Render transactions history in wallet modal
    if (txContainer) {
        if (!wallet.transactions || wallet.transactions.length === 0) {
            txContainer.innerHTML = '<div class="no-tx-note">No transactions recorded yet.</div>';
            return;
        }

        let html = '';
        wallet.transactions.slice(0, 15).forEach(tx => {
            const isPos = tx.amount > 0;
            const sign = isPos ? '+' : '-';
            const absInINR = Math.abs(tx.amount);
            const colorClass = tx.type === 'refund' ? 'tx-refund' : (isPos ? 'tx-credit' : 'tx-debit');
            const icon = tx.type === 'refund' 
                ? 'fa-rotate-left' 
                : (isPos ? 'fa-arrow-down-left' : 'fa-arrow-up-right');

            html += `
                <div class="tx-item">
                    <div class="tx-item-left">
                        <span class="tx-icon-badge ${colorClass}">
                            <i class="fa-solid ${icon}"></i>
                        </span>
                        <div class="tx-info">
                            <span class="tx-title">${tx.title}</span>
                            <span class="tx-date">${tx.date}</span>
                        </div>
                    </div>
                    <div class="tx-amount ${colorClass}">
                        ${sign}${formatCurrency(absInINR)}
                    </div>
                </div>
            `;
        });
        txContainer.innerHTML = html;
    }
}

// Modal open / close
export function openWalletModal() {
    const modal = document.getElementById('wallet-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    updateWalletUI();
}

export function closeWalletModal() {
    const modal = document.getElementById('wallet-modal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
}

export function handleQuickRecharge(amountInINR) {
    rechargeWallet(amountInINR, 'Instant Demo Top-up');
}

export function handleCustomRecharge(e) {
    e.preventDefault();
    const input = document.getElementById('custom-recharge-amount');
    if (!input) return;
    const val = parseFloat(input.value);
    if (!val || val <= 0) {
        if (window.showToast) window.showToast('Enter valid amount', 'warning');
        return;
    }
    rechargeWallet(val, 'UPI / Instant Gateway');
    input.value = '';
}

// Switch between Recharge Tabs (UPI / Demo vs Binance Pay)
export function switchWalletTab(tabId) {
    const upiSection = document.getElementById('wallet-tab-upi-content');
    const binanceSection = document.getElementById('wallet-tab-binance-content');
    const tabUpi = document.getElementById('w-tab-btn-upi');
    const tabBinance = document.getElementById('w-tab-btn-binance');

    if (tabId === 'binance') {
        if (upiSection) upiSection.style.display = 'none';
        if (binanceSection) binanceSection.style.display = 'block';
        if (tabUpi) tabUpi.classList.remove('active');
        if (tabBinance) tabBinance.classList.add('active');
    } else {
        if (upiSection) upiSection.style.display = 'block';
        if (binanceSection) binanceSection.style.display = 'none';
        if (tabUpi) tabUpi.classList.add('active');
        if (tabBinance) tabBinance.classList.remove('active');
    }
}

// Binance Pay Recharge Handler
export function handleBinanceRecharge(usdtAmount) {
    const usdt = parseFloat(usdtAmount) || 1.0;
    const inrEquivalent = usdt * 88.0; // 1 USDT = ₹88
    
    // Auto-credit with Binance Pay simulation
    rechargeWallet(inrEquivalent, `Binance Pay (${usdt} USDT)`);
    if (window.showToast) {
        window.showToast(`Binance Pay Verified! +${usdt} USDT credited to your wallet!`, 'success');
    }
}

// Global window bindings
window.openWalletModal = openWalletModal;
window.closeWalletModal = closeWalletModal;
window.handleQuickRecharge = handleQuickRecharge;
window.handleCustomRecharge = handleCustomRecharge;
window.changeAppCurrency = setCurrentCurrency;
window.switchWalletTab = switchWalletTab;
window.handleBinanceRecharge = handleBinanceRecharge;

// Close modal on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeWalletModal();
});

document.addEventListener('DOMContentLoaded', () => {
    updateWalletUI();
});


