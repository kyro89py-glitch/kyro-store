(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const strings = window.KYRO && window.KYRO.strings ? window.KYRO.strings : {};
  const routes = window.KYRO && window.KYRO.routes ? window.KYRO.routes : { cart_add_url: '/cart/add', cart_url: '/cart' };

  if (root.classList.contains('motion') && reduceMotion.matches) root.classList.remove('motion');

  const formatMoney = (cents) => {
    const format = (window.KYRO && window.KYRO.moneyFormat) || '${{amount}}';
    const value = (cents / 100).toFixed(2);
    const [whole, decimals] = value.split('.');
    const withSep = (sep, dec) => whole.replace(/\B(?=(\d{3})+(?!\d))/g, sep) + (dec !== null ? dec + decimals : '');
    return format.replace(/\{\{\s*(\w+)\s*\}\}/, (_, key) => {
      if (key === 'amount_no_decimals') return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      if (key === 'amount_with_comma_separator') return withSep('.', ',');
      if (key === 'amount_no_decimals_with_comma_separator') return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      if (key === 'amount_with_apostrophe_separator') return withSep("'", '.');
      return withSep(',', '.');
    });
  };

  /* Aparición al desplazarse */
  const revealTargets = document.querySelectorAll('[data-reveal]');
  if (root.classList.contains('motion') && 'IntersectionObserver' in window) {
    // Un elemento que empieza recortado del todo (clip-path, como el título de la portada)
    // tiene área visible cero y el observador nunca lo daría por visible: se observa su
    // contenedor y se revela el elemento cuando aparece el contenedor.
    const revealWith = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const shown = [...(revealWith.get(entry.target) || [])];
          if (entry.target.hasAttribute('data-reveal')) shown.push(entry.target);
          shown.forEach((el) => el.classList.add('is-visible'));
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    revealTargets.forEach((el) => {
      if (getComputedStyle(el).clipPath === 'none' || !el.parentElement) {
        observer.observe(el);
        return;
      }
      const box = el.parentElement;
      if (!revealWith.has(box)) revealWith.set(box, []);
      revealWith.get(box).push(el);
      observer.observe(box);
    });
  } else {
    revealTargets.forEach((el) => el.classList.add('is-visible'));
  }

  /* Cabecera: fondo al desplazarse */
  const header = document.querySelector('[data-header]');
  if (header) {
    const update = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  /* Menú móvil */
  const drawer = document.querySelector('[data-menu-drawer]');
  if (drawer && typeof drawer.showModal === 'function') {
    document.querySelectorAll('[data-menu-open]').forEach((button) =>
      button.addEventListener('click', () => {
        drawer.showModal();
        button.setAttribute('aria-expanded', 'true');
      })
    );
    drawer.querySelectorAll('[data-menu-close]').forEach((button) => button.addEventListener('click', () => drawer.close()));
    drawer.addEventListener('click', (event) => {
      if (event.target === drawer) drawer.close();
    });
    drawer.addEventListener('close', () => {
      document.querySelectorAll('[data-menu-open]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
    });
  }

  /* Aviso flotante */
  const toast = document.querySelector('[data-toast]');
  let toastTimer;
  const showToast = (message, link) => {
    if (!toast) return;
    toast.textContent = '';
    const text = document.createElement('span');
    text.textContent = message;
    toast.append(text);
    if (link) {
      const anchor = document.createElement('a');
      anchor.className = 'text-link';
      anchor.href = link.href;
      anchor.textContent = link.label;
      toast.append(anchor);
    }
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 5000);
  };

  const updateCartCount = (count) => {
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = String(count);
      el.hidden = count === 0;
    });
  };

  /* Cantidad */
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-quantity-step]');
    if (!button) return;
    const input = button.closest('.quantity').querySelector('input');
    const step = Number(button.dataset.quantityStep);
    const min = Number(input.min || 0);
    const max = input.max ? Number(input.max) : Infinity;
    const next = Math.min(max, Math.max(min, (Number(input.value) || min) + step));
    if (String(next) === input.value) return;
    input.value = String(next);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  /* Carrito: actualizar al cambiar la cantidad (sin JavaScript, botón «Actualizar») */
  const cartForm = document.querySelector('[data-cart-form]');
  if (cartForm) {
    let timer;
    cartForm.addEventListener('change', (event) => {
      if (!event.target.matches('input[name="updates[]"], textarea[name="note"]')) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (event.target.name === 'note') {
          fetch(routes.cart_update_url + '.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ note: event.target.value }),
          });
          return;
        }
        cartForm.requestSubmit(cartForm.querySelector('[name="update"]'));
      }, 400);
    });
  }

  /* Filtros y orden de la colección */
  document.querySelectorAll('[data-auto-submit]').forEach((el) => {
    const form = el.tagName === 'FORM' ? el : el.querySelector('form');
    if (!form) return;
    form.addEventListener('change', (event) => {
      if (event.target.matches('input[type="number"]')) return;
      form.requestSubmit();
    });
  });

  document.addEventListener('click', (event) => {
    document.querySelectorAll('details[data-dismissable][open]').forEach((details) => {
      if (!details.contains(event.target)) details.removeAttribute('open');
    });
  });

  /* Producto */
  document.querySelectorAll('[data-product]').forEach((section) => {
    const dataEl = section.querySelector('[data-product-json]');
    if (!dataEl) return;
    const product = JSON.parse(dataEl.textContent);
    const form = section.querySelector('form.product-form');
    const idInput = form ? form.querySelector('input[name="id"]') : null;
    const picker = section.querySelector('[data-variant-picker]');
    const submit = form ? form.querySelector('[data-add-to-cart]') : null;
    const errorEl = section.querySelector('[data-form-error]');
    const priceEls = section.querySelectorAll('[data-price]');
    const buyBar = section.querySelector('[data-buy-bar]');

    const currentOptions = () =>
      picker ? Array.from(picker.querySelectorAll('fieldset')).map((fs) => {
        const checked = fs.querySelector('input:checked');
        return checked ? checked.value : null;
      }) : [];

    const findVariant = (options) =>
      product.variants.find((variant) => variant.options.every((value, index) => value === options[index]));

    const renderPrice = (variant) => {
      priceEls.forEach((el) => {
        const sale = variant.compare_at_price && variant.compare_at_price > variant.price;
        el.classList.toggle('price--sale', Boolean(sale));
        const regular = el.querySelector('[data-price-regular]');
        const compare = el.querySelector('[data-price-compare]');
        if (regular) regular.textContent = formatMoney(variant.price);
        if (compare) {
          compare.hidden = !sale;
          if (sale) compare.textContent = formatMoney(variant.compare_at_price);
        }
      });
    };

    const setButtons = (variant) => {
      const buttons = section.querySelectorAll('[data-add-to-cart]');
      buttons.forEach((button) => {
        const label = button.querySelector('[data-add-label]') || button;
        if (!variant) {
          button.disabled = true;
          label.textContent = strings.unavailable;
        } else if (!variant.available) {
          button.disabled = true;
          label.textContent = strings.soldOut;
        } else {
          button.disabled = false;
          label.textContent = strings.addToCart;
        }
      });
    };

    const markAvailability = (options) => {
      if (!picker) return;
      picker.querySelectorAll('fieldset').forEach((fs, index) => {
        fs.querySelectorAll('input').forEach((input) => {
          const candidate = options.slice();
          candidate[index] = input.value;
          const match = findVariant(candidate);
          input.classList.toggle('is-unavailable', !match || !match.available);
        });
        const selected = fs.querySelector('[data-option-selected]');
        const checked = fs.querySelector('input:checked');
        if (selected && checked) selected.textContent = checked.value;
      });
    };

    const goToMedia = (variant) => {
      if (!variant || !variant.featured_media) return;
      const slide = section.querySelector(`[data-media-id="${variant.featured_media.id}"]`);
      if (slide) slide.dispatchEvent(new CustomEvent('gallery:select', { bubbles: true }));
    };

    if (picker) {
      markAvailability(currentOptions());
      picker.addEventListener('change', () => {
        const options = currentOptions();
        const variant = findVariant(options);
        markAvailability(options);
        setButtons(variant);
        if (errorEl) errorEl.hidden = true;
        if (!variant) return;
        if (idInput) idInput.value = variant.id;
        renderPrice(variant);
        goToMedia(variant);
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url.toString());
      });
    }

    if (form) {
      form.addEventListener('submit', async (event) => {
        if (!window.fetch) return;
        event.preventDefault();
        const buttons = section.querySelectorAll('[data-add-to-cart]');
        buttons.forEach((button) => button.setAttribute('aria-busy', 'true'));
        if (errorEl) errorEl.hidden = true;
        try {
          const response = await fetch(routes.cart_add_url + '.js', {
            method: 'POST',
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body: new FormData(form),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.description || data.message || strings.error);
          const cart = await fetch(routes.cart_url + '.js', { headers: { Accept: 'application/json' } }).then((r) => r.json());
          updateCartCount(cart.item_count);
          showToast(strings.added, { href: routes.cart_url, label: strings.viewCart });
        } catch (error) {
          if (errorEl) {
            errorEl.textContent = error.message || strings.error;
            errorEl.hidden = false;
          }
        } finally {
          buttons.forEach((button) => button.removeAttribute('aria-busy'));
        }
      });
    }

    if (buyBar && form && 'IntersectionObserver' in window) {
      const mainButton = form.querySelector('[data-add-to-cart]');
      const observer = new IntersectionObserver(([entry]) => {
        const below = entry.boundingClientRect.top > 0 && !entry.isIntersecting;
        buyBar.classList.toggle('is-visible', !entry.isIntersecting && !below);
      });
      if (mainButton) observer.observe(mainButton);
    }
  });

  /* Galería */
  document.querySelectorAll('[data-gallery]').forEach((gallery) => {
    const viewport = gallery.querySelector('[data-gallery-viewport]');
    const slides = Array.from(gallery.querySelectorAll('[data-gallery-slide]'));
    const markers = Array.from(gallery.querySelectorAll('[data-gallery-go]'));
    const desktop = window.matchMedia('(min-width: 60rem)');
    if (!viewport || slides.length === 0) return;

    const setCurrent = (index) => {
      markers.forEach((marker) => marker.setAttribute('aria-current', String(Number(marker.dataset.galleryGo) === index)));
    };

    const goTo = (index) => {
      const slide = slides[index];
      if (!slide) return;
      const behavior = reduceMotion.matches ? 'auto' : 'smooth';
      if (desktop.matches) {
        slide.scrollIntoView({ behavior, block: 'start' });
      } else {
        viewport.scrollTo({ left: slide.offsetLeft - viewport.offsetLeft, behavior });
      }
      setCurrent(index);
    };

    markers.forEach((marker) => marker.addEventListener('click', () => goTo(Number(marker.dataset.galleryGo))));
    slides.forEach((slide, index) => slide.addEventListener('gallery:select', () => goTo(index)));

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) setCurrent(slides.indexOf(entry.target));
          });
        },
        { root: null, threshold: 0.6 }
      );
      slides.forEach((slide) => observer.observe(slide));
    }

    const dialog = gallery.querySelector('[data-zoom-dialog]');
    const zoomImage = dialog ? dialog.querySelector('img') : null;
    if (dialog && zoomImage && typeof dialog.showModal === 'function') {
      gallery.querySelectorAll('[data-zoom-src]').forEach((button) => {
        button.addEventListener('click', () => {
          if (button.dataset.zoomWidth) zoomImage.width = Number(button.dataset.zoomWidth);
          if (button.dataset.zoomHeight) zoomImage.height = Number(button.dataset.zoomHeight);
          zoomImage.src = button.dataset.zoomSrc;
          zoomImage.alt = button.dataset.zoomAlt || '';
          dialog.showModal();
        });
      });
      dialog.querySelectorAll('[data-zoom-close]').forEach((button) => button.addEventListener('click', () => dialog.close()));
      dialog.addEventListener('close', () => {
        zoomImage.removeAttribute('src');
      });
    }
  });

  /* Recomendaciones de producto */
  document.querySelectorAll('[data-recommendations]').forEach(async (container) => {
    try {
      const response = await fetch(container.dataset.url);
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const fresh = doc.querySelector('[data-recommendations]');
      if (fresh && fresh.innerHTML.trim()) {
        container.innerHTML = fresh.innerHTML;
        container.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
      } else {
        container.closest('.shopify-section')?.setAttribute('hidden', '');
      }
    } catch (error) {
      container.closest('.shopify-section')?.setAttribute('hidden', '');
    }
  });
})();
