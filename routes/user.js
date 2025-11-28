const express = require('express');
const router = express.Router();
const User = require('../models/User');
const logger = require('../utils/logger');

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
    res.render("profile/register", { title: "Register", status: req.query.status });
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
        logger.error(`Registration Validation Failed: ${errors.join(", ")}`);
        return res.redirect("/profile/register?status=error");
    }

    try {
        await User.create({ firstname, lastname, email, password });
        logger.action(`New user ${email} registered.`);
        return res.redirect("/profile/login?status=added");
    } catch (err) {
        logger.error(`Failed to register user: ${err.message}`);
        return res.redirect("/profile/register?status=error");
    }
});

//login 
router.get("/login", (req, res) => {
    res.render("profile/login", { title: "Login", status: req.query.status });
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (user) {
            if (await user.comparePassword(password)) {
                req.session.userId = user._id;
                req.session.user = user;
                logger.action(`User ${email} logged in.`);
                res.redirect('/profile/' + (user.isAdmin ? 'Admin' : 'User'));
            } else {
                logger.error(`Login failed (incorrect password): ${email}.`);
                res.redirect('/profile/login?status=error');
            }
        } else {
            logger.error(`Login failed (email not found): ${email}.`)
            res.redirect('/profile/login?status=error');
        }
    } catch (err) {
        logger.error(`Login error: ${err.message}`);
        return res.status(500).send("Server error");
    }
});

//logout
router.get("/logout", (req, res) => {
    const email = req.session.user?.email ?? "unknown";

    logger.action(`User ${email} logged out.`);

    req.session.destroy(() => {
        res.redirect('/profile/login');
    });
});

router.get("/", isAuthenticated(), async (req, res) => {
    const isAdmin = req.session.user.isAdmin;
    res.redirect('/profile/' + (isAdmin ? 'Admin' : 'User'));
});

// show profile edit
router.get("/User", isAuthenticated(false), async(req, res) => {
    res.redirect(`/profile/edit/${req.session.userId}`);
});

// list users
router.get("/Admin", isAuthenticated(true), async (req, res) => {
    try {
        const users = await User.find().lean();
        res.render('profile/list', { title: "User Management", users, status: req.query.status });
    } catch (err) {
        res.status(500).send('Error fetching users.');
    }
});

// edit profile
router.get('/edit/:id', isAuthenticated(), async (req, res) => {
    try {
        const isAdmin = req.session.user.isAdmin;
        const userId = isAdmin ? req.params.id : req.session.userId;
    
        const user = await User.findById(userId).lean();

        res.render('profile/edit', { user, isAdmin, status: req.query.status });
    } catch (err) {
        console.log(err);
        res.status(500).send("Server error");
    }
});

// update
router.post("/update/:id", isAuthenticated(), async (req, res) => { 
    try {
        const isAdmin = req.session.user.isAdmin;
        const sessionUser = req.session.user;
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
            logger.error(`Update Validation Failed: ${errors.join(", ")}`);
            return res.redirect(`/profile/edit/${userId}?status=error`); 
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

        if (isAdmin && req.session.userId !== userId) {
            logger.action(`Admin ${sessionUser.email} updated user ${email}.`);
        } else {
            logger.action(`User ${email} updated their profile.`);
        }

        res.redirect(`/profile/edit/${userId}?status=success`)
    } catch (err) {
        logger.error(`Update error: ${err.message}`);
        res.redirect(`/profile/edit/${userId}?status=error`)
    }
});

// delete
router.post('/delete/:id', isAuthenticated(), async (req, res) => {
    const isAdmin = req.session.user.isAdmin;
    const sessionUser = req.session.user;
    const userId = isAdmin ? req.params.id : req.session.userId;

    try {
        const user = await User.findById(userId);
        await User.findByIdAndDelete(userId);
        if (isAdmin && req.session.userId !== userId) {
            logger.action(`Admin ${sessionUser.email} deleted user ${user.email}.`);
            return res.redirect(`/profile/Admin?status=deleted`);
        }

        logger.action(`User ${user.email} deleted their account.`);
        req.session.destroy(() => {
            res.redirect("/profile/login?status=deleted");
        });
    } catch (err) {
        logger.error(`Delete error: ${err.message}`);
        res.redirect(`/profile/${isAdmin ? 'Admin' : 'User'}?status=deleteError`);
    }
});

module.exports = { router, isAuthenticated };