const express = require('express');
const path = require('path');
const exphbs = require('express-handlebars');
const Flight = require('./models/Flight');
const mongoose = require('mongoose');
const Handlebars = require('handlebars');

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
        res.redirect('/flights?status=success'); // ✅ redirect with success flag
    } catch (error) {
        console.error(error);
        res.redirect('/flights?status=error'); // redirect with error flag
    }
});

app.get('/flights', async (req, res) => {
    try {
        const flights = await Flight.find().lean(); // get all flights
        const status = req.query.status || ''; // read ?status=success or ?status=error

        res.render('flights', { 
        title: 'Flights List',
        flights,
        form: { submit: status } // send status to handlebars
        });
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
            res.render('flights/edit', { title: 'Edit Flight', Flight: flight });
        } else {
            res.status(404).send('Flight not found'); 
        }
    } catch (err) {
        res.status(500).send('Error retrieving flight');
    }
});

// Handle edit form submission
app.put('/flights/edit/:id', async (req, res) => {
    try {
        const { flightNo,  } = req.body;
        const flight = await Flight.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (flight) {
            res.redirect('/flights');
        } else {
            res.status(404).send('Flight not found');
        }
    } catch (err) {
        res.status(500).send('Error updating flight');
    }
});

// Delete a flight by ID
app.post('/flights/delete/:id', async (req, res) => {
    try {
        const flight = await Flight.findByIdAndDelete(req.params.id);
        if (flight) {
            res.redirect('/flights');
        } else {
            res.status(404).send('Flight not found');
        }
    } catch (err) {
        res.status(500).send('Error deleting flight');
    }
});


Handlebars.registerHelper("equals", function(string1 ,string2, options) {
    if (string1 === string2) {
        return options.fn(this);
    } else {
        return options.inverse(this);
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
