const paths = {
  site: "data/site.json",
  content: "data/content.json",
  products: "data/products.json",
  themes: "themes/themes.json",
  seo: "config/seo.json",
  ar: "translations/ar.json",
  en: "translations/en.json",
  motion: "animations/motion.json"
};

const state = {
  lang: localStorage.getItem("titan.lang") || "ar",
  theme: localStorage.getItem("titan.theme") || "",
  page: "home",
  params: {},
  cart: readStore("titan.cart", []),
  wishlist: readStore("titan.wishlist", []),
  compare: readStore("titan.compare", []),
  selectedCategory: "all",
  search: "",
  activeProductOptions: {}
};

let data = {};

init();

async function init() {
  wireCursor();
  window.addEventListener("hashchange", route);
  try {
    data = await loadData();
    state.lang = localStorage.getItem("titan.lang") || data.site.settings.defaultLanguage || "ar";
    state.theme = localStorage.getItem("titan.theme") || data.themes.active || data.site.settings.defaultTheme;
    applyLanguage();
    applyTheme();
    applyMotion();
    applySeo();
    setupAmbient();
    route();
  } catch (error) {
    document.getElementById("app").innerHTML = `
      <section class="glass" style="padding:24px;border-radius:8px;margin-top:40px">
        <h1>Local data could not load</h1>
        <p class="lead">Run <strong>npm start</strong> in the project folder, then open <strong>http://localhost:4173</strong>. Static hosting will load the JSON files normally.</p>
      </section>`;
  } finally {
    setTimeout(() => document.getElementById("loader")?.classList.add("hidden"), 450);
  }
}

async function loadData() {
  try {
    const [site, content, products, themes, seo, ar, en, motion] = await Promise.all(Object.values(paths).map((path) => fetch(path).then((res) => {
      if (!res.ok) throw new Error(path);
      return res.json();
    })));
    return { site, content, products, themes, seo, motion, translations: { ar, en } };
  } catch (error) {
    if (window.TITAN_EMBEDDED_DATA) return structuredClone(window.TITAN_EMBEDDED_DATA);
    throw error;
  }
}

function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [pagePart = "home", query = ""] = hash.split("?");
  state.page = pagePart || "home";
  state.params = Object.fromEntries(new URLSearchParams(query));
  render();
}

