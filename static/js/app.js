const API = "https://kendreams-makeup-production.up.railway.app/api";

const State = {
  user:     JSON.parse(localStorage.getItem("km_user") || "null"),
  token:    localStorage.getItem("km_token") || null,
  cart:     JSON.parse(localStorage.getItem("km_cart") || "[]"),
  productos: [],
  categorias: [],
  currentPage: "home",
};

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (State.token) headers["Authorization"] = `Bearer ${State.token}`;
  const res = await fetch(API + path, { ...options, headers });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || "Error del servidor");
  return json.data;
}

function saveSession(data) {
  State.token = data.token;
  State.user  = { nombre: data.nombre, rol: data.rol, id: data.id };
  localStorage.setItem("km_token", data.token);
  localStorage.setItem("km_user",  JSON.stringify(State.user));
}
function clearSession() {
  State.token = null; State.user = null;
  localStorage.removeItem("km_token");
  localStorage.removeItem("km_user");
}

function cartCount() { return State.cart.reduce((a, b) => a + b.cantidad, 0); }
function cartTotal() { return State.cart.reduce((a, b) => a + b.precio * b.cantidad, 0); }

function addToCart(producto) {
  const ex = State.cart.find(i => i.id === producto.id);
  if (ex) ex.cantidad++;
  else State.cart.push({ ...producto, cantidad: 1 });
  saveCart();
  renderCartBadge();
  showToast(`✅ ${producto.nombre} agregado al carrito`);
}
function removeFromCart(id) {
  State.cart = State.cart.filter(i => i.id !== id);
  saveCart();
  renderCartBadge();
}
function saveCart() { localStorage.setItem("km_cart", JSON.stringify(State.cart)); }

const cop = n => "$" + Number(n).toLocaleString("es-CO") + " COP";

