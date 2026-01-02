/**
 * VAIKO STORE - Global JavaScript
 */

(function() {
  'use strict';

  // ============================================
  // Cart Functionality
  // ============================================
  class CartDrawer {
    constructor() {
      this.drawer = document.querySelector('[data-cart-drawer]');
      this.overlay = document.querySelector('.cart-drawer__overlay');
      this.closeBtn = document.querySelectorAll('[data-action="cart-close"]');
      
      this.bindEvents();
    }

    bindEvents() {
      // Close buttons
      this.closeBtn.forEach(btn => {
        btn.addEventListener('click', () => this.close());
      });

      // Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen()) {
          this.close();
        }
      });
    }

    open() {
      if (!this.drawer) return;
      this.drawer.classList.add('is-open');
      this.drawer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    close() {
      if (!this.drawer) return;
      this.drawer.classList.remove('is-open');
      this.drawer.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    isOpen() {
      return this.drawer && this.drawer.classList.contains('is-open');
    }
  }

  // ============================================
  // Add to Cart
  // ============================================
  class AddToCart {
    constructor() {
      this.bindEvents();
    }

    bindEvents() {
      document.addEventListener('click', (e) => {
        const addBtn = e.target.closest('[data-action="add-to-cart"]');
        if (addBtn) {
          e.preventDefault();
          this.handleAdd(addBtn);
        }
      });

      // Product form submission
      document.addEventListener('submit', (e) => {
        const form = e.target.closest('[data-type="add-to-cart-form"]');
        if (form) {
          e.preventDefault();
          this.handleFormSubmit(form);
        }
      });
    }

    async handleAdd(button) {
      const variantId = button.dataset.variantId;
      if (!variantId) return;

      button.classList.add('is-adding');
      button.disabled = true;

      try {
        await this.addToCart(variantId, 1);
        await this.updateCartUI();
        window.cartDrawer?.open();
      } catch (error) {
        console.error('Error adding to cart:', error);
      } finally {
        button.classList.remove('is-adding');
        button.disabled = false;
      }
    }

    async handleFormSubmit(form) {
      const submitBtn = form.querySelector('[type="submit"]');
      const variantInput = form.querySelector('[data-product-variant-id]');
      const quantityInput = form.querySelector('[data-quantity-input]');

      if (!variantInput) return;

      const variantId = variantInput.value;
      const quantity = quantityInput ? parseInt(quantityInput.value) : 1;

      if (submitBtn) {
        submitBtn.classList.add('is-adding');
        submitBtn.disabled = true;
      }

      try {
        await this.addToCart(variantId, quantity);
        await this.updateCartUI();
        window.cartDrawer?.open();
      } catch (error) {
        console.error('Error adding to cart:', error);
      } finally {
        if (submitBtn) {
          submitBtn.classList.remove('is-adding');
          submitBtn.disabled = false;
        }
      }
    }

    async addToCart(variantId, quantity = 1) {
      const response = await fetch(window.routes.cart_add_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          id: variantId,
          quantity: quantity
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add to cart');
      }

      return response.json();
    }

    async updateCartUI() {
      try {
        const response = await fetch(window.routes.cart_url + '.js');
        const cart = await response.json();

        // Update cart count
        const cartCounts = document.querySelectorAll('[data-cart-count]');
        cartCounts.forEach(el => {
          el.textContent = cart.item_count;
          if (cart.item_count > 0) {
            el.style.display = '';
          }
        });

        // Trigger custom event for other components
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
      } catch (error) {
        console.error('Error updating cart UI:', error);
      }
    }
  }

  // ============================================
  // Cart Item Actions
  // ============================================
  class CartItemActions {
    constructor() {
      this.bindEvents();
    }

    bindEvents() {
      document.addEventListener('click', async (e) => {
        const increaseBtn = e.target.closest('[data-action="increase-quantity"]');
        const decreaseBtn = e.target.closest('[data-action="decrease-quantity"]');
        const removeBtn = e.target.closest('[data-action="remove-item"]');

        if (increaseBtn) {
          await this.changeQuantity(increaseBtn.dataset.key, 1);
        } else if (decreaseBtn) {
          await this.changeQuantity(decreaseBtn.dataset.key, -1);
        } else if (removeBtn) {
          await this.removeItem(removeBtn.dataset.key);
        }
      });
    }

    async changeQuantity(key, delta) {
      try {
        const cartResponse = await fetch(window.routes.cart_url + '.js');
        const cart = await cartResponse.json();
        
        const item = cart.items.find(i => i.key === key);
        if (!item) return;

        const newQuantity = Math.max(0, item.quantity + delta);

        if (newQuantity === 0) {
          await this.removeItem(key);
          return;
        }

        await fetch(window.routes.cart_change_url + '.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            id: key,
            quantity: newQuantity
          })
        });

        // Reload cart drawer content
        location.reload();
      } catch (error) {
        console.error('Error changing quantity:', error);
      }
    }

    async removeItem(key) {
      try {
        await fetch(window.routes.cart_change_url + '.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            id: key,
            quantity: 0
          })
        });

        // Reload cart drawer content
        location.reload();
      } catch (error) {
        console.error('Error removing item:', error);
      }
    }
  }

  // ============================================
  // Variant Selector
  // ============================================
  class VariantSelector {
    constructor() {
      this.productForm = document.querySelector('[data-type="add-to-cart-form"]');
      this.variantInput = document.querySelector('[data-product-variant-id]');
      this.priceEl = document.querySelector('[data-product-price]');
      
      this.bindEvents();
    }

    bindEvents() {
      const optionButtons = document.querySelectorAll('.product-page__option-btn');
      
      optionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.disabled) return;
          
          const optionIndex = parseInt(btn.dataset.optionIndex);
          const optionValue = btn.dataset.optionValue;
          
          // Update active state
          const siblings = btn.parentElement.querySelectorAll('.product-page__option-btn');
          siblings.forEach(s => s.classList.remove('product-page__option-btn--active'));
          btn.classList.add('product-page__option-btn--active');
          
          // Update variant - would need product variants JSON for full implementation
          this.updateSelectedOptions();
        });
      });
    }

    updateSelectedOptions() {
      // Get all selected options
      const selectedOptions = [];
      const optionGroups = document.querySelectorAll('.product-page__option');
      
      optionGroups.forEach(group => {
        const activeBtn = group.querySelector('.product-page__option-btn--active');
        if (activeBtn) {
          selectedOptions.push(activeBtn.dataset.optionValue);
        }
      });

      // Update option label
      optionGroups.forEach((group, index) => {
        const label = group.querySelector('.product-page__option-value');
        if (label && selectedOptions[index]) {
          label.textContent = `(${selectedOptions[index]})`;
        }
      });
    }
  }

  // ============================================
  // Initialize
  // ============================================
  document.addEventListener('DOMContentLoaded', function() {
    window.cartDrawer = new CartDrawer();
    new AddToCart();
    new CartItemActions();
    new VariantSelector();

    // Animation on scroll
    const animateOnScroll = () => {
      const elements = document.querySelectorAll('[data-animate]');
      
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });

      elements.forEach(el => observer.observe(el));
    };

    animateOnScroll();
  });
})();

