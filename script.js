// ============================================
// CONFIGURATION ET ÉTAT GLOBAL
// ============================================

let config = {
    etsyShop: '',
    aliShop: '',
    currency: 'EUR',
    targetMargin: 30,
    apiUrl: ''
};

let orders = [];

// ============================================
// GESTION DU STOCKAGE LOCAL (SETTINGS)
// ============================================

function loadSettings() {
    const saved = localStorage.getItem('orderTrackerSettings');
    if (saved) {
        config = JSON.parse(saved);
        document.getElementById('etsy-shop').value = config.etsyShop || '';
        document.getElementById('ali-shop').value = config.aliShop || '';
        document.getElementById('currency').value = config.currency || 'EUR';
        document.getElementById('target-margin').value = config.targetMargin || 30;
        document.getElementById('api-url').value = config.apiUrl || '';
    }
}

function saveSettings() {
    config.etsyShop = document.getElementById('etsy-shop').value;
    config.aliShop = document.getElementById('ali-shop').value;
    config.currency = document.getElementById('currency').value;
    config.targetMargin = parseFloat(document.getElementById('target-margin').value) || 30;
    config.apiUrl = document.getElementById('api-url').value;
    
    localStorage.setItem('orderTrackerSettings', JSON.stringify(config));
    showNotification('Paramètres enregistrés', 'success');
}

// ============================================
// NAVIGATION PAR ONGLETS
// ============================================

function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;

            // Retirer active de tous
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Ajouter active au sélectionné
            btn.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

// ============================================
// NOTIFICATIONS
// ============================================

function showNotification(message, type = 'info') {
    // Création d'une notification simple
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 6px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================
// CALCULS AUTOMATIQUES
// ============================================

function calculateProfit(salePrice, costPrice) {
    return (parseFloat(salePrice) - parseFloat(costPrice)).toFixed(2);
}

function calculateMargin(salePrice, costPrice) {
    const sale = parseFloat(salePrice);
    const cost = parseFloat(costPrice);
    if (sale === 0) return 0;
    return (((sale - cost) / sale) * 100).toFixed(2);
}

function calculateDeliveryTime(startDate, endDate) {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

// ============================================
// API GOOGLE SHEETS
// ============================================

function setSyncStatus(status) {
    const syncEl = document.getElementById('sync-status');
    syncEl.className = `sync-status ${status}`;
}

async function addOrderToSheet(orderData) {
    if (!config.apiUrl) {
        showNotification('URL API non configurée', 'error');
        return false;
    }

    setSyncStatus('syncing');

    try {
        const response = await fetch(config.apiUrl, {
            method: 'POST',
            mode: 'no-cors', // Important pour Google Apps Script
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'addOrder',
                data: orderData
            })
        });

        // Note: avec no-cors, on ne peut pas lire la réponse
        // On suppose que ça a fonctionné
        setSyncStatus('success');
        showNotification('Commande ajoutée avec succès', 'success');
        return true;
    } catch (error) {
        console.error('Erreur:', error);
        setSyncStatus('error');
        showNotification('Erreur lors de l\'ajout', 'error');
        return false;
    }
}

async function getOrdersFromSheet() {
    if (!config.apiUrl) {
        showNotification('URL API non configurée', 'error');
        return [];
    }

    setSyncStatus('syncing');

    try {
        const response = await fetch(`${config.apiUrl}?action=getOrders`);
        const data = await response.json();
        
        setSyncStatus('success');
        
        if (data.status === 'success') {
            return data.orders || [];
        } else {
            showNotification('Erreur lors du chargement', 'error');
            return [];
        }
    } catch (error) {
        console.error('Erreur:', error);
        setSyncStatus('error');
        showNotification('Erreur de connexion', 'error');
        return [];
    }
}

// ============================================
// GESTION DU FORMULAIRE D'AJOUT
// ============================================

