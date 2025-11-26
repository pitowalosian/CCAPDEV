const express = require('express');
const router = express.Router();
const Flight = require('../models/Flight');
const { isAuthenticated } = require('./user');

// Route to handle adding a new flight
router.post('/add', isAuthenticated(true), async (req, res) => {
    try {
        const { flightNo, airline, origin, destination, departureDay, departureTime, 
            arrivalDay, arrivalTime, price, aircraftType, seatCap } = req.body;
        
        // insert input validation
        
        const newFlight = new Flight({
            flightNo,
            airline,
            origin,
            destination,
            departureDay,
            departureTime,
            arrivalDay,
            arrivalTime,
            price,
            aircraftType,
            seatCap
        });
        await newFlight.save();
        res.redirect('/flights?status=added'); // redirect with success flag
    } catch (err) {
        console.log(err);
        res.redirect('/flights?status=error'); // redirect with error flag
    }
});

// List all flights with status handling
router.get('/', isAuthenticated(true), async (req, res) => {
    try {
        const flights = await Flight.find().lean(); // get all flights
        res.render('flights', { title: 'Flights List', flights }); // send status to handlebars
    } catch (err) {
        console.error(err);
        res.render('flights', {
            title: 'Flights List',
            flights: [],
            userId,
            status: 'error'
        });
    }
});

// NOT WORKING YET
// Display edit form
router.get('/edit/:id', async (req, res) => {
    try {
        const flight = await Flight.findById(req.query.id).lean();
        const userId = req.session.userId;
        if (flight) {
            res.render('flights/edit', { title: 'Edit Flight', flight, userId });
        } else {
            res.status(404).send('Flight not found'); 
        }
    } catch (err) {
        res.status(500).send('Error retrieving flight');
    }
});

// NOT WORKING YET
// Handle edit form submission
router.post('/edit/:id', async (req, res) => {
    console.log('Edit form submission:', req.body);
    const { flightNo, airline, origin, destination, departureDay, departureTime, arrivalDay, arrivalTime, price, aircraftType, seatCap } = req.body;
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
                price,
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
router.post('/delete/:id', async (req, res) => {
    try {
        await Flight.findOneAndDelete({_id: req.params.id});
        res.redirect('/flights?status=deleted');
    } catch (err) {
        console.log(err);
        res.redirect('/flights?status=error');
    }
});

// NOT WORKING PROPERLY
// Search flights
router.get('/search', async (req, res) => {
    try {
        const { origin, destination, depdate, retdate, userId } = req.query;

        if (!depdate) {
            return res.render('flights/search', { title: 'Search Flights', flights: [], date: null, userId, showResults: false });
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

        res.render('flights/search', { title: 'Search Flights', flights, returnFlights, dDate: depdate, rDate: retdate, dDayOfWeek, rDayOfWeek, origin, destination, userId, showResults: true, formsubmitted: true});
    } catch (err) {
        console.log(err);
        res.status(500).send('Error searching for flights');
    }
});

module.exports = router;