/**
 * UserSession - Food Delivery App Session and User Data Isolation Layer
 * Prevents account data leaks (addresses, phone numbers, orders, cart) across different users.
 */
(function(window) {
    const LEGACY_KEYS = [
        "addresses",
        "activeAddress",
        "phoneNumbers",
        "activeNumber",
        "savedAddresses",
        "orderedProducts",
        "hasPremium",
        "premiumStartDate",
        "cookieMoney",
        "cookiePayBalance",
        "deliveryOTP",
        "orderTimer",
        "deliveryBoy",
        "selectedDeliveryBoy",
        "selectedPaymentMethod",
        "orderPlacedAt",
        "orderDeliveryStatus",
        "welcomeMessageShown"
    ];

    const UserSession = {
        getEmail() {
            const email = sessionStorage.getItem("profileEmail") || localStorage.getItem("profileEmail") || "";
            return email.trim().toLowerCase();
        },

        getPhone() {
            const phone = sessionStorage.getItem("profilePhone") || localStorage.getItem("profilePhone") || "";
            return phone.trim();
        },

        getName() {
            const name = sessionStorage.getItem("profileName") || localStorage.getItem("profileName") || "";
            return name.trim();
        },

        getUserKey() {
            const email = this.getEmail();
            if (email) return `user_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
            const phone = this.getPhone();
            if (phone) return `user_${phone}`;
            return "user_guest";
        },

        setUser(data) {
            if (!data) return;
            const newEmail = (data.email || "").trim().toLowerCase();
            const newPhone = (data.mobile || data.phone || "").trim();
            const newName = (data.nickName || [data.firstName, data.lastName].filter(Boolean).join(" ") || data.name || data.firstName || "").trim();

            const currentEmail = this.getEmail();
            const currentPhone = this.getPhone();

            // If switching from another account, wipe legacy keys and ensure isolation
            if ((currentEmail && newEmail && currentEmail !== newEmail) ||
                (currentPhone && newPhone && currentPhone !== newPhone)) {
                this.clearLegacyKeys();
            }

            if (newEmail) {
                sessionStorage.setItem("profileEmail", newEmail);
                localStorage.setItem("profileEmail", newEmail);
            }
            if (newPhone) {
                sessionStorage.setItem("profilePhone", newPhone);
                localStorage.setItem("profilePhone", newPhone);
            }
            if (newName) {
                sessionStorage.setItem("profileName", newName);
                localStorage.setItem("profileName", newName);
            }

            // Restore scoped order info into active localStorage
            const scopedOrders = this.getScoped("orderedProducts", null);
            if (Array.isArray(scopedOrders) && scopedOrders.length > 0) {
                localStorage.setItem("orderedProducts", JSON.stringify(scopedOrders));
            }
            const scopedPayment = this.getScoped("selectedPaymentMethod", null);
            if (scopedPayment) {
                localStorage.setItem("selectedPaymentMethod", scopedPayment);
            }
            const scopedPlacedAt = this.getScoped("orderPlacedAt", null);
            if (scopedPlacedAt) {
                localStorage.setItem("orderPlacedAt", scopedPlacedAt);
            }
            const scopedDeliveryStatus = this.getScoped("orderDeliveryStatus", null);
            if (scopedDeliveryStatus) {
                localStorage.setItem("orderDeliveryStatus", scopedDeliveryStatus);
            }

            // Restore from data.orders if provided directly
            if (Array.isArray(data.orders) && data.orders.length > 0) {
                const activeOrder = [...data.orders].reverse().find(o => o.status === "Processing" || o.status === "Pending");
                if (activeOrder) {
                    if (activeOrder.paymentMethod && !scopedPayment) {
                        this.setScoped("selectedPaymentMethod", activeOrder.paymentMethod);
                        localStorage.setItem("selectedPaymentMethod", activeOrder.paymentMethod);
                    }
                    if (activeOrder.placedAt && !scopedPlacedAt) {
                        this.setScoped("orderPlacedAt", activeOrder.placedAt);
                        localStorage.setItem("orderPlacedAt", activeOrder.placedAt);
                    }
                    if (Array.isArray(activeOrder.items) && activeOrder.items.length > 0 && (!scopedOrders || scopedOrders.length === 0)) {
                        this.saveOrders(activeOrder.items);
                        localStorage.setItem("orderedProducts", JSON.stringify(activeOrder.items));
                    }
                }
            }

            // Sync user data with server database
            this.syncWithServer();
        },

        clearLegacyKeys() {
            LEGACY_KEYS.forEach(key => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            });
        },

        logout() {
            this.clearLegacyKeys();
            sessionStorage.clear();
            localStorage.removeItem("profileEmail");
            localStorage.removeItem("profilePhone");
            localStorage.removeItem("profileName");
            localStorage.removeItem("registeredMobile");
            localStorage.removeItem("selectedPaymentMethod");
            localStorage.removeItem("showGoldPopup");
            localStorage.removeItem("cookiePayPaid");
            localStorage.removeItem("orderCanceled");
            localStorage.removeItem("orderPlacedAt");
            localStorage.removeItem("orderDeliveryStatus");
            window.location.href = "N-foodloginpage.html";
        },

        // Scoped storage helpers
        key(baseKey) {
            return `${this.getUserKey()}_${baseKey}`;
        },

        getScoped(baseKey, defaultValue = null) {
            const userKey = this.getUserKey();
            if (userKey === "user_guest") {
                // If not logged in, return fallback or default
                return defaultValue;
            }
            const val = localStorage.getItem(this.key(baseKey));
            if (val === null) return defaultValue;
            try {
                return JSON.parse(val);
            } catch (e) {
                return val;
            }
        },

        setScoped(baseKey, value) {
            const userKey = this.getUserKey();
            if (userKey === "user_guest") return;
            const strValue = typeof value === "object" ? JSON.stringify(value) : String(value);
            localStorage.setItem(this.key(baseKey), strValue);
        },

        removeScoped(baseKey) {
            localStorage.removeItem(this.key(baseKey));
        },

        // Address Management
        getAddresses() {
            const list = this.getScoped("addresses", []);
            return Array.isArray(list) ? list : [];
        },

        saveAddresses(addresses, activeAddress = null) {
            const cleanList = Array.isArray(addresses) ? addresses : [];
            this.setScoped("addresses", cleanList);

            if (activeAddress) {
                this.setActiveAddress(activeAddress);
            } else if (cleanList.length > 0 && !this.getActiveAddress()) {
                this.setActiveAddress(cleanList[0].houseNo);
            } else if (cleanList.length === 0) {
                this.removeScoped("activeAddress");
            }

            // Sync with backend
            const email = this.getEmail() || this.getPhone();
            if (email) {
                fetch("/user/addresses/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: email,
                        addresses: cleanList,
                        activeAddress: this.getActiveAddress() || ""
                    })
                }).catch(err => console.warn("Failed to sync addresses to backend:", err));
            }
        },

        getActiveAddress() {
            return this.getScoped("activeAddress", null);
        },

        setActiveAddress(houseNo) {
            this.setScoped("activeAddress", houseNo);
            const email = this.getEmail() || this.getPhone();
            const addresses = this.getAddresses();
            if (email && addresses.length > 0) {
                fetch("/user/addresses/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: email,
                        addresses: addresses,
                        activeAddress: houseNo
                    })
                }).catch(err => console.warn("Failed to sync active address:", err));
            }
        },

        // Phone Numbers Management
        getPhoneNumbers() {
            let list = this.getScoped("phoneNumbers", null);
            if (list === null) {
                // If not set yet, check if user has a profile phone
                const phone = this.getPhone();
                if (phone) {
                    list = [{ number: phone }];
                    this.setScoped("phoneNumbers", list);
                } else {
                    list = [];
                }
            }
            return Array.isArray(list) ? list : [];
        },

        savePhoneNumbers(phoneNumbers, activeNumber = null) {
            const cleanList = Array.isArray(phoneNumbers) ? phoneNumbers : [];
            this.setScoped("phoneNumbers", cleanList);

            if (activeNumber) {
                this.setActivePhone(activeNumber);
            } else if (cleanList.length > 0 && !this.getActivePhone()) {
                this.setActivePhone(cleanList[0].number);
            } else if (cleanList.length === 0) {
                this.removeScoped("activeNumber");
            }

            // Sync with backend
            const email = this.getEmail() || this.getPhone();
            if (email) {
                fetch("/user/phones/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: email,
                        phoneNumbers: cleanList,
                        activeNumber: this.getActivePhone() || ""
                    })
                }).catch(err => console.warn("Failed to sync phones to backend:", err));
            }
        },

        getActivePhone() {
            let active = this.getScoped("activeNumber", null);
            if (!active) {
                const numbers = this.getPhoneNumbers();
                if (numbers.length > 0) {
                    active = numbers[0].number;
                    this.setScoped("activeNumber", active);
                }
            }
            return active;
        },

        setActivePhone(number) {
            this.setScoped("activeNumber", number);
            const email = this.getEmail() || this.getPhone();
            const phones = this.getPhoneNumbers();
            if (email && phones.length > 0) {
                fetch("/user/phones/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: email,
                        phoneNumbers: phones,
                        activeNumber: number
                    })
                }).catch(err => console.warn("Failed to sync active phone:", err));
            }
        },

        // Orders Management
        getOrders() {
            const orders = this.getScoped("orderedProducts", []);
            return Array.isArray(orders) ? orders : [];
        },

        saveOrders(orders) {
            this.setScoped("orderedProducts", Array.isArray(orders) ? orders : []);
        },

        async cancelActiveOrder() {
            this.saveOrders([]);
            this.removeScoped("orderedProducts");
            this.removeScoped("deliveryOTP");
            this.removeScoped("orderTimer");
            this.removeScoped("trackOrder");
            this.removeScoped("selectedPaymentMethod");
            this.removeScoped("deliveryBoy");
            this.removeScoped("selectedDeliveryBoy");
            this.removeScoped("orderDeliveryStatus");
            this.removeScoped("orderPlacedAt");
            this.removeScoped("storedCoupon"); // Revoke unearned coupon on cancel

            localStorage.removeItem("orderedProducts");
            localStorage.removeItem("trackOrder");
            localStorage.removeItem("deliveryOTP");
            localStorage.removeItem("orderTimer");
            localStorage.removeItem("selectedPaymentMethod");
            localStorage.removeItem("deliveryBoy");
            localStorage.removeItem("selectedDeliveryBoy");
            localStorage.removeItem("orderDeliveryStatus");
            localStorage.removeItem("orderPlacedAt");
            localStorage.removeItem("storedCoupon");
            localStorage.setItem("orderCanceled", "Your order has been cancelled successfully.");

            const email = this.getEmail() || this.getPhone();
            if (email) {
                try {
                    await fetch("/orders/cancel", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: email })
                    });
                } catch (e) {
                    console.warn("Failed to cancel order on server:", e);
                }
            }
        },

        // Coupon Management (Coupons available ONLY after delivery)
        getCoupon() {
            const coupon = this.getScoped("storedCoupon", null);
            if (coupon) return coupon;
            try {
                return JSON.parse(localStorage.getItem("storedCoupon")) || null;
            } catch {
                return null;
            }
        },

        setCoupon(coupon) {
            const data = (typeof coupon === "object" && coupon) ? coupon : null;
            this.setScoped("storedCoupon", data);
            if (data) {
                localStorage.setItem("storedCoupon", JSON.stringify(data));
            } else {
                localStorage.removeItem("storedCoupon");
            }
        },

        async markOrderDelivered() {
            // 1. Mark orders in session storage as Delivered
            let orders = this.getOrders();
            if (Array.isArray(orders) && orders.length > 0) {
                orders = orders.map(o => ({ ...o, status: "Delivered" }));
                this.saveOrders(orders);
            }

            // 2. Unlock the coupon earned from this order
            let coupon = this.getCoupon();
            if (coupon) {
                coupon.isDelivered = true;
                coupon.deliveredAt = new Date().toISOString();
                this.setCoupon(coupon);
            } else {
                coupon = {
                    imagePath: "static/zomato.png",
                    text: "Flat 20% off on your next order",
                    code: "HOTDEAL100",
                    isDelivered: true,
                    deliveredAt: new Date().toISOString()
                };
                this.setCoupon(coupon);
            }

            // 3. Set delivery flags and remove active timer/OTP/orderPlacedAt
            this.setScoped("orderDeliveryStatus", "Delivered");
            localStorage.setItem("orderDeliveryStatus", "Delivered");
            this.removeScoped("orderTimer");
            this.removeScoped("deliveryOTP");
            this.removeScoped("orderPlacedAt");
            localStorage.removeItem("orderTimer");
            localStorage.removeItem("deliveryOTP");
            localStorage.removeItem("orderPlacedAt");

            // 4. Sync with server
            const email = this.getEmail() || this.getPhone();
            if (email) {
                try {
                    await fetch("/orders/deliver", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: email })
                    });
                } catch (err) {
                    console.warn("Failed to mark order delivered on server:", err);
                }
            }
            return coupon;
        },

        isOrderDelivered() {
            const status = this.getScoped("orderDeliveryStatus", null) || localStorage.getItem("orderDeliveryStatus");
            if (status === "Delivered") return true;
            const coupon = this.getCoupon();
            if (coupon && coupon.isDelivered === true) return true;
            return false;
        },

        // Cart Management
        getCart() {
            const email = this.getEmail();
            const cartKey = `cartProducts_${email}`;
            try {
                return JSON.parse(localStorage.getItem(cartKey)) || [];
            } catch {
                return [];
            }
        },

        saveCart(cart) {
            const email = this.getEmail();
            const cartKey = `cartProducts_${email}`;
            localStorage.setItem(cartKey, JSON.stringify(Array.isArray(cart) ? cart : []));
            if (email) {
                fetch("/cart/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, cart })
                }).catch(err => console.warn("Failed to save cart to server:", err));
            }
        },

        // Sync with backend on startup or login
        async syncWithServer() {
            const email = this.getEmail();
            const phone = this.getPhone();
            if (!email && !phone) return;

            try {
                const query = email ? `email=${encodeURIComponent(email)}` : `mobile=${encodeURIComponent(phone)}`;
                const res = await fetch(`/user/profile?${query}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.user) {
                        const user = data.user;
                        const resolvedName = (user.nickName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.firstName || "").trim();
                        if (resolvedName) {
                            sessionStorage.setItem("profileName", resolvedName);
                            localStorage.setItem("profileName", resolvedName);
                        }
                        if (user.mobile) {
                            sessionStorage.setItem("profilePhone", user.mobile);
                            localStorage.setItem("profilePhone", user.mobile);
                        }
                        if (user.email) {
                            sessionStorage.setItem("profileEmail", user.email);
                            localStorage.setItem("profileEmail", user.email);
                        }

                        // Restore orders & payment & placedAt from active order if present
                        if (Array.isArray(user.orders) && user.orders.length > 0) {
                            const activeOrder = [...user.orders].reverse().find(o => o.status === "Processing" || o.status === "Pending");
                            if (activeOrder) {
                                if (activeOrder.paymentMethod) {
                                    this.setScoped("selectedPaymentMethod", activeOrder.paymentMethod);
                                    localStorage.setItem("selectedPaymentMethod", activeOrder.paymentMethod);
                                }
                                if (activeOrder.placedAt) {
                                    this.setScoped("orderPlacedAt", activeOrder.placedAt);
                                    localStorage.setItem("orderPlacedAt", activeOrder.placedAt);
                                }
                                if (Array.isArray(activeOrder.items) && activeOrder.items.length > 0) {
                                    const currentOrders = this.getOrders();
                                    if (!currentOrders || currentOrders.length === 0) {
                                        this.saveOrders(activeOrder.items);
                                        localStorage.setItem("orderedProducts", JSON.stringify(activeOrder.items));
                                    }
                                }
                            }
                        }

                        // Notify active page
                        window.dispatchEvent(new CustomEvent("userSessionUpdated", { detail: user }));

                        // Sync addresses if backend has them and client has none
                        if (Array.isArray(user.addresses) && user.addresses.length > 0) {
                            const localAddresses = this.getScoped("addresses", null);
                            if (!localAddresses || localAddresses.length === 0) {
                                this.setScoped("addresses", user.addresses);
                                if (user.activeAddress) {
                                    this.setScoped("activeAddress", user.activeAddress);
                                }
                            }
                        }

                        // Sync phones if backend has them
                        if (Array.isArray(user.phoneNumbers) && user.phoneNumbers.length > 0) {
                            const localPhones = this.getScoped("phoneNumbers", null);
                            if (!localPhones || localPhones.length === 0) {
                                this.setScoped("phoneNumbers", user.phoneNumbers);
                                if (user.activeNumber) {
                                    this.setScoped("activeNumber", user.activeNumber);
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn("Server sync skipped:", err);
            }
        }
    };

    // Auto-sync on page load if user is logged in
    document.addEventListener("DOMContentLoaded", function() {
        if (UserSession.getEmail() || UserSession.getPhone()) {
            UserSession.syncWithServer();
        }
    });

    window.UserSession = UserSession;
})(window);
