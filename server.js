import multer from 'multer';
import { v4 as uuidv4 } from "uuid"; // add this at the top of your file
import express from "express";
import bodyParser from "body-parser";
import bcrypt from "bcryptjs";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
let file = path.join(__dirname, "db.json");

if (isVercel) {
    file = path.join("/tmp", "db.json");
    if (!fs.existsSync(file)) {
        try {
            const seed = path.join(__dirname, "db.json");
            if (fs.existsSync(seed)) {
                fs.copyFileSync(seed, file);
            } else {
                fs.writeFileSync(file, JSON.stringify({ users: [] }));
            }
        } catch (e) {
            console.warn("Failed to initialize /tmp/db.json:", e);
        }
    }
}

const adapter = new JSONFile(file);
const db = new Low(adapter, { users: [] });

async function initDB() {
    try {
        await db.read();
        db.data ||= { users: [] };
        await db.write();
    } catch (err) {
        console.warn("initDB write failed (e.g. read-only filesystem):", err);
    }
}
initDB();

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = isVercel ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadPath)) {
        try {
          fs.mkdirSync(uploadPath, { recursive: true });
        } catch (e) {
          console.warn("Failed to create upload dir:", e);
        }
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueName = uuidv4() + path.extname(file.originalname); // Unique file name
      cb(null, uniqueName); // Set file name
    }
  });
  
  const upload = multer({ storage });
  

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // ✅ Add this line
app.use(express.static(path.join(__dirname, "frontend", "public", "static")));

// Serve static files (uploads folder for profile pictures)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));



// 👇 Your existing routes (signup, login, etc.) can be copied here unchanged,
// just make sure the entire file uses `import` syntax instead of `require()`

// Signup Route
app.post("/signup", async (req, res) => {
    const { firstName, lastName, nickName, email, mobile } = req.body;

    if (!firstName || !lastName || !nickName || !email || !mobile) {
        return res.status(400).send("All fields are required");
    }

    await db.read();

    // Normalize values
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedMobile = mobile.trim().replace(/^0+/, "");

    const emailExists = db.data.users.find(
        u => u.email?.trim().toLowerCase() === normalizedEmail
    );

    const mobileExists = db.data.users.find(
        u => u.mobile?.trim().replace(/^0+/, "") === normalizedMobile
    );

    if (emailExists) {
        return res.status(409).send("Email is already registered");
    }

    if (mobileExists) {
        return res.status(409).send("Mobile number is already registered");
    }

    db.data.users.push({
        firstName,
        lastName,
        nickName,
        email: normalizedEmail,
        mobile: normalizedMobile
    });
    await db.write();

    res.status(200).send("User data saved");
});

// Confirm Password Route
app.post("/confirm-password", async (req, res) => {
    const { email, password } = req.body;

    if (!password) return res.status(400).send("Password is required");

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.read();
    let user;
    if (email) {
        const normalizedEmail = email.trim().toLowerCase();
        user = db.data.users.find(u => u.email?.trim().toLowerCase() === normalizedEmail);
    }
    if (!user && db.data.users.length > 0) {
        user = db.data.users[db.data.users.length - 1];
    }

    if (!user) return res.status(400).send("No user found");

    user.password = hashedPassword;
    await db.write();

    res.status(200).send("Password saved");
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).send("Email or mobile and password are required");
    }

    await db.read();

    const normalizedInput = email.trim().toLowerCase();
    const user = db.data.users.find(u =>
        u.email?.trim().toLowerCase() === normalizedInput ||
        u.mobile?.trim() === normalizedInput
    );

    if (!user || !user.password) {
        return res.status(401).send("Invalid email/mobile or password");
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
        return res.status(401).send("Invalid email/mobile or password");
    }

    const displayName = user.nickName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.firstName || "User";
    return res.status(200).json({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        nickName: displayName,
        email: user.email || "",
        mobile: user.mobile || "",
        orders: user.orders || []
    });
});


app.post("/verify-user", async (req, res) => {
    let { email, mobile } = req.body;

    // Normalize input
    email = email?.trim().toLowerCase();
    mobile = mobile?.trim().replace(/^0+/, ""); // Remove leading 0s

    await db.read();

    const user = db.data.users.find(u => {
        const dbEmail = u.email?.trim().toLowerCase();
        const dbMobile = u.mobile?.trim().replace(/^0+/, "");
        return dbEmail === email || dbMobile === mobile;
    });

    if (!user) {
        return res.status(404).send("User not found");
    }

    res.status(200).send("User verified");
});

