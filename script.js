const products = [
    {
        id: 1,
        name: "Classic T-Shirt",
        price: 499,
        category: "Fashion",
        image: "images/tshirt-real.jpg"
    },
    {
        id: 2,
        name: "Stylish Shoes",
        price: 1299,
        category: "Shoes",
        image: "images/stylish-shoes.jpg"
    },
    {
        id: 3,
        name: "Smart Watch",
        price: 1999,
        category: "Electronics",
        image: "images/watch-real.jpg"
    },
    {
        id: 4,
        name: "Travel Backpack",
        price: 899,
        category: "Bags",
        image: "images/backpack-real.jpg"
    },
    {
        id: 5,
        name: "Wireless Headphones",
        price: 2499,
        category: "Electronics",
        image: "images/headphones.jpg"
    },
    {
        id: 6,
        name: "Classic Sunglasses",
        price: 799,
        category: "Fashion",
        image: "images/sunglasses.jpg"
    },
    {
        id: 7,
        name: "Everyday Handbag",
        price: 1599,
        category: "Bags",
        image: "images/handbag.jpg"
    },
    {
        id: 8,
        name: "Digital Camera",
        price: 28999,
        category: "Electronics",
        image: "images/camera.jpg"
    },
    {
        id: 9,
        name: "Red Occasion Dress",
        price: 2499,
        category: "Fashion",
        image: "images/dress.jpg"
    },
    {
        id: 10,
        name: "Red Running Shoes",
        price: 3499,
        category: "Shoes",
        image: "images/running-shoes.jpg"
    },
    {
        id: 11,
        name: "Portable Speaker",
        price: 2999,
        category: "Electronics",
        image: "images/speaker.jpg"
    },
    {
        id: 12,
        name: "Leather Wallet",
        price: 999,
        category: "Accessories",
        image: "images/wallet.jpg"
    }
];

const PRODUCT_STORAGE_KEY = "shopease-products-v1";
products.forEach(product => { product.stock = 20; });

function escapeProductHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function isSafeProductImage(image) {
    if (typeof image !== "string" || image.length > 3000000 || /[\u0000-\u001f]/.test(image)) return false;
    if (!image) return true;
    if (/^data:image\/(jpeg|png|gif|webp);base64,[A-Za-z0-9+/]+=*$/.test(image)) return true;
    if (image.length > 500) return false;
    if (image.startsWith("//")) return false;

    const scheme = image.match(/^([a-z][a-z\d+.-]*):/i);
    return !scheme || ["http", "https"].includes(scheme[1].toLowerCase());
}

function isValidSavedProductList(savedProducts) {
    if (!Array.isArray(savedProducts)) return false;

    const ids = new Set();
    return savedProducts.every(product => {
        if (!product || typeof product !== "object") return false;
        const valid = Number.isSafeInteger(product.id)
            && product.id > 0
            && typeof product.name === "string"
            && product.name.trim().length > 0
            && product.name.length <= 80
            && Number.isFinite(product.price)
            && product.price > 0
            && typeof product.category === "string"
            && product.category.trim().length > 0
            && product.category.length <= 40
            && typeof product.image === "string"
            && isSafeProductImage(product.image)
            && !ids.has(product.id);

        if (valid) ids.add(product.id);
        return valid;
    });
}

function loadSavedProducts() {
    try {
        const savedCatalog = localStorage.getItem(PRODUCT_STORAGE_KEY);
        if (savedCatalog === null) return;

        const savedProducts = JSON.parse(savedCatalog);
        if (!isValidSavedProductList(savedProducts)) {
            console.error("Saved product catalog is invalid. The built-in catalog will be used.");
            return;
        }

        products.splice(0, products.length, ...savedProducts);
        let migratedStock = false;
        products.forEach(product => {
            if (!Number.isSafeInteger(product.stock) || product.stock < 0) { product.stock = 20; migratedStock = true; }
        });
        if (migratedStock) saveProducts();
    } catch (error) {
        console.error("Could not load the saved product catalog. The built-in catalog will be used.", error);
    }
}

