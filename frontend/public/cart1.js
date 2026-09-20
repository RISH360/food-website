function addToCart() {
    const userEmail = window.UserSession ? window.UserSession.getEmail() : (sessionStorage.getItem("profileEmail") || localStorage.getItem("profileEmail"));
    const cartKey = userEmail ? `cartProducts_${userEmail}` : `cartProducts_guest`;
    let cart = JSON.parse(localStorage.getItem(cartKey)) || [];

    const cartProduct = {
        name: name,
        price: basePrice * quantity,
        basePrice: basePrice,
        quantity: quantity,
        img: img,
        restaurant: restaurant,
        rating: rating
    };

    const existingProductIndex = cart.findIndex(p => p.name === name);
    if (existingProductIndex !== -1) {
        cart[existingProductIndex].quantity += quantity;
        cart[existingProductIndex].price = cart[existingProductIndex].basePrice * cart[existingProductIndex].quantity;
    } else {
        cart.push(cartProduct);
    }

    localStorage.setItem(cartKey, JSON.stringify(cart));
}

// Order Now Button
document.getElementById("order-now").addEventListener("click", function () {
    addToCart(); // Ensure item is added before ordering
    window.location.href = "cart.html"; // Redirect to cart page
});
