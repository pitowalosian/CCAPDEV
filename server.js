const express = require('express');
const path = require('path');
const exphbs = require('express-handlebars');
const Flight = require('./models/Flight');
const mongoose = require('mongoose');
const Handlebars = require('handlebars');
const methodOverride = require('method-override');

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
app.use(methodOverride('_method'));

// List all flights
app.get('/', async (req, res) => {
    const flights = await Flight.find().lean();
    res.render('flights', { title: 'Flight Management', flights });
});

// Route to handle adding a new flight
app.post('/add-flights', async (req, res) => {
    try {
        const newFlight = new Flight(req.body);
        await newFlight.save();
        res.redirect('/flights?status=added'); // redirect with success flag
    } catch (error) {
        console.error(error);
        res.redirect('/flights?status=error'); // redirect with error flag
    }
});

// List all flights with status handling
app.get('/flights', async (req, res) => {
    try {
        const flights = await Flight.find().lean(); // get all flights
        const status = req.query.status || ''; // read ?status=success or ?status=error
        res.render('flights', { title: 'Flights List', flights, form: { submit: status } }); // send status to handlebars
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading flights');
    }
});

// Display edit form
app.get('/flights/edit/:id', async (req, res) => {
    try {
        const flight = await Flight.findById(req.params.id).lean();
        if (flight) {
            flight.departureTimeFormatted = formatDateTime(flight.departureTime);
            flight.arrivalTimeFormatted = formatDateTime(flight.arrivalTime);
            res.render('flights/edit', { title: 'Edit Flight', flight: flight });
        } else {
            res.status(404).send('Flight not found'); 
        }
    } catch (err) {
        res.status(500).send('Error retrieving flight');
    }
});

// Handle edit form submission
app.patch('/flights/edit/:id', async (req, res) => {
    try {
        await Flight.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.redirect('/flights?status=updated');
    } catch (err) {
        res.redirect('/flights?status=error');
    }
});

// Delete a flight by ID
app.post('/flights/delete/:id', async (req, res) => {
    try {
        await Flight.findByIdAndDelete(req.params.id);
        res.redirect('/flights?status=deleted');
    } catch (err) {
        res.redirect('/flights?status=error');
    }
});


Handlebars.registerHelper("equals", function(string1 ,string2, options) {
    if (string1 === string2) {
        return options.fn(this);
    } else {
        return options.inverse(this);
    }
});

// Helper function to format date to 'YYYY-MM-DDTHH:MM' for datetime-local input
function formatDateTime(date) {
    const dt = new Date(date);
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const hours = String(dt.getHours()).padStart(2, '0');
    const minutes = String(dt.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}


// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