function render() {
  applyLanguage();
  applyTheme();
  applyMotion();
  renderHeader();
  const app = document.getElementById("app");
  app.className = "page-shell page-transition";
  const routes = {
    home: renderHome,
    shop: renderShop,
    categories: renderCategoriesPage,
    product: renderProduct,
    wishlist: renderWishlist,
    cart: renderCartPage,
    offers: renderOffers,
    faq: renderFaq,
    about: () => renderTextPage("about"),
    privacy: () => renderTextPage("privacy"),
    terms: () => renderTextPage("terms"),
    contact: renderContact
  };
  app.innerHTML = `${(routes[state.page] || render404)()}${renderEliteDock()}${renderCompareDock()}${renderSizeGuide()}`;
  renderCartDrawer();
  bindPageEvents();
  reveal();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderHeader() {
  const t = translate;
  const nav = data.site.navigation.map((item) => `
    <button class="${state.page === item.page ? "active" : ""}" data-route="${item.page}">${t(item.labelKey)}</button>
  `).join("");
  document.getElementById("siteHeader").innerHTML = `
    <div class="nav-bar">
      <button class="brand" data-route="home" aria-label="${data.site.brand.name}">
        <span>${escapeHtml(data.site.brand.name)}</span>
      </button>
      <nav class="nav-links" aria-label="Primary">${nav}</nav>
      <div class="nav-actions">
        <button class="icon-btn" id="langBtn" title="${t("language")}">${state.lang.toUpperCase()}</button>
        <button class="icon-btn" id="commandBtn" title="Command">⌘</button>
        <button class="icon-btn" id="themeBtn" title="${t("theme")}">◐</button>
        <button class="icon-btn" data-route="wishlist" title="${t("wishlist")}">♡</button>
        <button class="icon-btn" id="openCart" title="${t("cart")}">Cart</button>
        <span class="badge">${cartCount()}</span>
        <button class="pill-btn" data-route="shop">${t("shop")}</button>
      </div>
    </div>`;
}

function renderHome() {
  const sectionMap = {
    hero: renderHeroSection,
    categories: sectionCategories,
    showcase: sectionShowcase,
    bestsellers: () => sectionProducts(data.products.slice(0, 3), translate("bestsellers")),
    offers: sectionOffers,
    faq: sectionFaq
  };
  const ordered = (data.site.sections || ["hero", "categories", "showcase", "bestsellers", "offers", "faq"])
    .map((key) => sectionMap[key]?.())
    .filter(Boolean)
    .join("");
  return `${ordered}${footer()}`;
}

function renderHeroSection() {
  const hero = data.site.hero;
  const bgUrl = data.site.settings.backgroundUrl || hero.image;
  const isVideoBg = data.site.settings.backgroundType === "video" && bgUrl;
  const stats = hero.stats.map((stat) => `<div class="stat"><strong>${escapeHtml(stat.value)}</strong><span>${escapeHtml(stat.label)}</span></div>`).join("");
  return `
    <section class="intro-hero reveal ${isVideoBg ? "has-video-bg" : ""}" style="${isVideoBg ? "" : `--intro-image:url('${safeUrl(absoluteUrl(bgUrl || hero.image))}')`}">
      ${isVideoBg ? `<video class="intro-video" autoplay muted loop playsinline src="${safeUrl(bgUrl)}"></video>` : ""}
      <div class="intro-scanline"></div>
      <div class="hero-copy intro-copy">
        <span class="eyebrow">${escapeHtml(hero.eyebrow)}</span>
        <h1>${escapeHtml(hero.title)}</h1>
        <p class="lead">${escapeHtml(hero.subtitle)}</p>
        <div class="hero-actions">
          <button class="pill-btn" data-route="shop">${escapeHtml(hero.primaryCta)}</button>
          <button class="ghost-btn" data-command>${escapeHtml(hero.secondaryCta)}</button>
        </div>

      </div>
      <div class="hero-stats intro-stats">${stats}</div>
    </section>`;
}

function sectionCategories() {
  return `
    <section class="section reveal">
      <div class="section-head">
        <h2>${translate("featuredCategories")}</h2>
      </div>
      <div class="grid category-grid">
        ${data.content.categories.map((cat) => `
          <button class="category-card" data-category-route="${cat.id}">
            <img src="${safeUrl(cat.image)}" alt="${escapeHtml(localized(cat.name))}" onerror="this.src='assets/products/category-equipment.jpg'">
            <div><h3>${escapeHtml(localized(cat.name))}</h3><p>${escapeHtml(localized(cat.description))}</p></div>
          </button>
        `).join("")}
      </div>
    </section>`;
}

function sectionShowcase() {
  return ``;
}

function sectionProducts(products, title = translate("shop")) {
  return `
    <section class="section reveal">
      <div class="section-head"><h2>${escapeHtml(title)}</h2><button class="ghost-btn" data-route="shop">${translate("shop")}</button></div>
      <div class="grid product-grid">${products.map(productCard).join("")}</div>
    </section>`;
}

function renderShop() {
  const filtered = filteredProducts();
  return `
    <section class="section reveal">
      <div class="section-head">
        <div><span class="eyebrow">${translate("shop")}</span><h2>${state.lang === "ar" ? "مجموعة الأداء الكاملة" : "Complete performance collection"}</h2></div>
        <p>${filtered.length} ${state.lang === "ar" ? "منتج" : "products"}</p>
      </div>
      <div class="filters glass">
        <input class="field" id="searchInput" value="${escapeAttr(state.search)}" placeholder="${translate("search")}">
        <select class="field" id="categoryFilter">
          <option value="all">${translate("all")}</option>
          ${data.content.categories.map((cat) => `<option value="${cat.id}" ${state.selectedCategory === cat.id ? "selected" : ""}>${escapeHtml(localized(cat.name))}</option>`).join("")}
        </select>
        <select class="field" id="sortFilter">
          <option value="featured">Featured</option>
          <option value="low">Price low</option>
          <option value="high">Price high</option>
        </select>
      </div>
      <div class="grid product-grid">${filtered.map(productCard).join("") || `<div class="glass" style="padding:18px;border-radius:8px">No products found.</div>`}</div>
    </section>
    ${footer()}`;
}

function renderCategoriesPage() {
  return `${sectionCategories()}${sectionProducts(filteredProducts(), translate("shop"))}${footer()}`;
}

function renderProduct() {
  const product = data.products.find((item) => item.id === state.params.id) || data.products[0];
  const options = state.activeProductOptions[product.id] || { size: product.variants?.sizes?.[0] || "", color: product.variants?.colors?.[0] || "" };
  const related = data.products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 3);
  return `
    <section class="detail reveal">
      <div>
        <div class="gallery-main"><img id="mainProductImage" src="${safeUrl(product.images[0])}" alt="${escapeHtml(localized(product.name))}" onerror="this.src='assets/products/dumbbell.jpg'"></div>
        <div class="thumbs">${product.images.map((img) => `<button data-img="${safeUrl(img)}"><img src="${safeUrl(img)}" alt="" onerror="this.src='assets/products/dumbbell.jpg'"></button>`).join("")}</div>
      </div>
      <div class="detail-copy glass">
        <span class="tag">${escapeHtml(product.badge)}</span>
        <h1 style="font-size:clamp(36px,5vw,62px)">${escapeHtml(localized(product.name))}</h1>
        <p class="lead">${escapeHtml(localized(product.description))}</p>
        <div class="price" style="font-size:28px">${money(product.price)} ${product.oldPrice ? `<del>${money(product.oldPrice)}</del>` : ""}</div>
        <h3>${translate("size")}</h3>
        <div class="option-grid">${(product.variants?.sizes || []).map((size) => `<button class="${options.size === size ? "active" : ""}" data-option="size" data-value="${escapeAttr(size)}">${escapeHtml(size)}</button>`).join("")}</div>
        <h3>Color / Flavor</h3>
        <div class="option-grid">${(product.variants?.colors || []).map((color) => `<button class="${options.color === color ? "active" : ""}" data-option="color" data-value="${escapeAttr(color)}">${escapeHtml(color)}</button>`).join("")}</div>
        <div class="row">
          <button class="pill-btn" data-add="${product.id}">${translate("addToCart")}</button>
          <button class="ghost-btn" data-wish="${product.id}">♡ ${translate("wishlist")}</button>
          <button class="ghost-btn" data-compare="${product.id}">Compare</button>
          <button class="ghost-btn" data-size-guide>Size Guide</button>
        </div>
        ${renderReviews(product)}
      </div>
    </section>
    ${related.length ? sectionProducts(related, translate("relatedProducts")) : ""}
    ${footer()}`;
}