function showToast(msg, type = "success") {
  const t = document.createElement("div");
  t.className = `toast toast--${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("toast--show"));
  setTimeout(() => { t.classList.remove("toast--show"); setTimeout(() => t.remove(), 400); }, 2800);
}

function renderCartBadge() {
  const b = document.getElementById("cart-count");
  if (b) { b.textContent = cartCount(); b.style.display = cartCount() ? "flex" : "none"; }
}

function renderUserNav() {
  const nav = document.getElementById("user-nav");
  if (!nav) return;
  if (State.user) {
    nav.innerHTML = `
      <div class="user-menu">
        <button class="btn-user" onclick="toggleUserMenu()">
          <span class="user-avatar">${State.user.nombre[0].toUpperCase()}</span>
          ${State.user.nombre.split(" ")[0]}
        </button>
        <div class="user-dropdown" id="user-dropdown" style="display:none">
          <a onclick="navigate('pedidos')">Mis Pedidos</a>
          ${State.user.rol === "admin" ? '<a onclick="navigate(\'admin\')">Panel Admin</a>' : ""}
          <a onclick="logout()">Cerrar Sesión</a>
        </div>
      </div>`;
  } else {
    nav.innerHTML = `<button class="btn btn--outline" onclick="navigate('login')">Iniciar Sesión</button>`;
  }
}
function toggleUserMenu() {
  const d = document.getElementById("user-dropdown");
  if (d) d.style.display = d.style.display === "none" ? "block" : "none";
}
function logout() { clearSession(); navigate("home"); showToast("Sesión cerrada"); }

function navigate(page, data = {}) {
  State.currentPage = page;
  window.scrollTo(0, 0);
  renderPage(page, data);
  history.pushState({ page, data }, "", "#" + page);
}

window.addEventListener("popstate", e => {
  if (e.state) renderPage(e.state.page, e.state.data);
  else renderPage("home");
});

async function renderPage(page, data = {}) {
  renderUserNav();
  renderCartBadge();
  const main = document.getElementById("main");
  if (!main) return;
  document.querySelectorAll(".nav-link").forEach(l => {
    l.classList.toggle("active", l.dataset.page === page);
  });
  switch (page) {
    case "home":     return renderHome(main);
    case "catalogo": return renderCatalogo(main, data);
    case "producto": return renderProducto(main, data.id);
    case "carrito":  return renderCarrito(main);
    case "login":    return renderLogin(main);
    case "register": return renderRegister(main);
    case "pedidos":  return renderPedidos(main);
    case "admin":    return renderAdmin(main);
    default: main.innerHTML = '<div class="empty"><h2>404 — Página no encontrada</h2></div>';
  }
}

async function renderHome(main) {
  main.innerHTML = `
    <section class="hero">
      <div class="hero__bg"></div>
      <div class="hero__content">
        <p class="hero__eyebrow">Emprendimiento de Belleza · Soledad, Atlántico</p>
        <h1 class="hero__title">KENDREAMS<br><span>MAKEUP</span></h1>
        <p class="hero__sub">Descubre maquillaje y productos faciales que realzan tu belleza.</p>
        <div class="hero__ctas">
          <button class="btn btn--primary" onclick="navigate('catalogo')">Ver Catálogo</button>
          <a href="https://wa.me/573247020486" target="_blank" class="btn btn--wa">📲 Contáctanos</a>
        </div>
      </div>
      <div class="hero__scroll">↓</div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section__title">Explora por Categoría</h2>
        <div class="cat-grid" id="cat-grid"><div class="skeleton-row"></div></div>
      </div>
    </section>
    <section class="section section--pink">
      <div class="container">
        <h2 class="section__title">Productos Destacados</h2>
        <p class="section__sub">Los favoritos de nuestras clientas</p>
        <div class="prod-grid" id="dest-grid"><div class="skeleton-row"></div></div>
      </div>
    </section>
    <section class="wa-banner">
      <div class="container wa-banner__inner">
        <div>
          <h3>🛵 ¡Domicilios disponibles en Soledad!</h3>
          <p>Pedidos a través de WhatsApp. Pagos contra entrega o transferencia.</p>
        </div>
        <a href="https://wa.me/573247020486" target="_blank" class="btn btn--wa btn--lg">💬 Escribir por WhatsApp</a>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section__title">¿Por qué elegirnos?</h2>
        <div class="features">
          <div class="feature"><div class="feature__icon">✅</div><h4>Productos de Calidad</h4><p>Marcas confiables con fórmulas de larga duración.</p></div>
          <div class="feature"><div class="feature__icon">🛵</div><h4>Domicilio a Domicilio</h4><p>Enviamos a todo Soledad y municipios cercanos.</p></div>
          <div class="feature"><div class="feature__icon">💰</div><h4>Precios Accesibles</h4><p>Belleza para todas sin comprometer tu bolsillo.</p></div>
          <div class="feature"><div class="feature__icon">💬</div><h4>Asesoría Personalizada</h4><p>Te ayudamos a encontrar el producto ideal para ti.</p></div>
        </div>
      </div>
    </section>`;

  const cats = await api("/categorias");
  State.categorias = cats;
  document.getElementById("cat-grid").innerHTML = cats.map(c => `
    <button class="cat-chip" onclick="navigate('catalogo',{categoria:'${c.slug}'})">
      <span class="cat-chip__icon">${c.emoji}</span>
      <span>${c.nombre}</span>
    </button>`).join("");

  const prods = await api("/productos?destacado=1");
  document.getElementById("dest-grid").innerHTML = prods.map(renderCard).join("");
}

async function renderCatalogo(main, data = {}) {
  main.innerHTML = `
    <section class="section">
      <div class="container">
        <div class="catalogo-header">
          <h1 class="page-title">Catálogo</h1>
          <div class="search-box">
            <input type="text" id="search-input" placeholder="Buscar producto..." class="input"/>
            <button class="btn btn--primary btn--sm" onclick="buscarProductos()">🔍</button>
          </div>
        </div>
        <div class="cat-filters" id="cat-filters"></div>
        <div class="prod-grid" id="prod-grid"><div class="skeleton-row"></div></div>
      </div>
    </section>`;

  const cats = State.categorias.length ? State.categorias : await api("/categorias");
  State.categorias = cats;
  const active = data.categoria || "";
  document.getElementById("cat-filters").innerHTML = [
    { slug: "", nombre: "Todos", emoji: "🛍️" }, ...cats
  ].map(c => `
    <button class="filter-chip ${c.slug === active ? "filter-chip--active" : ""}"
      onclick="filtrarCategoria('${c.slug}')">
      ${c.emoji || ""} ${c.nombre}
    </button>`).join("");
  await cargarProductos(active);
}

async function cargarProductos(categoria = "", q = "") {
  const grid = document.getElementById("prod-grid");
  if (!grid) return;
  grid.innerHTML = '<div class="skeleton-row"></div>';
  const qs = new URLSearchParams();
  if (categoria) qs.set("categoria", categoria);
  if (q) qs.set("q", q);
  const prods = await api("/productos?" + qs.toString());
  grid.innerHTML = prods.length
    ? prods.map(renderCard).join("")
    : '<div class="empty"><p>No se encontraron productos</p></div>';
}

function filtrarCategoria(slug) {
  document.querySelectorAll(".filter-chip").forEach(b => {
    b.classList.toggle("filter-chip--active", b.textContent.trim().includes(slug) || (!slug && b.textContent.includes("Todos")));
  });
  cargarProductos(slug);
}

function buscarProductos() {
  const q = document.getElementById("search-input")?.value || "";
  cargarProductos("", q);
}

function renderCard(p) {
  return `
    <div class="prod-card" onclick="navigate('producto',{id:${p.id}})">
      <div class="prod-card__img-wrap">
        <img src="${p.imagen_url}" alt="${p.nombre}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x300/fce4ec/c2185b?text=💄'">
        <span class="prod-card__cat">${p.categoria_nombre || ""}</span>
      </div>
      <div class="prod-card__body">
        <h3 class="prod-card__name">${p.nombre}</h3>
        <p class="prod-card__desc">${(p.descripcion || "").slice(0,60)}…</p>
        <div class="prod-card__footer">
          <span class="prod-card__price">${cop(p.precio)}</span>
          <button class="btn btn--primary btn--sm" onclick="event.stopPropagation();addToCart({id:${p.id},nombre:'${p.nombre.replace(/'/g,"\\'")}',precio:${p.precio},imagen_url:'${p.imagen_url}'})">
            + Agregar
          </button>
        </div>
      </div>
    </div>`;
}

async function renderProducto(main, id) {
  main.innerHTML = `<div class="container section"><div class="skeleton-row" style="height:400px"></div></div>`;
  try {
    const { producto: p, relacionados } = await api(`/productos/${id}`);
    main.innerHTML = `
      <div class="container section">
        <a class="back-link" onclick="history.back()">← Volver al catálogo</a>
        <div class="prod-detail">
          <div class="prod-detail__img">
            <img src="${p.imagen_url}" alt="${p.nombre}" onerror="this.src='https://via.placeholder.com/500x500/fce4ec/c2185b?text=💄'">
          </div>
          <div class="prod-detail__info">
            <span class="badge">${p.categoria_nombre}</span>
            <h1>${p.nombre}</h1>
            <p class="prod-detail__desc">${p.descripcion}</p>
            <div class="prod-detail__price">${cop(p.precio)}</div>
            <div class="prod-detail__actions">
              <button class="btn btn--primary btn--lg" onclick="addToCart({id:${p.id},nombre:'${p.nombre.replace(/'/g,"\\'")}',precio:${p.precio},imagen_url:'${p.imagen_url}'})">
                🛒 Agregar al Carrito
              </button>
              <a href="https://wa.me/573247020486?text=Hola! Me interesa ${encodeURIComponent(p.nombre)}" target="_blank" class="btn btn--wa btn--lg">
                📲 Pedir por WhatsApp
              </a>
            </div>
            <div class="prod-detail__details">
              <p>✅ Categoría: ${p.categoria_nombre}</p>
              <p>✅ Envío disponible en Soledad, Atlántico</p>
              <p>✅ Pago contra entrega o transferencia</p>
              <p>✅ Producto 100% auténtico</p>
            </div>
          </div>
        </div>
        ${relacionados.length ? `
          <h2 class="section__title" style="margin-top:3rem">Productos relacionados</h2>
          <div class="prod-grid">${relacionados.map(renderCard).join("")}</div>` : ""}
      </div>`;
  } catch(e) {
    main.innerHTML = `<div class="container section empty"><h2>Producto no encontrado</h2></div>`;
  }
}

function renderCarrito(main) {
  if (!State.cart.length) {
    main.innerHTML = `
      <div class="container section empty">
        <div class="empty__icon">🛒</div>
        <h2>Tu carrito está vacío</h2>
        <p>Agrega productos desde el catálogo</p>
        <button class="btn btn--primary" onclick="navigate('catalogo')">Ver Catálogo</button>
      </div>`;
    return;
  }
  main.innerHTML = `
    <section class="section">
      <div class="container">
        <h1 class="page-title">Tu Carrito 🛍️</h1>
        <div class="cart-layout">
          <div class="cart-items" id="cart-items"></div>
          <div class="cart-summary">
            <h3>Resumen del pedido</h3>
            <div class="cart-summary__row"><span>${cartCount()} producto(s)</span><span>${cop(cartTotal())}</span></div>
            <div class="cart-summary__row"><span>Envío</span><span>A convenir</span></div>
            <div class="cart-summary__total"><span>Total</span><span>${cop(cartTotal())}</span></div>
            <button class="btn btn--primary btn--lg" onclick="confirmarPedido()">✅ Confirmar pedido</button>
            <a href="https://wa.me/573247020486" target="_blank" class="btn btn--wa btn--lg">📲 Contactar por WhatsApp</a>
            <button class="btn btn--ghost" onclick="navigate('catalogo')">Seguir comprando</button>
          </div>
        </div>
      </div>
    </section>`;
  document.getElementById("cart-items").innerHTML = State.cart.map(i => `
    <div class="cart-item">
      <img src="${i.imagen_url}" alt="${i.nombre}" onerror="this.src='https://via.placeholder.com/80x80/fce4ec/c2185b?text=💄'">
      <div class="cart-item__info"><h4>${i.nombre}</h4><p>Cantidad: ${i.cantidad}</p></div>
      <span class="cart-item__price">${cop(i.precio)}</span>
      <button class="cart-item__remove" onclick="removeFromCart(${i.id});renderCarrito(document.getElementById('main'))">✕</button>
    </div>`).join("");
}

function confirmarPedido() {
  if (!State.user) { navigate("login"); showToast("Inicia sesión para confirmar tu pedido", "info"); return; }
  const main = document.getElementById("main");
  main.innerHTML = `
    <section class="section">
      <div class="container" style="max-width:600px">
        <h1 class="page-title">Finalizar Pedido 🛒</h1>
        <div class="form-group">
          <label>Nombre completo</label>
          <input type="text" id="co-nombre" class="input" placeholder="Tu nombre completo">
        </div>
        <div class="form-group">
          <label>Teléfono / WhatsApp</label>
          <input type="text" id="co-telefono" class="input" placeholder="3001234567">
        </div>
        <div class="form-group">
          <label>Dirección</label>
          <input type="text" id="co-direccion" class="input" placeholder="Calle 10 # 5-20">
        </div>
        <div class="form-group">
          <label>Barrio</label>
          <input type="text" id="co-barrio" class="input" placeholder="Tu barrio">
        </div>
        <div class="form-group">
          <label>Ciudad</label>
          <input type="text" id="co-ciudad" class="input" placeholder="Soledad">
        </div>
        <h3 style="margin:1.5rem 0 1rem">Forma de pago</h3>
        <div style="display:flex;gap:1rem;margin-bottom:1.5rem">
          <button id="btn-contra" class="btn btn--primary" onclick="seleccionarPago('contra_entrega')">🚗 Contra entrega</button>
          <button id="btn-nequi" class="btn btn--outline" onclick="seleccionarPago('nequi')">📱 Nequi</button>
        </div>
        <div id="info-pago" style="display:none;background:#fff3f7;border-radius:12px;padding:1.5rem;text-align:center;margin-bottom:1.5rem">
          <p style="font-weight:600;margin-bottom:1rem">Escanea el QR para pagar por Nequi:</p>
          <img src="https://res.cloudinary.com/demo/image/upload/qr_nequi.jpg" alt="QR Nequi" style="width:220px;border-radius:12px;margin-bottom:1rem" onerror="this.style.display='none'">
          <p>📞 Número: <strong>3247020486</strong></p>
          <p style="font-size:.85rem;color:#888">Luego de pagar, sube el comprobante por WhatsApp</p>
        </div>
        <div class="cart-summary__total" style="margin-bottom:1.5rem">
          <span>Total a pagar</span>
          <span>${cop(cartTotal())}</span>
        </div>
        <button class="btn btn--primary btn--lg btn--full" onclick="enviarPedido()">✅ Confirmar pedido</button>
        <button class="btn btn--ghost btn--full" style="margin-top:.5rem" onclick="navigate('carrito')">← Volver al carrito</button>
      </div>
    </section>`;
  seleccionarPago("contra_entrega");
}

function seleccionarPago(tipo) {
  State.formaPago = tipo;
  document.getElementById("btn-contra").className = tipo === "contra_entrega" ? "btn btn--primary" : "btn btn--outline";
  document.getElementById("btn-nequi").className  = tipo === "nequi" ? "btn btn--primary" : "btn btn--outline";
  document.getElementById("info-pago").style.display = tipo === "nequi" ? "block" : "none";
}

async function enviarPedido() {
  const nombre    = document.getElementById("co-nombre").value.trim();
  const telefono  = document.getElementById("co-telefono").value.trim();
  const direccion = document.getElementById("co-direccion").value.trim();
  const barrio    = document.getElementById("co-barrio").value.trim();
  const ciudad    = document.getElementById("co-ciudad").value.trim();
  const forma_pago = State.formaPago || "contra_entrega";
  if (!nombre || !telefono || !direccion) {
    showToast("Por favor completa nombre, teléfono y dirección", "error"); return;
  }
  try {
    const items = State.cart.map(i => ({ producto_id: i.id, cantidad: i.cantidad }));
    const data = await api("/pedidos", {
      method: "POST",
      body: JSON.stringify({ items, nombre_cliente: nombre, telefono, direccion, barrio, ciudad, forma_pago })
    });
    State.cart = []; saveCart(); renderCartBadge();
    showToast(`🎉 Pedido #${data.pedido_id} confirmado!`);
    navigate("pedidos");
  } catch(e) { showToast(e.message, "error"); }
}

