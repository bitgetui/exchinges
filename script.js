// advanced-script.js - Enhanced Crypto Exchange with Predictions & Candlestick Charts

// ==========================================
// Configuration & Constants
// ==========================================
const CONFIG = {
    API_KEY: 'CG-demo-key', // Replace with your CoinGecko API key
    UPDATE_INTERVAL: 3000, // 3 seconds
    PREDICTION_INTERVAL: 5000, // 5 seconds
    MAX_RETRY_ATTEMPTS: 3,
    CHART_COLORS: {
        bullish: '#00ff88',
        bearish: '#ff3333',
        prediction: '#ffd700',
        resistance: '#ff6b6b',
        support: '#4ecdc4'
    }
};

// ==========================================
// State Management (React-like)
// ==========================================
class AppState {
    constructor() {
        this.state = {
            balance: 4876367436636,
            marketData: [],
            selectedCoin: null,
            candleData: [],
            predictions: {},
            loading: true,
            error: null,
            orderBook: { bids: [], asks: [] },
            trades: [],
            indicators: {},
            theme: 'dark'
        };
        this.listeners = [];
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notify();
    }

    subscribe(listener) {
        this.listeners.push(listener);
    }

    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }

    getState() {
        return this.state;
    }
}

const appState = new AppState();

// ==========================================
// Enhanced Chart System with Candlesticks
// ==========================================
class CandlestickChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas?.getContext('2d');
        this.candles = [];
        this.predictions = [];
        this.mousePos = null;
        
        if (this.canvas) {
            this.setupCanvas();
            this.attachEvents();
        }
    }

    setupCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height || 400;
        
        // High DPI support
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width *= dpr;
        this.canvas.height *= dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = (rect.height || 400) + 'px';
    }

    attachEvents() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mousePos = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            this.draw();
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.mousePos = null;
            this.draw();
        });
    }

    updateData(candles, predictions) {
        this.candles = candles;
        this.predictions = predictions;
        this.draw();
    }

    draw() {
        if (!this.ctx) return;

        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);

        // Clear canvas
        this.ctx.fillStyle = '#0b0e11';
        this.ctx.fillRect(0, 0, width, height);

        if (this.candles.length === 0) {
            this.drawLoading();
            return;
        }

        // Calculate dimensions
        const padding = 40;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;
        const candleWidth = Math.max(2, (chartWidth / this.candles.length) * 0.8);
        const gap = (chartWidth / this.candles.length) * 0.2;

        // Find min/max prices
        const prices = this.candles.flatMap(c => [c.high, c.low]);
        const minPrice = Math.min(...prices) * 0.999;
        const maxPrice = Math.max(...prices) * 1.001;
        const priceRange = maxPrice - minPrice;

        // Draw grid
        this.drawGrid(padding, width, height, minPrice, maxPrice);

        // Draw candles
        this.candles.forEach((candle, i) => {
            const x = padding + (i * (candleWidth + gap)) + gap / 2;
            const yHigh = padding + ((maxPrice - candle.high) / priceRange) * chartHeight;
            const yLow = padding + ((maxPrice - candle.low) / priceRange) * chartHeight;
            const yOpen = padding + ((maxPrice - candle.open) / priceRange) * chartHeight;
            const yClose = padding + ((maxPrice - candle.close) / priceRange) * chartHeight;

            const isBullish = candle.close > candle.open;
            const color = isBullish ? CONFIG.CHART_COLORS.bullish : CONFIG.CHART_COLORS.bearish;

            // Draw shadow/wick
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(x + candleWidth / 2, yHigh);
            this.ctx.lineTo(x + candleWidth / 2, yLow);
            this.ctx.stroke();

            // Draw candle body
            this.ctx.fillStyle = isBullish ? color : 'transparent';
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = isBullish ? 0 : 2;
            
            const bodyTop = Math.min(yOpen, yClose);
            const bodyHeight = Math.abs(yClose - yOpen);
            
            this.ctx.fillRect(x, bodyTop, candleWidth, bodyHeight || 1);
            if (!isBullish) {
                this.ctx.strokeRect(x, bodyTop, candleWidth, bodyHeight || 1);
            }

            // Draw prediction shadow for last candle
            if (i === this.candles.length - 1 && this.predictions) {
                this.drawPrediction(x + candleWidth, candle, padding, chartHeight, priceRange, maxPrice);
            }
        });

        // Draw price line and info
        if (this.mousePos) {
            this.drawCrosshair(this.mousePos, padding, width, height, minPrice, maxPrice);
        }

        // Draw current price line
        this.drawCurrentPrice(padding, width, chartHeight, priceRange, maxPrice);

        // Draw indicators
        this.drawIndicators(padding, width, chartHeight, priceRange, maxPrice);
    }

    drawPrediction(x, lastCandle, padding, chartHeight, priceRange, maxPrice) {
        const prediction = this.predictions.nextPrice || lastCandle.close * 1.001;
        const yPred = padding + ((maxPrice - prediction) / priceRange) * chartHeight;
        
        // Draw prediction line
        this.ctx.strokeStyle = CONFIG.CHART_COLORS.prediction;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(x, padding + ((maxPrice - lastCandle.close) / priceRange) * chartHeight);
        this.ctx.lineTo(x + 50, yPred);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Draw prediction box
        this.ctx.fillStyle = CONFIG.CHART_COLORS.prediction + '33';
        this.ctx.fillRect(x + 40, yPred - 10, 80, 20);
        
        this.ctx.fillStyle = CONFIG.CHART_COLORS.prediction;
        this.ctx.font = 'bold 11px Arial';
        this.ctx.fillText(`$${formatPrice(prediction)}`, x + 45, yPred + 3);
        
        // Draw confidence percentage
        const confidence = this.predictions.confidence || 75;
        this.ctx.fillStyle = confidence > 70 ? '#00ff88' : '#ffaa00';
        this.ctx.font = '10px Arial';
        this.ctx.fillText(`${confidence}% confidence`, x + 45, yPred + 15);
    }

    drawGrid(padding, width, height, minPrice, maxPrice) {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;

        // Horizontal lines
        for (let i = 0; i <= 5; i++) {
            const y = padding + (i * (height - padding * 2) / 5);
            this.ctx.beginPath();
            this.ctx.moveTo(padding, y);
            this.ctx.lineTo(width - padding, y);
            this.ctx.stroke();

            // Price labels
            const price = maxPrice - (i * (maxPrice - minPrice) / 5);
            this.ctx.fillStyle = '#848e9c';
            this.ctx.font = '11px Arial';
            this.ctx.textAlign = 'right';
            this.ctx.fillText(formatPrice(price), padding - 5, y + 3);
        }

        // Vertical lines
        const timeIntervals = 5;
        for (let i = 0; i <= timeIntervals; i++) {
            const x = padding + (i * (width - padding * 2) / timeIntervals);
            this.ctx.beginPath();
            this.ctx.moveTo(x, padding);
            this.ctx.lineTo(x, height - padding);
            this.ctx.stroke();
        }
    }

    drawCrosshair(pos, padding, width, height, minPrice, maxPrice) {
        // Vertical line
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([3, 3]);
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, padding);
        this.ctx.lineTo(pos.x, height - padding);
        this.ctx.stroke();

        // Horizontal line
        this.ctx.beginPath();
        this.ctx.moveTo(padding, pos.y);
        this.ctx.lineTo(width - padding, pos.y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Price label at cursor
        const priceAtCursor = maxPrice - ((pos.y - padding) / (height - padding * 2)) * (maxPrice - minPrice);
        this.ctx.fillStyle = '#fcd535';
        this.ctx.fillRect(width - padding - 70, pos.y - 10, 70, 20);
        this.ctx.fillStyle = '#000';
        this.ctx.font = 'bold 11px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`$${formatPrice(priceAtCursor)}`, width - padding - 65, pos.y + 3);
    }

    drawCurrentPrice(padding, width, chartHeight, priceRange, maxPrice) {
        if (this.candles.length === 0) return;
        
        const currentPrice = this.candles[this.candles.length - 1].close;
        const y = padding + ((maxPrice - currentPrice) / priceRange) * chartHeight;

        // Draw line
        this.ctx.strokeStyle = '#fcd535';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([10, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(padding, y);
        this.ctx.lineTo(width - padding, y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Price label
        this.ctx.fillStyle = '#fcd535';
        this.ctx.fillRect(width - padding - 80, y - 10, 80, 20);
        this.ctx.fillStyle = '#000';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`$${formatPrice(currentPrice)}`, width - padding - 75, y + 3);
    }

    drawIndicators(padding, width, chartHeight, priceRange, maxPrice) {
        // Draw support and resistance lines
        const support = this.predictions?.support || 0;
        const resistance = this.predictions?.resistance || 0;

        if (support > 0) {
            const y = padding + ((maxPrice - support) / priceRange) * chartHeight;
            this.ctx.strokeStyle = CONFIG.CHART_COLORS.support;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(padding, y);
            this.ctx.lineTo(width - padding, y);
            this.ctx.stroke();
            
            this.ctx.fillStyle = CONFIG.CHART_COLORS.support;
            this.ctx.font = '10px Arial';
            this.ctx.fillText('Support', padding + 5, y - 5);
        }

        if (resistance > 0) {
            const y = padding + ((maxPrice - resistance) / priceRange) * chartHeight;
            this.ctx.strokeStyle = CONFIG.CHART_COLORS.resistance;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(padding, y);
            this.ctx.lineTo(width - padding, y);
            this.ctx.stroke();
            
            this.ctx.fillStyle = CONFIG.CHART_COLORS.resistance;
            this.ctx.font = '10px Arial';
            this.ctx.fillText('Resistance', padding + 5, y + 15);
        }
    }

    drawLoading() {
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);
        
        this.ctx.fillStyle = '#848e9c';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Loading chart data...', width / 2, height / 2);
        
        // Draw spinner
        const time = Date.now() / 1000;
        const x = width / 2;
        const y = height / 2 + 30;
        const radius = 15;
        
        this.ctx.strokeStyle = '#fcd535';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, time * 2, time * 2 + Math.PI * 1.5);
        this.ctx.stroke();
    }
}

