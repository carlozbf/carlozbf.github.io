// --- CONFIGURACIÓN Y ESTADO INICIAL ---
let products = [];
let orders = [];
let currentClient = localStorage.getItem('partido_current_client') || '';
let currentOrder = {}; // { productId: qty }
let activeRole = localStorage.getItem('partido_active_role') || 'client';

// Configuración global (se cargará desde config.json)
let config = {
  supabaseUrl: "",
  supabaseKey: "",
  whatsappPhone: "",
  whatsappEnabled: false,
  adminPasswordHash: ""
};

let supabaseClient = null;
let supabaseSubscription = null;

// Fallback de productos si no se puede cargar el JSON (ej. CORS con file://)
const DEFAULT_PRODUCTS = [
  {
    "id": "cerveza",
    "name": "Cerveza Helada",
    "category": "Bebidas",
    "unit": "botella 330ml",
    "stock": 50,
    "icon": "🍺",
    "description": "Cerveza artesanal rubia premium, servida a la temperatura ideal.",
    "color": "var(--beer-color)"
  },
  {
    "id": "papas",
    "name": "Papas Fritas",
    "category": "Snacks",
    "unit": "porción familiar",
    "stock": 30,
    "icon": "🍟",
    "description": "Crujientes papas fritas rústicas sazonadas con sal marina y especias.",
    "color": "var(--papas-color)"
  },
  {
    "id": "agua",
    "name": "Agua Mineral",
    "category": "Bebidas",
    "unit": "botella 500ml",
    "stock": 100,
    "icon": "💧",
    "description": "Agua mineral de manantial, con o sin gas, purificada y refrescante.",
    "color": "var(--agua-color)"
  }
];

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
  initAudio();
  await loadProducts();
  const configLoaded = await loadConfiguration();
  
  if (configLoaded) {
    initSupabase();
    await loadOrders();
  } else {
    updateDBStatusUI('Falta config.json', 'pending');
    showToast('Falta configurar config.json en la raíz del proyecto', 'danger');
  }

  setupEventListeners();
  updateRoleView();
});

// --- AUDIO NOTIFICACIÓN (Web Audio API) ---
let audioCtx = null;
function initAudio() {
  const unlockAudio = () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
  };
  document.addEventListener('click', unlockAudio);
  document.addEventListener('touchstart', unlockAudio);
}

function playSound(type) {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  if (type === 'new_order') {
    // Tono alegre doble
    osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
    
    setTimeout(() => {
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
      gain2.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc2.start();
      osc2.stop(audioCtx.currentTime + 0.15);
    }, 120);
  } else if (type === 'status_updated') {
    // Tono ascendente corto
    osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
    
    setTimeout(() => {
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gain2.gain.setValueAtTime(0.08, audioCtx.currentTime);
      osc2.start();
      osc2.stop(audioCtx.currentTime + 0.1);
    }, 90);
  } else if (type === 'click') {
    // Click sutil
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.03);
  }
}

// --- CARGAR CONFIGURACIÓN JSON ---
async function loadConfiguration() {
  try {
    const response = await fetch('./config.json');
    if (!response.ok) throw new Error('No se pudo leer config.json');
    config = await response.json();
    return !!(config.supabaseUrl && config.supabaseKey && !config.supabaseUrl.includes('TU_PROYECTO'));
  } catch (e) {
    console.error('Error cargando la configuración:', e);
    return false;
  }
}

// --- GESTIÓN DE PRODUCTOS ---
async function loadProducts() {
  try {
    const response = await fetch('./products.json');
    if (!response.ok) throw new Error('No se pudo cargar products.json');
    products = await response.json();
  } catch (error) {
    console.warn('Usando productos por defecto debido a:', error.message);
    products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
  }
  
  // Guardamos el stock base inicial para calcular el stock en tiempo real
  products.forEach(p => {
    p.baseStock = p.stock;
  });
}

// --- CONECTAR A SUPABASE ---
function initSupabase() {
  try {
    if (window.supabase) {
      supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
      setupSupabaseRealtime();
      updateDBStatusUI('Conectado', 'delivered');
      console.log('Supabase conectado correctamente.');
    } else {
      updateDBStatusUI('Librería no cargada', 'pending');
      showToast('Error: Librería de Supabase no disponible.', 'danger');
    }
  } catch (e) {
    console.error('Error al inicializar Supabase:', e);
    updateDBStatusUI('Error de conexión', 'pending');
    showToast('Error al conectar con la base de datos: ' + (e.message || e), 'danger');
  }
}