function renderLogin(main) {
  main.innerHTML = `
    <section class="auth-section">
      <div class="auth-card">
        <div class="auth-card__logo">💄</div>
        <h2>Iniciar Sesión</h2>
        <div id="auth-error" class="auth-error" style="display:none"></div>
        <div class="form-group"><label>Email</label><input type="email" id="login-email" class="input" placeholder="correo@ejemplo.com"></div>
        <div class="form-group"><label>Contraseña</label><input type="password" id="login-pass" class="input" placeholder="••••••••"></div>
        <button class="btn btn--primary btn--lg btn--full" onclick="doLogin()">Entrar</button>
        <p class="auth-switch">¿No tienes cuenta? <a onclick="navigate('register')">Regístrate gratis</a></p>
      </div>
    </section>`;
}

async function doLogin() {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-pass").value;
  const errDiv = document.getElementById("auth-error");
  try {
    const data = await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    saveSession(data);
    showToast(`👋 Bienvenida, ${data.nombre}!`);
    navigate("home");
  } catch(e) { errDiv.style.display = "block"; errDiv.textContent = e.message; }
}

function renderRegister(main) {
  main.innerHTML = `
    <section class="auth-section">
      <div class="auth-card">
        <div class="auth-card__logo">✨</div>
        <h2>Crear Cuenta</h2>
        <div id="auth-error" class="auth-error" style="display:none"></div>
        <div class="form-group"><label>Nombre completo</label><input type="text" id="reg-name" class="input" placeholder="Tu nombre"></div>
        <div class="form-group"><label>Email</label><input type="email" id="reg-email" class="input" placeholder="correo@ejemplo.com"></div>
        <div class="form-group"><label>Contraseña</label><input type="password" id="reg-pass" class="input" placeholder="Mínimo 6 caracteres"></div>
        <button class="btn btn--primary btn--lg btn--full" onclick="doRegister()">Crear cuenta</button>
        <p class="auth-switch">¿Ya tienes cuenta? <a onclick="navigate('login')">Inicia sesión</a></p>
      </div>
    </section>`;
}

