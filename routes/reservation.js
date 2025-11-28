const express = require('express');
const shortid = require('shortid');
const router = express.Router();
const Reservation = require('../models/Reservation');
const Flight = require('../models/Flight');
const { isAuthenticated } = require('./user');
const logger = require('../utils/logger');

// Display booking form with selected flight
router.get('/book', isAuthenticated(), async (req, res) => {
    try {
        const flights = await Flight.find().lean();
        const { depart, return: ret } = req.query;
        const isAdmin = req.session?.user?.isAdmin ?? false;
        const userId = req.session?.userId ?? null;

        const selectedDepart = flights.find(f => f.flightNo === depart);
        const selectedReturn = flights.find(f => f.flightNo === ret) || null;

        // [NEW] Fetch reserved seats for the current flight
        let reservedSeats = [];
        if (selectedDepart) {
            const reservations = await Reservation.find({ 
                flight: selectedDepart.flightNo, 
                status: { $ne: 'Cancelled' } // Ignore cancelled bookings
            }).lean();
            
            // [LOGIC] The DB stores seats as "EA11, EA12". We need to split them into individual codes.
            reservedSeats = reservations.flatMap(r => {
                if (r.package && r.package.seat) {
                    return r.package.seat.split(',').map(s => s.trim());
                }
                return [];
            });
        }

        logger.action(`${isAdmin ? 'Admin' : 'User'} ${req.session.user.email} accessed booking form.`);

        res.render('reservations/book', {
            title: 'Book Flights',
            flights,
            selectedDepart,
            selectedReturn,
            isAdmin,
            userId,
            status: req.query.status,
            reservedSeats // [NEW] Pass this array to the view
        });

    } catch (err) {
        logger.error(`Error loading booking form: ${err.message}`);
        res.status(500).send('Error loading booking form');
    }
});

router.post('/book', async (req, res) => {
    const email = req.session?.user?.email ?? 'Unknown';
  try {
    const {
      passengerName,
      passengerEmail,
      passport,
      phoneNum,
      flightNo,
      seat,
      meal: mealValue,
      baggage: baggageRaw,
      tripType,
      travelClass,
      adults: adultsRaw,
      children: childrenRaw,
      infants: infantsRaw,
      passengerCost: passengerCostRaw,
      tripTypeCost: tripTypeCostRaw,
      travelClassCost: travelClassCostRaw,
      mealCost: mealCostRaw,
      baggageCost: baggageCostRaw,
      totalPrice: totalPriceRaw
    } = req.body;

    const adults = Number(adultsRaw) || 0;
    const children = Number(childrenRaw) || 0;
    const infants = Number(infantsRaw) || 0;
    const totalPassengers = Math.max(1, adults + children + infants);

    const passengerCostPer = Number(passengerCostRaw) || 0;
    const tripTypeCostPer = Number(tripTypeCostRaw) || 0;
    const travelClassCostPer = Number(travelClassCostRaw) || 0;
    const mealCostPer = Number(mealCostRaw) || 0;
    const baggageCostClient = Number(baggageCostRaw) || 0;

    const baggageWeight = Number(baggageRaw) || 0;
    const freeAllowance = 20;
    const excessWeight = Math.max(0, baggageWeight - freeAllowance);
    const EXCESS_RATE_PER_KG = 500;
    const baggageCostCalc = Math.round(excessWeight * EXCESS_RATE_PER_KG);

    const perPassengerSubtotal = passengerCostPer + tripTypeCostPer + travelClassCostPer + mealCostPer;
    const passengerCostTotal = perPassengerSubtotal * totalPassengers;
    const tripTypeCostTotal = tripTypeCostPer * totalPassengers;
    const travelClassCostTotal = travelClassCostPer * totalPassengers;
    const mealCostTotal = mealCostPer * totalPassengers;
    const totalPrice = passengerCostTotal + baggageCostCalc;

    const mealMap = {
      '0': 'Standard (included)',
      '200': 'Vegetarian',
      '250': 'Vegan',
      '300': 'Halal',
      '350': 'Kosher'
    };
    const mealLabel = mealMap[String(mealValue)] || 'Standard (included)';
    const mealCostUsedPer = mealCostPer;

    const bookingId = `BKG-${shortid.generate().toUpperCase()}`;

    const packageObj = {
      seat: seat || '',
      meal: mealLabel,
      mealCost: mealCostUsedPer,
      baggageWeight: baggageWeight,
      freeBaggageAllowance: freeAllowance,
      excessBaggageWeight: excessWeight
    };

    const newReservation = new Reservation({
      user: req.session.userId,
      bookingId,
      passengerName,
      passengerEmail,
      passport,
    
      phoneNum: phoneNum, 
      tripType: tripType,
      travelClass: travelClass,
      adults: adults,
      children: children,
      infants: infants,

      flight: flightNo, 
      passengerCost: passengerCostTotal,
      tripTypeCost: tripTypeCostTotal,
      travelClassCost: travelClassCostTotal,
      mealCost: mealCostTotal,
      baggageCost: baggageCostCalc,
      totalPrice: totalPrice,
      package: packageObj,
      status: 'Confirmed'
    });

    await newReservation.save();
    logger.action(`Reservation created: ID = ${newReservation._id} by User ${email}`)
    return res.redirect('/reservations/book?status=added');
  } catch (err) {
    logger.error(`Failed to create reservation: ${err.message}`);
    return res.redirect('/reservations/book?status=error');
  }
});

