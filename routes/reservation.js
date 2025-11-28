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

        res.render('reservations/book', {
            title: 'Book Flights',
            flights,
            selectedDepart,
            selectedReturn,
            reservedSeats // [NEW] Pass this array to the view
        });

    } catch (error) {
        console.log(error);
        res.status(500).send('Error loading booking form');
    }
});

// NOT WORKING YET
router.post('/book', async (req, res) => {
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
    return res.redirect('/reservations/book?status=added');
  } catch (error) {
    console.error('Error saving reservation:', error);
    return res.redirect('/reservations/book?status=error');
  }
});

// WORKING
// List all reservations
router.get('/list', isAuthenticated(), async (req, res) => {
    const isAdmin = req.session?.user?.isAdmin ?? false; //if user is not logged in, isAdmin is false
    const userId = req.session?.userId ?? null;

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

            res.render('reservations', { title: 'Reservations List', reservations, isAdmin, userId });
        } catch (error) {
            console.error(error);
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

            res.render('reservations', { title: 'Reservations List', reservations, isAdmin, userId });
        } catch (error) {
            console.error(error);
            res.status(500).send('Error loading reservations');
        }
    }
});

// // NOT NEEDED ?
// // Show form to create a new reservation
// router.get('/new', async (req, res) => {
//     try {
//         const flights = await Flight.find().lean();
//         const userId = req.query.userId;
//         res.render('reservations/new', { title: 'New Reservation', flights, userId });
//     } catch (err) {
//         console.error(err);
//         res.status(500).send('Error loading new reservation form');
//     }
// });

// Edit reservation form
router.get('/edit/:id', async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.id).lean();
        
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

        res.render('reservations/edit', { 
            title: 'Edit Reservation', 
            reservation, 
            reservedSeats
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Error retrieving reservation');
    }
});

router.post('/edit/:id', async (req, res) => {
    const { seat, meal, baggage, status } = req.body;
    
    try {
        await Reservation.findByIdAndUpdate(req.params.id, {
            $set: { 
                'package.seat': seat, 
                'package.meal': meal, 
                'package.baggageWeight': baggage, 
                
                status 
            }
        });
        res.redirect('/reservations/list?status=updated');
    } catch (err) {
        console.error(err);
        res.redirect('/reservations/list?status=error');
    }
});

// Cancel (soft delete)
router.post('/delete/:id', async (req, res) => {
    try {
        await Reservation.findByIdAndUpdate(req.params.id, { status: 'Cancelled' });
        res.redirect('/reservations/list?status=cancelled');
    } catch (err) {
        console.error(err);
        res.redirect('/reservations/list?status=error');
    }
});

// checkin route
router.get('/checkin', (req, res) => {
    res.render('reservations/checkin', { title: "Online Check-In" });
});

// check in api
router.post('/api/checkin', async (req, res) => {
    try {
        const { bookingId, lastName } = req.body;

        // check both fields
        if (!bookingId || !lastName) {
            return res.status(400).json({ error: "Booking ID and last name are required." });
        }

        // find reservation using bookingId
        const reservation = await Reservation.findOne({ bookingId });

        if (!reservation) {
            return res.status(404).json({ error: "Reservation not found." });
        }

        // get last name
        const actualLast = reservation.passengerName.split(" ").pop().toLowerCase();
        const providedLast = lastName.trim().toLowerCase();

        // compare last names
        if (actualLast !== providedLast) {
            return res.status(403).json({ error: "Last name does not match our records." });
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

        // return success response
        res.json({
            message: "Check-in successful!",
            bookingId: reservation.bookingId,
            seat: reservation.package?.seat || "Not assigned",
            boardingPassNumber: bp
        });

    } catch (err) {
        console.error("Check-in Error:", err);
        res.status(500).json({ error: "Server error during check-in." });
    }
});

module.exports = router;