// ==========================================
// Price Prediction Engine
// ==========================================
class PricePredictionEngine {
    constructor() {
        this.history = [];
        this.predictions = {};
        this.indicators = {};
    }

    addDataPoint(price, volume) {
        this.history.push({ price, volume, time: Date.now() });
        if (this.history.length > 100) {
            this.history.shift();
        }
        this.calculate();
    }

    calculate() {
        if (this.history.length < 10) return;

        const prices = this.history.map(h => h.price);
        const volumes = this.history.map(h => h.volume);

        // Calculate moving averages
        this.indicators.ma5 = this.calculateMA(prices, 5);
        this.indicators.ma20 = this.calculateMA(prices, 20);
        
        // Calculate RSI
        this.indicators.rsi = this.calculateRSI(prices, 14);
        
        // Calculate Bollinger Bands
        const bb = this.calculateBollingerBands(prices, 20);
        this.indicators.upperBand = bb.upper;
        this.indicators.lowerBand = bb.lower;
        
        // Calculate support and resistance
        this.predictions.support = this.calculateSupport(prices);
        this.predictions.resistance = this.calculateResistance(prices);
        
        // Predict next price (5 minutes)
        this.predictions.nextPrice = this.predictNextPrice(prices, volumes);
        this.predictions.confidence = this.calculateConfidence();
        this.predictions.trend = this.detectTrend(prices);
        this.predictions.signal = this.generateSignal();
    }