function updateDBStatusUI(text, statusClass) {
  const statusEl = document.getElementById('info-db-status');
  if (statusEl) {
    statusEl.innerText = text;
    statusEl.className = `status-badge ${statusClass}`;
  }
}

function setupSupabaseRealtime() {
  if (!supabaseClient) return;

  if (supabaseSubscription) {
    supabaseClient.removeChannel(supabaseSubscription);
  }

  supabaseSubscription = supabaseClient
    .channel('public:orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async (payload) => {
      console.log('Cambio en tiempo real detectado:', payload);
      
      if (payload.eventType === 'INSERT') {
        if (activeRole === 'admin') {
          playSound('new_order');
          showToast(`¡Nuevo pedido de ${payload.new.client_name}!`, 'success');
        }
      } else if (payload.eventType === 'UPDATE') {
        if (activeRole === 'client' && payload.new.client_name === currentClient) {
          if (payload.old.status !== payload.new.status) {
            playSound('status_updated');
            showToast(`Tu pedido cambió a: ${translateStatus(payload.new.status)}`, 'success');
          }
        }
      }
      
      await loadOrders();
    })
    .subscribe();
}

// --- OBTENER PEDIDOS Y CALCULAR STOCK ---
async function loadOrders() {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      orders = data || [];
      
      computeStock();
    } catch (e) {
      console.error('Error cargando pedidos:', e);
      let msg = e.message || e.details || (typeof e === 'object' ? JSON.stringify(e) : String(e));
      showToast('Error de DB: ' + msg, 'danger');
    }
  } else {
    computeStock();
  }
  
  renderProducts();
  renderClientOrders();
  renderAdminDashboard();
}

function computeStock() {
  products.forEach(p => {
    p.stock = p.baseStock;
  });

  orders.forEach(order => {
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        const product = products.find(p => p.id === item.id);
        if (product) {
          product.stock = Math.max(0, product.stock - item.qty);
        }
      });
    }
  });
}

