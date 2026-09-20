let ball = document.getElementById("ball");
let isDragging = false;
let offsetX, offsetY;

// Create message container dynamically
let message = document.createElement("div");
message.classList.add("message");
document.body.appendChild(message);

// Retrieve profile name from local storage
let savedName = localStorage.getItem("profileName") || "Guest";

function typeMessage(text, duration, callback) {
    let isAssistOn = localStorage.getItem("cookieAssist") === "on";
    if (!isAssistOn) return; // Prevent showing message when assist is off

    let index = 0;
    let tempText = "";
    message.innerHTML = ""; 
    updateMessagePosition();

    message.style.opacity = "1";
    message.style.transform = "translateY(0)";

    function typeNextLetter() {
        if (index < text.length) {
            tempText += text[index] === " " ? "&nbsp;" : text[index];
            message.innerHTML = tempText;
            index++;
            setTimeout(typeNextLetter, 40);
        } else {
            setTimeout(() => {
                message.style.opacity = "0";
                message.style.transform = "translateY(10px)";
                setTimeout(() => {
                    message.innerHTML = "";
                    if (callback) callback();
                }, 500);
            }, duration);
        }
    }

    typeNextLetter();
}


function showMessages() {
    if (!localStorage.getItem("welcomeMessageShown")) {
        typeMessage(`Welcome, ${savedName}!`, 2000, () => {
            typeMessage("I am Cookie AI, I am here to help you 😊", 2000, () => {
                setTimeout(() => {
                    typeMessage("You can't text me, but I can guess and help you! 😊", 3000, () => {
                        setTimeout(() => {
                            typeMessage("If you want me, you can double-tap me. I can guess and help you!", 4000, () => {
                                typeMessage("Try our delicious cookies! Order now in our Cookie Website", 3000, () => {
                                    checkMissingInfo();
                                    localStorage.setItem("welcomeMessageShown", "true"); // Prevent showing again
                                });
                            });
                        }, 3000);
                    });
                }, 2000);
            });
        });
    } else {
        checkMissingInfo();
    }
}

// ✅ Run check when page loads
window.onload = checkAssistStatus;


function checkMissingInfo() {
    let savedAddresses = window.UserSession ? window.UserSession.getAddresses() : (JSON.parse(localStorage.getItem("addresses")) || []);
    let activeAddress = window.UserSession ? window.UserSession.getActiveAddress() : localStorage.getItem("activeAddress");
    let savedNumbers = window.UserSession ? window.UserSession.getPhoneNumbers() : (JSON.parse(localStorage.getItem("phoneNumbers")) || []);
    let activeNumber = window.UserSession ? window.UserSession.getActivePhone() : localStorage.getItem("activeNumber");
    let currentEmail = window.UserSession ? window.UserSession.getEmail() : "";
    let savedImage = currentEmail ? localStorage.getItem(currentEmail + "_profileImage") : localStorage.getItem("profileImage");
    let savedLocations = window.UserSession ? window.UserSession.getScoped("savedAddresses", []) : (JSON.parse(localStorage.getItem("savedAddresses")) || []);
    let orderedProducts = window.UserSession ? window.UserSession.getOrders() : (JSON.parse(localStorage.getItem("orderedProducts") || "[]"));

    let hasAddress = activeAddress && savedAddresses.length > 0;
    let hasPhone = activeNumber && savedNumbers.length > 0;
    let defaultImage = "static/profileupdate.png"; // Default profile image path
    let hasProfileImage = savedImage && savedImage !== "" && savedImage !== defaultImage;
    let hasLocation = savedLocations.length > 0;
    let hasActiveOrder = orderedProducts.length > 0; // Check if there are active orders

    if (!hasAddress && !hasPhone && !hasProfileImage && !hasLocation) {
        typeMessage("Please set your profile image, address, phone number, and location in Profile or Settings.", 3000);
    } else if (!hasAddress && !hasPhone) {
        typeMessage("Please set your address and phone number in Profile or Settings Address Book", 3000);
    } else if (!hasAddress) {
        typeMessage("Please set your address in Profile or Settings Address Book", 3000);
    } else if (!hasPhone) {
        typeMessage("Please set your phone number in Profile or Settings Address Book", 3000);
    } else if (!hasLocation) {
        typeMessage("Please set your location in Profile or Settings.", 3000);
    }

    // Check if profile image is still the default image
    if (!hasProfileImage) {
        typeMessage("Please set your profile image in Profile settings.", 3000);
    }

    // ✅ Show track order message if an order is active
    if (hasActiveOrder) {
        typeMessage("Go and check out your track order, which is below (Track). Your order is on the way!", 4000);
    }
}



function updateMessagePosition() {
    let x = ball.offsetLeft;
    let y = ball.offsetTop;
    let maxX = window.innerWidth - ball.clientWidth;
    let messageWidth = message.clientWidth;

    if (x > maxX / 2) {
        let newLeft = x - messageWidth - 10;
        message.style.left = newLeft < 0 ? "10px" : newLeft + "px";
    } else {
        let newLeft = x + 70;
        message.style.left = newLeft + messageWidth > window.innerWidth 
            ? (window.innerWidth - messageWidth - 10) + "px" 
            : newLeft + "px";
    }

    message.style.top = (y - -3) + "px";
    message.style.display = "block";
}