function renderWishlist() {
  const products = data.products.filter((product) => state.wishlist.includes(product.id));
  return `<section class="section reveal"><div class="section-head"><h2>${translate("wishlist")}</h2></div><div class="grid product-grid">${products.map(productCard).join("") || emptyBlock(translate("wishlist"))}</div></section>${footer()}`;
}

function renderCartPage() {
  return `<section class="section reveal"><div class="section-head"><h2>${translate("cart")}</h2><button class="pill-btn" id="openCartPage">${translate("checkout")}</button></div><div class="glass" style="border-radius:8px;padding:18px">${cartItemsHtml()}${checkoutForm()}</div></section>${footer()}`;
}

function renderOffers() {
  return `${sectionOffers()}${sectionProducts(data.products.filter((p) => p.oldPrice), translate("offers"))}${footer()}`;
}

function renderFaq() {
  return `${sectionFaq(true)}${footer()}`;
}

function renderTextPage(key) {
  const page = data.content.pages[key];
  return `<section class="section reveal"><div class="glass" style="border-radius:8px;padding:24px"><span class="eyebrow">${translate(key)}</span><h1>${escapeHtml(localized(page.title))}</h1><p class="lead">${escapeHtml(localized(page.body))}</p></div></section>${footer()}`;
}

function renderContact() {
  return `
    <section class="section reveal">
      <div class="glass" style="border-radius:8px;padding:24px">
        <span class="eyebrow">${translate("contact")}</span>
        <h1>${translate("contact")}</h1>
        <p class="lead">${translate("contactIntro")}</p>
        <div class="grid" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-top:20px">
          <div class="mini-card">${data.site.brand.phone}</div>
          <div class="mini-card">${data.site.brand.email}</div>
          <div class="mini-card">${data.site.brand.address}</div>
        </div>
      </div>
    </section>${footer()}`;
}