    calculateMA(prices, period) {
        if (prices.length < period) return null;
        const slice = prices.slice(-period);
        return slice.reduce((a, b) => a + b, 0) / period;
    }

    calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) return 50;

        let gains = 0;
        let losses = 0;

        for (let i = prices.length - period; i < prices.length; i++) {
            const diff = prices[i] - prices[i - 1];
            if (diff > 0) gains += diff;
            else losses -= diff;
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    calculateBollingerBands(prices, period = 20) {
        const ma = this.calculateMA(prices, period);
        if (!ma) return { upper: 0, lower: 0 };

        const slice = prices.slice(-period);
        const variance = slice.reduce((sum, price) => sum + Math.pow(price - ma, 2), 0) / period;
        const stdDev = Math.sqrt(variance);

        return {
            upper: ma + (stdDev * 2),
            lower: ma - (stdDev * 2)
        };
    }

    calculateSupport(prices) {
        const recentPrices = prices.slice(-20);
        return Math.min(...recentPrices) * 0.995;
    }

    calculateResistance(prices) {
        const recentPrices = prices.slice(-20);
        return Math.max(...recentPrices) * 1.005;
    }

    predictNextPrice(prices, volumes) {
        if (prices.length < 20) return prices[prices.length - 1];

        const currentPrice = prices[prices.length - 1];
        const ma5 = this.indicators.ma5;
        const ma20 = this.indicators.ma20;
        const rsi = this.indicators.rsi;
        
        // Simple prediction model
        let prediction = currentPrice;
        
        // Trend following
        if (ma5 > ma20) {
            prediction *= 1.002; // Bullish bias
        } else {
            prediction *= 0.998; // Bearish bias
        }
        
        // RSI adjustment
        if (rsi > 70) {
            prediction *= 0.995; // Overbought, expect pullback
        } else if (rsi < 30) {
            prediction *= 1.005; // Oversold, expect bounce
        }
        
        // Volume consideration
        const avgVolume = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
        const currentVolume = volumes[volumes.length - 1];
        if (currentVolume > avgVolume * 1.5) {
            // High volume, stronger movement
            const priceTrend = prices[prices.length - 1] > prices[prices.length - 2];
            prediction *= priceTrend ? 1.003 : 0.997;
        }
        
        return prediction;
    }

    calculateConfidence() {
        // Calculate confidence based on indicators alignment
        let confidence = 50;
        
        const rsi = this.indicators.rsi;
        if (rsi > 30 && rsi < 70) confidence += 10; // RSI in normal range
        
        if (this.indicators.ma5 && this.indicators.ma20) {
            const trendAlignment = 
                (this.indicators.ma5 > this.indicators.ma20 && this.predictions.trend === 'up') ||
                (this.indicators.ma5 < this.indicators.ma20 && this.predictions.trend === 'down');
            if (trendAlignment) confidence += 20;
        }
        
        // Add randomness for realism
        confidence += Math.random() * 20 - 10;
        
        return Math.min(95, Math.max(30, Math.round(confidence)));
    }

    detectTrend(prices) {
        if (prices.length < 10) return 'neutral';
        
        const recent = prices.slice(-10);
        const older = prices.slice(-20, -10);
        
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        
        if (recentAvg > olderAvg * 1.01) return 'up';
        if (recentAvg < olderAvg * 0.99) return 'down';
        return 'neutral';
    }

    generateSignal() {
        const rsi = this.indicators.rsi;
        const trend = this.predictions.trend;
        
        if (rsi < 30 && trend === 'up') return 'strong_buy';
        if (rsi < 40) return 'buy';
        if (rsi > 70 && trend === 'down') return 'strong_sell';
        if (rsi > 60) return 'sell';
        
        return 'hold';
    }
}