async function doRegister() {
  const nombre   = document.getElementById("reg-name").value;
  const email    = document.getElementById("reg-email").value;
  const password = document.getElementById("reg-pass").value;
  const errDiv   = document.getElementById("auth-error");
  try {
    const data = await api("/auth/register", { method: "POST", body: JSON.stringify({ nombre, email, password }) });
    saveSession(data);
    showToast("🎉 Cuenta creada exitosamente!");
    navigate("home");
  } catch(e) { errDiv.style.display = "block"; errDiv.textContent = e.message; }
}

async function renderPedidos(main) {
  if (!State.user) { navigate("login"); return; }
  main.innerHTML = `<div class="container section"><h1 class="page-title">Mis Pedidos</h1><div id="pedidos-list"><div class="skeleton-row"></div></div></div>`;
  try {
    const pedidos = await api("/pedidos");
    const list = document.getElementById("pedidos-list");
    if (!pedidos.length) {
      list.innerHTML = `<div class="empty"><p>Aún no tienes pedidos</p><button class="btn btn--primary" onclick="navigate('catalogo')">Ir al catálogo</button></div>`;
      return;
    }
    list.innerHTML = pedidos.map(p => `
      <div class="order-card">
        <div class="order-card__header">
          <span class="order-card__id">Pedido #${p.id}</span>
          <span class="status status--${p.estado}">${p.estado}</span>
        </div>
        <div class="order-card__body">
          <p>${p.num_productos} producto(s)</p>
          <p><strong>${cop(p.total)}</strong></p>
          <p>${new Date(p.creado_en).toLocaleDateString("es-CO")}</p>
        </div>
      </div>`).join("");
  } catch(e) { showToast(e.message, "error"); }
}

async function renderAdmin(main) {
  if (!State.user || State.user.rol !== "admin") { navigate("home"); return; }
  main.innerHTML = `
    <div class="container section">
      <h1 class="page-title">Panel de Administración 🛠️</h1>
      <div class="admin-tabs">
        <button class="tab tab--active" onclick="adminTab('productos')">Productos</button>
        <button class="tab" onclick="adminTab('pedidos')">Pedidos</button>
      </div>
      <div id="admin-content"></div>
    </div>`;
  adminTab("productos");
}

async function adminTab(tab) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("tab--active", t.textContent.toLowerCase().includes(tab)));
  const content = document.getElementById("admin-content");
  if (tab === "productos") {
    const [prods, cats] = await Promise.all([api("/productos"), api("/categorias")]);
    content.innerHTML = `
      <div style="margin-bottom:2rem;background:#fff3f7;border-radius:12px;padding:1.5rem">
        <h3 style="margin-bottom:1rem">➕ Agregar nuevo producto</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
          <div class="form-group"><label>Nombre</label><input type="text" id="np-nombre" class="input" placeholder="Nombre del producto"></div>
          <div class="form-group"><label>Precio</label><input type="number" id="np-precio" class="input" placeholder="25000"></div>
          <div class="form-group"><label>Stock</label><input type="number" id="np-stock" class="input" placeholder="10"></div>
          <div class="form-group"><label>Categoría</label>
            <select id="np-categoria" class="input">
              ${cats.map(c => `<option value="${c.id}">${c.nombre}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="form-group"><label>Descripción</label><input type="text" id="np-desc" class="input" placeholder="Descripción del producto"></div>
        <div class="form-group"><label>URL de imagen</label><input type="text" id="np-imagen" class="input" placeholder="https://..."></div>
        <div class="form-group" style="display:flex;align-items:center;gap:.5rem">
          <input type="checkbox" id="np-destacado"> <label>Producto destacado</label>
        </div>
        <button class="btn btn--primary" onclick="adminCrearProducto()">✅ Agregar producto</button>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>ID</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Imagen</th><th>Acciones</th></tr></thead>
          <tbody>${prods.map(p => `
            <tr>
              <td>${p.id}</td>
              <td>${p.nombre}</td>
              <td>${p.categoria_nombre}</td>
              <td><input type="number" id="precio-${p.id}" value="${p.precio}" style="width:90px;padding:4px;border-radius:6px;border:1px solid #ddd"></td>
              <td><input type="number" id="stock-${p.id}" value="${p.stock}" style="width:70px;padding:4px;border-radius:6px;border:1px solid #ddd"></td>
              <td><input type="text" id="img-${p.id}" value="${p.imagen_url}" style="width:150px;padding:4px;border-radius:6px;border:1px solid #ddd"></td>
              <td><button class="btn btn--primary btn--sm" onclick="adminActualizarProducto(${p.id})">💾 Guardar</button></td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  } else {
    const pedidos = await api("/admin/pedidos");
    content.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>ID</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th><th>Pago</th></tr></thead>
          <tbody>${pedidos.map(p => `
            <tr>
              <td>#${p.id}</td><td>${p.cliente}</td><td>${cop(p.total)}</td>
              <td>
                <select onchange="cambiarEstadoPedido(${p.id}, this.value)" style="padding:4px;border-radius:6px;border:1px solid #ddd">
                  ${["pendiente","confirmado","enviado","entregado","cancelado"].map(e =>
                    `<option value="${e}" ${p.estado===e?"selected":""}>${e}</option>`
                  ).join("")}
                </select>
              </td>
              <td>${new Date(p.creado_en).toLocaleDateString("es-CO")}</td>
              <td>${p.forma_pago==="nequi" ? `<button class="btn btn--sm btn--primary" onclick="verificarNequi(${p.id})">✅ Verificar Nequi</button>` : "Contra entrega"}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }
}

async function adminCrearProducto() {
  const nombre      = document.getElementById("np-nombre").value.trim();
  const precio      = document.getElementById("np-precio").value;
  const stock       = document.getElementById("np-stock").value;
  const categoria_id = document.getElementById("np-categoria").value;
  const descripcion = document.getElementById("np-desc").value.trim();
  const imagen_url  = document.getElementById("np-imagen").value.trim();
  const destacado   = document.getElementById("np-destacado").checked ? 1 : 0;
  if (!nombre || !precio || !categoria_id) { showToast("Completa nombre, precio y categoría", "error"); return; }
  try {
    await api("/admin/productos", { method: "POST", body: JSON.stringify({ nombre, precio, stock, categoria_id, descripcion, imagen_url, destacado }) });
    showToast("✅ Producto agregado!");
    adminTab("productos");
  } catch(e) { showToast(e.message, "error"); }
}

async function adminActualizarProducto(pid) {
  const precio     = document.getElementById(`precio-${pid}`).value;
  const stock      = document.getElementById(`stock-${pid}`).value;
  const imagen_url = document.getElementById(`img-${pid}`).value.trim();
  try {
    await api(`/admin/productos/${pid}`, { method: "PATCH", body: JSON.stringify({ precio, stock, imagen_url }) });
    showToast("✅ Producto actualizado!");
  } catch(e) { showToast(e.message, "error"); }
}

async function cambiarEstadoPedido(oid, estado) {
  try {
    await api(`/admin/pedidos/${oid}/estado`, { method: "PATCH", body: JSON.stringify({ estado }) });
    showToast("✅ Estado actualizado!");
  } catch(e) { showToast(e.message, "error"); }
}

async function verificarNequi(oid) {
  try {
    await api(`/pedidos/${oid}/verificar-nequi`, { method: "PATCH" });
    showToast("✅ Pago Nequi verificado!");
    adminTab("pedidos");
  } catch(e) { showToast(e.message, "error"); }
}

document.addEventListener("DOMContentLoaded", () => {
  renderUserNav();
  renderCartBadge();
  const hash = location.hash.replace("#", "") || "home";
  renderPage(hash);
});  document.querySelectorAll(".nav-link").forEach(l => {
    l.classList.toggle("active", l.dataset.page === page);
  });
  switch (page) {
    case "home":     return renderHome(main);
    case "catalogo": return renderCatalogo(main, data);
    case "producto": return renderProducto(main, data.id);
    case "carrito":  return renderCarrito(main);
    case "login":    return renderLogin(main);
    case "register": return renderRegister(main);
    case "pedidos":  return renderPedidos(main);
    case "admin":    return renderAdmin(main);
    default: main.innerHTML = '<div class="empty"><h2>404 — Página no encontrada</h2></div>';
  }
}