function render404() {
  return `<section class="section reveal"><div class="glass" style="border-radius:8px;padding:28px;text-align:center"><span class="eyebrow">404</span><h1>${translate("notFound")}</h1><button class="pill-btn" data-route="home">${translate("backHome")}</button></div></section>`;
}

function sectionOffers() {
  return `
    <section class="section reveal">
      <div class="section-head"><h2>${translate("offers")}</h2></div>
      <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        ${data.content.offers.map((offer) => `<div class="mini-card"><span class="tag">${escapeHtml(offer.badge)}</span><h3>${escapeHtml(localized(offer.title))}</h3><p>${escapeHtml(localized(offer.description))}</p></div>`).join("")}
      </div>
    </section>`;
}

function sectionFaq(full = false) {
  const items = full ? data.content.faq : data.content.faq.slice(0, 3);
  return `
    <section class="section reveal">
      <div class="section-head"><h2>${translate("faq")}</h2></div>
      <div class="grid">
        ${items.map((item) => `<details class="mini-card"><summary><strong>${escapeHtml(localized(item.question))}</strong></summary><p>${escapeHtml(localized(item.answer))}</p></details>`).join("")}
      </div>
    </section>`;
}

function productCard(product) {
  return `
    <article class="product-card tilt">
      <button class="product-media" data-product="${product.id}"><img src="${safeUrl(product.images[0])}" alt="${escapeHtml(localized(product.name))}" onerror="this.src='assets/products/dumbbell.jpg'"></button>
      <div class="product-info">
        <span class="tag">${escapeHtml(product.badge)}</span>
        <h3>${escapeHtml(localized(product.name))}</h3>
        <div class="price">${money(product.price)} ${product.oldPrice ? `<del>${money(product.oldPrice)}</del>` : ""}</div>
        <div class="row" style="margin-top:14px">
          <button class="pill-btn" data-add="${product.id}">${translate("addToCart")}</button>
          <button class="icon-btn" data-wish="${product.id}">${state.wishlist.includes(product.id) ? "♥" : "♡"}</button>
          <button class="ghost-btn" data-compare="${product.id}">${state.compare.includes(product.id) ? "Compared" : "Compare"}</button>
        </div>
      </div>
    </article>`;
}

function renderReviews(product) {
  const reviews = product.reviews || [];
  return `
    <section class="review-panel">
      <div class="row" style="justify-content:space-between">
        <strong>${translate("reviews")}</strong>
        <span>${"★".repeat(Math.round(product.rating))} ${product.rating} / 5</span>
      </div>
      <div class="review-grid">
        ${reviews.map((review) => `
          <article class="mini-card">
            <div class="row" style="justify-content:space-between">
              <strong>${escapeHtml(review.name)}</strong>
              <span>${"★".repeat(Number(review.rating) || 5)}</span>
            </div>
            <p>${escapeHtml(localized(review.text))}</p>
          </article>`).join("") || `<p>${state.lang === "ar" ? "لا توجد تقييمات بعد." : "No reviews yet."}</p>`}
      </div>
    </section>`;
}

function footer() {
  return `
    <footer class="footer glass reveal">
      <div><h2>${escapeHtml(data.site.footer.headline)}</h2><p>${escapeHtml(data.site.footer.note)}</p></div>
      <div class="row">${data.site.footer.links.map((link) => `<button class="ghost-btn" data-route="${link.page}">${translate(link.labelKey)}</button>`).join("")}</div>
    </footer>`;
}