// Register Mobile Number Route
app.post("/register-mobile", async (req, res) => {
    const { mobile } = req.body;

    if (!mobile || !/^\d{10}$/.test(mobile)) {
        return res.status(400).json({ success: false, message: "Please enter a valid 10-digit mobile number." });
    }

    await db.read();

    // Check if mobile number already exists in the database
    const existingUser = db.data.users.find(user => user.mobile === mobile);

    if (existingUser) {
        const displayName = existingUser.nickName || [existingUser.firstName, existingUser.lastName].filter(Boolean).join(" ") || existingUser.firstName || "User";
        return res.status(200).json({
            success: true,
            isExistingUser: true,
            message: "Mobile verified successfully!",
            user: {
                firstName: existingUser.firstName || "",
                lastName: existingUser.lastName || "",
                nickName: displayName,
                email: existingUser.email || "",
                mobile: existingUser.mobile,
                orders: existingUser.orders || []
            }
        });
    }

    // Add the mobile number to db.json
    const newUser = {
        firstName: "New",
        lastName: "User",
        nickName: "newuser",
        email: "",
        mobile: mobile,
        password: "",
        cart: [],
        orders: [],
        addresses: [],
        phoneNumbers: [{ number: mobile }],
        activeNumber: mobile
    };

    db.data.users.push(newUser);
    await db.write();

    res.status(200).json({
        success: true,
        isExistingUser: false,
        message: "Mobile number registered successfully!"
    });
});

app.post("/update-user-details", async (req, res) => {
    const { mobile, firstName, lastName, nickname } = req.body;

    if (!mobile || !firstName || !lastName || !nickname) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }

    await db.read();
    const user = db.data.users.find(u => u.mobile === mobile);

    if (!user) {
        return res.status(404).json({ success: false, message: "User not found." });
    }

    // Update user fields
    user.firstName = firstName;
    user.lastName = lastName;
    user.nickName = nickname;

    await db.write();

    res.json({ success: true, message: "User details updated." });
});

app.post("/confirm-password-mobile", async (req, res) => {
    const { mobile, password } = req.body;

    if (!mobile || !password) {
        return res.status(400).json({ success: false, message: "Mobile number and password are required." });
    }

    await db.read();
    const user = db.data.users.find(user => user.mobile === mobile);

    if (!user) {
        return res.status(404).json({ success: false, message: "User not found." });
    }

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;

    await db.write();
    res.status(200).json({ success: true, message: "Password saved successfully." });
});

app.post("/reset-password", async (req, res) => {
    const { email, mobile, newPassword } = req.body;

    if (!newPassword) return res.status(400).send("Password is required");

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.read();
    const user = db.data.users.find(
        (u) => u.email === email || u.mobile === mobile
    );

    if (!user) return res.status(404).send("User not found");

    user.password = hashedPassword;
    await db.write();

    res.status(200).send("Password updated successfully");
});

app.post("/update-nickname", async (req, res) => {
    const { email, mobile, newNickname } = req.body;

    if (!newNickname) {
        return res.status(400).send("New nickname required");
    }

    await db.read();
    const normalizedEmail = (email || "").trim().toLowerCase();
    const normalizedMobile = (mobile || "").trim();

    const user = db.data.users.find(u =>
        (normalizedEmail && u.email?.trim().toLowerCase() === normalizedEmail) ||
        (normalizedMobile && u.mobile?.trim() === normalizedMobile)
    );

    if (!user) {
        return res.status(404).send("User not found");
    }

    user.nickName = newNickname.trim();
    await db.write();

    res.send("Nickname updated successfully");
});

app.post("/update-email", async (req, res) => {
    const { oldEmail, newEmail, mobile } = req.body;

    if (!newEmail) {
        return res.status(400).send("New email required");
    }

    await db.read();

    const normalizedOld = (oldEmail || "").trim().toLowerCase();
    const normalizedNew = newEmail.trim().toLowerCase();
    const normalizedMobile = (mobile || "").trim();

    const user = db.data.users.find(u =>
        (normalizedOld && u.email?.trim().toLowerCase() === normalizedOld) ||
        (normalizedMobile && u.mobile?.trim() === normalizedMobile)
    );

    if (!user) {
        return res.status(404).send("User not found");
    }

    // Prevent duplicate email
    const exists = db.data.users.find(u =>
        u !== user && u.email?.trim().toLowerCase() === normalizedNew
    );
    if (exists) {
        return res.status(409).send("New email already exists");
    }

    user.email = normalizedNew;
    await db.write();

    res.status(200).send("Email updated successfully");
});

