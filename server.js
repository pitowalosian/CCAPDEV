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
const userRoutes = require('./routes/user');

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

// Show main page
app.get('/', async (req, res) => {
    res.redirect('/search');
});

app.get('/search', async (req, res) => {
    try {
        const { origin, destination, depdate, retdate, userId } = req.query;

        if (!depdate) {
            return res.render('search', { title: 'Search Flights', flights: [], date: null, userId, showResults: false });
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

        res.render('search', { title: 'Search Flights', flights, returnFlights, dDate: depdate, rDate: retdate, dDayOfWeek, rDayOfWeek, origin, destination, userId, showResults: true, formsubmitted: true});
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
        const userId = req.query.userId;
        const flights = await Flight.find().lean(); // get all flights
        const status = req.query.status || ''; // read ?status=success or ?status=error
        res.render('flights', { title: 'Flights List', flights, userId, status }); // send status to handlebars
    } catch (error) {
        console.error(error);
        res.render('flights', {
            title: 'Flights List',
            flights: [],
            userId,
            status: 'error'
        });
    }
});

// Display edit form
app.get('/flights/edit/:id', async (req, res) => {
    try {
        const flight = await Flight.findById(req.params.id).lean();
        const userId = req.query.userId;
        if (flight) {
            res.render('flights/edit', { title: 'Edit Flight', flight: flight, userId });
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
app.post('/flights/delete/:id', async (req, res) => {
    try {
        await Flight.findOneAndDelete({_id: req.params.id});
        res.redirect('/flights?status=deleted');
    } catch (err) {
        console.log(err);
        res.redirect('/flights?status=error');
    }
});

// Display booking form with selected flight
// Display booking form with selected flight
app.get('/book', async (req, res) => {
    try {
        const flights = await Flight.find().lean();
        const { depart, return: ret, userId } = req.query;

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

        res.render('book', {
            title: 'Book Flights',
            flights,
            selectedDepart,
            selectedReturn,
            userId,
            reservedSeats // [NEW] Pass this array to the view
        });

    } catch (error) {
        console.log(error);
        res.status(500).send('Error loading booking form');
    }
});

// List all reservations
app.get('/reservations', async (req, res) => {
    try {
        const userId = req.query.userId;
        
        const rawReservations = await Reservation.find().lean();
        
        const flights = await Flight.find().lean();

        const reservations = rawReservations.map(r => {
            
            const flightDetails = flights.find(f => f.flightNo === r.flight) || {};
            
            return {
                ...r,
                flightDetails: flightDetails 
            };
        });

        res.render('reservations', { title: 'Reservations List', reservations, userId });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading reservations');
    }
});

// Show form to create a new reservation
app.get('/reservations/new', async (req, res) => {
    try {
        const flights = await Flight.find().lean();
        const userId = req.query.userId;
        res.render('reservations/new', { title: 'New Reservation', flights, userId });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading new reservation form');
    }
});

app.post('/reservations', async (req, res) => {
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
    return res.redirect('/reservations?status=added');
  } catch (error) {
    console.error('Error saving reservation:', error);
    return res.redirect('/reservations?status=error');
  }
});

// Edit reservation form
app.get('/reservations/edit/:id', async (req, res) => {
    try {
        const userId = req.query.userId;
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
            userId,
            reservedSeats
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Error retrieving reservation');
    }
});

app.post('/reservations/edit/:id', async (req, res) => {
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

app.use('/', userRoutes);

Handlebars.registerHelper("equals", function (a, b, options) {
  if (a === b) return options.fn(this);
  return options.inverse(this);
});

// start server
app.listen(PORT, async () => {
    console.log(`Server is running on http://localhost:${PORT}`);

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
});