function renderEliteDock() {
  return `
    <nav class="elite-dock" aria-label="Quick actions">
      <button data-route="home">Home</button>
      <button data-route="shop">Shop</button>
      <button data-command>Search</button>
      <button data-route="wishlist">Wish</button>
      <button id="dockCart">Cart ${cartCount()}</button>
    </nav>`;
}

function renderCompareDock() {
  if (!state.compare.length) return "";
  const products = data.products.filter((product) => state.compare.includes(product.id));
  return `
    <aside class="compare-dock glass">
      <div class="row" style="justify-content:space-between">
        <strong>Compare ${products.length}/3</strong>
        <button class="icon-btn" id="clearCompare">×</button>
      </div>
      <div class="compare-grid">
        ${products.map((product) => `
          <div class="mini-card">
            <img src="${safeUrl(product.images[0])}" alt="" onerror="this.src='assets/products/dumbbell.jpg'">
            <strong>${escapeHtml(localized(product.name))}</strong>
            <span>${money(product.price)}</span>
            <small>${product.rating} rating / ${product.stock} stock</small>
          </div>`).join("")}
      </div>
    </aside>`;
}

function renderSizeGuide() {
  return `
    <dialog id="sizeGuide" class="modal-panel">
      <button class="icon-btn modal-close" data-close-modal>×</button>
      <span class="eyebrow">Elite Fit System</span>
      <h2>Size Guide</h2>
      <div class="size-table">
        <span>S</span><span>Chest 88-94 cm</span><span>Lean fit</span>
        <span>M</span><span>Chest 95-101 cm</span><span>Training fit</span>
        <span>L</span><span>Chest 102-108 cm</span><span>Power fit</span>
        <span>XL</span><span>Chest 109-116 cm</span><span>Relaxed fit</span>
      </div>
    </dialog>`;
}

function renderCartDrawer() {
  document.getElementById("cartDrawer").innerHTML = `
    <div class="row" style="justify-content:space-between"><h2>${translate("cart")}</h2><button class="icon-btn" id="closeCart">×</button></div>
    ${cartItemsHtml()}
    ${checkoutForm()}
  `;
}

function cartItemsHtml() {
  if (!state.cart.length) return `<p class="lead">${translate("emptyCart")}</p>`;
  return `
    <div>${state.cart.map((item) => {
      const product = data.products.find((p) => p.id === item.id);
      if (!product) return "";
      return `<div class="cart-item">
        <img src="${safeUrl(product.images[0])}" alt="" onerror="this.src='assets/products/dumbbell.jpg'">
        <div><strong>${escapeHtml(localized(product.name))}</strong><p>${escapeHtml([item.size, item.color].filter(Boolean).join(" / "))}</p><div class="qty"><button data-qty="${item.key}" data-delta="-1">-</button><span>${item.qty}</span><button data-qty="${item.key}" data-delta="1">+</button></div></div>
        <strong>${money(product.price * item.qty)}</strong>
      </div>`;
    }).join("")}</div>
    <div class="row" style="justify-content:space-between;margin-top:14px"><strong>${translate("subtotal")}</strong><strong>${money(cartTotal())}</strong></div>`;
}

function checkoutForm() {
  return `
    <form class="checkout-form" id="checkoutForm">
      <input required class="field" name="name" placeholder="${translate("name")}">
      <input required class="field" name="phone" placeholder="${translate("phone")}">
      <input required class="field" name="address" placeholder="${translate("address")}">
      <input required class="field" name="governorate" placeholder="${translate("governorate")}">
      <input class="field" name="size" placeholder="${translate("size")}">
      <textarea class="field" name="notes" placeholder="${translate("notes")}"></textarea>
      <button class="pill-btn" type="submit">${translate("sendWhatsapp")}</button>
    </form>`;
}

