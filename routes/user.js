const express = require('express');
const router = express.Router();
const User = require('../models/User');

function isAuthenticated(role = null) {
    return function (req, res, next) {
        if (req.session.userId && req.session.user.isAdmin === role) {
            return next();
        } else {
            req.session.destroy(() => {
                res.redirect('/login');
            });
        }
    }
}

// registration 
router.get("/register", (req, res) => {
    res.render("profile/register", { title: "Register" });
});

router.post("/register", async (req, res) => {
    const { firstname, lastname, email, password } = req.body;

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
        res.redirect('/login');
    });
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
router.get("/User", isAuthenticated(false), async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).lean();
        res.render('profile/edit', { user });
    } catch (err) {
        res.status(500).send("Error fetching users.");
    }
});

// edit
router.get("/Admin/edit", isAuthenticated(true), async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).lean();
        res.render('profile/edit', { user });
    } catch (err) {
        res.status(500).send("Error fetching users.");
    }
});

// update
router.post("/profile/update", async (req, res) => { 
    const user = await User.findById(req.session.userId);
    const { firstname, lastname, email, password } = req.body;

    user.firstname = firstname;
    user.lastname = lastname;
    user.email = email;
    
    if (password && password.trim() !== "") {
        user.password = password;
    }

    await user.save();
    req.session.user = user;
    res.redirect(`/User`);
});

// delete
router.post('/profile/delete/:id', async (req, res) => {
    const userId = req.query.userId;
    await User.findByIdAndDelete(req.params.id);
    res.redirect(`/profile?userId=${userId}`);
});

module.exports = { router, isAuthenticated };