// ==========================================
// Enhanced API Service with Error Handling
// ==========================================
class APIService {
    constructor() {
        this.cache = new Map();
        this.retryCount = 0;
    }

    async fetchWithRetry(url, options = {}, retries = CONFIG.MAX_RETRY_ATTEMPTS) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, {
                    ...options,
                    headers: {
                        'Accept': 'application/json',
                        ...options.headers
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                this.retryCount = 0;
                return data;
            } catch (error) {
                console.warn(`Attempt ${i + 1} failed:`, error);
                
                if (i === retries - 1) {
                    throw error;
                }
                
                // Wait before retry with exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            }
        }
    }

    async fetchMarketData() {
        const cacheKey = 'marketData';
        const cached = this.cache.get(cacheKey);
        
        // Use cache if fresh (less than 5 seconds old)
        if (cached && Date.now() - cached.timestamp < 5000) {
            return cached.data;
        }

        try {
            showLoadingState(true);
            
            const data = await this.fetchWithRetry(
                'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=24h,7d'
            );

            // Cache the data
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });

            showLoadingState(false);
            return data;
        } catch (error) {
            console.error('Failed to fetch market data:', error);
            showError('Unable to load market data. Using cached data if available.');
            
            // Return cached data if available
            if (cached) {
                return cached.data;
            }
            
            // Return mock data as fallback
            return this.getMockData();
        }
    }

    getMockData() {
        // Fallback mock data for development/testing
        return [
            {
                id: 'bitcoin',
                symbol: 'btc',
                name: 'Bitcoin',
                image: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
                current_price: 45000 + Math.random() * 1000,
                price_change_percentage_24h: Math.random() * 10 - 5,
                total_volume: 28000000000,
                market_cap: 880000000000,
                sparkline_in_7d: {
                    price: Array.from({ length: 168 }, () => 45000 + Math.random() * 2000)
                }
            },
            {
                id: 'ethereum',
                symbol: 'eth',
                name: 'Ethereum',
                image: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
                current_price: 3000 + Math.random() * 100,
                price_change_percentage_24h: Math.random() * 10 - 5,
                total_volume: 15000000000,
                market_cap: 360000000000,
                sparkline_in_7d: {
                    price: Array.from({ length: 168 }, () => 3000 + Math.random() * 200)
                }
            }
        ];
    }

    async fetchCandleData(coinId, days = 1) {
        try {
            const data = await this.fetchWithRetry(
                `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`
            );
            
            return data.map(candle => ({
                time: candle[0],
                open: candle[1],
                high: candle[2],
                low: candle[3],
                close: candle[4]
            }));
        } catch (error) {
            console.error('Failed to fetch candle data:', error);
            return this.generateMockCandles();
        }
    }

    generateMockCandles() {
        const candles = [];
        let basePrice = 45000;
        
        for (let i = 0; i < 50; i++) {
            const open = basePrice;
            const change = (Math.random() - 0.5) * 500;
            const close = open + change;
            const high = Math.max(open, close) + Math.random() * 100;
            const low = Math.min(open, close) - Math.random() * 100;
            
            candles.push({
                time: Date.now() - (50 - i) * 300000, // 5 minute intervals
                open,
                high,
                low,
                close
            });
            
            basePrice = close;
        }
        
        return candles;
    }
}