function bindPageEvents() {
  document.querySelectorAll("[data-route]").forEach((button) => button.addEventListener("click", () => go(button.dataset.route)));
  document.querySelectorAll("[data-product]").forEach((button) => button.addEventListener("click", () => go(`product?id=${button.dataset.product}`)));
  document.querySelectorAll("[data-category-route]").forEach((button) => button.addEventListener("click", () => {
    state.selectedCategory = button.dataset.categoryRoute;
    go("shop");
  }));
  document.querySelectorAll("[data-add]").forEach((button) => button.addEventListener("click", () => addToCart(button.dataset.add)));
  document.querySelectorAll("[data-wish]").forEach((button) => button.addEventListener("click", () => toggleWish(button.dataset.wish)));
  document.querySelectorAll("[data-compare]").forEach((button) => button.addEventListener("click", () => toggleCompare(button.dataset.compare)));
  document.querySelectorAll("[data-command]").forEach((button) => button.addEventListener("click", openCommand));
  document.querySelectorAll("[data-size-guide]").forEach((button) => button.addEventListener("click", () => document.getElementById("sizeGuide")?.showModal()));
  document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", () => button.closest("dialog")?.close()));
  document.querySelectorAll("[data-qty]").forEach((button) => button.addEventListener("click", () => changeQty(button.dataset.qty, Number(button.dataset.delta))));
  document.querySelectorAll("[data-option]").forEach((button) => button.addEventListener("click", () => setOption(button.dataset.option, button.dataset.value)));
  document.querySelectorAll(".thumbs button").forEach((button) => button.addEventListener("click", () => document.getElementById("mainProductImage").src = button.dataset.img));
  document.getElementById("langBtn")?.addEventListener("click", toggleLanguage);
  document.getElementById("themeBtn")?.addEventListener("click", cycleTheme);
  document.getElementById("commandBtn")?.addEventListener("click", openCommand);
  document.getElementById("openCart")?.addEventListener("click", openCart);
  document.getElementById("dockCart")?.addEventListener("click", openCart);
  document.getElementById("openCartPage")?.addEventListener("click", openCart);
  document.getElementById("closeCart")?.addEventListener("click", closeCart);
  document.getElementById("clearCompare")?.addEventListener("click", () => { state.compare = []; saveCompare(); render(); });
  document.getElementById("searchInput")?.addEventListener("input", (event) => { state.search = event.target.value; render(); });
  document.getElementById("categoryFilter")?.addEventListener("change", (event) => { state.selectedCategory = event.target.value; render(); });
  document.getElementById("sortFilter")?.addEventListener("change", (event) => { localStorage.setItem("titan.sort", event.target.value); render(); });
  document.querySelectorAll("#checkoutForm").forEach((form) => form.addEventListener("submit", checkout));
  wireTilt();
}

function filteredProducts() {
  const term = state.search.trim().toLowerCase();
  let products = data.products.filter((product) => {
    const name = `${localized(product.name)} ${localized(product.description)}`.toLowerCase();
    const categoryMatch = state.selectedCategory === "all" || product.category === state.selectedCategory;
    return categoryMatch && (!term || name.includes(term));
  });
  const sort = localStorage.getItem("titan.sort") || "featured";
  if (sort === "low") products = products.sort((a, b) => a.price - b.price);
  if (sort === "high") products = products.sort((a, b) => b.price - a.price);
  return products;
}

function addToCart(id) {
  const product = data.products.find((item) => item.id === id);
  const options = state.activeProductOptions[id] || { size: product?.variants?.sizes?.[0] || "", color: product?.variants?.colors?.[0] || "" };
  const key = `${id}_${options.size}_${options.color}`;
  const existing = state.cart.find((item) => item.key === key);
  if (existing) existing.qty += 1;
  else state.cart.push({ key, id, qty: 1, ...options });
  saveCart();
  toast(translate("addToCart"));
  render();
  openCart();
}

function toggleWish(id) {
  state.wishlist = state.wishlist.includes(id) ? state.wishlist.filter((item) => item !== id) : [...state.wishlist, id];
  localStorage.setItem("titan.wishlist", JSON.stringify(state.wishlist));
  toast(translate("wishlist"));
  render();
}

function toggleCompare(id) {
  if (state.compare.includes(id)) {
    state.compare = state.compare.filter((item) => item !== id);
  } else {
    state.compare = [...state.compare, id].slice(-3);
  }
  saveCompare();
  toast("Compare updated");
  render();
}

