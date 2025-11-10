const express = require('express');
const path = require('path');
const exphbs = require('express-handlebars');
const Flight = require('./models/Flight');
const Reservation = require('./models/Reservation');
const shortid = require('shortid');
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
    try {
        const { origin, destination, depdate, retdate } = req.query;

        if (!depdate) {
            return res.render('search', { title: 'Search Flights', flights: [], date: null, showResults: false });
        }

        const departureDate = new Date(depdate);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dDayOfWeek = days[departureDate.getDay()];
        
        let depQuery = {
                origin, destination, departureDay: dDayOfWeek
        };
        const flights = await Flight.find(depQuery).lean();

        let returnFlights = [];
        let rDayOfWeek = null;

        if (retdate) {
            const returnDate = new Date(retdate);
            if (!isNaN(returnDate.getTime())) {
                rDayOfWeek = days[returnDate.getDay()];
                const returnQuery = { origin: destination, destination: origin, departureDay: rDayOfWeek };
                returnFlights = await Flight.find(returnQuery).lean();
            }
        }
        
        res.render('search', { title: 'Search Flights', flights, returnFlights, dDate: depdate, rDate: retdate, dDayOfWeek, rDayOfWeek, origin, destination, showResults: true });
    } catch (err) {
        console.log(err);
        res.status(500).send('Error searching for flights');
    }
});

// Route to handle adding a new flight
app.post('/add-flights', async (req, res) => {
    try {
        const newFlight = new Flight(req.body);
        console.log(req.body);
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
        res.render('flights', { title: 'Flights List', flights, status }); // send status to handlebars
    } catch (error) {
        console.error(error);
        res.render('flights', {
            title: 'Flights List',
            flights: [],
            status: 'error'
        });
    }
});

// Display edit form
app.get('/flights/edit/:id', async (req, res) => {
    try {
        const flight = await Flight.findById(req.params.id).lean();
        if (flight) {
            res.render('flights/edit', { title: 'Edit Flight', flight: flight });
        } else {
            res.status(404).send('Flight not found'); 
        }
    } catch (err) {
        res.status(500).send('Error retrieving flight');
    }
});

// Handle edit form submission
app.post('/flights/edit/:id', async (req, res) => {
    console.log('Edit form submission:', req.body);
    const { flightNo, airline, origin, destination, departureDay, departureTime, arrivalDay, arrivalTime, aircraftType, seatCap } = req.body;
    try {
        await Flight.findOneAndUpdate(
            { _id: req.params.id},
            { $set: {
                flightNo,
                airline, 
                origin, 
                destination, 
                departureDay,
                departureTime, 
                arrivalDay,
                arrivalTime, 
                aircraftType,
                seatCap
            } }, 
            { new: true, runValidators: true });
        res.redirect('/flights?status=updated');
    } catch (err) {
        console.log(err);
        res.redirect('/flights?status=error');
    }
});

// Delete a flight by ID
app.post('/flights/delete/:id', async (req, res) => {
    try {
        await Flight.findOneAndDelete({_id: req.params.id});
        res.redirect('/flights?status=deleted');
    } catch (err) {
        console.log(err);
        res.redirect('/flights?status=error');
    }
});

// Display booking form
app.get('/book', async (req, res) => {
    try {
        const flights = await Flight.find().lean();
        const selectedFlightId = req.query.flightId;
        res.render('book', { 
            title: 'Book Flights',
            flights,
            selectedFlightId
        });
    } catch (error) {
        console.log(error);
        res.status(500).send('Error loading booking form');
    }
});

// List all reservations
app.get('/reservations', async (req, res) => {
    try {
        const reservations = await Reservation.find().populate('flight').lean();
        res.render('reservations', { title: 'Reservations List', reservations });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading reservations');
    }
});

// Show form to create a new reservation
app.get('/reservations/new', async (req, res) => {
    try {
        const flights = await Flight.find().lean();
        res.render('reservations/new', { title: 'New Reservation', flights });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading new reservation form');
    }
});

// Handle new reservation submission
app.post('/reservations', async (req, res) => {
    try {
        const { passengerName, passengerEmail, passport, flightId, seat, meal, baggage } = req.body;
        const bookingId = `BKG-${shortid.generate().toUpperCase()}`;

        const newReservation = new Reservation({
            bookingId,
            passengerName,
            passengerEmail,
            passport,
            flight: flightId,
            package: { seat, meal, baggage },
            status: 'Confirmed'
        });

        await newReservation.save();
        res.redirect('/reservations?status=added');
    } catch (error) {
        console.error(error);
        res.redirect('/reservations?status=error');
    }
});

// Edit reservation
app.get('/reservations/edit/:id', async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.id).populate('flight').lean();
        if (!reservation) return res.status(404).send('Reservation not found');
        res.render('reservations/edit', { title: 'Edit Reservation', reservation });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error retrieving reservation');
    }
});

app.post('/reservations/edit/:id', async (req, res) => {
    const { seat, meal, baggage, status } = req.body;
    try {
        await Reservation.findByIdAndUpdate(req.params.id, {
            $set: { 'package.seat': seat, 'package.meal': meal, 'package.baggage': baggage, status }
        });
        res.redirect('/reservations?status=updated');
    } catch (err) {
        console.error(err);
        res.redirect('/reservations?status=error');
    }
});

// Cancel (soft delete)
app.post('/reservations/delete/:id', async (req, res) => {
    try {
        await Reservation.findByIdAndUpdate(req.params.id, { status: 'Cancelled' });
        res.redirect('/reservations?status=cancelled');
    } catch (err) {
        console.error(err);
        res.redirect('/reservations?status=error');
    }
});

app.get('/flights/search', async (req, res) => {
    try {
        const { origin, destination, depdate } = req.query;

        if (!depdate) {
            return res.render('search', { title: 'Search Flights', flights: [], date: null });
        }

        const inputDate = new Date(depdate);
        
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeek = days[inputDate.getDay()];

        const query = {
            origin, destination, departureDay: dayOfWeek
        };

        const flights = await Flight.find(query).lean();

        res.render('search', { title: 'Search Flights', flights, date: depdate, dayOfWeek });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error searching for flights');
    }
})

Handlebars.registerHelper("equals", function (a, b, options) {
  console.log("=== DEBUG: equals helper called ===");
  console.log("a:", a);
  console.log("b:", b);
  console.log("options:", options);
  console.log("options.fn:", options?.fn);
  console.log("options.inverse:", options?.inverse);
  console.log("==============================");

  if (typeof options === "object" && typeof options.fn === "function") {
    // This means it's being used as a block helper
    return a === b ? options.fn(this) : options.inverse(this);
  }

  // Otherwise, it's inline — just return true/false
  return a === b;
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