// --- CREAR PEDIDO ---
async function createOrder() {
  if (!currentClient) {
    showToast('Por favor, selecciona tu nombre o mesa', 'danger');
    return;
  }

  if (!supabaseClient) {
    showToast('Base de datos no conectada. Revisa config.json', 'danger');
    return;
  }

  const items = [];
  
  for (const [prodId, qty] of Object.entries(currentOrder)) {
    if (qty > 0) {
      const product = products.find(p => p.id === prodId);
      if (product) {
        if (product.stock < qty) {
          showToast(`No hay suficiente stock disponible de ${product.name}`, 'danger');
          return;
        }
        items.push({
          id: prodId,
          name: product.name,
          qty: qty,
          icon: product.icon
        });
      }
    }
  }

  if (items.length === 0) {
    showToast('Tu carrito está vacío', 'danger');
    return;
  }

  const newOrder = {
    client_name: currentClient,
    items: items,
    total: 0.00, // Mandamos total en 0 ya que los precios fueron removidos
    status: 'pending',
  };

  try {
    const { error } = await supabaseClient
      .from('orders')
      .insert([newOrder]);
      
    if (error) throw error;
    showToast('¡Pedido realizado con éxito!', 'success');
  } catch (e) {
    console.error('Error al insertar pedido:', e);
    let msg = e.message || e.details || (typeof e === 'object' ? JSON.stringify(e) : String(e));
    showToast('Error al enviar pedido: ' + msg, 'danger');
    return;
  }

  // Redirección a WhatsApp si está habilitada
  if (config.whatsappEnabled && config.whatsappPhone) {
    let text = `*⚡ NUEVO PEDIDO - PartidoExpress* \n\n`;
    text += `👤 *Cliente/Mesa:* ${currentClient}\n`;
    text += `📅 *Fecha:* ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n`;
    text += `--------------------------------\n`;
    items.forEach(item => {
      text += `${item.icon} *${item.qty}x* ${item.name}\n`;
    });
    text += `--------------------------------\n`;
    text += `¡Muchas gracias! 🙏`;

    const waUrl = `https://wa.me/${config.whatsappPhone}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  }

  // Limpiar carrito local
  currentOrder = {};
  updateCheckoutBar();
}

// --- ACTUALIZAR ESTADO (ADMIN) ---
async function updateOrderStatus(orderId, newStatus) {
  if (!supabaseClient) return;

  try {
    const { error } = await supabaseClient
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);
      
    if (error) throw error;
    showToast(`Pedido actualizado a: ${translateStatus(newStatus)}`, 'success');
  } catch (e) {
    console.error('Error al actualizar estado:', e);
    showToast('Error al actualizar pedido en la base de datos.', 'danger');
  }
}

// --- REINICIAR BASE DE DATOS (ADMIN) ---
async function clearAllOrders() {
  if (!supabaseClient) return;
  
  try {
    const { error } = await supabaseClient
      .from('orders')
      .delete()
      .neq('status', 'non_existent_status');
      
    if (error) throw error;
    showToast('Pedidos e historial reiniciados con éxito', 'success');
  } catch (e) {
    console.error('Error reiniciando pedidos:', e);
    showToast('Error al borrar los pedidos de la base de datos.', 'danger');
  }
}

// --- RENDERIZAR VISTAS ---
function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  grid.innerHTML = '';

  products.forEach(product => {
    const qty = currentOrder[product.id] || 0;
    const card = document.createElement('div');
    card.className = 'product-card';
    card.style.setProperty('--item-color', product.color);
    
    let glowColor = 'rgba(99, 102, 241, 0.15)';
    if (product.id === 'cerveza') glowColor = 'rgba(251, 191, 36, 0.15)';
    else if (product.id === 'papas') glowColor = 'rgba(249, 115, 22, 0.15)';
    else if (product.id === 'agua') glowColor = 'rgba(14, 165, 233, 0.15)';
    card.style.setProperty('--item-glow', glowColor);

    const isLowStock = product.stock <= 5;
    const stockText = product.stock > 0 
      ? `Stock: ${product.stock} ${product.unit.split(' ')[0]}` 
      : 'Agotado';

    card.innerHTML = `
      <div class="product-icon">${product.icon}</div>
      <div class="product-info">
        <h3>${product.name}</h3>
        <p class="product-desc">${product.description}</p>
        <span class="product-stock ${product.stock === 0 || isLowStock ? 'low-stock' : ''}">${stockText}</span>
        <div class="product-price-row">
          <div class="product-unit" style="font-size: 0.85rem; color: var(--text-secondary);">
            Presentación: ${product.unit}
          </div>
          <div class="quantity-control">
            <button class="qty-btn minus" onclick="adjustQty('${product.id}', -1)" ${qty === 0 ? 'disabled' : ''}>-</button>
            <span class="qty-number">${qty}</span>
            <button class="qty-btn plus" onclick="adjustQty('${product.id}', 1)" ${qty >= product.stock ? 'disabled' : ''}>+</button>
          </div>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function adjustQty(productId, amount) {
  playSound('click');
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const currentQty = currentOrder[productId] || 0;
  const newQty = currentQty + amount;

  if (newQty < 0) return;
  if (newQty > product.stock) {
    showToast('Límite de stock alcanzado', 'danger');
    return;
  }

  if (newQty === 0) {
    delete currentOrder[productId];
  } else {
    currentOrder[productId] = newQty;
  }

  renderProducts();
  updateCheckoutBar();
}

function updateCheckoutBar() {
  const bar = document.getElementById('checkout-bar');
  const countEl = document.getElementById('items-count');

  let totalItems = 0;

  for (const [prodId, qty] of Object.entries(currentOrder)) {
    totalItems += qty;
  }

  if (totalItems > 0) {
    countEl.innerText = `${totalItems} producto${totalItems > 1 ? 's' : ''} seleccionado${totalItems > 1 ? 's' : ''}`;
    bar.classList.add('visible');
  } else {
    bar.classList.remove('visible');
  }
}

function renderClientOrders() {
  const container = document.getElementById('client-orders-list');
  const section = document.getElementById('client-orders-section');
  if (!container || !section) return;

  const clientOrders = orders.filter(o => o.client_name === currentClient);

  if (clientOrders.length === 0 || !currentClient) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  container.innerHTML = '';

  clientOrders.forEach(order => {
    const date = new Date(order.created_at);
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const card = document.createElement('div');
    card.className = 'order-card';
    
    const itemsHtml = order.items.map(item => `
      <div class="order-detail-item">
        <span class="item-qty-name">${item.icon} <strong>${item.qty}x</strong> ${item.name}</span>
      </div>
    `).join('');

    card.innerHTML = `
      <div class="order-header">
        <div>
          <span class="order-time">${timeString}</span>
          <div class="order-id">ID: ${String(order.id).substring(0, 8)}</div>
        </div>
        <span class="status-badge ${order.status}">${translateStatus(order.status)}</span>
      </div>
      <div class="order-details">
        ${itemsHtml}
      </div>
    `;
    container.appendChild(card);
  });
}

function renderAdminDashboard() {
  const pendingList = document.getElementById('admin-pending-list');
  const historyList = document.getElementById('admin-history-list');
  if (!pendingList || !historyList) return;

  pendingList.innerHTML = '';
  historyList.innerHTML = '';

  let activeCount = 0;
  let completedCount = 0;

  orders.forEach(order => {
    const date = new Date(order.created_at);
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isCompleted = order.status === 'delivered';

    if (isCompleted) {
      completedCount++;
    } else {
      activeCount++;
    }

    const card = document.createElement('div');
    card.className = 'order-card';

    const itemsHtml = order.items.map(item => `
      <div class="order-detail-item">
        <span class="item-qty-name">${item.icon} <strong>${item.qty}x</strong> ${item.name}</span>
      </div>
    `).join('');

    let actionButtons = '';
    if (order.status === 'pending') {
      actionButtons = `
        <div class="admin-actions">
          <button class="btn-prep" onclick="updateOrderStatus('${order.id}', 'preparing')">👨‍🍳 Preparar</button>
          <button class="btn-deliver" onclick="updateOrderStatus('${order.id}', 'delivered')">✅ Entregar</button>
        </div>
      `;
    } else if (order.status === 'preparing') {
      actionButtons = `
        <div class="admin-actions">
          <button class="btn-deliver" style="flex: 1;" onclick="updateOrderStatus('${order.id}', 'delivered')">✅ Entregar</button>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="order-header">
        <div>
          <span class="order-client-name">${order.client_name}</span>
          <span class="order-time" style="margin-left: 8px;">(${timeString})</span>
          <div class="order-id">ID: ${String(order.id).substring(0, 8)}</div>
        </div>
        <span class="status-badge ${order.status}">${translateStatus(order.status)}</span>
      </div>
      <div class="order-details">
        ${itemsHtml}
      </div>
      ${actionButtons}
    `;

    if (isCompleted) {
      historyList.appendChild(card);
    } else {
      pendingList.appendChild(card);
    }
  });

  const totalOrders = orders.length;
  document.getElementById('stat-total-orders').innerText = totalOrders;
  document.getElementById('stat-active-orders').innerText = activeCount;
  document.getElementById('stat-completed-orders').innerText = completedCount;
}

// --- IDENTIFICACIÓN DEL CLIENTE ---
function setupClientIdentity() {
  if (currentClient) {
    showActiveClientView(currentClient);
  } else {
    changeClient();
  }
}

function showActiveClientView(clientName) {
  currentClient = clientName;
  localStorage.setItem('partido_current_client', clientName);
  
  document.getElementById('client-select-section').classList.add('hidden');
  document.getElementById('client-active-section').classList.remove('hidden');
  document.getElementById('client-display-name').innerText = clientName;
  
  renderClientOrders();
}

function changeClient() {
  currentClient = '';
  localStorage.removeItem('partido_current_client');
  document.getElementById('client-select-section').classList.remove('hidden');
  document.getElementById('client-active-section').classList.add('hidden');
  document.getElementById('client-orders-section').classList.add('hidden');
  
  const nameInput = document.getElementById('client-name-input');
  if (nameInput) nameInput.value = '';
  
  currentOrder = {};
  renderProducts();
  updateCheckoutBar();
}

// --- UTILERÍAS ---
function translateStatus(status) {
  switch (status) {
    case 'pending': return 'Pendiente';
    case 'preparing': return 'Preparando';
    case 'delivered': return 'Entregado';
    default: return status;
  }
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.innerText = message;
  toast.className = `toast show ${type}`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// --- MANEJO DE EVENTOS ---
function setupEventListeners() {
  // Cambio de Rol
  document.getElementById('btn-role-client').addEventListener('click', () => {
    playSound('click');
    activeRole = 'client';
    localStorage.setItem('partido_active_role', 'client');
    updateRoleView();
  });
  
  document.getElementById('btn-role-admin').addEventListener('click', () => {
    playSound('click');
    openAdminAuthModal();
  });

  // Confirmación de Contraseña de Administrador (Modal)
  document.getElementById('btn-submit-admin-auth').addEventListener('click', submitAdminAuth);
  document.getElementById('admin-password-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitAdminAuth();
    }
  });

  // Confirmación de Identidad por Botón
  const submitName = () => {
    const input = document.getElementById('client-name-input');
    const name = input.value.trim();
    if (name) {
      playSound('click');
      showActiveClientView(name);
    } else {
      showToast('Por favor introduce tu nombre o mesa.', 'danger');
    }
  };

  document.getElementById('btn-submit-name').addEventListener('click', submitName);
  
  // Confirmación de Identidad por Tecla Enter
  document.getElementById('client-name-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitName();
    }
  });

  // Cambiar cliente
  document.getElementById('btn-change-client').addEventListener('click', changeClient);

  // Ver Carrito
  document.getElementById('btn-checkout').addEventListener('click', () => {
    playSound('click');
    openCheckoutModal();
  });

  // Cerrar modal
  document.querySelectorAll('.close-btn, .btn-close-modal').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  // Confirmar pedido
  document.getElementById('btn-confirm-order').addEventListener('click', async () => {
    closeModal();
    await createOrder();
  });

  // Abrir ajustes conectividad
  document.getElementById('btn-admin-config').addEventListener('click', () => {
    playSound('click');
    openSettingsModal();
  });

  // Abrir info stock
  document.getElementById('btn-admin-restock').addEventListener('click', () => {
    playSound('click');
    openRestockModal();
  });

  // Reiniciar pedidos
  document.getElementById('btn-admin-clear').addEventListener('click', async () => {
    playSound('click');
    if (confirm('¿Estás seguro de que deseas eliminar TODOS los pedidos de la base de datos Supabase? Esto restablecerá el stock.')) {
      await clearAllOrders();
    }
  });
}