function openCommand() {
  document.querySelector(".command-overlay")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "command-overlay";
  overlay.innerHTML = `
    <div class="command-panel">
      <div class="row" style="justify-content:space-between">
        <strong>Command Search</strong>
        <button class="icon-btn" data-command-close>×</button>
      </div>
      <input class="field" id="commandInput" placeholder="${translate("search")} / page / category">
      <div class="command-results"></div>
    </div>`;
  document.body.append(overlay);
  const input = overlay.querySelector("#commandInput");
  const results = overlay.querySelector(".command-results");
  const renderResults = () => {
    const term = input.value.trim().toLowerCase();
    const pageItems = ["home", "shop", "offers", "faq", "contact", "wishlist", "cart"].map((page) => ({ type: "page", label: translate(page), route: page }));
    const productItems = data.products.map((product) => ({ type: "product", label: localized(product.name), route: `product?id=${product.id}` }));
    const items = [...pageItems, ...productItems].filter((item) => !term || item.label.toLowerCase().includes(term)).slice(0, 8);
    results.innerHTML = items.map((item) => `<button data-command-route="${escapeAttr(item.route)}"><span>${escapeHtml(item.type)}</span><strong>${escapeHtml(item.label)}</strong></button>`).join("");
    results.querySelectorAll("[data-command-route]").forEach((button) => button.addEventListener("click", () => {
      overlay.remove();
      go(button.dataset.commandRoute);
    }));
  };
  overlay.querySelector("[data-command-close]").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
  input.addEventListener("input", renderResults);
  renderResults();
  input.focus();
}

function changeQty(key, delta) {
  const item = state.cart.find((entry) => entry.key === key);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) state.cart = state.cart.filter((entry) => entry.key !== key);
  saveCart();
  render();
}

function setOption(name, value) {
  const id = state.params.id;
  state.activeProductOptions[id] = { ...(state.activeProductOptions[id] || {}), [name]: value };
  render();
}

function checkout(event) {
  event.preventDefault();
  if (!state.cart.length) return toast(translate("emptyCart"));
  const form = new FormData(event.currentTarget);
  const lines = [
    `*${data.site.brand.name} Order*`,
    "",
    ...state.cart.map((item) => {
      const product = data.products.find((p) => p.id === item.id);
      return `- ${localized(product.name)} x${item.qty} (${[item.size, item.color].filter(Boolean).join(" / ")}) = ${money(product.price * item.qty)}`;
    }),
    "",
    `${translate("subtotal")}: ${money(cartTotal())}`,
    "",
    `${translate("name")}: ${form.get("name")}`,
    `${translate("phone")}: ${form.get("phone")}`,
    `${translate("address")}: ${form.get("address")}`,
    `${translate("governorate")}: ${form.get("governorate")}`,
    `${translate("size")}: ${form.get("size") || "-"}`,
    `${translate("notes")}: ${form.get("notes") || "-"}`
  ];
  const phone = data.site.brand.whatsapp.replace(/\D/g, "");
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener");
}

function applyLanguage() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
  document.body.dir = document.documentElement.dir;
}

function applyTheme() {
  const theme = data.themes.items.find((item) => item.id === state.theme) || data.themes.items[0];
  document.documentElement.style.colorScheme = theme.mode;
  const map = {
    "--bg": theme.colors.bg,
    "--surface": theme.colors.surface,
    "--surface-strong": theme.colors.surfaceStrong,
    "--text": theme.colors.text,
    "--muted": theme.colors.muted,
    "--accent": data.site.settings.accent || theme.colors.accent,
    "--accent-2": theme.colors.accent2,
    "--hot": theme.colors.hot,
    "--gold": theme.colors.gold
  };
  Object.entries(map).forEach(([key, value]) => document.documentElement.style.setProperty(key, value));
}

function applyMotion() {
  const motion = data.motion || {};
  document.documentElement.style.setProperty("--reveal-duration", `${motion.revealDuration || 720}ms`);
  document.documentElement.style.setProperty("--hover-depth", `${motion.hoverDepth || 10}px`);
  document.body.classList.toggle("no-cursor-glow", motion.cursorGlow === false);
  document.body.classList.toggle("no-particles", motion.particles === false);
}