function saveProducts() {
    try {
        localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(products));
        if (window.location.protocol !== "file:" && /\/admin(?:\/|$)|admin-panel/.test(window.location.pathname)) {
            const key = requestAdminApiKey();
            if (key) fetch("/api/products", {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
                body: JSON.stringify(products)
            }).then(response => {
                if (!response.ok) throw new Error("MongoDB did not save the product catalog.");
            }).catch(error => console.error(error));
        }
        return true;
    } catch (error) {
        console.error("Could not save the product catalog to browser storage.", error);
        return false;
    }
}

function requestAdminApiKey() {
    try {
        let key = sessionStorage.getItem("shopease-admin-api-key");
        if (!key) {
            key = window.prompt("Enter the ADMIN_API_KEY configured on the server:");
            if (key) sessionStorage.setItem("shopease-admin-api-key", key.trim());
        }
        return key ? key.trim() : "";
    } catch (error) { return ""; }
}

const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
    }).format(amount);

let cart = [];
let selectedCategory = "All";

function renderCategories() {
    const categories = ["All", ...new Set(products.map(product => product.category))];
    const categoryFilter = document.getElementById("category-filter");

    if (!categoryFilter) return;

    categoryFilter.innerHTML = categories
        .map(
            category => `
                <button
                    class="category-btn ${selectedCategory === category ? "active" : ""}"
                    data-category="${escapeProductHTML(category)}">
                    ${escapeProductHTML(category)}
                </button>
            `
        )
        .join("");

    categoryFilter.querySelectorAll(".category-btn").forEach(button => {
        button.addEventListener("click", () => selectCategory(button.dataset.category));
    });

    const shortcuts = document.getElementById("category-shortcuts-list");
    if (shortcuts) {
        const shortcutCategories = ["All", ...new Set(products.map(product => product.category))];
        shortcuts.innerHTML = shortcutCategories.map(category => {
            const product = products.find(item => item.category === category);
            const image = product ? product.image : "images/hero-shopping.jpg";
            const label = category === "All" ? "Everything" : category;
            return `<button class="category-shortcut ${selectedCategory === category ? "active" : ""}" type="button" data-shortcut-category="${escapeProductHTML(category)}"><span class="category-shortcut-image"><img src="${escapeProductHTML(image)}" alt="" loading="lazy"></span><span>${escapeProductHTML(label)}</span></button>`;
        }).join("");
        shortcuts.querySelectorAll("[data-shortcut-category]").forEach(button => button.addEventListener("click", () => selectCategory(button.dataset.shortcutCategory)));
    }
}

function displayProducts(list = products) {
    const productList = document.getElementById("product-list");

    if (!productList) {
        console.error("Product list element not found!");
        return;
    }

    productList.innerHTML = "";
    const count = document.getElementById("product-count");
    if (count) count.textContent = `${list.length} ${list.length === 1 ? "item" : "items"}`;

    if (!list.length) {
        productList.innerHTML = '<p class="no-products">No products found!</p>';
        return;
    }

    list.forEach(product => {
        productList.innerHTML += `
            <article class="product-card" data-category="${escapeProductHTML(product.category)}">
                <div class="product-media">
                    <span class="product-category">${escapeProductHTML(product.category)}</span>
                    <img src="${escapeProductHTML(product.image || "images/hero-shopping.jpg")}" alt="${escapeProductHTML(product.name)}" loading="lazy" onerror="this.hidden=true;">
                    ${product.stock <= 0 ? '<span class="product-stock-badge">Sold out</span>' : ""}
                </div>
                <div class="product-info">
                    <div class="product-copy">
                        <h3>${escapeProductHTML(product.name)}</h3>
                        <p class="stock-availability">${product.stock > 0 ? `${product.stock} available` : "Out of stock"}</p>
                    </div>
                    <p class="price">${formatCurrency(product.price)}</p>
                    <div class="product-actions">
                        <button class="add-btn product-details-btn" type="button" onclick="showProductDetails(${product.id})">View details</button>
                        <button class="add-btn secondary" type="button" onclick="addToCart(${product.id})" ${product.stock <= 0 ? "disabled" : ""}>Add to cart</button>
                    </div>
                </div>
            </article>
        `;
    });
}