function updateRoleView() {
  const clientView = document.getElementById('client-view');
  const adminView = document.getElementById('admin-view');
  const btnClient = document.getElementById('btn-role-client');
  const btnAdmin = document.getElementById('btn-role-admin');

  btnClient.classList.remove('active');
  btnAdmin.classList.remove('active');

  if (activeRole === 'client') {
    clientView.classList.remove('hidden');
    adminView.classList.add('hidden');
    btnClient.classList.add('active');
    setupClientIdentity();
    updateCheckoutBar();
  } else {
    clientView.classList.add('hidden');
    adminView.classList.remove('hidden');
    btnAdmin.classList.add('active');
    
    document.getElementById('checkout-bar').classList.remove('visible');
    renderAdminDashboard();
  }
}

// --- MANEJO DE MODALES ---
function openCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  const detailsContainer = document.getElementById('modal-order-details');
  
  detailsContainer.innerHTML = '';

  for (const [prodId, qty] of Object.entries(currentOrder)) {
    const product = products.find(p => p.id === prodId);
    if (product) {
      const itemRow = document.createElement('div');
      itemRow.className = 'order-detail-item';
      itemRow.innerHTML = `
        <span>${product.icon} <strong>${qty}x</strong> ${product.name}</span>
      `;
      detailsContainer.appendChild(itemRow);
    }
  }

  modal.classList.remove('hidden');
}