// List all reservations
router.get('/list', isAuthenticated(), async (req, res) => {
    const isAdmin = req.session?.user?.isAdmin ?? false; //if user is not logged in, isAdmin is false
    const userId = req.session?.userId ?? null;
    const email = req.session?.user?.email ?? 'Unknown';

    if (!isAdmin) {
        try {
            const email = req.session?.user?.email ?? null; //if user is not logged in, email is null
            
            const rawReservations = await Reservation.find({ passengerEmail: email }).lean();
            
            const flights = await Flight.find().lean();

            const reservations = rawReservations.map(r => {
                
                const flightDetails = flights.find(f => f.flightNo === r.flight) || {};
                
                return {
                    ...r,
                    flightDetails: flightDetails 
                };
            });

            res.render('reservations', { title: 'Reservations List', reservations, isAdmin, userId, status: req.query.status });
        } catch (err) {
            logger.error(`Error loading reservations: ${err.message}`)
            res.status(500).send('Error loading reservations');
        }
    } else {
        try {
            const rawReservations = await Reservation.find().lean();
            const flights = await Flight.find().lean();

            const reservations = rawReservations.map(r => {
                
                const flightDetails = flights.find(f => f.flightNo === r.flight) || {};
                
                return {
                    ...r,
                    flightDetails: flightDetails 
                };
            });

            res.render('reservations', { title: 'Reservations List', reservations, isAdmin, userId, status: req.query.status});
        } catch (err) {
            logger.error(`Error loading reservations: ${err.message}`)
            res.status(500).send('Error loading reservations');
        }
    }

    logger.action(`${isAdmin ? 'Admin' : 'User'} ${email} viewed reservations list.`);
});

// Edit reservation form
router.get('/edit/:id', async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.id).lean();
        const isAdmin = req.session?.user?.isAdmin ?? false;
        const userId = req.session?.userId ?? null;
        const email = req.session?.user?.email ?? 'Unknown';
        
        if (!reservation) return res.status(404).send('Reservation not found');

        const flightNo = reservation.flight;

        const allReservations = await Reservation.find({ 
            flight: flightNo, 
            status: { $ne: 'Cancelled' } 
        }).lean();

        const reservedSeats = allReservations
            .filter(r => r._id.toString() !== reservation._id.toString()) // Don't block own seats
            .flatMap(r => {
                if (r.package && r.package.seat) {
                    return r.package.seat.split(',').map(s => s.trim());
                }
                return [];
            });

        logger.action(`${isAdmin ? 'Admin' : 'User'} ${email} opened edit form for reservation ${req.params.id}`);

        res.render('reservations/edit', { 
            title: 'Edit Reservation', 
            isAdmin,
            userId,
            reservation, 
            reservedSeats
        });

    } catch (err) {
        logger.error(`Error retrieving reservation: ${err.message}`);
        res.status(500).send('Error retrieving reservation');
    }
});