function filterProducts() {
    const searchInput = document.getElementById("product-search");
    const searchValue = searchInput ? searchInput.value.toLowerCase() : "";

    const filtered = products.filter(product => {
        const matchesSearch = `${product.name} ${product.category}`.toLowerCase().includes(searchValue);
        const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const sort = document.getElementById("product-sort")?.value || "featured";
    if (sort === "price-low") filtered.sort((a, b) => a.price - b.price);
    else if (sort === "price-high") filtered.sort((a, b) => b.price - a.price);
    else if (sort === "name") filtered.sort((a, b) => a.name.localeCompare(b.name));
    displayProducts(filtered);
}

function selectCategory(category) {
    selectedCategory = category;
    renderCategories();
    filterProducts();
}

function refreshStorefrontProducts() {
    cart = cart.flatMap(item => {
        const currentProduct = products.find(product => product.id === item.id);
        return currentProduct ? [{ ...currentProduct, quantity: item.quantity }] : [];
    });

    if (selectedCategory !== "All" && !products.some(product => product.category === selectedCategory)) {
        selectedCategory = "All";
    }

    renderCategories();
    filterProducts();
    updateCart();
}

function addToCart(id) {
    const product = products.find(item => item.id === id);

    if (!product) return;

    const existingItem = cart.find(item => item.id === id);
    if ((existingItem ? existingItem.quantity : 0) >= product.stock) {
        alert(product.stock > 0 ? `Only ${product.stock} unit${product.stock === 1 ? "" : "s"} available.` : "This product is out of stock.");
        return;
    }

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    updateCart();
}

function updateCart() {
    const cartItems = document.getElementById("cart-items");
    const cartCount = document.getElementById("cart-count");
    const cartTotal = document.getElementById("cart-total");

    if (!cartItems || !cartCount || !cartTotal) return;

    let total = 0;
    let count = 0;

    cartItems.innerHTML = cart.length ? "" : '<p class="cart-empty">Your cart is empty. Add something you love to get started.</p>';

    cart.forEach(item => {
        total += item.price * item.quantity;
        count += item.quantity;

        cartItems.innerHTML += `
            <div class="cart-item">
                <div>
                    <strong>${item.name}</strong>
                    <p>${formatCurrency(item.price)} × ${item.quantity}</p>
                </div>
                <button class="remove-btn" onclick="removeFromCart(${item.id})">Remove</button>
            </div>
        `;
    });

    cartCount.textContent = count;
    cartTotal.textContent = formatCurrency(total);
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    updateCart();
}

function toggleCart() {
    const panel = document.getElementById("cart-panel");

    if (!panel) return;

    panel.style.display = panel.style.display === "block" ? "none" : "block";
}

function checkout() {
    if (!cart.length) {
        alert("Your cart is empty!");
        return;
    }

    const checkoutItems = document.getElementById("checkout-items");
    const checkoutTotal = document.getElementById("checkout-total");
    const checkoutModal = document.getElementById("checkout-modal");
    const cartPanel = document.getElementById("cart-panel");
    const confirmation = document.getElementById("order-confirmation");
    const formView = document.getElementById("checkout-form-view");

    if (!checkoutItems || !checkoutTotal || !checkoutModal) return;

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    checkoutItems.innerHTML = cart.map(item => `
        <p>${item.name} × ${item.quantity}<strong>${formatCurrency(item.price * item.quantity)}</strong></p>
    `).join("");
    checkoutTotal.textContent = formatCurrency(total);

    if (confirmation) confirmation.hidden = true;
    if (formView) formView.hidden = false;
    if (cartPanel) cartPanel.style.display = "none";
    checkoutModal.style.display = "flex";
    checkoutModal.setAttribute("aria-hidden", "false");
}

function closeCheckout() {
    const checkoutModal = document.getElementById("checkout-modal");
    const checkoutForm = document.getElementById("checkout-form");

    if (!checkoutModal) return;

    checkoutModal.style.display = "none";
    checkoutModal.setAttribute("aria-hidden", "true");
    if (checkoutForm) checkoutForm.reset();
}

function backToCart() {
    const checkoutModal = document.getElementById("checkout-modal");
    const cartPanel = document.getElementById("cart-panel");

    if (!checkoutModal || !cartPanel) return;

    checkoutModal.style.display = "none";
    checkoutModal.setAttribute("aria-hidden", "true");
    cartPanel.style.display = "block";
}

const ORDER_STORAGE_KEY = "shopease-orders-v1";
function loadOrders() {
    try {
        const saved = JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY) || "[]");
        return Array.isArray(saved) ? saved.filter(order => order && typeof order.id === "string" && typeof order.customer === "string" && Array.isArray(order.items)) : [];
    } catch (error) { return []; }
}
let orders = loadOrders();
function saveOrders() {
    try {
        localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orders));
        if (window.location.protocol !== "file:" && /\/admin(?:\/|$)|admin-panel/.test(window.location.pathname)) {
            const key = requestAdminApiKey();
            if (key) fetch("/api/orders", {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
                body: JSON.stringify(orders)
            }).then(response => {
                if (!response.ok) throw new Error("MongoDB did not save the order changes.");
            }).catch(error => console.error(error));
        }
        return true;
    }
    catch (error) { return false; }
}

