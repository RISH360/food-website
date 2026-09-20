document.addEventListener("DOMContentLoaded", function () {
    const loginButton = document.querySelector(".button");
    const emailInput = document.querySelector("input[type='email']");
    const passwordInput = document.querySelector("input[type='password']");
    const emailError = document.getElementById("emailError");
    const passwordError = document.getElementById("passwordError");
    const loadingScreen = document.getElementById("loading-screen");

    async function validateAndLogin(event) {
        event.preventDefault();

        emailError.textContent = "";
        passwordError.textContent = "";

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email) {
            emailError.textContent = "Email is required";
            emailError.style.color = "red";
            return;
        }
        if (!password) {
            passwordError.textContent = "Password is required";
            passwordError.style.color = "red";
            return;
        }

        loadingScreen.classList.remove("hidden");

        try {
            const response = await fetch("/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            if (response.ok) {
                const result = await response.json();

                // ✅ Save data via UserSession to ensure account isolation
                if (window.UserSession) {
                    window.UserSession.setUser(result);
                } else {
                    sessionStorage.setItem("profileName", result.nickName);
                    sessionStorage.setItem("profileEmail", result.email);
                    sessionStorage.setItem("profilePhone", result.mobile);
                    localStorage.setItem("profileName", result.nickName);
                    localStorage.setItem("profileEmail", result.email);
                    localStorage.setItem("profilePhone", result.mobile);
                }

                setTimeout(() => {
                    window.location.href = "N-foodinterfacepage.html";
                }, 600);
            } else {
                const result = await response.text();
                passwordError.textContent = result;
                passwordError.style.color = "red";
                loadingScreen.classList.add("hidden");
            }
        } catch (err) {
            passwordError.textContent = "Server error. Try again later.";
            passwordError.style.color = "red";
            loadingScreen.classList.add("hidden");
        }
    }

    loginButton.addEventListener("click", validateAndLogin);
});
