
document.addEventListener("DOMContentLoaded", function() {
    const locationInput = document.getElementById("locationInput");
    const locationDropdown = document.getElementById("locationDropdown");
    const locationList = document.getElementById("locationList");
    const addLocationBtn = document.getElementById("addLocationBtn");
    const clearLocationsBtn = document.getElementById("clearLocationsBtn");

    // Load saved locations scoped to current user
    let savedLocations = window.UserSession ? window.UserSession.getScoped("savedAddresses", []) : (JSON.parse(localStorage.getItem("savedAddresses")) || []);

    function updateLocationDropdown() {
        locationList.innerHTML = ""; // Clear existing locations

        if (savedLocations.length === 0) {
            locationList.innerHTML = "<li>No saved locations</li>";
        } else {
            savedLocations.forEach(location => {
                const li = document.createElement("li");
                li.textContent = location;
                li.addEventListener("click", function() {
                    locationInput.value = location;
                    locationDropdown.style.display = "none";
                });
                locationList.appendChild(li);
            });
        }
    }

    // Show dropdown when clicking input
    locationInput.addEventListener("focus", function() {
        locationDropdown.style.display = "block";
    });

    // Hide dropdown when clicking outside
    document.addEventListener("click", function(event) {
        if (!locationDropdown.contains(event.target) && event.target !== locationInput) {
            locationDropdown.style.display = "none";
        }
    });

    // Add new location
    addLocationBtn.addEventListener("click", function() {
        const newLocation = locationInput.value.trim();
        if (newLocation && !savedLocations.includes(newLocation)) {
            savedLocations.push(newLocation);
            if (window.UserSession) {
                window.UserSession.setScoped("savedAddresses", savedLocations);
            } else {
                localStorage.setItem("savedAddresses", JSON.stringify(savedLocations));
            }
            updateLocationDropdown();
        }
    });

    // Clear all locations
    clearLocationsBtn.addEventListener("click", function() {
        savedLocations = [];
        if (window.UserSession) {
            window.UserSession.setScoped("savedAddresses", savedLocations);
        } else {
            localStorage.setItem("savedAddresses", JSON.stringify(savedLocations));
        }
        updateLocationDropdown();
    });

    updateLocationDropdown(); // Load locations once when the page loads
});