async function placeOrder(event) {
    event.preventDefault();

    if (!cart.length) return;

    const unavailable = cart.find(item => {
        const product = products.find(product => product.id === item.id);
        return !product || item.quantity > product.stock;
    });
    if (unavailable) {
        alert(`${unavailable.name} no longer has enough stock. Please update your cart.`);
        return;
    }

    const form = document.getElementById("checkout-form");
    const checkoutModal = document.getElementById("checkout-modal");
    const orderScreen = document.getElementById("order-screen");
    const confirmationMessage = document.getElementById("confirmation-message");
    const orderItems = document.getElementById("order-items");
    const orderCustomerName = document.getElementById("order-customer-name");
    const orderEmail = document.getElementById("order-email");
    const orderAddress = document.getElementById("order-address");
    const orderPhone = document.getElementById("order-phone");
    const orderPayment = document.getElementById("order-payment");
    const orderTotal = document.getElementById("order-total");

    if (!form || !form.reportValidity() || !checkoutModal || !orderScreen || !confirmationMessage || !orderItems || !orderCustomerName || !orderEmail || !orderAddress || !orderPhone || !orderPayment || !orderTotal) return;

    const orderNumber = `SE-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const formData = new FormData(form);

    const newOrder = {
        id: orderNumber,
        createdAt: new Date().toISOString(),
        customer: String(formData.get("name") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        address: `${formData.get("address")}, ${formData.get("city")}, ${formData.get("pincode")}`,
        payment: String(formData.get("payment") || ""),
        items: cart.map(item => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity })),
        total,
        status: "New",
        tracking: ""
    };
    if (window.location.protocol !== "file:") {
        try {
            const response = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newOrder)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "The order could not be saved.");
            newOrder.total = result.total;
        } catch (error) {
            alert(`${error.message} Please try again after checking the server connection.`);
            return;
        }
    }
    orders.unshift(newOrder);
    const orderSaved = saveOrders();
    cart.forEach(item => {
        const product = products.find(product => product.id === item.id);
        if (product) product.stock -= item.quantity;
    });
    const inventorySaved = saveProducts();

    confirmationMessage.textContent = `Order ${orderNumber} · No payment was collected${orderSaved && inventorySaved ? "" : " · Could not save all order or inventory changes to browser storage"}`;
    orderItems.innerHTML = cart.map(item => `
        <p class="order-item"><span>${item.name} × ${item.quantity}</span><strong>${formatCurrency(item.price * item.quantity)}</strong></p>
    `).join("");
    orderCustomerName.textContent = formData.get("name");
    orderEmail.textContent = formData.get("email");
    orderAddress.textContent = `${formData.get("address")}, ${formData.get("city")}, ${formData.get("pincode")}`;
    orderPhone.textContent = formData.get("phone");
    orderPayment.textContent = formData.get("payment");
    orderTotal.textContent = formatCurrency(total);

    cart = [];
    updateCart();
    checkoutModal.style.display = "none";
    checkoutModal.setAttribute("aria-hidden", "true");
    orderScreen.style.display = "flex";
    orderScreen.setAttribute("aria-hidden", "false");
}

function closeOrderScreen() {
    const orderScreen = document.getElementById("order-screen");
    const checkoutForm = document.getElementById("checkout-form");

    if (!orderScreen) return;

    orderScreen.style.display = "none";
    orderScreen.setAttribute("aria-hidden", "true");
    if (checkoutForm) checkoutForm.reset();
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
}

function showProductDetails(id) {
    const product = products.find(item => item.id === id);

    if (!product) return;

    const detailImage = document.getElementById("detail-image");
    const detailName = document.getElementById("detail-name");
    const detailPrice = document.getElementById("detail-price");
    const detailDescription = document.getElementById("detail-description");
    const detailQuantity = document.getElementById("detail-quantity");
    const productModal = document.getElementById("product-modal");

    if (!detailImage || !detailName || !detailPrice || !detailDescription || !detailQuantity || !productModal) return;

    detailImage.src = product.image || "images/hero-shopping.jpg";
    detailImage.alt = product.name;
    detailName.textContent = product.name;
    detailPrice.textContent = formatCurrency(product.price);
    detailDescription.textContent = `Discover our ${product.name}. A perfect choice for your daily lifestyle and comfort.`;
    detailQuantity.value = 1;
    detailQuantity.max = String(product.stock);
    detailQuantity.disabled = product.stock <= 0;
    const addButton = productModal.querySelector(".detail-info .add-btn");
    if (addButton) addButton.disabled = product.stock <= 0;

    productModal.style.display = "flex";
}

function closeProductDetails() {
    const productModal = document.getElementById("product-modal");
    if (productModal) {
        productModal.style.display = "none";
    }
}

function addDetailProductToCart() {
    const detailQuantity = document.getElementById("detail-quantity");
    const detailName = document.getElementById("detail-name");

    if (!detailQuantity || !detailName) return;

    const product = products.find(item => item.name === detailName.textContent.trim());
    const quantity = Number(detailQuantity.value);

    if (!product || !Number.isSafeInteger(quantity) || quantity < 1) return;

    const existingItem = cart.find(item => item.id === product.id);
    const alreadyInCart = existingItem ? existingItem.quantity : 0;
    if (alreadyInCart + quantity > product.stock) {
        alert(product.stock > alreadyInCart ? `Only ${product.stock - alreadyInCart} more unit${product.stock - alreadyInCart === 1 ? "" : "s"} available.` : "This product is out of stock.");
        return;
    }

    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({ ...product, quantity });
    }

    updateCart();
    closeProductDetails();
}

const searchInput = document.getElementById("product-search");
if (searchInput) {
    searchInput.addEventListener("input", filterProducts);
}
document.getElementById("product-sort")?.addEventListener("change", filterProducts);

loadSavedProducts();
if (window.location.protocol !== "file:") {
    fetch("/api/products").then(response => response.ok ? response.json() : null).then(remoteProducts => {
        if (!Array.isArray(remoteProducts) || !remoteProducts.length || !isValidSavedProductList(remoteProducts)) return;
        products.splice(0, products.length, ...remoteProducts);
        try { localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(products)); }
        catch (error) { console.warn("Could not cache the MongoDB catalog in browser storage.", error); }
        refreshStorefrontProducts();
    }).catch(error => console.warn("MongoDB catalog is unavailable; using the local catalog.", error));
}
renderCategories();
displayProducts();
updateCart();

try {
    const websiteSettings = JSON.parse(localStorage.getItem("shopease-admin-settings-v1") || "{}");
    const siteName = typeof websiteSettings.siteName === "string" && websiteSettings.siteName.trim() ? websiteSettings.siteName.trim() : "ShopEase";
    const brand = document.querySelector(".logo-word");
    if (brand && brand.firstChild) brand.firstChild.nodeValue = siteName;
    const aboutTitle = document.querySelector(".about h2");
    if (aboutTitle) aboutTitle.textContent = `About ${siteName}`;
    document.title = `${siteName} - Online Shopping`;
    const announcement = document.getElementById("store-announcement");
    if (announcement) {
        announcement.textContent = typeof websiteSettings.announcement === "string" && websiteSettings.announcement.trim() ? websiteSettings.announcement.trim() : "Free shipping on orders over ₹1,999 · Discover the latest edit";
        announcement.hidden = false;
    }
    const support = document.getElementById("store-support-email");
    if (support) support.textContent = websiteSettings.supportEmail ? `Support: ${websiteSettings.supportEmail}` : "";
} catch (error) { /* Keep the default storefront identity when browser settings are unavailable. */ }
