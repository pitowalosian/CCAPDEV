const express = require('express');
const path = require('path');
const exphbs = require('express-handlebars');
const Flight = require('./models/Flight');
const Reservation = require('./models/Reservation');
const User = require("./models/User");
const shortid = require('shortid');
const mongoose = require('mongoose');
const session = require("express-session");
const Handlebars = require('handlebars');
const { router: userRoutes } = require('./routes/user');
const flightRoutes = require('./routes/flight');
const reservationRoutes = require('./routes/reservation');
const { isAuthenticated } = require('./routes/user');

const app = express();
const PORT = 3000;

mongoose.connect('mongodb://127.0.0.1:27017/flightdb')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error: ', err));

// Set up Handlebars as the view engine
app.engine('handlebars', exphbs.engine({}));
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse URL-encoded bodies (for form submissions)
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: true
}));

async function initDB() {
    const flightCount = await Flight.countDocuments();
    if (flightCount === 0) {
        await Flight.insertMany([
            { flightNo: 'PR101', airline: 'Philippine Airlines', origin: 'Manila (MNL)', destination: 'Cebu (CEB)', departureDay: 'Monday', departureTime: '08:00', arrivalDay: 'Monday', arrivalTime: '09:30', aircraftType: 'Airbus A320', seatCap: 180, price: 1500 },
            { flightNo: '5J201', airline: 'Cebu Pacific', origin: 'Manila (MNL)', destination: 'Cebu (CEB)', departureDay: 'Tuesday', departureTime: '10:00', arrivalDay: 'Tuesday', arrivalTime: '11:30', aircraftType: 'Boeing 737', seatCap: 180, price: 1450 },
        ]);
        console.log('Sample flights inserted into the database.');
    }

    const userCount = await User.countDocuments();
    if (userCount === 0) {
        await User.insertMany([
            { firstname: "Juan", lastname: "Dela Cruz", email: "juan@example.com", password: "password123", isAdmin: true },
            { firstname: "Maria", lastname: "Santos", email: "maria@example.com", password: "mypassword", isAdmin: false },
            { firstname: "Carlos", lastname: "Reyes", email: "carlos@example.com", password: "admin123", isAdmin: false }
        ]);
        console.log("Sample users inserted.");
    }
}

// Show main page
app.get('/', async (req, res) => {
    res.redirect('/profile/login');
});

app.use('/flights', flightRoutes);

app.use('/reservations', reservationRoutes);

app.use('/profile', userRoutes);

Handlebars.registerHelper("equals", function (a, b, options) {
  if (a === b) return options.fn(this);
  return options.inverse(this);
});

// start server
if (process.env.NODE_ENV !== 'test') { //for jest testing
    app.listen(PORT, async () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        await initDB();
    });
}

module.exports = app; 