function cycleTheme() {
  const ids = data.themes.items.map((theme) => theme.id);
  state.theme = ids[(ids.indexOf(state.theme) + 1) % ids.length];
  localStorage.setItem("titan.theme", state.theme);
  render();
}

function toggleLanguage() {
  state.lang = state.lang === "ar" ? "en" : "ar";
  localStorage.setItem("titan.lang", state.lang);
  render();
}

function applySeo() {
  document.title = data.seo.title;
  setMeta("description", data.seo.description);
  setMeta("keywords", data.seo.keywords);
  setMeta("property", "og:title", data.seo.title);
  setMeta("property", "og:description", data.seo.description);
  setMeta("property", "og:image", data.seo.ogImage);
}

function setupAmbient() {
  const old = document.querySelector(".ambient-media");
  old?.remove();
  const url = data.site.settings.backgroundUrl;
  if (!url) return;
  document.documentElement.style.setProperty("--site-background-url", `url("${url}")`);
  const media = document.createElement(data.site.settings.backgroundType === "video" ? "video" : "img");
  media.className = "ambient-media";
  media.src = url;
  if (media.tagName === "VIDEO") {
    media.autoplay = true;
    media.muted = true;
    media.loop = true;
    media.playsInline = true;
  }
  document.body.prepend(media);
}

function wireCursor() {
  const glow = document.getElementById("cursorGlow");
  window.addEventListener("pointermove", (event) => {
    glow.style.left = `${event.clientX}px`;
    glow.style.top = `${event.clientY}px`;
  }, { passive: true });
}

function wireTilt() {
  document.querySelectorAll(".tilt").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      card.style.transform = `perspective(900px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg) translateY(-4px)`;
    });
    card.addEventListener("pointerleave", () => card.style.transform = "");
  });
}

function reveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("visible");
    });
  }, { threshold: .12 });
  document.querySelectorAll(".reveal").forEach((item) => observer.observe(item));
}

function openCart() { document.getElementById("cartDrawer").classList.add("open"); }
function closeCart() { document.getElementById("cartDrawer").classList.remove("open"); }
function go(page) { location.hash = `#/${page}`; }
function saveCart() { localStorage.setItem("titan.cart", JSON.stringify(state.cart)); }
function saveCompare() { localStorage.setItem("titan.compare", JSON.stringify(state.compare)); }
function cartCount() { return state.cart.reduce((sum, item) => sum + item.qty, 0); }
function cartTotal() { return state.cart.reduce((sum, item) => sum + ((data.products.find((p) => p.id === item.id)?.price || 0) * item.qty), 0); }
function localized(value) { return typeof value === "object" ? (value[state.lang] || value.en || value.ar || "") : value; }
function translate(key) { return data.translations?.[state.lang]?.[key] || data.translations?.en?.[key] || key; }
function money(value) { return new Intl.NumberFormat(state.lang === "ar" ? "ar-EG" : "en-EG", { style: "currency", currency: data.site.settings.currency || "EGP", maximumFractionDigits: 0 }).format(value); }
function readStore(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
function toast(message) {
  const item = document.createElement("div");
  item.className = "toast";
  item.textContent = message;
  document.getElementById("toastRegion").append(item);
  setTimeout(() => item.remove(), 2600);
}
function emptyBlock(text) { return `<div class="glass" style="padding:18px;border-radius:8px">${escapeHtml(text)}</div>`; }
function setMeta(name, value, content) {
  const attr = content === undefined ? "name" : name;
  const key = content === undefined ? name : value;
  const val = content === undefined ? value : content;
  let meta = document.querySelector(`meta[${attr}="${key}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attr, key);
    document.head.append(meta);
  }
  meta.content = val || "";
}
function safeUrl(url) { return escapeAttr(url || ""); }
function absoluteUrl(url = "") {
  if (!url) return "";
  try { return new URL(url, document.baseURI).href; } catch { return url; }
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}
function escapeAttr(value = "") { return escapeHtml(value); }
