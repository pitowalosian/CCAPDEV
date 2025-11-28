const express = require('express');
const router = express.Router();
const User = require('../models/User');

// check user role
function isAuthenticated(role = null) {
    return function (req, res, next) {
        if (!req.session.userId) {
            return res.redirect('/profile/login');
        }
        if (role !== null && req.session.user.isAdmin !== role) {
            return res.status(403).send('Forbidden');
        } 
        next();
    };
}

// registration 
router.get("/register", (req, res) => {
    res.render("profile/register", { title: "Register" });
});

router.post("/register", async (req, res) => {
    const { firstname, lastname, email, password } = req.body;

    // --- [START] SERVER-SIDE VALIDATION ---
    const errors = [];

    // Validate Name (Letters only, min 2 chars)
    const nameRegex = /^[a-zA-Z ]{2,}$/;
    if (!nameRegex.test(firstname?.trim())) errors.push("Invalid First Name");
    if (!nameRegex.test(lastname?.trim())) errors.push("Invalid Last Name");

    // Validate Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email?.trim())) errors.push("Invalid Email Address");

    // Validate Password (Min 6 chars)
    if (!password || password.length < 6) errors.push("Password must be at least 6 characters");

    if (errors.length > 0) {
        console.error("Registration Validation Failed:", errors);
        // Redirect back to register with generic error flag (or pass specific errors if your UI supports it)
        return res.redirect("/profile/register?error=true");
    }

    try {
        await User.create({ firstname, lastname, email, password });
        return res.redirect("/profile/login?registered=true");
    } catch (err) {
        console.error(err);
        return res.redirect("/profile/register?error=true");
    }
});

//login 
router.get("/login", (req, res) => {
    res.render("profile/login", { title: "Login" });
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (user && await user.comparePassword(password)) {
            req.session.userId = user._id;
            req.session.user = user;
            res.redirect('/profile/' + (user.isAdmin ? 'Admin' : 'User'));
        } else {
            res.status(401).send('Invalid login');
        }
        
    } catch (err) {
        console.error("Login error: ", err);
        return res.status(500).send("Server error");
    }
    
});

//logout
router.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect('/profile/login');
    });
});

router.get("/", isAuthenticated(), async (req, res) => {
    const isAdmin = req.session.user.isAdmin;
    res.redirect('/profile/' + (isAdmin ? 'Admin' : 'User'));
});

// working
router.get("/User", isAuthenticated(false), async(req, res) => {
    res.redirect(`/profile/edit/${req.session.userId}`);
});

// list users
router.get("/Admin", isAuthenticated(true), async (req, res) => {
    try {
        const users = await User.find().lean();
        res.render('profile/list', { title: "User Management", users });
    } catch (err) {
        res.status(500).send('Error fetching users.');
    }
});

// edit
router.get('/edit/:id', isAuthenticated(), async (req, res) => {
    try {
        const isAdmin = req.session.user.isAdmin;
        const userId = isAdmin ? req.params.id : req.session.userId;
    
        const user = await User.findById(userId).lean();

        res.render('profile/edit', { user, isAdmin });
    } catch (err) {
        console.log(err);
        res.status(500).send("Server error");
    }
});

// update
router.post("/update/:id", isAuthenticated(), async (req, res) => { 
    try {
        const isAdmin = req.session.user.isAdmin;
        const userId = isAdmin ? req.params.id : req.session.userId;
        const { firstname, lastname, email, password } = req.body;

        // SERVER-SIDE VALIDATION
        const errors = [];
        const nameRegex = /^[a-zA-Z ]{2,}$/;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!nameRegex.test(firstname?.trim())) errors.push("Invalid First Name");
        if (!nameRegex.test(lastname?.trim())) errors.push("Invalid Last Name");
        if (!emailRegex.test(email?.trim())) errors.push("Invalid Email Address");

        // Only validate password if the user is trying to change it
        if (password && password.trim() !== "") {
            if (password.length < 6) errors.push("Password must be at least 6 characters");
        }

        if (errors.length > 0) {
            console.error("Update Validation Failed:", errors);
            // In a real app, you'd want to render the edit page with errors. 
            // Here we redirect to keep it simple as requested.
            return res.redirect(`/profile/`); 
        }

        const user = await User.findById(userId);

        user.firstname = firstname;
        user.lastname = lastname;
        user.email = email;
        
        if (password && password.trim() !== "") {
            user.password = password;
        }

        await user.save();
        
        if (req.session.userId == userId) {
            req.session.user = user.toObject();
        }

        return res.redirect(`/profile/`);
    } catch (err) {
        console.log(err);
    }
});

// delete
router.post('/delete/:id', isAuthenticated(), async (req, res) => {
    const isAdmin = req.session.user.isAdmin;
    const userId = isAdmin ? req.params.id : req.session.userId;

    try {
        await User.findByIdAndDelete(userId);
        if (isAdmin) {
            res.redirect(`/profile/Admin`);
        } else {
            res.redirect(`/profile/login`)
        }
    } catch (err) {
        console.log(err);
    }
});

module.exports = { router, isAuthenticated };