function initOrderForm() {
    const form = document.getElementById('order-form');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const dateClient = document.getElementById('date-client').value;
        const dateAli = document.getElementById('date-ali').value;
        const dateEstimate = document.getElementById('date-estimate').value;
        const dateDelivered = document.getElementById('date-delivered').value;
        const productType = document.getElementById('product-type').value;
        const aliLink = document.getElementById('ali-link').value;
        const customerName = document.getElementById('customer-name').value;
        const customerAddress = document.getElementById('customer-address').value;
        const country = document.getElementById('country').value;
        const salePrice = parseFloat(document.getElementById('sale-price').value);
        const costPrice = parseFloat(document.getElementById('cost-price').value);
        const status = document.getElementById('status').value;
        const notes = document.getElementById('notes').value;

        const profit = calculateProfit(salePrice, costPrice);
        const margin = calculateMargin(salePrice, costPrice);
        const deliveryTime = calculateDeliveryTime(dateAli, dateDelivered);

        const orderData = {
            dateClient,
            dateAli,
            dateEstimate,
            dateDelivered,
            deliveryTime: deliveryTime || '',
            productType,
            aliLink,
            customerName,
            customerAddress,
            country,
            salePrice,
            costPrice,
            profit,
            margin,
            status,
            notes,
            timestamp: new Date().toISOString()
        };

        const success = await addOrderToSheet(orderData);
        
        if (success) {
            form.reset();
            // Mettre la date d'aujourd'hui par défaut
            document.getElementById('date-client').valueAsDate = new Date();
            document.getElementById('date-ali').valueAsDate = new Date();
        }
    });

    // Mettre la date d'aujourd'hui par défaut au chargement
    document.getElementById('date-client').valueAsDate = new Date();
    document.getElementById('date-ali').valueAsDate = new Date();
}

// ============================================
// AFFICHAGE DES COMMANDES
// ============================================

function formatCurrency(amount) {
    const symbols = { EUR: '€', USD: '$', GBP: '£' };
    return `${parseFloat(amount).toFixed(2)} ${symbols[config.currency] || '€'}`;
}

function renderOrders(ordersToRender = orders) {
    const tbody = document.getElementById('orders-tbody');
    
    if (ordersToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">Aucune commande</td></tr>';
        return;
    }

    tbody.innerHTML = ordersToRender.map(order => {
        const statusLabels = {
            en_cours: 'En cours',
            livre: 'Livré',
            probleme: 'Problème'
        };

        return `
            <tr>
                <td>${order.dateClient || '-'}</td>
                <td>${order.customerName || '-'}</td>
                <td>${order.productType || '-'}</td>
                <td>${order.country || '-'}</td>
                <td>${formatCurrency(order.salePrice)}</td>
                <td>${formatCurrency(order.costPrice)}</td>
                <td>${formatCurrency(order.profit)}</td>
                <td>${order.margin}%</td>
                <td><span class="status-badge status-${order.status}">${statusLabels[order.status] || order.status}</span></td>
                <td>${order.deliveryTime ? order.deliveryTime + 'j' : '-'}</td>
            </tr>
        `;
    }).join('');
}

async function loadOrders() {
    orders = await getOrdersFromSheet();
    renderOrders();
}

// ============================================
// FILTRES ET RECHERCHE
// ============================================

function initFilters() {
    const searchInput = document.getElementById('search');
    const statusFilter = document.getElementById('status-filter');

    function applyFilters() {
        let filtered = [...orders];

        // Filtre par recherche
        const searchTerm = searchInput.value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(order => 
                order.customerName?.toLowerCase().includes(searchTerm) ||
                order.productType?.toLowerCase().includes(searchTerm) ||
                order.country?.toLowerCase().includes(searchTerm)
            );
        }

        // Filtre par statut
        const statusValue = statusFilter.value;
        if (statusValue) {
            filtered = filtered.filter(order => order.status === statusValue);
        }

        renderOrders(filtered);
    }

    searchInput.addEventListener('input', applyFilters);
    statusFilter.addEventListener('change', applyFilters);
}

// ============================================
// STATISTIQUES
// ============================================

