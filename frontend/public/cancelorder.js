function cancelOrder() {
    // Check if a popup already exists and remove it
    let existingPopup = document.getElementById("cancelPopup");
    if (existingPopup) {
        document.body.removeChild(existingPopup);
    }

    // Create a new popup
    let cancelPopup = document.createElement("div");
    cancelPopup.id = "cancelPopup";
    cancelPopup.style.position = "fixed";
    cancelPopup.style.top = "50%";
    cancelPopup.style.left = "50%";
    cancelPopup.style.transform = "translate(-50%, -50%)";
    cancelPopup.style.background = "white";
    cancelPopup.style.padding = "20px";
    cancelPopup.style.boxShadow = "0px 4px 6px rgba(0, 0, 0, 0.2)";
    cancelPopup.style.borderRadius = "10px";
    cancelPopup.style.width = "90%";
    cancelPopup.style.maxWidth = "400px";
    cancelPopup.style.textAlign = "center";
    cancelPopup.style.zIndex = "1000";
    
    // Set popup content
    cancelPopup.innerHTML = `
        <h3 style="color: red;">CANCELLATION POLICY</h3>
        <p>Help us to reduce food waste by avoiding cancellations.</p>
        <p><strong>The amount paid is non-refundable after placing the order.</strong></p>
        <p>Please avoid cancellation due to food wastage.</p>
        <button id="confirmCancel" style="background: red; color: white; padding: 10px; border: none; border-radius: 5px; cursor: pointer; margin-top: 10px;">Confirm Order Cancel</button>
        <br><br>
        <button id="closePopup" style="background: gray; color: white; padding: 5px 10px; border: none; border-radius: 5px; cursor: pointer;">Close</button>
    `;

    document.body.appendChild(cancelPopup);

    // Close popup button
    document.getElementById("closePopup").addEventListener("click", function() {
        document.body.removeChild(cancelPopup);
    });

    // Confirm cancellation
    document.getElementById("confirmCancel").addEventListener("click", async function() {
        document.body.removeChild(cancelPopup);
        
        if (window.UserSession && typeof window.UserSession.cancelActiveOrder === "function") {
            await window.UserSession.cancelActiveOrder();
        } else {
            if (window.UserSession) {
                window.UserSession.saveOrders([]);
            }
            localStorage.removeItem("orderedProducts");
            localStorage.removeItem("trackOrder");
            localStorage.removeItem("deliveryOTP");
            localStorage.removeItem("orderTimer");
            localStorage.removeItem("selectedPaymentMethod");
            localStorage.removeItem("deliveryBoy");
            localStorage.removeItem("selectedDeliveryBoy");
            localStorage.removeItem("orderPlacedAt");
            localStorage.setItem("orderCanceled", "Your order has been cancelled successfully.");
        }

        // Redirect to Track Order page
        window.location.href = "trackorder.html";
    });
}

// Show cancellation message if order was canceled
document.addEventListener("DOMContentLoaded", () => {
    let trackOrderContainer = document.getElementById("track-order-container");
    let canceledMessage = localStorage.getItem("orderCanceled");

    if (canceledMessage) {
        trackOrderContainer.innerHTML = `<h2>${canceledMessage}</h2>`;
        localStorage.removeItem("orderCanceled"); // Remove message after displaying once
    }
});