const express = require('express');
const router = express.Router();
const Flight = require('../models/Flight');
const { isAuthenticated } = require('./user');
const logger = require('../utils/logger');

// Route to handle adding a new flight
router.post('/add', isAuthenticated(true), async (req, res) => {
    try {
        const email = req.session?.user?.email ?? 'Unknown';
        const { flightNo, airline, origin, destination, departureDay, departureTime, 
            arrivalDay, arrivalTime, price, aircraftType, seatCap } = req.body;
        
        // SERVER-SIDE VALIDATION ---
        const errors = [];

        // Validate Strings (Empty checks)
        if (!flightNo?.trim()) errors.push("Flight number is required.");
        if (!airline?.trim()) errors.push("Airline is required.");
        if (!origin?.trim()) errors.push("Origin is required.");
        if (!destination?.trim()) errors.push("Destination is required.");

        // Validate Numbers (Price and Capacity)
        if (Number(price) < 0) errors.push("Price cannot be negative.");
        if (Number(seatCap) < 1) errors.push("Seat capacity must be at least 1.");

        // Validate Time Format (Simple HH:MM check)
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(departureTime)) errors.push("Invalid departure time format.");
        if (!timeRegex.test(arrivalTime)) errors.push("Invalid arrival time format.");

        if (errors.length > 0) {
            logger.error(`Flight Validation Failed: ${errors.join(", ")}`);
            return res.redirect('/flights?status=error');
        }
    
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
        logger.action(`Flight created: ID = ${newFlight._id} by Admin ${email}`);
        res.redirect('/flights?status=added'); // redirect with success flag
    } catch (err) {
        logger.error(`Failed to create flight: ${err.message}`);
        res.redirect('/flights?status=error'); // redirect with error flag
    }
});

// List all flights with status handling
router.get('/', isAuthenticated(true), async (req, res) => {
    try {
        const flights = await Flight.find().lean(); // get all flights
        const status = req.query.status; // get status from query
        const userId = req.session?.userId ?? null;
        const email = req.session?.user?.email ?? 'Unknown';

        logger.action(`Admin ${email} viewed flights list.`);
        res.render('flights', { title: 'Flights List', flights, status, userId }); 
    } catch (err) {
        logger.error(`Error loading flights: ${err}`);
        res.render('flights', {
            title: 'Flights List',
            flights: [],
            status: 'error'
        });
    }
});

// Display edit form
router.get('/edit/:id', isAuthenticated(true), async (req, res) => {
    const email = req.session?.user?.email ?? 'Unknown';

    logger.action(`Admin ${email} opened edit form for flight ${req.params.id}.`);
    try {
        const flight = await Flight.findById(req.params.id).lean();
        if (flight) {
            res.render('flights/edit', { title: 'Edit Flight', flight });
        } else {
            res.status(404).send('Flight not found'); 
        }
    } catch (err) {
        res.status(500).send('Error retrieving flight');
    }
});

// Handle edit form submission
router.post('/edit/:id', isAuthenticated(true), async (req, res) => {
    const { flightNo, airline, origin, destination, departureDay, departureTime, arrivalDay, arrivalTime, price, aircraftType, seatCap } = req.body;
    const email = req.session?.user?.email ?? 'Unknown';

    // SERVER-SIDE VALIDATION
    const errors = [];
    if (!flightNo?.trim()) errors.push("Flight number is required.");
    if (Number(price) < 0) errors.push("Price cannot be negative.");
    if (Number(seatCap) < 1) errors.push("Seat capacity must be at least 1.");

    if (errors.length > 0) {
        logger.error(`Flight Edit Validation Failed: ${errors.join(", ")}`);
        return res.redirect('/flights?status=error');
    }

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
        logger.action(`Flight ID = ${req.params.id} updated by Admin ${email}`)
        res.redirect('/flights?status=updated');
    } catch (err) {
        logger.error(`Update flight error: ${err.message}`);
        res.redirect('/flights?status=error');
    }
});

// Delete a flight by ID
router.post('/delete/:id', async (req, res) => {
    try {
        const email = req.session?.user?.email ?? 'Unknown';
        await Flight.findOneAndDelete({_id: req.params.id});
        logger.action(`Flight ID = ${req.params.id} deleted by Admin ${email}`);
        res.redirect('/flights?status=deleted');
    } catch (err) {
        logger.error(`Deletion error: ${err.message}`);
        res.redirect('/flights?status=error');
    }
});

// Search flights
router.get('/search', async (req, res) => {
    try {
        const { origin, destination, depdate, retdate } = req.query;
        const isAdmin = req.session?.user?.isAdmin ?? false;
        const userId = req.session?.userId ?? null;
        const email = req.session?.user?.email ?? 'Unknown';

        if (!depdate) {
            return res.render('flights/search', { title: 'Search Flights', flights: [], date: null, isAdmin, userId, showResults: false });
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
        logger.action(`${isAdmin ? 'Admin' : 'User'} ${email} accessed search form.`);
        res.render('flights/search', { title: 'Search Flights', flights, returnFlights, dDate: depdate, rDate: retdate, dDayOfWeek, rDayOfWeek, origin, destination, userId, showResults: true, formsubmitted: true});
    } catch (err) {
        logger.error(`Error searching for flights: ${err.message}`);
        res.status(500).send('Error searching for flights');
    }
});

module.exports = router;