// ==========================================
// Initialize Everything
// ==========================================
const apiService = new APIService();
const predictionEngine = new PricePredictionEngine();
let candlestickChart = null;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Initializing Crypto Exchange...');
    
    // Initialize UI
    initializeUI();
    
    // Initialize chart
    candlestickChart = new CandlestickChart('priceChart');
    
    // Show loading state
    showLoadingState(true);
    
    // Start data fetching
    await loadMarketData();
    
    // Start real-time updates
    startRealTimeUpdates();
    
    // Initialize event handlers
    initializeEventHandlers();
    
    console.log('✅ Crypto Exchange initialized successfully');
});

// ==========================================
// UI Functions
// ==========================================
function initializeUI() {
    // Add loading overlay
    if (!document.getElementById('loadingOverlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text">Loading Market Data...</div>
                <div class="loading-progress">
                    <div class="progress-bar"></div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    // Add error container
    if (!document.getElementById('errorContainer')) {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'errorContainer';
        errorDiv.className = 'error-container';
        document.body.appendChild(errorDiv);
    }

    // Add prediction panel
    addPredictionPanel();
}

function addPredictionPanel() {
    const existingPanel = document.getElementById('predictionPanel');
    if (existingPanel) return;

    const panel = document.createElement('div');
    panel.id = 'predictionPanel';
    panel.className = 'prediction-panel';
    panel.innerHTML = `
        <div class="prediction-header">
            <h3>📊 AI Price Prediction</h3>
            <span class="prediction-time">Next 5 min</span>
        </div>
        <div class="prediction-content">
            <div class="prediction-item">
                <span class="label">Current Price:</span>
                <span class="value" id="currentPriceDisplay">-</span>
            </div>
            <div class="prediction-item">
                <span class="label">Predicted Price:</span>
                <span class="value" id="predictedPriceDisplay">-</span>
            </div>
            <div class="prediction-item">
                <span class="label">Confidence:</span>
                <span class="value" id="confidenceDisplay">-</span>
            </div>
            <div class="prediction-item">
                <span class="label">Signal:</span>
                <span class="value signal" id="signalDisplay">-</span>
            </div>
            <div class="prediction-indicators">
                <div class="indicator">
                    <span>RSI:</span>
                    <span id="rsiDisplay">-</span>
                </div>
                <div class="indicator">
                    <span>Trend:</span>
                    <span id="trendDisplay">-</span>
                </div>
            </div>
        </div>
    `;

    const chartPanel = document.querySelector('.chart-panel');
    if (chartPanel) {
        chartPanel.appendChild(panel);
    }
}

function showLoadingState(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    if (errorContainer) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <span class="error-icon">⚠️</span>
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">✕</button>
        `;
        errorContainer.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}

function updatePredictionPanel() {
    const predictions = predictionEngine.predictions;
    const indicators = predictionEngine.indicators;
    
    if (!selectedCoin) return;
    
    // Update display
    const currentPriceEl = document.getElementById('currentPriceDisplay');
    const predictedPriceEl = document.getElementById('predictedPriceDisplay');
    const confidenceEl = document.getElementById('confidenceDisplay');
    const signalEl = document.getElementById('signalDisplay');
    const rsiEl = document.getElementById('rsiDisplay');
    const trendEl = document.getElementById('trendDisplay');
    
    if (currentPriceEl) {
        currentPriceEl.textContent = `$${formatPrice(selectedCoin.current_price)}`;
    }
    
    if (predictedPriceEl && predictions.nextPrice) {
        const change = ((predictions.nextPrice - selectedCoin.current_price) / selectedCoin.current_price) * 100;
        predictedPriceEl.textContent = `$${formatPrice(predictions.nextPrice)}`;
        predictedPriceEl.className = `value ${change >= 0 ? 'positive' : 'negative'}`;
        
        // Add arrow
        const arrow = change >= 0 ? '↗' : '↘';
        predictedPriceEl.textContent += ` ${arrow} ${Math.abs(change).toFixed(2)}%`;
    }
    
    if (confidenceEl && predictions.confidence) {
        confidenceEl.textContent = `${predictions.confidence}%`;
        confidenceEl.className = `value ${predictions.confidence > 70 ? 'high' : predictions.confidence > 50 ? 'medium' : 'low'}`;
    }
    
    if (signalEl && predictions.signal) {
        signalEl.textContent = predictions.signal.replace('_', ' ').toUpperCase();
        signalEl.className = `value signal ${predictions.signal}`;
    }
    
    if (rsiEl && indicators.rsi) {
        rsiEl.textContent = Math.round(indicators.rsi);
        rsiEl.className = indicators.rsi > 70 ? 'overbought' : indicators.rsi < 30 ? 'oversold' : '';
    }
    
    if (trendEl && predictions.trend) {
        const trendEmoji = predictions.trend === 'up' ? '📈' : predictions.trend === 'down' ? '📉' : '→';
        trendEl.textContent = `${trendEmoji} ${predictions.trend.toUpperCase()}`;
        trendEl.className = predictions.trend;
    }
}

// ==========================================
// Data Management
// ==========================================
async function loadMarketData() {
    try {
        const data = await apiService.fetchMarketData();
        appState.setState({ marketData: data, loading: false });
        
        displayMarketData(data);
        
        // Auto-select first coin
        if (data.length > 0 && !appState.getState().selectedCoin) {
            selectCoin(data[0]);
        }
        
        return data;
    } catch (error) {
        console.error('Error loading market data:', error);
        appState.setState({ error: error.message, loading: false });
        showError('Failed to load market data. Please check your connection.');
    }
}

function displayMarketData(coins) {
    const marketList = document.getElementById('marketList');
    if (!marketList) return;
    
    const html = coins.map(coin => {
        const isSelected = appState.getState().selectedCoin?.id === coin.id;
        const changeClass = coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative';
        
        return `
            <div class="market-item ${isSelected ? 'selected' : ''}" 
                 data-coin-id="${coin.id}"
                 onclick="selectCoinById('${coin.id}')">
                <div class="coin-info">
                    <img src="${coin.image}" alt="${coin.name}" class="coin-logo">
                    <div class="coin-name">
                        <span class="coin-symbol">${coin.symbol.toUpperCase()}/USDT</span>
                        <span class="coin-fullname">${coin.name}</span>
                    </div>
                </div>
                <div class="coin-price-info">
                    <div class="coin-price">$${formatPrice(coin.current_price)}</div>
                    <div class="coin-change ${changeClass}">
                        ${coin.price_change_percentage_24h >= 0 ? '↗' : '↘'} ${Math.abs(coin.price_change_percentage_24h).toFixed(2)}%
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    marketList.innerHTML = html || '<div class="no-data">No market data available</div>';
}

async function selectCoin(coin) {
    appState.setState({ selectedCoin: coin });
    selectedCoin = coin;
    
    // Update UI
    updateSelectedCoinDisplay();
    
    // Load candle data
    const candles = await apiService.fetchCandleData(coin.id, 1);
    appState.setState({ candleData: candles });
    
    // Update prediction engine
    predictionEngine.addDataPoint(coin.current_price, coin.total_volume);
    
    // Update chart
    if (candlestickChart) {
        candlestickChart.updateData(candles, predictionEngine.predictions);
    }
    
    // Update prediction panel
    updatePredictionPanel();
}

function selectCoinById(coinId) {
    const coin = appState.getState().marketData.find(c => c.id === coinId);
    if (coin) selectCoin(coin);
}

function updateSelectedCoinDisplay() {
    const coin = appState.getState().selectedCoin;
    if (!coin) return;
    
    // Update all UI elements with selected coin data
    const elements = {
        selectedCoinLogo: { prop: 'src', value: coin.image },
        selectedCoinName: { prop: 'textContent', value: `${coin.symbol.toUpperCase()}/USDT` },
        selectedCoinPrice: { prop: 'textContent', value: `$${formatPrice(coin.current_price)}` }
    };
    
    for (const [id, updates] of Object.entries(elements)) {
        const element = document.getElementById(id);
        if (element) {
            element[updates.prop] = updates.value;
        }
    }
    
    // Update change indicator
    const changeElement = document.getElementById('selectedCoinChange');
    if (changeElement) {
        const change = coin.price_change_percentage_24h;
        changeElement.textContent = `${change >= 0 ? '↗' : '↘'} ${Math.abs(change).toFixed(2)}%`;
        changeElement.className = `chart-change ${change >= 0 ? 'positive' : 'negative'}`;
    }
}

// ==========================================
// Real-time Updates
// ==========================================
function startRealTimeUpdates() {
    // Update market data
    setInterval(async () => {
        await loadMarketData();
    }, CONFIG.UPDATE_INTERVAL);
    
    // Update predictions
    setInterval(() => {
        if (appState.getState().selectedCoin) {
            const coin = appState.getState().selectedCoin;
            predictionEngine.addDataPoint(
                coin.current_price + (Math.random() - 0.5) * 10,
                coin.total_volume
            );
            updatePredictionPanel();
            
            // Update chart with new predictions
            if (candlestickChart) {
                candlestickChart.predictions = predictionEngine.predictions;
                candlestickChart.draw();
            }
        }
    }, CONFIG.PREDICTION_INTERVAL);
}

// ==========================================
// Event Handlers
// ==========================================
function initializeEventHandlers() {
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            const query = e.target.value.toLowerCase();
            const filtered = appState.getState().marketData.filter(coin =>
                coin.name.toLowerCase().includes(query) ||
                coin.symbol.toLowerCase().includes(query)
            );
            displayMarketData(filtered);
        }, 300));
    }
    
    // Tab switching
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            applyFilter(this.dataset.filter);
        });
    });
}