router.post('/edit/:id', async (req, res) => {
    const { seat, meal, baggage, status } = req.body;
    const isAdmin = req.session?.user?.isAdmin ?? false;
    const email = req.session?.user?.email ?? 'Unknown';
    
    try {
        await Reservation.findByIdAndUpdate(req.params.id, {
            $set: { 
                'package.seat': seat, 
                'package.meal': meal, 
                'package.baggageWeight': baggage, 
                
                status 
            }
        });
        logger.action(`Reservation ID = ${req.params.id} updated by ${isAdmin ? 'Admin' : 'User'} ${email}`);
        res.redirect('/reservations/list?status=updated');
    } catch (err) {
        logger.error(`Update reservation error: ${err.message}`);
        res.redirect('/reservations/list?status=error');
    }
});

// Cancel (soft delete)
router.post('/delete/:id', async (req, res) => {
    const isAdmin = req.session?.user?.isAdmin ?? false;
    const email = req.session?.user?.email ?? "Unknown";
    try {
        await Reservation.findByIdAndUpdate(req.params.id, { status: 'Cancelled' });
        logger.action(`Reservation ID = ${req.params.id} cancelled by ${isAdmin ? 'Admin' : 'User'} ${email}`);
        res.redirect('/reservations/list?status=cancelled');
    } catch (err) {
        logger.error(`Cancel error: ${err.message}`);
        res.redirect('/reservations/list?status=error');
    }
});

// checkin route
router.get('/checkin', (req, res) => {
    const email = req.session?.user?.email ?? 'Unknown';
    logger.action(`User ${email} accessed online check-in page`);
    res.render('reservations/checkin', { title: "Online Check-In", status: req.query.status });
});

// check in api
router.post('/api/checkin', async (req, res) => {
    try {
        const { bookingId, lastName } = req.body;

        // check both fields
        if (!bookingId || !lastName) {
            logger.error(`Check-in error: No booking ID or last name.`);
            return res.status(400).json({ error: "Booking ID and last name required." });
        }

        // find reservation using bookingId
        const reservation = await Reservation.findOne({ bookingId });

        if (!reservation) {
            logger.error(`Check-in error: Reservation not found.`);
            return res.status(404).json({ error: "Reservation not found." });
        }

        if (reservation.status === "Cancelled") {
            logger.error(`Check-in error: Reservation is cancelled.`);
            return res.status(400).json({ error: "Reservation is cancelled." });
        }

        // get last name
        const actualLast = reservation.passengerName.split(" ").pop().toLowerCase();
        const providedLast = lastName.trim().toLowerCase();

        // compare last names
        if (actualLast !== providedLast) {
            logger.error(`Check-in error: Last name does not match records.`);
            return res.status(400).json({ error: "Last name does not match records." });
        }

        // check if checked in
        if (reservation.checkedIn) {
            return res.json({
                message: "Passenger already checked in.",
                boardingPassNumber: reservation.boardingPassNumber,
                seat: reservation.package?.seat || "Not assigned"
            });
        }

        // generate a boarding pass
        const bp = "BP-" + Math.random().toString(36).substring(2, 8).toUpperCase();

        // update reservation
        reservation.checkedIn = true;
        reservation.boardingPassNumber = bp;
        await reservation.save();

        logger.action(`Booking ID = ${reservation.bookingId} by ${lastName} is successful.`);
        // return success response
        res.json({
            message: "Check-in successful!",
            bookingId: reservation.bookingId,
            seat: reservation.package?.seat || "Not assigned",
            boardingPassNumber: bp
        });

    } catch (err) {
        logger.error(`Check-in error: ${err.message}`);
        res.status(500).json({ error: "Server error during check-in." });
    }
});

module.exports = router;