async function renderHome(main) {
  main.innerHTML = `
    <section class="hero">
      <div class="hero__bg"></div>
      <div class="hero__content">
        <p class="hero__eyebrow">Emprendimiento de Belleza · Soledad, Atlántico</p>
        <h1 class="hero__title">KENDREAMS<br><span>MAKEUP</span></h1>
        <p class="hero__sub">Descubre maquillaje y productos faciales que realzan tu belleza.</p>
        <div class="hero__ctas">
          <button class="btn btn--primary" onclick="navigate('catalogo')">Ver Catálogo</button>
          <a href="https://wa.me/573001234567" target="_blank" class="btn btn--wa">📲 Contáctanos</a>
        </div>
      </div>
      <div class="hero__scroll">↓</div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section__title">Explora por Categoría</h2>
        <div class="cat-grid" id="cat-grid"><div class="skeleton-row"></div></div>
      </div>
    </section>
    <section class="section section--pink">
      <div class="container">
        <h2 class="section__title">Productos Destacados</h2>
        <p class="section__sub">Los favoritos de nuestras clientas</p>
        <div class="prod-grid" id="dest-grid"><div class="skeleton-row"></div></div>
      </div>
    </section>
    <section class="wa-banner">
      <div class="container wa-banner__inner">
        <div>
          <h3>🛵 ¡Domicilios disponibles en Soledad!</h3>
          <p>Pedidos a través de WhatsApp. Pagos contra entrega o por transferencia.</p>
        </div>
        <a href="https://wa.me/573001234567" target="_blank" class="btn btn--wa btn--lg">💬 Escribir por WhatsApp</a>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section__title">¿Por qué elegirnos?</h2>
        <div class="features">
          <div class="feature"><div class="feature__icon">✅</div><h4>Productos de Calidad</h4><p>Marcas confiables con fórmulas de larga duración.</p></div>
          <div class="feature"><div class="feature__icon">🛵</div><h4>Domicilio a Domicilio</h4><p>Enviamos a todo Soledad y municipios cercanos.</p></div>
          <div class="feature"><div class="feature__icon">💰</div><h4>Precios Accesibles</h4><p>Belleza para todas sin comprometer tu bolsillo.</p></div>
          <div class="feature"><div class="feature__icon">💬</div><h4>Asesoría Personalizada</h4><p>Te ayudamos a encontrar el producto ideal para ti.</p></div>
        </div>
      </div>
    </section>`;

  const cats = await api("/categorias");
  State.categorias = cats;
  document.getElementById("cat-grid").innerHTML = cats.map(c => `
    <button class="cat-chip" onclick="navigate('catalogo',{categoria:'${c.slug}'})">
      <span class="cat-chip__icon">${c.emoji}</span>
      <span>${c.nombre}</span>
    </button>`).join("");

  const prods = await api("/productos?destacado=1");
  document.getElementById("dest-grid").innerHTML = prods.map(renderCard).join("");
}

async function renderCatalogo(main, data = {}) {
  main.innerHTML = `
    <section class="section">
      <div class="container">
        <div class="catalogo-header">
          <h1 class="page-title">Catálogo</h1>
          <div class="search-box">
            <input type="text" id="search-input" placeholder="Buscar producto..." class="input"/>
            <button class="btn btn--primary btn--sm" onclick="buscarProductos()">🔍</button>
          </div>
        </div>
        <div class="cat-filters" id="cat-filters"></div>
        <div class="prod-grid" id="prod-grid"><div class="skeleton-row"></div></div>
      </div>
    </section>`;

  const cats = State.categorias.length ? State.categorias : await api("/categorias");
  State.categorias = cats;
  const active = data.categoria || "";
  document.getElementById("cat-filters").innerHTML = [
    { slug: "", nombre: "Todos", emoji: "🛍️" }, ...cats
  ].map(c => `
    <button class="filter-chip ${c.slug === active ? "filter-chip--active" : ""}"
      onclick="filtrarCategoria('${c.slug}')">
      ${c.emoji || ""} ${c.nombre}
    </button>`).join("");
  await cargarProductos(active);
}

