document.addEventListener('DOMContentLoaded', () => {
    // Inject Cart HTML
    const cartHTML = `
        <button id="floatingCartBtn" class="fixed bottom-6 right-6 bg-[#1a1a1a] text-white p-4 rounded-full shadow-2xl hover:scale-105 transition-transform z-50 flex items-center justify-center">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            <span id="cartCount" class="absolute -top-2 -right-2 bg-[#E32636] text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">0</span>
        </button>

        <div id="cartModal" class="fixed inset-0 bg-black/60 z-[100] hidden items-center justify-center p-4 backdrop-blur-sm opacity-0 transition-opacity duration-300">
            <div class="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl transform scale-95 transition-transform duration-300">
                <div class="flex justify-between items-center p-6 border-b border-gray-100">
                    <h2 class="text-2xl font-bold text-[#1a1a1a] font-heading">Your Cart</h2>
                    <button id="closeCartBtn" class="text-gray-400 hover:text-[#E32636] transition-colors">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <div class="flex-1 overflow-y-auto p-6 bg-gray-50/50" id="cartItemsContainer">
                </div>
                <div class="p-6 border-t border-gray-100 bg-white rounded-b-2xl">
                    <form id="checkoutForm" class="hidden flex-col gap-4">
                        <h3 class="font-bold text-[#1a1a1a] mb-2">Shipping Details</h3>
                        <div id="checkoutErrorMsg" class="hidden text-[#E32636] text-sm font-bold text-center mb-2"></div>
                        <input type="text" id="shipAddress" name="address" placeholder="Street Address" required class="w-full bg-gray-50 border border-gray-200 px-4 py-3 rounded-xl outline-none focus:border-[#E32636] text-sm">
                        <div class="grid grid-cols-2 gap-4">
                            <input type="text" id="shipCity" name="city" placeholder="City" required class="w-full bg-gray-50 border border-gray-200 px-4 py-3 rounded-xl outline-none focus:border-[#E32636] text-sm">
                            <input type="text" id="shipZip" name="zip_code" placeholder="Zip Code" required class="w-full bg-gray-50 border border-gray-200 px-4 py-3 rounded-xl outline-none focus:border-[#E32636] text-sm">
                        </div>
                        <button type="submit" id="placeOrderBtn" class="w-full bg-[#E32636] text-white py-3.5 rounded-xl font-bold hover:bg-[#ff3b4b] transition-all shadow-lg mt-2">
                            Place Order
                        </button>
                    </form>
                    <div id="emptyCartMsg" class="text-center py-6 text-[#666666]">
                        Your cart is currently empty.
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', cartHTML);

    const cartModal = document.getElementById('cartModal');
    const closeCartBtn = document.getElementById('closeCartBtn');
    const floatingCartBtn = document.getElementById('floatingCartBtn');
    const cartCount = document.getElementById('cartCount');
    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const checkoutForm = document.getElementById('checkoutForm');
    const emptyCartMsg = document.getElementById('emptyCartMsg');
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    const checkoutErrorMsg = document.getElementById('checkoutErrorMsg');

    let cart = JSON.parse(localStorage.getItem('sedco_cart') || '[]');

    window.addToCart = (product, variant, quantity) => {
        const existing = cart.find(item => item.id === product.id && item.variant === variant);
        if (existing) {
            existing.quantity += quantity;
        } else {
            cart.push({ ...product, variant, quantity });
        }
        saveCart();
        showToast('Added to cart!');
    };

    function showToast(msg) {
        let toast = document.getElementById('cartToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'cartToast';
            toast.className = 'fixed bottom-24 right-6 bg-white text-[#1a1a1a] px-6 py-3 rounded-xl shadow-2xl font-bold z-[150] transition-all duration-300 transform translate-y-10 opacity-0 border-l-4 border-[#2ecc71]';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.remove('translate-y-10', 'opacity-0');
        setTimeout(() => toast.classList.add('translate-y-10', 'opacity-0'), 3000);
    }

    function saveCart() {
        localStorage.setItem('sedco_cart', JSON.stringify(cart));
        updateCartCount();
        renderCart();
    }

    function updateCartCount() {
        const total = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = total;
        if (total > 0) {
            checkoutForm.classList.remove('hidden');
            checkoutForm.style.display = 'flex';
            emptyCartMsg.classList.add('hidden');
        } else {
            checkoutForm.classList.add('hidden');
            checkoutForm.style.display = 'none';
            emptyCartMsg.classList.remove('hidden');
        }
    }

    function renderCart() {
        function escapeHtml(value) {
            return String(value ?? '').replace(/[&<>"']/g, ch => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[ch]));
        }

        cartItemsContainer.innerHTML = '';
        if (cart.length === 0) return;
        cart.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 items-center mb-3';
            div.innerHTML = `
                <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" class="w-16 h-16 object-cover rounded-lg border border-gray-100">
                <div class="flex-1">
                    <h4 class="font-bold text-[#1a1a1a] text-sm leading-tight">${escapeHtml(item.title)}</h4>
                    <p class="text-xs text-[#666666]">${escapeHtml(item.variant || 'Standard')}</p>
                </div>
                <div class="flex items-center gap-3">
                    <button class="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-[#1a1a1a] transition-colors font-bold" onclick="updateQty(${index}, -1)">-</button>
                    <span class="font-bold w-6 text-center">${item.quantity}</span>
                    <button class="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-[#1a1a1a] transition-colors font-bold" onclick="updateQty(${index}, 1)">+</button>
                </div>
                <button class="text-red-400 hover:text-red-600 transition-colors ml-2" onclick="removeItem(${index})">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            `;
            cartItemsContainer.appendChild(div);
        });
    }

    window.updateQty = (index, delta) => {
        cart[index].quantity += delta;
        if (cart[index].quantity <= 0) cart.splice(index, 1);
        saveCart();
    };

    window.removeItem = (index) => {
        cart.splice(index, 1);
        saveCart();
    };

    floatingCartBtn.addEventListener('click', async () => {
        cartModal.classList.remove('hidden');
        cartModal.classList.add('flex');
        setTimeout(() => {
            cartModal.classList.remove('opacity-0');
            cartModal.querySelector('.bg-white').classList.remove('scale-95');
        }, 10);
        if (window.supabase) {
            const { data: { session } } = await window.supabase.createClient("https://nnwcwqasmdpbvotfepvy.supabase.co", "sb_publishable_llEtCRU2fkmNycPY4HwJ5w_XqnkQFQf").auth.getSession();
            if (session && session.user) {
                const { data } = await window.supabase.createClient("https://nnwcwqasmdpbvotfepvy.supabase.co", "sb_publishable_llEtCRU2fkmNycPY4HwJ5w_XqnkQFQf").from('profiles').select('*').eq('id', session.user.id).single();
                if (data) {
                    document.getElementById('shipAddress').value = data.address || '';
                    document.getElementById('shipCity').value = data.city || '';
                    document.getElementById('shipZip').value = data.zip_code || '';
                }
            }
        }
    });

    closeCartBtn.addEventListener('click', () => {
        cartModal.classList.add('opacity-0');
        cartModal.querySelector('.bg-white').classList.add('scale-95');
        setTimeout(() => {
            cartModal.classList.add('hidden');
            cartModal.classList.remove('flex');
        }, 300);
    });

    checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!window.supabase) return;
        const supabaseClient = window.supabase.createClient("https://nnwcwqasmdpbvotfepvy.supabase.co", "sb_publishable_llEtCRU2fkmNycPY4HwJ5w_XqnkQFQf");
        placeOrderBtn.disabled = true;
        const origText = placeOrderBtn.textContent;
        placeOrderBtn.textContent = 'Processing...';
        checkoutErrorMsg.classList.add('hidden');
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session || !session.user) {
                window.location.href = 'auth.html?redirect=marketplace.html';
                return;
            }
            const address = document.getElementById('shipAddress').value;
            const city = document.getElementById('shipCity').value;
            const zip = document.getElementById('shipZip').value;
            await supabaseClient.from('profiles').upsert({ id: session.user.id, address, city, zip_code: zip, updated_at: new Date() });
            for (const item of cart) {
                const payload = {
                    user_id: session.user.id,
                    customer_name: session.user.user_metadata?.full_name || session.user.email,
                    customer_email: session.user.email, 
                    variant: item.title + (item.variant ? ' - ' + item.variant : ''),
                    quantity: item.quantity, address, city, zip_code: zip
                };
                if (item.id && item.id.length === 36) payload.product_id = item.id;
                
                const { error } = await supabaseClient.from('product_orders').insert([payload]);
                if (error) throw new Error(error.message);
            }
            placeOrderBtn.textContent = 'Order Placed! \u2713';
            placeOrderBtn.style.backgroundColor = '#2ecc71';
            checkoutErrorMsg.className = 'text-[#2ecc71] text-sm font-bold text-center mb-2';
            checkoutErrorMsg.textContent = 'Success! Your order has been recorded.';
            cart = [];
            saveCart();
            setTimeout(() => closeCartBtn.click(), 2500);
        } catch (err) {
            // Silent error handling
            checkoutErrorMsg.className = 'text-[#E32636] text-sm font-bold text-center mb-2';
            checkoutErrorMsg.textContent = 'Error placing order. Please try again later.';
        } finally {
            setTimeout(() => {
                placeOrderBtn.disabled = false;
                placeOrderBtn.textContent = origText;
                placeOrderBtn.style.backgroundColor = '';
            }, 3000);
        }
    });

    updateCartCount();
    renderCart();
});
