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
        res.redirect('/profile/login');
    });
});

router.get("/", isAuthenticated(), async (req, res) => {
    const isAdmin = req.session.user.isAdmin;
    res.redirect('/profile/' + (isAdmin ? 'Admin' : 'User'));
});

// working
router.get("/User", isAuthenticated(false), async(req, res) => {
    res.redirect('/profile/edit/:id');
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
    const isAdmin = req.session.user.isAdmin;
    const userId = isAdmin ? req.params.id : req.session.userId;

    try {
        const user = await User.findById(userId).lean();
        res.render('profile/edit', { user });
    } catch (err) {
        console.log(err);
    }
});

// update
router.post("/update/:id", isAuthenticated(), async (req, res) => { 
    try {
        const isAdmin = req.session.user.isAdmin;
        const userId = isAdmin ? req.params.id : req.session.userId;

        const user = await User.findById(userId);

        const { firstname, lastname, email, password } = req.body;

        user.firstname = firstname;
        user.lastname = lastname;
        user.email = email;
        
        if (password && password.trim() !== "") {
            user.password = password;
        }

        await user.save();
        
        if (!isAdmin || req.session.userId == userId) {
            req.session.user = user;
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