app.post("/update-mobile", async (req, res) => {
    const { email, newMobile, oldMobile } = req.body;

    if (!newMobile) {
        return res.status(400).send("New mobile is required");
    }

    await db.read();
    const normalizedEmail = (email || "").trim().toLowerCase();
    const normalizedOldMobile = (oldMobile || "").trim();

    const user = db.data.users.find(u =>
        (normalizedEmail && u.email?.trim().toLowerCase() === normalizedEmail) ||
        (normalizedOldMobile && u.mobile?.trim() === normalizedOldMobile)
    );

    if (!user) {
        return res.status(404).send("User not found");
    }

    user.mobile = newMobile.trim();
    user.activeNumber = newMobile.trim();
    user.phoneNumbers ||= [];
    if (!user.phoneNumbers.some(p => p.number === user.mobile)) {
        user.phoneNumbers.unshift({ number: user.mobile });
    }
    await db.write();

    res.status(200).send("Mobile updated successfully");
});


// Endpoint to upload profile picture
app.post('/upload-profile-pic', upload.single('profilePic'), async (req, res) => {
    const { email } = req.body;
    const profilePicPath = req.file ? `/uploads/${req.file.filename}` : null;
  
    if (!email || !profilePicPath) {
      return res.status(400).send('Invalid data');
    }
  
    // Read DB and update user profile picture
    await db.read();
    const user = db.data.users.find(u => u.email === email);
    
    if (!user) {
      return res.status(404).send('User not found');
    }
  
    user.profilePic = profilePicPath; // Store profile picture path in DB
    await db.write();
  
    res.status(200).json({ message: 'Profile picture uploaded successfully', profilePic: profilePicPath });
  });
  
  // Example of how to serve the profile picture
  app.get('/profile-pic/:email', async (req, res) => {
    const { email } = req.params;
    await db.read();
  
    const user = db.data.users.find(u => u.email === email);
    if (!user || !user.profilePic) {
      return res.status(404).send('Profile picture not found');
    }
  
    res.status(200).json({ profilePic: user.profilePic });
  });

  

app.post("/delete-account", async (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).send("Email is required");

    await db.read(); // ✅ Read latest data from db.json

    const user = db.data.users.find(u => u.email === email);

    if (user) {
        db.data.users = db.data.users.filter(u => u.email !== email);
        await db.write(); // ✅ Save updated data back to db.json
        res.status(200).send("Account deleted");
    } else {
        res.status(404).send("User not found");
    }
});

app.post("/cart/save", async (req, res) => {
    const { email, cart } = req.body;

    if (!email || !Array.isArray(cart)) {
        return res.status(400).send("Invalid data: Missing email or cart");
    }

    const invalidItems = cart.filter(item => !item.name || !item.price || !item.quantity);
    if (invalidItems.length > 0) {
        return res.status(400).send("Invalid cart item(s): Missing required fields");
    }

    try {
        await db.read();
        const user = db.data.users.find(
            u => u.email?.trim().toLowerCase() === email.trim().toLowerCase()
        );

        if (!user) {
            return res.status(404).send("User not found");
        }

        // ✅ Add or update cart array
        user.cart = cart;
        await db.write();

        res.status(200).send("Cart saved successfully");
    } catch (error) {
        console.error("❌ Error saving cart to database:", error);
        res.status(500).send("Internal server error");
    }
});

async function saveCartToServer(email, cart) {
    try {
        const res = await fetch("/cart/save", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, cart })
        });

        if (res.ok) {
            const message = await res.text();
            console.log("✅", message);
        } else {
            const errorMessage = await res.text();
            console.error("❌ Error saving cart:", errorMessage);
        }
    } catch (err) {
        console.error("❌ Error saving cart:", err);
    }
}

app.post("/orders/place", async (req, res) => {
    const email = req.session?.email || req.body.email;  // fallback to body email if session not set
    const { cart } = req.body;

    if (!email || !Array.isArray(cart) || cart.length === 0) {
        return res.status(400).send("Invalid request data");
    }

    for (const item of cart) {
        if (!item.name || typeof item.price !== "number" || typeof item.quantity !== "number") {
            return res.status(400).send("Invalid item data in cart");
        }
    }

    await db.read();
    const user = db.data.users.find(u => u.email === email);
    if (!user) return res.status(404).send("User not found");

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const order = {
        id: "ORD" + uuidv4().replace(/-/g, "").slice(0, 10).toUpperCase(),
        items: cart,
        total,
        paymentMethod: req.body.paymentMethod || "Cash on Delivery",
        status: "Processing",
        placedAt: req.body.placedAt || new Date().toISOString()
    };

    user.orders ||= [];
    user.orders.push(order);
    user.cart = [];

    // ✅ Cookie Pay Cashback logic
    if (user.premium === true) {
        const cashback = total * 0.1; // 10% cashback
        user.cookiePay ||= 0;
        user.cookiePay += cashback;
        order.cashback = cashback; // optional: store cashback in order
    }

    await db.write();
    res.status(200).json({ message: "Order placed", orderId: order.id });
});