function applyFilter(filter) {
    const marketData = appState.getState().marketData;
    let filtered = [...marketData];
    
    switch(filter) {
        case 'gainers':
            filtered = filtered.filter(c => c.price_change_percentage_24h > 0)
                             .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
            break;
        case 'losers':
            filtered = filtered.filter(c => c.price_change_percentage_24h < 0)
                             .sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h);
            break;
        case 'volume':
            filtered = filtered.sort((a, b) => b.total_volume - a.total_volume);
            break;
    }
    
    displayMarketData(filtered);
}

// ==========================================
// Utility Functions
// ==========================================
function formatPrice(price) {
    if (!price || isNaN(price)) return '0.00';
    
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    if (price < 100) return price.toFixed(2);
    
    return price.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

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

// Add required CSS styles
const styles = `
<style>
.loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(11, 14, 17, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}

.loading-content {
    text-align: center;
}

.loading-spinner {
    width: 50px;
    height: 50px;
    border: 3px solid #2b3139;
    border-top: 3px solid #fcd535;
    border-radius: 50%;
    margin: 0 auto 20px;
    animation: spin 1s linear infinite;
}

.loading-text {
    color: #fcd535;
    font-size: 18px;
    margin-bottom: 20px;
}

.loading-progress {
    width: 200px;
    height: 4px;
    background: #2b3139;
    border-radius: 2px;
    overflow: hidden;
}

.progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #fcd535, #00ff88);
    width: 0%;
    animation: progress 2s ease-in-out infinite;
}

@keyframes progress {
    0% { width: 0%; }
    50% { width: 70%; }
    100% { width: 100%; }
}

.error-container {
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 9999;
    max-width: 400px;
}

.error-message {
    background: #1e2329;
    border-left: 4px solid #f6465d;
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    animation: slideIn 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.error-message button {
    background: none;
    border: none;
    color: #848e9c;
    cursor: pointer;
    font-size: 18px;
    margin-left: auto;
}

.prediction-panel {
    background: #1e2329;
    border-radius: 8px;
    padding: 15px;
    margin: 15px;
    border: 1px solid #2b3139;
}

.prediction-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid #2b3139;
}

.prediction-header h3 {
    margin: 0;
    color: #fcd535;
    font-size: 16px;
}

.prediction-time {
    color: #848e9c;
    font-size: 12px;
    background: rgba(252, 213, 53, 0.1);
    padding: 4px 8px;
    border-radius: 4px;
}

.prediction-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 14px;
}

.prediction-item .label {
    color: #848e9c;
}

.prediction-item .value {
    font-weight: bold;
    color: #fff;
}

.prediction-item .value.positive {
    color: #00ff88;
}

.prediction-item .value.negative {
    color: #ff3333;
}

.prediction-item .value.high {
    color: #00ff88;
}

.prediction-item .value.medium {
    color: #fcd535;
}

.prediction-item .value.low {
    color: #ff6b6b;
}

.signal.strong_buy {
    color: #00ff88;
    background: rgba(0, 255, 136, 0.1);
    padding: 2px 8px;
    border-radius: 4px;
}

.signal.buy {
    color: #4ecdc4;
}

.signal.hold {
    color: #fcd535;
}

.signal.sell {
    color: #ffaa00;
}

.signal.strong_sell {
    color: #ff3333;
    background: rgba(255, 51, 51, 0.1);
    padding: 2px 8px;
    border-radius: 4px;
}

.prediction-indicators {
    display: flex;
    gap: 20px;
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid #2b3139;
}

.indicator {
    flex: 1;
    text-align: center;
    background: #0b0e11;
    padding: 8px;
    border-radius: 4px;
}

.indicator span:first-child {
    color: #848e9c;
    font-size: 11px;
    display: block;
    margin-bottom: 4px;
}

.indicator span:last-child {
    font-weight: bold;
    font-size: 14px;
}

.indicator .overbought {
    color: #ff3333;
}

.indicator .oversold {
    color: #00ff88;
}

.indicator .up {
    color: #00ff88;
}

.indicator .down {
    color: #ff3333;
}

.indicator .neutral {
    color: #fcd535;
}

#priceChart {
    background: #0b0e11;
    border-radius: 8px;
    cursor: crosshair;
}
</style>
`;

// Inject styles
document.head.insertAdjacentHTML('beforeend', styles);

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AppState,
        CandlestickChart,
        PricePredictionEngine,
        APIService,
        formatPrice
    };
}

console.log('✨ Advanced Crypto Exchange Script Loaded Successfully!');