// Rellenar información estática desde config.json
function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  
  document.getElementById('info-db-url').innerText = config.supabaseUrl || 'No configurada';
  document.getElementById('info-wa-status').innerText = config.whatsappEnabled ? '✅ Habilitado' : '❌ Deshabilitado';
  document.getElementById('info-wa-status').style.color = config.whatsappEnabled ? 'var(--success-color)' : 'var(--text-secondary)';
  document.getElementById('info-wa-phone').innerText = config.whatsappPhone || 'No configurado';
  
  modal.classList.remove('hidden');
}

function openRestockModal() {
  const modal = document.getElementById('restock-modal');
  
  const cerveza = products.find(p => p.id === 'cerveza');
  const papas = products.find(p => p.id === 'papas');
  const agua = products.find(p => p.id === 'agua');

  if (cerveza) document.getElementById('info-stock-cerveza').innerText = `${cerveza.stock} / ${cerveza.baseStock} u.`;
  if (papas) document.getElementById('info-stock-papas').innerText = `${papas.stock} / ${papas.baseStock} u.`;
  if (agua) document.getElementById('info-stock-agua').innerText = `${agua.stock} / ${agua.baseStock} u.`;

  modal.classList.remove('hidden');
}

function closeModal() {
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.classList.add('hidden');
  });
}

function openAdminAuthModal() {
  const modal = document.getElementById('admin-auth-modal');
  const passwordInput = document.getElementById('admin-password-input');
  passwordInput.value = '';
  modal.classList.remove('hidden');
  setTimeout(() => {
    passwordInput.focus();
  }, 100);
}

async function sha256(string) {
  const utf8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function submitAdminAuth() {
  const passwordInput = document.getElementById('admin-password-input');
  const password = passwordInput.value;

  let authorized = false;
  if (config.adminPasswordHash) {
    const inputHash = await sha256(password);
    authorized = (inputHash === config.adminPasswordHash);
  } else {
    authorized = (password === '10140');
  }

  if (authorized) {
    playSound('click');
    closeModal();
    activeRole = 'admin';
    localStorage.setItem('partido_active_role', 'admin');
    updateRoleView();
  } else {
    playSound('click');
    showToast('Contraseña incorrecta', 'danger');
    passwordInput.value = '';
    passwordInput.focus();
  }
}