// Route to get all orders for a user (GET request is more appropriate)
app.get("/orders/get", async (req, res) => {
    const { email } = req.query;  // Use query parameter for GET request

    if (!email) return res.status(400).send("Email required");

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).send("Invalid email format");
    }

    await db.read();
    const user = db.data.users.find(u => u.email === email);
    if (!user) return res.status(404).send("User not found");

    const orders = user.orders || [];
    res.status(200).json({ orders });
});

app.get("/orders/status", async (req, res) => {
    const { email, orderId } = req.query;

    await db.read();
    const user = db.data.users.find(u => u.email === email);
    if (!user || !user.orders) return res.status(404).send("User or orders not found");

    const order = user.orders.find(o => o.id === orderId);
    if (!order) return res.status(404).send("Order not found");

    res.status(200).json({ status: order.status });
});

// Route to cancel active order for a user
app.post("/orders/cancel", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email required" });

    await db.read();
    const normalizedEmail = email.trim().toLowerCase();
    const user = db.data.users.find(u =>
        u.email?.trim().toLowerCase() === normalizedEmail ||
        u.mobile?.trim() === normalizedEmail
    );

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (Array.isArray(user.orders) && user.orders.length > 0) {
        user.orders.forEach(order => {
            if (order.status === "Processing" || order.status === "Pending") {
                order.status = "Cancelled";
                order.cancelledAt = new Date().toISOString();
            }
        });
        await db.write();
    }

    res.status(200).json({ success: true, message: "Order cancelled successfully" });
});

// Route to mark active order as delivered for a user
app.post("/orders/deliver", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email required" });

    await db.read();
    const normalizedEmail = email.trim().toLowerCase();
    const user = db.data.users.find(u =>
        u.email?.trim().toLowerCase() === normalizedEmail ||
        u.mobile?.trim() === normalizedEmail
    );

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (Array.isArray(user.orders) && user.orders.length > 0) {
        user.orders.forEach(order => {
            if (order.status === "Processing" || order.status === "Pending") {
                order.status = "Delivered";
                order.deliveredAt = new Date().toISOString();
            }
        });
        await db.write();
    }

    res.status(200).json({ success: true, message: "Order marked as delivered successfully" });
});

// Endpoint to fetch full profile and isolated data for the active user
app.get("/user/profile", async (req, res) => {
    const { email, mobile } = req.query;
    if (!email && !mobile) {
        return res.status(400).json({ success: false, message: "Email or mobile required" });
    }

    await db.read();
    const normalizedEmail = email ? email.trim().toLowerCase() : "";
    const user = db.data.users.find(u =>
        (normalizedEmail && u.email?.trim().toLowerCase() === normalizedEmail) ||
        (mobile && u.mobile?.trim() === mobile.trim())
    );

    if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
    }

    const displayName = user.nickName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.firstName || "User";
    res.status(200).json({
        success: true,
        user: {
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            nickName: displayName,
            email: user.email || "",
            mobile: user.mobile || "",
            profilePic: user.profilePic || "",
            addresses: user.addresses || [],
            phoneNumbers: user.phoneNumbers || (user.mobile ? [{ number: user.mobile }] : []),
            activeAddress: user.activeAddress || (user.addresses && user.addresses[0] ? user.addresses[0].houseNo : ""),
            activeNumber: user.activeNumber || user.mobile || "",
            cookiePay: user.cookiePay || 0,
            premium: user.premium || false,
            orders: user.orders || []
        }
    });
});

// Endpoint to save addresses for a specific user
app.post("/user/addresses/save", async (req, res) => {
    const { email, addresses, activeAddress } = req.body;
    if (!email || !Array.isArray(addresses)) {
        return res.status(400).json({ success: false, message: "Email and addresses array required" });
    }

    await db.read();
    const normalizedEmail = email.trim().toLowerCase();
    const user = db.data.users.find(u => u.email?.trim().toLowerCase() === normalizedEmail || u.mobile?.trim() === normalizedEmail);
    if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
    }

    user.addresses = addresses;
    if (activeAddress !== undefined) {
        user.activeAddress = activeAddress;
    }
    await db.write();

    res.status(200).json({ success: true, message: "Addresses saved", addresses: user.addresses, activeAddress: user.activeAddress });
});