async function cargarProductos(categoria = "", q = "") {
  const grid = document.getElementById("prod-grid");
  if (!grid) return;
  grid.innerHTML = '<div class="skeleton-row"></div>';
  const qs = new URLSearchParams();
  if (categoria) qs.set("categoria", categoria);
  if (q) qs.set("q", q);
  const prods = await api("/productos?" + qs.toString());
  grid.innerHTML = prods.length
    ? prods.map(renderCard).join("")
    : '<div class="empty"><p>No se encontraron productos</p></div>';
}

function filtrarCategoria(slug) {
  document.querySelectorAll(".filter-chip").forEach(b => {
    b.classList.toggle("filter-chip--active", b.textContent.trim().includes(slug) || (!slug && b.textContent.includes("Todos")));
  });
  cargarProductos(slug);
}

function buscarProductos() {
  const q = document.getElementById("search-input")?.value || "";
  cargarProductos("", q);
}

function renderCard(p) {
  return `
    <div class="prod-card" onclick="navigate('producto',{id:${p.id}})">
      <div class="prod-card__img-wrap">
        <img src="${p.imagen_url}" alt="${p.nombre}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x300/fce4ec/c2185b?text=💄'">
        <span class="prod-card__cat">${p.categoria_nombre || ""}</span>
      </div>
      <div class="prod-card__body">
        <h3 class="prod-card__name">${p.nombre}</h3>
        <p class="prod-card__desc">${(p.descripcion || "").slice(0,60)}…</p>
        <div class="prod-card__footer">
          <span class="prod-card__price">${cop(p.precio)}</span>
          <button class="btn btn--primary btn--sm" onclick="event.stopPropagation();addToCart({id:${p.id},nombre:'${p.nombre.replace(/'/g,"\\'")}',precio:${p.precio},imagen_url:'${p.imagen_url}'})">
            + Agregar
          </button>
        </div>
      </div>
    </div>`;
}

async function renderProducto(main, id) {
  main.innerHTML = `<div class="container section"><div class="skeleton-row" style="height:400px"></div></div>`;
  try {
    const { producto: p, relacionados } = await api(`/productos/${id}`);
    main.innerHTML = `
      <div class="container section">
        <a class="back-link" onclick="history.back()">← Volver al catálogo</a>
        <div class="prod-detail">
          <div class="prod-detail__img">
            <img src="${p.imagen_url}" alt="${p.nombre}" onerror="this.src='https://via.placeholder.com/500x500/fce4ec/c2185b?text=💄'">
          </div>
          <div class="prod-detail__info">
            <span class="badge">${p.categoria_nombre}</span>
            <h1>${p.nombre}</h1>
            <p class="prod-detail__desc">${p.descripcion}</p>
            <div class="prod-detail__price">${cop(p.precio)}</div>
            <div class="prod-detail__actions">
              <button class="btn btn--primary btn--lg" onclick="addToCart({id:${p.id},nombre:'${p.nombre.replace(/'/g,"\\'")}',precio:${p.precio},imagen_url:'${p.imagen_url}'})">
                🛒 Agregar al Carrito
              </button>
              <a href="https://wa.me/573247020486?text=Hola! Me interesa ${encodeURIComponent(p.nombre)}" target="_blank" class="btn btn--wa btn--lg">
                📲 Pedir por WhatsApp
              </a>
            </div>
            <div class="prod-detail__details">
              <p>✅ Categoría: ${p.categoria_nombre}</p>
              <p>✅ Envío disponible en Soledad, Atlántico</p>
              <p>✅ Pago contra entrega o transferencia</p>
              <p>✅ Producto 100% auténtico</p>
            </div>
          </div>
        </div>
        ${relacionados.length ? `
          <h2 class="section__title" style="margin-top:3rem">Productos relacionados</h2>
          <div class="prod-grid">${relacionados.map(renderCard).join("")}</div>` : ""}
      </div>`;
  } catch(e) {
    main.innerHTML = `<div class="container section empty"><h2>Producto no encontrado</h2></div>`;
  }
}

function renderCarrito(main) {
  if (!State.cart.length) {
    main.innerHTML = `
      <div class="container section empty">
        <div class="empty__icon">🛒</div>
        <h2>Tu carrito está vacío</h2>
        <p>Agrega productos desde el catálogo</p>
        <button class="btn btn--primary" onclick="navigate('catalogo')">Ver Catálogo</button>
      </div>`;
    return;
  }
  main.innerHTML = `
    <section class="section">
      <div class="container">
        <h1 class="page-title">Tu Carrito 🛍️</h1>
        <div class="cart-layout">
          <div class="cart-items" id="cart-items"></div>
          <div class="cart-summary">
            <h3>Resumen del pedido</h3>
            <div class="cart-summary__row"><span>${cartCount()} producto(s)</span><span>${cop(cartTotal())}</span></div>
            <div class="cart-summary__row"><span>Envío</span><span>A convenir</span></div>
            <div class="cart-summary__total"><span>Total</span><span>${cop(cartTotal())}</span></div>
            <button class="btn btn--primary btn--lg" onclick="confirmarPedido()">✅ Confirmar pedido</button>
            <a href="https://wa.me/573247020486" target="_blank" class="btn btn--wa btn--lg">📲 Contactar por WhatsApp</a>
            <button class="btn btn--ghost" onclick="navigate('catalogo')">Seguir comprando</button>
          </div>
        </div>
      </div>
    </section>`;
  document.getElementById("cart-items").innerHTML = State.cart.map(i => `
    <div class="cart-item">
      <img src="${i.imagen_url}" alt="${i.nombre}" onerror="this.src='https://via.placeholder.com/80x80/fce4ec/c2185b?text=💄'">
      <div class="cart-item__info"><h4>${i.nombre}</h4><p>Cantidad: ${i.cantidad}</p></div>
      <span class="cart-item__price">${cop(i.precio)}</span>
      <button class="cart-item__remove" onclick="removeFromCart(${i.id});renderCarrito(document.getElementById('main'))">✕</button>
    </div>`).join("");
}