function smoothUpdate() {
    updateMessagePosition();
    requestAnimationFrame(smoothUpdate);
}
smoothUpdate(); 

// 🟢 NEW: Check Assist Mode (ON/OFF) when page loads
function checkAssistStatus() {
    let isAssistOn = localStorage.getItem("cookieAssist") === "on";
    
    if (!isAssistOn) {
        ball.style.display = "none";
        message.style.display = "none"; // Ensure message is hidden too
    } else {
        ball.style.display = "block";
        message.style.display = "block";
        checkMissingInfo();
    }
}
// ✅ Run check when page loads
window.onload = checkAssistStatus;

// 🟢 Make ball draggable
ball.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - ball.offsetLeft;
    offsetY = e.clientY - ball.offsetTop;
    ball.style.cursor = "grabbing";
});

document.addEventListener("mousemove", (e) => {
    if (isDragging) {
        let x = e.clientX - offsetX;
        let y = e.clientY - offsetY;

        let maxY = window.innerHeight - ball.clientHeight;
        y = Math.max(0, Math.min(maxY, y));

        ball.style.top = y + "px";
        ball.style.left = x + "px";
    }
});

document.addEventListener("mouseup", () => {
    if (isDragging) {
        let maxX = window.innerWidth - ball.clientWidth;
        let x = ball.offsetLeft;

        if (x > maxX / 2) {
            ball.style.left = maxX + "px";
        } else {
            ball.style.left = "0px";
        }
    }
    isDragging = false;
    ball.style.cursor = "grab";
});

let lastTap = 0;
let isMessageActive = false; // Prevent multiple activations

ball.addEventListener("click", handleDoubleTap);
ball.addEventListener("touchend", handleDoubleTap);

function handleDoubleTap(e) {
    let currentTime = new Date().getTime();
    let tapLength = currentTime - lastTap;

    if (tapLength < 300 && tapLength > 0) { // Double-tap detected
        e.preventDefault();
        if (!isMessageActive) { // Only trigger if no message is currently active
            isMessageActive = true;
            showHelpMessages(() => {
                isMessageActive = false; // Reset after message sequence completes
            });
        }
    }

    lastTap = currentTime;
}

function typeMessage(text, duration, callback) {
    let index = 0;
    let tempText = "";
    message.innerHTML = ""; // Clear previous text
    updateMessagePosition();

    message.style.opacity = "1";
    message.style.transform = "translateY(0)";

    function typeNextLetter() {
        if (index < text.length) {
            tempText += text[index] === " " ? "&nbsp;" : text[index]; // Preserve spaces
            message.innerHTML = tempText;
            index++;
            setTimeout(typeNextLetter, 40); // Typing speed
        } else {
            setTimeout(() => {
                message.style.opacity = "0";
                message.style.transform = "translateY(10px)";
                if (callback) setTimeout(callback, 1000);
            }, duration + 1000);
        }
    }

    typeNextLetter();
}

function showHelpMessages(callback) {
    let isAssistOn = localStorage.getItem("cookieAssist") === "on";
    if (!isAssistOn) return; // ✅ Prevent messages from showing when assist is OFF

    typeMessage("Feel like you need help? Wait, let me guess!", 3000, () => {
        typeMessage("If you want to search for food easily, you can use the search bar on top.", 4000, () => {
            setTimeout(() => {
                typeMessage("If you don’t like this appearance, go to Settings > Appearance. There you can change it!", 4000, () => {
                    setTimeout(() => {
                        typeMessage("If you want to book a live concert, go to Events (below), click it, and you can book there!", 5000, () => {
                            setTimeout(() => {
                                typeMessage("If you need any help, just double-tap me! 😊", 4000, () => {
                                    setTimeout(() => {
                                        typeMessage("Or if you need more help, you can message through our Cookies customer support 💬", 5000, () => {
                                            setTimeout(() => {
                                                typeMessage("Go to Settings, click Cookie Live Support to chat with us!", 5000, () => {
                                                    setTimeout(() => {
                                                        typeMessage("If you don't want my help, just go to Settings, click Cookies Assist Help, and turn me off. 🔕", 5000, () => {
                                                            setTimeout(() => {
                                                                typeMessage("If you need any help, just turn me on! 😊", 4000, callback);
                                                            }, 3000);
                                                        });
                                                    }, 4000);
                                                });
                                            }, 4000);
                                        });
                                    }, 3000);
                                });
                            }, 3000);
                        });
                    }, 7000);
                });
            }, 5000);
        });
    });
}
// Show help message after 25 seconds of inactivity
setTimeout(() => {
    if (!isMessageActive) {
        isMessageActive = true;
        showHelpMessages(() => {
            isMessageActive = false;
        });
    }
}, 25000);