// Endpoint to save phone numbers for a specific user
app.post("/user/phones/save", async (req, res) => {
    const { email, phoneNumbers, activeNumber } = req.body;
    if (!email || !Array.isArray(phoneNumbers)) {
        return res.status(400).json({ success: false, message: "Email and phone numbers array required" });
    }

    await db.read();
    const normalizedEmail = email.trim().toLowerCase();
    const user = db.data.users.find(u => u.email?.trim().toLowerCase() === normalizedEmail || u.mobile?.trim() === normalizedEmail);
    if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
    }

    user.phoneNumbers = phoneNumbers;
    if (activeNumber !== undefined) {
        user.activeNumber = activeNumber;
    }
    await db.write();

    res.status(200).json({ success: true, message: "Phone numbers saved", phoneNumbers: user.phoneNumbers, activeNumber: user.activeNumber });
});

// Endpoint for reverse geocoding (coordinates to structured address)
app.get("/api/reverse-geocode", async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
        return res.status(400).json({ success: false, message: "Latitude and longitude required" });
    }

    // 1. Try OpenStreetMap Nominatim with proper headers
    try {
        const osmUrl = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json&addressdetails=1`;
        const osmRes = await fetch(osmUrl, {
            headers: {
                "User-Agent": "FoodDeliveryApp/1.0 (support@fooddelivery.local)",
                "Accept-Language": "en"
            }
        });

        if (osmRes.ok) {
            const data = await osmRes.json();
            const addr = data.address || {};
            const city = addr.city || addr.town || addr.village || addr.city_district || addr.suburb || addr.county || "";
            const state = addr.state || addr.province || addr.state_district || "";
            const pincode = addr.postcode || "";
            const houseNo = addr.house_number || addr.building || "";
            const roadName = [addr.house_number, addr.road, addr.neighbourhood, addr.suburb].filter(Boolean).join(", ") || addr.road || addr.suburb || addr.display_name || "";

            return res.json({
                success: true,
                address: {
                    city,
                    state,
                    pincode,
                    roadName,
                    houseNo,
                    displayName: data.display_name || ""
                }
            });
        }
    } catch (err) {
        console.warn("Nominatim geocode skipped:", err.message);
    }

    // 2. Fallback to BigDataCloud
    try {
        const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`;
        const bdcRes = await fetch(bdcUrl);
        if (bdcRes.ok) {
            const bdcData = await bdcRes.json();
            return res.json({
                success: true,
                address: {
                    city: bdcData.city || bdcData.locality || "",
                    state: bdcData.principalSubdivision || "",
                    pincode: bdcData.postcode || "",
                    roadName: [bdcData.locality, bdcData.city].filter(Boolean).join(", "),
                    houseNo: "",
                    displayName: bdcData.localityInfo?.informative?.[0]?.name || ""
                }
            });
        }
    } catch (err) {
        console.warn("BigDataCloud geocode skipped:", err.message);
    }

    res.status(500).json({ success: false, message: "Reverse geocoding failed" });
});

// Endpoint for IP-based location detection (fallback when GPS is denied/unavailable)
app.get("/api/detect-ip-location", async (req, res) => {
    try {
        const ipRes = await fetch("https://ipwho.is/");
        if (ipRes.ok) {
            const data = await ipRes.json();
            if (data.success !== false) {
                return res.json({
                    success: true,
                    location: {
                        city: data.city || "",
                        state: data.region || "",
                        pincode: data.postal || "",
                        latitude: data.latitude,
                        longitude: data.longitude,
                        roadName: data.city ? `${data.city} Area` : "",
                        houseNo: ""
                    }
                });
            }
        }
    } catch (err) {
        console.warn("ipwho.is skipped:", err.message);
    }

    // Secondary IP fallback
    try {
        const ipRes2 = await fetch("https://ipapi.co/json/");
        if (ipRes2.ok) {
            const data2 = await ipRes2.json();
            return res.json({
                success: true,
                location: {
                    city: data2.city || "",
                    state: data2.region || "",
                    pincode: data2.postal || "",
                    latitude: data2.latitude,
                    longitude: data2.longitude,
                    roadName: data2.city ? `${data2.city} Area` : "",
                    houseNo: ""
                }
            });
        }
    } catch (err) {
        console.warn("ipapi.co skipped:", err.message);
    }

    res.status(500).json({ success: false, message: "IP location detection failed" });
});

// Serve static files from the correct folder
app.use(express.static(path.join(__dirname, "frontend", "public")));

// Serve index.html at root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "public", "index.html"));
});


// Start server
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
  });
}

export default app;