function confirmarPedido() {
  if (!State.user) { navigate("login"); showToast("Inicia sesión para confirmar tu pedido", "info"); return; }
  const main = document.getElementById("main");
  main.innerHTML = `
    <section class="section">
      <div class="container" style="max-width:600px">
        <h1 class="page-title">Finalizar Pedido 🛒</h1>

        <div class="form-group">
          <label>Nombre completo</label>
          <input type="text" id="co-nombre" class="input" placeholder="Tu nombre completo">
        </div>
        <div class="form-group">
          <label>Teléfono / WhatsApp</label>
          <input type="text" id="co-telefono" class="input" placeholder="3001234567">
        </div>
        <div class="form-group">
          <label>Dirección</label>
          <input type="text" id="co-direccion" class="input" placeholder="Calle 10 # 5-20">
        </div>
        <div class="form-group">
          <label>Barrio</label>
          <input type="text" id="co-barrio" class="input" placeholder="Tu barrio">
        </div>
        <div class="form-group">
          <label>Ciudad</label>
          <input type="text" id="co-ciudad" class="input" placeholder="Soledad">
        </div>

        <h3 style="margin:1.5rem 0 1rem">Forma de pago</h3>
        <div style="display:flex;gap:1rem;margin-bottom:1.5rem">
          <button id="btn-contra" class="btn btn--primary" onclick="seleccionarPago('contra_entrega')">🚗 Contra entrega</button>
          <button id="btn-nequi" class="btn btn--outline" onclick="seleccionarPago('nequi')">📱 Nequi</button>
        </div>

        <div id="info-pago" style="display:none;background:#fff3f7;border-radius:12px;padding:1.5rem;text-align:center;margin-bottom:1.5rem">
          <p style="font-weight:600;margin-bottom:1rem">Escanea el QR para pagar por Nequi:</p>
          <img src="/static/qr-nequi.jpg" alt="QR Nequi" style="width:220px;border-radius:12px;margin-bottom:1rem">
          <p>📞 Número: <strong>3247020486</strong></p>
          <p style="font-size:.85rem;color:#888">Luego de pagar, sube el comprobante por WhatsApp</p>
        </div>

        <div class="cart-summary__total" style="margin-bottom:1.5rem">
          <span>Total a pagar</span>
          <span>${cop(cartTotal())}</span>
        </div>

        <button class="btn btn--primary btn--lg btn--full" onclick="enviarPedido()">✅ Confirmar pedido</button>
        <button class="btn btn--ghost btn--full" style="margin-top:.5rem" onclick="navigate('carrito')">← Volver al carrito</button>
      </div>
    </section>`;
  seleccionarPago("contra_entrega");
}

function seleccionarPago(tipo) {
  State.formaPago = tipo;
  document.getElementById("btn-contra").className = tipo === "contra_entrega" ? "btn btn--primary" : "btn btn--outline";
  document.getElementById("btn-nequi").className  = tipo === "nequi"           ? "btn btn--primary" : "btn btn--outline";
  document.getElementById("info-pago").style.display = tipo === "nequi" ? "block" : "none";
}

async function enviarPedido() {
  const nombre    = document.getElementById("co-nombre").value.trim();
  const telefono  = document.getElementById("co-telefono").value.trim();
  const direccion = document.getElementById("co-direccion").value.trim();
  const barrio    = document.getElementById("co-barrio").value.trim();
  const ciudad    = document.getElementById("co-ciudad").value.trim();
  const forma_pago = State.formaPago || "contra_entrega";

  if (!nombre || !telefono || !direccion) {
    showToast("Por favor completa nombre, teléfono y dirección", "error"); return;
  }
  try {
    const items = State.cart.map(i => ({ producto_id: i.id, cantidad: i.cantidad }));
    const data = await api("/pedidos", {
      method: "POST",
      body: JSON.stringify({ items, nombre_cliente: nombre, telefono, direccion, barrio, ciudad, forma_pago })
    });
    State.cart = []; saveCart(); renderCartBadge();
    showToast(`🎉 Pedido #${data.pedido_id} confirmado!`);
    navigate("pedidos");
  } catch(e) { showToast(e.message, "error"); }
}

function renderLogin(main) {
  main.innerHTML = `
    <section class="auth-section">
      <div class="auth-card">
        <div class="auth-card__logo">💄</div>
        <h2>Iniciar Sesión</h2>
        <div id="auth-error" class="auth-error" style="display:none"></div>
        <div class="form-group"><label>Email</label><input type="email" id="login-email" class="input" placeholder="correo@ejemplo.com"></div>
        <div class="form-group"><label>Contraseña</label><input type="password" id="login-pass" class="input" placeholder="••••••••"></div>
        <button class="btn btn--primary btn--lg btn--full" onclick="doLogin()">Entrar</button>
        <p class="auth-switch">¿No tienes cuenta? <a onclick="navigate('register')">Regístrate gratis</a></p>
      </div>
    </section>`;
}

async function doLogin() {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-pass").value;
  const errDiv = document.getElementById("auth-error");
  try {
    const data = await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    saveSession(data);
    showToast(`👋 Bienvenida, ${data.nombre}!`);
    navigate("home");
  } catch(e) { errDiv.style.display = "block"; errDiv.textContent = e.message; }
}

function renderRegister(main) {
  main.innerHTML = `
    <section class="auth-section">
      <div class="auth-card">
        <div class="auth-card__logo">✨</div>
        <h2>Crear Cuenta</h2>
        <div id="auth-error" class="auth-error" style="display:none"></div>
        <div class="form-group"><label>Nombre completo</label><input type="text" id="reg-name" class="input" placeholder="Tu nombre"></div>
        <div class="form-group"><label>Email</label><input type="email" id="reg-email" class="input" placeholder="correo@ejemplo.com"></div>
        <div class="form-group"><label>Contraseña</label><input type="password" id="reg-pass" class="input" placeholder="Mínimo 6 caracteres"></div>
        <button class="btn btn--primary btn--lg btn--full" onclick="doRegister()">Crear cuenta</button>
        <p class="auth-switch">¿Ya tienes cuenta? <a onclick="navigate('login')">Inicia sesión</a></p>
      </div>
    </section>`;
}

async function doRegister() {
  const nombre   = document.getElementById("reg-name").value;
  const email    = document.getElementById("reg-email").value;
  const password = document.getElementById("reg-pass").value;
  const errDiv   = document.getElementById("auth-error");
  try {
    const data = await api("/auth/register", { method: "POST", body: JSON.stringify({ nombre, email, password }) });
    saveSession(data);
    showToast("🎉 Cuenta creada exitosamente!");
    navigate("home");
  } catch(e) { errDiv.style.display = "block"; errDiv.textContent = e.message; }
}

async function renderPedidos(main) {
  if (!State.user) { navigate("login"); return; }
  main.innerHTML = `<div class="container section"><h1 class="page-title">Mis Pedidos</h1><div id="pedidos-list"><div class="skeleton-row"></div></div></div>`;
  try {
    const pedidos = await api("/pedidos");
    const list = document.getElementById("pedidos-list");
    if (!pedidos.length) {
      list.innerHTML = `<div class="empty"><p>Aún no tienes pedidos</p><button class="btn btn--primary" onclick="navigate('catalogo')">Ir al catálogo</button></div>`;
      return;
    }
    list.innerHTML = pedidos.map(p => `
      <div class="order-card">
        <div class="order-card__header">
          <span class="order-card__id">Pedido #${p.id}</span>
          <span class="status status--${p.estado}">${p.estado}</span>
        </div>
        <div class="order-card__body">
          <p>${p.num_productos} producto(s)</p>
          <p><strong>${cop(p.total)}</strong></p>
          <p>${new Date(p.creado_en).toLocaleDateString("es-CO")}</p>
        </div>
      </div>`).join("");
  } catch(e) { showToast(e.message, "error"); }
}