function calculateStats() {
    if (orders.length === 0) {
        document.getElementById('stat-revenue').textContent = formatCurrency(0);
        document.getElementById('stat-profit').textContent = formatCurrency(0);
        document.getElementById('stat-orders').textContent = '0';
        document.getElementById('stat-margin').textContent = '0%';
        document.getElementById('stat-top-product').textContent = '-';
        document.getElementById('stat-best-margin').textContent = '-';
        document.getElementById('stat-top-country').textContent = '-';
        document.getElementById('stat-avg-delay').textContent = '- jours';
        return;
    }

    // Chiffre d'affaires total
    const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.salePrice || 0), 0);
    document.getElementById('stat-revenue').textContent = formatCurrency(totalRevenue);

    // Bénéfice total
    const totalProfit = orders.reduce((sum, o) => sum + parseFloat(o.profit || 0), 0);
    document.getElementById('stat-profit').textContent = formatCurrency(totalProfit);

    // Nombre de commandes
    document.getElementById('stat-orders').textContent = orders.length;

    // Marge moyenne
    const avgMargin = orders.reduce((sum, o) => sum + parseFloat(o.margin || 0), 0) / orders.length;
    document.getElementById('stat-margin').textContent = avgMargin.toFixed(2) + '%';

    // Produit le plus vendu
    const productCounts = {};
    orders.forEach(o => {
        const prod = o.productType || 'Inconnu';
        productCounts[prod] = (productCounts[prod] || 0) + 1;
    });
    const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('stat-top-product').textContent = topProduct ? `${topProduct[0]} (${topProduct[1]})` : '-';

    // Produit le plus rentable
    const productMargins = {};
    orders.forEach(o => {
        const prod = o.productType || 'Inconnu';
        if (!productMargins[prod]) {
            productMargins[prod] = { total: 0, count: 0 };
        }
        productMargins[prod].total += parseFloat(o.margin || 0);
        productMargins[prod].count += 1;
    });
    const avgMargins = Object.entries(productMargins).map(([prod, data]) => ({
        product: prod,
        margin: data.total / data.count
    }));
    avgMargins.sort((a, b) => b.margin - a.margin);
    document.getElementById('stat-best-margin').textContent = avgMargins[0] 
        ? `${avgMargins[0].product} (${avgMargins[0].margin.toFixed(2)}%)` 
        : '-';

    // Pays le plus livré
    const countryCounts = {};
    orders.forEach(o => {
        const country = o.country || 'Inconnu';
        countryCounts[country] = (countryCounts[country] || 0) + 1;
    });
    const topCountry = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('stat-top-country').textContent = topCountry ? `${topCountry[0]} (${topCountry[1]})` : '-';

    // Délai moyen
    const deliveredOrders = orders.filter(o => o.deliveryTime && !isNaN(o.deliveryTime));
    if (deliveredOrders.length > 0) {
        const avgDelay = deliveredOrders.reduce((sum, o) => sum + parseInt(o.deliveryTime), 0) / deliveredOrders.length;
        document.getElementById('stat-avg-delay').textContent = avgDelay.toFixed(0) + ' jours';
    } else {
        document.getElementById('stat-avg-delay').textContent = '- jours';
    }
}

// ============================================
// INITIALISATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Charger les paramètres
    loadSettings();

    // Initialiser la navigation
    initTabs();

    // Initialiser le formulaire
    initOrderForm();

    // Initialiser les filtres
    initFilters();

    // Gestionnaire du formulaire de paramètres
    document.getElementById('settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveSettings();
    });

    // Bouton actualiser commandes
    document.getElementById('refresh-orders').addEventListener('click', loadOrders);

    // Bouton actualiser stats
    document.getElementById('refresh-stats').addEventListener('click', () => {
        loadOrders().then(() => calculateStats());
    });

    // Charger les commandes au démarrage si l'API est configurée
    if (config.apiUrl) {
        loadOrders().then(() => calculateStats());
    }

    // Ajouter les animations CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
});
