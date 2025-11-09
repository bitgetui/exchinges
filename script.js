// script.js - Cryptocurrency Exchange Demo JavaScript

// ==========================================
// Global Variables
// ==========================================
let currentBalance = 4876367436636; // USDT
let selectedCoin = null;
let marketData = [];
let positions = [];
let orderType = 'buy';
let tradingMode = 'spot';
let chart = null;
let futuresChart = null;
let updateInterval = null;
let priceHistory = {};
let userHoldings = {};

// ==========================================
// Initialize Application
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    fetchMarketData();
    
    // Update market data every 5 seconds
    updateInterval = setInterval(() => {
        fetchMarketData();
        updatePriceDisplay();
    }, 5000);
    
    // Initialize charts
    initializeChart();
    initializeFuturesChart();
    
    // Load saved data from localStorage
    loadSavedData();
});

// ==========================================
// Core Initialization
// ==========================================
function initializeApp() {
    // Tab Navigation
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            e.preventDefault();
            switchTab(this.dataset.tab);
        });
    });

    // Order Type Tabs (Buy/Sell)
    const orderTabs = document.querySelectorAll('.order-tab');
    orderTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            orderTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            orderType = this.dataset.type;
            updateOrderButton();
        });
    });

    // Order Types (Market/Limit/Stop-Limit)
    const orderTypeBtns = document.querySelectorAll('.order-type-btn');
    orderTypeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            orderTypeBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const isMarket = this.dataset.order === 'market';
            const priceInput = document.getElementById('priceInput');
            
            if (priceInput) {
                priceInput.disabled = isMarket;
                if (isMarket) {
                    priceInput.value = '';
                    priceInput.placeholder = 'Market Price';
                } else {
                    priceInput.placeholder = selectedCoin ? formatPrice(selectedCoin.current_price) : '0.00';
                }
            }
        });
    });

    // Percentage Buttons
    const percentageBtns = document.querySelectorAll('.percentage-btn');
    percentageBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const percent = parseInt(this.dataset.percent);
            calculateAmountByPercentage(percent);
        });
    });

    // Amount Input
    const amountInput = document.getElementById('amountInput');
    if (amountInput) {
        amountInput.addEventListener('input', calculateOrderTotal);
    }

    // Submit Order Button
    const submitBtn = document.getElementById('submitOrderBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitOrder);
    }

    // Search Input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterCoins);
    }

    // Filter Buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            applyFilter(this.dataset.filter);
        });
    });

    // Timeframe Buttons
    const timeframeBtns = document.querySelectorAll('.timeframe-btn');
    timeframeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            timeframeBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            updateChartTimeframe(this.dataset.time);
        });
    });

    // Leverage Slider (Futures)
    const leverageSlider = document.getElementById('leverageSlider');
    const leverageInput = document.getElementById('leverageInput');
    if (leverageSlider && leverageInput) {
        leverageSlider.addEventListener('input', function() {
            leverageInput.value = this.value + 'x';
            calculateFuturesMargin();
        });
        
        leverageInput.addEventListener('change', function() {
            const value = parseInt(this.value);
            if (value >= 1 && value <= 125) {
                leverageSlider.value = value;
                this.value = value + 'x';
            }
        });
    }

    // Futures Submit Button
    const futuresBtn = document.getElementById('submitFuturesBtn');
    if (futuresBtn) {
        futuresBtn.addEventListener('click', submitFuturesOrder);
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', function(e) {
        // Press 'B' for Buy
        if (e.key === 'b' || e.key === 'B') {
            if (!e.target.matches('input')) {
                document.querySelector('.order-tab[data-type="buy"]')?.click();
            }
        }
        // Press 'S' for Sell
        if (e.key === 's' || e.key === 'S') {
            if (!e.target.matches('input')) {
                document.querySelector('.order-tab[data-type="sell"]')?.click();
            }
        }
        // Press 'ESC' to close modals
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

// ==========================================
// API and Data Management
// ==========================================
async function fetchMarketData() {
    try {
        const response = await fetch(
            'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=24h,7d'
        );
        
        if (!response.ok) {
            throw new Error('Failed to fetch market data');
        }
        
        const data = await response.json();
        marketData = data;
        
        // Store price history
        data.forEach(coin => {
            if (!priceHistory[coin.id]) {
                priceHistory[coin.id] = [];
            }
            priceHistory[coin.id].push({
                time: Date.now(),
                price: coin.current_price
            });
            
            // Keep only last 100 price points
            if (priceHistory[coin.id].length > 100) {
                priceHistory[coin.id].shift();
            }
        });
        
        displayMarketData(data);
        
        // Select first coin if none selected
        if (!selectedCoin && data.length > 0) {
            selectCoin(data[0]);
        } else if (selectedCoin) {
            // Update selected coin data
            const updatedCoin = data.find(coin => coin.id === selectedCoin.id);
            if (updatedCoin) {
                selectedCoin = updatedCoin;
                updateSelectedCoinDisplay();
            }
        }
        
    } catch (error) {
        console.error('Error fetching market data:', error);
        showToast('Error loading market data. Retrying...', 'error');
        
        // Retry after 3 seconds
        setTimeout(fetchMarketData, 3000);
    }
}

// ==========================================
// Display Functions
// ==========================================
function displayMarketData(coins) {
    const marketList = document.getElementById('marketList');
    if (!marketList) return;
    
    const html = coins.map(coin => {
        const isSelected = selectedCoin && selectedCoin.id === coin.id;
        const changeClass = coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative';
        const changeSymbol = coin.price_change_percentage_24h >= 0 ? '+' : '';
        
        return `
            <div class="market-item ${isSelected ? 'selected' : ''}" 
                 data-coin-id="${coin.id}"
                 onclick="selectCoinById('${coin.id}')">
                <div class="coin-info">
                    <img src="${coin.image}" alt="${coin.name}" class="coin-logo" onerror="this.src='https://via.placeholder.com/24'">
                    <div class="coin-name">
                        <span class="coin-symbol">${coin.symbol.toUpperCase()}/USDT</span>
                        <span class="coin-fullname">${coin.name}</span>
                    </div>
                </div>
                <div class="coin-price-info">
                    <div class="coin-price">$${formatPrice(coin.current_price)}</div>
                    <div class="coin-change ${changeClass}">
                        ${changeSymbol}${coin.price_change_percentage_24h.toFixed(2)}%
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    marketList.innerHTML = html;
    
    // Also update futures market list if it exists
    const futuresMarketList = document.getElementById('futuresMarketList');
    if (futuresMarketList) {
        futuresMarketList.innerHTML = html;
    }
}

function selectCoinById(coinId) {
    const coin = marketData.find(c => c.id === coinId);
    if (coin) {
        selectCoin(coin);
    }
}

function selectCoin(coin) {
    selectedCoin = coin;
    
    // Update selected coin display
    updateSelectedCoinDisplay();
    
    // Update market list selection
    document.querySelectorAll('.market-item').forEach(item => {
        item.classList.remove('selected');
        if (item.dataset.coinId === coin.id) {
            item.classList.add('selected');
        }
    });
    
    // Update chart
    updateChart(coin);
    
    // Save selection to localStorage
    localStorage.setItem('selectedCoin', coin.id);
}

function updateSelectedCoinDisplay() {
    if (!selectedCoin) return;
    
    // Update chart header
    const logoElement = document.getElementById('selectedCoinLogo');
    const nameElement = document.getElementById('selectedCoinName');
    const priceElement = document.getElementById('selectedCoinPrice');
    const changeElement = document.getElementById('selectedCoinChange');
    
    if (logoElement) {
        logoElement.src = selectedCoin.image;
        logoElement.alt = selectedCoin.name;
    }
    
    if (nameElement) {
        nameElement.textContent = `${selectedCoin.symbol.toUpperCase()}/USDT`;
    }
    
    if (priceElement) {
        priceElement.textContent = `$${formatPrice(selectedCoin.current_price)}`;
    }
    
    if (changeElement) {
        const changeValue = selectedCoin.price_change_percentage_24h;
        changeElement.textContent = `${changeValue >= 0 ? '+' : ''}${changeValue.toFixed(2)}%`;
        changeElement.className = `chart-change ${changeValue >= 0 ? 'positive' : 'negative'}`;
    }
    
    // Update order panel
    const amountSuffix = document.getElementById('amountSuffix');
    const priceInput = document.getElementById('priceInput');
    const currentMarketPrice = document.getElementById('currentMarketPrice');
    const maxAmount = document.getElementById('maxAmount');
    
    if (amountSuffix) {
        amountSuffix.textContent = selectedCoin.symbol.toUpperCase();
    }
    
    if (priceInput && !priceInput.disabled) {
        priceInput.value = formatPrice(selectedCoin.current_price);
    }
    
    if (currentMarketPrice) {
        currentMarketPrice.textContent = `$${formatPrice(selectedCoin.current_price)}`;
    }
    
    if (maxAmount) {
        const max = orderType === 'buy' 
            ? currentBalance / selectedCoin.current_price 
            : (userHoldings[selectedCoin.id] || 0);
        maxAmount.textContent = `Max: ${max.toFixed(8)}`;
    }
    
    updateOrderButton();
}

function updatePriceDisplay() {
    if (selectedCoin) {
        const updatedCoin = marketData.find(coin => coin.id === selectedCoin.id);
        if (updatedCoin) {
            selectedCoin = updatedCoin;
            updateSelectedCoinDisplay();
        }
    }
}

// ==========================================
// Chart Functions
// ==========================================
function initializeChart() {
    const ctx = document.getElementById('priceChart');
    if (!ctx) return;
    
    const chartConfig = {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Price',
                data: [],
                borderColor: '#fcd535',
                backgroundColor: 'rgba(252, 213, 53, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointBackgroundColor: '#fcd535',
                pointBorderColor: '#fcd535',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#fcd535'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#fcd535',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `Price: $${formatPrice(context.parsed.y)}`;
                        },
                        title: function(tooltipItems) {
                            return tooltipItems[0].label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#848e9c',
                        maxTicksLimit: 8,
                        maxRotation: 0
                    }
                },
                y: {
                    position: 'right',
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#848e9c',
                        callback: function(value) {
                            return '$' + formatPrice(value);
                        }
                    }
                }
            }
        }
    };
    
    chart = new Chart(ctx, chartConfig);
}

function initializeFuturesChart() {
    const ctx = document.getElementById('futuresChart');
    if (!ctx) return;
    
    futuresChart = new Chart(ctx, {
        type: 'candlestick',
        data: {
            datasets: [{
                label: 'Price',
                data: []
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function updateChart(coin) {
    if (!chart || !coin.sparkline_in_7d) return;
    
    const prices = coin.sparkline_in_7d.price;
    const timeframe = document.querySelector('.timeframe-btn.active')?.dataset.time || '1h';
    
    let dataPoints = prices;
    let labels = [];
    
    // Adjust data based on timeframe
    switch(timeframe) {
        case '1m':
            dataPoints = prices.slice(-60);
            labels = generateTimeLabels(60, 'minute');
            break;
        case '3m':
            dataPoints = prices.slice(-180);
            labels = generateTimeLabels(180, 'minute');
            break;
        case '5m':
            dataPoints = prices.slice(-300);
            labels = generateTimeLabels(300, 'minute');
            break;
        case '15m':
            dataPoints = prices.slice(-180);
            labels = generateTimeLabels(180, 'minute', 15);
            break;
        case '30m':
            dataPoints = prices.slice(-48);
            labels = generateTimeLabels(48, 'minute', 30);
            break;
        case '1h':
            dataPoints = prices.slice(-24);
            labels = generateTimeLabels(24, 'hour');
            break;
        case '4h':
            dataPoints = prices.slice(-42);
            labels = generateTimeLabels(42, 'hour', 4);
            break;
        case '1d':
            dataPoints = prices;
            labels = generateTimeLabels(prices.length, 'day');
            break;
        case '1w':
            dataPoints = prices;
            labels = generateTimeLabels(7, 'day');
            break;
        default:
            dataPoints = prices.slice(-24);
            labels = generateTimeLabels(24, 'hour');
    }
    
    // Update chart data
    chart.data.labels = labels;
    chart.data.datasets[0].data = dataPoints;
    
    // Update chart colors based on price change
    const color = coin.price_change_percentage_24h >= 0 ? '#0ecb81' : '#f6465d';
    chart.data.datasets[0].borderColor = color;
    chart.data.datasets[0].backgroundColor = coin.price_change_percentage_24h >= 0 
        ? 'rgba(14, 203, 129, 0.1)' 
        : 'rgba(246, 70, 93, 0.1)';
    
    chart.update('none'); // Update without animation for smooth real-time updates
}

function generateTimeLabels(count, unit, interval = 1) {
    const labels = [];
    const now = new Date();
    
    for (let i = count - 1; i >= 0; i--) {
        const date = new Date(now);
        
        switch(unit) {
            case 'minute':
                date.setMinutes(date.getMinutes() - (i * interval));
                labels.push(date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
                break;
            case 'hour':
                date.setHours(date.getHours() - (i * interval));
                labels.push(date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
                break;
            case 'day':
                date.setDate(date.getDate() - i);
                labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
                break;
        }
    }
    
    return labels;
}

function updateChartTimeframe(timeframe) {
    if (!selectedCoin) return;
    
    // Update chart with new timeframe
    updateChart(selectedCoin);
    
    // Show notification
    showToast(`Chart timeframe updated to ${timeframe.toUpperCase()}`, 'success');
    
    // Save preference
    localStorage.setItem('preferredTimeframe', timeframe);
}

// ==========================================
// Trading Functions
// ==========================================
function calculateOrderTotal() {
    if (!selectedCoin) return;
    
    const amountInput = document.getElementById('amountInput');
    const amount = parseFloat(amountInput?.value) || 0;
    const price = selectedCoin.current_price;
    const total = amount * price;
    const fee = total * 0.001; // 0.1% fee
    
    const orderTotal = document.getElementById('orderTotal');
    const orderFee = document.getElementById('orderFee');
    
    if (orderTotal) {
        orderTotal.textContent = `${formatPrice(total)} USDT`;
    }
    
    if (orderFee) {
        orderFee.textContent = `${formatPrice(fee)} USDT`;
    }
    
    return { total, fee };
}

function calculateAmountByPercentage(percent) {
    if (!selectedCoin) return;
    
    let availableAmount = 0;
    
    if (orderType === 'buy') {
        const availableBalance = currentBalance * (percent / 100);
        availableAmount = availableBalance / selectedCoin.current_price;
    } else {
        // For sell orders, use user's holdings
        const holdings = userHoldings[selectedCoin.id] || 0;
        availableAmount = holdings * (percent / 100);
    }
    
    const amountInput = document.getElementById('amountInput');
    if (amountInput) {
        amountInput.value = availableAmount.toFixed(8);
        calculateOrderTotal();
    }
}

function submitOrder() {
    const amountInput = document.getElementById('amountInput');
    const amount = parseFloat(amountInput?.value);
    
    if (!selectedCoin || !amount || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    
    const { total, fee } = calculateOrderTotal();
    const totalWithFee = orderType === 'buy' ? total + fee : total - fee;
    
    // Validate order
    if (orderType === 'buy' && totalWithFee > currentBalance) {
        showToast('Insufficient balance', 'error');
        return;
    }
    
    if (orderType === 'sell') {
        const holdings = userHoldings[selectedCoin.id] || 0;
        if (amount > holdings) {
            showToast(`Insufficient ${selectedCoin.symbol.toUpperCase()} balance`, 'error');
            return;
        }
    }
    
    // Process order
    if (orderType === 'buy') {
        currentBalance -= totalWithFee;
        userHoldings[selectedCoin.id] = (userHoldings[selectedCoin.id] || 0) + amount;
        
        showToast(
            `✅ Bought ${amount.toFixed(4)} ${selectedCoin.symbol.toUpperCase()} for ${formatPrice(total)} USDT`,
            'success'
        );
        
        // Add to order history
        addToOrderHistory({
            type: 'buy',
            coin: selectedCoin.symbol,
            amount: amount,
            price: selectedCoin.current_price,
            total: total,
            fee: fee,
            time: new Date().toISOString()
        });
        
    } else {
        currentBalance += totalWithFee;
        userHoldings[selectedCoin.id] -= amount;
        
        showToast(
            `✅ Sold ${amount.toFixed(4)} ${selectedCoin.symbol.toUpperCase()} for ${formatPrice(total)} USDT`,
            'success'
        );
        
        // Add to order history
        addToOrderHistory({
            type: 'sell',
            coin: selectedCoin.symbol,
            amount: amount,
            price: selectedCoin.current_price,
            total: total,
            fee: fee,
            time: new Date().toISOString()
        });
    }
    
    // Update balance display
    updateBalanceDisplay();
    
    // Reset form
    if (amountInput) amountInput.value = '';
    calculateOrderTotal();
    
    // Save data
    saveUserData();
}

function submitFuturesOrder() {
    const sizeInput = document.getElementById('futuresSizeInput');
    const leverageSlider = document.getElementById('leverageSlider');
    
    const size = parseFloat(sizeInput?.value);
    const leverage = parseInt(leverageSlider?.value) || 1;
    
    if (!selectedCoin || !size || size <= 0) {
        showToast('Please enter a valid contract size', 'error');
        return;
    }
    
    const margin = (size * selectedCoin.current_price) / leverage;
    
    if (margin > currentBalance) {
        showToast('Insufficient margin balance', 'error');
        return;
    }
    
    // Create futures position
    const position = {
        id: Date.now(),
        symbol: selectedCoin.symbol.toUpperCase() + '-PERP',
        side: orderType === 'long' ? 'Long' : 'Short',
        size: size,
        entryPrice: selectedCoin.current_price,
        markPrice: selectedCoin.current_price,
        leverage: leverage,
        margin: margin,
        pnl: 0,
        pnlPercent: 0,
        time: new Date().toISOString()
    };
    
    positions.push(position);
    currentBalance -= margin;
    
    showToast(
        `✅ Opened ${position.side} position: ${size} ${position.symbol} at ${leverage}x leverage`,
        'success'
    );
    
    // Update displays
    updateBalanceDisplay();
    updatePositionsTable();
    
    // Reset form
    if (sizeInput) sizeInput.value = '';
    
    // Save data
    saveUserData();
}

function closePosition(positionId) {
    const position = positions.find(p => p.id === positionId);
    if (!position) return;
    
    // Calculate final PNL
    const currentPrice = selectedCoin?.current_price || position.markPrice;
    const priceDiff = position.side === 'Long' 
        ? currentPrice - position.entryPrice 
        : position.entryPrice - currentPrice;
    
    const pnl = (priceDiff / position.entryPrice) * position.margin * position.leverage;
    
    // Update balance
    currentBalance += position.margin + pnl;
    
    // Remove position
    positions = positions.filter(p => p.id !== positionId);
    
    showToast(
        `Position closed. PNL: ${pnl >= 0 ? '+' : ''}${formatPrice(pnl)} USDT`,
        pnl >= 0 ? 'success' : 'error'
    );
    
    updateBalanceDisplay();
    updatePositionsTable();
    saveUserData();
}

function calculateFuturesMargin() {
    const sizeInput = document.getElementById('futuresSizeInput');
    const leverageSlider = document.getElementById('leverageSlider');
    
    const size = parseFloat(sizeInput?.value) || 0;
    const leverage = parseInt(leverageSlider?.value) || 1;
    
    if (selectedCoin && size > 0) {
        const margin = (size * selectedCoin.current_price) / leverage;
        
        // Update display
        const marginDisplay = document.getElementById('marginRequired');
        if (marginDisplay) {
            marginDisplay.textContent = `Margin Required: ${formatPrice(margin)} USDT`;
        }
    }
}

// ==========================================
// UI Update Functions
// ==========================================
function updateBalanceDisplay() {
    const balanceElement = document.getElementById('userBalance');
    if (balanceElement) {
        balanceElement.textContent = formatNumber(currentBalance) + ' USDT';
    }
}

function updateOrderButton() {
    if (!selectedCoin) return;
    
    const button = document.getElementById('submitOrderBtn');
    if (!button) return;
    
    const symbol = selectedCoin.symbol.toUpperCase();
    
    if (orderType === 'buy') {
        button.textContent = `Buy ${symbol}`;
        button.className = 'order-submit-btn buy';
    } else if (orderType === 'sell') {
        button.textContent = `Sell ${symbol}`;
        button.className = 'order-submit-btn sell';
    }
}

function updatePositionsTable() {
    const tbody = document.getElementById('positionsTableBody');
    if (!tbody) return;
    
    if (positions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No open positions</td></tr>';
        return;
    }
    
    const html = positions.map(position => {
        // Calculate current PNL
        const currentPrice = marketData.find(c => c.symbol === position.symbol.replace('-PERP', '').toLowerCase())?.current_price || position.markPrice;
        const priceDiff = position.side === 'Long' 
            ? currentPrice - position.entryPrice 
            : position.entryPrice - currentPrice;
        
        const pnl = (priceDiff / position.entryPrice) * position.margin * position.leverage;
        const pnlPercent = (pnl / position.margin) * 100;
        
        return `
            <tr>
                <td>${position.symbol}</td>
                <td class="${position.side === 'Long' ? 'positive' : 'negative'}">${position.side}</td>
                <td>${position.size}</td>
                <td>$${formatPrice(position.entryPrice)}</td>
                <td>$${formatPrice(currentPrice)}</td>
                <td class="${pnl >= 0 ? 'positive' : 'negative'}">
                    ${pnl >= 0 ? '+' : ''}${formatPrice(pnl)} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)
                </td>
                <td>
                    <button class="close-position-btn" onclick="closePosition(${position.id})">Close</button>
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = html;
}

// ==========================================
// Navigation and Tab Functions
// ==========================================
function switchTab(tab) {
    // Update nav tabs
    document.querySelectorAll('.nav-tab').forEach(t => {
        t.classList.remove('active');
    });
    
    const activeTab = document.querySelector(`.nav-tab[data-tab="${tab}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const tabContent = document.getElementById(`${tab}-tab`);
    if (tabContent) {
        tabContent.classList.add('active');
    }
    
    tradingMode = tab;
    
    // Save preference
    localStorage.setItem('tradingMode', tab);
}

// ==========================================
// Filter and Search Functions
// ==========================================
function filterCoins() {
    const searchInput = document.getElementById('searchInput');
    const search = searchInput?.value.toLowerCase() || '';
    
    const filtered = marketData.filter(coin => 
        coin.name.toLowerCase().includes(search) || 
        coin.symbol.toLowerCase().includes(search)
    );
    
    displayMarketData(filtered);
}

function applyFilter(filter) {
    let filtered = [...marketData];
    
    switch(filter) {
        case 'gainers':
            filtered = filtered.filter(coin => coin.price_change_percentage_24h > 0)
                .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
            break;
            
        case 'losers':
            filtered = filtered.filter(coin => coin.price_change_percentage_24h < 0)
                .sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h);
            break;
            
        case 'volume':
            filtered = filtered.sort((a, b) => b.total_volume - a.total_volume);
            break;
            
        case 'all':
        default:
            // Default sorting by market cap
            break;
    }
    
    displayMarketData(filtered.slice(0, 100)); // Limit to 100 items
}

// ==========================================
// Storage Functions
// ==========================================
function saveUserData() {
    const userData = {
        balance: currentBalance,
        holdings: userHoldings,
        positions: positions,
        selectedCoin: selectedCoin?.id,
        tradingMode: tradingMode,
        orderHistory: getOrderHistory()
    };
    
    localStorage.setItem('cryptoExchangeData', JSON.stringify(userData));
}

function loadSavedData() {
    try {
        const saved = localStorage.getItem('cryptoExchangeData');
        if (saved) {
            const data = JSON.parse(saved);
            
            currentBalance = data.balance || 4876367436636;
            userHoldings = data.holdings || {};
            positions = data.positions || [];
            tradingMode = data.tradingMode || 'spot';
            
            // Restore selected coin
            if (data.selectedCoin && marketData.length > 0) {
                const coin = marketData.find(c => c.id === data.selectedCoin);
                if (coin) selectCoin(coin);
            }
            
            // Restore trading mode
            if (data.tradingMode) {
                switchTab(data.tradingMode);
            }
            
            updateBalanceDisplay();
            updatePositionsTable();
        }
    } catch (error) {
        console.error('Error loading saved data:', error);
    }
}

function addToOrderHistory(order) {
    let history = getOrderHistory();
    history.unshift(order); // Add to beginning
    
    // Keep only last 100 orders
    if (history.length > 100) {
        history = history.slice(0, 100);
    }
    
    localStorage.setItem('orderHistory', JSON.stringify(history));
}

function getOrderHistory() {
    try {
        const history = localStorage.getItem('orderHistory');
        return history ? JSON.parse(history) : [];
    } catch {
        return [];
    }
}

// ==========================================
// Utility Functions
// ==========================================
function formatPrice(price) {
    if (typeof price !== 'number') return '0.00';
    
    if (price < 0.00001) return price.toFixed(8);
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    if (price < 100) return price.toFixed(2);
    
    return price.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
}

function formatNumber(num) {
    if (typeof num !== 'number') return '0';
    
    return num.toLocaleString('en-US', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
    });
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    // Auto hide after 3 seconds
    clearTimeout(toast.hideTimeout);
    toast.hideTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function closeAllModals() {
    // Close any open modals or popups
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('show');
    });
}

// ==========================================
// WebSocket Functions (for real-time updates)
// ==========================================
function connectWebSocket() {
    // In a real application, you would connect to a WebSocket for real-time price updates
    // Example: wss://stream.binance.com:9443/ws
    
    // For demo purposes, we're using polling instead
    console.log('WebSocket connection would be established here in production');
}

// ==========================================
// Export Functions (if using modules)
// ==========================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        selectCoin,
        submitOrder,
        formatPrice,
        showToast
    };
}

// ==========================================
// Performance Optimization
// ==========================================
// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Apply debouncing to search
const debouncedSearch = debounce(filterCoins, 300);

// Replace the search event listener with debounced version
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.removeEventListener('input', filterCoins);
        searchInput.addEventListener('input', debouncedSearch);
    }
});

// ==========================================
// Error Handling
// ==========================================
window.addEventListener('error', function(e) {
    console.error('Global error:', e);
    showToast('An error occurred. Please refresh the page.', 'error');
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e);
    showToast('Connection error. Please check your internet.', 'error');
});

// Save data before page unload
window.addEventListener('beforeunload', function() {
    saveUserData();
});