async function renderAdmin(main) {
  if (!State.user || State.user.rol !== "admin") { navigate("home"); return; }
  main.innerHTML = `
    <div class="container section">
      <h1 class="page-title">Panel de Administración 🛠️</h1>
      <div class="admin-tabs">
        <button class="tab tab--active" onclick="adminTab('productos')">Productos</button>
        <button class="tab" onclick="adminTab('pedidos')">Pedidos</button>
      </div>
      <div id="admin-content"></div>
    </div>`;
  adminTab("productos");
}

async function adminTab(tab) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("tab--active", t.textContent.toLowerCase().includes(tab)));
  const content = document.getElementById("admin-content");

  if (tab === "productos") {
    const [prods, cats] = await Promise.all([api("/productos"), api("/categorias")]);
    content.innerHTML = `
      <div style="margin-bottom:2rem;background:#fff3f7;border-radius:12px;padding:1.5rem">
        <h3 style="margin-bottom:1rem">➕ Agregar nuevo producto</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
          <div class="form-group"><label>Nombre</label><input type="text" id="np-nombre" class="input" placeholder="Nombre del producto"></div>
          <div class="form-group"><label>Precio</label><input type="number" id="np-precio" class="input" placeholder="25000"></div>
          <div class="form-group"><label>Stock</label><input type="number" id="np-stock" class="input" placeholder="10"></div>
          <div class="form-group"><label>Categoría</label>
            <select id="np-categoria" class="input">
              ${cats.map(c => `<option value="${c.id}">${c.nombre}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="form-group"><label>Descripción</label><input type="text" id="np-desc" class="input" placeholder="Descripción del producto"></div>
        <div class="form-group"><label>URL de imagen</label><input type="text" id="np-imagen" class="input" placeholder="https://..."></div>
        <div class="form-group" style="display:flex;align-items:center;gap:.5rem">
          <input type="checkbox" id="np-destacado"> <label>Producto destacado</label>
        </div>
        <button class="btn btn--primary" onclick="adminCrearProducto()">✅ Agregar producto</button>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>ID</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Imagen</th><th>Acciones</th></tr></thead>
          <tbody>${prods.map(p => `
            <tr>
              <td>${p.id}</td>
              <td>${p.nombre}</td>
              <td>${p.categoria_nombre}</td>
              <td><input type="number" id="precio-${p.id}" value="${p.precio}" style="width:90px;padding:4px;border-radius:6px;border:1px solid #ddd"></td>
              <td><input type="number" id="stock-${p.id}" value="${p.stock}" style="width:70px;padding:4px;border-radius:6px;border:1px solid #ddd"></td>
              <td><input type="text" id="img-${p.id}" value="${p.imagen_url}" style="width:150px;padding:4px;border-radius:6px;border:1px solid #ddd"></td>
              <td><button class="btn btn--primary btn--sm" onclick="adminActualizarProducto(${p.id})">💾 Guardar</button></td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;

  } else {
    const pedidos = await api("/admin/pedidos");
    content.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>ID</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th><th>Acción</th></tr></thead>
          <tbody>${pedidos.map(p => `
            <tr>
              <td>#${p.id}</td><td>${p.cliente}</td><td>${cop(p.total)}</td>
              <td>
                <select onchange="cambiarEstadoPedido(${p.id}, this.value)" style="padding:4px;border-radius:6px;border:1px solid #ddd">
                  ${["pendiente","confirmado","enviado","entregado","cancelado"].map(e =>
                    `<option value="${e}" ${p.estado===e?"selected":""}>${e}</option>`
                  ).join("")}
                </select>
              </td>
              <td>${new Date(p.creado_en).toLocaleDateString("es-CO")}</td>
              <td>${p.forma_pago==="nequi" ? `<button class="btn btn--sm btn--primary" onclick="verificarNequi(${p.id})">✅ Verificar Nequi</button>` : "Contra entrega"}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }
}

async function adminCrearProducto() {
  const nombre     = document.getElementById("np-nombre").value.trim();
  const precio     = document.getElementById("np-precio").value;
  const stock      = document.getElementById("np-stock").value;
  const categoria_id = document.getElementById("np-categoria").value;
  const descripcion = document.getElementById("np-desc").value.trim();
  const imagen_url  = document.getElementById("np-imagen").value.trim();
  const destacado   = document.getElementById("np-destacado").checked ? 1 : 0;
  if (!nombre || !precio || !categoria_id) { showToast("Completa nombre, precio y categoría", "error"); return; }
  try {
    await api("/admin/productos", { method: "POST", body: JSON.stringify({ nombre, precio, stock, categoria_id, descripcion, imagen_url, destacado }) });
    showToast("✅ Producto agregado!");
    adminTab("productos");
  } catch(e) { showToast(e.message, "error"); }
}

async function adminActualizarProducto(pid) {
  const precio     = document.getElementById(`precio-${pid}`).value;
  const stock      = document.getElementById(`stock-${pid}`).value;
  const imagen_url = document.getElementById(`img-${pid}`).value.trim();
  try {
    await api(`/admin/productos/${pid}`, { method: "PATCH", body: JSON.stringify({ precio, stock, imagen_url }) });
    showToast("✅ Producto actualizado!");
  } catch(e) { showToast(e.message, "error"); }
}

async function cambiarEstadoPedido(oid, estado) {
  try {
    await api(`/admin/pedidos/${oid}/estado`, { method: "PATCH", body: JSON.stringify({ estado }) });
    showToast("✅ Estado actualizado!");
  } catch(e) { showToast(e.message, "error"); }
}

async function verificarNequi(oid) {
  try {
    await api(`/pedidos/${oid}/verificar-nequi`, { method: "PATCH" });
    showToast("✅ Pago Nequi verificado!");
    adminTab("pedidos");
  } catch(e) { showToast(e.message, "error"); }
    } else {
    const pedidos = await api("/admin/pedidos");
    content.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>ID</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th></tr></thead>
          <tbody>${pedidos.map(p => `
            <tr>
              <td>#${p.id}</td><td>${p.cliente}</td><td>${cop(p.total)}</td>
              <td><span class="status status--${p.estado}">${p.estado}</span></td>
              <td>${new Date(p.creado_en).toLocaleDateString("es-CO")}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderUserNav();
  renderCartBadge();
  const hash = location.hash.replace("#", "") || "home";
  renderPage(hash);
});
